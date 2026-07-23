from datetime import date, timedelta
import random

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.inspiration import DailyInspirationRecommendation, InspirationFavorite, InspirationPhoto
from app.models.preference import Preference
from app.services.inspiration_content import GENERIC_CAPTION, GENERIC_SUMMARY, build_content, build_recommendation_reason


ALLOWED_OPENVERSE = {"CC0", "PDM", "BY", "BY-SA"}


def eligible_clause():
    return and_(InspirationPhoto.is_active.is_(True), InspirationPhoto.moderation_status == "approved", or_(
        InspirationPhoto.source_type == "unsplash",
        and_(InspirationPhoto.source_type == "openverse", InspirationPhoto.license_verified.is_(True), InspirationPhoto.license_code.in_(ALLOWED_OPENVERSE)),
        and_(InspirationPhoto.source_type == "community", InspirationPhoto.recommendation_consent.is_(True), InspirationPhoto.community_visibility == "public", InspirationPhoto.authorization_revoked_at.is_(None)),
    ))


def daily_recommendations(db: Session, user_id: int | None, today: date | None = None) -> list[dict]:
    today = today or date.today(); key = str(user_id) if user_id else "public"; settings = get_settings()
    existing = list(db.scalars(select(DailyInspirationRecommendation).where(DailyInspirationRecommendation.user_key == key, DailyInspirationRecommendation.recommendation_date == today).order_by(DailyInspirationRecommendation.position)))
    content_changed = False
    for row in existing:
        if row.photo and (row.photo.poetic_caption == GENERIC_CAPTION or row.photo.appreciation_summary == GENERIC_SUMMARY):
            content = build_content(row.photo)
            row.photo.poetic_caption = content.poetic_caption
            row.photo.appreciation_summary = content.appreciation_summary
            content_changed = True
        if row.photo and row.recommendation_reason == "今日精选：从构图、光线与色彩中寻找新的观察方式":
            row.recommendation_reason = build_recommendation_reason(row.photo, today, False)
            content_changed = True
    if content_changed:
        db.commit()
    if not existing:
        recent_since = today - timedelta(days=settings.inspiration_recent_exclusion_days)
        recent_ids = set(db.scalars(select(DailyInspirationRecommendation.photo_id).where(DailyInspirationRecommendation.user_key == key, DailyInspirationRecommendation.recommendation_date >= recent_since)))
        photos = list(db.scalars(select(InspirationPhoto).where(eligible_clause())))
        candidates = [p for p in photos if p.id not in recent_ids] or photos
        preference = db.scalar(select(Preference).where(Preference.user_id == user_id)) if user_id else None
        interests = f"{preference.preferred_styles or ''},{preference.common_subjects or ''}".lower() if preference else ""
        rng = random.Random(f"{key}:{today.isoformat()}")
        scored = []
        for photo in candidates:
            tags = photo.tags.lower(); match = sum(1 for value in interests.split(",") if value.strip() and value.strip() in tags)
            score = .35 * min(match, 1) + .15 * min(max(photo.quality_score, 0), 1) + .1 * rng.random()
            scored.append((score, rng.random(), photo))
        scored.sort(key=lambda row: (row[0], row[1]), reverse=True)
        selected = scored[:settings.inspiration_daily_count]
        for pos, (score, _, photo) in enumerate(selected):
            personalized = bool(interests and any(x.strip() in photo.tags.lower() for x in interests.split(",") if x.strip()))
            reason = build_recommendation_reason(photo, today, personalized)
            db.add(DailyInspirationRecommendation(user_id=user_id, user_key=key, photo_id=photo.id, recommendation_date=today, position=pos, score=score, recommendation_reason=reason))
        db.commit()
        existing = list(db.scalars(select(DailyInspirationRecommendation).where(DailyInspirationRecommendation.user_key == key, DailyInspirationRecommendation.recommendation_date == today).order_by(DailyInspirationRecommendation.position)))
    favorite_ids = set(db.scalars(select(InspirationFavorite.photo_id).where(InspirationFavorite.user_id == user_id))) if user_id else set()
    return [{"photo": row.photo, "is_favorite": row.photo_id in favorite_ids, "recommendation_reason": row.recommendation_reason} for row in existing if row.photo and row.photo.is_active]
