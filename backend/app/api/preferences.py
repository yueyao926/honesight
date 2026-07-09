from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.preference import Preference
from app.models.user import User
from app.schemas.preference import PreferenceCreate, PreferenceRead, PreferenceUpdate


router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("/me", response_model=PreferenceRead)
def get_my_preferences(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Preference:
    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    if not preference:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return preference


@router.post("/me", response_model=PreferenceRead, status_code=status.HTTP_201_CREATED)
def create_my_preferences(
    payload: PreferenceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Preference:
    existing = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    if existing:
        raise HTTPException(status_code=400, detail="Preferences already exist")
    preference = Preference(user_id=current_user.id, **payload.model_dump())
    db.add(preference)
    db.commit()
    db.refresh(preference)
    return preference


@router.put("/me", response_model=PreferenceRead)
def update_my_preferences(
    payload: PreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Preference:
    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    if not preference:
        preference = Preference(user_id=current_user.id)
        db.add(preference)
    for key, value in payload.model_dump().items():
        setattr(preference, key, value)
    db.commit()
    db.refresh(preference)
    return preference
