from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.api.community import user_posts
from app.database import Base
from app.models.community import CommunityPost
from app.models.profile import UserFollow
from app.models.user import User


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    author = User(username="author", email="author@example.com", hashed_password="x")
    follower = User(username="follower", email="follower@example.com", hashed_password="x")
    stranger = User(username="stranger", email="stranger@example.com", hashed_password="x")
    session.add_all([author, follower, stranger])
    session.flush()
    session.add(UserFollow(follower_id=follower.id, following_id=author.id))
    now = datetime.now(timezone.utc)
    session.add_all([
        CommunityPost(author_id=author.id, title="public", status="published", visibility="public", published_at=now),
        CommunityPost(author_id=author.id, title="followers", status="published", visibility="followers", published_at=now),
        CommunityPost(author_id=author.id, title="private", status="published", visibility="private", published_at=now),
        CommunityPost(author_id=author.id, title="draft", status="draft", visibility="public"),
    ])
    session.commit()
    try:
        yield session, author, follower, stranger
    finally:
        session.close()


def _titles(result):
    return {post["title"] for post in result["items"]}


def test_profile_posts_respect_visibility(db):
    session, author, follower, stranger = db
    anonymous = user_posts(author.id, 20, None, None, session)
    assert _titles(anonymous) == {"public"}
    assert anonymous["total"] == 1
    assert _titles(user_posts(author.id, 20, None, stranger, session)) == {"public"}
    assert _titles(user_posts(author.id, 20, None, follower, session)) == {"public", "followers"}
    own_posts = user_posts(author.id, 20, None, author, session)
    assert _titles(own_posts) == {"public", "followers", "private"}
    assert own_posts["total"] == 3


def test_profile_posts_reject_missing_user(db):
    session, *_ = db
    with pytest.raises(HTTPException) as error:
        user_posts(9999, 20, None, None, session)
    assert error.value.status_code == 404
