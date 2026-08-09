import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image

from app.services.image_generator import generate_edited_image


class FakeResponse:
    def __init__(self, *, data=None, content=b"", content_type="application/json"):
        self._data = data
        self.content = content
        self.headers = {"content-type": content_type}

    def raise_for_status(self) -> None:
        return None

    def json(self):
        return self._data


class FakeClient:
    last_post_json = None

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def post(self, *args, **kwargs):
        type(self).last_post_json = kwargs.get("json")
        return FakeResponse(data={"data": [{"url": "https://images.example.com/generated.png"}]})

    def get(self, *args, **kwargs):
        output = BytesIO()
        Image.new("RGB", (1200, 800), (80, 120, 180)).save(output, format="PNG")
        return FakeResponse(content=output.getvalue(), content_type="image/png")


class ImageGeneratorTests(unittest.TestCase):
    def test_generated_image_is_downloaded_to_local_uploads(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            settings = SimpleNamespace(
                image_generation_enabled=True,
                resolved_image_api_key="test-key",
                resolved_image_base_url="https://api.example.com/v3",
                image_model="test-image-model",
                image_size="2K",
                image_watermark=False,
                image_timeout_seconds=10,
                upload_path=Path(directory),
            )
            with (
                patch("app.services.image_generator.get_settings", return_value=settings),
                patch("app.services.image_generator.httpx.Client", FakeClient),
                patch("app.services.image_generator.generate_editing_strategy", return_value=None),
            ):
                result = generate_edited_image(
                    image_url="https://images.example.com/source.jpg",
                    user_id=12,
                    target_style="电影感",
                    target_platform="作品集",
                )

            self.assertEqual(result["model"], "test-image-model")
            self.assertTrue(result["image_url"].startswith("/uploads/12_generated_"))
            self.assertTrue((Path(directory) / result["image_url"].removeprefix("/uploads/")).is_file())
            self.assertTrue(result["thumbnail_url"].endswith("_thumb.webp"))
            self.assertTrue((Path(directory) / result["thumbnail_url"].removeprefix("/uploads/")).is_file())
            self.assertNotIn("sequential_image_generation", FakeClient.last_post_json)


if __name__ == "__main__":
    unittest.main()
