from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.api import auth as auth_api
from app.core import security
from app.core.config import Settings
from app.core.security import get_password_hash
from app.database import Base, get_db
from app.models.auth import AuthSession
from app.models.user import User


SESSION_HEADERS = {"X-Session-Request": "LensCoach"}


@pytest.fixture()
def auth_client(monkeypatch: pytest.MonkeyPatch):
    settings = Settings(
        DATABASE_URL="sqlite://",
        JWT_SECRET_KEY="test-only-secret-that-is-not-used-outside-tests",
        ACCESS_TOKEN_EXPIRE_MINUTES=15,
        REFRESH_TOKEN_EXPIRE_DAYS=14,
        REFRESH_TOKEN_REUSE_GRACE_SECONDS=30,
        SESSION_COOKIE_SECURE=False,
        SESSION_COOKIE_SAMESITE="lax",
    )
    monkeypatch.setattr(auth_api, "get_settings", lambda: settings)
    monkeypatch.setattr(security, "get_settings", lambda: settings)

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    db = session_factory()
    db.add(
        User(
            username="session-user",
            email="session@example.com",
            hashed_password=get_password_hash("correct-password"),
        )
    )
    db.commit()

    def override_db():
        yield db

    app = FastAPI()
    app.include_router(auth_api.router)
    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)
    try:
        yield client, db, settings
    finally:
        client.close()
        db.close()
        engine.dispose()


def _login(client: TestClient):
    return client.post(
        "/auth/login",
        json={"email": "session@example.com", "password": "correct-password"},
    )


def test_persistent_cookie_restores_login_and_rotates_refresh_token(auth_client) -> None:
    client, _db, settings = auth_client
    login_response = _login(client)

    assert login_response.status_code == 200
    assert login_response.json()["expires_in"] == 15 * 60
    set_cookie = login_response.headers["set-cookie"].lower()
    assert "max-age=" in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "secure" not in set_cookie
    initial_cookie = login_response.cookies[settings.session_cookie_name]

    # A fresh client represents reopening the browser with its persistent cookie jar.
    with TestClient(client.app) as reopened_client:
        reopened_client.cookies.set(
            settings.session_cookie_name,
            initial_cookie,
            domain="testserver.local",
            path="/",
        )
        refresh_response = reopened_client.post("/auth/refresh", headers=SESSION_HEADERS)

        assert refresh_response.status_code == 200
        assert refresh_response.json()["user"]["email"] == "session@example.com"
        rotated_cookie = reopened_client.cookies.get(
            settings.session_cookie_name,
            domain="testserver.local",
            path="/",
        )
        assert rotated_cookie and rotated_cookie != initial_cookie

        access_token = refresh_response.json()["access_token"]
        me_response = reopened_client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert me_response.status_code == 200


def test_expired_persistent_session_requires_login_again(auth_client) -> None:
    client, db, settings = auth_client
    login_response = _login(client)
    access_token = login_response.json()["access_token"]
    auth_session = db.scalar(select(AuthSession))
    assert auth_session is not None
    auth_session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()

    refresh_response = client.post("/auth/refresh", headers=SESSION_HEADERS)
    assert refresh_response.status_code == 401
    assert client.cookies.get(settings.session_cookie_name) is None

    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 401


def test_logout_revokes_cookie_and_already_issued_access_token(auth_client) -> None:
    client, db, settings = auth_client
    login_response = _login(client)
    access_token = login_response.json()["access_token"]
    refresh_cookie = login_response.cookies[settings.session_cookie_name]

    logout_response = client.post("/auth/logout", headers=SESSION_HEADERS)
    assert logout_response.status_code == 204
    assert client.cookies.get(settings.session_cookie_name) is None
    auth_session = db.scalar(select(AuthSession))
    assert auth_session is not None and auth_session.revoked_at is not None

    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 401

    client.cookies.set(settings.session_cookie_name, refresh_cookie, domain="testserver.local", path="/")
    replay_response = client.post("/auth/refresh", headers=SESSION_HEADERS)
    assert replay_response.status_code == 401


def test_refresh_token_replay_outside_grace_period_revokes_session(auth_client) -> None:
    client, db, settings = auth_client
    login_response = _login(client)
    old_cookie = login_response.cookies[settings.session_cookie_name]
    refresh_response = client.post("/auth/refresh", headers=SESSION_HEADERS)
    assert refresh_response.status_code == 200
    current_cookie = client.cookies.get(
        settings.session_cookie_name,
        domain="testserver.local",
        path="/",
    )
    assert current_cookie and current_cookie != old_cookie

    auth_session = db.scalar(select(AuthSession))
    assert auth_session is not None
    auth_session.previous_token_valid_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()

    client.cookies.set(settings.session_cookie_name, old_cookie, domain="testserver.local", path="/")
    replay_response = client.post("/auth/refresh", headers=SESSION_HEADERS)
    assert replay_response.status_code == 401

    client.cookies.set(settings.session_cookie_name, current_cookie, domain="testserver.local", path="/")
    current_response = client.post("/auth/refresh", headers=SESSION_HEADERS)
    assert current_response.status_code == 401


def test_logout_with_access_token_still_revokes_session_if_cookie_is_missing(auth_client) -> None:
    client, _db, _settings = auth_client
    login_response = _login(client)
    access_token = login_response.json()["access_token"]
    client.cookies.clear()

    logout_response = client.post(
        "/auth/logout",
        headers={**SESSION_HEADERS, "Authorization": f"Bearer {access_token}"},
    )

    assert logout_response.status_code == 204
    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 401


def test_secure_cookie_attribute_is_configurable_for_https(auth_client) -> None:
    client, _db, settings = auth_client
    settings.session_cookie_secure = True

    login_response = _login(client)

    assert login_response.status_code == 200
    assert "secure" in login_response.headers["set-cookie"].lower()
