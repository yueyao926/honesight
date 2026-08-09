from __future__ import annotations


def build_mock_vision_result(photo_type: str, target_style: str, target_platform: str) -> dict:
    normalized_type = photo_type if photo_type in {"portrait", "landscape", "food", "street", "campus", "product", "night"} else "general"
    color_reason = "色彩基础较稳定，可以继续围绕目标风格统一白平衡和饱和度。"
    lightroom = {
        "exposure": "+0.2 ~ +0.4",
        "contrast": "-5 ~ +5",
        "highlights": "-15 ~ -25",
        "shadows": "+10 ~ +20",
        "whites": "+0 ~ +8",
        "blacks": "-8 ~ -3",
        "temperature": "0 ~ +3",
        "tint": "0 ~ +4",
        "vibrance": "+5 ~ +12",
        "saturation": "-3 ~ +3",
        "clarity": "0 ~ +6",
        "texture": "0 ~ +8",
        "grain": "0 ~ +5",
    }

    if "日系" in target_style or "清新" in target_style:
        color_reason = "目标风格偏清新日系，建议明亮、低对比、柔和肤色和轻饱和。"
        lightroom.update(
            {
                "exposure": "+0.2 ~ +0.5",
                "contrast": "-5 ~ -15",
                "highlights": "-10 ~ -30",
                "shadows": "+10 ~ +25",
                "temperature": "-2 ~ -6",
                "saturation": "-5 ~ -10",
                "clarity": "-5 ~ +2",
            }
        )
    elif "胶片" in target_style or "复古" in target_style:
        color_reason = "目标风格偏胶片复古，建议暖色、颗粒、低清晰度和暗部层次。"
        lightroom.update(
            {
                "contrast": "-5 ~ +10",
                "highlights": "-20",
                "shadows": "+10",
                "temperature": "+3 ~ +8",
                "grain": "+15 ~ +30",
                "clarity": "-5",
            }
        )
    elif "高级灰" in target_style:
        color_reason = "目标风格偏高级灰，建议低饱和、克制对比和更多留白。"
        lightroom.update(
            {
                "saturation": "-15",
                "vibrance": "-10",
                "contrast": "+5",
                "highlights": "-15",
                "shadows": "+5",
            }
        )

    return {
        "photo_type": normalized_type,
        "detected_style": _detected_style(target_style),
        "style_confidence": 0.72,
        "style_reasoning": "mock 模式根据目标风格、照片类型和平台生成稳定风格判断。",
        "benchmark": {
            "exposure": {
                "score": 76,
                "reason": "主体曝光基础可用，高光和阴影仍有优化空间。",
                "problems": ["局部明暗层次还可以更稳定"],
                "suggestions": ["先调整曝光和阴影，再压住高光保留细节"],
            },
            "focus": {
                "score": 74,
                "reason": "主体清晰度基本可用，但关键区域还可以更锐利。",
                "problems": ["主体关键细节需要更稳定"],
                "suggestions": ["拍摄时确认对焦点，后期少量锐化即可"],
            },
            "composition": {
                "score": 78,
                "reason": "主体关系基本明确，适合继续优化裁切和留白。",
                "problems": ["边缘信息可能分散注意力"],
                "suggestions": ["按三分线微调裁切，减少边缘干扰物"],
            },
            "color": {
                "score": 75,
                "reason": color_reason,
                "problems": ["目标风格统一性还可以提升"],
                "suggestions": ["统一白平衡，再调整饱和度和对比度"],
            },
        },
        "summary": f"这张照片可以围绕“{target_style}”继续优化。当前更适合把重点放在主体表达、明暗层次和平台化呈现上。",
        "target_style_match": {"score": 73, "reason": f"画面基础与“{target_style}”有一定匹配度，但仍需要通过调色和裁切强化。"},
        "composition_advice": "建议减少边缘干扰，让主体靠近视觉中心或三分线位置。",
        "lighting_advice": "建议保留主体亮部细节，适当提亮阴影，避免整体发灰。",
        "color_advice": color_reason,
        "editing_params": {
            "lightroom": lightroom,
            "mobile_apps": {
                "brightness": "+5 ~ +12",
                "contrast": "-5 ~ +5",
                "saturation": "-5 ~ +8",
                "sharpen": "+5 ~ +12",
                "grain": "0 ~ +10",
                "filter_strength": "20% ~ 45%",
            },
        },
        "platform_suggestions": {},
        "shooting_tips": "下一次拍摄时先确定主体位置，再控制背景干扰；如果是人像，优先保证眼部和面部清晰。",
        "next_step": "先按建议完成一次裁切和基础调色，再对比目标风格样张检查色彩是否统一。",
        "expected_effect": {
            "description": f"修图后将更接近「{target_style}」：肤色通透、对比柔和、色彩统一，整体氛围更干净有质感。",
            "style_keywords": [target_style, "柔和", "通透", "统一色调"],
        },
        "confidence": 0.68,
    }


def _detected_style(target_style: str) -> str:
    for style in ["清新自然", "日系", "胶片感", "高级灰", "复古", "高饱和", "生活记录", "商业感"]:
        if style in target_style:
            return style
    return "其他"
