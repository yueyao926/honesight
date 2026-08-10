import asyncio
import logging

from app.core.config import get_settings
from app.database import SessionLocal
from app.services.upload_retention import cleanup_expired_uploads


logger = logging.getLogger(__name__)


def _run_cleanup_once() -> None:
    with SessionLocal() as db:
        result = cleanup_expired_uploads(db)
    if result.files_deleted:
        logger.info(
            "Expired upload cleanup removed %s files (%s bytes); %s referenced files retained",
            result.files_deleted,
            result.bytes_deleted,
            result.files_retained,
        )


async def run_upload_cleanup_loop() -> None:
    settings = get_settings()
    if not settings.upload_cleanup_enabled:
        logger.info("Automatic upload cleanup is disabled")
        return

    await asyncio.sleep(max(settings.upload_cleanup_startup_delay_seconds, 0))
    interval_seconds = max(settings.upload_cleanup_interval_hours, 1) * 3600
    while True:
        try:
            await asyncio.to_thread(_run_cleanup_once)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Automatic upload cleanup failed: %s", type(exc).__name__)
        await asyncio.sleep(interval_seconds)
