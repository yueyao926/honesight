from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserFollow(Base):
    __tablename__ = "user_follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_user_follows_pair"),
        CheckConstraint("follower_id <> following_id", name="ck_user_follows_not_self"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    follower_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    following_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserPrivacySetting(Base):
    __tablename__ = "user_privacy_settings"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_privacy_user"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    show_following: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_followers: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    allow_work_favorites: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    discoverable_by_username: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    allow_follow_notifications: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    user = relationship("User", back_populates="privacy_setting")
