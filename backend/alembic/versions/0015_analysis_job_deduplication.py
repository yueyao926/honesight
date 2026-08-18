"""Prevent duplicate active analysis jobs.

Revision ID: 0015_analysis_job_deduplication
Revises: 0014_persistent_auth_sessions
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0015_analysis_job_deduplication"
down_revision: str = "0014_persistent_auth_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            """
            WITH ranked AS (
                SELECT id,
                       row_number() OVER (
                           PARTITION BY user_id, cache_key
                           ORDER BY created_at DESC, id DESC
                       ) AS position
                FROM analysis_jobs
                WHERE status IN ('queued', 'processing')
            )
            UPDATE analysis_jobs
            SET status = 'failed',
                stage = 'failed',
                error = 'Superseded by a newer active analysis job',
                completed_at = now()
            FROM ranked
            WHERE analysis_jobs.id = ranked.id AND ranked.position > 1
            """
        )
    op.create_index(
        "uq_analysis_jobs_active_user_cache",
        "analysis_jobs",
        ["user_id", "cache_key"],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'processing')"),
        sqlite_where=sa.text("status IN ('queued', 'processing')"),
    )


def downgrade() -> None:
    op.drop_index("uq_analysis_jobs_active_user_cache", table_name="analysis_jobs")
