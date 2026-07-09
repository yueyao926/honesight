from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator


class AnalyzeRequest(BaseModel):
    portfolio_item_id: int
    target_style: str | None = None
    target_platform: str | None = None


class AnalysisRead(BaseModel):
    id: int
    portfolio_item_id: int
    user_id: int
    photo_type: str
    detected_style: str
    style_confidence: float
    style_reasoning: str
    exposure_score: int
    focus_score: int
    composition_score: int
    color_score: int
    exposure_weight: float
    focus_weight: float
    composition_weight: float
    color_weight: float
    overall_score: int
    target_style_match_score: int
    benchmark_detail: dict[str, Any]
    summary: str
    composition_advice: str
    lighting_advice: str
    color_advice: str
    editing_params: dict[str, Any]
    platform_suggestions: dict[str, Any]
    shooting_tips: str
    next_step: str
    analysis_mode: str
    model_used: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("style_confidence", "exposure_weight", "focus_weight", "composition_weight", "color_weight", mode="before")
    @classmethod
    def parse_float(cls, value: Any) -> float:
        return float(value or 0)

    @field_validator("benchmark_detail", mode="before")
    @classmethod
    def parse_benchmark(cls, value: Any, info: Any) -> dict[str, Any]:
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            return _json_loads(value)
        data = info.data
        raw = data.get("benchmark_detail_json") if isinstance(data, dict) else None
        return _json_loads(raw)

    @field_validator("editing_params", "platform_suggestions", mode="before")
    @classmethod
    def parse_json_fields(cls, value: Any) -> dict[str, Any]:
        if isinstance(value, dict):
            return value
        return _json_loads(value)


class ChatMessageRead(BaseModel):
    id: int
    portfolio_item_id: int
    user_id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    message: str


class ChatReply(BaseModel):
    reply: str
    created_at: datetime


def analysis_to_read_dict(analysis: Any) -> dict[str, Any]:
    return {
        "id": analysis.id,
        "portfolio_item_id": analysis.portfolio_item_id,
        "user_id": analysis.user_id,
        "photo_type": analysis.photo_type,
        "detected_style": analysis.detected_style,
        "style_confidence": float(analysis.style_confidence or 0),
        "style_reasoning": analysis.style_reasoning,
        "exposure_score": analysis.exposure_score,
        "focus_score": analysis.focus_score,
        "composition_score": analysis.composition_score,
        "color_score": analysis.color_score,
        "exposure_weight": float(analysis.exposure_weight or 0),
        "focus_weight": float(analysis.focus_weight or 0),
        "composition_weight": float(analysis.composition_weight or 0),
        "color_weight": float(analysis.color_weight or 0),
        "overall_score": analysis.overall_score,
        "target_style_match_score": analysis.target_style_match_score,
        "benchmark_detail": _json_loads(analysis.benchmark_detail_json),
        "summary": analysis.summary,
        "composition_advice": analysis.composition_advice,
        "lighting_advice": analysis.lighting_advice,
        "color_advice": analysis.color_advice,
        "editing_params": _json_loads(analysis.editing_params_json or analysis.editing_params),
        "platform_suggestions": _json_loads(analysis.platform_suggestions_json),
        "shooting_tips": analysis.shooting_tips,
        "next_step": analysis.next_step,
        "analysis_mode": analysis.analysis_mode,
        "model_used": analysis.model_used,
        "created_at": analysis.created_at,
    }


def _json_loads(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}
