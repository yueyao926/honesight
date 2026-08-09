from datetime import date

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.api import practice as practice_api
from app.database import Base
from app.models.practice import CoachMemory, PracticeProgress
from app.models.preference import Preference
from app.models.user import User
from app.schemas.practice import PracticeAttemptCreate
from app.services.practice_coach import analyze_practice_source, build_attempt_feedback, choose_practice, current_week_key, select_least_practiced_ability
from app.services.practice_templates import TASK_LIBRARY


def analysis_report(score: int) -> dict:
    return {
        "benchmark_detail_json": (
            '{"composition":{"score":%d,"reason":"主体位置已经比较明确。",'
            '"problems":["人物头部与背景路灯重叠。"],"suggestions":[]}}' % score
        ),
        "composition_advice": "向左移动两步，让主体轮廓落在干净背景上。",
        "lighting_advice": "保留面部亮度。",
        "color_advice": "减少杂色。",
        "shooting_tips": "半按快门确认焦点。",
        "next_step": "再拍一次。",
    }


def test_week_key_and_preference_choose_one_focus() -> None:
    assert current_week_key(date(2026, 8, 9)) == "2026-W32"
    preference = Preference(user_id=1, improvement_goals="我想先提升光线和曝光")
    focus, task = choose_practice(preference)
    assert focus == "光线"
    assert task["ability"] == "光线"


def test_library_contains_48_fixed_templates_and_user_goal_wins() -> None:
    assert len(TASK_LIBRARY) == 48
    report = analysis_report(80)
    report.update({"photo_type": "landscape", "exposure_score": 20, "style_confidence": "0.88"})
    result = analyze_practice_source(report, "色彩")
    assert result["photo_type"] == "风景"
    assert result["ability"] == "色彩"
    assert result["confidence"] == 0.88


def test_recommendation_finishes_active_four_week_cycle_first() -> None:
    class Progress:
        ability = "光线"
        cycle_week = 3
        completed_count = 0
        last_practiced_at = None

    assert select_least_practiced_ability([Progress()]) == "光线"


def test_feedback_compares_reshoot_with_first_attempt() -> None:
    first = build_attempt_feedback(analysis_report(68), "构图")
    reshoot = build_attempt_feedback(analysis_report(76), "构图", int(first["skill_score"]))
    assert first["key_issue"] == "人物头部与背景路灯重叠。"
    assert reshoot["skill_score"] == 76
    assert "构图表现提升" in str(reshoot["comparison_summary"])


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    user = User(username="learner", email="learner@example.com", hashed_password="x")
    session.add(user)
    session.flush()
    session.add(Preference(user_id=user.id, improvement_goals="构图、背景"))
    session.commit()
    try:
        yield session, user
    finally:
        session.close()


def test_weekly_submission_completes_single_focus_and_advances_cycle(db, monkeypatch) -> None:
    session, user = db
    monkeypatch.setattr(practice_api, "analyze_photo_context", lambda **_kwargs: analysis_report(73))

    completed = practice_api.submit_practice_attempt(
        PracticeAttemptCreate(image_url="/uploads/first.jpg", self_reflection="背景有一点乱。"), user, session
    )
    assert completed["status"] == "completed"
    assert completed["progress"] == 1
    assert completed["attempts"][0]["stage"] == "weekly"
    assert completed["attempts"][0]["criteria_total"] == 2
    memory = session.scalar(select(CoachMemory).where(CoachMemory.user_id == user.id))
    progress = session.scalar(select(PracticeProgress).where(PracticeProgress.user_id == user.id))
    assert memory is not None
    assert memory.completed_sessions == 1
    assert progress is not None
    assert progress.cycle_week == 2
