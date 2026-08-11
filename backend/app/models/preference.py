from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Preference(Base):
    __tablename__ = "preferences"
    __table_args__ = (UniqueConstraint("user_id", name="uq_preferences_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_level: Mapped[str | None] = mapped_column(String(80), nullable=True)
    target_platform: Mapped[str | None] = mapped_column(String(120), nullable=True)
    preferred_styles: Mapped[str | None] = mapped_column(Text, nullable=True)
    common_subjects: Mapped[str | None] = mapped_column(Text, nullable=True)
    improvement_goals: Mapped[str | None] = mapped_column(Text, nullable=True)
    editing_tools: Mapped[str | None] = mapped_column(Text, nullable=True)
    photography_categories: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    aesthetic_styles: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    editing_software: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    shooting_devices: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    weekly_practice_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    weekly_practice_day: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    weekly_reminder_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    daily_recommendation_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    daily_recommendation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    use_favorite_behavior: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    use_browsing_behavior: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    prioritize_following: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_tutorial_content: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="preferences")
