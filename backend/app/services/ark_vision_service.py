from __future__ import annotations

import base64
import json
import mimetypes
from pathlib import Path
from typing import Any

import httpx

from app.core.config import get_settings
from app.models.portfolio import PortfolioItem
from app.models.preference import Preference


def build_ai_analysis_report(item: PortfolioItem, preference: Preference | None) -> dict[str, str] | None:
    settings = get_settings()
    if not settings.ai_analysis_enabled or not settings.ark_api_key:
        return None

    image_url = _resolve_image_input(item.image_url)
    if not image_url:
        return None

    prompt = _build_prompt(item, preference)
    payload = {
        "model": settings.ark_vision_model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_image", "image_url": image_url},
                    {"type": "input_text", "text": prompt},
                ],
            }
        ],
    }

    headers = {
        "Authorization": f"Bearer {settings.ark_api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=45) as client:
            response = client.post(settings.ark_api_url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception:
        return None

    text = _extract_response_text(data)
    parsed = _parse_json_object(text)
    if not parsed:
        return None

    editing_params = parsed.get("editing_params") or {}
    if not isinstance(editing_params, dict):
        editing_params = {}

    return {
        "summary": str(parsed.get("summary") or "这张照片已经完成视觉识别，但模型没有返回完整总体评价。"),
        "composition_advice": str(parsed.get("composition_advice") or "建议进一步明确主体位置，并减少画面边缘干扰。"),
        "lighting_advice": str(parsed.get("lighting_advice") or "建议优先保证主体光线稳定，避免高光和暗部细节同时丢失。"),
        "color_advice": str(parsed.get("color_advice") or "建议统一画面主色调，让目标风格更稳定。"),
        "editing_params": json.dumps(editing_params, ensure_ascii=False),
        "model_used": settings.ark_vision_model,
    }


def _build_prompt(item: PortfolioItem, preference: Preference | None) -> str:
    preference_text = ""
    if preference:
        preference_text = (
            f"用户摄影水平：{preference.skill_level or '未设置'}；"
            f"常拍内容：{preference.common_subjects or '未设置'}；"
            f"偏好风格：{preference.preferred_styles or '未设置'}；"
            f"提升目标：{preference.improvement_goals or '未设置'}；"
            f"常用修图工具：{preference.editing_tools or '未设置'}。"
        )

    return f"""
你是 LensCoach 的摄影成长教练。请根据用户上传的照片内容、目标风格和发布平台，生成可执行的中文摄影建议报告。

作品信息：
- 标题：{item.title}
- 描述：{item.description or '无'}
- 分类：{item.category or '未设置'}
- 目标风格：{item.target_style or '未设置'}
- 目标平台：{item.target_platform or '未设置'}
- 用户偏好：{preference_text or '未设置'}

请只返回一个 JSON 对象，不要使用 Markdown，不要添加代码块。字段必须包含：
{{
  "summary": "总体评价，2-4 句，说明照片内容、适合方向和优先优化点",
  "composition_advice": "构图建议，具体说明主体位置、裁剪、留白或封面感",
  "lighting_advice": "光线建议，具体说明曝光、阴影、高光、拍摄光线选择",
  "color_advice": "色彩建议，结合目标风格说明白平衡、饱和度、主色调",
  "editing_params": {{
    "exposure": "参数范围或建议值",
    "contrast": "参数范围或建议值",
    "highlights": "参数范围或建议值",
    "shadows": "参数范围或建议值",
    "temperature": "参数范围或建议值",
    "saturation": "参数范围或建议值"
  }}
}}

要求：
- 不要给照片打分。
- 建议要像摄影/修图教练，不要泛泛而谈。
- 如果目标平台是小红书，要强调封面感、主体突出和生活方式表达。
- 如果目标平台是作品集，要强调系列感、一致性和视觉表达。
- 修图参数可以参考 Lightroom 或通用参数风格。
""".strip()


def _resolve_image_input(image_url: str) -> str | None:
    if image_url.startswith("http://") or image_url.startswith("https://") or image_url.startswith("data:"):
        return image_url

    settings = get_settings()
    relative = image_url.removeprefix("/uploads/").lstrip("/\\")
    path = settings.upload_path / relative
    if not path.exists() or not path.is_file():
        return None

    mime_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _extract_response_text(data: dict[str, Any]) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"]

    chunks: list[str] = []
    for output in data.get("output", []) or []:
        for content in output.get("content", []) or []:
            text = content.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "\n".join(chunks)


def _parse_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.removeprefix("json").strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    try:
        parsed = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None
