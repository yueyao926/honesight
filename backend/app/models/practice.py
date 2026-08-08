from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PracticeSession(Base):
    __tablename__ = "practice_sessions"
    __table_args__ = (UniqueConstraint("user_id", "week_key", name="uq_practice_session_user_week"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    week_key: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    skill_focus: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    brief: Mapped[str] = mapped_column(Text, nullable=False)
    constraints_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    success_criteria_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
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
        order_by="PracticeAttempt.created_at",
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
    skill_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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
