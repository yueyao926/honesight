from __future__ import annotations

import base64
import copy
import json
import logging
import mimetypes
import re
import threading
import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.models.preference import Preference
from app.services.mock_analyzer import build_mock_vision_result
from app.services.signed_media import build_ai_media_url


logger = logging.getLogger("uvicorn.error")
_client_lock = threading.Lock()
_vision_client: httpx.Client | None = None
ANALYSIS_DETAILS_TIMEOUT_SECONDS = 120

class VisionAnalysisError(RuntimeError):
    pass



def call_vision_model(
    image_url: str,
    title: str,
    description: str | None,
    category: str | None,
    preference: Preference | None,
    target_style: str,
    target_platform: str,
    style_reference_urls: list[str] | None = None,
) -> dict:
    started_at = time.perf_counter()
    settings = get_settings()
    if settings.ai_analysis_mode.strip().lower() == "mock":
        return build_mock_vision_result(category or "general", target_style, target_platform)
    if not settings.ai_analysis_enabled:
        raise VisionAnalysisError("AI analysis is disabled on the server")
    if not settings.resolved_ai_api_key:
        raise VisionAnalysisError("AI analysis API key is not configured")

    resolve_started_at = time.perf_counter()
    image_input = _resolve_image_input(image_url)
    if not image_input:
        raise VisionAnalysisError("The uploaded image could not be read")
    resolve_ms = _elapsed_ms(resolve_started_at)

    user_content: list[dict[str, Any]] = [
        {"type": "input_image", "image_url": image_input},
    ]
    for ref_url in style_reference_urls or []:
        ref_input = _resolve_image_input(ref_url)
        if ref_input:
            user_content.append({"type": "input_image", "image_url": ref_input})

    user_content.append(
        {
            "type": "input_text",
            "text": _build_user_prompt(
                title, description, category, preference, target_style, target_platform, style_reference_urls
            ),
        }
    )

    payload = {
        "model": settings.resolved_ai_model,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": SYSTEM_PROMPT}],
            },
            {
                "role": "user",
                "content": user_content,
            },
        ],
        "thinking": {"type": "disabled"},
    }

    provider_started_at = time.perf_counter()
    data = _post_vision_request(payload)
    text = _extract_response_text(data)
    parsed = _parse_json_object(text)
    if not parsed:
        parsed, text = _retry_invalid_json_response(payload, profile="full", first_data=data)
    provider_ms = _elapsed_ms(provider_started_at)
    if not parsed:
        raise VisionAnalysisError("Vision API did not return a valid analysis object")
    parsed = _normalize_model_result(parsed, target_platform)
    parsed["_raw_response"] = text[:12000]
    parsed["_timings"] = {
        "resolve_image_ms": resolve_ms,
        "provider_ms": provider_ms,
        "total_ms": _elapsed_ms(started_at),
    }
    logger.info(
        "vision_analysis profile=full transport=%s resolve_ms=%s provider_ms=%s total_ms=%s",
        "url" if image_input.startswith(("http://", "https://")) else "base64",
        resolve_ms,
        provider_ms,
        parsed["_timings"]["total_ms"],
    )
    return parsed


