from collections.abc import Callable
from datetime import datetime, timedelta, timezone
import hmac
import logging
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    generate_token,
    get_password_hash,
    hash_refresh_token,
    hash_token,
    refresh_token_session_id,
    verify_password,
)
from app.database import get_db
from app.models.auth import AuthSession, EmailToken
from app.models.user import User
from app.schemas.user import (
    PasswordResetConfirm,
    PasswordResetRequest,
    ResendVerificationRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserRead,
    VerifyEmailRequest,
)
from app.services.email import send_password_reset_email, send_verification_email


router = APIRouter(prefix="/auth", tags=["auth"])
SESSION_REQUEST_HEADER = "LensCoach"
logger = logging.getLogger("uvicorn.error")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _set_refresh_cookie(response: Response, token: str, expires_at: datetime, settings: Settings) -> None:
    max_age = max(0, int((_as_utc(expires_at) - _utc_now()).total_seconds()))
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=max_age,
        expires=_as_utc(expires_at),
        path="/",
        domain=settings.resolved_session_cookie_domain,
        secure=settings.session_cookie_secure,
        httponly=True,
        samesite=settings.session_cookie_samesite,
    )


def _clear_refresh_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        domain=settings.resolved_session_cookie_domain,
        secure=settings.session_cookie_secure,
        httponly=True,
        samesite=settings.session_cookie_samesite,
    )


def _require_session_header(value: str | None) -> None:
    if value != SESSION_REQUEST_HEADER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid session request")


EMAIL_VERIFICATION_PURPOSE = "email_verification"
PASSWORD_RESET_PURPOSE = "password_reset"


def _frontend_link(path: str, token: str) -> str:
    settings = get_settings()
    return f"{settings.frontend_base_url.rstrip('/')}/{path.lstrip('/')}?token={token}"


def _issue_email_token(db: Session, user: User, purpose: str, expire_minutes: int) -> str:
    token = generate_token()
    db.add(
        EmailToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_token(token),
            expires_at=_utc_now() + timedelta(minutes=expire_minutes),
        )
    )
    return token


def _deliver_account_email(
    db: Session,
    *,
    sender: Callable[[str, str], None],
    to_email: str,
    link: str,
) -> None:
    """Deliver before commit so a failed SMTP attempt cannot strand an account."""
    try:
        sender(to_email, link)
    except Exception as exc:
        db.rollback()
        logger.exception("Account email delivery failed for %s", to_email)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="邮件发送失败，请稍后重试；如果持续失败，请联系管理员",
        ) from exc


def _consume_email_token(db: Session, token: str, purpose: str) -> EmailToken | None:
    email_token = db.scalar(
        select(EmailToken)
        .where(
            EmailToken.token_hash == hash_token(token),
            EmailToken.purpose == purpose,
        )
        .with_for_update()
    )
    if not email_token or email_token.used_at is not None:
        return None
    if _as_utc(email_token.expires_at) <= _utc_now():
        return None
    return email_token


def _session_response(user: User, auth_session: AuthSession) -> TokenResponse:
    settings = get_settings()
    return TokenResponse(
        access_token=create_access_token(str(user.id), auth_session.id),
        expires_in=settings.access_token_expire_minutes * 60,
        user=user,
    )


def _expired_or_invalid_session(settings: Settings, detail: str = "Session expired or invalid") -> JSONResponse:
    response = JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": detail})
    _clear_refresh_cookie(response, settings)
    return response


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserCreate,
    db: Session = Depends(get_db),
) -> User:
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        username=payload.username.strip(),
        email=payload.email.lower(),
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.flush()
    settings = get_settings()
    token = _issue_email_token(db, user, EMAIL_VERIFICATION_PURPOSE, settings.email_verification_expire_minutes)
    _deliver_account_email(
        db,
        sender=send_verification_email,
        to_email=user.email,
        link=_frontend_link("verify-email", token),
    )
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="邮箱尚未验证，请先完成邮箱验证")

    settings = get_settings()
    session_id = uuid.uuid4().hex
    refresh_token = create_refresh_token(session_id)
    auth_session = AuthSession(
        id=session_id,
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        expires_at=_utc_now() + timedelta(days=settings.refresh_token_expire_days),
        last_used_at=_utc_now(),
    )
    db.add(auth_session)
    db.commit()
    _set_refresh_cookie(response, refresh_token, auth_session.expires_at, settings)
    return _session_response(user, auth_session)


