from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DirectConversation(Base):
    __tablename__ = "direct_conversations"
    __table_args__ = (
        UniqueConstraint("user_low_id", "user_high_id", name="uq_direct_conversation_pair"),
        CheckConstraint("user_low_id <> user_high_id", name="ck_direct_conversation_not_self"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    user_low_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user_high_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    initiator_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    request_status: Mapped[str] = mapped_column(String(16), default="pending", server_default="pending", index=True)
    is_unlocked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    opening_message_used: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    unlocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_message_id: Mapped[int | None] = mapped_column(Integer)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    low_user = relationship("User", foreign_keys=[user_low_id])
    high_user = relationship("User", foreign_keys=[user_high_id])
    messages = relationship("DirectMessage", foreign_keys="DirectMessage.conversation_id", cascade="all, delete-orphan")
    states = relationship("ConversationUserState", cascade="all, delete-orphan")


class DirectMessage(Base):
    __tablename__ = "direct_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("direct_conversations.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message_type: Mapped[str] = mapped_column(String(16), default="text")
    content: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    shared_post_id: Mapped[int | None] = mapped_column(ForeignKey("community_posts.id", ondelete="SET NULL"), index=True)
    reply_to_message_id: Mapped[int | None] = mapped_column(ForeignKey("direct_messages.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(16), default="sent", server_default="sent")
    is_opening_message: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sender = relationship("User")
    shared_post = relationship("CommunityPost")


class ConversationUserState(Base):
    __tablename__ = "conversation_user_states"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_conversation_user_state"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("direct_conversations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    last_read_message_id: Mapped[int | None] = mapped_column(ForeignKey("direct_messages.id", ondelete="SET NULL"))
    unread_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", index=True)
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_deleted_for_user: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    deleted_before_message_id: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MessageReport(Base):
    __tablename__ = "message_reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("direct_messages.id", ondelete="CASCADE"), index=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("direct_conversations.id", ondelete="CASCADE"), index=True)
    reason: Mapped[str] = mapped_column(String(32))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="pending", server_default="pending", index=True)
    reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    review_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
