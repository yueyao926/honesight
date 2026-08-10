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
from app.models.user import User
from app.services import analysis_cache, signed_media, vision_analyzer
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
