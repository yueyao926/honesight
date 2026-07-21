from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PortfolioCollection(Base):
    __tablename__ = "portfolio_collections"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_portfolio_collections_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="portfolio_collections")
    photos = relationship(
        "PortfolioItem",
        back_populates="collection",
        cascade="all, delete-orphan",
        order_by="desc(PortfolioItem.created_at)",
    )


class PortfolioItem(Base):
    """A saved original photo.

    The legacy metadata columns remain so old analysis records and deployments can
    be migrated without data loss. New portfolio screens intentionally ignore them.
    """

    __tablename__ = "portfolio_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("portfolio_collections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False, default="照片")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="direct_upload")
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    target_style: Mapped[str | None] = mapped_column(String(120), nullable=True)
    target_platform: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="portfolio_items")
    collection = relationship("PortfolioCollection", back_populates="photos")
    tags = relationship("PhotoTag", back_populates="photo", cascade="all, delete-orphan")
    analysis_results = relationship("AnalysisResult", back_populates="portfolio_item", cascade="all, delete-orphan")


class PhotoTag(Base):
    __tablename__ = "photo_tags"
    __table_args__ = (UniqueConstraint("photo_id", "tag_type", "name", name="uq_photo_tags_photo_type_name"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    photo_id: Mapped[int] = mapped_column(
        ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tag_type: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="ai_analysis")
    model_version: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    photo = relationship("PortfolioItem", back_populates="tags")
