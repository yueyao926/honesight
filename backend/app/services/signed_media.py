from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from pathlib import Path

from app.core.config import get_settings
from app.services.image_storage import local_upload_path


TOKEN_TTL_SECONDS = 10 * 60


def build_ai_media_url(image_url: str) -> str | None:
    settings = get_settings()
    public_base = settings.resolved_ai_public_api_base_url
    path = local_upload_path(image_url, settings.upload_path)
    if not public_base or not path or not path.is_file():
        return None
    relative = path.relative_to(settings.upload_path.resolve()).as_posix()
    payload = {
        "path": relative,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    encoded = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _signature(encoded, settings.jwt_secret_key)
    return f"{public_base}/upload/ai-media/{encoded}.{signature}"


def resolve_ai_media_token(token: str) -> Path | None:
    settings = get_settings()
    try:
        encoded, supplied_signature = token.rsplit(".", 1)
    except ValueError:
        return None
    expected_signature = _signature(encoded, settings.jwt_secret_key)
    if not hmac.compare_digest(supplied_signature, expected_signature):
        return None
    try:
        payload = json.loads(_b64decode(encoded))
        expires_at = int(payload["exp"])
        relative = str(payload["path"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None
    if expires_at < int(time.time()):
        return None
    return local_upload_path(f"/uploads/{relative}", settings.upload_path)


def _signature(value: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), value.encode("ascii"), hashlib.sha256).digest()
    return _b64encode(digest)


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")
