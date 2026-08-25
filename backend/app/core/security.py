from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import secrets
import uuid

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@dataclass(frozen=True)
class AccessTokenClaims:
    subject: str
    session_id: str


def create_access_token(subject: str, session_id: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": subject,
        "sid": session_id,
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": expire,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> AccessTokenClaims | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        session_id = payload.get("sid")
        if payload.get("type") != "access" or not isinstance(subject, str) or not isinstance(session_id, str):
            return None
        return AccessTokenClaims(subject=subject, session_id=session_id)
    except JWTError:
        return None


def create_refresh_token(session_id: str) -> str:
    return f"{session_id}.{secrets.token_urlsafe(48)}"


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_token_session_id(token: str) -> str | None:
    session_id, separator, secret = token.partition(".")
    if not separator or not secret or len(session_id) != 32:
        return None
    try:
        uuid.UUID(hex=session_id)
    except ValueError:
        return None
    return session_id
