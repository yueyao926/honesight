from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.community import CommunityPost, UserBlock
from app.models.messaging import ConversationUserState, DirectConversation, DirectMessage
from app.models.user import User
from app.schemas.messaging import MessageCreate

SENSITIVE_TERMS = {"赌博", "裸聊", "代开发票"}

def _pair(a: int, b: int) -> tuple[int, int]: return (a, b) if a < b else (b, a)

def _blocked(db: Session, a: int, b: int) -> bool:
    return bool(db.scalar(select(UserBlock.id).where(or_(and_(UserBlock.blocker_id == a, UserBlock.blocked_id == b), and_(UserBlock.blocker_id == b, UserBlock.blocked_id == a)))))

def require_participant(conversation: DirectConversation | None, user_id: int) -> DirectConversation:
    if not conversation or user_id not in {conversation.user_low_id, conversation.user_high_id}: raise HTTPException(404, "会话不存在")
    return conversation

def other_user_id(conversation: DirectConversation, user_id: int) -> int:
    return conversation.user_high_id if conversation.user_low_id == user_id else conversation.user_low_id

def create_or_get_conversation(db: Session, user: User, target_id: int) -> DirectConversation:
    if target_id == user.id: raise HTTPException(400, "不能给自己发私信")
    target = db.scalar(select(User).where(User.id == target_id, User.is_deleted.is_(False)))
    if not target: raise HTTPException(404, "用户不存在")
    if _blocked(db, user.id, target_id): raise HTTPException(403, "暂时无法发起私信")
    low, high = _pair(user.id, target_id)
    existing = db.scalar(select(DirectConversation).where(DirectConversation.user_low_id == low, DirectConversation.user_high_id == high))
    if existing: return existing
    settings = get_settings(); since = datetime.now(timezone.utc) - timedelta(days=1)
    started = db.scalar(select(func.count()).select_from(DirectConversation).where(DirectConversation.initiator_id == user.id, DirectConversation.created_at >= since)) or 0
    if started >= settings.message_request_daily_limit: raise HTTPException(429, "今日发起的新会话已达上限")
    row = DirectConversation(user_low_id=low, user_high_id=high, initiator_id=user.id)
    db.add(row)
    try:
        db.flush()
        db.add_all([ConversationUserState(conversation_id=row.id, user_id=low), ConversationUserState(conversation_id=row.id, user_id=high)])
        db.commit(); db.refresh(row); return row
    except IntegrityError:
        db.rollback()
        return db.scalar(select(DirectConversation).where(DirectConversation.user_low_id == low, DirectConversation.user_high_id == high))

def send_message(db: Session, conversation_id: int, user: User, payload: MessageCreate) -> DirectMessage:
    # Row lock serializes concurrent opening-message attempts.
    conversation = require_participant(db.scalar(select(DirectConversation).where(DirectConversation.id == conversation_id).with_for_update()), user.id)
    peer_id = other_user_id(conversation, user.id)
    if user.is_deleted or _blocked(db, user.id, peer_id): raise HTTPException(403, "暂时无法发送消息")
    if conversation.request_status in {"rejected", "closed"}: raise HTTPException(403, "暂时无法发送消息")
    if payload.content and any(term in payload.content for term in SENSITIVE_TERMS): raise HTTPException(400, "消息包含不适宜内容")
    recent = datetime.now(timezone.utc) - timedelta(minutes=1)
    sent_recently = db.scalar(select(func.count()).select_from(DirectMessage).where(DirectMessage.sender_id == user.id, DirectMessage.created_at >= recent)) or 0
    if sent_recently >= get_settings().message_rate_limit: raise HTTPException(429, "发送过于频繁，请稍后再试")
    opening = False
    if not conversation.is_unlocked:
        if user.id == conversation.initiator_id:
            if conversation.opening_message_used: raise HTTPException(409, detail={"code":"WAITING_FOR_RECIPIENT_REPLY","message":"对方回复后，你才能继续发送消息。"})
            if payload.message_type not in {"text", "post_share"} or payload.image_url or payload.reply_to_message_id: raise HTTPException(400, "开场消息仅支持文字或一个帖子卡片")
            opening = True
        else:
            conversation.is_unlocked = True; conversation.request_status = "active"; conversation.unlocked_at = datetime.now(timezone.utc)
    if payload.shared_post_id:
        post = db.scalar(select(CommunityPost).where(CommunityPost.id == payload.shared_post_id, CommunityPost.status == "published", CommunityPost.deleted_at.is_(None)))
        if not post: raise HTTPException(404, "分享的帖子不可用")
    if payload.reply_to_message_id:
        reply = db.scalar(select(DirectMessage).where(DirectMessage.id == payload.reply_to_message_id, DirectMessage.conversation_id == conversation.id))
        if not reply: raise HTTPException(400, "回复的消息不存在")
    message = DirectMessage(conversation_id=conversation.id, sender_id=user.id, is_opening_message=opening, **payload.model_dump())
    db.add(message); db.flush()
    if opening: conversation.opening_message_used = True
    conversation.last_message_id = message.id; conversation.last_message_at = message.created_at; conversation.updated_at = datetime.now(timezone.utc)
    peer_state = db.scalar(select(ConversationUserState).where(ConversationUserState.conversation_id == conversation.id, ConversationUserState.user_id == peer_id).with_for_update())
    peer_state.unread_count += 1; peer_state.is_deleted_for_user = False
    own_state = db.scalar(select(ConversationUserState).where(ConversationUserState.conversation_id == conversation.id, ConversationUserState.user_id == user.id))
    own_state.is_deleted_for_user = False
    db.commit(); db.refresh(message); return message
