from __future__ import annotations

import json
from datetime import date
from typing import Any

from app.models.preference import Preference
from app.services.practice_templates import ABILITIES, CATEGORIES, TASK_LIBRARY, get_task


DIMENSION_KEYS = {"构图": "composition", "光线": "exposure", "清晰度": "focus", "色彩": "color"}
GOAL_TO_ABILITY = {"构图": "构图", "光线": "光线", "清晰度": "清晰度", "色彩": "色彩"}


def current_week_key(today: date | None = None) -> str:
    iso = (today or date.today()).isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def initial_level(preference: Preference | None) -> int:
    value = ((preference.skill_level if preference else "") or "").lower()
    if any(token in value for token in ("进阶", "创作", "advanced")):
        return 4
    if any(token in value for token in ("较熟练", "熟练", "intermediate")):
        return 3
    if any(token in value for token in ("有基础", "基础", "basic")):
        return 2
    return 1


def normalize_category(value: object) -> str:
    raw = str(value or "").lower()
    if any(token in raw for token in ("portrait", "people", "person", "人像", "人物")):
        return "人像"
    if any(token in raw for token in ("landscape", "scenery", "风景", "建筑", "街景", "夜景")):
        return "风景"
    if any(token in raw for token in ("product", "food", "still", "object", "拍物", "静物", "美食", "产品")):
        return "拍物"
    return "人像"


def analyze_practice_source(report: dict[str, Any], selected_goal: str) -> dict[str, Any]:
    details = _json_object(report.get("benchmark_detail_json"))
    category = normalize_category(report.get("photo_type"))
    if selected_goal in GOAL_TO_ABILITY:
        ability = GOAL_TO_ABILITY[selected_goal]
    else:
        ability = min(
            ABILITIES,
            key=lambda item: _score(_dimension_detail(details, item).get("score", report.get(f"{DIMENSION_KEYS[item]}_score"))),
        )
    detail = _dimension_detail(details, ability)
    problems = detail.get("problems") if isinstance(detail.get("problems"), list) else []
    issue = str(next((item for item in problems if str(item).strip()), "最需要先稳定这一项基础能力。"))
    intent = _one_line(str(report.get("summary") or f"突出画面中的{category}主体。"), 42)
    confidence = _confidence(report.get("style_confidence"))
    return {
        "photo_type": category,
        "intent": intent,
        "priority_issue": _one_line(issue, 42),
        "ability": ability,
        "recommended_level": 1,
        "confidence": confidence,
    }


def choose_practice(preference: Preference | None) -> tuple[str, dict[str, Any]]:
    """Compatibility helper for existing callers and older tests."""
    goals = ((preference.improvement_goals if preference else "") or "").lower()
    keyword_groups = {
        "构图": ("构图", "背景", "主体", "composition"),
        "光线": ("光线", "曝光", "明暗", "lighting", "exposure"),
        "色彩": ("色彩", "颜色", "调色", "color"),
        "清晰度": ("对焦", "清晰", "焦点", "focus"),
    }
    ability = next(
        (focus for focus, words in keyword_groups.items() if any(word in goals for word in words)),
        "构图",
    )
    category = _preferred_category(preference)
    task = get_task(category, ability, initial_level(preference), 1)
    return ability, {
        **task,
        "brief": task["goal"],
        "constraints": task["steps"],
        "success_criteria": task["criteria"],
        "coach_note": f"本周重点：{ability}。",
    }


def select_least_practiced_ability(progress_rows: list[Any]) -> str:
    by_ability = {row.ability: row for row in progress_rows}
    active_cycles = [
        row for row in progress_rows
        if 1 < int(row.cycle_week or 1) <= 4 and row.ability in ABILITIES
    ]
    if active_cycles:
        # Finish the four-week micro-cycle before introducing a new ability.
        return max(
            active_cycles,
            key=lambda row: (
                row.last_practiced_at.isoformat() if row.last_practiced_at else "",
                int(row.cycle_week or 1),
            ),
        ).ability
    return min(
        ABILITIES,
        key=lambda ability: (
            by_ability[ability].completed_count if ability in by_ability else -1,
            by_ability[ability].last_practiced_at.isoformat() if ability in by_ability and by_ability[ability].last_practiced_at else "",
            ABILITIES.index(ability),
        ),
    )


def build_attempt_feedback(
    report: dict[str, Any],
    skill_focus: str,
    first_score: int | None = None,
    criteria: list[str] | None = None,
    level: int = 1,
    comparison_label: str = "原图",
) -> dict[str, Any]:
    ability = "清晰度" if skill_focus == "对焦" else skill_focus
    dimension_key = DIMENSION_KEYS.get(ability, "composition")
    detail = _json_object(report.get("benchmark_detail_json")).get(dimension_key, {})
    if not isinstance(detail, dict):
        detail = {}
    score = _score(detail.get("score", report.get(f"{dimension_key}_score")))
    problems = detail.get("problems") if isinstance(detail.get("problems"), list) else []
    key_issue = _one_line(
        str(next((item for item in problems if str(item).strip()), "这个动作还可以再稳定一点。")),
        52,
    )
    reason = _one_line(str(detail.get("reason") or report.get("summary") or "已经完成本周要求。"), 52)
    action_map = {
        "构图": report.get("composition_advice"),
        "光线": report.get("lighting_advice"),
        "色彩": report.get("color_advice"),
        "清晰度": report.get("shooting_tips"),
    }
    action = _one_line(str(action_map.get(ability) or report.get("next_step") or "换一个场景重复同一动作。"), 52)
    threshold = 54 + max(1, min(4, level)) * 6
    achieved_count = 0
    criterion_results: list[dict[str, Any]] = []
    for index, criterion in enumerate((criteria or [])[:2]):
        achieved = score >= threshold + index * 4
        achieved_count += int(achieved)
        criterion_results.append({"criterion": criterion, "achieved": achieved})
    if not criterion_results:
        achieved_count = int(score >= threshold)
        criterion_results = [{"criterion": f"完成「{ability}」目标", "achieved": bool(achieved_count)}]
    comparison = ""
    if first_score is not None:
        change = score - first_score
        comparison = f"与{comparison_label}相比，{ability}表现{'提升' if change > 0 else '基本稳定' if change == 0 else '仍需稳定'}。"
    return {
        "skill_score": score,
        "achieved_count": achieved_count,
        "criteria_total": len(criterion_results),
        "criterion_results": criterion_results,
        "strength": f"{reason.rstrip('。')}。",
        "key_issue": f"{key_issue.rstrip('。')}。",
        "action_step": f"{action.rstrip('。')}。",
        "reshoot_task": "下周换一个场景，继续稳定同一能力。",
        "comparison_summary": comparison,
    }


def _preferred_category(preference: Preference | None) -> str:
    values = list(preference.photography_categories or []) if preference else []
    common = (preference.common_subjects or "") if preference else ""
    for category in CATEGORIES:
        if category in values or category in common:
            return category
    return "人像"


def _dimension_detail(details: dict[str, Any], ability: str) -> dict[str, Any]:
    value = details.get(DIMENSION_KEYS[ability], {})
    return value if isinstance(value, dict) else {}


def _json_object(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str) or not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _score(value: object) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        number = 0
    return max(0, min(100, number))


def _confidence(value: object) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.72
    return max(0.0, min(1.0, number if number <= 1 else number / 100))


def _one_line(value: str, max_length: int) -> str:
    normalized = " ".join(value.replace("\n", " ").split())
    return normalized if len(normalized) <= max_length else f"{normalized[: max_length - 1]}…"


assert len(TASK_LIBRARY) == 48
