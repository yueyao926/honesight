"""Version generated inspiration content.

Revision ID: 0019_inspiration_content_version
Revises: 0018_mark_existing_users_verified
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0019_inspiration_content_version"
down_revision: str = "0018_mark_existing_users_verified"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing rows start at version 1. Provider sync writes the current version.
    op.add_column(
        "inspiration_photos",
        sa.Column("content_version", sa.Integer(), server_default="1", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("inspiration_photos", "content_version")
