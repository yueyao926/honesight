from __future__ import annotations

DIMENSIONS = ["exposure", "focus", "composition", "color"]

PHOTO_TYPE_WEIGHTS: dict[str, dict[str, float]] = {
    "portrait": {"exposure": 0.25, "focus": 0.25, "composition": 0.35, "color": 0.15},
    "landscape": {"exposure": 0.20, "focus": 0.20, "composition": 0.25, "color": 0.35},
    "food": {"exposure": 0.25, "focus": 0.20, "composition": 0.25, "color": 0.30},
    "street": {"exposure": 0.20, "focus": 0.20, "composition": 0.35, "color": 0.25},
    "campus": {"exposure": 0.25, "focus": 0.20, "composition": 0.30, "color": 0.25},
    "product": {"exposure": 0.25, "focus": 0.30, "composition": 0.25, "color": 0.20},
    "night": {"exposure": 0.35, "focus": 0.25, "composition": 0.20, "color": 0.20},
    "general": {"exposure": 0.25, "focus": 0.25, "composition": 0.25, "color": 0.25},
}

WEIGHT_REASONS = {
    "portrait": "系统判断这是一张人像照片，因此构图权重较高；曝光和对焦作为人物表达的基础也占较高比例。",
    "landscape": "系统判断这是一张风景照片，因此色彩氛围和光影层次权重更高。",
    "food": "系统判断这是一张美食照片，因此色彩、新鲜感、曝光和构图需要保持平衡。",
    "street": "系统判断这是一张街拍照片，因此瞬间构图、主体关系和环境秩序更重要。",
    "campus": "系统判断这是一张校园照片，因此清爽光线、构图和色彩氛围更重要。",
    "product": "系统判断这是一张产品照片，因此对焦清晰和主体呈现权重更高。",
    "night": "系统判断这是一张夜景照片，因此曝光稳定和噪点/清晰度控制更重要。",
    "general": "系统无法确认更细照片类型，因此四个基础维度采用均衡权重。",
}


def build_benchmark(model_result: dict, photo_type: str, target_style: str, target_platform: str) -> dict:
    normalized_type = photo_type if photo_type in PHOTO_TYPE_WEIGHTS else "general"
    benchmark = model_result.get("benchmark") if isinstance(model_result.get("benchmark"), dict) else {}
    detail = {}

    for key in DIMENSIONS:
        source = benchmark.get(key) if isinstance(benchmark.get(key), dict) else {}
        score = _clamp_int(source.get("score", _fallback_score(key, target_style, target_platform)))
        detail[key] = {
            "score": score,
            "reason": str(source.get("reason") or _fallback_reason(key, target_style)),
            "problems": _list_of_strings(source.get("problems")) or [_fallback_problem(key)],
            "suggestions": _list_of_strings(source.get("suggestions")) or [_fallback_suggestion(key)],
        }

    weights = PHOTO_TYPE_WEIGHTS[normalized_type]
    overall = round(sum(detail[key]["score"] * weights[key] for key in DIMENSIONS))

    return {
        "photo_type": normalized_type,
        "weights": weights,
        "overall_score": int(overall),
        "benchmark_detail": detail,
        "benchmark_summary": f"基础画面质量 benchmark 为 {overall}，{WEIGHT_REASONS[normalized_type]}",
        "weight_reason": WEIGHT_REASONS[normalized_type],
    }


def _clamp_int(value: object) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        number = 70
    return max(0, min(100, number))


def _list_of_strings(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def _fallback_score(key: str, target_style: str, target_platform: str) -> int:
    base = {"exposure": 76, "focus": 74, "composition": 78, "color": 75}[key]
    if key == "color" and any(word in target_style for word in ["日系", "清新", "胶片", "高级灰"]):
        return base - 2
    if key == "composition" and target_platform == "小红书":
        return base - 1
    return base


def _fallback_reason(key: str, target_style: str) -> str:
    return {
        "exposure": "整体曝光基础可用，但仍需要根据主体和目标风格微调明暗层次。",
        "focus": "主体清晰度基本可用，建议继续确认关键视觉区域的对焦稳定性。",
        "composition": "主体关系基本明确，但可以进一步减少边缘干扰并强化视觉重点。",
        "color": f"色彩方向可以继续向“{target_style or '目标风格'}”统一，避免杂色影响氛围。",
    }[key]


def _fallback_problem(key: str) -> str:
    return {
        "exposure": "高光和阴影层次仍有优化空间。",
        "focus": "关键主体的清晰度需要继续稳定。",
        "composition": "画面边缘信息可能分散注意力。",
        "color": "色彩统一性和风格匹配度仍可提升。",
    }[key]


def _fallback_suggestion(key: str) -> str:
    return {
        "exposure": "后期先微调曝光和阴影，再压住高光，保留主体细节。",
        "focus": "拍摄时提高快门速度，并在主体最重要的位置重新确认对焦。",
        "composition": "尝试按三分线裁剪，减少无关空白或边缘干扰物。",
        "color": "统一白平衡和主色调，再做饱和度与对比度微调。",
    }[key]
