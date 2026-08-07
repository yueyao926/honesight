from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.database import get_db
from app.models.community import CommunityPost
from app.models.messaging import ConversationUserState, DirectConversation, DirectMessage, MessageReport
from app.models.user import User
from app.schemas.messaging import ConversationCreate, ConversationSettings, MessageCreate, MessageReportCreate
from app.services.messaging import create_or_get_conversation, other_user_id, require_participant, send_message
from app.services.image_storage import (
    ImageProcessingError,
    MESSAGE_IMAGE_MAX_BYTES,
    MESSAGE_IMAGE_SIZE,
    store_image,
    upload_url,
)

router = APIRouter(prefix="/messages", tags=["messages"])

def conversation_dict(row, user, db):
    peer_id=other_user_id(row,user.id); peer=db.get(User,peer_id); state=db.scalar(select(ConversationUserState).where(ConversationUserState.conversation_id==row.id,ConversationUserState.user_id==user.id)); last=db.get(DirectMessage,row.last_message_id) if row.last_message_id else None
    return {"id":row.id,"peer":{"id":peer.id,"username":peer.username,"avatar_url":peer.avatar_url,"signature":peer.signature},"request_status":row.request_status,"is_unlocked":row.is_unlocked,"opening_message_used":row.opening_message_used,"is_initiator":row.initiator_id==user.id,"waiting_for_reply":row.initiator_id==user.id and not row.is_unlocked and row.opening_message_used,"is_request":row.initiator_id!=user.id and not row.is_unlocked,"last_message":{"id":last.id,"type":last.message_type,"content":"消息已删除" if last.deleted_at else (last.content or ("[图片]" if last.message_type=="image" else "[帖子]")),"sender_id":last.sender_id,"created_at":last.created_at} if last else None,"last_message_at":row.last_message_at,"unread_count":state.unread_count,"is_muted":state.is_muted,"is_archived":state.is_archived}

@router.post("/conversations",status_code=201)
def create(payload:ConversationCreate,user:User=Depends(get_current_user),db:Session=Depends(get_db)): return conversation_dict(create_or_get_conversation(db,user,payload.target_user_id),user,db)

