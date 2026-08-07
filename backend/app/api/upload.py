from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.models.user import User
from app.services.image_storage import ImageProcessingError, store_image, upload_url


router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 8 * 1024 * 1024

def _detected_image_type(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"): return ".jpg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"): return ".png"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP": return ".webp"
    return None


@router.post("/image")
async def upload_image(file: UploadFile = File(...), current_user: User = Depends(get_current_user)) -> dict[str, str | int]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only jpg, jpeg, png and webp files are allowed")

    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size must be less than 8MB")
    detected = _detected_image_type(content)
    extension_matches = detected == suffix or (detected == ".jpg" and suffix == ".jpeg")
    if detected is None or not extension_matches:
        raise HTTPException(status_code=400, detail="文件内容不是有效的 JPG、PNG 或 WEBP 图片")

    settings = get_settings()
    upload_dir = settings.upload_path
    upload_dir.mkdir(parents=True, exist_ok=True)
    try:
        stored = await run_in_threadpool(
            store_image,
            content,
            upload_dir,
            f"{current_user.id}_{uuid4().hex}",
            create_thumbnail=True,
        )
    except ImageProcessingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "image_url": upload_url(stored.image_path, upload_dir),
        "thumbnail_url": upload_url(stored.thumbnail_path, upload_dir) if stored.thumbnail_path else "",
        "width": stored.width,
        "height": stored.height,
    }
