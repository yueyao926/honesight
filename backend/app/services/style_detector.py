from __future__ import annotations

STYLE_OPTIONS = ["清新自然", "日系", "胶片感", "高级灰", "复古", "高饱和", "生活记录", "商业感", "其他"]


def detect_style(model_result: dict, text_hint: str = "") -> dict:
    detected = str(model_result.get("detected_style") or "")
    if detected:
        return {
            "detected_style": detected,
            "style_confidence": _float_confidence(model_result.get("style_confidence")),
            "style_reasoning": str(model_result.get("style_reasoning") or "Model-provided visual style analysis."),
        }

    reasoning = str(model_result.get("style_reasoning") or "")
    confidence = _float_confidence(model_result.get("style_confidence"))

    combined = f"{detected} {reasoning} {text_hint}"
    if detected not in STYLE_OPTIONS:
        detected = _detect_from_text(combined)
        confidence = confidence or 0.62
        reasoning = reasoning or f"根据画面描述和目标风格文本，系统将其归类为“{detected}”。"

    return {
        "detected_style": detected,
        "style_confidence": confidence or 0.7,
        "style_reasoning": reasoning or f"画面特征与“{detected}”较接近。",
    }


def _detect_from_text(text: str) -> str:
    rules = [
        ("清新自然", ["清新", "自然", "通透", "明亮"]),
        ("日系", ["日系", "校园", "低对比", "柔和"]),
        ("胶片感", ["胶片", "颗粒", "film"]),
        ("高级灰", ["高级灰", "低饱和", "克制"]),
        ("复古", ["复古", "怀旧", "暖色"]),
        ("高饱和", ["高饱和", "浓郁", "鲜艳"]),
        ("生活记录", ["生活", "记录", "日常"]),
        ("商业感", ["商业", "产品", "质感"]),
    ]
    for style, keywords in rules:
        if any(keyword in text for keyword in keywords):
            return style
    return "其他"


def _float_confidence(value: object) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, number))
