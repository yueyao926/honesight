import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.database import Base
from app.models.messaging import DirectMessage
from app.models.user import User
from app.schemas.messaging import MessageCreate
from app.services.messaging import create_or_get_conversation, send_message
from app.services.search import normalize_text, query_terms

@pytest.fixture()
def db():
    engine=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=StaticPool)
    Base.metadata.create_all(engine);Session=sessionmaker(bind=engine);session=Session()
    session.add_all([User(username="A",email="a@example.com",hashed_password="x"),User(username="B",email="b@example.com",hashed_password="x")]);session.commit()
    try:yield session
    finally:session.close()

def test_opening_message_limit_and_unlock(db):
    a,b=db.scalars(select(User).order_by(User.id)).all();conversation=create_or_get_conversation(db,a,b.id)
    first=send_message(db,conversation.id,a,MessageCreate(content="你好"));assert first.is_opening_message
    with pytest.raises(HTTPException) as error:send_message(db,conversation.id,a,MessageCreate(content="第二条"))
    assert error.value.status_code==409 and error.value.detail["code"]=="WAITING_FOR_RECIPIENT_REPLY"
    first.deleted_at=first.created_at;db.commit()
    with pytest.raises(HTTPException):send_message(db,conversation.id,a,MessageCreate(content="删除也不能绕过"))
    send_message(db,conversation.id,b,MessageCreate(content="你好"));db.refresh(conversation);assert conversation.is_unlocked
    send_message(db,conversation.id,a,MessageCreate(content="现在可以继续"))

def test_conversation_pair_is_reused(db):
    a,b=db.scalars(select(User).order_by(User.id)).all();one=create_or_get_conversation(db,a,b.id);two=create_or_get_conversation(db,b,a.id);assert one.id==two.id

def test_cannot_message_self(db):
    a=db.scalar(select(User).order_by(User.id))
    with pytest.raises(HTTPException):create_or_get_conversation(db,a,a.id)

def test_search_normalization_and_semantic_expansion():
    assert normalize_text("  Film＿PHOTO／夜景  ")=="film photo 夜景"
    terms=query_terms("雨夜街拍");assert "雨天" in terms and "蓝调" in terms
