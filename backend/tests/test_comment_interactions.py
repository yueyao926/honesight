import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.api.community import add_comment, delete_comment, like_comment, unlike_comment
from app.database import Base
from app.models.community import Comment, CommentLike, CommunityPost
from app.models.user import User
from app.schemas.community import CommentPayload

@pytest.fixture()
def db():
    engine=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=StaticPool)
    Base.metadata.create_all(engine);Session=sessionmaker(bind=engine);session=Session()
    author=User(username="author",email="author@example.com",hashed_password="x");reader=User(username="reader",email="reader@example.com",hashed_password="x")
    session.add_all([author,reader]);session.flush();post=CommunityPost(author_id=author.id,title="test",content="test",status="published",visibility="public",allow_comments=True);session.add(post);session.commit()
    try:yield session,author,reader,post
    finally:session.close()

def test_comment_like_is_idempotent_and_reversible(db):
    session,author,reader,post=db;comment=Comment(post_id=post.id,author_id=author.id,content="nice");session.add(comment);session.commit()
    assert like_comment(comment.id,reader,session)=={"liked":True,"like_count":1}
    assert like_comment(comment.id,reader,session)=={"liked":True,"like_count":1}
    assert session.scalar(select(CommentLike).where(CommentLike.comment_id==comment.id))
    assert unlike_comment(comment.id,reader,session)=={"liked":False,"like_count":0}

def test_replies_are_limited_to_two_levels(db):
    session,author,reader,post=db
    root=add_comment(post.id,CommentPayload(content="root"),reader,session);reply=add_comment(post.id,CommentPayload(content="reply",parent_id=root["id"]),author,session)
    with pytest.raises(HTTPException) as error:add_comment(post.id,CommentPayload(content="nested",parent_id=reply["id"]),reader,session)
    assert error.value.status_code==400
    parent=session.get(Comment,root["id"]);assert parent.reply_count==1

def test_author_can_delete_own_comment_and_updates_counts(db):
    session,author,reader,post=db
    session.refresh(post)
    root=add_comment(post.id,CommentPayload(content="root"),reader,session)
    reply=add_comment(post.id,CommentPayload(content="reply",parent_id=root["id"]),author,session)
    session.refresh(post)
    assert post.comment_count==2
    delete_comment(reply["id"],author,session)
    session.refresh(post)
    parent=session.get(Comment,root["id"])
    assert parent.reply_count==0
    assert post.comment_count==1
    delete_comment(root["id"],reader,session)
    session.refresh(post)
    assert post.comment_count==0
    assert session.scalar(select(Comment).where(Comment.id==reply["id"],Comment.deleted_at.is_(None))) is None
