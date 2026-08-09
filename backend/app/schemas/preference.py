from datetime import datetime

from pydantic import BaseModel, Field


class PreferenceBase(BaseModel):
    skill_level: str | None = None
    target_platform: str | None = None
    preferred_styles: str | None = None
    common_subjects: str | None = None
    improvement_goals: str | None = None
    editing_tools: str | None = None
    photography_categories: list[str] = []
    aesthetic_styles: list[str] = []
    editing_software: list[str] = []
    shooting_devices: list[str] = []
    weekly_practice_minutes: int = Field(default=20, ge=10, le=60)
    weekly_practice_day: int = Field(default=1, ge=1, le=7)
    weekly_reminder_enabled: bool = True
    daily_recommendation_enabled: bool = True
    daily_recommendation_count: int = 5
    use_favorite_behavior: bool = True
    use_browsing_behavior: bool = True
    prioritize_following: bool = True
    show_tutorial_content: bool = True


class PreferenceCreate(PreferenceBase):
    pass


class PreferenceUpdate(PreferenceBase):
    pass


class PreferenceRead(PreferenceBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
