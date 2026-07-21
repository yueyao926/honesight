"""Merge portfolio collections and daily inspiration migration heads.

Revision ID: 0004_merge_heads
Revises: 0003_portfolio_collections, 0003_daily_inspiration
"""

from collections.abc import Sequence


revision: str = "0004_merge_heads"
down_revision: tuple[str, str] = ("0003_portfolio_collections", "0003_daily_inspiration")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
