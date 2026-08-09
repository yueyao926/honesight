from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def generate_editing_strategy(
    *,
    target_style: str,
    target_platform: str,
    analysis_context: str,
    edit_instruction: str | None = None,
) -> dict[str, str] | None:
    """Generate an editing strategy and optimized prompt from analysis results.

    Uses the LLM to analyze the vision analysis results and user requirements,
    then produces a human-readable editing strategy (why + how) and an
    optimized prompt for the image generation model.

    Returns ``None`` on any failure so callers can fall back to the
    default prompt builder.
    """
    settings = get_settings()
    if not settings.resolved_ai_api_key:
        logger.warning("Editing strategist skipped: no AI API key configured")
        return None

    user_text = _build_strategist_prompt(
        target_style=target_style,
        target_platform=target_platform,
        analysis_context=analysis_context,
        edit_instruction=edit_instruction,
    )

    payload: dict[str, Any] = {
        "model": settings.resolved_ai_model,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": STRATEGIST_SYSTEM_PROMPT}],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": user_text}],
            },
        ],
    }

    try:
        with httpx.Client(timeout=_strategist_timeout()) as client:
            response = client.post(
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
        logger.warning(
            "Editing strategist HTTP error: status=%s detail=%s",
            exc.response.status_code,
            _safe_provider_error(exc.response),
        )
        return None
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Editing strategist connection failed: %s", type(exc).__name__)
        return None

    text = _extract_response_text(data)
    parsed = _parse_json_object(text)
    if not parsed:
        logger.warning("Editing strategist returned unparseable response")
        return None

    strategy = _as_str(parsed.get("editing_strategy"))
    optimized_prompt = _as_str(parsed.get("optimized_prompt"))
    if not strategy or not optimized_prompt:
        logger.warning("Editing strategist response missing required fields")
        return None

    return {
        "editing_strategy": strategy,
        "optimized_prompt": optimized_prompt,
    }


STRATEGIST_SYSTEM_PROMPT = (
    "You are a professional photography retouching strategist working alongside an AI photo editor. "
    "Your job is to translate a photo analysis report and user requirements into:\n"
    "1. A clear editing strategy explaining WHY each adjustment is made and HOW it will be applied.\n"
    "2. An optimized, detailed prompt for an image generation model that will actually perform the edits.\n\n"
    "The editing strategy must reference specific findings from the analysis "
    "(scores, problems, suggested parameters) and explain the reasoning chain: "
    "analysis finding → editing decision → expected outcome.\n"
    "Write all user-visible text in Simplified Chinese.\n"
    "Return only one JSON object — no Markdown, no extra text outside the JSON.\n"
    'The JSON must have exactly two keys: "editing_strategy" and "optimized_prompt".'
)


def _build_strategist_prompt(
    target_style: str,
    target_platform: str,
    analysis_context: str,
    edit_instruction: str | None,
) -> str:
    parts = [
        "Based on the photo analysis below, please generate:",
        "",
        "1. **editing_strategy**: A detailed explanation (in Simplified Chinese) covering:",
        "   - 为什么这样修：哪些分析发现驱动了修图决策（引用具体分数、问题、建议）",
        "   - 怎么修的：具体的调整步骤和参数方向（曝光、色彩、构图、质感等）",
        "   - 预期效果：修图完成后的视觉变化",
        "2. **optimized_prompt**: A detailed prompt for an image generation model (in Chinese)"
        " that will execute these edits on the original photo.",
        "",
        "TARGET:",
        f"  Style: {target_style}",
        f"  Platform: {target_platform}",
        "",
        "The optimized_prompt must instruct the model to:",
        "- Preserve the original subject identity, pose, scene structure, and composition",
        "- Apply specific tonal, color, and texture adjustments derived from the analysis",
        "- Produce a natural, realistic result suitable for the target platform",
        "- Avoid over-smoothing, plastic skin, text, watermarks, or borders",
    ]
    if edit_instruction and edit_instruction.strip():
        parts.append(f"\nUSER ADDITIONAL REQUIREMENTS:\n{edit_instruction.strip()}")
    parts.append(f"\nPHOTO ANALYSIS REPORT:\n{analysis_context}")
    parts.append(
        "\n\nReturn ONLY a JSON object with keys \"editing_strategy\" and \"optimized_prompt\"."
        " No markdown, no extra text."
    )
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Helpers (mirror patterns from vision_analyzer.py)
# ---------------------------------------------------------------------------

def _strategist_timeout() -> int:
    settings = get_settings()
    # half of image generation timeout, at least 20s
    return max(20, settings.ai_timeout_seconds)


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


def _as_str(value: object) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""


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
