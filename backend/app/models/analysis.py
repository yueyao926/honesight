from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    portfolio_item_id: Mapped[int] = mapped_column(ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    composition_advice: Mapped[str] = mapped_column(Text, nullable=False)
    lighting_advice: Mapped[str] = mapped_column(Text, nullable=False)
    color_advice: Mapped[str] = mapped_column(Text, nullable=False)
    editing_params: Mapped[str] = mapped_column(Text, nullable=False)
    model_used: Mapped[str] = mapped_column(String(120), nullable=False, default="template-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    portfolio_item = relationship("PortfolioItem", back_populates="analysis_results")
    user = relationship("User", back_populates="analysis_results")
