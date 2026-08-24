import json
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.database import Base
from app.core.config import Settings
from app.api import analyze as analyze_api
from app.models.analysis import AnalysisJob
from app.models.user import User
from app.services import analysis_cache, analyzer, signed_media, vision_analyzer
from app.services.analysis_cache import build_analysis_cache_key, run_cached_analysis
from app.services.image_storage import ANALYSIS_IMAGE_MAX_BYTES, ANALYSIS_IMAGE_SIZE, store_image


def test_analysis_cache_reuses_the_same_image_and_parameters(tmp_path, monkeypatch) -> None:
    upload_root = tmp_path / "uploads"
    upload_root.mkdir()
    (upload_root / "photo.webp").write_bytes(b"same-photo-content")
    settings = SimpleNamespace(
        upload_path=upload_root,
        ai_analysis_mode="api",
        resolved_ai_model="vision-test",
        analysis_cache_ttl_hours=24,
    )
    monkeypatch.setattr(analysis_cache, "get_settings", lambda: settings)

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    user = User(username="cache-user", email="cache@example.com", hashed_password="x")
    db.add(user)
    db.commit()
    key = build_analysis_cache_key(
        profile="full-v2",
        image_url="/uploads/photo.webp",
        user_id=user.id,
        parameters={"style": "自然"},
    )
    calls = 0

    def analyze() -> dict:
        nonlocal calls
        calls += 1
        return {"summary": "cached"}

    first, first_hit = run_cached_analysis(
        db,
        user_id=user.id,
        cache_key=key,
        profile="full-v2",
        model_used="vision-test",
        analyze=analyze,
    )
    db.commit()
    second, second_hit = run_cached_analysis(
        db,
        user_id=user.id,
        cache_key=key,
        profile="full-v2",
        model_used="vision-test",
        analyze=analyze,
    )
    assert first == second == {"summary": "cached"}
    assert first_hit is False
    assert second_hit is True
    assert calls == 1
    db.close()


def test_signed_ai_media_url_is_short_lived_and_tamper_protected(tmp_path, monkeypatch) -> None:
    upload_root = tmp_path / "uploads"
    upload_root.mkdir()
    image_path = upload_root / "photo.webp"
    image_path.write_bytes(b"image")
    settings = SimpleNamespace(
        upload_path=upload_root,
        resolved_ai_public_api_base_url="https://lens.example/api",
        jwt_secret_key="test-secret",
    )
    monkeypatch.setattr(signed_media, "get_settings", lambda: settings)

    url = signed_media.build_ai_media_url("/uploads/photo.webp")
    assert url and url.startswith("https://lens.example/api/upload/ai-media/")
    token = url.rsplit("/", 1)[-1]
    assert signed_media.resolve_ai_media_token(token) == image_path.resolve()
    assert signed_media.resolve_ai_media_token(f"{token}x") is None


def test_public_ai_media_url_is_never_inferred_from_cors() -> None:
    settings = Settings(
        BACKEND_CORS_ORIGINS="https://lens.example",
        AI_PUBLIC_API_BASE_URL="",
    )

    assert settings.resolved_ai_public_api_base_url == ""


def test_explicit_public_ai_media_url_is_normalized() -> None:
    settings = Settings(AI_PUBLIC_API_BASE_URL="https://lens.example/api/")

    assert settings.resolved_ai_public_api_base_url == "https://lens.example/api"


def test_practice_model_defaults_to_fast_vision_model() -> None:
    settings = Settings(
        AI_MODEL="full-vision",
        AI_FAST_MODEL="fast-vision",
        AI_PRACTICE_MODEL="",
    )

    assert settings.resolved_ai_fast_model == "fast-vision"
    assert settings.resolved_ai_practice_model == "fast-vision"


def test_valid_analysis_webp_is_not_encoded_twice(tmp_path) -> None:
    output = BytesIO()
    Image.new("RGB", (800, 600), (50, 90, 120)).save(output, format="WEBP", quality=80)
    content = output.getvalue()
    stored = store_image(
        content,
        Path(tmp_path),
        "analysis",
        max_size=ANALYSIS_IMAGE_SIZE,
        max_bytes=ANALYSIS_IMAGE_MAX_BYTES,
        create_thumbnail=False,
    )
    assert stored.image_path.read_bytes() == content
    assert stored.thumbnail_path is None


def test_vision_input_prefers_signed_url_over_base64(monkeypatch) -> None:
    monkeypatch.setattr(
        vision_analyzer,
        "build_ai_media_url",
        lambda _image_url: "https://lens.example/api/upload/ai-media/token",
    )
    assert vision_analyzer._resolve_image_input("/uploads/photo.webp") == (
        "https://lens.example/api/upload/ai-media/token"
    )


