import mimetypes

from app.core.config import Settings
from app.main import register_image_mime_types


def test_fast_model_defaults_to_the_configured_analysis_model() -> None:
    settings = Settings(
        AI_MODEL="available-vision-model",
        AI_FAST_MODEL="",
    )

    assert settings.resolved_ai_fast_model == "available-vision-model"


def test_webp_mime_type_is_registered_explicitly() -> None:
    mimetypes.add_type("text/plain", ".webp", strict=True)
    try:
        register_image_mime_types()
        assert mimetypes.guess_type("generated.webp")[0] == "image/webp"
    finally:
        register_image_mime_types()
