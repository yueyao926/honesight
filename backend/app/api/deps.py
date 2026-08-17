from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.auth import AuthSession
from app.models.user import User


bearer_scheme = HTTPBearer(auto_error=False)


def _claim_user_id(subject: str) -> int | None:
    try:
        return int(subject)
    except (TypeError, ValueError):
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    claims = decode_access_token(credentials.credentials)
    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = _claim_user_id(claims.subject)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    auth_session = db.scalar(
        select(AuthSession).where(
            AuthSession.id == claims.session_id,
            AuthSession.user_id == user_id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
    )
    if not auth_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or revoked")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    claims = decode_access_token(credentials.credentials)
    if not claims:
        return None
    user_id = _claim_user_id(claims.subject)
    if user_id is None:
        return None
    auth_session = db.scalar(
        select(AuthSession).where(
            AuthSession.id == claims.session_id,
            AuthSession.user_id == user_id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
    )
    return db.get(User, user_id) if auth_session else None
