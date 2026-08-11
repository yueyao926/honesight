from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    portfolio_item_id: Mapped[int] = mapped_column(ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    photo_type: Mapped[str] = mapped_column(String(80), nullable=False, default="general")
    detected_style: Mapped[str] = mapped_column(String(80), nullable=False, default="其他")
    style_confidence: Mapped[str] = mapped_column(String(20), nullable=False, default="0")
    style_reasoning: Mapped[str] = mapped_column(Text, nullable=False, default="")
    exposure_score: Mapped[int] = mapped_column(nullable=False, default=70)
    focus_score: Mapped[int] = mapped_column(nullable=False, default=70)
    composition_score: Mapped[int] = mapped_column(nullable=False, default=70)
    color_score: Mapped[int] = mapped_column(nullable=False, default=70)
    exposure_weight: Mapped[str] = mapped_column(String(20), nullable=False, default="0.25")
    focus_weight: Mapped[str] = mapped_column(String(20), nullable=False, default="0.25")
    composition_weight: Mapped[str] = mapped_column(String(20), nullable=False, default="0.25")
    color_weight: Mapped[str] = mapped_column(String(20), nullable=False, default="0.25")
    overall_score: Mapped[int] = mapped_column(nullable=False, default=70)
    target_style_match_score: Mapped[int] = mapped_column(nullable=False, default=70)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    benchmark_detail_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    composition_advice: Mapped[str] = mapped_column(Text, nullable=False)
    lighting_advice: Mapped[str] = mapped_column(Text, nullable=False)
    color_advice: Mapped[str] = mapped_column(Text, nullable=False)
    editing_params: Mapped[str] = mapped_column(Text, nullable=False)
    editing_params_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    platform_suggestions_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    shooting_tips: Mapped[str] = mapped_column(Text, nullable=False, default="")
    next_step: Mapped[str] = mapped_column(Text, nullable=False, default="")
    raw_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis_mode: Mapped[str] = mapped_column(String(40), nullable=False, default="mock")
    model_used: Mapped[str] = mapped_column(String(120), nullable=False, default="template-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    portfolio_item = relationship("PortfolioItem", back_populates="analysis_results")
    user = relationship("User", back_populates="analysis_results")


class PhotoChatMessage(Base):
    __tablename__ = "photo_chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    portfolio_item_id: Mapped[int] = mapped_column(ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AnalysisCache(Base):
    __tablename__ = "analysis_cache"
    __table_args__ = (
        UniqueConstraint("user_id", "cache_key", name="uq_analysis_cache_user_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cache_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    profile: Mapped[str] = mapped_column(String(40), nullable=False)
    result_json: Mapped[str] = mapped_column(Text, nullable=False)
    model_used: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cache_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(40), nullable=False, default="preview")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued", index=True)
    stage: Mapped[str] = mapped_column(String(40), nullable=False, default="queued")
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    request_json: Mapped[str] = mapped_column(Text, nullable=False)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    cache_hit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
