from __future__ import annotations

import base64
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
from app.services.signed_media import build_ai_media_url


logger = logging.getLogger("uvicorn.error")
_client_lock = threading.Lock()
_vision_client: httpx.Client | None = None

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
        "max_output_tokens": 3200,
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
    }

    provider_started_at = time.perf_counter()
    data = _post_vision_request(payload)
    provider_ms = _elapsed_ms(provider_started_at)

    text = _extract_response_text(data)
    parsed = _parse_json_object(text)
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
    }
    provider_started_at = time.perf_counter()
    data = _post_vision_request(payload)
    provider_ms = _elapsed_ms(provider_started_at)
    parsed = _parse_json_object(_extract_response_text(data))
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


def close_vision_http_client() -> None:
    global _vision_client
    with _client_lock:
        if _vision_client is not None:
            _vision_client.close()
            _vision_client = None


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
        "style_reasoning": "visible evidence supporting the detected style",
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
        "editing_params": {
            "lightroom": {
                "exposure": "+0.20",
                "highlights": "-25",
                "shadows": "+18",
                "temperature": "-3",
                "saturation": "-6",
            },
            "mobile_apps": {
                "brightness": "+5",
                "contrast": "-4",
                "highlights": "-20",
                "sharpen": "+8",
            },
        },
        "platform_suggestions": {
            target_platform: {
                "crop_ratio": "recommended crop ratio",
                "visual_priority": "what should attract attention first",
                "publishing_advice": "platform-specific presentation advice",
            }
        },
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
- The numeric values shown in OUTPUT CONTRACT illustrate types only. Recalculate every score and editing value from the source photo; never copy example values.
- editing_params must contain concrete values, not vague descriptions.
- platform_suggestions must be keyed by the selected target_platform.
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


def _post_vision_request(payload: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    try:
        response = _get_vision_http_client().post(
            f"{settings.resolved_ai_base_url}/responses",
            headers={
                "Authorization": f"Bearer {settings.resolved_ai_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPStatusError as exc:
        raise VisionAnalysisError(f"Vision API request failed: {_safe_provider_error(exc.response)}") from exc
    except httpx.HTTPError as exc:
        raise VisionAnalysisError("Could not connect to the vision API") from exc
    except ValueError as exc:
        raise VisionAnalysisError("Vision API returned invalid JSON") from exc
    if not isinstance(data, dict):
        raise VisionAnalysisError("Vision API returned invalid JSON")
    return data


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
