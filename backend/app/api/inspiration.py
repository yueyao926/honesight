from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_user
from app.database import get_db
from app.models.inspiration import InspirationFavorite, InspirationPhoto
from app.models.user import User
from app.schemas.inspiration import BulkSyncRequest, InspirationRead, ModerationRequest, SyncRequest
from app.services.inspiration import daily_recommendations, eligible_clause
from app.services.inspiration_sync import add_provider_photos, sync_unsplash_topics
from app.services.photo_providers import OpenverseProvider, UnsplashProvider

router = APIRouter(prefix="/inspirations", tags=["inspirations"])


def serialize(photo: InspirationPhoto, favorite: bool = False, reason: str | None = None) -> InspirationRead:
    values = {key: getattr(photo, key) for key in InspirationRead.model_fields if key not in {"tags", "is_favorite", "recommendation_reason"} and hasattr(photo, key)}
    return InspirationRead(**values, tags=[x for x in photo.tags.split(",") if x], is_favorite=favorite, recommendation_reason=reason)


@router.get("/today", response_model=list[InspirationRead])
def today(user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)) -> list[InspirationRead]:
    return [serialize(row["photo"], row["is_favorite"], row["recommendation_reason"]) for row in daily_recommendations(db, user.id if user else None)]


@router.get("/favorites", response_model=list[InspirationRead])
def favorites(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[InspirationRead]:
    photos = list(db.scalars(select(InspirationPhoto).join(InspirationFavorite).where(InspirationFavorite.user_id == user.id, eligible_clause())))
    return [serialize(photo, True) for photo in photos]


@router.get("/{photo_id}", response_model=InspirationRead)
def detail(photo_id: int, user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)) -> InspirationRead:
    photo = db.scalar(select(InspirationPhoto).where(InspirationPhoto.id == photo_id, eligible_clause()))
    if not photo: raise HTTPException(404, "作品不存在或已下架")
    favorite = bool(user and db.scalar(select(InspirationFavorite).where(InspirationFavorite.user_id == user.id, InspirationFavorite.photo_id == photo_id)))
    return serialize(photo, favorite)


@router.put("/{photo_id}/favorite", response_model=InspirationRead)
def favorite(photo_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> InspirationRead:
    photo = db.scalar(select(InspirationPhoto).where(InspirationPhoto.id == photo_id, eligible_clause()))
    if not photo: raise HTTPException(404, "作品不存在或已下架")
    current = db.scalar(select(InspirationFavorite).where(InspirationFavorite.user_id == user.id, InspirationFavorite.photo_id == photo_id))
    if not current: db.add(InspirationFavorite(user_id=user.id, photo_id=photo_id)); db.commit()
    return serialize(photo, True)


@router.delete("/{photo_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
def unfavorite(photo_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    current = db.scalar(select(InspirationFavorite).where(InspirationFavorite.user_id == user.id, InspirationFavorite.photo_id == photo_id))
    if current: db.delete(current); db.commit()


def require_admin(user: User) -> None:
    from app.core.config import get_settings
    allowed = {x.strip().lower() for x in get_settings().inspiration_admin_emails.split(",") if x.strip()}
    if user.email.lower() not in allowed: raise HTTPException(403, "需要管理员权限")


@router.post("/admin/sync/{provider}")
async def sync(provider: str, payload: SyncRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_admin(user)
    source = UnsplashProvider() if provider == "unsplash" else OpenverseProvider() if provider == "openverse" else None
    if not source: raise HTTPException(400, "不支持的图片来源")
    try: photos = await source.search(payload.query, payload.count)
    except Exception as exc: raise HTTPException(502, "图片来源暂时不可用") from exc
    added = add_provider_photos(db, photos)
    return {"received": len(photos), "created": added}


@router.post("/admin/sync-all")
async def sync_all(payload: BulkSyncRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_admin(user)
    result = await sync_unsplash_topics(db, topics=payload.topics, per_topic=payload.per_topic)
    return result.to_dict()


@router.patch("/admin/{photo_id}/moderation")
def moderate(photo_id: int, payload: ModerationRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    require_admin(user); photo = db.get(InspirationPhoto, photo_id)
    if not photo: raise HTTPException(404, "作品不存在")
    photo.moderation_status = "approved" if payload.approved else "rejected"; photo.license_verified = payload.license_verified
    photo.moderation_note = payload.note; photo.verified_at = datetime.now(timezone.utc); photo.verified_by = user.id
    db.commit(); return {"id": photo.id, "moderation_status": photo.moderation_status, "license_verified": photo.license_verified}
