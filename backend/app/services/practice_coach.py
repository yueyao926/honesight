from __future__ import annotations

import json
from datetime import date
from typing import Any

from app.models.preference import Preference


PRACTICE_LIBRARY: dict[str, dict[str, Any]] = {
    "构图": {
        "title": "让主体从背景里站出来",
        "brief": "这周只练一个动作：按下快门前，沿着主体轮廓检查一圈，主动避开重叠和杂乱背景。",
        "constraints": ["固定使用一个焦段", "同一主体至少拍摄 6 张", "每张只改变机位或拍摄距离"],
        "success_criteria": ["主体第一眼可辨认", "主体轮廓没有明显遮挡", "背景元素不抢夺注意力"],
        "coach_note": "先别急着调色。这周只把主体和背景的关系拍清楚。",
    },
    "光线": {
        "title": "用光线把主体说明白",
        "brief": "寻找同一个主体的顺光、侧光和逆光位置，观察光线方向怎样改变轮廓、明暗和情绪。",
        "constraints": ["同一主体至少拍摄 6 张", "至少尝试两种光线方向", "暂时不使用滤镜"],
        "success_criteria": ["主体亮度合适", "高光与暗部保留细节", "光线方向服务于画面情绪"],
        "coach_note": "今天先观察光从哪里来，再决定站在哪里拍。",
    },
    "色彩": {
        "title": "让画面只讲一种颜色关系",
        "brief": "从场景里找出一个主色和一个辅助色，减少无关颜色，让色彩开始服务于主体和情绪。",
        "constraints": ["选择一个明确主色", "画面主要颜色不超过三种", "先完成拍摄再考虑后期"],
        "success_criteria": ["主色关系清楚", "没有突兀杂色", "色彩与主题情绪一致"],
        "coach_note": "这次不追求颜色多，先练会主动排除不需要的颜色。",
    },
    "对焦": {
        "title": "把最重要的地方拍清楚",
        "brief": "每次拍摄前先说出画面里最重要的位置，再把焦点稳定地放在那里。",
        "constraints": ["同一主体至少拍摄 6 张", "拍后放大检查焦点", "手持时保持稳定快门速度"],
        "success_criteria": ["焦点落在视觉主体", "主体关键细节清晰", "运动或手抖模糊得到控制"],
        "coach_note": "先决定哪里必须清楚，再半按快门确认焦点。",
    },
}


def current_week_key(today: date | None = None) -> str:
    iso = (today or date.today()).isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def choose_practice(preference: Preference | None) -> tuple[str, dict[str, Any]]:
    goals = (preference.improvement_goals if preference else "") or ""
    normalized = goals.lower()
    keyword_groups = {
        "构图": ("构图", "背景", "主体", "composition"),
        "光线": ("光线", "曝光", "明暗", "lighting", "exposure"),
        "色彩": ("色彩", "颜色", "调色", "color"),
        "对焦": ("对焦", "清晰", "焦点", "focus"),
    }
    for focus, keywords in keyword_groups.items():
        if any(keyword in normalized for keyword in keywords):
            return focus, PRACTICE_LIBRARY[focus]
    return "构图", PRACTICE_LIBRARY["构图"]


def build_attempt_feedback(
    report: dict[str, Any],
    skill_focus: str,
    first_score: int | None = None,
) -> dict[str, str | int]:
    dimension_key = {"构图": "composition", "光线": "exposure", "色彩": "color", "对焦": "focus"}.get(
        skill_focus, "composition"
    )
    detail = _json_object(report.get("benchmark_detail_json")).get(dimension_key, {})
    if not isinstance(detail, dict):
        detail = {}
    score = _score(detail.get("score", report.get(f"{dimension_key}_score")))
    problems = detail.get("problems") if isinstance(detail.get("problems"), list) else []
    key_issue = str(next((item for item in problems if str(item).strip()), "暂未发现明显问题，可以继续提高表达的稳定性。"))
    reason = str(detail.get("reason") or report.get("summary") or "这次尝试已经完成了明确的练习目标。")
    action_map = {
        "构图": report.get("composition_advice"),
        "光线": report.get("lighting_advice"),
        "色彩": report.get("color_advice"),
        "对焦": report.get("shooting_tips"),
    }
    action = str(action_map.get(skill_focus) or report.get("next_step") or "保持同一场景，只改变一个拍摄动作后再试一次。")
    task = PRACTICE_LIBRARY.get(skill_focus, PRACTICE_LIBRARY["构图"])
    reshoot_task = f"保持同一练习主题再拍一组。只执行这个动作：{action}"
    comparison = ""
    if first_score is not None:
        change = score - first_score
        if change > 0:
            comparison = f"复拍在「{skill_focus}」维度比第一次提高了 {change} 分，说明你执行的调整已经产生效果。"
        elif change == 0:
            comparison = f"两次在「{skill_focus}」维度的评分持平。下一轮继续只关注一个动作，会更容易看出变化。"
        else:
            comparison = f"复拍在「{skill_focus}」维度暂时下降了 {abs(change)} 分。先保留这次尝试，回看关键问题后再练会更有价值。"
        reshoot_task = "本周闭环已完成。把这次有效的动作带到下一次真实拍摄中。"
    return {
        "skill_score": score,
        "strength": reason,
        "key_issue": key_issue,
        "action_step": action,
        "reshoot_task": reshoot_task,
        "comparison_summary": comparison,
        "coach_note": str(task["coach_note"]),
    }


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
