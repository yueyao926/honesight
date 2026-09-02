import unittest
from datetime import date

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.inspiration import DailyInspirationRecommendation, InspirationPhoto
from app.services.inspiration_content import CONTENT_VERSION
from app.services.inspiration_sync import backfill_outdated_content


def stored_photo(source_type: str, external_id: str, content_version: int) -> InspirationPhoto:
    return InspirationPhoto(
        source_type=source_type,
        external_id=external_id,
        title="Old city building",
        description="Architecture and street",
        poetic_caption="旧文案",
        appreciation_summary="旧赏析",
        content_version=content_version,
        image_url="https://images.example/photo",
        thumbnail_url="https://images.example/thumb",
        photographer_name="Author",
        photographer_url="https://example.com/author",
        source_name="Source",
        source_page_url="https://example.com/photo",
        attribution_text="Author · Source",
        tags="architecture,building",
        moderation_status="approved",
    )


class InspirationBackfillTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_updates_provider_content_and_clears_only_target_date(self) -> None:
        target = date(2026, 9, 2)
        with self.Session() as db:
            old = stored_photo("unsplash", "old", 1)
            current = stored_photo("openverse", "current", CONTENT_VERSION)
            community = stored_photo("community", "community", 1)
            db.add_all((old, current, community))
            db.flush()
            db.add_all((
                DailyInspirationRecommendation(user_key="public", photo_id=old.id, recommendation_date=target, position=0, recommendation_reason="旧推荐"),
                DailyInspirationRecommendation(user_key="public", photo_id=current.id, recommendation_date=date(2026, 9, 1), position=0, recommendation_reason="历史推荐"),
            ))
            db.commit()

            result = backfill_outdated_content(db, batch_size=1, reset_date=target)

            self.assertEqual(result.pending, 1)
            self.assertEqual(result.updated, 1)
            self.assertEqual(result.cleared_recommendations, 1)
            self.assertEqual(old.content_version, CONTENT_VERSION)
            self.assertNotEqual(old.poetic_caption, "旧文案")
            self.assertEqual(current.poetic_caption, "旧文案")
            self.assertEqual(community.poetic_caption, "旧文案")
            remaining = list(db.scalars(select(DailyInspirationRecommendation)))
            self.assertEqual(len(remaining), 1)
            self.assertEqual(remaining[0].recommendation_date, date(2026, 9, 1))

    def test_is_idempotent(self) -> None:
        with self.Session() as db:
            db.add(stored_photo("unsplash", "old", 1))
            db.commit()
            first = backfill_outdated_content(db, reset_date=date(2026, 9, 2))
            second = backfill_outdated_content(db, reset_date=date(2026, 9, 2))
            self.assertEqual(first.updated, 1)
            self.assertEqual(second.updated, 0)

    def test_rejects_invalid_batch_size(self) -> None:
        with self.Session() as db:
            with self.assertRaises(ValueError):
                backfill_outdated_content(db, batch_size=0)


if __name__ == "__main__":
    unittest.main()
