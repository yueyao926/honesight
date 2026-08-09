import asyncio
import logging

from app.core.config import get_settings
from app.database import SessionLocal
from app.services.inspiration_sync import sync_unsplash_topics


logger = logging.getLogger(__name__)


async def run_inspiration_sync_loop() -> None:
    settings = get_settings()
    if not settings.inspiration_sync_enabled or not settings.unsplash_access_key:
        logger.info("Automatic inspiration sync is disabled or Unsplash is not configured")
        return

    await asyncio.sleep(max(settings.inspiration_sync_startup_delay_seconds, 0))
    interval_seconds = max(settings.inspiration_sync_interval_hours, 1) * 3600

    while True:
        try:
            with SessionLocal() as db:
                await sync_unsplash_topics(db)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Automatic inspiration sync failed: %s", type(exc).__name__)
        await asyncio.sleep(interval_seconds)
