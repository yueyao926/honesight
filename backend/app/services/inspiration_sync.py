import logging
from dataclasses import asdict, dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.inspiration import InspirationPhoto
from app.services.photo_providers import ProviderPhoto, UnsplashProvider


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


def add_provider_photos(db: Session, photos: list[ProviderPhoto]) -> int:
    created = 0
    for data in photos:
        try:
            with db.begin_nested():
                db.add(InspirationPhoto(
                    **asdict(data),
                    poetic_caption="光线经过的地方，日常也有了新的轮廓。",
                    appreciation_summary="从主体与环境的关系进入画面，感受摄影师如何组织观看。",
                ))
                db.flush()
            created += 1
        except IntegrityError:
            # The database unique constraint is the final guard when schedulers overlap.
            continue
    db.commit()
    return created


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
