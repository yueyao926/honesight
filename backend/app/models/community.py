from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CommunityPost(Base):
    __tablename__ = "community_posts"
    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160), default="", server_default="")
    content: Mapped[str] = mapped_column(Text, default="", server_default="")
    post_type: Mapped[str] = mapped_column(String(24), default="artwork", index=True)
    visibility: Mapped[str] = mapped_column(String(16), default="public", index=True)
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    allow_comments: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    allow_ai_review: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    allow_original_download: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    location_name: Mapped[str | None] = mapped_column(String(160))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    device_name: Mapped[str | None] = mapped_column(String(120))
    lens_name: Mapped[str | None] = mapped_column(String(120))
    aperture: Mapped[str | None] = mapped_column(String(32))
    shutter_speed: Mapped[str | None] = mapped_column(String(32))
    iso: Mapped[int | None] = mapped_column(Integer)
    focal_length: Mapped[str | None] = mapped_column(String(32))
    editing_software: Mapped[str | None] = mapped_column(String(120))
    editing_notes: Mapped[str | None] = mapped_column(Text)
    cover_image_url: Mapped[str | None] = mapped_column(String(500))
    image_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    view_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    like_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    favorite_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    comment_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    share_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    hot_score: Mapped[float] = mapped_column(Float, default=0, server_default="0", index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    author = relationship("User")
    images = relationship("PostImage", cascade="all, delete-orphan", order_by="PostImage.sort_order")
    tags = relationship("Tag", secondary="community_post_tags", viewonly=True)


class PostImage(Base):
    __tablename__ = "community_post_images"
    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("community_posts.id", ondelete="CASCADE"), index=True)
    image_url: Mapped[str] = mapped_column(String(500))
    thumbnail_url: Mapped[str | None] = mapped_column(String(500))
    original_url: Mapped[str | None] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    file_size: Mapped[int | None] = mapped_column(Integer)
    mime_type: Mapped[str | None] = mapped_column(String(80))
    image_role: Mapped[str] = mapped_column(String(16), default="normal")
    alt_text: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Tag(Base):
    __tablename__ = "community_tags"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(24), default="subject")
    usage_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PostTag(Base):
    __tablename__ = "community_post_tags"
    __table_args__ = (UniqueConstraint("post_id", "tag_id", name="uq_community_post_tag"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("community_posts.id", ondelete="CASCADE"), index=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("community_tags.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PostLike(Base):
    __tablename__ = "community_post_likes"; __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_community_post_like"),)
    id: Mapped[int] = mapped_column(primary_key=True); user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True); post_id: Mapped[int] = mapped_column(ForeignKey("community_posts.id", ondelete="CASCADE"), index=True); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FavoriteCollection(Base):
    __tablename__ = "community_favorite_collections"; __table_args__ = (UniqueConstraint("user_id", "name", name="uq_community_collection_name"),)
    id: Mapped[int] = mapped_column(primary_key=True); user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True); name: Mapped[str] = mapped_column(String(80)); description: Mapped[str | None] = mapped_column(Text); cover_image_url: Mapped[str | None] = mapped_column(String(500)); visibility: Mapped[str] = mapped_column(String(12), default="private"); post_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0"); is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false"); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now()); updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PostFavorite(Base):
    __tablename__ = "community_post_favorites"; __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_community_post_favorite"),)
    id: Mapped[int] = mapped_column(primary_key=True); user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True); post_id: Mapped[int] = mapped_column(ForeignKey("community_posts.id", ondelete="CASCADE"), index=True); collection_id: Mapped[int] = mapped_column(ForeignKey("community_favorite_collections.id", ondelete="CASCADE"), index=True); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Comment(Base):
    __tablename__ = "community_comments"
    id: Mapped[int] = mapped_column(primary_key=True); post_id: Mapped[int] = mapped_column(ForeignKey("community_posts.id", ondelete="CASCADE"), index=True); author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True); parent_id: Mapped[int | None] = mapped_column(ForeignKey("community_comments.id", ondelete="CASCADE"), index=True); reply_to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL")); content: Mapped[str] = mapped_column(Text); status: Mapped[str] = mapped_column(String(16), default="published"); like_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0"); reply_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0"); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now()); updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()); deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True)); author = relationship("User", foreign_keys=[author_id])


class CommentLike(Base):
    __tablename__ = "community_comment_likes"
    __table_args__ = (UniqueConstraint("user_id", "comment_id", name="uq_community_comment_like"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("community_comments.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserBlock(Base):
    __tablename__ = "community_user_blocks"; __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_community_user_block"),)
    id: Mapped[int] = mapped_column(primary_key=True); blocker_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True); blocked_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "community_notifications"
    id: Mapped[int] = mapped_column(primary_key=True); recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True); actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL")); notification_type: Mapped[str] = mapped_column(String(24)); post_id: Mapped[int | None] = mapped_column(ForeignKey("community_posts.id", ondelete="CASCADE")); comment_id: Mapped[int | None] = mapped_column(ForeignKey("community_comments.id", ondelete="CASCADE")); is_read: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", index=True); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True); actor = relationship("User", foreign_keys=[actor_id])


class Report(Base):
    __tablename__ = "community_reports"
    id: Mapped[int] = mapped_column(primary_key=True); reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True); target_type: Mapped[str] = mapped_column(String(16)); target_id: Mapped[int] = mapped_column(Integer, index=True); reason: Mapped[str] = mapped_column(String(32)); description: Mapped[str | None] = mapped_column(Text); evidence_urls: Mapped[list] = mapped_column(JSON, default=list); status: Mapped[str] = mapped_column(String(16), default="pending", index=True); reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id")); review_note: Mapped[str | None] = mapped_column(Text); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now()); reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PostView(Base):
    __tablename__ = "community_post_views"; __table_args__ = (UniqueConstraint("user_id", "post_id", "view_date", name="uq_community_daily_view"),)
    id: Mapped[int] = mapped_column(primary_key=True); user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True); post_id: Mapped[int] = mapped_column(ForeignKey("community_posts.id", ondelete="CASCADE"), index=True); device_hash: Mapped[str | None] = mapped_column(String(64)); view_date: Mapped[date] = mapped_column(Date, server_default=func.current_date()); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ContentAction(Base):
    __tablename__ = "community_content_actions"
    id: Mapped[int] = mapped_column(primary_key=True); user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True); post_id: Mapped[int] = mapped_column(ForeignKey("community_posts.id", ondelete="CASCADE"), index=True); action_type: Mapped[str] = mapped_column(String(24)); action_weight: Mapped[float] = mapped_column(Float, default=1); duration_ms: Mapped[int | None] = mapped_column(Integer); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
