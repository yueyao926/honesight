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


def call_vision_model(item: PortfolioItem, preference: Preference | None, target_style: str, target_platform: str) -> dict | None:
    settings = get_settings()
    if not settings.ai_analysis_enabled or settings.ai_analysis_mode == "mock" or not settings.resolved_ai_api_key:
        return None

    image_input = _resolve_image_input(item.image_url)
    if not image_input:
        return None

    payload = {
        "model": settings.resolved_ai_model,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": SYSTEM_PROMPT}],
            },
            {
                "role": "user",
                "content": [
                    {"type": "input_image", "image_url": image_input},
                    {"type": "input_text", "text": _build_user_prompt(item, preference, target_style, target_platform)},
                ],
            },
        ],
    }

    try:
        with httpx.Client(timeout=settings.ai_timeout_seconds) as client:
            response = client.post(
                f"{settings.resolved_ai_base_url}/responses",
                headers={"Authorization": f"Bearer {settings.resolved_ai_api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except Exception:
        return None

    text = _extract_response_text(data)
    parsed = _parse_json_object(text)
    if not parsed:
        return None
    parsed["_raw_response"] = text[:12000]
    return parsed


SYSTEM_PROMPT = (
    "你是 LensCoach 的 AI 摄影教练。你的任务不是用绝对标准评价照片好坏，而是根据用户的目标风格、"
    "发布平台和摄影水平，给出可执行的摄影成长建议。你需要从曝光、对焦、构图、色彩四个维度做基础 benchmark，"
    "并给出适合不同平台的修图和发布建议。你的语言要专业但适合摄影新手理解。"
)


def _build_user_prompt(item: PortfolioItem, preference: Preference | None, target_style: str, target_platform: str) -> str:
    return f"""
作品标题：{item.title}
作品描述：{item.description or '无'}
作品分类：{item.category or 'general'}
用户目标风格 target_style：{target_style}
用户发布平台 target_platform：{target_platform}
用户摄影水平 skill_level：{preference.skill_level if preference else '未设置'}
用户偏好风格 preferred_styles：{preference.preferred_styles if preference else '未设置'}
用户常拍内容 common_subjects：{preference.common_subjects if preference else '未设置'}
用户想提升能力 improvement_goals：{preference.improvement_goals if preference else '未设置'}
用户常用修图工具 editing_tools：{preference.editing_tools if preference else '未设置'}

请严格返回 JSON，不要 Markdown，不要代码块。JSON schema 必须包含：
photo_type, detected_style, style_confidence, style_reasoning, benchmark, summary, target_style_match,
composition_advice, lighting_advice, color_advice, editing_params, platform_suggestions, shooting_tips, next_step, confidence。
benchmark 内必须包含 exposure/focus/composition/color，每项包含 score/reason/problems/suggestions。
所有 score 都是 0-100 整数，confidence 是 0-1 小数。
不要说你不能看图，只返回 JSON。
""".strip()


def _resolve_image_input(image_url: str) -> str | None:
    if image_url.startswith(("http://", "https://", "data:")):
        return image_url
    settings = get_settings()
    path = settings.upload_path / image_url.removeprefix("/uploads/").lstrip("/\\")
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
        cleaned = cleaned.strip("`").removeprefix("json").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        parsed = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None
