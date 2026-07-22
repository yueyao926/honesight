from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator


class PhotoTagCreate(BaseModel):
    tag_type: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=100)
    confidence: float | None = Field(default=None, ge=0, le=1)
    source: str = Field(default="ai_analysis", max_length=40)
    model_version: str | None = Field(default=None, max_length=120)

    @field_validator("tag_type", "name", "source", "model_version")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else value


class PhotoTagRead(PhotoTagCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PortfolioPhotoRead(BaseModel):
    id: int
    user_id: int
    collection_id: int
    title: str
    image_url: str
    source: str
    description: str | None = None
    visibility: str = "private"
    allow_favorite: bool = True
    is_published_to_community: bool = False
    allow_comments: bool = True
    favorite_count: int = 0
    view_count: int = 0
    is_favorited: bool = False
    tags: list[PhotoTagRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioPhotoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    visibility: str | None = None
    allow_favorite: bool | None = None

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, value: str | None) -> str | None:
        if value is not None and value not in {"public", "private"}:
            raise ValueError("visibility must be public or private")
        return value


class PortfolioCollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("作品集名称不能为空")
        return value.strip()


class PortfolioCollectionUpdate(PortfolioCollectionCreate):
    pass


class PortfolioCollectionRead(BaseModel):
    id: int
    user_id: int
    name: str
    cover_image_url: str | None = None
    photo_count: int = 0
    created_at: datetime
    updated_at: datetime


class PortfolioCollectionDetail(PortfolioCollectionRead):
    photos: list[PortfolioPhotoRead] = Field(default_factory=list)


class AddPortfolioPhotoRequest(BaseModel):
    image_url: str = Field(min_length=1, max_length=500)
    title: str | None = Field(default=None, max_length=160)
    tags: list[PhotoTagCreate] = Field(default_factory=list, max_length=30)


class SaveOriginalToPortfolioRequest(AddPortfolioPhotoRequest):
    collection_id: int | None = None
    collection_name: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def choose_collection(self) -> "SaveOriginalToPortfolioRequest":
        if bool(self.collection_id) == bool(self.collection_name and self.collection_name.strip()):
            raise ValueError("请选择已有作品集或输入新作品集名称")
        if self.collection_name:
            self.collection_name = self.collection_name.strip()
        return self


class SaveOriginalToPortfolioResponse(BaseModel):
    collection: PortfolioCollectionRead
    photo: PortfolioPhotoRead
