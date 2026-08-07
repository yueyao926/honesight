from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError


Image.MAX_IMAGE_PIXELS = 60_000_000

SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}
FULL_IMAGE_SIZE = (2560, 2560)
FULL_IMAGE_MAX_BYTES = 1536 * 1024
THUMBNAIL_SIZE = (720, 720)
THUMBNAIL_MAX_BYTES = 300 * 1024
AVATAR_SIZE = (512, 512)
AVATAR_MAX_BYTES = 200 * 1024
MESSAGE_IMAGE_SIZE = (1600, 1600)
MESSAGE_IMAGE_MAX_BYTES = 1024 * 1024


class ImageProcessingError(ValueError):
    pass


@dataclass(frozen=True)
class StoredImage:
    image_path: Path
    width: int
    height: int
    thumbnail_path: Path | None = None


def _decode_image(content: bytes) -> Image.Image:
    try:
        with Image.open(BytesIO(content)) as source:
            if source.format not in SUPPORTED_FORMATS:
                raise ImageProcessingError("仅支持 JPG、PNG 和 WebP 图片")
            if source.width * source.height > Image.MAX_IMAGE_PIXELS:
                raise ImageProcessingError("图片像素过高，请将图片缩小后重试")
            source.verify()

        with Image.open(BytesIO(content)) as source:
            source.seek(0)
            image = ImageOps.exif_transpose(source)
            has_alpha = image.mode in {"RGBA", "LA"} or (
                image.mode == "P" and "transparency" in image.info
            )
            return image.convert("RGBA" if has_alpha else "RGB")
    except ImageProcessingError:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageProcessingError("图片内容无效或已经损坏") from exc


def _encode_webp(
    source: Image.Image,
    *,
    max_size: tuple[int, int],
    max_bytes: int,
    initial_quality: int,
) -> tuple[bytes, int, int]:
    image = source.copy()
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    quality = initial_quality

    while True:
        output = BytesIO()
        image.save(output, format="WEBP", quality=quality, method=4, exact=True)
        encoded = output.getvalue()
        if len(encoded) <= max_bytes:
            return encoded, image.width, image.height

        if quality > 55:
            quality -= 5
            continue

        next_width = max(1, int(image.width * 0.85))
        next_height = max(1, int(image.height * 0.85))
        if (next_width, next_height) == image.size:
            return encoded, image.width, image.height
        image = image.resize((next_width, next_height), Image.Resampling.LANCZOS)
        quality = min(initial_quality, 75)


def store_image(
    content: bytes,
    upload_dir: Path,
    stem: str,
    *,
    max_size: tuple[int, int] = FULL_IMAGE_SIZE,
    max_bytes: int = FULL_IMAGE_MAX_BYTES,
    quality: int = 85,
    create_thumbnail: bool = False,
) -> StoredImage:
    image = _decode_image(content)
    upload_dir.mkdir(parents=True, exist_ok=True)

    encoded, width, height = _encode_webp(
        image,
        max_size=max_size,
        max_bytes=max_bytes,
        initial_quality=quality,
    )
    image_path = upload_dir / f"{stem}.webp"
    thumbnail_path: Path | None = None

    try:
        image_path.write_bytes(encoded)
        if create_thumbnail:
            thumbnail, _, _ = _encode_webp(
                image,
                max_size=THUMBNAIL_SIZE,
                max_bytes=THUMBNAIL_MAX_BYTES,
                initial_quality=78,
            )
            thumbnail_path = upload_dir / f"{stem}_thumb.webp"
            thumbnail_path.write_bytes(thumbnail)
    except OSError as exc:
        image_path.unlink(missing_ok=True)
        if thumbnail_path:
            thumbnail_path.unlink(missing_ok=True)
        raise ImageProcessingError("图片保存失败，请稍后重试") from exc
    finally:
        image.close()

    return StoredImage(
        image_path=image_path,
        thumbnail_path=thumbnail_path,
        width=width,
        height=height,
    )


def upload_url(path: Path, upload_root: Path) -> str:
    try:
        relative = path.resolve().relative_to(upload_root.resolve())
    except ValueError as exc:
        raise ImageProcessingError("图片保存路径无效") from exc
    return f"/uploads/{relative.as_posix()}"


def local_upload_path(image_url: str, upload_root: Path) -> Path | None:
    if not image_url.startswith("/uploads/"):
        return None
    relative = image_url.removeprefix("/uploads/").lstrip("/\\")
    path = (upload_root / relative).resolve()
    root = upload_root.resolve()
    if root not in path.parents:
        return None
    return path


def thumbnail_url_for(image_url: str, upload_root: Path) -> str | None:
    image_path = local_upload_path(image_url, upload_root)
    if not image_path:
        return None
    thumbnail_path = image_path.with_name(f"{image_path.stem}_thumb.webp")
    if not thumbnail_path.is_file():
        return None
    return upload_url(thumbnail_path, upload_root)


def delete_local_upload(image_url: str | None, upload_root: Path) -> None:
    if not image_url:
        return
    path = local_upload_path(image_url, upload_root)
    if path and path.is_file():
        path.unlink(missing_ok=True)
    if path:
        path.with_name(f"{path.stem}_thumb.webp").unlink(missing_ok=True)