def test_full_analysis_has_no_output_cap_and_retries_invalid_json(monkeypatch) -> None:
    settings = SimpleNamespace(
        ai_analysis_enabled=True,
        ai_analysis_mode="api",
        resolved_ai_api_key="test-key",
        resolved_ai_model="vision-test",
    )
    payloads = []
    responses = iter(
        [
            {"status": "incomplete", "incomplete_details": {"reason": "max_output_tokens"}, "output_text": '{"photo_type":'},
            {"status": "completed", "output_text": '{"photo_type":"portrait"}'},
        ]
    )
    monkeypatch.setattr(vision_analyzer, "get_settings", lambda: settings)
    monkeypatch.setattr(vision_analyzer, "_resolve_image_input", lambda _url: "data:image/webp;base64,dGVzdA==")

    def post(payload):
        payloads.append(payload)
        return next(responses)

    monkeypatch.setattr(vision_analyzer, "_post_vision_request", post)
    result = vision_analyzer.call_vision_model(
        image_url="/uploads/photo.webp",
        preference=None,
        target_style="自然",
        target_platform="作品集",
        title="测试照片",
        description=None,
        category=None,
    )

    assert result["photo_type"] == "portrait"
    assert len(payloads) == 2
    assert "max_output_tokens" not in payloads[0]
    assert "max_output_tokens" not in payloads[1]


def test_quick_analysis_uses_compact_fast_request(monkeypatch) -> None:
    settings = SimpleNamespace(
        ai_analysis_enabled=True,
        resolved_ai_api_key="test-key",
        resolved_ai_fast_model="fast-vision",
        resolved_ai_model="full-vision",
        ai_fast_timeout_seconds=8,
    )
    payloads = []
    monkeypatch.setattr(vision_analyzer, "get_settings", lambda: settings)
    monkeypatch.setattr(vision_analyzer, "_resolve_image_input", lambda _url: "data:image/webp;base64,dGVzdA==")

    def post(payload, **_kwargs):
        payloads.append(payload.copy())
        return {
            "output_text": json.dumps(
                {
                    "photo_type": "portrait",
                    "detected_style": "自然",
                    "scores": {
                        "exposure": 80,
                        "focus": 81,
                        "composition": 62,
                        "color": 78,
                    },
                    "priority_issue": "背景杂乱",
                    "primary_ability": "构图",
                    "summary": "主体不够突出",
                    "suggestion": "让人物离背景三步",
                    "confidence": 0.9,
                },
                ensure_ascii=False,
            )
        }

    monkeypatch.setattr(vision_analyzer, "_post_vision_request", post)
    result = vision_analyzer.call_quick_vision_model(
        image_url="/uploads/photo.webp",
        target_style="自然",
        target_platform="作品集",
    )

    assert result["priority_issue"] == "背景杂乱"
    assert result["exposure_score"] == 80
    assert result["composition_score"] == 62
    assert result["model_used"] == "fast-vision"
    assert payloads[0]["model"] == "fast-vision"
    assert payloads[0]["max_output_tokens"] == 360
    assert payloads[0]["thinking"] == {"type": "disabled"}


def test_details_request_is_text_only_with_bounded_fallback(monkeypatch) -> None:
    settings = SimpleNamespace(
        ai_analysis_enabled=True,
        resolved_ai_api_key="test-key",
        resolved_ai_fast_model="fast-vision",
        resolved_ai_model="full-vision",
        ai_fast_timeout_seconds=8,
    )
    calls = []
    monkeypatch.setattr(vision_analyzer, "get_settings", lambda: settings)

    def post(payload, **kwargs):
        calls.append((payload, kwargs))
        return {
            "output_text": json.dumps(
                {
                    "editing_params": {
                        "lightroom": {
                            "曝光": "+0.20",
                            "对比度": "-4",
                            "高光": "-20",
                            "阴影": "+15",
                            "色温": "-3",
                            "饱和度": "-6",
                            "清晰度": "+5",
                        },
                        "mobile_apps": {
                            "亮度": "+5",
                            "对比度": "-4",
                            "高光": "-20",
                            "阴影": "+12",
                            "色温": "-3",
                            "饱和度": "-5",
                            "锐化": "+8",
                        },
                    },
                    "platform_suggestion": {
                        "crop_ratio": "4:5",
                        "visual_priority": "人物眼睛",
                        "publishing_advice": "使用干净封面",
                    },
                },
                ensure_ascii=False,
            )
        }

    monkeypatch.setattr(vision_analyzer, "_post_fast_vision_request", post)
    result = vision_analyzer.call_analysis_details_model(
        image_url="/uploads/photo.webp",
        target_style="自然",
        target_platform="小红书",
        analysis_summary='{"summary":"主体清晰"}',
    )

    payload, kwargs = calls[0]
    user_content = payload["input"][1]["content"]
    assert [item["type"] for item in user_content] == ["input_text"]
    assert kwargs == {"profile": "details", "fallback_timeout_seconds": 16}
    assert payload["thinking"] == {"type": "disabled"}
    assert result["platform_suggestions"]["小红书"]["crop_ratio"] == "4:5"


