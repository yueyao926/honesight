from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InspirationPhoto(Base):
    __tablename__ = "inspiration_photos"
    __table_args__ = (UniqueConstraint("source_type", "external_id", name="uq_inspiration_source_external"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source_type: Mapped[str] = mapped_column(String(30), index=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str] = mapped_column(String(255), default="未命名作品")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    poetic_caption: Mapped[str] = mapped_column(Text, default="在光影停驻的地方，重新学习观看。")
    appreciation_summary: Mapped[str] = mapped_column(Text, default="留意画面中的秩序、节奏与情绪。")
    composition_analysis: Mapped[str] = mapped_column(Text, default="观察主体、留白与视觉动线的关系。")
    light_analysis: Mapped[str] = mapped_column(Text, default="感受光线方向如何塑造空间层次。")
    color_analysis: Mapped[str] = mapped_column(Text, default="比较主色、辅色与明暗之间的平衡。")
    emotion_analysis: Mapped[str] = mapped_column(Text, default="画面通过瞬间与环境建立叙事。")
    learning_tip: Mapped[str] = mapped_column(Text, default="拍摄前先确定最想保留的视觉重心。")
    image_url: Mapped[str] = mapped_column(String(1500))
    thumbnail_url: Mapped[str] = mapped_column(String(1500))
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    orientation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    photographer_name: Mapped[str] = mapped_column(String(255))
    photographer_url: Mapped[str] = mapped_column(String(1500))
    source_name: Mapped[str] = mapped_column(String(120))
    source_page_url: Mapped[str] = mapped_column(String(1500))
    license_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    license_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    license_url: Mapped[str | None] = mapped_column(String(1500), nullable=True)
    attribution_text: Mapped[str] = mapped_column(Text)
    tags: Mapped[str] = mapped_column(Text, default="")
    license_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    moderation_status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    moderation_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    community_owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    community_visibility: Mapped[str | None] = mapped_column(String(20), nullable=True)
    recommendation_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    recommendation_consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    authorization_revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    quality_score: Mapped[float] = mapped_column(Float, default=0)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InspirationFavorite(Base):
    __tablename__ = "inspiration_favorites"
    __table_args__ = (UniqueConstraint("user_id", "photo_id", name="uq_inspiration_favorite_user_photo"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    photo_id: Mapped[int] = mapped_column(ForeignKey("inspiration_photos.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DailyInspirationRecommendation(Base):
    __tablename__ = "daily_inspiration_recommendations"
    __table_args__ = (
        UniqueConstraint("user_key", "recommendation_date", "position", name="uq_daily_inspiration_position"),
        UniqueConstraint("user_key", "recommendation_date", "photo_id", name="uq_daily_inspiration_photo"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    user_key: Mapped[str] = mapped_column(String(80), index=True)
    photo_id: Mapped[int] = mapped_column(ForeignKey("inspiration_photos.id", ondelete="CASCADE"), index=True)
    recommendation_date: Mapped[date] = mapped_column(Date, index=True)
    position: Mapped[int] = mapped_column(Integer)
    score: Mapped[float] = mapped_column(Float, default=0)
    recommendation_reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    photo = relationship("InspirationPhoto")
