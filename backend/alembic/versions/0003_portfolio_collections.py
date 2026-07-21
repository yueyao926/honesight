"""Add named portfolio collections and photo tags

Revision ID: 0003_portfolio_collections
Revises: 0002_core_coach_analysis
Create Date: 2026-07-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_portfolio_collections"
down_revision: str | None = "0002_core_coach_analysis"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "portfolio_collections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_portfolio_collections_user_name"),
    )
    op.create_index(op.f("ix_portfolio_collections_id"), "portfolio_collections", ["id"], unique=False)
    op.create_index(op.f("ix_portfolio_collections_user_id"), "portfolio_collections", ["user_id"], unique=False)

    op.add_column("portfolio_items", sa.Column("collection_id", sa.Integer(), nullable=True))
    op.add_column(
        "portfolio_items",
        sa.Column("source", sa.String(length=40), nullable=False, server_default="legacy"),
    )
    op.create_index(op.f("ix_portfolio_items_collection_id"), "portfolio_items", ["collection_id"], unique=False)
    op.create_foreign_key(
        "fk_portfolio_items_collection_id",
        "portfolio_items",
        "portfolio_collections",
        ["collection_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Preserve every existing photo by placing it in one default collection per user.
    op.execute(
        """
        INSERT INTO portfolio_collections (user_id, name)
        SELECT DISTINCT user_id, '默认作品集' FROM portfolio_items
        """
    )
    op.execute(
        """
        UPDATE portfolio_items AS item
        SET collection_id = collection.id
        FROM portfolio_collections AS collection
        WHERE collection.user_id = item.user_id AND collection.name = '默认作品集'
        """
    )
    op.alter_column("portfolio_items", "collection_id", nullable=False)

    op.create_table(
        "photo_tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("photo_id", sa.Integer(), nullable=False),
        sa.Column("tag_type", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="ai_analysis"),
        sa.Column("model_version", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["photo_id"], ["portfolio_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("photo_id", "tag_type", "name", name="uq_photo_tags_photo_type_name"),
    )
    op.create_index(op.f("ix_photo_tags_id"), "photo_tags", ["id"], unique=False)
    op.create_index(op.f("ix_photo_tags_photo_id"), "photo_tags", ["photo_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_photo_tags_photo_id"), table_name="photo_tags")
    op.drop_index(op.f("ix_photo_tags_id"), table_name="photo_tags")
    op.drop_table("photo_tags")
    op.drop_constraint("fk_portfolio_items_collection_id", "portfolio_items", type_="foreignkey")
    op.drop_index(op.f("ix_portfolio_items_collection_id"), table_name="portfolio_items")
    op.drop_column("portfolio_items", "source")
    op.drop_column("portfolio_items", "collection_id")
    op.drop_index(op.f("ix_portfolio_collections_user_id"), table_name="portfolio_collections")
    op.drop_index(op.f("ix_portfolio_collections_id"), table_name="portfolio_collections")
    op.drop_table("portfolio_collections")
