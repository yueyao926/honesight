from __future__ import annotations

import json
import hashlib
import logging
from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.database import SessionLocal, get_db
from app.models.analysis import AnalysisJob
from app.models.practice import CoachMemory, PracticeAttempt, PracticeProgress, PracticeSession
from app.models.preference import Preference
from app.models.user import User
from app.schemas.practice import (
    PracticeAttemptCreate,
    PracticeAttemptJobRead,
    PracticeDifficultyUpdate,
    PracticeOverviewRead,
    PracticeSessionCreate,
    PracticeSessionJobRead,
    PracticeSessionRead,
)
from app.services.practice_analyzer import analyze_practice_context_cached
from app.services.vision_analyzer import VisionAnalysisError
from app.services.practice_coach import (
    analyze_practice_source,
    build_attempt_feedback,
    choose_practice,
    current_week_key,
    initial_level,
    select_least_practiced_ability,
)
from app.services.practice_templates import CYCLE_LABELS, get_task, simplified_task
from app.services.image_storage import local_upload_path


router = APIRouter(prefix="/practice", tags=["practice"])
logger = logging.getLogger("uvicorn.error")
MAX_PRACTICE_ROUNDS = 3
MAX_WEEKLY_PRACTICES = 3


@router.get("/overview", response_model=PracticeOverviewRead)
def get_practice_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    current_sessions = _get_plan_sessions(current_user.id, db)
    current = current_sessions[0] if current_sessions else None
    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    history = list(
        db.scalars(
            select(PracticeSession)
            .options(selectinload(PracticeSession.attempts))
            .where(PracticeSession.user_id == current_user.id, PracticeSession.status == "completed")
            .order_by(PracticeSession.completed_at.desc())
            .limit(6)
        )
    )
    progress = list(
        db.scalars(
            select(PracticeProgress)
            .where(PracticeProgress.user_id == current_user.id)
            .order_by(PracticeProgress.category, PracticeProgress.ability)
        )
    )
    return {
        "current": _session_to_dict(current) if current else None,
        "current_sessions": [_session_to_dict(item) for item in current_sessions],
        "week_key": current_week_key(),
        "weekly_budget_minutes": int(preference.weekly_practice_minutes if preference else 20),
        "scheduled_minutes": sum(item.time_minutes for item in current_sessions),
        "completed_minutes": sum(item.time_minutes for item in current_sessions if item.status == "completed"),
        "can_add": len(current_sessions) < MAX_WEEKLY_PRACTICES,
        "history": [_session_to_dict(item) for item in history],
        "progress": [_progress_to_dict(item) for item in progress],
    }