def call_practice_vision_model(
    *,
    image_url: str,
    category: str | None,
    ability: str | None,
    criteria: list[str] | None,
    level: int,
    mode: str,
    selected_goal: str | None = None,
) -> dict[str, Any]:
    started_at = time.perf_counter()
    settings = get_settings()
    if settings.ai_analysis_mode.strip().lower() == "mock":
        return _build_mock_practice_result(
            mode=mode,
            category=category,
            ability=ability,
            criteria=criteria or [],
            level=level,
            selected_goal=selected_goal,
        )
    if not settings.ai_analysis_enabled:
        raise VisionAnalysisError("AI analysis is disabled on the server")
    if not settings.resolved_ai_api_key:
        raise VisionAnalysisError("AI analysis API key is not configured")
    image_input = _resolve_image_input(image_url)
    if not image_input:
        raise VisionAnalysisError("The uploaded image could not be read")

    if mode == "source":
        contract: dict[str, Any] = {
            "photo_type": "portrait|landscape|product",
            "intent": "一句话概括拍摄意图",
            "priority_issue": "最值得先解决的一个画面问题",
            "recommended_ability": "构图|光线|清晰度|色彩",
            "focus_score": 68,
            "reason": "可见依据",
            "suggestion": "一条直接可执行的拍法",
            "confidence": 0.85,
        }
        task = (
            "判断照片类型、拍摄意图和最优先训练点。"
            "如果用户指定了目标，recommended_ability 必须优先使用该目标。"
        )
    else:
        contract = {
            "photo_type": "portrait|landscape|product",
            "focus_score": 72,
            "reason": "本周能力做得最好的可见依据",
            "problem": "仍需改善的一个可见问题",
            "suggestion": "下一轮一条直接可执行的拍法",
            "criterion_results": [
                {"criterion": "原样返回完成标准", "achieved": True, "evidence": "可见依据"}
            ],
            "confidence": 0.85,
        }
        task = "只评价本周指定能力和完成标准，不评价其他画面问题。"

    context = {
        "mode": mode,
        "category": category or "",
        "ability": ability or "",
        "criteria": (criteria or [])[:2],
        "level": max(1, min(4, level)),
        "selected_goal": selected_goal or "",
    }
    prompt = (
        f"{task}\n"
        f"训练信息：{json.dumps(context, ensure_ascii=False)}\n"
        f"只返回 JSON：{json.dumps(contract, ensure_ascii=False)}\n"
        "所有文字使用简体中文；只写照片中能看到的依据；不要输出 Markdown。"
    )
    payload = {
        "model": settings.resolved_ai_practice_model,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": "你是摄影练习教练，只反馈一个训练能力点。"}],
            },
            {
                "role": "user",
                "content": [
                    {"type": "input_image", "image_url": image_input},
                    {"type": "input_text", "text": prompt},
                ],
            },
        ],
        "max_output_tokens": 700,
        "thinking": {"type": "disabled"},
    }
    provider_started_at = time.perf_counter()
    data = _post_fast_vision_request(payload, profile=f"practice_{mode}")
    text = _extract_response_text(data)
    parsed = _parse_json_object(text)
    if not parsed:
        parsed, text = _retry_invalid_json_response(payload, profile=f"practice_{mode}", first_data=data)
    provider_ms = _elapsed_ms(provider_started_at)
    if not parsed:
        raise VisionAnalysisError("Vision API did not return a valid practice analysis object")
    normalized = _normalize_practice_result(parsed, criteria or [])
    normalized["_timings"] = {
        "provider_ms": provider_ms,
        "total_ms": _elapsed_ms(started_at),
    }
    logger.info(
        "vision_analysis profile=practice_%s transport=%s provider_ms=%s total_ms=%s",
        mode,
        "url" if image_input.startswith(("http://", "https://")) else "base64",
        provider_ms,
        normalized["_timings"]["total_ms"],
    )
    return normalized


