"""Add custom personality tags to user profiles.

Revision ID: 0016_user_personality_tags
Revises: 0015_analysis_job_deduplication
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0016_user_personality_tags"
down_revision: str = "0015_analysis_job_deduplication"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("personality_tags", sa.JSON(), server_default="[]", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "personality_tags")
