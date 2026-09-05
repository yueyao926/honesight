from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.portfolio import PortfolioItem
from app.models.preference import Preference
from app.services.benchmark import build_benchmark
from app.services.mock_analyzer import build_mock_vision_result
from app.services.style_detector import detect_style
from app.services.vision_analyzer import (
    call_analysis_details_model,
    call_quick_vision_model,
    call_vision_model,
)
from app.services.analysis_cache import build_analysis_cache_key, run_cached_analysis


def analyze_photo_context(
    image_url: str,
    preference: Preference | None,
    target_style: str | None,
    target_platform: str | None,
    style_reference_urls: list[str] | None = None,
    *,
    title: str = "待分析作品",
    description: str | None = None,
    category: str | None = None,
) -> dict:
    style = target_style or (preference.preferred_styles if preference else None) or "清新自然"
    platform = target_platform or (preference.target_platform if preference else None) or "作品集"

    settings = get_settings()
    if settings.ai_analysis_mode.strip().lower() == "mock":
        model_result = build_mock_vision_result(category or "general", style, platform)
        analysis_mode = "mock"
    else:
        model_result = call_vision_model(
            image_url=image_url,
            title=title,
            description=description,
            category=category,
            preference=preference,
            target_style=style,
            target_platform=platform,
            style_reference_urls=style_reference_urls,
        )
        analysis_mode = "api"

    return _build_analysis_report(
        model_result=model_result,
        style=style,
        platform=platform,
        style_reference_urls=style_reference_urls,
        analysis_mode=analysis_mode,
        model_used=settings.resolved_ai_model if analysis_mode == "api" else "mock-analyzer-v1",
        fallback_photo_type=category,
        description=description,
    )


def _build_analysis_report(
    *,
    model_result: dict,
    style: str,
    platform: str,
    style_reference_urls: list[str] | None,
    analysis_mode: str,
    model_used: str,
    fallback_photo_type: str | None = None,
    description: str | None = None,
) -> dict:
    photo_type = str(model_result.get("photo_type") or fallback_photo_type or "general")
    benchmark = build_benchmark(model_result, photo_type, style, platform, use_fallbacks=analysis_mode == "mock")
    style_result = detect_style(
        model_result,
        f"{style} {description or ''}",
        use_fallbacks=analysis_mode == "mock",
    )
    # Editing parameters and publishing advice are intentionally deferred to
    # the background details request so they never block the core analysis.
    platform_suggestions: dict = {}
    target_match = model_result.get("target_style_match") if isinstance(model_result.get("target_style_match"), dict) else {}
    editing_params: dict = {}
    expected_effect = model_result.get("expected_effect") if isinstance(model_result.get("expected_effect"), dict) else {}
    detail = benchmark["benchmark_detail"]
    weights = benchmark["weights"]
    if analysis_mode == "api":
        expected_effect_description = str(expected_effect.get("description") or "")
        summary = str(model_result.get("summary") or "")
        composition_advice = str(model_result.get("composition_advice") or "")
        lighting_advice = str(model_result.get("lighting_advice") or "")
        color_advice = str(model_result.get("color_advice") or "")
        shooting_tips = str(model_result.get("shooting_tips") or "")
        next_step = str(model_result.get("next_step") or "")
    else:
        expected_effect_description = str(
            expected_effect.get("description")
            or _build_expected_effect_fallback(style, style_reference_urls)
        )
        summary = str(model_result.get("summary") or benchmark["benchmark_summary"])
        composition_advice = str(
            model_result.get("composition_advice") or detail["composition"]["suggestions"][0]
        )
        lighting_advice = str(
            model_result.get("lighting_advice") or detail["exposure"]["suggestions"][0]
        )
        color_advice = str(
            model_result.get("color_advice") or detail["color"]["suggestions"][0]
        )
        shooting_tips = str(
            model_result.get("shooting_tips")
            or "下一次拍摄时先明确主体，再根据目标风格控制光线和色彩。"
        )
        next_step = str(
            model_result.get("next_step")
            or "先完成一次基础裁切和调色，再继续向 AI 追问更具体参数。"
        )
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
        "target_style_match_score": _clamp_score(target_match.get("score")),
        "summary": summary,
        "benchmark_detail_json": json.dumps(
            {
                **detail,
                "weight_reason": benchmark["weight_reason"],
                "benchmark_summary": benchmark["benchmark_summary"],
                "style_reference_image_urls": style_reference_urls or [],
                "expected_effect_description": expected_effect_description,
                "expected_effect_keywords": expected_effect.get("style_keywords", []),
            },
            ensure_ascii=False,
        ),
        "composition_advice": composition_advice,
        "lighting_advice": lighting_advice,
        "color_advice": color_advice,
        "editing_params": json.dumps(editing_params, ensure_ascii=False),
        "editing_params_json": json.dumps(editing_params, ensure_ascii=False),
        "platform_suggestions_json": json.dumps(platform_suggestions, ensure_ascii=False),
        "shooting_tips": shooting_tips,
        "next_step": next_step,
        "raw_response": str(model_result.get("_raw_response") or "")[:12000],
        "analysis_mode": analysis_mode,
        "model_used": model_used,
    }


