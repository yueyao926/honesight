"""Allow multiple resumable practices in a weekly plan.

Revision ID: 0013_multi_practice_plan
Revises: 0012_analysis_performance
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0013_multi_practice_plan"
down_revision: str = "0012_analysis_performance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_practice_session_user_week", "practice_sessions", type_="unique")
    op.add_column(
        "practice_sessions",
        sa.Column("plan_role", sa.String(length=20), nullable=False, server_default="primary"),
    )
    op.add_column(
        "practice_sessions",
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "practice_sessions",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_practice_session_user_week_focus",
        "practice_sessions",
        ["user_id", "week_key", "category", "skill_focus"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_practice_session_user_week_focus", "practice_sessions", type_="unique")
    op.drop_column("practice_sessions", "started_at")
    op.drop_column("practice_sessions", "position")
    op.drop_column("practice_sessions", "plan_role")
    op.create_unique_constraint(
        "uq_practice_session_user_week",
        "practice_sessions",
        ["user_id", "week_key"],
    )
