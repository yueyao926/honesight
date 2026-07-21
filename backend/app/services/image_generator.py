from __future__ import annotations

import base64
import mimetypes
from uuid import uuid4

import httpx

from app.core.config import get_settings


class ImageGenerationError(RuntimeError):
    pass


def generate_edited_image(
    *,
    image_url: str,
    user_id: int,
    target_style: str,
    target_platform: str,
    analysis_guidance: str | None = None,
    edit_instruction: str | None = None,
    reference_image_urls: list[str] | None = None,
) -> dict[str, str]:
    settings = get_settings()
    if not settings.image_generation_enabled:
        raise ImageGenerationError("服务器尚未开启真实图片生成功能")
    if not settings.resolved_image_api_key:
        raise ImageGenerationError("服务器尚未配置图片生成 API Key")

    source_image = _resolve_image_input(image_url)
    if not source_image:
        raise ImageGenerationError("找不到待处理的原图")

    images = [source_image]
    for reference_url in (reference_image_urls or [])[:3]:
        resolved = _resolve_image_input(reference_url)
        if resolved:
            images.append(resolved)

    prompt = _build_edit_prompt(
        target_style,
        target_platform,
        edit_instruction,
        analysis_guidance,
        len(images) - 1,
    )
    payload = {
        "model": settings.image_model,
        "prompt": prompt,
        "image": images[0] if len(images) == 1 else images,
        "size": settings.image_size,
        "sequential_image_generation": "disabled",
        "stream": False,
        "response_format": "url",
        "watermark": settings.image_watermark,
    }

    try:
        with httpx.Client(timeout=settings.image_timeout_seconds) as client:
            response = client.post(
                f"{settings.resolved_image_base_url}/images/generations",
                headers={
                    "Authorization": f"Bearer {settings.resolved_image_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        detail = _safe_provider_error(exc.response)
        raise ImageGenerationError(f"图片生成服务返回错误：{detail}") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise ImageGenerationError("无法连接图片生成服务，请稍后重试") from exc

    generated_url = _extract_generated_url(data)
    if not generated_url:
        raise ImageGenerationError("图片生成服务没有返回可用图片")

    local_url = _download_generated_image(generated_url, user_id)
    return {
        "image_url": local_url,
        "model": settings.image_model,
        "prompt": prompt,
    }


def _build_edit_prompt(
    target_style: str,
    target_platform: str,
    edit_instruction: str | None,
    analysis_guidance: str | None,
    reference_count: int,
) -> str:
    parts = [
        "对第一张原始照片进行专业摄影后期处理。",
        "必须保留原图人物身份、五官、主体、姿势、场景结构和画面构图，不新增或删除主体。",
        f"将整体视觉调整为「{target_style}」风格，优化曝光、白平衡、色彩层次、肤色和质感。",
        "效果自然真实，避免过度磨皮、塑料感、文字、边框和水印。",
    ]
    if reference_count:
        parts.append("后续图片是风格参考图，请只参考其色调、光影和氛围，不要替换原图主体。")
    parts.append(
        f"Selected publishing platform: {target_platform}. "
        "Adapt tonal balance, subject emphasis, visual rhythm, and finish for this platform. "
        "Do not add text, logos, borders, or watermarks."
    )
    if analysis_guidance and analysis_guidance.strip():
        parts.append(
            f"Vision analysis guidance for this exact photo: {analysis_guidance.strip()}"
        )
    if edit_instruction and edit_instruction.strip():
        parts.append(f"用户额外要求：{edit_instruction.strip()}")
    return "".join(parts)


def _resolve_image_input(image_url: str) -> str | None:
    if image_url.startswith(("http://", "https://", "data:")):
        return image_url
    settings = get_settings()
    relative = image_url.removeprefix("/uploads/").lstrip("/\\")
    path = (settings.upload_path / relative).resolve()
    upload_root = settings.upload_path.resolve()
    if upload_root not in path.parents or not path.is_file():
        return None
    mime_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _extract_generated_url(data: object) -> str | None:
    if not isinstance(data, dict):
        return None
    items = data.get("data")
    if not isinstance(items, list) or not items or not isinstance(items[0], dict):
        return None
    url = items[0].get("url")
    return url if isinstance(url, str) and url.startswith("https://") else None


def _download_generated_image(url: str, user_id: int) -> str:
    settings = get_settings()
    try:
        with httpx.Client(timeout=settings.image_timeout_seconds, follow_redirects=True) as client:
            response = client.get(url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ImageGenerationError("图片已生成，但下载保存失败，请重试") from exc

    suffix = _detect_image_suffix(
        response.headers.get("content-type", "").split(";", 1)[0].lower(),
        response.content,
    )
    if not suffix or not response.content:
        raise ImageGenerationError("图片生成服务返回了不支持的文件格式")
    if len(response.content) > 20 * 1024 * 1024:
        raise ImageGenerationError("生成图片超过 20MB，无法保存")

    settings.upload_path.mkdir(parents=True, exist_ok=True)
    filename = f"{user_id}_generated_{uuid4().hex}{suffix}"
    (settings.upload_path / filename).write_bytes(response.content)
    return f"/uploads/{filename}"


def _detect_image_suffix(content_type: str, content: bytes) -> str | None:
    suffixes = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    if content_type in suffixes:
        return suffixes[content_type]
    if content.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return ".webp"
    return None


def _safe_provider_error(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return f"HTTP {response.status_code}"
    if isinstance(data, dict):
        error = data.get("error")
        if isinstance(error, dict) and isinstance(error.get("message"), str):
            return error["message"][:300]
        if isinstance(data.get("message"), str):
            return data["message"][:300]
    return f"HTTP {response.status_code}"