@router.post("/sessions", response_model=PracticeSessionRead, status_code=status.HTTP_201_CREATED)
def start_practice_session(
    payload: PracticeSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    existing: PracticeSession | None = None
    if payload.replace_session_id:
        existing = _get_owned_session(payload.replace_session_id, current_user.id, db)
        if not existing:
            raise HTTPException(status_code=404, detail="要更换的练习不存在")
    elif payload.replace_current:
        existing = _get_current_week_session(current_user.id, db)
    if existing and (existing.attempts or existing.status == "completed"):
        raise HTTPException(status_code=409, detail="已经开始的练习不能更换，可以添加一个选练")

    plan_sessions = _get_plan_sessions(current_user.id, db)
    if not existing and len(plan_sessions) >= MAX_WEEKLY_PRACTICES:
        raise HTTPException(status_code=409, detail="本周最多安排三个练习，请先完成当前计划")
    planned_abilities = {
        item.skill_focus for item in plan_sessions if item.id != (existing.id if existing else None)
    }

    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    photo_analysis: dict | None = None
    source_analysis: dict = {}
    if payload.entry_mode == "improve":
        report, _cache_hit = analyze_practice_context_cached(
            db=db,
            user_id=current_user.id,
            image_url=str(payload.source_image_url),
            preference=preference,
            mode="source",
            selected_goal=payload.target_goal,
            level=initial_level(preference),
        )
        source_analysis = report
        photo_analysis = analyze_practice_source(report, payload.target_goal)
        category = str(photo_analysis["photo_type"])
        ability = str(photo_analysis["ability"])
        if payload.target_goal == "不确定" and ability in planned_abilities:
            rows = list(
                db.scalars(
                    select(PracticeProgress).where(
                        PracticeProgress.user_id == current_user.id,
                        PracticeProgress.category == category,
                    )
                )
            )
            ability = select_least_practiced_ability(rows, planned_abilities)
            photo_analysis["ability"] = ability
            photo_analysis["priority_issue"] = f"本周还可以继续稳定{ability}。"
    else:
        category = str(payload.category)
        if payload.target_goal in {"构图", "光线", "清晰度", "色彩"}:
            ability = payload.target_goal
        else:
            rows = list(
                db.scalars(
                    select(PracticeProgress).where(
                        PracticeProgress.user_id == current_user.id,
                        PracticeProgress.category == category,
                    )
                )
            )
            ability = select_least_practiced_ability(rows, planned_abilities)

    duplicate = next(
        (
            item for item in plan_sessions
            if item.skill_focus == ability and item.id != (existing.id if existing else None)
        ),
        None,
    )
    if duplicate:
        raise HTTPException(status_code=409, detail=f"本周计划里已经有「{ability}」练习")

    progress = _get_or_create_progress(current_user.id, category, ability, preference, db)
    if payload.entry_mode == "improve" and payload.source_image_url and not progress.cycle_source_image_url:
        progress.cycle_source_image_url = payload.source_image_url
    task = get_task(category, ability, progress.level, progress.cycle_week)
    source_image_url = payload.source_image_url
    if progress.cycle_week == 4 and progress.cycle_source_image_url:
        source_image_url = progress.cycle_source_image_url
    preferred_minutes = preference.weekly_practice_minutes if preference else 20
    time_minutes = min(int(task["time_minutes"]), int(preferred_minutes or 20))
    time_minutes = 10 if time_minutes < 20 else 20 if time_minutes < 40 else 40
    priority_issue = str(photo_analysis["priority_issue"] if photo_analysis else task["issue"])
    brief = f"你的上张照片中，{priority_issue}" if payload.entry_mode == "improve" else str(task["issue"])

    has_primary = any(item.plan_role == "primary" and item.id != (existing.id if existing else None) for item in plan_sessions)
    requested_role = payload.plan_role
    plan_role = "optional" if requested_role == "primary" and has_primary else requested_role
    next_position = max((item.position for item in plan_sessions), default=-1) + 1
    values = {
        "user_id": current_user.id,
        "week_key": current_week_key(),
        "plan_role": existing.plan_role if existing else plan_role,
        "position": existing.position if existing else next_position,
        "entry_mode": payload.entry_mode,
        "category": category,
        "skill_focus": ability,
        "level": progress.level,
        "cycle_week": progress.cycle_week,
        "time_minutes": time_minutes,
        "source_image_url": source_image_url,
        "source_analysis_json": json.dumps(source_analysis, ensure_ascii=False, default=str),
        "target_goal": payload.target_goal,
        "photo_intent": str(photo_analysis["intent"] if photo_analysis else f"练习{category}拍摄。"),
        "priority_issue": priority_issue,
        "analysis_confidence": float(photo_analysis["confidence"] if photo_analysis else 1.0),
        "title": str(task["title"]),
        "brief": brief,
        "steps_json": json.dumps(task["steps"], ensure_ascii=False),
        "constraints_json": json.dumps(task["steps"], ensure_ascii=False),
        "success_criteria_json": json.dumps(task["criteria"], ensure_ascii=False),
        "optional_challenge": str(task["challenge"]),
        "simplified_task_json": "{}",
        "coach_note": str(task["goal"]),
        "status": "active",
        "started_at": None,
        "completed_at": None,
    }
    if existing:
        for key, value in values.items():
            if key != "user_id":
                setattr(existing, key, value)
        session = existing
    else:
        session = PracticeSession(**values)
        db.add(session)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="本周任务刚刚已经生成")
    session = _load_session(session.id, db) or session
    return _session_to_dict(session)


