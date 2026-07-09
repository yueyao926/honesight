from __future__ import annotations

PLATFORMS = ["小红书", "朋友圈", "Instagram", "作品集", "商业约拍"]


def build_platform_suggestions(target_platform: str, target_style: str, model_result: dict | None = None) -> dict:
    source = model_result.get("platform_suggestions") if model_result else None
    suggestions = source if isinstance(source, dict) else {}
    result = {
        "小红书": {
            "cover_advice": "封面优先突出主体，预留标题空间，第一眼要能看懂照片主题。",
            "caption_advice": "文案可以写拍摄场景、风格关键词和一个具体经验点。",
            "editing_focus": "明亮干净、主体突出、背景不抢戏。",
            "recommended_ratio": "3:4 或 4:5",
        },
        "朋友圈": {
            "editing_focus": "保留真实自然的生活感，不要过度锐化或过度滤镜。",
            "caption_advice": "文字保持轻松，可以突出当天情绪和拍摄地点。",
            "recommended_ratio": "4:3 或 1:1",
        },
        "Instagram": {
            "editing_focus": "统一色调和对比度，让照片在网格中保持系列感。",
            "caption_advice": "用简短英文/中英混合描述氛围和地点。",
            "recommended_ratio": "4:5 或 1:1",
        },
        "作品集": {
            "selection_advice": "优先选择主体表达明确、风格统一且后期克制的版本。",
            "series_advice": "与同组作品保持裁切比例、色调和叙事方向一致。",
            "editing_focus": "保留原始质感，避免平台化滤镜过重。",
        },
        "商业约拍": {
            "cover_advice": "突出交付价值和主体质感，画面需要稳定、清晰、少干扰。",
            "caption_advice": "说明适用场景、拍摄服务和成片风格。",
            "editing_focus": "肤色/产品色准确，细节干净，风格可复制。",
            "recommended_ratio": "4:5 或 16:9",
        },
    }

    for platform, value in suggestions.items():
        if isinstance(value, dict) and platform in result:
            result[platform].update({key: str(val) for key, val in value.items()})

    if target_platform == "小红书":
        result["小红书"]["editing_focus"] = f"围绕“{target_style}”做明亮封面感，主体要比背景更醒目。"
    elif target_platform == "作品集":
        result["作品集"]["editing_focus"] = f"围绕“{target_style}”保持系列一致性，不建议过度修图。"

    return result
