from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PortfolioBase(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = None
    image_url: str
    category: str | None = None
    target_style: str | None = None
    target_platform: str | None = None


class PortfolioCreate(PortfolioBase):
    pass


class PortfolioUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    target_style: str | None = None
    target_platform: str | None = None


class PortfolioRead(PortfolioBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SavePortfolioWithAnalysisRequest(BaseModel):
    image_url: str
    title: str = Field(min_length=1, max_length=160)
    description: str | None = None
    category: str | None = None
    target_style: str | None = None
    target_platform: str | None = None
    analysis_report: dict[str, Any]


class SavePortfolioWithAnalysisResponse(BaseModel):
    item: PortfolioRead
    analysis_id: int
