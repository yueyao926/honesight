from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="preferences")
