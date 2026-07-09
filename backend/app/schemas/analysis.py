from datetime import datetime

from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    portfolio_item_id: int


class AnalysisRead(BaseModel):
    id: int
    portfolio_item_id: int
    user_id: int
    summary: str
    composition_advice: str
    lighting_advice: str
    color_advice: str
    editing_params: str
    model_used: str
    created_at: datetime

    model_config = {"from_attributes": True}
