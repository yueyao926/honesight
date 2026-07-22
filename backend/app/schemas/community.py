from datetime import datetime
from pydantic import BaseModel, Field, model_validator

POST_TYPES = {"artwork", "advice", "tutorial", "retouch", "equipment", "location", "before_after"}

class ImageInput(BaseModel):
    image_url: str = Field(max_length=500); thumbnail_url: str | None = None; original_url: str | None = None
    sort_order: int = 0; width: int | None = None; height: int | None = None; file_size: int | None = None
    mime_type: str | None = None; image_role: str = "normal"; alt_text: str | None = Field(None, max_length=300)

class PostPayload(BaseModel):
    title: str = Field("", max_length=160); content: str = Field("", max_length=10000)
    post_type: str = "artwork"; visibility: str = "public"; status: str = "draft"
    allow_comments: bool = True; allow_ai_review: bool = True; allow_original_download: bool = False
    location_name: str | None = Field(None, max_length=160); device_name: str | None = Field(None, max_length=120)
    lens_name: str | None = Field(None, max_length=120); aperture: str | None = None; shutter_speed: str | None = None
    iso: int | None = Field(None, ge=1, le=409600); focal_length: str | None = None
    editing_software: str | None = None; editing_notes: str | None = Field(None, max_length=3000)
    images: list[ImageInput] = Field(default_factory=list, max_length=9); tags: list[str] = Field(default_factory=list, max_length=10)
    copyright_confirmed: bool = False
    @model_validator(mode="after")
    def validate_post(self):
        if self.post_type not in POST_TYPES: raise ValueError("不支持的帖子类型")
        if self.visibility not in {"public", "followers", "private"}: raise ValueError("无效可见范围")
        if self.status not in {"draft", "published"}: raise ValueError("无效状态")
        if self.status == "published" and (not self.title.strip() or not self.content.strip() or not self.images or not self.copyright_confirmed): raise ValueError("发布时需填写标题、正文、上传图片并确认版权")
        roles = {i.image_role for i in self.images}
        if self.post_type == "before_after" and self.status == "published" and not {"before", "after"}.issubset(roles): raise ValueError("前后对比帖需包含 before 和 after 图片")
        return self

class PostUpdate(PostPayload):
    copyright_confirmed: bool = True

class CommentPayload(BaseModel):
    content: str = Field(min_length=1, max_length=2000); parent_id: int | None = None; reply_to_user_id: int | None = None

class CollectionPayload(BaseModel):
    name: str = Field(min_length=1, max_length=80); description: str | None = Field(None, max_length=500); visibility: str = "private"; cover_image_url: str | None = None

class FavoritePayload(BaseModel): collection_id: int | None = None
class ReportPayload(BaseModel): target_type: str; target_id: int; reason: str; description: str | None = Field(None, max_length=1000); evidence_urls: list[str] = Field(default_factory=list, max_length=5)