def call_quick_vision_model(
    *,
    image_url: str,
    target_style: str,
    target_platform: str,
    category: str | None = None,
) -> dict[str, Any]:
    """Return four scores plus one priority action inside a short latency budget."""
    started_at = time.perf_counter()
    settings = get_settings()
    if not settings.ai_analysis_enabled:
        raise VisionAnalysisError("AI analysis is disabled on the server")
    if not settings.resolved_ai_api_key:
        raise VisionAnalysisError("AI analysis API key is not configured")
    image_input = _resolve_image_input(image_url)
    if not image_input:
        raise VisionAnalysisError("The uploaded image could not be read")

    contract = {
        "photo_type": "portrait|landscape|food|street|campus|product|night|general",
        "detected_style": "当前画面风格",
        "scores": {
            "exposure": 78,
            "focus": 82,
            "composition": 74,
            "color": 80,
        },
        "priority_issue": "最值得先解决的一个问题",
        "primary_ability": "构图|光线|清晰度|色彩",
        "summary": "一句话概括画面现状",
        "suggestion": "一条可以立刻照做的拍法",
        "confidence": 0.86,
    }
    prompt = (
        "快速评估照片。给出曝光、对焦、构图、色彩四项 0-100 初评分，再指出一个最优先问题。\n"
        f"目标风格：{target_style}；发布平台：{target_platform}；类别提示：{category or '无'}。\n"
        f"只返回紧凑 JSON：{json.dumps(contract, ensure_ascii=False)}\n"
        "分数必须根据照片重算；文字使用简体中文；不要输出 Markdown 或解释。"
    )
    payload = {
        "model": settings.resolved_ai_fast_model,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": "你是反应迅速的摄影教练，只做首屏四项初评。"}],
            },
            {
                "role": "user",
                "content": [
                    {"type": "input_image", "image_url": image_input},
                    {"type": "input_text", "text": prompt},
                ],
            },
        ],
        "max_output_tokens": 360,
        "thinking": {"type": "disabled"},
    }
    provider_started_at = time.perf_counter()
    data = _post_fast_vision_request(
        payload,
        profile="quick",
        fallback_timeout_seconds=max(1, settings.ai_fast_timeout_seconds * 2),
    )
    text = _extract_response_text(data)
    parsed = _parse_json_object(text)
    provider_ms = _elapsed_ms(provider_started_at)
    if not parsed:
        raise VisionAnalysisError("Vision API did not return a valid quick analysis object")
    scores = parsed.get("scores") if isinstance(parsed.get("scores"), dict) else {}
    result = {
        "photo_type": _as_text(parsed.get("photo_type")) or "general",
        "detected_style": _as_text(parsed.get("detected_style")),
        "exposure_score": _coerce_score(scores.get("exposure")),
        "focus_score": _coerce_score(scores.get("focus")),
        "composition_score": _coerce_score(scores.get("composition")),
        "color_score": _coerce_score(scores.get("color")),
        "priority_issue": _as_text(parsed.get("priority_issue")),
        "primary_ability": _normalize_ability(parsed.get("primary_ability")),
        "summary": _as_text(parsed.get("summary")),
        "suggestion": _as_text(parsed.get("suggestion")),
        "confidence": _coerce_confidence(parsed.get("confidence")),
        "model_used": str(payload["model"]),
        "elapsed_ms": _elapsed_ms(started_at),
    }
    logger.info(
        "vision_analysis profile=quick transport=%s provider_ms=%s total_ms=%s model=%s",
        "url" if image_input.startswith(("http://", "https://")) else "base64",
        provider_ms,
        result["elapsed_ms"],
        payload["model"],
    )
    return result