def analyze_photo_item(
    item: PortfolioItem,
    preference: Preference | None,
    target_style: str | None,
    target_platform: str | None,
    style_reference_urls: list[str] | None = None,
) -> dict:
    return analyze_photo_context(
        image_url=item.image_url,
        preference=preference,
        target_style=target_style or item.target_style,
        target_platform=target_platform or item.target_platform,
        style_reference_urls=style_reference_urls,
        title=item.title,
        description=item.description,
        category=item.category,
    )


def analyze_photo_context_cached(
    *,
    db: Session,
    user_id: int,
    image_url: str,
    preference: Preference | None,
    target_style: str | None,
    target_platform: str | None,
    style_reference_urls: list[str] | None = None,
    title: str = "待分析作品",
    description: str | None = None,
    category: str | None = None,
) -> tuple[dict, bool]:
    settings = get_settings()
    cache_key = build_full_analysis_cache_key(
        user_id=user_id,
        image_url=image_url,
        preference=preference,
        target_style=target_style,
        target_platform=target_platform,
        style_reference_urls=style_reference_urls,
        title=title,
        description=description,
        category=category,
    )
    return run_cached_analysis(
        db,
        user_id=user_id,
        cache_key=cache_key,
        profile="full-v3",
        model_used=settings.resolved_ai_model,
        analyze=lambda: analyze_photo_context(
            image_url=image_url,
            preference=preference,
            target_style=target_style,
            target_platform=target_platform,
            style_reference_urls=style_reference_urls,
            title=title,
            description=description,
            category=category,
        ),
    )


def build_full_analysis_cache_key(
    *,
    user_id: int,
    image_url: str,
    preference: Preference | None,
    target_style: str | None,
    target_platform: str | None,
    style_reference_urls: list[str] | None = None,
    title: str = "待分析作品",
    description: str | None = None,
    category: str | None = None,
) -> str:
    settings = get_settings()
    return build_analysis_cache_key(
        profile="full-v3",
        image_url=image_url,
        user_id=user_id,
        preference=preference,
        style_reference_urls=style_reference_urls,
        parameters={
            "target_style": target_style or "",
            "target_platform": target_platform or "",
            "title": title,
            "description": description or "",
            "category": category or "",
        },
        model=settings.resolved_ai_model,
    )