@router.post("/refresh", response_model=TokenResponse)
def refresh_session(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    session_request: str | None = Header(default=None, alias="X-Session-Request"),
) -> TokenResponse | JSONResponse:
    _require_session_header(session_request)
    settings = get_settings()
    refresh_token = request.cookies.get(settings.session_cookie_name)
    session_id = refresh_token_session_id(refresh_token) if refresh_token else None
    if not refresh_token or not session_id:
        return _expired_or_invalid_session(settings)

    auth_session = db.scalar(select(AuthSession).where(AuthSession.id == session_id).with_for_update())
    if not auth_session or auth_session.revoked_at is not None:
        return _expired_or_invalid_session(settings)

    now = _utc_now()
    if _as_utc(auth_session.expires_at) <= now:
        auth_session.revoked_at = now
        db.commit()
        return _expired_or_invalid_session(settings, "Session expired")

    presented_hash = hash_refresh_token(refresh_token)
    is_current = hmac.compare_digest(presented_hash, auth_session.refresh_token_hash)
    previous_valid_until = auth_session.previous_token_valid_until
    is_recent_previous = bool(
        auth_session.previous_refresh_token_hash
        and hmac.compare_digest(presented_hash, auth_session.previous_refresh_token_hash)
        and previous_valid_until
        and _as_utc(previous_valid_until) > now
    )
    if not is_current and not is_recent_previous:
        # A superseded refresh token outside the short concurrency grace window
        # is treated as replay and revokes the entire session.
        auth_session.revoked_at = now
        db.commit()
        return _expired_or_invalid_session(settings, "Session security check failed")

    if is_current:
        rotated_token = create_refresh_token(auth_session.id)
        auth_session.previous_refresh_token_hash = auth_session.refresh_token_hash
        auth_session.previous_token_valid_until = now + timedelta(
            seconds=settings.refresh_token_reuse_grace_seconds
        )
        auth_session.refresh_token_hash = hash_refresh_token(rotated_token)
        _set_refresh_cookie(response, rotated_token, auth_session.expires_at, settings)

    auth_session.last_used_at = now
    user = db.get(User, auth_session.user_id)
    if not user:
        auth_session.revoked_at = now
        db.commit()
        return _expired_or_invalid_session(settings)
    db.commit()
    return _session_response(user, auth_session)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    session_request: str | None = Header(default=None, alias="X-Session-Request"),
) -> Response:
    _require_session_header(session_request)
    settings = get_settings()
    refresh_token = request.cookies.get(settings.session_cookie_name)
    cookie_session_id = refresh_token_session_id(refresh_token) if refresh_token else None
    revoked_session_ids: set[str] = set()
    if refresh_token and cookie_session_id:
        auth_session = db.scalar(select(AuthSession).where(AuthSession.id == cookie_session_id).with_for_update())
        if auth_session and auth_session.revoked_at is None:
            presented_hash = hash_refresh_token(refresh_token)
            matches_current = hmac.compare_digest(presented_hash, auth_session.refresh_token_hash)
            matches_previous = bool(
                auth_session.previous_refresh_token_hash
                and hmac.compare_digest(presented_hash, auth_session.previous_refresh_token_hash)
            )
            if matches_current or matches_previous:
                auth_session.revoked_at = _utc_now()
                revoked_session_ids.add(auth_session.id)

    authorization = request.headers.get("Authorization", "")
    scheme, _, access_token = authorization.partition(" ")
    claims = decode_access_token(access_token) if scheme.lower() == "bearer" and access_token else None
    if claims and claims.session_id not in revoked_session_ids:
        auth_session = db.scalar(select(AuthSession).where(AuthSession.id == claims.session_id).with_for_update())
        if auth_session and auth_session.revoked_at is None and str(auth_session.user_id) == claims.subject:
            auth_session.revoked_at = _utc_now()

    db.commit()

    response.status_code = status.HTTP_204_NO_CONTENT
    _clear_refresh_cookie(response, settings)
    return response


@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    email_token = _consume_email_token(db, payload.token, EMAIL_VERIFICATION_PURPOSE)
    if not email_token:
        raise HTTPException(status_code=400, detail="验证链接无效或已过期")
    user = db.get(User, email_token.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="用户不存在")
    user.email_verified = True
    email_token.used_at = _utc_now()
    db.commit()
    return {"detail": "邮箱验证成功"}


@router.post("/resend-verification")
def resend_verification(
    payload: ResendVerificationRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user and not user.email_verified:
        settings = get_settings()
        token = _issue_email_token(db, user, EMAIL_VERIFICATION_PURPOSE, settings.email_verification_expire_minutes)
        _deliver_account_email(
            db,
            sender=send_verification_email,
            to_email=user.email,
            link=_frontend_link("verify-email", token),
        )
        db.commit()
    return {"detail": "如果该邮箱尚未验证，我们已重新发送验证邮件"}


@router.post("/password-reset/request")
def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user:
        settings = get_settings()
        token = _issue_email_token(db, user, PASSWORD_RESET_PURPOSE, settings.password_reset_expire_minutes)
        _deliver_account_email(
            db,
            sender=send_password_reset_email,
            to_email=user.email,
            link=_frontend_link("reset-password", token),
        )
        db.commit()
    return {"detail": "如果该邮箱已注册，我们已发送密码重置链接"}


@router.post("/password-reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirm, db: Session = Depends(get_db)) -> dict[str, str]:
    email_token = _consume_email_token(db, payload.token, PASSWORD_RESET_PURPOSE)
    if not email_token:
        raise HTTPException(status_code=400, detail="重置链接无效或已过期")
    user = db.get(User, email_token.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="用户不存在")
    user.hashed_password = get_password_hash(payload.new_password)
    email_token.used_at = _utc_now()
    now = _utc_now()
    db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.commit()
    return {"detail": "密码已重置，请使用新密码登录"}


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
