from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user, get_optional_user
from app.core.config import get_settings
from app.database import get_db
from app.models.portfolio import PortfolioFavorite, PortfolioItem
from app.models.profile import UserFollow, UserPrivacySetting
from app.models.community import Notification, UserBlock
from app.models.user import User
from app.schemas.portfolio import PortfolioPhotoRead, PortfolioPhotoUpdate
from app.schemas.profile import PrivacyPayload, ProfileRead, ProfileUpdate
from app.services.image_storage import (
    AVATAR_MAX_BYTES,
    AVATAR_SIZE,
    ImageProcessingError,
    delete_local_upload,
    store_image,
    upload_url,
)

router = APIRouter(tags=["profile"])
IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024


def _active_user(user_id: int, db: Session) -> User:
    user = db.scalar(select(User).where(User.id == user_id, User.is_deleted.is_(False)))
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


def _profile(user: User, viewer: User | None, db: Session) -> dict:
    is_self = bool(viewer and viewer.id == user.id)
    work_filter = [PortfolioItem.user_id == user.id]
    if not is_self:
        work_filter.append(PortfolioItem.visibility == "public")
    result = {
        "id": user.id, "username": user.username, "avatar_url": user.avatar_url,
        "signature": user.signature, "bio": user.bio, "location": user.location,
        "photography_level": user.photography_level, "equipment": user.equipment,
        "created_at": user.created_at, "is_self": is_self,
        "work_count": db.scalar(select(func.count()).select_from(PortfolioItem).where(*work_filter)) or 0,
        "following_count": db.scalar(select(func.count()).select_from(UserFollow).where(UserFollow.follower_id == user.id)) or 0,
        "follower_count": db.scalar(select(func.count()).select_from(UserFollow).where(UserFollow.following_id == user.id)) or 0,
        "is_following": bool(viewer and db.scalar(select(UserFollow.id).where(UserFollow.follower_id == viewer.id, UserFollow.following_id == user.id))),
    }
    if is_self:
        result.update(email=user.email, email_verified=user.email_verified,
                      favorite_count=db.scalar(select(func.count()).select_from(PortfolioFavorite).where(PortfolioFavorite.user_id == user.id)) or 0)
    return result


def _work_dict(work: PortfolioItem, viewer: User | None) -> dict:
    return {
        "id": work.id, "user_id": work.user_id, "collection_id": work.collection_id,
        "title": work.title, "description": work.description, "image_url": work.image_url,
        "thumbnail_url": work.thumbnail_url,
        "source": work.source, "visibility": work.visibility, "allow_favorite": work.allow_favorite,
        "is_published_to_community": work.is_published_to_community, "allow_comments": work.allow_comments,
        "favorite_count": len(work.favorites), "view_count": work.view_count,
        "is_favorited": bool(viewer and any(f.user_id == viewer.id for f in work.favorites)),
        "tags": work.tags, "created_at": work.created_at, "updated_at": work.updated_at,
    }


@router.get("/me/profile", response_model=ProfileRead)
def my_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return _profile(current_user, current_user, db)


@router.patch("/me/profile", response_model=ProfileRead)
def update_profile(payload: ProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, key, value.strip() if isinstance(value, str) else value)
    db.commit(); db.refresh(current_user)
    return _profile(current_user, current_user, db)


@router.post("/me/avatar", response_model=ProfileRead)
async def upload_avatar(file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if file.content_type not in IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="头像仅支持 JPG、PNG 或 WEBP")
    content = await file.read(MAX_AVATAR_SIZE + 1)
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=400, detail="头像不能超过 5MB")
    settings = get_settings()
    upload_dir = settings.upload_path / "avatars"
    try:
        stored = await run_in_threadpool(
            store_image,
            content,
            upload_dir,
            f"{current_user.id}_{uuid4().hex}",
            max_size=AVATAR_SIZE,
            max_bytes=AVATAR_MAX_BYTES,
            quality=80,
        )
    except ImageProcessingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    previous_avatar_url = current_user.avatar_url
    current_user.avatar_url = upload_url(stored.image_path, settings.upload_path)
    db.commit(); db.refresh(current_user)
    delete_local_upload(previous_avatar_url, settings.upload_path)
    return _profile(current_user, current_user, db)