@router.get("/conversations")
def conversations(limit:int=Query(30,ge=1,le=50),before_id:int|None=None,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    q=select(DirectConversation).join(ConversationUserState).where(ConversationUserState.user_id==user.id,ConversationUserState.is_deleted_for_user.is_(False),or_(DirectConversation.user_low_id==user.id,DirectConversation.user_high_id==user.id))
    if before_id:q=q.where(DirectConversation.id<before_id)
    rows=db.scalars(q.order_by(DirectConversation.last_message_at.desc().nullslast(),DirectConversation.id.desc()).limit(limit)).all(); return [conversation_dict(r,user,db) for r in rows]

@router.post("/conversations/{conversation_id}/messages",status_code=201)
def send(conversation_id:int,payload:MessageCreate,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    m=send_message(db,conversation_id,user,payload); return {"id":m.id,"conversation_id":m.conversation_id,"sender_id":m.sender_id,"message_type":m.message_type,"content":m.content,"image_url":m.image_url,"shared_post_id":m.shared_post_id,"reply_to_message_id":m.reply_to_message_id,"status":m.status,"is_opening_message":m.is_opening_message,"created_at":m.created_at}

@router.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id:int,limit:int=Query(40,ge=1,le=100),before_id:int|None=None,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    row=require_participant(db.get(DirectConversation,conversation_id),user.id); state=db.scalar(select(ConversationUserState).where(ConversationUserState.conversation_id==row.id,ConversationUserState.user_id==user.id)); q=select(DirectMessage).options(selectinload(DirectMessage.sender),selectinload(DirectMessage.shared_post)).where(DirectMessage.conversation_id==row.id)
    if before_id:q=q.where(DirectMessage.id<before_id)
    if state.deleted_before_message_id:q=q.where(DirectMessage.id>state.deleted_before_message_id)
    messages=list(reversed(db.scalars(q.order_by(DirectMessage.id.desc()).limit(limit)).all()))
    return [{"id":m.id,"sender_id":m.sender_id,"message_type":m.message_type,"content":None if m.deleted_at else m.content,"image_url":None if m.deleted_at else m.image_url,"shared_post":{"id":m.shared_post.id,"title":m.shared_post.title,"cover_image_url":m.shared_post.cover_image_url} if m.shared_post and m.shared_post.status=="published" and not m.shared_post.deleted_at else None,"reply_to_message_id":m.reply_to_message_id,"status":"deleted" if m.deleted_at else m.status,"is_opening_message":m.is_opening_message,"created_at":m.created_at} for m in messages]

@router.post("/conversations/{conversation_id}/read")
def read(conversation_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    row=require_participant(db.get(DirectConversation,conversation_id),user.id); last=db.scalar(select(func.max(DirectMessage.id)).where(DirectMessage.conversation_id==row.id,DirectMessage.sender_id!=user.id)); state=db.scalar(select(ConversationUserState).where(ConversationUserState.conversation_id==row.id,ConversationUserState.user_id==user.id)); state.last_read_message_id=last; state.unread_count=0; db.commit(); total=db.scalar(select(func.sum(ConversationUserState.unread_count)).where(ConversationUserState.user_id==user.id)) or 0; return {"read":True,"unread_count":total}

@router.get("/unread-count")
def unread(user:User=Depends(get_current_user),db:Session=Depends(get_db)): return {"unread_count":db.scalar(select(func.sum(ConversationUserState.unread_count)).where(ConversationUserState.user_id==user.id)) or 0}

@router.patch("/conversations/{conversation_id}/settings")
def settings(conversation_id:int,payload:ConversationSettings,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    row=require_participant(db.get(DirectConversation,conversation_id),user.id); state=db.scalar(select(ConversationUserState).where(ConversationUserState.conversation_id==row.id,ConversationUserState.user_id==user.id));
    for k,v in payload.model_dump(exclude_none=True).items():setattr(state,k,v)
    if payload.is_deleted_for_user: state.deleted_before_message_id=row.last_message_id
    db.commit(); return {"updated":True}

@router.post("/conversations/{conversation_id}/reject")
def reject(conversation_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    row=require_participant(db.scalar(select(DirectConversation).where(DirectConversation.id==conversation_id).with_for_update()),user.id)
    if row.initiator_id==user.id or row.is_unlocked: raise HTTPException(403,"不能拒绝该会话")
    row.request_status="rejected"; db.commit(); return {"rejected":True}

@router.delete("/conversations/{conversation_id}/messages/{message_id}")
def delete_message(conversation_id:int,message_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    require_participant(db.get(DirectConversation,conversation_id),user.id); m=db.scalar(select(DirectMessage).where(DirectMessage.id==message_id,DirectMessage.conversation_id==conversation_id,DirectMessage.sender_id==user.id))
    if not m:raise HTTPException(404,"消息不存在")
    m.deleted_at=datetime.now(timezone.utc);m.status="deleted";m.content=None;m.image_url=None;db.commit();return {"deleted":True}

@router.post("/messages/{message_id}/report",status_code=201)
def report(message_id:int,payload:MessageReportCreate,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    m=db.get(DirectMessage,message_id);require_participant(db.get(DirectConversation,m.conversation_id) if m else None,user.id);r=MessageReport(reporter_id=user.id,message_id=m.id,conversation_id=m.conversation_id,**payload.model_dump());db.add(r);db.commit();return {"id":r.id,"status":r.status}

@router.post("/uploads/images",status_code=201)
async def upload_image(file:UploadFile=File(...),user:User=Depends(get_current_user)):
    content=await file.read(get_settings().message_image_max_size+1)
    if len(content)>get_settings().message_image_max_size:raise HTTPException(400,"图片过大")
    settings=get_settings();folder=settings.upload_path/"messages"/str(user.id)
    try:
        stored=await run_in_threadpool(store_image,content,folder,uuid4().hex,max_size=MESSAGE_IMAGE_SIZE,max_bytes=MESSAGE_IMAGE_MAX_BYTES,quality=78)
    except ImageProcessingError as exc:
        raise HTTPException(400,str(exc)) from exc
    return {"image_url":upload_url(stored.image_path,settings.upload_path)}