def analyze_quick_context_cached(
    *,
    db: Session,
    user_id: int,
    image_url: str,
    target_style: str | None,
    target_platform: str | None,
    category: str | None = None,
) -> tuple[dict, bool]:
    settings = get_settings()
    style = target_style or "清新自然"
    platform = target_platform or "作品集"
    cache_key = build_quick_analysis_cache_key(
        user_id=user_id,
        image_url=image_url,
        target_style=style,
        target_platform=platform,
        category=category,
    )

    def analyze() -> dict:
        if settings.ai_analysis_mode.strip().lower() == "mock":
            mock = build_mock_vision_result(category or "general", style, platform)
            benchmark = mock.get("benchmark") if isinstance(mock.get("benchmark"), dict) else {}
            composition = benchmark.get("composition") if isinstance(benchmark.get("composition"), dict) else {}
            suggestions = composition.get("suggestions") if isinstance(composition.get("suggestions"), list) else []
            return {
                "photo_type": str(mock.get("photo_type") or category or "general"),
                "detected_style": str(mock.get("detected_style") or style),
                "exposure_score": _quick_dimension_score(benchmark, "exposure"),
                "focus_score": _quick_dimension_score(benchmark, "focus"),
                "composition_score": _quick_dimension_score(benchmark, "composition"),
                "color_score": _quick_dimension_score(benchmark, "color"),
                "priority_issue": str(mock.get("summary") or "让主体更明确"),
                "primary_ability": "构图",
                "summary": str(mock.get("summary") or "先明确主体，再处理其他细节。"),
                "suggestion": str(suggestions[0] if suggestions else "靠近主体，并减少画面里的干扰元素。"),
                "confidence": 0.8,
                "model_used": "mock-quick-v2",
                "elapsed_ms": 0,
            }
        return call_quick_vision_model(
            image_url=image_url,
            target_style=style,
            target_platform=platform,
            category=category,
        )

    return run_cached_analysis(
        db,
        user_id=user_id,
        cache_key=cache_key,
        profile="quick-v2",
        model_used=settings.resolved_ai_fast_model,
        analyze=analyze,
    )


def build_quick_analysis_cache_key(
    *,
    user_id: int,
    image_url: str,
    target_style: str,
    target_platform: str,
    category: str | None = None,
) -> str:
    settings = get_settings()
    return build_analysis_cache_key(
        profile="quick-v2",
        image_url=image_url,
        user_id=user_id,
        parameters={
            "target_style": target_style,
            "target_platform": target_platform,
            "category": category or "",
        },
        model=settings.resolved_ai_fast_model,
    )


def analyze_details_context_cached(
    *,
    db: Session,
    user_id: int,
    image_url: str,
    target_style: str,
    target_platform: str,
    analysis_summary: str,
) -> tuple[dict, bool]:
    settings = get_settings()
    cache_key = build_details_analysis_cache_key(
        user_id=user_id,
        image_url=image_url,
        target_style=target_style,
        target_platform=target_platform,
        analysis_summary=analysis_summary,
    )

    def analyze() -> dict:
        if settings.ai_analysis_mode.strip().lower() == "mock":
            return {
                "editing_params": {
                    "lightroom": {"曝光": "+0.20", "高光": "-20", "阴影": "+15"},
                    "mobile_apps": {"亮度": "+5", "对比度": "-4", "锐化": "+8"},
                },
                "platform_suggestions": {
                    target_platform: {
                        "crop_ratio": "保持主体完整",
                        "visual_priority": "主体",
                        "publishing_advice": "选择干净封面",
                    }
                },
                "model_used": "mock-details-v1",
                "elapsed_ms": 0,
            }
        return call_analysis_details_model(
            image_url=image_url,
            target_style=target_style,
            target_platform=target_platform,
            analysis_summary=analysis_summary,
        )

    return run_cached_analysis(
        db,
        user_id=user_id,
        cache_key=cache_key,
        profile="details-v3-full-model",
        model_used=settings.resolved_ai_model,
        analyze=analyze,
    )


def build_details_analysis_cache_key(
    *,
    user_id: int,
    image_url: str,
    target_style: str,
    target_platform: str,
    analysis_summary: str,
) -> str:
    settings = get_settings()
    return build_analysis_cache_key(
        profile="details-v3-full-model",
        image_url=image_url,
        user_id=user_id,
        parameters={
            "target_style": target_style,
            "target_platform": target_platform,
            "analysis_summary": analysis_summary[:1800],
        },
        model=settings.resolved_ai_model,
    )


def _clamp_score(value: object) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        number = 0
    return max(0, min(100, number))


def _quick_dimension_score(benchmark: dict, dimension: str) -> int:
    detail = benchmark.get(dimension)
    return _clamp_score(detail.get("score") if isinstance(detail, dict) else 0)


def _build_expected_effect_fallback(style: str, style_reference_urls: list[str] | None) -> str:
    if style_reference_urls:
        return (
            f"参考你上传的风格样片，照片将呈现更接近「{style}」的色调与氛围："
            "肤色更通透、整体对比更柔和、色彩更统一，并保留自然质感。"
        )
    return f"按「{style}」方向调色后，画面会更统一柔和，主体更突出，整体氛围更贴近目标风格。"
