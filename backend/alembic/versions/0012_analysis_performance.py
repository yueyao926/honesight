"""Add analysis cache, background jobs, and practice source snapshots.

Revision ID: 0012_analysis_performance
Revises: 0011_weekly_practice
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0012_analysis_performance"
down_revision: str = "0011_weekly_practice"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "practice_sessions",
        sa.Column("source_analysis_json", sa.Text(), nullable=False, server_default="{}"),
    )

    op.create_table(
        "analysis_cache",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cache_key", sa.String(length=64), nullable=False),
        sa.Column("profile", sa.String(length=40), nullable=False),
        sa.Column("result_json", sa.Text(), nullable=False),
        sa.Column("model_used", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "cache_key", name="uq_analysis_cache_user_key"),
    )
    op.create_index("ix_analysis_cache_user_id", "analysis_cache", ["user_id"])
    op.create_index("ix_analysis_cache_cache_key", "analysis_cache", ["cache_key"])
    op.create_index("ix_analysis_cache_expires_at", "analysis_cache", ["expires_at"])

    op.create_table(
        "analysis_jobs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cache_key", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False, server_default="preview"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("stage", sa.String(length=40), nullable=False, server_default="queued"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("request_json", sa.Text(), nullable=False),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("cache_hit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_analysis_jobs_user_id", "analysis_jobs", ["user_id"])
    op.create_index("ix_analysis_jobs_cache_key", "analysis_jobs", ["cache_key"])
    op.create_index("ix_analysis_jobs_status", "analysis_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("analysis_jobs")
    op.drop_table("analysis_cache")
    op.drop_column("practice_sessions", "source_analysis_json")
