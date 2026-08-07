"""Add thumbnails for portfolio photos.

Revision ID: 0009_portfolio_thumbnails
Revises: 0008_comment_likes
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0009_portfolio_thumbnails"
down_revision: str = "0008_comment_likes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("portfolio_items", sa.Column("thumbnail_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("portfolio_items", "thumbnail_url")