def test_quick_core_cache_returns_four_dimension_scores(tmp_path, monkeypatch) -> None:
    settings = SimpleNamespace(
        upload_path=tmp_path,
        ai_analysis_mode="mock",
        resolved_ai_fast_model="fast-vision",
        resolved_ai_model="full-vision",
        analysis_cache_ttl_hours=24,
    )
    monkeypatch.setattr(analyzer, "get_settings", lambda: settings)
    monkeypatch.setattr(analysis_cache, "get_settings", lambda: settings)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    user = User(username="quick-user", email="quick@example.com", hashed_password="x")
    db.add(user)
    db.commit()

    first, first_hit = analyzer.analyze_quick_context_cached(
        db=db,
        user_id=user.id,
        image_url="https://example.com/photo.webp",
        target_style="自然",
        target_platform="作品集",
    )
    db.commit()
    second, second_hit = analyzer.analyze_quick_context_cached(
        db=db,
        user_id=user.id,
        image_url="https://example.com/photo.webp",
        target_style="自然",
        target_platform="作品集",
    )

    assert first_hit is False
    assert second_hit is True
    assert first == second
    assert all(first[f"{key}_score"] > 0 for key in ("exposure", "focus", "composition", "color"))
    db.close()


def test_quick_cache_key_changes_with_target_style(tmp_path, monkeypatch) -> None:
    settings = SimpleNamespace(
        upload_path=tmp_path,
        ai_analysis_mode="api",
        resolved_ai_fast_model="fast-vision",
        resolved_ai_model="full-vision",
    )
    monkeypatch.setattr(analyzer, "get_settings", lambda: settings)
    monkeypatch.setattr(analysis_cache, "get_settings", lambda: settings)
    common = {
        "user_id": 7,
        "image_url": "https://example.com/photo.webp",
        "target_style": "自然",
        "target_platform": "作品集",
    }

    natural = analyzer.build_quick_analysis_cache_key(**common)
    common["target_style"] = "电影感"
    cinematic = analyzer.build_quick_analysis_cache_key(**common)

    assert natural != cinematic


def test_job_creation_reuses_the_active_job(tmp_path, monkeypatch) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'jobs.db'}")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    user = User(username="job-user", email="job@example.com", hashed_password="x")
    db.add(user)
    db.commit()
    monkeypatch.setattr(analyze_api, "get_cached_analysis", lambda *_args: None)

    first, first_created = analyze_api._get_or_create_analysis_job(
        db,
        user_id=user.id,
        cache_key="a" * 64,
        kind="preview_quick",
        request_json='{"image_url":"/uploads/photo.webp"}',
    )
    second, second_created = analyze_api._get_or_create_analysis_job(
        db,
        user_id=user.id,
        cache_key="a" * 64,
        kind="preview_quick",
        request_json='{"image_url":"/uploads/photo.webp"}',
    )

    assert first_created is True
    assert second_created is False
    assert second["id"] == first["id"]
    assert db.query(AnalysisJob).count() == 1
    db.close()


def test_fast_model_failure_falls_back_to_full_model(monkeypatch) -> None:
    settings = SimpleNamespace(resolved_ai_model="full-vision", ai_fast_timeout_seconds=8)
    payload = {"model": "fast-vision", "thinking": {"type": "disabled"}, "input": []}
    calls = []
    monkeypatch.setattr(vision_analyzer, "get_settings", lambda: settings)

    def post(current, **kwargs):
        calls.append((current["model"], kwargs["timeout_seconds"]))
        if len(calls) == 1:
            raise vision_analyzer.VisionAnalysisError("fast model unavailable")
        return {"output_text": "{}"}

    monkeypatch.setattr(vision_analyzer, "_post_vision_request", post)
    result = vision_analyzer._post_fast_vision_request(
        payload,
        profile="quick",
        fallback_timeout_seconds=16,
    )

    assert result == {"output_text": "{}"}
    assert calls == [("fast-vision", 8), ("full-vision", 16)]
    assert payload["model"] == "full-vision"
    assert payload["thinking"] == {"type": "disabled"}


def test_deep_prompt_defers_editing_and_platform_details() -> None:
    prompt = vision_analyzer._build_user_prompt(
        title="测试照片",
        description=None,
        category="portrait",
        preference=None,
        target_style="自然",
        target_platform="作品集",
        style_reference_urls=None,
    )

    assert '"editing_params"' not in prompt
    assert '"platform_suggestions"' not in prompt
    assert '"benchmark"' in prompt
