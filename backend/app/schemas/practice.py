from datetime import datetime

from pydantic import BaseModel, Field


class PracticeAttemptCreate(BaseModel):
    image_url: str = Field(min_length=1, max_length=500)
    self_reflection: str = Field(min_length=1, max_length=1200)


class PracticeAttemptRead(BaseModel):
    id: int
    stage: str
    image_url: str
    self_reflection: str
    skill_score: int
    score_change: int | None = None
    strength: str
    key_issue: str
    action_step: str
    reshoot_task: str
    comparison_summary: str
    created_at: datetime


class PracticeSessionRead(BaseModel):
    id: int
    week_key: str
    skill_focus: str
    title: str
    brief: str
    constraints: list[str]
    success_criteria: list[str]
    coach_note: str
    status: str
    progress: int
    attempts: list[PracticeAttemptRead]
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
