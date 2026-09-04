from datetime import timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.api import auth as auth_api
from app.core.config import Settings
from app.core.security import hash_token
from app.database import Base, get_db
from app.models.auth import AuthSession, EmailToken
from app.models.user import User
from app.services import email as email_service


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    settings = Settings(
        DATABASE_URL="sqlite://",
        JWT_SECRET_KEY="test-only-secret-that-is-not-used-outside-tests",
    )
    monkeypatch.setattr(auth_api, "get_settings", lambda: settings)

    sent_emails: list[tuple[str, str, str]] = []
    monkeypatch.setattr(
        auth_api,
        "send_verification_email",
        lambda to, link: sent_emails.append(("verification", to, link)),
    )
    monkeypatch.setattr(
        auth_api,
        "send_password_reset_email",
        lambda to, link: sent_emails.append(("reset", to, link)),
    )
    monkeypatch.setattr(
        auth_api,
        "send_verified_account_email",
        lambda to, base_url: sent_emails.append(("verified", to, base_url)),
    )

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    db = session_factory()

    def override_db():
        yield db

    app = FastAPI()
    app.include_router(auth_api.router)
    app.dependency_overrides[get_db] = override_db
    test_client = TestClient(app)
    try:
        yield test_client, db, settings, sent_emails
    finally:
        test_client.close()
        db.close()
        engine.dispose()


def _token_from_link(link: str) -> str:
    return link.split("token=", 1)[1]


def _age_latest_email_token(db, email: str, purpose: str) -> None:
    user = db.scalar(select(User).where(User.email == email))
    assert user is not None
    email_token = db.scalar(
        select(EmailToken)
        .where(EmailToken.user_id == user.id, EmailToken.purpose == purpose)
        .order_by(EmailToken.id.desc())
        .limit(1)
    )
    assert email_token is not None
    email_token.created_at = auth_api._utc_now() - timedelta(
        seconds=auth_api.EMAIL_SEND_COOLDOWN_SECONDS + 1
    )
    db.commit()


def _register(client: TestClient, email: str, password: str = "password1") -> None:
    response = client.post(
        "/auth/register",
        json={"username": "user", "email": email, "password": password},
    )
    assert response.status_code == 201


def test_register_blocks_login_until_verified(client) -> None:
    test_client, _db, _settings, sent = client
    _register(test_client, "new@example.com")

    login = test_client.post("/auth/login", json={"email": "new@example.com", "password": "password1"})
    assert login.status_code == 403

    assert len(sent) == 1
    kind, to, link = sent[0]
    assert kind == "verification"
    assert to == "new@example.com"
    assert "/verify-email?token=" in link


def test_register_rolls_back_when_email_delivery_fails(client, monkeypatch: pytest.MonkeyPatch) -> None:
    test_client, db, _settings, _sent = client

    def fail_delivery(_to: str, _link: str) -> None:
        raise email_service.EmailDeliveryError("SMTP unavailable")

    monkeypatch.setattr(auth_api, "send_verification_email", fail_delivery)

    response = test_client.post(
        "/auth/register",
        json={"username": "retryable", "email": "retry@example.com", "password": "password1"},
    )

    assert response.status_code == 503
    assert db.scalar(select(User).where(User.email == "retry@example.com")) is None


def test_register_recovers_an_unverified_account_without_replacing_credentials(client) -> None:
    test_client, db, _settings, sent = client
    first = test_client.post(
        "/auth/register",
        json={"username": "first", "email": "restart@example.com", "password": "old-password"},
    )
    first_token = _token_from_link(sent[-1][2])
    _age_latest_email_token(db, "restart@example.com", auth_api.EMAIL_VERIFICATION_PURPOSE)

    second = test_client.post(
        "/auth/register",
        json={"username": "second", "email": "restart@example.com", "password": "new-password"},
    )
    second_token = _token_from_link(sent[-1][2])

    assert first.status_code == 201
    assert second.status_code == 409
    assert "新的验证邮件已发送" in second.json()["detail"]
    recovered_user = db.scalar(select(User).where(User.email == "restart@example.com"))
    assert recovered_user is not None
    assert recovered_user.id == first.json()["id"]
    assert recovered_user.username == "first"
    assert first_token != second_token
    assert test_client.post("/auth/verify-email", json={"token": first_token}).status_code == 400
    assert test_client.post("/auth/verify-email", json={"token": second_token}).status_code == 200
    assert test_client.post(
        "/auth/login",
        json={"email": "restart@example.com", "password": "old-password"},
    ).status_code == 200
    assert test_client.post(
        "/auth/login",
        json={"email": "restart@example.com", "password": "new-password"},
    ).status_code == 400


