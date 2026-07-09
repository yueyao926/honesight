from datetime import datetime

from pydantic import BaseModel


class PreferenceBase(BaseModel):
    skill_level: str | None = None
    target_platform: str | None = None
    preferred_styles: str | None = None
    common_subjects: str | None = None
    improvement_goals: str | None = None
    editing_tools: str | None = None


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