def call_analysis_details_model(
    *,
    image_url: str,
    target_style: str,
    target_platform: str,
    analysis_summary: str,
) -> dict[str, Any]:
    """Generate optional editing and publishing details only when requested."""
    started_at = time.perf_counter()
    settings = get_settings()
    if not settings.ai_analysis_enabled:
        raise VisionAnalysisError("AI analysis is disabled on the server")
    if not settings.resolved_ai_api_key:
        raise VisionAnalysisError("AI analysis API key is not configured")
    contract = {
        "editing_params": {
            "lightroom": {"曝光": "+0.20", "高光": "-20", "阴影": "+15", "色温": "-3", "饱和度": "-6"},
            "mobile_apps": {"亮度": "+5", "对比度": "-4", "高光": "-20", "锐化": "+8"},
        },
        "platform_suggestion": {
            "crop_ratio": "建议比例",
            "visual_priority": "第一视觉重点",
            "publishing_advice": "一条发布建议",
        },
    }
    prompt = (
        f"根据已完成的照片四维分析生成「{target_style}」方向的修图参数，并适配「{target_platform}」。\n"
        f"已有分析：{analysis_summary[:1800]}\n"
        f"只返回紧凑 JSON：{json.dumps(contract, ensure_ascii=False)}\n"
        "参数必须具体、克制且可直接操作；所有文字使用简体中文；不要输出 Markdown。"
    )
    payload = {
        "model": settings.resolved_ai_model,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": "你是摄影后期与发布顾问，只生成用户请求的参数。"}],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": prompt}],
            },
        ],
        "max_output_tokens": 1800,
        "thinking": {"type": "disabled"},
    }
    # This runs in a background job, not the first-screen quick-score path.
    # A full editing report must not inherit that path's eight-second timeout,
    # especially when AI_FAST_MODEL resolves to the same Pro model as AI_MODEL.
    data = _post_vision_request(
        payload,
        timeout_seconds=ANALYSIS_DETAILS_TIMEOUT_SECONDS,
    )
    text = _extract_response_text(data)
    parsed = _parse_json_object(text)
    if not parsed:
        parsed, text = _retry_invalid_json_response(
            payload,
            profile="details",
            first_data=data,
            timeout_seconds=ANALYSIS_DETAILS_TIMEOUT_SECONDS,
        )
    if not parsed:
        raise VisionAnalysisError("修图参数返回不完整，请稍后重试")
    editing_params = _normalize_editing_params(parsed.get("editing_params"))
    if not editing_params:
        raise VisionAnalysisError("AI 未返回可用的修图参数，请重新生成")
    platform_suggestion = parsed.get("platform_suggestion")
    result = {
        "editing_params": editing_params,
        "platform_suggestions": _normalize_platform_suggestions(
            platform_suggestion,
            target_platform,
        ),
        "model_used": str(payload["model"]),
        "elapsed_ms": _elapsed_ms(started_at),
    }
    logger.info(
        "vision_analysis profile=details total_ms=%s model=%s",
        result["elapsed_ms"],
        payload["model"],
    )
    return result


def close_vision_http_client() -> None:
    global _vision_client
    with _client_lock:
        if _vision_client is not None:
            _vision_client.close()
            _vision_client = None


def _build_mock_practice_result(
    *,
    mode: str,
    category: str | None,
    ability: str | None,
    criteria: list[str],
    level: int,
    selected_goal: str | None,
) -> dict[str, Any]:
    focus_ability = selected_goal if selected_goal in {"构图", "光线", "清晰度", "色彩"} else (ability or "构图")
    if mode == "source":
        return {
            "photo_type": category or "portrait",
            "intent": "mock 模式：画面主体明确，适合作为本周练习起点。",
            "priority_issue": "背景元素略多，主体还可以更突出。",
            "recommended_ability": focus_ability,
            "focus_score": 68,
            "reason": "mock 模式：主体位置基本清楚，但层次还可以再整理。",
            "suggestion": "下一次拍摄时先简化背景，再调整主体位置。",
            "confidence": 0.82,
            "_timings": {"provider_ms": 0, "total_ms": 0},
        }
    return {
        "photo_type": category or "portrait",
        "focus_score": 72,
        "reason": f"mock 模式：{focus_ability}表现已有基础。",
        "problem": "边缘细节还可以再干净一点。",
        "suggestion": "保持当前拍法，再拍一张背景更简洁的版本。",
        "criterion_results": [
            {"criterion": text, "achieved": True, "evidence": "mock 模式：画面已满足该完成标准。"}
            for text in criteria[:2]
        ] or [{"criterion": "完成标准", "achieved": True, "evidence": "mock 模式"}],
        "confidence": 0.82,
        "_timings": {"provider_ms": 0, "total_ms": 0},
    }


