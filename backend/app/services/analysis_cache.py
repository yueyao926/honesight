from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.analysis import AnalysisCache
from app.models.preference import Preference
from app.services.image_storage import local_upload_path


logger = logging.getLogger("uvicorn.error")
CACHE_SCHEMA_VERSION = "analysis-cache-v2"


def build_analysis_cache_key(
    *,
    profile: str,
    image_url: str,
    user_id: int,
    preference: Preference | None = None,
    style_reference_urls: list[str] | None = None,
    parameters: dict[str, Any] | None = None,
    model: str | None = None,
) -> str:
    settings = get_settings()
    payload = {
        "schema": CACHE_SCHEMA_VERSION,
        "profile": profile,
        "user_id": user_id,
        "image": _image_fingerprint(image_url),
        "references": [_image_fingerprint(url) for url in style_reference_urls or []],
        "preference": _preference_snapshot(preference),
        "parameters": parameters or {},
        "mode": settings.ai_analysis_mode.strip().lower(),
        "model": model or settings.resolved_ai_model,
    }
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def get_cached_analysis(db: Session, user_id: int, cache_key: str) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc)
    row = db.scalar(
        select(AnalysisCache).where(
            AnalysisCache.user_id == user_id,
            AnalysisCache.cache_key == cache_key,
            AnalysisCache.expires_at > now,
        )
    )
    if not row:
        logger.info("analysis_cache miss profile=unknown key=%s", cache_key[:12])
        return None
    try:
        parsed = json.loads(row.result_json)
    except json.JSONDecodeError:
        db.delete(row)
        return None
    if not isinstance(parsed, dict):
        db.delete(row)
        return None
    logger.info("analysis_cache hit profile=%s key=%s", row.profile, cache_key[:12])
    return parsed


def cache_analysis(
    db: Session,
    *,
    user_id: int,
    cache_key: str,
    profile: str,
    report: dict[str, Any],
    model_used: str,
) -> None:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=max(1, settings.analysis_cache_ttl_hours)
    )
    row = db.scalar(
        select(AnalysisCache).where(
            AnalysisCache.user_id == user_id,
            AnalysisCache.cache_key == cache_key,
        )
    )
    serialized = json.dumps(report, ensure_ascii=False, default=str)
    if row:
        row.profile = profile
        row.result_json = serialized
        row.model_used = model_used
        row.expires_at = expires_at
    else:
        db.add(
            AnalysisCache(
                user_id=user_id,
                cache_key=cache_key,
                profile=profile,
                result_json=serialized,
                model_used=model_used,
                expires_at=expires_at,
            )
        )


def run_cached_analysis(
    db: Session,
    *,
    user_id: int,
    cache_key: str,
    profile: str,
    model_used: str,
    analyze: Callable[[], dict[str, Any]],
) -> tuple[dict[str, Any], bool]:
    cached = get_cached_analysis(db, user_id, cache_key)
    if cached is not None:
        return cached, True
    report = analyze()
    cache_analysis(
        db,
        user_id=user_id,
        cache_key=cache_key,
        profile=profile,
        report=report,
        model_used=model_used,
    )
    return report, False


def _image_fingerprint(image_url: str) -> str:
    settings = get_settings()
    path = local_upload_path(image_url, settings.upload_path)
    if not path or not path.is_file():
        return f"url:{hashlib.sha256(image_url.encode('utf-8')).hexdigest()}"
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def _preference_snapshot(preference: Preference | None) -> dict[str, Any]:
    if not preference:
        return {}
    fields = (
        "skill_level",
        "preferred_styles",
        "common_subjects",
        "improvement_goals",
        "editing_tools",
        "target_platform",
        "device_type",
    )
    return {field: getattr(preference, field, None) for field in fields}
