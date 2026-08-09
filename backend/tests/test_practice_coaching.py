from datetime import date

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.api import practice as practice_api
from app.database import Base
from app.models.practice import CoachMemory
from app.models.preference import Preference
from app.models.user import User
from app.schemas.practice import PracticeAttemptCreate
from app.services.practice_coach import build_attempt_feedback, choose_practice, current_week_key


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
    assert task["title"] == "用光线把主体说明白"


def test_feedback_compares_reshoot_with_first_attempt() -> None:
    first = build_attempt_feedback(analysis_report(68), "构图")
    reshoot = build_attempt_feedback(analysis_report(76), "构图", int(first["skill_score"]))
    assert first["key_issue"] == "人物头部与背景路灯重叠。"
    assert reshoot["skill_score"] == 76
    assert "提高了 8 分" in str(reshoot["comparison_summary"])


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


def test_first_attempt_then_reshoot_completes_loop(db, monkeypatch) -> None:
    session, user = db
    scores = iter((64, 73))
    monkeypatch.setattr(practice_api, "analyze_photo_context", lambda **_kwargs: analysis_report(next(scores)))

    first = practice_api.submit_practice_attempt(
        PracticeAttemptCreate(image_url="/uploads/first.jpg", self_reflection="背景有一点乱。"), user, session
    )
    assert first["progress"] == 1
    assert first["status"] == "active"
    assert first["attempts"][0]["stage"] == "first"

    completed = practice_api.submit_practice_attempt(
        PracticeAttemptCreate(image_url="/uploads/reshoot.jpg", self_reflection="我向左移动了两步。"), user, session
    )
    assert completed["progress"] == 2
    assert completed["status"] == "completed"
    assert completed["attempts"][1]["score_change"] == 9
    memory = session.scalar(select(CoachMemory).where(CoachMemory.user_id == user.id))
    assert memory is not None
    assert memory.completed_sessions == 1
