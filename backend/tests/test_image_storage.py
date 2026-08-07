from io import BytesIO
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from app.services.image_storage import (
    AVATAR_MAX_BYTES,
    AVATAR_SIZE,
    FULL_IMAGE_MAX_BYTES,
    ImageProcessingError,
    REFERENCE_IMAGE_MAX_BYTES,
    REFERENCE_IMAGE_SIZE,
    THUMBNAIL_MAX_BYTES,
    local_upload_path,
    store_image,
    thumbnail_url_for,
    upload_url,
)


def jpeg_bytes(size: tuple[int, int] = (3200, 2400)) -> bytes:
    output = BytesIO()
    Image.effect_noise(size, 80).convert("RGB").save(output, format="JPEG", quality=96)
    return output.getvalue()


class ImageStorageTests(unittest.TestCase):
    def test_full_image_and_thumbnail_are_bounded_webp_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stored = store_image(jpeg_bytes(), root, "7_photo", create_thumbnail=True)

            self.assertEqual(stored.image_path.suffix, ".webp")
            self.assertLessEqual(stored.image_path.stat().st_size, FULL_IMAGE_MAX_BYTES)
            self.assertIsNotNone(stored.thumbnail_path)
            self.assertLessEqual(stored.thumbnail_path.stat().st_size, THUMBNAIL_MAX_BYTES)  # type: ignore[union-attr]
            self.assertLessEqual(stored.width, 2560)
            self.assertLessEqual(stored.height, 2560)

            image_url = upload_url(stored.image_path, root)
            self.assertEqual(local_upload_path(image_url, root), stored.image_path.resolve())
            self.assertEqual(thumbnail_url_for(image_url, root), "/uploads/7_photo_thumb.webp")

    def test_avatar_profile_is_small_and_has_no_thumbnail(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            stored = store_image(
                jpeg_bytes((1200, 900)),
                Path(directory),
                "avatar",
                max_size=AVATAR_SIZE,
                max_bytes=AVATAR_MAX_BYTES,
                quality=80,
            )
            self.assertLessEqual(max(stored.width, stored.height), 512)
            self.assertLessEqual(stored.image_path.stat().st_size, AVATAR_MAX_BYTES)
            self.assertIsNone(stored.thumbnail_path)

    def test_reference_profile_is_bounded_and_has_no_thumbnail(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            stored = store_image(
                jpeg_bytes(),
                Path(directory),
                "reference",
                max_size=REFERENCE_IMAGE_SIZE,
                max_bytes=REFERENCE_IMAGE_MAX_BYTES,
                quality=82,
            )
            self.assertLessEqual(max(stored.width, stored.height), 1920)
            self.assertLessEqual(stored.image_path.stat().st_size, REFERENCE_IMAGE_MAX_BYTES)
            self.assertIsNone(stored.thumbnail_path)

    def test_invalid_image_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ImageProcessingError):
                store_image(b"not an image", Path(directory), "invalid")


if __name__ == "__main__":
    unittest.main()
