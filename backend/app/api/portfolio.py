from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.database import get_db
from app.models.portfolio import PhotoTag, PortfolioCollection, PortfolioItem
from app.models.user import User
from app.schemas.portfolio import (
    AddPortfolioPhotoRequest,
    PortfolioCollectionCreate,
    PortfolioCollectionDetail,
    PortfolioCollectionRead,
    PortfolioCollectionUpdate,
    PortfolioPhotoRead,
    SavePhotoToPortfolioRequest,
    SaveOriginalToPortfolioRequest,
    SaveOriginalToPortfolioResponse,
)


router = APIRouter(prefix="/portfolio", tags=["portfolio"])


def _collection_query():
    return select(PortfolioCollection).options(
        selectinload(PortfolioCollection.photos).selectinload(PortfolioItem.tags)
    )


def _get_owned_collection(collection_id: int, user_id: int, db: Session) -> PortfolioCollection:
    collection = db.scalar(
        _collection_query().where(
            PortfolioCollection.id == collection_id,
            PortfolioCollection.user_id == user_id,
        )
    )
    if not collection:
        raise HTTPException(status_code=404, detail="作品集不存在")
    return collection


def _collection_dict(collection: PortfolioCollection, *, include_photos: bool = False) -> dict:
    photos = list(collection.photos)
    result = {
        "id": collection.id,
        "user_id": collection.user_id,
        "name": collection.name,
        "cover_image_url": photos[0].image_url if photos else None,
        "photo_count": len(photos),
        "created_at": collection.created_at,
        "updated_at": collection.updated_at,
    }
    if include_photos:
        result["photos"] = photos
    return result


def _validate_portfolio_image(image_url: str, user_id: int, source: str) -> None:
    """Accept only files owned by this user and keep generated-file provenance honest."""
    if not image_url.startswith("/uploads/"):
        raise HTTPException(status_code=400, detail="只能保存已上传或生成的站内图片")
    filename = Path(image_url).name
    is_generated = "_generated_" in filename
    if not filename.startswith(f"{user_id}_"):
        raise HTTPException(status_code=400, detail="不能保存其他用户的图片")
    if source == "ai_refined" and not is_generated:
        raise HTTPException(status_code=400, detail="找不到对应的 AI 精修图")
    if source != "ai_refined" and is_generated:
        raise HTTPException(status_code=400, detail="AI 精修图必须使用正确的来源标记")
    image_path = (get_settings().upload_path / filename).resolve()
    upload_root = get_settings().upload_path.resolve()
    if upload_root not in image_path.parents or not image_path.is_file():
        raise HTTPException(status_code=400, detail="找不到这张原始照片，请重新上传")


def _append_photo(
    collection: PortfolioCollection,
    payload: AddPortfolioPhotoRequest,
    user_id: int,
    source: str,
    db: Session,
) -> PortfolioItem:
    _validate_portfolio_image(payload.image_url, user_id, source)
    photo = PortfolioItem(
        user_id=user_id,
        collection_id=collection.id,
        image_url=payload.image_url,
        title=(payload.title or "照片").strip() or "照片",
        source=source,
    )
    seen: set[tuple[str, str]] = set()
    for tag in payload.tags:
        key = (tag.tag_type.lower(), tag.name.lower())
        if key in seen:
            continue
        seen.add(key)
        photo.tags.append(PhotoTag(**tag.model_dump()))
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


def _create_collection(name: str, user_id: int, db: Session) -> PortfolioCollection:
    collection = PortfolioCollection(user_id=user_id, name=name)
    db.add(collection)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="已经有同名作品集") from exc
    db.refresh(collection)
    return collection


@router.get("", response_model=list[PortfolioCollectionRead])
def list_portfolios(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    collections = db.scalars(
        _collection_query()
        .where(PortfolioCollection.user_id == current_user.id)
        .order_by(PortfolioCollection.updated_at.desc(), PortfolioCollection.created_at.desc())
    ).all()
    return [_collection_dict(collection) for collection in collections]


@router.post("", response_model=PortfolioCollectionRead, status_code=status.HTTP_201_CREATED)
def create_portfolio(
    payload: PortfolioCollectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    collection = _create_collection(payload.name, current_user.id, db)
    return _collection_dict(collection)


@router.post("/save-original", response_model=SaveOriginalToPortfolioResponse, status_code=status.HTTP_201_CREATED)
def save_original_to_portfolio(
    payload: SaveOriginalToPortfolioRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _validate_portfolio_image(payload.image_url, current_user.id, "ai_original")
    if payload.collection_id:
        collection = _get_owned_collection(payload.collection_id, current_user.id, db)
    else:
        collection = _create_collection(payload.collection_name or "未命名作品集", current_user.id, db)
    photo = _append_photo(collection, payload, current_user.id, "ai_original", db)
    collection = _get_owned_collection(collection.id, current_user.id, db)
    return {"collection": _collection_dict(collection), "photo": photo}


@router.post("/save-photo", response_model=SaveOriginalToPortfolioResponse, status_code=status.HTTP_201_CREATED)
def save_photo_to_portfolio(
    payload: SavePhotoToPortfolioRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _validate_portfolio_image(payload.image_url, current_user.id, payload.source)
    if payload.collection_id:
        collection = _get_owned_collection(payload.collection_id, current_user.id, db)
    else:
        collection = _create_collection(payload.collection_name or "未命名作品集", current_user.id, db)
    photo = _append_photo(collection, payload, current_user.id, payload.source, db)
    collection = _get_owned_collection(collection.id, current_user.id, db)
    return {"collection": _collection_dict(collection), "photo": photo}


@router.get("/{collection_id}", response_model=PortfolioCollectionDetail)
def get_portfolio(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return _collection_dict(
        _get_owned_collection(collection_id, current_user.id, db), include_photos=True
    )


@router.patch("/{collection_id}", response_model=PortfolioCollectionRead)
def rename_portfolio(
    collection_id: int,
    payload: PortfolioCollectionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    collection = _get_owned_collection(collection_id, current_user.id, db)
    collection.name = payload.name
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="已经有同名作品集") from exc
    db.refresh(collection)
    return _collection_dict(collection)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    collection = _get_owned_collection(collection_id, current_user.id, db)
    db.delete(collection)
    db.commit()


@router.post("/{collection_id}/photos", response_model=PortfolioPhotoRead, status_code=status.HTTP_201_CREATED)
def add_portfolio_photo(
    collection_id: int,
    payload: AddPortfolioPhotoRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PortfolioItem:
    collection = _get_owned_collection(collection_id, current_user.id, db)
    return _append_photo(collection, payload, current_user.id, "direct_upload", db)


@router.delete("/{collection_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio_photo(
    collection_id: int,
    photo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    photo = db.scalar(
        select(PortfolioItem).where(
            PortfolioItem.id == photo_id,
            PortfolioItem.collection_id == collection_id,
            PortfolioItem.user_id == current_user.id,
        )
    )
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")
    db.delete(photo)
    db.commit()
