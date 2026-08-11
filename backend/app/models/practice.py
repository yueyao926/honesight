from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PracticeSession(Base):
    __tablename__ = "practice_sessions"
    __table_args__ = (UniqueConstraint("user_id", "week_key", name="uq_practice_session_user_week"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    week_key: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    skill_focus: Mapped[str] = mapped_column(String(40), nullable=False)
    entry_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="category")
    category: Mapped[str] = mapped_column(String(20), nullable=False, default="人像")
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    cycle_week: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    time_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    source_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_analysis_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    target_goal: Mapped[str] = mapped_column(String(40), nullable=False, default="不确定")
    photo_intent: Mapped[str] = mapped_column(Text, nullable=False, default="")
    priority_issue: Mapped[str] = mapped_column(Text, nullable=False, default="")
    analysis_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    brief: Mapped[str] = mapped_column(Text, nullable=False)
    steps_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    constraints_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    success_criteria_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    optional_challenge: Mapped[str] = mapped_column(Text, nullable=False, default="")
    simplified_task_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    coach_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    attempts = relationship(
        "PracticeAttempt",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="PracticeAttempt.id",
    )


class PracticeAttempt(Base):
    __tablename__ = "practice_attempts"
    __table_args__ = (UniqueConstraint("session_id", "stage", name="uq_practice_attempt_session_stage"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("practice_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(20), nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    self_reflection: Mapped[str] = mapped_column(Text, nullable=False)
    image_urls_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    skill_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    achieved_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    criteria_total: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    criterion_results_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    difficulty_feedback: Mapped[str | None] = mapped_column(String(20), nullable=True)
    strength: Mapped[str] = mapped_column(Text, nullable=False)
    key_issue: Mapped[str] = mapped_column(Text, nullable=False)
    action_step: Mapped[str] = mapped_column(Text, nullable=False)
    reshoot_task: Mapped[str] = mapped_column(Text, nullable=False)
    comparison_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    analysis_snapshot_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session = relationship("PracticeSession", back_populates="attempts")


class CoachMemory(Base):
    __tablename__ = "coach_memories"
    __table_args__ = (UniqueConstraint("user_id", name="uq_coach_memory_user"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    current_focus: Mapped[str] = mapped_column(String(40), nullable=False, default="构图")
    recurring_issue: Mapped[str] = mapped_column(Text, nullable=False, default="")
    last_action: Mapped[str] = mapped_column(Text, nullable=False, default="")
    completed_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PracticeProgress(Base):
    __tablename__ = "practice_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "category", "ability", name="uq_practice_progress_user_category_ability"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    ability: Mapped[str] = mapped_column(String(20), nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    cycle_week: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    easy_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cycle_source_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_practiced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
