from __future__ import annotations

import json

import httpx

from app.core.config import get_settings
from app.models.analysis import AnalysisResult
from app.models.portfolio import PortfolioItem


def build_chat_reply(item: PortfolioItem, analysis: AnalysisResult | None, message: str) -> str:
    settings = get_settings()
    if settings.ai_analysis_enabled and settings.ai_analysis_mode != "mock" and settings.resolved_ai_api_key:
        reply = _call_chat_model(item, analysis, message)
        if reply:
            return reply
    return _mock_chat_reply(item, analysis, message)


def _call_chat_model(item: PortfolioItem, analysis: AnalysisResult | None, message: str) -> str | None:
    settings = get_settings()
    context = _analysis_context(analysis)
    prompt = f"""
你是 LensCoach 的 AI 摄影教练。你正在围绕用户上传的一张具体照片进行追问式指导。
你应该结合这张照片已有的分析结果、目标风格、发布平台和用户问题，给出具体、可执行、分步骤的建议。
不要泛泛而谈。不要说你不能看图，因为系统已经提供了照片和分析上下文。

作品标题：{item.title}
作品描述：{item.description or '无'}
目标风格：{item.target_style or '未设置'}
发布平台：{item.target_platform or '未设置'}
最近一次分析结果：{context}
用户问题：{message}

请用中文回答，控制在 3-6 条建议以内，尽量具体到拍摄动作或修图参数。
""".strip()

    payload = {
        "model": settings.resolved_ai_model,
        "input": [{"role": "user", "content": [{"type": "input_text", "text": prompt}]}],
    }

    try:
        with httpx.Client(timeout=settings.ai_timeout_seconds) as client:
            response = client.post(
                f"{settings.resolved_ai_base_url}/responses",
                headers={"Authorization": f"Bearer {settings.resolved_ai_api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except Exception:
        return None
    return _extract_response_text(data).strip() or None


def _analysis_context(analysis: AnalysisResult | None) -> str:
    if not analysis:
        return "还没有分析结果，请基于作品信息给出保守建议。"
    return json.dumps(
        {
            "photo_type": analysis.photo_type,
            "detected_style": analysis.detected_style,
            "overall_score": analysis.overall_score,
            "target_style_match_score": analysis.target_style_match_score,
            "summary": analysis.summary,
            "composition_advice": analysis.composition_advice,
            "lighting_advice": analysis.lighting_advice,
            "color_advice": analysis.color_advice,
            "editing_params": _safe_json(analysis.editing_params_json),
        },
        ensure_ascii=False,
    )


def _mock_chat_reply(item: PortfolioItem, analysis: AnalysisResult | None, message: str) -> str:
    style = item.target_style or "目标风格"
    platform = item.target_platform or "目标平台"
    if "日系" in message or "清新" in message:
        return "可以这样调：1. 曝光提高 +0.2 到 +0.5；2. 对比度降低 -5 到 -15；3. 高光压到 -10 到 -30；4. 色温略冷 -2 到 -6；5. 降低绿色饱和度，让画面更轻。"
    if "小红书" in message:
        return f"适合发小红书，但建议强化封面感：1. 使用 3:4 或 4:5；2. 主体更靠近画面中心；3. 背景留出标题空间；4. 文案围绕“{style}”和拍摄场景写一个具体经验。"
    if "Lightroom" in message or "参数" in message:
        return "Lightroom 可以先用这组起点：曝光 +0.3、对比度 -8、高光 -20、阴影 +18、自然饱和度 +8、饱和度 -4、清晰度 -3。再根据肤色和高光细节微调。"
    if "构图" in message:
        return "构图上建议先明确主体，再裁掉边缘干扰。如果是人像，眼睛或面部可以靠近三分线交点；如果要发平台封面，保留一侧留白给标题。"
    next_step = analysis.next_step if analysis else "先生成一次摄影建议报告，再继续追问具体方向。"
    return f"围绕“{style}”和“{platform}”，建议先做三步：1. 明确主体和裁切比例；2. 稳定曝光与白平衡；3. 根据发布平台调整色彩和文案。下一步：{next_step}"


def _extract_response_text(data: dict) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"]
    chunks: list[str] = []
    for output in data.get("output", []) or []:
        for content in output.get("content", []) or []:
            text = content.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "\n".join(chunks)


def _safe_json(value: str | None) -> dict:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}
