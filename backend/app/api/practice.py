from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.practice import CoachMemory, PracticeAttempt, PracticeProgress, PracticeSession
from app.models.preference import Preference
from app.models.user import User
from app.schemas.practice import (
    PracticeAttemptCreate,
    PracticeDifficultyUpdate,
    PracticeOverviewRead,
    PracticeSessionCreate,
    PracticeSessionRead,
)
from app.services.analyzer import analyze_photo_context
from app.services.practice_coach import (
    analyze_practice_source,
    build_attempt_feedback,
    choose_practice,
    current_week_key,
    initial_level,
    select_least_practiced_ability,
)
from app.services.practice_templates import CYCLE_LABELS, get_task, simplified_task


router = APIRouter(prefix="/practice", tags=["practice"])
MAX_PRACTICE_ROUNDS = 3


@router.get("/overview", response_model=PracticeOverviewRead)
def get_practice_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    current = _get_current_week_session(current_user.id, db)
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
        "history": [_session_to_dict(item) for item in history],
        "progress": [_progress_to_dict(item) for item in progress],
    }


@router.post("/sessions", response_model=PracticeSessionRead, status_code=status.HTTP_201_CREATED)
def start_practice_session(
    payload: PracticeSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    existing = _get_current_week_session(current_user.id, db)
    if existing and (existing.attempts or existing.status == "completed"):
        raise HTTPException(status_code=409, detail="本周练习已经完成，下周会生成新任务")
    if existing and not payload.replace_current:
        raise HTTPException(status_code=409, detail="本周已有任务，可选择换个重点")

    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    photo_analysis: dict | None = None
    if payload.entry_mode == "improve":
        report = analyze_photo_context(
            image_url=str(payload.source_image_url),
            preference=preference,
            target_style=preference.preferred_styles if preference else None,
            target_platform=preference.target_platform if preference else None,
            title="每周一练目标照片",
            description=f"用户优先目标：{payload.target_goal}",
        )
        photo_analysis = analyze_practice_source(report, payload.target_goal)
        category = str(photo_analysis["photo_type"])
        ability = str(photo_analysis["ability"])
    else:
        category = str(payload.category)
        rows = list(
            db.scalars(
                select(PracticeProgress).where(
                    PracticeProgress.user_id == current_user.id,
                    PracticeProgress.category == category,
                )
            )
        )
        ability = select_least_practiced_ability(rows)

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

    values = {
        "user_id": current_user.id,
        "week_key": current_week_key(),
        "entry_mode": payload.entry_mode,
        "category": category,
        "skill_focus": ability,
        "level": progress.level,
        "cycle_week": progress.cycle_week,
        "time_minutes": time_minutes,
        "source_image_url": source_image_url,
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


@router.get("/current", response_model=PracticeSessionRead)
def get_current_practice(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_current_week_session(current_user.id, db) or _create_legacy_session(current_user, db)
    return _session_to_dict(session)


@router.post("/current/attempts", response_model=PracticeSessionRead, status_code=status.HTTP_201_CREATED)
def submit_practice_attempt(
    payload: PracticeAttemptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_current_week_session(current_user.id, db) or _create_legacy_session(current_user, db)
    previous_attempts = list(session.attempts)
    if len(previous_attempts) >= MAX_PRACTICE_ROUNDS:
        raise HTTPException(status_code=409, detail="本周已完成三轮练习")

    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    image_urls = list(dict.fromkeys(payload.image_urls))[:3]
    report = analyze_photo_context(
        image_url=image_urls[0],
        preference=preference,
        target_style=preference.preferred_styles if preference else None,
        target_platform=preference.target_platform if preference else None,
        title=session.title,
        description=f"本周只评估：{session.skill_focus}。用户自评：{payload.self_reflection}",
        category=session.category,
    )
    first_score: int | None = None
    comparison_label = "原图"
    if previous_attempts:
        first_score = int(previous_attempts[-1].skill_score)
        comparison_label = "上一轮"
    elif session.source_image_url:
        original_report = analyze_photo_context(
            image_url=session.source_image_url,
            preference=preference,
            target_style=preference.preferred_styles if preference else None,
            target_platform=preference.target_platform if preference else None,
            title="本周练习原图",
            description=f"只比较{session.skill_focus}",
            category=session.category,
        )
        original_feedback = build_attempt_feedback(
            original_report,
            session.skill_focus,
            criteria=_json_list(session.success_criteria_json),
            level=session.level,
        )
        first_score = int(original_feedback["skill_score"])
    feedback = build_attempt_feedback(
        report,
        session.skill_focus,
        first_score,
        _json_list(session.success_criteria_json),
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
    session.coach_note = str(feedback["action_step"])
    db.commit()
    return _session_to_dict(_load_session(session.id, db) or session)


@router.post("/current/complete", response_model=PracticeSessionRead)
def complete_practice_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_current_week_session(current_user.id, db)
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
        .order_by(PracticeSession.created_at.desc())
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
        "category": session.category,
        "skill_focus": session.skill_focus,
        "level": session.level,
        "cycle_week": session.cycle_week,
        "cycle_label": CYCLE_LABELS.get(session.cycle_week, "看见问题"),
        "time_minutes": session.time_minutes,
        "source_image_url": session.source_image_url,
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
        "attempts": [_attempt_to_dict(item) for item in attempts],
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "completed_at": session.completed_at,
    }


def _recommendation_basis(session: PracticeSession) -> str:
    if session.entry_mode == "improve":
        if session.target_goal in {"构图", "光线", "清晰度", "色彩"}:
            return f"优先按你选择的「{session.target_goal}」，再结合照片问题、当前等级和每周时间安排。"
        return f"根据照片中最需要改善的「{session.skill_focus}」，再结合当前等级和每周时间安排。"
    if session.cycle_week > 1:
        return f"延续「{session.skill_focus}」四周练习，并结合当前等级和每周时间安排本周难度。"
    return f"根据你选择的「{session.category}」，优先安排近期练得较少的「{session.skill_focus}」。"


def _attempt_to_dict(attempt: PracticeAttempt) -> dict:
    return {
        "id": attempt.id,
        "stage": attempt.stage,
        "image_url": attempt.image_url,
        "image_urls": _json_list(attempt.image_urls_json) or [attempt.image_url],
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
