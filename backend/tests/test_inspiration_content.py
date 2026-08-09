import unittest
from datetime import date

from app.services.inspiration_content import build_content, build_recommendation_reason, detect_category
from app.services.photo_providers import ProviderPhoto


def photo(external_id: str, title: str, tags: str) -> ProviderPhoto:
    return ProviderPhoto(
        source_type="unsplash", external_id=external_id, title=title, description=None,
        image_url="https://images.unsplash.com/photo", thumbnail_url="https://images.unsplash.com/thumb",
        width=1200, height=800, photographer_name="Author", photographer_url="https://unsplash.com/@author",
        source_name="Unsplash", source_page_url="https://unsplash.com/photos/photo", attribution_text="Author · Unsplash",
        tags=tags,
    )


class InspirationContentTests(unittest.TestCase):
    def test_category_uses_title_and_tags(self) -> None:
        self.assertEqual(detect_category("sunset architecture building"), "architecture")
        self.assertEqual(detect_category("a cat in the garden animals"), "animals")

    def test_content_varies_by_subject(self) -> None:
        portrait = build_content(photo("portrait-1", "A woman by a window", "portrait,people"))
        building = build_content(photo("building-1", "Old city building", "architecture"))
        self.assertNotEqual(portrait.poetic_caption, building.poetic_caption)
        self.assertNotEqual(portrait.appreciation_summary, building.appreciation_summary)

    def test_recommendation_reason_varies_by_date(self) -> None:
        model = type("Photo", (), {"id": 7, "title": "Night street", "description": None, "tags": "night,city"})()
        reasons = {build_recommendation_reason(model, date(2026, 7, day), False) for day in range(1, 8)}
        self.assertGreater(len(reasons), 1)


if __name__ == "__main__":
    unittest.main()
