"""Expand weekly practice coaching.

Revision ID: 0011_weekly_practice
Revises: 0010_practice_coaching
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0011_weekly_practice"
down_revision: str = "0010_practice_coaching"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("preferences", sa.Column("weekly_practice_minutes", sa.Integer(), nullable=False, server_default="20"))
    op.add_column("preferences", sa.Column("weekly_practice_day", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("preferences", sa.Column("weekly_reminder_enabled", sa.Boolean(), nullable=False, server_default=sa.true()))

    op.add_column("practice_sessions", sa.Column("entry_mode", sa.String(length=20), nullable=False, server_default="category"))
    op.add_column("practice_sessions", sa.Column("category", sa.String(length=20), nullable=False, server_default="人像"))
    op.add_column("practice_sessions", sa.Column("level", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("practice_sessions", sa.Column("cycle_week", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("practice_sessions", sa.Column("time_minutes", sa.Integer(), nullable=False, server_default="20"))
    op.add_column("practice_sessions", sa.Column("source_image_url", sa.String(length=500), nullable=True))
    op.add_column("practice_sessions", sa.Column("target_goal", sa.String(length=40), nullable=False, server_default="不确定"))
    op.add_column("practice_sessions", sa.Column("photo_intent", sa.Text(), nullable=False, server_default=""))
    op.add_column("practice_sessions", sa.Column("priority_issue", sa.Text(), nullable=False, server_default=""))
    op.add_column("practice_sessions", sa.Column("analysis_confidence", sa.Float(), nullable=False, server_default="0"))
    op.add_column("practice_sessions", sa.Column("steps_json", sa.Text(), nullable=False, server_default="[]"))
    op.add_column("practice_sessions", sa.Column("optional_challenge", sa.Text(), nullable=False, server_default=""))
    op.add_column("practice_sessions", sa.Column("simplified_task_json", sa.Text(), nullable=False, server_default="{}"))

    op.add_column("practice_attempts", sa.Column("image_urls_json", sa.Text(), nullable=False, server_default="[]"))
    op.add_column("practice_attempts", sa.Column("achieved_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("practice_attempts", sa.Column("criteria_total", sa.Integer(), nullable=False, server_default="2"))
    op.add_column("practice_attempts", sa.Column("criterion_results_json", sa.Text(), nullable=False, server_default="[]"))
    op.add_column("practice_attempts", sa.Column("difficulty_feedback", sa.String(length=20), nullable=True))

    op.create_table(
        "practice_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("ability", sa.String(length=20), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("cycle_week", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("easy_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cycle_source_image_url", sa.String(length=500), nullable=True),
        sa.Column("last_practiced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "category", "ability", name="uq_practice_progress_user_category_ability"),
    )
    op.create_index("ix_practice_progress_user_id", "practice_progress", ["user_id"])
    op.create_index("ix_practice_progress_category", "practice_progress", ["category"])


def downgrade() -> None:
    op.drop_table("practice_progress")
    for column in (
        "difficulty_feedback", "criterion_results_json", "criteria_total", "achieved_count", "image_urls_json"
    ):
        op.drop_column("practice_attempts", column)
    for column in (
        "simplified_task_json", "optional_challenge", "steps_json", "analysis_confidence", "priority_issue",
        "photo_intent", "target_goal", "source_image_url", "time_minutes", "cycle_week", "level", "category",
        "entry_mode",
    ):
        op.drop_column("practice_sessions", column)
    op.drop_column("preferences", "weekly_reminder_enabled")
    op.drop_column("preferences", "weekly_practice_day")
    op.drop_column("preferences", "weekly_practice_minutes")
