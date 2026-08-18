import logging
import time
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.models.user import User
from app.services.image_storage import (
    ANALYSIS_IMAGE_MAX_BYTES,
    ANALYSIS_IMAGE_SIZE,
    REFERENCE_IMAGE_MAX_BYTES,
    REFERENCE_IMAGE_SIZE,
    ImageProcessingError,
    store_image,
    upload_url,
)
from app.services.signed_media import resolve_ai_media_token


router = APIRouter(prefix="/upload", tags=["upload"])
logger = logging.getLogger("uvicorn.error")

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024
UPLOAD_PURPOSES = {"standard", "reference", "analysis", "practice", "portfolio", "community"}


@router.get("/ai-media/{token}", response_class=FileResponse, include_in_schema=False)
def read_ai_media(token: str) -> FileResponse:
    path = resolve_ai_media_token(token)
    if not path or not path.is_file():
        raise HTTPException(status_code=404, detail="图片地址无效或已过期")
    return FileResponse(path, headers={"Cache-Control": "private, max-age=600"})

def _detected_image_type(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"): return ".jpg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"): return ".png"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP": return ".webp"
    return None


@router.post("/image")
async def upload_image(
    response: Response,
    file: UploadFile = File(...),
    purpose: str = Form("standard"),
    current_user: User = Depends(get_current_user),
) -> dict[str, str | int]:
    started_at = time.perf_counter()
    if purpose not in UPLOAD_PURPOSES:
        raise HTTPException(status_code=400, detail="Unsupported image upload purpose")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only jpg, jpeg, png and webp files are allowed")

    read_started_at = time.perf_counter()
    content = await file.read(MAX_FILE_SIZE + 1)
    read_ms = int(round((time.perf_counter() - read_started_at) * 1000))
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size must be less than 10MB")
    detected = _detected_image_type(content)
    extension_matches = detected == suffix or (detected == ".jpg" and suffix == ".jpeg")
    if detected is None or not extension_matches:
        raise HTTPException(status_code=400, detail="文件内容不是有效的 JPG、PNG 或 WEBP 图片")

    settings = get_settings()
    upload_dir = settings.upload_path / purpose
    upload_dir.mkdir(parents=True, exist_ok=True)
    try:
        options = {"create_thumbnail": True}
        if purpose == "reference":
            options = {
                "max_size": REFERENCE_IMAGE_SIZE,
                "max_bytes": REFERENCE_IMAGE_MAX_BYTES,
                "quality": 82,
                "create_thumbnail": False,
            }
        elif purpose == "analysis":
            options = {
                "max_size": ANALYSIS_IMAGE_SIZE,
                "max_bytes": ANALYSIS_IMAGE_MAX_BYTES,
                "quality": 80,
                "create_thumbnail": False,
            }
        process_started_at = time.perf_counter()
        stored = await run_in_threadpool(
            store_image,
            content,
            upload_dir,
            f"{current_user.id}_{uuid4().hex}",
            **options,
        )
        process_ms = int(round((time.perf_counter() - process_started_at) * 1000))
    except ImageProcessingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    image_url = upload_url(stored.image_path, settings.upload_path)
    total_ms = int(round((time.perf_counter() - started_at) * 1000))
    response.headers["Server-Timing"] = f"read;dur={read_ms}, image;dur={process_ms}, total;dur={total_ms}"
    logger.info(
        "image_upload purpose=%s input_bytes=%s output_bytes=%s read_ms=%s process_ms=%s total_ms=%s",
        purpose,
        len(content),
        stored.image_path.stat().st_size,
        read_ms,
        process_ms,
        total_ms,
    )
    return {
        "image_url": image_url,
        "thumbnail_url": upload_url(stored.thumbnail_path, settings.upload_path) if stored.thumbnail_path else image_url,
        "width": stored.width,
        "height": stored.height,
    }
