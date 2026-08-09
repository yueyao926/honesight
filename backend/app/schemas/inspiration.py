from pydantic import BaseModel, HttpUrl


class InspirationRead(BaseModel):
    id: int
    source_type: str
    title: str
    description: str | None
    poetic_caption: str
    appreciation_summary: str
    composition_analysis: str
    light_analysis: str
    color_analysis: str
    emotion_analysis: str
    learning_tip: str
    image_url: str
    thumbnail_url: str
    width: int | None
    height: int | None
    orientation: str | None
    photographer_name: str
    photographer_url: str
    source_name: str
    source_page_url: str
    license_code: str | None
    license_name: str | None
    license_url: str | None
    attribution_text: str
    tags: list[str]
    is_favorite: bool = False
    recommendation_reason: str | None = None


class ModerationRequest(BaseModel):
    approved: bool
    license_verified: bool
    note: str | None = None


class SyncRequest(BaseModel):
    query: str = "photography"
    count: int = 12


class BulkSyncRequest(BaseModel):
    topics: list[str] | None = None
    per_topic: int | None = None
