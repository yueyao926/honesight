from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.preference import Preference
from app.services.analysis_cache import build_analysis_cache_key, run_cached_analysis
from app.services.analyzer import analyze_photo_context
from app.services.vision_analyzer import call_practice_vision_model


ABILITY_TO_DIMENSION = {
    "构图": "composition",
    "光线": "exposure",
    "清晰度": "focus",
    "色彩": "color",
}
GOAL_TO_ABILITY = {ability: ability for ability in ABILITY_TO_DIMENSION}


def analyze_practice_context_cached(
    *,
    db: Session,
    user_id: int,
    image_url: str,
    preference: Preference | None,
    mode: str,
    category: str | None = None,
    ability: str | None = None,
    criteria: list[str] | None = None,
    level: int = 1,
    selected_goal: str | None = None,
) -> tuple[dict[str, Any], bool]:
    settings = get_settings()
    profile = f"practice-{mode}-v2"
    parameters = {
        "mode": mode,
        "category": category or "",
        "ability": ability or "",
        "criteria": (criteria or [])[:2],
        "level": level,
        "selected_goal": selected_goal or "",
    }
    cache_key = build_analysis_cache_key(
        profile=profile,
        image_url=image_url,
        user_id=user_id,
        preference=preference,
        parameters=parameters,
        model=settings.resolved_ai_practice_model,
    )
    return run_cached_analysis(
        db,
        user_id=user_id,
        cache_key=cache_key,
        profile=profile,
        model_used=settings.resolved_ai_practice_model,
        analyze=lambda: _analyze_practice_context(
            image_url=image_url,
            preference=preference,
            mode=mode,
            category=category,
            ability=ability,
            criteria=criteria or [],
            level=level,
            selected_goal=selected_goal,
        ),
    )


def _analyze_practice_context(
    *,
    image_url: str,
    preference: Preference | None,
    mode: str,
    category: str | None,
    ability: str | None,
    criteria: list[str],
    level: int,
    selected_goal: str | None,
) -> dict[str, Any]:
    settings = get_settings()
    if settings.ai_analysis_mode.strip().lower() == "mock":
        return analyze_photo_context(
            image_url=image_url,
            preference=preference,
            target_style=preference.preferred_styles if preference else None,
            target_platform=preference.target_platform if preference else None,
            category=category,
            description=f"只评价{ability or selected_goal or '最优先能力'}",
        )

    result = call_practice_vision_model(
        image_url=image_url,
        category=category,
        ability=ability,
        criteria=criteria,
        level=level,
        mode=mode,
        selected_goal=selected_goal,
    )
    selected_ability = _normalize_ability(
        selected_goal if selected_goal in GOAL_TO_ABILITY else ability or result.get("recommended_ability")
    )
    dimension = ABILITY_TO_DIMENSION[selected_ability]
    score = _score(result.get("focus_score"))
    reason = str(result.get("reason") or "画面已经呈现本周能力的基础表现。")
    problem = str(result.get("problem") or result.get("priority_issue") or "这个动作还可以再稳定一点。")
    suggestion = str(result.get("suggestion") or "换一个场景重复同一拍法。")
    details = {
        key: {
            "score": score if key == dimension else 0,
            "reason": reason if key == dimension else "",
            "problems": [problem] if key == dimension and problem else [],
            "suggestions": [suggestion] if key == dimension else [],
        }
        for key in ("exposure", "focus", "composition", "color")
    }
    source_info = {
        "photo_type": result.get("photo_type") or category or "general",
        "intent": result.get("intent") or reason,
        "priority_issue": result.get("priority_issue") or problem,
        "ability": selected_ability,
        "recommended_level": max(1, min(4, level)),
        "confidence": _confidence(result.get("confidence")),
    }
    return {
        "photo_type": result.get("photo_type") or category or "general",
        "detected_style": "",
        "style_confidence": str(_confidence(result.get("confidence"))),
        "style_reasoning": reason,
        "exposure_score": details["exposure"]["score"],
        "focus_score": details["focus"]["score"],
        "composition_score": details["composition"]["score"],
        "color_score": details["color"]["score"],
        "overall_score": score,
        "summary": str(result.get("intent") or reason),
        "benchmark_detail_json": json.dumps(details, ensure_ascii=False),
        "composition_advice": suggestion if dimension == "composition" else "",
        "lighting_advice": suggestion if dimension == "exposure" else "",
        "color_advice": suggestion if dimension == "color" else "",
        "shooting_tips": suggestion,
        "next_step": suggestion,
        "analysis_mode": "api",
        "model_used": settings.resolved_ai_practice_model,
        "practice_source_info": source_info,
        "practice_criterion_results": result.get("criterion_results") or [],
        "_timings": result.get("_timings") or {},
    }


def _normalize_ability(value: object) -> str:
    raw = str(value or "").lower()
    aliases = {
        "构图": ("构图", "composition"),
        "光线": ("光线", "曝光", "lighting", "exposure"),
        "清晰度": ("清晰", "对焦", "focus", "sharpness"),
        "色彩": ("色彩", "颜色", "color"),
    }
    for ability, values in aliases.items():
        if any(item in raw for item in values):
            return ability
    return "构图"


def _score(value: object) -> int:
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return 0


def _confidence(value: object) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.72
    if number > 1:
        number /= 100
    return max(0.0, min(1.0, number))