@router.delete("/me/avatar", response_model=ProfileRead)
def reset_avatar(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    previous_avatar_url = current_user.avatar_url
    current_user.avatar_url = None
    db.commit(); db.refresh(current_user)
    delete_local_upload(previous_avatar_url, get_settings().upload_path)
    return _profile(current_user, current_user, db)


@router.get("/me/privacy", response_model=PrivacyPayload)
def get_privacy(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserPrivacySetting:
    setting = db.scalar(select(UserPrivacySetting).where(UserPrivacySetting.user_id == current_user.id))
    if not setting:
        setting = UserPrivacySetting(user_id=current_user.id); db.add(setting); db.commit(); db.refresh(setting)
    return setting


@router.put("/me/privacy", response_model=PrivacyPayload)
def update_privacy(payload: PrivacyPayload, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserPrivacySetting:
    setting = db.scalar(select(UserPrivacySetting).where(UserPrivacySetting.user_id == current_user.id)) or UserPrivacySetting(user_id=current_user.id)
    for key, value in payload.model_dump().items(): setattr(setting, key, value)
    db.add(setting); db.commit(); db.refresh(setting); return setting


@router.get("/users/{user_id}/profile", response_model=ProfileRead)
def public_profile(user_id: int, viewer: User | None = Depends(get_optional_user), db: Session = Depends(get_db)) -> dict:
    return _profile(_active_user(user_id, db), viewer, db)


@router.get("/users/{user_id}/works", response_model=list[PortfolioPhotoRead])
def public_works(user_id: int, page: int = Query(1, ge=1), page_size: int = Query(24, ge=1, le=50), viewer: User | None = Depends(get_optional_user), db: Session = Depends(get_db)) -> list[dict]:
    _active_user(user_id, db)
    query = select(PortfolioItem).options(selectinload(PortfolioItem.tags), selectinload(PortfolioItem.favorites)).where(PortfolioItem.user_id == user_id)
    if not viewer or viewer.id != user_id: query = query.where(PortfolioItem.visibility == "public")
    works = db.scalars(query.order_by(PortfolioItem.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return [_work_dict(work, viewer) for work in works]


@router.patch("/works/{work_id}", response_model=PortfolioPhotoRead)
def update_work(work_id: int, payload: PortfolioPhotoUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    work = db.scalar(select(PortfolioItem).options(selectinload(PortfolioItem.tags), selectinload(PortfolioItem.favorites)).where(PortfolioItem.id == work_id, PortfolioItem.user_id == current_user.id))
    if not work: raise HTTPException(status_code=404, detail="作品不存在")
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(work, key, value.strip() if isinstance(value, str) else value)
    db.commit(); db.refresh(work); return _work_dict(work, current_user)


@router.get("/me/favorites", response_model=list[PortfolioPhotoRead])
def my_favorites(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    works = db.scalars(select(PortfolioItem).join(PortfolioFavorite).options(selectinload(PortfolioItem.tags), selectinload(PortfolioItem.favorites)).where(PortfolioFavorite.user_id == current_user.id, PortfolioItem.visibility == "public").order_by(PortfolioFavorite.created_at.desc())).all()
    return [_work_dict(work, current_user) for work in works]


@router.post("/works/{work_id}/favorite", status_code=status.HTTP_201_CREATED)
def favorite(work_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    work = db.scalar(select(PortfolioItem).where(PortfolioItem.id == work_id, PortfolioItem.visibility == "public", PortfolioItem.allow_favorite.is_(True)))
    if not work: raise HTTPException(status_code=404, detail="作品不可收藏")
    db.add(PortfolioFavorite(user_id=current_user.id, work_id=work_id))
    try: db.commit()
    except IntegrityError: db.rollback()
    return {"favorited": True}


@router.delete("/works/{work_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
def unfavorite(work_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    favorite_row = db.scalar(select(PortfolioFavorite).where(PortfolioFavorite.user_id == current_user.id, PortfolioFavorite.work_id == work_id))
    if favorite_row: db.delete(favorite_row); db.commit()


@router.post("/users/{user_id}/follow", status_code=status.HTTP_201_CREATED)
def follow(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if user_id == current_user.id: raise HTTPException(status_code=400, detail="不能关注自己")
    _active_user(user_id, db)
    if db.scalar(select(UserBlock.id).where(or_(
        (UserBlock.blocker_id == current_user.id) & (UserBlock.blocked_id == user_id),
        (UserBlock.blocker_id == user_id) & (UserBlock.blocked_id == current_user.id),
    ))):
        raise HTTPException(status_code=403, detail="拉黑关系下不能关注")
    db.add(UserFollow(follower_id=current_user.id, following_id=user_id))
    privacy = db.scalar(select(UserPrivacySetting).where(UserPrivacySetting.user_id == user_id))
    if not privacy or privacy.allow_follow_notifications:
        db.add(Notification(recipient_id=user_id, actor_id=current_user.id, notification_type="follow"))
    try: db.commit()
    except IntegrityError: db.rollback()
    return {"following": True}


@router.delete("/users/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    row = db.scalar(select(UserFollow).where(UserFollow.follower_id == current_user.id, UserFollow.following_id == user_id))
    if row: db.delete(row); db.commit()


def _user_list(user_id: int, followers: bool, page: int, page_size: int, viewer: User | None, db: Session) -> list[dict]:
    privacy = db.scalar(select(UserPrivacySetting).where(UserPrivacySetting.user_id == user_id))
    if privacy and not (privacy.show_followers if followers else privacy.show_following) and (not viewer or viewer.id != user_id):
        raise HTTPException(status_code=403, detail="该列表未公开")
    target = UserFollow.follower_id if followers else UserFollow.following_id
    condition = UserFollow.following_id == user_id if followers else UserFollow.follower_id == user_id
    users = db.scalars(select(User).join(UserFollow, User.id == target).where(condition, User.is_deleted.is_(False)).offset((page - 1) * page_size).limit(page_size)).all()
    return [_profile(user, viewer, db) for user in users]


@router.get("/users/{user_id}/followers", response_model=list[ProfileRead])
def followers(user_id: int, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50), viewer: User | None = Depends(get_optional_user), db: Session = Depends(get_db)) -> list[dict]:
    return _user_list(user_id, True, page, page_size, viewer, db)


@router.get("/users/{user_id}/following", response_model=list[ProfileRead])
def following(user_id: int, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50), viewer: User | None = Depends(get_optional_user), db: Session = Depends(get_db)) -> list[dict]:
    return _user_list(user_id, False, page, page_size, viewer, db)
