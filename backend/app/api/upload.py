from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.models.user import User


router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 8 * 1024 * 1024

def _detected_image_type(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"): return ".jpg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"): return ".png"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP": return ".webp"
    return None


@router.post("/image")
async def upload_image(file: UploadFile = File(...), current_user: User = Depends(get_current_user)) -> dict[str, str]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only jpg, jpeg, png and webp files are allowed")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size must be less than 8MB")
    detected = _detected_image_type(content)
    extension_matches = detected == suffix or (detected == ".jpg" and suffix == ".jpeg")
    if detected is None or not extension_matches:
        raise HTTPException(status_code=400, detail="文件内容不是有效的 JPG、PNG 或 WEBP 图片")

    settings = get_settings()
    upload_dir = settings.upload_path
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{current_user.id}_{uuid4().hex}{detected}"
    path = upload_dir / filename
    path.write_bytes(content)
    return {"image_url": f"/uploads/{filename}"}
