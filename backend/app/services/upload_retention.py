from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.analysis import AnalysisJob
from app.models.community import CommunityPost, PostImage
from app.models.messaging import DirectMessage
from app.models.portfolio import PortfolioItem
from app.models.practice import PracticeAttempt, PracticeProgress, PracticeSession
from app.models.user import User
from app.services.image_storage import upload_url


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class UploadCleanupResult:
    files_deleted: int = 0
    bytes_deleted: int = 0
    files_retained: int = 0


def cleanup_expired_uploads(
    db: Session,
    *,
    now: datetime | None = None,
    settings: Settings | None = None,
    upload_root: Path | None = None,
) -> UploadCleanupResult:
    """Delete expired local uploads only when no live product feature needs them."""
    active_settings = settings or get_settings()
    root = (upload_root or active_settings.upload_path).resolve()
    if not root.exists():
        return UploadCleanupResult()

    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    protected_urls = _protected_upload_urls(
        db,
        practice_cutoff=current_time - timedelta(days=max(active_settings.practice_image_retention_days, 1)),
    )

    deleted = 0
    deleted_bytes = 0
    retained = 0
    for path, retention in _cleanup_candidates(root, current_time, active_settings):
        try:
            stat = path.stat()
        except OSError:
            continue
        modified_at = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
        if modified_at > current_time - retention:
            continue
        try:
            image_url = upload_url(path, root)
        except ValueError:
            continue
        if image_url in protected_urls:
            retained += 1
            continue
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logger.warning("Unable to remove expired upload: %s", path)
            continue
        deleted += 1
        deleted_bytes += stat.st_size

    return UploadCleanupResult(deleted, deleted_bytes, retained)


def _cleanup_candidates(
    root: Path,
    now: datetime,
    settings: Settings,
) -> Iterable[tuple[Path, timedelta]]:
    del now  # Kept in the signature to make time-based policy calls explicit.
    policies = {
        "analysis": timedelta(hours=max(settings.analysis_image_retention_hours, 1)),
        "reference": timedelta(hours=max(settings.analysis_image_retention_hours, 1)),
        "generated": timedelta(hours=max(settings.generated_image_retention_hours, 1)),
        "practice": timedelta(days=max(settings.practice_image_retention_days, 1)),
        "standard": timedelta(hours=max(settings.orphan_image_retention_hours, 1)),
        "portfolio": timedelta(hours=max(settings.orphan_image_retention_hours, 1)),
        "community": timedelta(hours=max(settings.orphan_image_retention_hours, 1)),
    }
    seen: set[Path] = set()
    for folder, retention in policies.items():
        base = root / folder
        if not base.is_dir():
            continue
        for path in base.rglob("*.webp"):
            resolved = path.resolve()
            if resolved not in seen and root in resolved.parents:
                seen.add(resolved)
                yield resolved, retention

    # Older deployments stored general uploads directly in the root. They are
    # safe to clean once unreferenced; avatar and message subdirectories are not scanned here.
    orphan_retention = timedelta(hours=max(settings.orphan_image_retention_hours, 1))
    generated_retention = timedelta(hours=max(settings.generated_image_retention_hours, 1))
    for path in root.glob("*.webp"):
        resolved = path.resolve()
        if resolved in seen:
            continue
        retention = generated_retention if "_generated_" in path.name else orphan_retention
        yield resolved, retention


def _protected_upload_urls(db: Session, *, practice_cutoff: datetime) -> set[str]:
    protected: set[str] = set()

    def add(value: object) -> None:
        if isinstance(value, str) and value.startswith("/uploads/"):
            protected.add(value)

    for image_url, thumbnail_url in db.execute(
        select(PortfolioItem.image_url, PortfolioItem.thumbnail_url)
    ):
        add(image_url)
        add(thumbnail_url)

    for image_url, thumbnail_url in db.execute(
        select(PostImage.image_url, PostImage.thumbnail_url)
        .join(CommunityPost, CommunityPost.id == PostImage.post_id)
        .where(CommunityPost.deleted_at.is_(None), CommunityPost.status.in_(("draft", "published")))
    ):
        add(image_url)
        add(thumbnail_url)

    for value in db.scalars(select(User.avatar_url).where(User.avatar_url.is_not(None))):
        add(value)
    for value in db.scalars(
        select(DirectMessage.image_url).where(
            DirectMessage.image_url.is_not(None), DirectMessage.status != "deleted"
        )
    ):
        add(value)

    live_practice = or_(
        PracticeSession.completed_at >= practice_cutoff,
        (PracticeSession.status != "completed") & (PracticeSession.updated_at >= practice_cutoff),
    )
    protected_session_ids = set(db.scalars(select(PracticeSession.id).where(live_practice)))
    progress_rows = list(
        db.scalars(
            select(PracticeProgress).where(
                or_(
                    PracticeProgress.cycle_week != 1,
                    PracticeProgress.cycle_source_image_url.is_not(None),
                    and_(
                        PracticeProgress.completed_count > 0,
                        PracticeProgress.last_practiced_at >= practice_cutoff,
                    ),
                )
            )
        )
    )
    for progress in progress_rows:
        add(progress.cycle_source_image_url)
        protected_session_ids.update(
            db.scalars(
                select(PracticeSession.id)
                .where(
                    PracticeSession.user_id == progress.user_id,
                    PracticeSession.category == progress.category,
                    PracticeSession.skill_focus == progress.ability,
                    PracticeSession.status == "completed",
                )
                .order_by(PracticeSession.completed_at.desc())
                # Eight covers the just-finished four-week cycle plus a new
                # cycle that may already have started during the 30-day grace period.
                .limit(8)
            )
        )

    if protected_session_ids:
        for value in db.scalars(
            select(PracticeSession.source_image_url).where(
                PracticeSession.id.in_(protected_session_ids)
            )
        ):
            add(value)
    for image_url, image_urls_json in db.execute(
        select(PracticeAttempt.image_url, PracticeAttempt.image_urls_json)
        .where(PracticeAttempt.session_id.in_(protected_session_ids))
    ):
        add(image_url)
        for value in _json_upload_urls(image_urls_json):
            add(value)

    for request_json in db.scalars(
        select(AnalysisJob.request_json).where(
            AnalysisJob.status.in_(("queued", "processing", "running"))
        )
    ):
        for value in _json_upload_urls(request_json):
            add(value)
    return protected


def _json_upload_urls(value: str | None) -> list[str]:
    try:
        parsed = json.loads(value or "")
    except (TypeError, json.JSONDecodeError):
        return []
    found: list[str] = []

    def walk(item: object) -> None:
        if isinstance(item, str):
            if item.startswith("/uploads/"):
                found.append(item)
        elif isinstance(item, list):
            for child in item:
                walk(child)
        elif isinstance(item, dict):
            for child in item.values():
                walk(child)

    walk(parsed)
    return found
