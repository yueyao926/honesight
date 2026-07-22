from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PostSearchDocument(Base):
    __tablename__ = "post_search_documents"
    __table_args__ = (UniqueConstraint("post_id", name="uq_post_search_document_post"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("community_posts.id", ondelete="CASCADE"), index=True)
    search_text: Mapped[str] = mapped_column(Text, default="", server_default="")
    normalized_text: Mapped[str] = mapped_column(Text, default="", server_default="")
    semantic_terms: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    embedding_model: Mapped[str | None] = mapped_column(String(120))
    embedding_version: Mapped[str | None] = mapped_column(String(40))
    index_status: Mapped[str] = mapped_column(String(16), default="ready", server_default="ready", index=True)
    index_error: Mapped[str | None] = mapped_column(String(300))
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SearchHistory(Base):
    __tablename__ = "search_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    query: Mapped[str] = mapped_column(String(120))
    normalized_query: Mapped[str] = mapped_column(String(120), index=True)
    search_type: Mapped[str] = mapped_column(String(16), default="all")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
