import unittest
from datetime import date

from app.services.inspiration_content import CONTENT, build_content, build_recommendation_reason, detect_category, detect_photo_category
from app.services.photo_providers import ProviderPhoto


def photo(external_id: str, title: str, tags: str, description: str | None = None) -> ProviderPhoto:
    return ProviderPhoto(
        source_type="unsplash", external_id=external_id, title=title, description=description,
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

    def test_ambiguous_or_weak_metadata_falls_back_to_general(self) -> None:
        ambiguous = photo("mixed", "City portrait", "street,portrait")
        weak = photo("weak", "A person-shaped sculpture", "art")
        self.assertEqual(detect_photo_category(ambiguous), "general")
        self.assertEqual(detect_photo_category(weak), "general")

    def test_keywords_match_complete_words(self) -> None:
        self.assertEqual(detect_category("A starling rests on a branch"), "general")
        self.assertEqual(detect_category("A bird and an animal"), "animals")

    def test_description_and_tags_are_scored_separately(self) -> None:
        model = photo("night-1", "After hours", "night", "Dark neon city")
        self.assertEqual(detect_photo_category(model), "night")

    def test_each_category_has_an_expanded_copy_pool(self) -> None:
        for content in CONTENT.values():
            self.assertGreaterEqual(len(content["captions"]), 8)
            self.assertGreaterEqual(len(content["summaries"]), 8)

    def test_recommendation_reason_varies_by_date(self) -> None:
        model = type("Photo", (), {"id": 7, "title": "Night street", "description": None, "tags": "night,city"})()
        reasons = {build_recommendation_reason(model, date(2026, 7, day), False) for day in range(1, 8)}
        self.assertGreater(len(reasons), 1)


if __name__ == "__main__":
    unittest.main()