SYSTEM_PROMPT = """
You are HoneSight, a professional AI photography coach with image understanding.
Analyze the source photo itself. Do not invent details that are not visible.
Your job is to help a beginner improve the photo for the selected target style
and publishing platform.

Evaluate exactly four dimensions:
1. exposure: brightness, highlight/shadow detail, dynamic range, and light direction.
2. focus: subject sharpness, motion blur, depth of field, and focal priority.
3. composition: subject placement, visual balance, background distractions, crop, and perspective.
4. color: white balance, skin tone, saturation, color harmony, and consistency with target style.

For every dimension, give an evidence-based reason, visible problems, and concrete
improvements that can be applied during editing or the next shoot.
All user-visible text values must be Simplified Chinese.
Return one JSON object only. Do not return Markdown or explanatory text outside JSON.
""".strip()


def _build_user_prompt(
    title: str,
    description: str | None,
    category: str | None,
    preference: Preference | None,
    target_style: str,
    target_platform: str,
    style_reference_urls: list[str] | None,
) -> str:
    ref_count = len(style_reference_urls or [])
    contract = {
        "photo_type": "portrait|landscape|food|street|campus|product|night|general",
        "detected_style": "current visual style in Simplified Chinese",
        "style_confidence": 0.86,
        "benchmark": {
            key: {
                "score": 80,
                "reason": "what is visible and why it receives this score",
                "problems": ["0 to 3 visible, photo-specific problems"],
                "suggestions": ["1 to 3 concrete and actionable improvements"],
            }
            for key in ("exposure", "focus", "composition", "color")
        },
        "summary": "concise overall assessment and the highest-priority improvement",
        "target_style_match": {
            "score": 75,
            "reason": "how the source differs from the selected target style",
        },
        "composition_advice": "specific crop, viewpoint, spacing, or subject-placement advice",
        "lighting_advice": "specific exposure, highlight, shadow, or lighting advice",
        "color_advice": "specific white-balance, saturation, and color-grading advice",
        "shooting_tips": "specific advice for the next shoot",
        "next_step": "the single highest-priority action to take now",
        "expected_effect": {
            "description": "how the edited result should look",
            "style_keywords": ["3 to 5 target-style keywords"],
        },
        "confidence": 0.86,
    }
    reference_instruction = (
        f"There are {ref_count} style reference images after the first source image. "
        "Use them only to infer tone, contrast, saturation, lighting, texture, and mood; "
        "do not confuse their subjects with the source photo."
        if ref_count
        else "There are no style reference images. Infer the target from target_style text."
    )
    profile = {
        "title": title,
        "description": description or "",
        "category": category or "general",
        "target_style": target_style,
        "target_platform": target_platform,
        "skill_level": preference.skill_level if preference else "",
        "preferred_styles": preference.preferred_styles if preference else "",
        "common_subjects": preference.common_subjects if preference else "",
        "improvement_goals": preference.improvement_goals if preference else "",
        "editing_tools": preference.editing_tools if preference else "",
    }
    return f"""
Analyze the FIRST image using the four required dimensions and adapt every
recommendation to both target_style and target_platform.

USER CONTEXT:
{json.dumps(profile, ensure_ascii=False, indent=2)}

REFERENCE IMAGE RULE:
{reference_instruction}

OUTPUT CONTRACT:
{json.dumps(contract, ensure_ascii=False, indent=2)}

STRICT REQUIREMENTS:
- Keep every key shown in OUTPUT CONTRACT.
- Scores are numbers from 0 to 100; confidence values are numbers from 0 to 1.
- target_style_match is always an object with numeric score and string reason.
- Each benchmark dimension must contain a photo-specific reason.
- Each benchmark dimension must contain 1 to 3 actionable suggestions.
- Problems may be an empty array only when no visible problem exists.
- The numeric values shown in OUTPUT CONTRACT illustrate types only. Recalculate every score from the source photo; never copy example values.
- composition_advice, lighting_advice, color_advice, shooting_tips, and next_step
  must be concrete recommendations, not generic praise.
- Keep each reason or advice to one concise sentence and avoid repeating the same observation.
- All user-visible text values are Simplified Chinese.
- Return valid JSON only.
""".strip()

