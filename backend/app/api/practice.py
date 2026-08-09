from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.practice import CoachMemory, PracticeAttempt, PracticeSession
from app.models.preference import Preference
from app.models.user import User
from app.schemas.practice import PracticeAttemptCreate, PracticeSessionRead
from app.services.analyzer import analyze_photo_context
from app.services.practice_coach import build_attempt_feedback, choose_practice, current_week_key


router = APIRouter(prefix="/practice", tags=["practice"])


@router.get("/current", response_model=PracticeSessionRead)
def get_current_practice(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_or_create_session(current_user, db)
    return _session_to_dict(session)


@router.post("/current/attempts", response_model=PracticeSessionRead, status_code=status.HTTP_201_CREATED)
def submit_practice_attempt(
    payload: PracticeAttemptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = _get_or_create_session(current_user, db)
    if session.status == "completed" or len(session.attempts) >= 2:
        raise HTTPException(status_code=409, detail="本周练习已经完成")

    stage = "first" if not session.attempts else "reshoot"
    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    report = analyze_photo_context(
        image_url=payload.image_url,
        preference=preference,
        target_style=preference.preferred_styles if preference else None,
        target_platform=preference.target_platform if preference else None,
        title=session.title,
        description=f"本周练习重点：{session.skill_focus}。用户自评：{payload.self_reflection}",
    )
    first_score = session.attempts[0].skill_score if session.attempts else None
    feedback = build_attempt_feedback(report, session.skill_focus, first_score)
    attempt = PracticeAttempt(
        session_id=session.id,
        user_id=current_user.id,
        stage=stage,
        image_url=payload.image_url,
        self_reflection=payload.self_reflection.strip(),
        skill_score=int(feedback["skill_score"]),
        strength=str(feedback["strength"]),
        key_issue=str(feedback["key_issue"]),
        action_step=str(feedback["action_step"]),
        reshoot_task=str(feedback["reshoot_task"]),
        comparison_summary=str(feedback["comparison_summary"]),
        analysis_snapshot_json=json.dumps(report, ensure_ascii=False, default=str),
    )
    db.add(attempt)

    if stage == "first":
        session.coach_note = str(feedback["action_step"])
    else:
        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)
        session.coach_note = str(feedback["comparison_summary"])
        _update_coach_memory(current_user.id, session, feedback, db)

    db.commit()
    db.expire(session, ["attempts"])
    return _session_to_dict(session)


def _get_or_create_session(user: User, db: Session) -> PracticeSession:
    active = db.scalar(
        select(PracticeSession)
        .options(selectinload(PracticeSession.attempts))
        .where(PracticeSession.user_id == user.id, PracticeSession.status == "active")
        .order_by(PracticeSession.created_at.desc())
    )
    if active:
        return active

    week_key = current_week_key()
    existing = db.scalar(
        select(PracticeSession)
        .options(selectinload(PracticeSession.attempts))
        .where(PracticeSession.user_id == user.id, PracticeSession.week_key == week_key)
    )
    if existing:
        return existing

    preference = db.scalar(select(Preference).where(Preference.user_id == user.id))
    focus, task = choose_practice(preference)
    session = PracticeSession(
        user_id=user.id,
        week_key=week_key,
        skill_focus=focus,
        title=str(task["title"]),
        brief=str(task["brief"]),
        constraints_json=json.dumps(task["constraints"], ensure_ascii=False),
        success_criteria_json=json.dumps(task["success_criteria"], ensure_ascii=False),
        coach_note=str(task["coach_note"]),
    )
    db.add(session)
    try:
        db.commit()
    except IntegrityError:
        # React development mode may request the dashboard twice. If another
        # request created this user's weekly session first, reuse that row.
        db.rollback()
        concurrent = db.scalar(
            select(PracticeSession)
            .options(selectinload(PracticeSession.attempts))
            .where(PracticeSession.user_id == user.id, PracticeSession.week_key == week_key)
        )
        if concurrent:
            return concurrent
        raise
    return db.scalar(
        select(PracticeSession)
        .options(selectinload(PracticeSession.attempts))
        .where(PracticeSession.id == session.id)
    ) or session


def _update_coach_memory(
    user_id: int,
    session: PracticeSession,
    feedback: dict[str, str | int],
    db: Session,
) -> None:
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
    first_score = attempts[0].skill_score if attempts else None
    return {
        "id": session.id,
        "week_key": session.week_key,
        "skill_focus": session.skill_focus,
        "title": session.title,
        "brief": session.brief,
        "constraints": _json_list(session.constraints_json),
        "success_criteria": _json_list(session.success_criteria_json),
        "coach_note": session.coach_note,
        "status": session.status,
        "progress": len(attempts),
        "attempts": [
            {
                "id": attempt.id,
                "stage": attempt.stage,
                "image_url": attempt.image_url,
                "self_reflection": attempt.self_reflection,
                "skill_score": attempt.skill_score,
                "score_change": attempt.skill_score - first_score if attempt.stage == "reshoot" and first_score is not None else None,
                "strength": attempt.strength,
                "key_issue": attempt.key_issue,
                "action_step": attempt.action_step,
                "reshoot_task": attempt.reshoot_task,
                "comparison_summary": attempt.comparison_summary,
                "created_at": attempt.created_at,
            }
            for attempt in attempts
        ],
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "completed_at": session.completed_at,
    }


def _json_list(value: str) -> list[str]:
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return []
    return [str(item) for item in parsed] if isinstance(parsed, list) else []