def test_register_cannot_overwrite_a_verified_account(client) -> None:
    test_client, _db, _settings, sent = client
    _register(test_client, "protected@example.com", "original-password")
    token = _token_from_link(sent[-1][2])
    assert test_client.post("/auth/verify-email", json={"token": token}).status_code == 200

    response = test_client.post(
        "/auth/register",
        json={"username": "attacker", "email": "protected@example.com", "password": "changed-password"},
    )

    assert response.status_code == 400
    assert len(sent) == 1
    assert "已注册并完成验证" in response.json()["detail"]
    assert test_client.post(
        "/auth/login",
        json={"email": "protected@example.com", "password": "original-password"},
    ).status_code == 200
    assert test_client.post(
        "/auth/login",
        json={"email": "protected@example.com", "password": "changed-password"},
    ).status_code == 400


def test_verify_email_enables_login_and_is_single_use(client) -> None:
    test_client, _db, _settings, sent = client
    _register(test_client, "v@example.com")
    token = _token_from_link(sent[-1][2])

    verify = test_client.post("/auth/verify-email", json={"token": token})
    assert verify.status_code == 200

    login = test_client.post("/auth/login", json={"email": "v@example.com", "password": "password1"})
    assert login.status_code == 200

    again = test_client.post("/auth/verify-email", json={"token": token})
    assert again.status_code == 400


def test_verify_email_rejects_invalid_token(client) -> None:
    test_client, *_ = client
    response = test_client.post("/auth/verify-email", json={"token": "bogus-token"})
    assert response.status_code == 400


def test_resend_verification_issues_new_token(client) -> None:
    test_client, db, _settings, sent = client
    _register(test_client, "r@example.com")
    first_token = _token_from_link(sent[-1][2])
    _age_latest_email_token(db, "r@example.com", auth_api.EMAIL_VERIFICATION_PURPOSE)

    response = test_client.post("/auth/resend-verification", json={"email": "r@example.com"})
    assert response.status_code == 200
    assert len(sent) == 2
    second_token = _token_from_link(sent[-1][2])
    assert second_token != first_token
    assert test_client.post("/auth/verify-email", json={"token": first_token}).status_code == 400
    assert test_client.post("/auth/verify-email", json={"token": second_token}).status_code == 200


def test_resend_verification_sends_guidance_for_verified_account(client) -> None:
    test_client, _db, settings, sent = client
    _register(test_client, "verified@example.com")
    token = _token_from_link(sent[-1][2])
    assert test_client.post("/auth/verify-email", json={"token": token}).status_code == 200

    response = test_client.post("/auth/resend-verification", json={"email": "verified@example.com"})

    assert response.status_code == 200
    assert sent[-1] == ("verified", "verified@example.com", settings.frontend_base_url)


