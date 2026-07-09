from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.analysis import AnalysisResult
from app.models.portfolio import PortfolioItem
from app.models.preference import Preference
from app.models.user import User
from app.schemas.analysis import AnalysisRead, AnalyzeRequest, analysis_to_read_dict
from app.services.analyzer import analyze_photo_item


router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("/photo", response_model=AnalysisRead)
def analyze_photo(
    payload: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisResult:
    item = db.scalar(
        select(PortfolioItem).where(
            PortfolioItem.id == payload.portfolio_item_id,
            PortfolioItem.user_id == current_user.id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Portfolio item not found")

    if payload.target_style:
        item.target_style = payload.target_style
    if payload.target_platform:
        item.target_platform = payload.target_platform

    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    report = analyze_photo_item(item, preference, payload.target_style, payload.target_platform)
    analysis = AnalysisResult(
        portfolio_item_id=item.id,
        user_id=current_user.id,
        **report,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis_to_read_dict(analysis)