def _get_vision_http_client() -> httpx.Client:
    global _vision_client
    if _vision_client is None:
        with _client_lock:
            if _vision_client is None:
                settings = get_settings()
                _vision_client = httpx.Client(
                    timeout=settings.ai_timeout_seconds,
                    limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
                )
    return _vision_client


def _post_vision_request(
    payload: dict[str, Any],
    *,
    timeout_seconds: int | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    try:
        response = _get_vision_http_client().post(
            f"{settings.resolved_ai_base_url}/responses",
            headers={
                "Authorization": f"Bearer {settings.resolved_ai_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=timeout_seconds or settings.ai_timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPStatusError as exc:
        raise VisionAnalysisError(f"Vision API request failed: {_safe_provider_error(exc.response)}") from exc
    except httpx.TimeoutException as exc:
        logger.warning(
            "vision_api_timeout model=%s timeout_seconds=%s error_type=%s",
            payload.get("model", "unknown"),
            timeout_seconds or settings.ai_timeout_seconds,
            type(exc).__name__,
        )
        raise VisionAnalysisError("AI 服务响应超时，请稍后重试") from exc
    except httpx.HTTPError as exc:
        raise VisionAnalysisError("Could not connect to the vision API") from exc
    except ValueError as exc:
        raise VisionAnalysisError("Vision API returned invalid JSON") from exc
    if not isinstance(data, dict):
        raise VisionAnalysisError("Vision API returned invalid JSON")
    return data


def _post_fast_vision_request(
    payload: dict[str, Any],
    *,
    profile: str,
    fallback_to_full: bool = True,
    fallback_timeout_seconds: int | None = None,
) -> dict[str, Any]:
    """Use the configured fast model, then degrade safely to the proven full model."""
    settings = get_settings()
    started_at = time.perf_counter()
    try:
        return _post_vision_request(
            payload,
            timeout_seconds=max(1, settings.ai_fast_timeout_seconds),
        )
    except VisionAnalysisError as exc:
        current_model = str(payload.get("model") or "")
        fallback_model = settings.resolved_ai_model
        if not fallback_to_full or not current_model or current_model == fallback_model:
            logger.warning(
                "vision_analysis fast_model_failed profile=%s model=%s elapsed_ms=%s fallback=false error=%s",
                profile,
                current_model or "unknown",
                _elapsed_ms(started_at),
                type(exc).__name__,
            )
            raise
        logger.warning(
            "vision_analysis fast_model_fallback profile=%s from_model=%s to_model=%s elapsed_ms=%s",
            profile,
            current_model,
            fallback_model,
            _elapsed_ms(started_at),
        )
        payload["model"] = fallback_model
        return _post_vision_request(payload, timeout_seconds=fallback_timeout_seconds)


def _retry_invalid_json_response(
    payload: dict[str, Any],
    *,
    profile: str,
    first_data: dict[str, Any],
    timeout_seconds: int | None = None,
) -> tuple[dict[str, Any] | None, str]:
    """Retry once without an output cap when a provider truncates or mangles JSON."""
    incomplete = first_data.get("incomplete_details")
    incomplete_reason = incomplete.get("reason") if isinstance(incomplete, dict) else ""
    first_text = _extract_response_text(first_data)
    logger.warning(
        "vision_analysis invalid_json profile=%s status=%s incomplete_reason=%s text_chars=%s retrying=true",
        profile,
        first_data.get("status", "unknown"),
        incomplete_reason or "unknown",
        len(first_text),
    )

    retry_payload = copy.deepcopy(payload)
    retry_payload.pop("max_output_tokens", None)
    inputs = retry_payload.get("input")
    if isinstance(inputs, list) and inputs:
        last_message = inputs[-1]
        if isinstance(last_message, dict):
            content = last_message.get("content")
            if isinstance(content, list):
                content.append(
                    {
                        "type": "input_text",
                        "text": (
                            "务必返回完整、紧凑、可被 JSON.parse 直接解析的 JSON 对象；"
                            "不要输出 Markdown、解释文字或未闭合的字段。"
                        ),
                    }
                )
    if timeout_seconds is None:
        retry_data = _post_vision_request(retry_payload)
    else:
        retry_data = _post_vision_request(retry_payload, timeout_seconds=timeout_seconds)
    retry_text = _extract_response_text(retry_data)
    return _parse_json_object(retry_text), retry_text


def _resolve_image_input(image_url: str) -> str | None:
    if image_url.startswith(("http://", "https://", "data:")):
        return image_url
    signed_url = build_ai_media_url(image_url)
    if signed_url:
        return signed_url
    settings = get_settings()
    path = settings.upload_path / image_url.removeprefix("/uploads/").lstrip("/\\")
    if not path.exists() or not path.is_file():
        return None
    mime_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _normalize_practice_result(result: dict[str, Any], criteria: list[str]) -> dict[str, Any]:
    raw_results = result.get("criterion_results")
    by_criterion: dict[str, dict[str, Any]] = {}
    if isinstance(raw_results, list):
        for item in raw_results:
            if not isinstance(item, dict):
                continue
            criterion = _as_text(item.get("criterion"))
            if criterion:
                by_criterion[criterion] = {
                    "criterion": criterion,
                    "achieved": bool(item.get("achieved")),
                    "evidence": _as_text(item.get("evidence")),
                }
    normalized_results = []
    for criterion in criteria[:2]:
        matched = by_criterion.get(criterion)
        if matched is None:
            matched = next(
                (item for key, item in by_criterion.items() if key in criterion or criterion in key),
                None,
            )
        normalized_results.append(
            matched
            or {"criterion": criterion, "achieved": False, "evidence": "未找到足够可见依据"}
        )
    return {
        "photo_type": _as_text(result.get("photo_type")) or "general",
        "intent": _as_text(result.get("intent")),
        "priority_issue": _as_text(result.get("priority_issue")),
        "recommended_ability": _as_text(result.get("recommended_ability")),
        "focus_score": _coerce_score(result.get("focus_score")),
        "reason": _as_text(result.get("reason")),
        "problem": _as_text(result.get("problem", result.get("priority_issue"))),
        "suggestion": _as_text(result.get("suggestion")),
        "criterion_results": normalized_results,
        "confidence": _coerce_confidence(result.get("confidence")),
    }


def _elapsed_ms(started_at: float) -> int:
    return int(round((time.perf_counter() - started_at) * 1000))


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


_TEXT_FIELDS = (
    "photo_type",
    "detected_style",
    "style_reasoning",
    "summary",
    "composition_advice",
    "lighting_advice",
    "color_advice",
    "shooting_tips",
    "next_step",
)


def _normalize_model_result(result: dict[str, Any], target_platform: str) -> dict[str, Any]:
    normalized = dict(result)
    for field in _TEXT_FIELDS:
        normalized[field] = _as_text(result.get(field))

    normalized["style_confidence"] = _coerce_confidence(result.get("style_confidence"))
    normalized["confidence"] = _coerce_confidence(result.get("confidence"))

    raw_benchmark = result.get("benchmark")
    benchmark = raw_benchmark if isinstance(raw_benchmark, dict) else {}
    normalized["benchmark"] = {
        dimension: _normalize_dimension(benchmark.get(dimension))
        for dimension in ("exposure", "focus", "composition", "color")
    }

    raw_match = result.get("target_style_match")
    if isinstance(raw_match, dict):
        match_score = (
            raw_match.get("score")
            if raw_match.get("score") is not None
            else raw_match.get("match_score", raw_match.get("similarity_score"))
        )
        match_reason = raw_match.get("reason", raw_match.get("analysis"))
    else:
        match_score = raw_match
        match_reason = ""
    normalized["target_style_match"] = {
        "score": _coerce_score(match_score),
        "reason": _as_text(match_reason),
    }

    normalized["editing_params"] = _normalize_editing_params(result.get("editing_params"))
    normalized["platform_suggestions"] = _normalize_platform_suggestions(
        result.get("platform_suggestions"),
        target_platform,
    )
    normalized["expected_effect"] = _normalize_expected_effect(result.get("expected_effect"))
    return normalized


def _normalize_dimension(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        score = value.get("score")
        reason = value.get("reason", value.get("analysis"))
        problems = value.get("problems")
        suggestions = value.get("suggestions", value.get("improvements"))
    else:
        score = value
        reason = ""
        problems = []
        suggestions = []
    return {
        "score": _coerce_score(score),
        "reason": _as_text(reason),
        "problems": _as_string_list(problems),
        "suggestions": _as_string_list(suggestions),
    }


def _normalize_editing_params(value: object) -> dict[str, dict[str, str]]:
    if not isinstance(value, dict):
        return {}
    if "lightroom" not in value and "mobile_apps" not in value:
        flat = _as_string_mapping(value)
        return {"lightroom": flat} if flat else {}

    output: dict[str, dict[str, str]] = {}
    for key in ("lightroom", "mobile_apps"):
        mapped = _as_string_mapping(value.get(key))
        if mapped:
            output[key] = mapped
    return output


def _normalize_platform_suggestions(
    value: object,
    target_platform: str,
) -> dict[str, dict[str, str]]:
    if not isinstance(value, dict):
        return {}
    selected = value.get(target_platform)
    if isinstance(selected, dict):
        mapped = _as_string_mapping(selected)
        return {target_platform: mapped} if mapped else {}
    if selected is not None:
        return {target_platform: {"publishing_advice": _as_text(selected)}}

    if value and all(not isinstance(item, dict) for item in value.values()):
        mapped = _as_string_mapping(value)
        return {target_platform: mapped} if mapped else {}

    output: dict[str, dict[str, str]] = {}
    for platform, advice in value.items():
        mapped = _as_string_mapping(advice)
        if mapped:
            output[str(platform)] = mapped
    return output


def _normalize_expected_effect(value: object) -> dict[str, Any]:
    if isinstance(value, str):
        return {"description": value.strip(), "style_keywords": []}
    if not isinstance(value, dict):
        return {"description": "", "style_keywords": []}
    return {
        "description": _as_text(
            value.get("description", value.get("expected_effect_description"))
        ),
        "style_keywords": _as_string_list(value.get("style_keywords")),
    }


def _as_string_mapping(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    output: dict[str, str] = {}
    for key, item in value.items():
        text = _as_text(item)
        if text:
            output[str(key)] = text
    return output


def _as_string_list(value: object) -> list[str]:
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if not isinstance(value, list):
        return []
    return [text for item in value if (text := _as_text(item))]


def _as_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    return ""


def _coerce_score(value: object) -> int:
    number = _extract_number(value)
    if number is None:
        return 0
    return max(0, min(100, int(round(number))))


def _coerce_confidence(value: object) -> float:
    number = _extract_number(value)
    if number is None:
        return 0.0
    if number > 1:
        number /= 100
    return max(0.0, min(1.0, number))


def _normalize_ability(value: object) -> str:
    text = _as_text(value)
    aliases = {
        "曝光": "光线",
        "lighting": "光线",
        "light": "光线",
        "focus": "清晰度",
        "sharpness": "清晰度",
        "composition": "构图",
        "color": "色彩",
    }
    if text in {"构图", "光线", "清晰度", "色彩"}:
        return text
    return aliases.get(text.lower(), "构图")


def _extract_number(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", value)
    if not match:
        return None
    try:
        return float(match.group())
    except ValueError:
        return None