def test_failed_resend_keeps_the_previous_verification_link(
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_client, db, _settings, sent = client
    _register(test_client, "rollback@example.com")
    previous_token = _token_from_link(sent[-1][2])
    _age_latest_email_token(db, "rollback@example.com", auth_api.EMAIL_VERIFICATION_PURPOSE)

    def fail_delivery(_to: str, _link: str) -> None:
        raise email_service.EmailDeliveryError("SMTP unavailable")

    monkeypatch.setattr(auth_api, "send_verification_email", fail_delivery)
    resend = test_client.post("/auth/resend-verification", json={"email": "rollback@example.com"})

    assert resend.status_code == 503
    assert test_client.post("/auth/verify-email", json={"token": previous_token}).status_code == 200


def test_resend_verification_silently_rate_limits_repeated_requests(client) -> None:
    test_client, _db, _settings, sent = client
    _register(test_client, "cooldown@example.com")

    response = test_client.post("/auth/resend-verification", json={"email": "cooldown@example.com"})

    assert response.status_code == 200
    assert response.json()["detail"] == "如果该邮箱存在，我们已发送验证邮件或账号状态说明"
    assert len(sent) == 1


def test_resend_verification_does_not_leak_unknown_email(client) -> None:
    test_client, _db, _settings, sent = client
    response = test_client.post("/auth/resend-verification", json={"email": "ghost@example.com"})
    assert response.status_code == 200
    assert sent == []


def test_password_reset_flow_revokes_sessions(client) -> None:
    test_client, db, _settings, sent = client
    _register(test_client, "p@example.com", "old-password")
    verify_token = _token_from_link(sent[-1][2])
    test_client.post("/auth/verify-email", json={"token": verify_token})

    request = test_client.post("/auth/password-reset/request", json={"email": "p@example.com"})
    assert request.status_code == 200
    reset_token = _token_from_link(sent[-1][2])

    login = test_client.post("/auth/login", json={"email": "p@example.com", "password": "old-password"})
    assert login.status_code == 200
    auth_session = db.scalar(select(AuthSession))
    assert auth_session is not None and auth_session.revoked_at is None

    confirm = test_client.post(
        "/auth/password-reset/confirm",
        json={"token": reset_token, "new_password": "new-password"},
    )
    assert confirm.status_code == 200

    old_login = test_client.post("/auth/login", json={"email": "p@example.com", "password": "old-password"})
    assert old_login.status_code == 400
    new_login = test_client.post("/auth/login", json={"email": "p@example.com", "password": "new-password"})
    assert new_login.status_code == 200

    assert auth_session.revoked_at is not None


def test_requesting_a_new_password_reset_invalidates_the_previous_link(client) -> None:
    test_client, db, _settings, sent = client
    _register(test_client, "reset-twice@example.com")
    verify_token = _token_from_link(sent[-1][2])
    assert test_client.post("/auth/verify-email", json={"token": verify_token}).status_code == 200

    assert test_client.post(
        "/auth/password-reset/request",
        json={"email": "reset-twice@example.com"},
    ).status_code == 200
    first_reset_token = _token_from_link(sent[-1][2])
    _age_latest_email_token(db, "reset-twice@example.com", auth_api.PASSWORD_RESET_PURPOSE)

    assert test_client.post(
        "/auth/password-reset/request",
        json={"email": "reset-twice@example.com"},
    ).status_code == 200
    second_reset_token = _token_from_link(sent[-1][2])

    assert test_client.post(
        "/auth/password-reset/confirm",
        json={"token": first_reset_token, "new_password": "ignored-password"},
    ).status_code == 400
    assert test_client.post(
        "/auth/password-reset/confirm",
        json={"token": second_reset_token, "new_password": "final-password"},
    ).status_code == 200


def test_password_reset_consumes_all_legacy_valid_tokens(client) -> None:
    test_client, db, _settings, sent = client
    _register(test_client, "legacy-tokens@example.com")
    verify_token = _token_from_link(sent[-1][2])
    assert test_client.post("/auth/verify-email", json={"token": verify_token}).status_code == 200
    user = db.scalar(select(User).where(User.email == "legacy-tokens@example.com"))
    assert user is not None

    first_token = "legacy-reset-token-one"
    second_token = "legacy-reset-token-two"
    expires_at = auth_api._utc_now() + timedelta(minutes=30)
    db.add_all(
        [
            EmailToken(
                user_id=user.id,
                purpose=auth_api.PASSWORD_RESET_PURPOSE,
                token_hash=hash_token(first_token),
                expires_at=expires_at,
            ),
            EmailToken(
                user_id=user.id,
                purpose=auth_api.PASSWORD_RESET_PURPOSE,
                token_hash=hash_token(second_token),
                expires_at=expires_at,
            ),
        ]
    )
    db.commit()

    assert test_client.post(
        "/auth/password-reset/confirm",
        json={"token": first_token, "new_password": "new-password"},
    ).status_code == 200
    assert test_client.post(
        "/auth/password-reset/confirm",
        json={"token": second_token, "new_password": "another-password"},
    ).status_code == 400


def test_password_reset_request_unknown_email_returns_200(client) -> None:
    test_client, _db, _settings, sent = client
    response = test_client.post("/auth/password-reset/request", json={"email": "nobody@example.com"})
    assert response.status_code == 200
    assert sent == []


def test_password_reset_confirm_rejects_bad_token(client) -> None:
    test_client, *_ = client
    response = test_client.post(
        "/auth/password-reset/confirm",
        json={"token": "bogus", "new_password": "whatever1"},
    )
    assert response.status_code == 400


def test_send_email_uses_implicit_ssl_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    sent_messages = []

    class FakeSMTPSSL:
        def __init__(self, host: str, port: int, timeout: int, context) -> None:
            assert host == "smtp.example.com"
            assert port == 465
            assert timeout == 15
            assert context is not None

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback) -> None:
            return None

        def login(self, username: str, password: str) -> None:
            assert username == "mailer@example.com"
            assert password == "test-password"

        def send_message(self, message, *, from_addr: str, to_addrs: list[str]) -> None:
            assert from_addr == "mailer@example.com"
            assert to_addrs == ["recipient@example.com"]
            sent_messages.append(message)

    settings = Settings(
        SMTP_HOST="smtp.example.com",
        SMTP_PORT=465,
        SMTP_USERNAME="mailer@example.com",
        SMTP_PASSWORD="test-password",
        SMTP_USE_SSL=True,
    )
    monkeypatch.setattr(email_service, "get_settings", lambda: settings)
    monkeypatch.setattr(email_service.smtplib, "SMTP_SSL", FakeSMTPSSL)

    email_service.send_email(to_email="recipient@example.com", subject="Test", html_body="<p>Test</p>")

    assert len(sent_messages) == 1


def test_send_email_rejects_missing_smtp_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(SMTP_HOST="")
    monkeypatch.setattr(email_service, "get_settings", lambda: settings)

    with pytest.raises(email_service.EmailDeliveryError, match="SMTP_HOST"):
        email_service.send_email(
            to_email="recipient@example.com",
            subject="Test",
            html_body="<p>Test</p>",
        )
