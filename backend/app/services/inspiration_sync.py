import logging
from dataclasses import asdict, dataclass
from datetime import date

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.inspiration import DailyInspirationRecommendation, InspirationPhoto
from app.services.photo_providers import ProviderPhoto, UnsplashProvider
from app.services.inspiration_content import CONTENT_VERSION, build_content


logger = logging.getLogger(__name__)


@dataclass
class TopicSyncResult:
    topic: str
    received: int = 0
    created: int = 0
    error: str | None = None


@dataclass
class InspirationSyncResult:
    received: int
    created: int
    topics: list[TopicSyncResult]

    def to_dict(self) -> dict:
        return {"received": self.received, "created": self.created, "topics": [asdict(item) for item in self.topics]}


@dataclass(frozen=True)
class ContentBackfillResult:
    pending: int
    updated: int
    cleared_recommendations: int


def add_provider_photos(db: Session, photos: list[ProviderPhoto]) -> int:
    created = 0
    for data in photos:
        content = build_content(data)
        try:
            with db.begin_nested():
                db.add(InspirationPhoto(
                    **asdict(data),
                    poetic_caption=content.poetic_caption,
                    appreciation_summary=content.appreciation_summary,
                    content_version=CONTENT_VERSION,
                ))
                db.flush()
            created += 1
        except IntegrityError:
            # The database unique constraint is the final guard when schedulers overlap.
            continue
    db.commit()
    return created


def count_outdated_content(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(InspirationPhoto).where(
        InspirationPhoto.source_type.in_(("unsplash", "openverse")),
        InspirationPhoto.content_version < CONTENT_VERSION,
    )) or 0


def backfill_outdated_content(
    db: Session,
    *,
    batch_size: int = 200,
    reset_date: date | None = None,
) -> ContentBackfillResult:
    """Regenerate outdated provider copy in bounded, restart-safe batches."""
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1")

    pending = count_outdated_content(db)
    updated = 0
    while True:
        photos = list(db.scalars(select(InspirationPhoto).where(
            InspirationPhoto.source_type.in_(("unsplash", "openverse")),
            InspirationPhoto.content_version < CONTENT_VERSION,
        ).order_by(InspirationPhoto.id).limit(batch_size)))
        if not photos:
            break
        for photo in photos:
            content = build_content(photo)
            photo.poetic_caption = content.poetic_caption
            photo.appreciation_summary = content.appreciation_summary
            photo.content_version = CONTENT_VERSION
        db.commit()
        updated += len(photos)

    target_date = reset_date or date.today()
    result = db.execute(delete(DailyInspirationRecommendation).where(
        DailyInspirationRecommendation.recommendation_date == target_date
    ))
    db.commit()
    return ContentBackfillResult(
        pending=pending,
        updated=updated,
        cleared_recommendations=result.rowcount or 0,
    )


async def sync_unsplash_topics(db: Session, topics: list[str] | None = None, per_topic: int | None = None) -> InspirationSyncResult:
    settings = get_settings()
    selected_topics = topics or settings.inspiration_topics
    selected_count = min(max(per_topic or settings.inspiration_sync_per_topic, 1), 200)
    provider = UnsplashProvider()
    results: list[TopicSyncResult] = []
    for topic in selected_topics:
        item = TopicSyncResult(topic=topic)
        try:
            photos = await provider.search(topic, selected_count)
            item.received = len(photos)
            item.created = add_provider_photos(db, photos)
        except Exception as exc:
            db.rollback()
            item.error = type(exc).__name__
            logger.warning("Inspiration sync failed for topic %s: %s", topic, type(exc).__name__)
        results.append(item)

    result = InspirationSyncResult(
        received=sum(item.received for item in results),
        created=sum(item.created for item in results),
        topics=results,
    )
    logger.info("Inspiration sync finished: received=%s created=%s", result.received, result.created)
    return result
