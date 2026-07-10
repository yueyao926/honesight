from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.analysis import AnalysisResult, PhotoChatMessage
from app.models.portfolio import PortfolioItem
from app.models.user import User
from app.schemas.analysis import AnalysisRead, ChatMessageRead, ChatReply, ChatRequest, analysis_to_read_dict
from app.schemas.portfolio import (
    PortfolioCreate,
    PortfolioRead,
    PortfolioUpdate,
    SavePortfolioWithAnalysisRequest,
    SavePortfolioWithAnalysisResponse,
)
from app.services.ai_chat import build_chat_reply


router = APIRouter(prefix="/portfolio", tags=["portfolio"])


def _get_owned_item(item_id: int, user_id: int, db: Session) -> PortfolioItem:
    item = db.scalar(select(PortfolioItem).where(PortfolioItem.id == item_id, PortfolioItem.user_id == user_id))
    if not item:
        raise HTTPException(status_code=404, detail="Portfolio item not found")
    return item


@router.get("", response_model=list[PortfolioRead])
def list_portfolio(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PortfolioItem]:
    return list(db.scalars(select(PortfolioItem).where(PortfolioItem.user_id == current_user.id).order_by(desc(PortfolioItem.created_at))))


@router.post("", response_model=PortfolioRead, status_code=status.HTTP_201_CREATED)
def create_portfolio_item(
    payload: PortfolioCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PortfolioItem:
    item = PortfolioItem(user_id=current_user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/save-with-analysis", response_model=SavePortfolioWithAnalysisResponse, status_code=status.HTTP_201_CREATED)
def save_portfolio_with_analysis(
    payload: SavePortfolioWithAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavePortfolioWithAnalysisResponse:
    item = PortfolioItem(
        user_id=current_user.id,
        image_url=payload.image_url,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        target_style=payload.target_style,
        target_platform=payload.target_platform,
    )
    db.add(item)
    db.flush()

    report = dict(payload.analysis_report)
    analysis = AnalysisResult(
        portfolio_item_id=item.id,
        user_id=current_user.id,
        **report,
    )
    db.add(analysis)
    db.commit()
    db.refresh(item)
    db.refresh(analysis)
    return SavePortfolioWithAnalysisResponse(item=item, analysis_id=analysis.id)


@router.get("/{item_id}", response_model=PortfolioRead)
def get_portfolio_item(item_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PortfolioItem:
    return _get_owned_item(item_id, current_user.id, db)


@router.put("/{item_id}", response_model=PortfolioRead)
def update_portfolio_item(
    item_id: int,
    payload: PortfolioUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PortfolioItem:
    item = _get_owned_item(item_id, current_user.id, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio_item(item_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    item = _get_owned_item(item_id, current_user.id, db)
    db.delete(item)
    db.commit()


@router.get("/{item_id}/analysis", response_model=AnalysisRead)
def get_latest_analysis(item_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AnalysisResult:
    _get_owned_item(item_id, current_user.id, db)
    analysis = db.scalar(
        select(AnalysisResult)
        .where(AnalysisResult.portfolio_item_id == item_id, AnalysisResult.user_id == current_user.id)
        .order_by(desc(AnalysisResult.created_at))
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis_to_read_dict(analysis)


@router.get("/{item_id}/chat", response_model=list[ChatMessageRead])
def get_photo_chat(item_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PhotoChatMessage]:
    _get_owned_item(item_id, current_user.id, db)
    return list(
        db.scalars(
            select(PhotoChatMessage)
            .where(PhotoChatMessage.portfolio_item_id == item_id, PhotoChatMessage.user_id == current_user.id)
            .order_by(PhotoChatMessage.created_at)
        )
    )


@router.post("/{item_id}/chat", response_model=ChatReply)
def post_photo_chat(
    item_id: int,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatReply:
    item = _get_owned_item(item_id, current_user.id, db)
    analysis = db.scalar(
        select(AnalysisResult)
        .where(AnalysisResult.portfolio_item_id == item_id, AnalysisResult.user_id == current_user.id)
        .order_by(desc(AnalysisResult.created_at))
    )
    user_message = PhotoChatMessage(portfolio_item_id=item_id, user_id=current_user.id, role="user", content=payload.message)
    db.add(user_message)
    db.flush()
    reply = build_chat_reply(item, analysis, payload.message)
    assistant_message = PhotoChatMessage(portfolio_item_id=item_id, user_id=current_user.id, role="assistant", content=reply)
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    return ChatReply(reply=assistant_message.content, created_at=assistant_message.created_at)
