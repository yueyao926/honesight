from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class PracticeSessionCreate(BaseModel):
    entry_mode: Literal["improve", "category"]
    source_image_url: str | None = Field(default=None, max_length=500)
    target_goal: Literal["构图", "光线", "清晰度", "色彩", "不确定"] = "不确定"
    category: Literal["人像", "风景", "拍物"] | None = None
    plan_role: Literal["primary", "optional"] = "primary"
    replace_current: bool = False
    replace_session_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_entry(self) -> "PracticeSessionCreate":
        if self.entry_mode == "improve" and not self.source_image_url:
            raise ValueError("改进这张需要先上传照片")
        if self.entry_mode == "category" and not self.category:
            raise ValueError("分类练习需要选择类别")
        return self


class PracticeAttemptCreate(BaseModel):
    image_urls: list[str] = Field(default_factory=list, min_length=1, max_length=3)
    image_url: str | None = Field(default=None, max_length=500)
    self_reflection: str = Field(default="", max_length=600)

    @model_validator(mode="before")
    @classmethod
    def support_legacy_image_url(cls, value: object) -> object:
        if isinstance(value, dict) and not value.get("image_urls") and value.get("image_url"):
            return {**value, "image_urls": [value["image_url"]]}
        return value


class PracticeDifficultyUpdate(BaseModel):
    difficulty: Literal["too_easy", "just_right", "too_hard"]


class CriterionResult(BaseModel):
    criterion: str
    achieved: bool


class PracticeAttemptRead(BaseModel):
    id: int
    stage: str
    image_url: str
    image_urls: list[str]
    self_reflection: str
    skill_score: int
    score_change: int | None = None
    achieved_count: int
    criteria_total: int
    criterion_results: list[CriterionResult]
    difficulty_feedback: str | None = None
    strength: str
    key_issue: str
    action_step: str
    reshoot_task: str
    comparison_summary: str
    created_at: datetime


class PhotoPracticeAnalysis(BaseModel):
    photo_type: str
    intent: str
    priority_issue: str
    ability: str
    recommended_level: int
    confidence: float


class PracticeSessionRead(BaseModel):
    id: int
    week_key: str
    entry_mode: str
    plan_role: str
    position: int
    category: str
    skill_focus: str
    level: int
    cycle_week: int
    cycle_label: str
    time_minutes: int
    source_image_url: str | None = None
    target_goal: str
    photo_analysis: PhotoPracticeAnalysis | None = None
    title: str
    brief: str
    recommendation_basis: str
    steps: list[str]
    constraints: list[str]
    success_criteria: list[str]
    optional_challenge: str
    simplified_task: dict
    coach_note: str
    status: str
    progress: int
    progress_stage: str
    completion_percent: int
    is_carryover: bool
    attempts: list[PracticeAttemptRead]
    started_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class PracticeAttemptJobRead(BaseModel):
    id: str
    status: str
    stage: str
    progress: int
    result: PracticeSessionRead | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class PracticeSessionJobRead(PracticeAttemptJobRead):
    pass


class PracticeProgressRead(BaseModel):
    category: str
    ability: str
    level: int
    cycle_week: int
    completed_count: int
    remaining_for_level: int


class PracticeOverviewRead(BaseModel):
    current: PracticeSessionRead | None
    current_sessions: list[PracticeSessionRead]
    week_key: str
    weekly_budget_minutes: int
    scheduled_minutes: int
    completed_minutes: int
    can_add: bool
    history: list[PracticeSessionRead]
    progress: list[PracticeProgressRead]
