import unittest
from unittest.mock import patch

from app.services.photo_providers import UnsplashProvider


def make_item(number: int) -> dict:
    return {
        "id": f"photo-{number}",
        "description": f"Photo {number}",
        "alt_description": "A test photograph",
        "width": 1600,
        "height": 1200,
        "urls": {
            "regular": f"https://images.unsplash.com/photo-{number}?w=1080",
            "small": f"https://images.unsplash.com/photo-{number}?w=400",
        },
        "links": {"html": f"https://unsplash.com/photos/photo-{number}"},
        "user": {"name": "Photographer", "links": {"html": "https://unsplash.com/@photographer"}},
        "tags": [{"title": "editorial"}],
    }


class UnsplashProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_search_paginates_and_preserves_topic_tags(self) -> None:
        provider = UnsplashProvider()
        pages: list[int] = []

        async def fake_get(_url: str, **kwargs) -> dict:
            page = kwargs["params"]["page"]
            per_page = kwargs["params"]["per_page"]
            pages.append(page)
            start = (page - 1) * 30
            return {"results": [make_item(start + index) for index in range(per_page)]}

        provider._get = fake_get  # type: ignore[method-assign]
        with patch("app.services.photo_providers.get_settings") as settings:
            settings.return_value.unsplash_access_key = "test-key"
            photos = await provider.search("street photography", 65)

        self.assertEqual(len(photos), 65)
        self.assertEqual(pages, [1, 2, 3])
        self.assertIn("street photography", photos[0].tags)
        self.assertIn("editorial", photos[0].tags)
        self.assertEqual(len({photo.external_id for photo in photos}), 65)

    async def test_search_is_disabled_without_key(self) -> None:
        with patch("app.services.photo_providers.get_settings") as settings:
            settings.return_value.unsplash_access_key = None
            self.assertEqual(await UnsplashProvider().search("portrait", 20), [])


if __name__ == "__main__":
    unittest.main()
