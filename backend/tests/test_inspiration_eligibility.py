import unittest
from types import SimpleNamespace

from app.services.inspiration import is_photo_eligible


def photo(**overrides):
    values = {
        "is_active": True,
        "moderation_status": "approved",
        "source_type": "unsplash",
        "license_verified": True,
        "license_code": "Unsplash License",
        "recommendation_consent": False,
        "community_visibility": None,
        "authorization_revoked_at": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class InspirationEligibilityTests(unittest.TestCase):
    def test_approved_unsplash_photo_is_eligible(self) -> None:
        self.assertTrue(is_photo_eligible(photo()))

    def test_inactive_or_rejected_photo_is_not_eligible(self) -> None:
        self.assertFalse(is_photo_eligible(photo(is_active=False)))
        self.assertFalse(is_photo_eligible(photo(moderation_status="rejected")))

    def test_openverse_photo_requires_verified_allowed_license(self) -> None:
        self.assertTrue(is_photo_eligible(photo(source_type="openverse", license_code="BY-SA")))
        self.assertFalse(is_photo_eligible(photo(source_type="openverse", license_verified=False, license_code="BY")))
        self.assertFalse(is_photo_eligible(photo(source_type="openverse", license_code="NC")))

    def test_community_photo_stops_when_consent_is_revoked(self) -> None:
        approved = photo(
            source_type="community",
            recommendation_consent=True,
            community_visibility="public",
        )
        revoked = photo(
            source_type="community",
            recommendation_consent=True,
            community_visibility="public",
            authorization_revoked_at=object(),
        )
        self.assertTrue(is_photo_eligible(approved))
        self.assertFalse(is_photo_eligible(revoked))


if __name__ == "__main__":
    unittest.main()
