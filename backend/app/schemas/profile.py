from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ProfileUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=2, max_length=80)
    signature: str | None = Field(default=None, max_length=80)
    bio: str | None = Field(default=None, max_length=300)
    location: str | None = Field(default=None, max_length=120)
    photography_level: str | None = Field(default=None, max_length=40)
    equipment: str | None = Field(default=None, max_length=500)
    personality_tags: list[str] | None = None

    @field_validator("username")
    @classmethod
    def clean_username(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("用户名不能为空")
        return value.strip() if value else value

    @field_validator("personality_tags")
    @classmethod
    def clean_personality_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        tags: list[str] = []
        for item in value:
            name = str(item).replace("#", "").strip()
            if not name or name in tags:
                continue
            tags.append(name[:16])
            if len(tags) >= 6:
                break
        return tags


class PrivacyPayload(BaseModel):
    show_following: bool = True
    show_followers: bool = True
    allow_work_favorites: bool = True
    discoverable_by_username: bool = True
    allow_follow_notifications: bool = True


class ProfileRead(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    signature: str | None = None
    bio: str | None = None
    location: str | None = None
    photography_level: str | None = None
    equipment: str | None = None
    created_at: datetime
    work_count: int
    collection_count: int = 0
    following_count: int
    follower_count: int
    is_following: bool = False
    is_self: bool = False
    email: str | None = None
    email_verified: bool | None = None
    favorite_count: int | None = None
    photography_categories: list[str] = []
    personality_tags: list[str] = []