@router.post(
    "/session-jobs",
    response_model=PracticeSessionJobRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_practice_session_job(
    payload: PracticeSessionCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    existing: PracticeSession | None = None
    if payload.replace_session_id:
        existing = _get_owned_session(payload.replace_session_id, current_user.id, db)
        if not existing:
            raise HTTPException(status_code=404, detail="要更换的练习不存在")
    elif payload.replace_current:
        existing = _get_current_week_session(current_user.id, db)
    if existing and (existing.attempts or existing.status == "completed"):
        raise HTTPException(status_code=409, detail="已经开始的练习不能更换，可以添加一个选练")
    if not existing and len(_get_plan_sessions(current_user.id, db)) >= MAX_WEEKLY_PRACTICES:
        raise HTTPException(status_code=409, detail="本周最多安排三个练习，请先完成当前计划")
    cache_key = hashlib.sha256(
        json.dumps(
            {
                "user": current_user.id,
                "week": current_week_key(),
                "payload": payload.model_dump(mode="json"),
            },
            ensure_ascii=False,
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()
    active = db.scalar(
        select(AnalysisJob)
        .where(
            AnalysisJob.user_id == current_user.id,
            AnalysisJob.kind == "practice_session",
            AnalysisJob.cache_key == cache_key,
            AnalysisJob.status.in_(("queued", "processing")),
        )
        .order_by(AnalysisJob.created_at.desc())
    )
    if active:
        return _practice_job_to_dict(active)
    job = AnalysisJob(
        id=str(uuid4()),
        user_id=current_user.id,
        cache_key=cache_key,
        kind="practice_session",
        status="queued",
        stage="preparing",
        progress=15,
        request_json=payload.model_dump_json(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(_run_practice_session_job, job.id)
    return _practice_job_to_dict(job)


@router.get("/session-jobs/{job_id}", response_model=PracticeSessionJobRead)
def get_practice_session_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    job = db.scalar(
        select(AnalysisJob).where(
            AnalysisJob.id == job_id,
            AnalysisJob.user_id == current_user.id,
            AnalysisJob.kind == "practice_session",
        )
    )
    if not job:
        raise HTTPException(status_code=404, detail="任务生成记录不存在")
    return _practice_job_to_dict(job)


@router.get("/current", response_model=PracticeSessionRead)
def get_current_practice(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_current_week_session(current_user.id, db) or _create_legacy_session(current_user, db)
    return _session_to_dict(session)


@router.patch("/sessions/{session_id}/start", response_model=PracticeSessionRead)
def mark_practice_started(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(session_id, current_user.id, db)
    if not session:
        raise HTTPException(status_code=404, detail="练习不存在")
    if session.status == "completed":
        return _session_to_dict(session)
    if not session.started_at:
        session.started_at = datetime.now(timezone.utc)
        db.commit()
    return _session_to_dict(_load_session(session.id, db) or session)


@router.post(
    "/sessions/{session_id}/attempts",
    response_model=PracticeSessionRead,
    status_code=status.HTTP_201_CREATED,
)
def submit_session_practice_attempt(
    session_id: int,
    payload: PracticeAttemptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(session_id, current_user.id, db)
    if not session:
        raise HTTPException(status_code=404, detail="练习不存在")
    return _submit_practice_attempt(session, payload, current_user, db)


@router.post("/current/attempts", response_model=PracticeSessionRead, status_code=status.HTTP_201_CREATED)
def submit_practice_attempt(
    payload: PracticeAttemptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_current_week_session(current_user.id, db) or _create_legacy_session(current_user, db)
    return _submit_practice_attempt(session, payload, current_user, db)


def _submit_practice_attempt(
    session: PracticeSession,
    payload: PracticeAttemptCreate,
    current_user: User,
    db: Session,
) -> dict:
    if session.status == "completed":
        raise HTTPException(status_code=409, detail="这个练习已经完成")
    previous_attempts = list(session.attempts)
    if len(previous_attempts) >= MAX_PRACTICE_ROUNDS:
        raise HTTPException(status_code=409, detail="本周已完成三轮练习")

    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    image_urls = list(dict.fromkeys(payload.image_urls))[:3]
    criteria = _json_list(session.success_criteria_json)
    report, _cache_hit = analyze_practice_context_cached(
        db=db,
        user_id=current_user.id,
        image_url=image_urls[0],
        preference=preference,
        mode="attempt",
        category=session.category,
        ability=session.skill_focus,
        criteria=criteria,
        level=session.level,
    )
    first_score: int | None = None
    comparison_label = "原图"
    if previous_attempts:
        first_score = int(previous_attempts[-1].skill_score)
        comparison_label = "上一轮"
    elif session.source_image_url:
        original_report = _json_object(session.source_analysis_json)
        if not original_report:
            original_report, _source_cache_hit = analyze_practice_context_cached(
                db=db,
                user_id=current_user.id,
                image_url=session.source_image_url,
                preference=preference,
                mode="attempt",
                category=session.category,
                ability=session.skill_focus,
                criteria=criteria,
                level=session.level,
            )
            session.source_analysis_json = json.dumps(original_report, ensure_ascii=False, default=str)
        original_feedback = build_attempt_feedback(
            original_report,
            session.skill_focus,
            criteria=criteria,
            level=session.level,
        )
        first_score = int(original_feedback["skill_score"])
    feedback = build_attempt_feedback(
        report,
        session.skill_focus,
        first_score,
        criteria,
        session.level,
        comparison_label,
    )
    round_number = len(previous_attempts) + 1
    attempt = PracticeAttempt(
        session_id=session.id,
        user_id=current_user.id,
        stage="weekly" if round_number == 1 else f"weekly_{round_number}",
        image_url=image_urls[0],
        image_urls_json=json.dumps(image_urls, ensure_ascii=False),
        self_reflection=payload.self_reflection.strip(),
        skill_score=int(feedback["skill_score"]),
        achieved_count=int(feedback["achieved_count"]),
        criteria_total=int(feedback["criteria_total"]),
        criterion_results_json=json.dumps(feedback["criterion_results"], ensure_ascii=False),
        strength=str(feedback["strength"]),
        key_issue=str(feedback["key_issue"]),
        action_step=str(feedback["action_step"]),
        reshoot_task=str(feedback["reshoot_task"]),
        comparison_summary=str(feedback["comparison_summary"]),
        analysis_snapshot_json=json.dumps(report, ensure_ascii=False, default=str),
    )
    db.add(attempt)
    session.started_at = session.started_at or datetime.now(timezone.utc)
    session.coach_note = str(feedback["action_step"])
    db.commit()
    return _session_to_dict(_load_session(session.id, db) or session)


@router.post(
    "/sessions/{session_id}/attempt-jobs",
    response_model=PracticeAttemptJobRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_session_practice_attempt_job(
    session_id: int,
    payload: PracticeAttemptCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(session_id, current_user.id, db)
    if not session:
        raise HTTPException(status_code=404, detail="练习不存在")
    return _start_practice_attempt_job(session, payload, background_tasks, current_user, db)


@router.post(
    "/current/attempt-jobs",
    response_model=PracticeAttemptJobRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_practice_attempt_job(
    payload: PracticeAttemptCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_current_week_session(current_user.id, db) or _create_legacy_session(current_user, db)
    return _start_practice_attempt_job(session, payload, background_tasks, current_user, db)


def _start_practice_attempt_job(
    session: PracticeSession,
    payload: PracticeAttemptCreate,
    background_tasks: BackgroundTasks,
    current_user: User,
    db: Session,
) -> dict:
    if session.status == "completed":
        raise HTTPException(status_code=409, detail="这个练习已经完成")
    if len(session.attempts) >= MAX_PRACTICE_ROUNDS:
        raise HTTPException(status_code=409, detail="这个练习已完成三轮复练")
    cache_key = hashlib.sha256(
        json.dumps(
            {
                "session": session.id,
                "round": len(session.attempts) + 1,
                "images": payload.image_urls,
                "reflection": payload.self_reflection,
            },
            ensure_ascii=False,
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()
    active = db.scalar(
        select(AnalysisJob)
        .where(
            AnalysisJob.user_id == current_user.id,
            AnalysisJob.kind == "practice_attempt",
            AnalysisJob.cache_key == cache_key,
            AnalysisJob.status.in_(("queued", "processing")),
        )
        .order_by(AnalysisJob.created_at.desc())
    )
    if active:
        return _practice_job_to_dict(active)
    job = AnalysisJob(
        id=str(uuid4()),
        user_id=current_user.id,
        cache_key=cache_key,
        kind="practice_attempt",
        status="queued",
        stage="preparing",
        progress=15,
        request_json=json.dumps(
            {"session_id": session.id, "payload": payload.model_dump(mode="json")},
            ensure_ascii=False,
        ),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(_run_practice_attempt_job, job.id)
    return _practice_job_to_dict(job)


@router.get("/attempt-jobs/{job_id}", response_model=PracticeAttemptJobRead)
def get_practice_attempt_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    job = db.scalar(
        select(AnalysisJob).where(
            AnalysisJob.id == job_id,
            AnalysisJob.user_id == current_user.id,
            AnalysisJob.kind == "practice_attempt",
        )
    )
    if not job:
        raise HTTPException(status_code=404, detail="练习分析任务不存在")
    return _practice_job_to_dict(job)


def _run_practice_attempt_job(job_id: str) -> None:
    with SessionLocal() as db:
        job = db.get(AnalysisJob, job_id)
        if not job or job.status == "completed":
            return
        try:
            user = db.get(User, job.user_id)
            if not user:
                raise HTTPException(status_code=404, detail="用户不存在")
            request = json.loads(job.request_json)
            if isinstance(request, dict) and "payload" in request:
                payload = PracticeAttemptCreate.model_validate(request["payload"])
                session = _get_owned_session(int(request["session_id"]), user.id, db)
            else:
                payload = PracticeAttemptCreate.model_validate(request)
                session = _get_current_week_session(user.id, db)
            if not session:
                raise HTTPException(status_code=404, detail="练习不存在")
            job.status = "processing"
            job.stage = "analyzing"
            job.progress = 45
            db.commit()

            result = _submit_practice_attempt(session, payload, user, db)
            job.stage = "organizing"
            job.progress = 90
            job.result_json = json.dumps(result, ensure_ascii=False, default=str)
            job.status = "completed"
            job.stage = "completed"
            job.progress = 100
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
        except HTTPException as exc:
            _fail_practice_job(db, job, str(exc.detail))
        except VisionAnalysisError as exc:
            logger.warning("practice attempt job vision failed job_id=%s: %s", job_id, exc)
            _fail_practice_job(db, job, str(exc))
        except Exception:
            logger.exception("practice attempt job failed job_id=%s", job_id)
            _fail_practice_job(db, job, "练习反馈暂时生成失败，请稍后重试")


def _run_practice_session_job(job_id: str) -> None:
    with SessionLocal() as db:
        job = db.get(AnalysisJob, job_id)
        if not job or job.status == "completed":
            return
        try:
            user = db.get(User, job.user_id)
            if not user:
                raise HTTPException(status_code=404, detail="用户不存在")
            payload = PracticeSessionCreate.model_validate_json(job.request_json)
            job.status = "processing"
            job.stage = "analyzing" if payload.entry_mode == "improve" else "organizing"
            job.progress = 45 if payload.entry_mode == "improve" else 70
            db.commit()

            result = start_practice_session(payload, user, db)
            job.result_json = json.dumps(result, ensure_ascii=False, default=str)
            job.status = "completed"
            job.stage = "completed"
            job.progress = 100
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
        except HTTPException as exc:
            _fail_practice_job(db, job, str(exc.detail))
        except VisionAnalysisError as exc:
            logger.warning("practice session job vision failed job_id=%s: %s", job_id, exc)
            _fail_practice_job(db, job, str(exc))
        except Exception:
            logger.exception("practice session job failed job_id=%s", job_id)
            _fail_practice_job(db, job, "本周任务暂时生成失败，请稍后重试")


def _fail_practice_job(db: Session, job: AnalysisJob, message: str) -> None:
    job.status = "failed"
    job.stage = "failed"
    job.error = message[:500]
    job.completed_at = datetime.now(timezone.utc)
    db.commit()


def _practice_job_to_dict(job: AnalysisJob) -> dict:
    result = None
    if job.result_json:
        try:
            parsed = json.loads(job.result_json)
            result = parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            result = None
    return {
        "id": job.id,
        "status": job.status,
        "stage": job.stage,
        "progress": job.progress,
        "result": result,
        "error": job.error,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


@router.post("/current/complete", response_model=PracticeSessionRead)
def complete_practice_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_current_week_session(current_user.id, db)
    return _complete_practice_session(session, current_user, db)


@router.post("/sessions/{session_id}/complete", response_model=PracticeSessionRead)
def complete_session_practice(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(session_id, current_user.id, db)
    return _complete_practice_session(session, current_user, db)


def _complete_practice_session(
    session: PracticeSession | None,
    current_user: User,
    db: Session,
) -> dict:
    if not session or not session.attempts:
        raise HTTPException(status_code=409, detail="请先完成至少一轮练习")
    if session.status == "completed":
        return _session_to_dict(session)

    latest_attempt = session.attempts[-1]
    best_attempt = max(session.attempts, key=lambda item: (item.achieved_count, item.skill_score))
    feedback = {
        "skill_score": best_attempt.skill_score,
        "achieved_count": best_attempt.achieved_count,
        "criteria_total": best_attempt.criteria_total,
        "key_issue": latest_attempt.key_issue,
        "action_step": latest_attempt.action_step,
    }
    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)
    _advance_progress(current_user.id, session, feedback, db)
    _update_coach_memory(current_user.id, session, feedback, db)
    db.commit()
    return _session_to_dict(_load_session(session.id, db) or session)


@router.patch("/current/difficulty", response_model=PracticeSessionRead)
def update_practice_difficulty(
    payload: PracticeDifficultyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_current_week_session(current_user.id, db)
    return _update_practice_difficulty(session, payload, current_user, db)


@router.patch("/sessions/{session_id}/difficulty", response_model=PracticeSessionRead)
def update_session_practice_difficulty(
    session_id: int,
    payload: PracticeDifficultyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_owned_session(session_id, current_user.id, db)
    return _update_practice_difficulty(session, payload, current_user, db)


def _update_practice_difficulty(
    session: PracticeSession | None,
    payload: PracticeDifficultyUpdate,
    current_user: User,
    db: Session,
) -> dict:
    if not session or not session.attempts:
        raise HTTPException(status_code=409, detail="请先提交本周练习")
    if session.status != "completed":
        raise HTTPException(status_code=409, detail="请先完成本周练习")
    if any(item.difficulty_feedback for item in session.attempts):
        return _session_to_dict(session)
    attempt = max(session.attempts, key=lambda item: (item.achieved_count, item.skill_score))
    attempt.difficulty_feedback = payload.difficulty
    progress = db.scalar(
        select(PracticeProgress).where(
            PracticeProgress.user_id == current_user.id,
            PracticeProgress.category == session.category,
            PracticeProgress.ability == session.skill_focus,
        )
    )
    if progress:
        if payload.difficulty == "too_easy" and attempt.achieved_count >= attempt.criteria_total:
            progress.easy_streak += 1
            if progress.easy_streak >= 2:
                progress.level = min(4, progress.level + 1)
                progress.easy_streak = 0
        else:
            progress.easy_streak = 0
    if payload.difficulty == "too_hard":
        task = get_task(session.category, session.skill_focus, session.level, session.cycle_week)
        session.simplified_task_json = json.dumps(simplified_task(task), ensure_ascii=False)
    db.commit()
    return _session_to_dict(_load_session(session.id, db) or session)


def _get_current_week_session(user_id: int, db: Session) -> PracticeSession | None:
    return db.scalar(
        select(PracticeSession)
        .options(selectinload(PracticeSession.attempts))
        .where(PracticeSession.user_id == user_id, PracticeSession.week_key == current_week_key())
        .order_by(
            PracticeSession.status.asc(),
            PracticeSession.plan_role.desc(),
            PracticeSession.position.asc(),
            PracticeSession.created_at.asc(),
        )
    )


def _get_plan_sessions(user_id: int, db: Session) -> list[PracticeSession]:
    week_started_at = datetime.combine(
        date.today() - timedelta(days=date.today().weekday()),
        time.min,
        tzinfo=timezone.utc,
    )
    sessions = list(
        db.scalars(
            select(PracticeSession)
            .options(selectinload(PracticeSession.attempts))
            .where(
                PracticeSession.user_id == user_id,
                or_(
                    PracticeSession.status == "active",
                    PracticeSession.week_key == current_week_key(),
                    PracticeSession.completed_at >= week_started_at,
                ),
            )
        )
    )
    return sorted(
        sessions,
        key=lambda item: (
            item.status == "completed",
            item.plan_role != "primary",
            item.position,
            item.created_at,
        ),
    )


def _get_owned_session(session_id: int, user_id: int, db: Session) -> PracticeSession | None:
    return db.scalar(
        select(PracticeSession)
        .options(selectinload(PracticeSession.attempts))
        .where(PracticeSession.id == session_id, PracticeSession.user_id == user_id)
    )


def _load_session(session_id: int, db: Session) -> PracticeSession | None:
    return db.scalar(
        select(PracticeSession)
        .options(selectinload(PracticeSession.attempts))
        .where(PracticeSession.id == session_id)
    )


def _create_legacy_session(user: User, db: Session) -> PracticeSession:
    preference = db.scalar(select(Preference).where(Preference.user_id == user.id))
    ability, task = choose_practice(preference)
    category = str(task["category"])
    progress = _get_or_create_progress(user.id, category, ability, preference, db)
    session = PracticeSession(
        user_id=user.id,
        week_key=current_week_key(),
        plan_role="primary",
        position=0,
        entry_mode="category",
        category=category,
        skill_focus=ability,
        level=progress.level,
        cycle_week=progress.cycle_week,
        time_minutes=int(task["time_minutes"]),
        target_goal="不确定",
        photo_intent=f"练习{category}拍摄。",
        priority_issue=str(task["issue"]),
        analysis_confidence=1.0,
        title=str(task["title"]),
        brief=str(task["brief"]),
        steps_json=json.dumps(task["steps"], ensure_ascii=False),
        constraints_json=json.dumps(task["steps"], ensure_ascii=False),
        success_criteria_json=json.dumps(task["criteria"], ensure_ascii=False),
        optional_challenge=str(task["challenge"]),
        coach_note=str(task["goal"]),
    )
    db.add(session)
    db.commit()
    return _load_session(session.id, db) or session


def _get_or_create_progress(
    user_id: int,
    category: str,
    ability: str,
    preference: Preference | None,
    db: Session,
) -> PracticeProgress:
    progress = db.scalar(
        select(PracticeProgress).where(
            PracticeProgress.user_id == user_id,
            PracticeProgress.category == category,
            PracticeProgress.ability == ability,
        )
    )
    if not progress:
        progress = PracticeProgress(
            user_id=user_id,
            category=category,
            ability=ability,
            level=initial_level(preference),
        )
        db.add(progress)
        db.flush()
    return progress


def _advance_progress(user_id: int, session: PracticeSession, feedback: dict, db: Session) -> None:
    progress = _get_or_create_progress(user_id, session.category, session.skill_focus, None, db)
    progress.last_practiced_at = datetime.now(timezone.utc)
    if int(feedback["achieved_count"]) < int(feedback["criteria_total"]):
        return
    if progress.cycle_week >= 4:
        progress.cycle_week = 1
        progress.completed_count += 1
        progress.cycle_source_image_url = None
    else:
        progress.cycle_week += 1


def _update_coach_memory(user_id: int, session: PracticeSession, feedback: dict, db: Session) -> None:
    memory = db.scalar(select(CoachMemory).where(CoachMemory.user_id == user_id))
    if not memory:
        memory = CoachMemory(user_id=user_id)
        db.add(memory)
    memory.current_focus = session.skill_focus
    memory.recurring_issue = str(feedback["key_issue"])
    memory.last_action = str(feedback["action_step"])
    memory.completed_sessions = (memory.completed_sessions or 0) + 1


def _session_to_dict(session: PracticeSession) -> dict:
    attempts = list(session.attempts)
    if session.status == "completed":
        progress_stage = "completed"
        completion_percent = 100
    elif attempts:
        progress_stage = "submitted"
        completion_percent = 70
    elif session.started_at:
        progress_stage = "started"
        completion_percent = 25
    else:
        progress_stage = "not_started"
        completion_percent = 0
    current_task = get_task(session.category, session.skill_focus, session.level, session.cycle_week)
    task_steps = list(current_task["steps"])
    saved_simplified_task = _json_object(session.simplified_task_json)
    if saved_simplified_task:
        saved_simplified_task = simplified_task(current_task)
    photo_analysis = None
    if session.entry_mode == "improve":
        photo_analysis = {
            "photo_type": session.category,
            "intent": session.photo_intent,
            "priority_issue": session.priority_issue,
            "ability": session.skill_focus,
            "recommended_level": session.level,
            "confidence": session.analysis_confidence,
        }
    return {
        "id": session.id,
        "week_key": session.week_key,
        "entry_mode": session.entry_mode,
        "plan_role": session.plan_role,
        "position": session.position,
        "category": session.category,
        "skill_focus": session.skill_focus,
        "level": session.level,
        "cycle_week": session.cycle_week,
        "cycle_label": CYCLE_LABELS.get(session.cycle_week, "看见问题"),
        "time_minutes": session.time_minutes,
        "source_image_url": _retained_image_url(session.source_image_url),
        "target_goal": session.target_goal,
        "photo_analysis": photo_analysis,
        "title": session.title,
        "brief": session.brief,
        "recommendation_basis": _recommendation_basis(session),
        "steps": task_steps,
        "constraints": task_steps,
        "success_criteria": _json_list(session.success_criteria_json),
        "optional_challenge": session.optional_challenge,
        "simplified_task": saved_simplified_task,
        "coach_note": session.coach_note,
        "status": session.status,
        "progress": len(attempts),
        "progress_stage": progress_stage,
        "completion_percent": completion_percent,
        "is_carryover": session.status == "active" and session.week_key != current_week_key(),
        "attempts": [_attempt_to_dict(item) for item in attempts],
        "started_at": session.started_at,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "completed_at": session.completed_at,
    }


def _recommendation_basis(session: PracticeSession) -> str:
    if session.entry_mode == "improve":
        if session.target_goal in {"构图", "光线", "清晰度", "色彩"}:
            return f"优先按你选择的「{session.target_goal}」，再结合照片问题、当前等级和每周时间安排。"
        return f"根据照片中最需要改善的「{session.skill_focus}」，再结合当前等级和每周时间安排。"
    if session.target_goal in {"构图", "光线", "清晰度", "色彩"}:
        return f"按你选择的「{session.skill_focus}」能力，并结合「{session.category}」场景、当前等级和可用时间安排。"
    if session.cycle_week > 1:
        return f"延续「{session.skill_focus}」四周练习，并结合当前等级和每周时间安排本周难度。"
    return f"根据你选择的「{session.category}」，优先安排近期练得较少的「{session.skill_focus}」。"


def _attempt_to_dict(attempt: PracticeAttempt) -> dict:
    retained_urls = [
        value
        for value in (_json_list(attempt.image_urls_json) or [attempt.image_url])
        if _retained_image_url(value)
    ]
    return {
        "id": attempt.id,
        "stage": attempt.stage,
        "image_url": retained_urls[0] if retained_urls else "",
        "image_urls": retained_urls,
        "self_reflection": attempt.self_reflection,
        "skill_score": attempt.skill_score,
        "score_change": None,
        "achieved_count": attempt.achieved_count,
        "criteria_total": attempt.criteria_total,
        "criterion_results": _json_value_list(attempt.criterion_results_json),
        "difficulty_feedback": attempt.difficulty_feedback,
        "strength": attempt.strength,
        "key_issue": attempt.key_issue,
        "action_step": attempt.action_step,
        "reshoot_task": attempt.reshoot_task,
        "comparison_summary": attempt.comparison_summary,
        "created_at": attempt.created_at,
    }


def _retained_image_url(image_url: str | None) -> str | None:
    if not image_url or not image_url.startswith("/uploads/"):
        return image_url
    path = local_upload_path(image_url, get_settings().upload_path)
    return image_url if path and path.is_file() else None


def _progress_to_dict(progress: PracticeProgress) -> dict:
    return {
        "category": progress.category,
        "ability": progress.ability,
        "level": progress.level,
        "cycle_week": progress.cycle_week,
        "completed_count": progress.completed_count,
        "remaining_for_level": max(1, 4 - progress.cycle_week + 1),
    }


def _json_list(value: str) -> list[str]:
    parsed = _json_object_or_list(value)
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


def _json_value_list(value: str) -> list[dict]:
    parsed = _json_object_or_list(value)
    return [item for item in parsed if isinstance(item, dict)] if isinstance(parsed, list) else []


def _json_object(value: str) -> dict:
    parsed = _json_object_or_list(value)
    return parsed if isinstance(parsed, dict) else {}


def _json_object_or_list(value: str) -> object:
    try:
        return json.loads(value or "")
    except (TypeError, json.JSONDecodeError):
        return []
