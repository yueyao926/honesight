"""Add practice coaching loop.

Revision ID: 0010_practice_coaching
Revises: 0009_portfolio_thumbnails
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0010_practice_coaching"
down_revision: str = "0009_portfolio_thumbnails"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "practice_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_key", sa.String(length=12), nullable=False),
        sa.Column("skill_focus", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("brief", sa.Text(), nullable=False),
        sa.Column("constraints_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("success_criteria_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("coach_note", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "week_key", name="uq_practice_session_user_week"),
    )
    op.create_index("ix_practice_sessions_user_id", "practice_sessions", ["user_id"])
    op.create_index("ix_practice_sessions_week_key", "practice_sessions", ["week_key"])
    op.create_index("ix_practice_sessions_status", "practice_sessions", ["status"])

    op.create_table(
        "practice_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("practice_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stage", sa.String(length=20), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=False),
        sa.Column("self_reflection", sa.Text(), nullable=False),
        sa.Column("skill_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("strength", sa.Text(), nullable=False),
        sa.Column("key_issue", sa.Text(), nullable=False),
        sa.Column("action_step", sa.Text(), nullable=False),
        sa.Column("reshoot_task", sa.Text(), nullable=False),
        sa.Column("comparison_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("analysis_snapshot_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("session_id", "stage", name="uq_practice_attempt_session_stage"),
    )
    op.create_index("ix_practice_attempts_session_id", "practice_attempts", ["session_id"])
    op.create_index("ix_practice_attempts_user_id", "practice_attempts", ["user_id"])

    op.create_table(
        "coach_memories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("current_focus", sa.String(length=40), nullable=False, server_default="构图"),
        sa.Column("recurring_issue", sa.Text(), nullable=False, server_default=""),
        sa.Column("last_action", sa.Text(), nullable=False, server_default=""),
        sa.Column("completed_sessions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_coach_memory_user"),
    )
    op.create_index("ix_coach_memories_user_id", "coach_memories", ["user_id"])


def downgrade() -> None:
    op.drop_table("coach_memories")
    op.drop_table("practice_attempts")
    op.drop_table("practice_sessions")
