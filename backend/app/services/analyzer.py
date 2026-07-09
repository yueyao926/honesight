from __future__ import annotations

import json

from app.core.config import get_settings
from app.models.portfolio import PortfolioItem
from app.models.preference import Preference
from app.services.benchmark import build_benchmark
from app.services.mock_analyzer import build_mock_vision_result
from app.services.platform_advisor import build_platform_suggestions
from app.services.style_detector import detect_style
from app.services.vision_analyzer import call_vision_model


def analyze_photo_item(item: PortfolioItem, preference: Preference | None, target_style: str | None, target_platform: str | None) -> dict:
    style = target_style or item.target_style or (preference.preferred_styles if preference else None) or "清新自然"
    platform = target_platform or item.target_platform or (preference.target_platform if preference else None) or "作品集"

    model_result = call_vision_model(item, preference, style, platform)
    analysis_mode = "api"
    if not model_result:
        model_result = build_mock_vision_result(item.category or "general", style, platform)
        analysis_mode = "mock"

    photo_type = str(model_result.get("photo_type") or item.category or "general")
    benchmark = build_benchmark(model_result, photo_type, style, platform)
    style_result = detect_style(model_result, f"{style} {item.description or ''}")
    platform_suggestions = build_platform_suggestions(platform, style, model_result)
    target_match = model_result.get("target_style_match") if isinstance(model_result.get("target_style_match"), dict) else {}
    editing_params = model_result.get("editing_params") if isinstance(model_result.get("editing_params"), dict) else {}
    detail = benchmark["benchmark_detail"]
    weights = benchmark["weights"]
    settings = get_settings()

    return {
        "photo_type": benchmark["photo_type"],
        "detected_style": style_result["detected_style"],
        "style_confidence": str(style_result["style_confidence"]),
        "style_reasoning": style_result["style_reasoning"],
        "exposure_score": detail["exposure"]["score"],
        "focus_score": detail["focus"]["score"],
        "composition_score": detail["composition"]["score"],
        "color_score": detail["color"]["score"],
        "exposure_weight": str(weights["exposure"]),
        "focus_weight": str(weights["focus"]),
        "composition_weight": str(weights["composition"]),
        "color_weight": str(weights["color"]),
        "overall_score": benchmark["overall_score"],
        "target_style_match_score": _clamp_score(target_match.get("score", 72)),
        "summary": str(model_result.get("summary") or benchmark["benchmark_summary"]),
        "benchmark_detail_json": json.dumps(
            {
                **detail,
                "weight_reason": benchmark["weight_reason"],
                "benchmark_summary": benchmark["benchmark_summary"],
            },
            ensure_ascii=False,
        ),
        "composition_advice": str(model_result.get("composition_advice") or detail["composition"]["suggestions"][0]),
        "lighting_advice": str(model_result.get("lighting_advice") or detail["exposure"]["suggestions"][0]),
        "color_advice": str(model_result.get("color_advice") or detail["color"]["suggestions"][0]),
        "editing_params": json.dumps(editing_params, ensure_ascii=False),
        "editing_params_json": json.dumps(editing_params, ensure_ascii=False),
        "platform_suggestions_json": json.dumps(platform_suggestions, ensure_ascii=False),
        "shooting_tips": str(model_result.get("shooting_tips") or "下一次拍摄时先明确主体，再根据目标风格控制光线和色彩。"),
        "next_step": str(model_result.get("next_step") or "先完成一次基础裁切和调色，再继续向 AI 追问更具体参数。"),
        "raw_response": str(model_result.get("_raw_response") or "")[:12000],
        "analysis_mode": analysis_mode,
        "model_used": settings.resolved_ai_model if analysis_mode == "api" else "mock-analyzer-v1",
    }


def _clamp_score(value: object) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        number = 72
    return max(0, min(100, number))
