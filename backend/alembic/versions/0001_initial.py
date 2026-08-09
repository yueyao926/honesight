"""Initial LensCoach schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("skill_level", sa.String(length=80), nullable=True),
        sa.Column("target_platform", sa.String(length=120), nullable=True),
        sa.Column("preferred_styles", sa.Text(), nullable=True),
        sa.Column("common_subjects", sa.Text(), nullable=True),
        sa.Column("improvement_goals", sa.Text(), nullable=True),
        sa.Column("editing_tools", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_preferences_user_id"),
    )
    op.create_index(op.f("ix_preferences_id"), "preferences", ["id"], unique=False)
    op.create_index(op.f("ix_preferences_user_id"), "preferences", ["user_id"], unique=False)

    op.create_table(
        "portfolio_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("target_style", sa.String(length=120), nullable=True),
        sa.Column("target_platform", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_portfolio_items_id"), "portfolio_items", ["id"], unique=False)
    op.create_index(op.f("ix_portfolio_items_user_id"), "portfolio_items", ["user_id"], unique=False)

    op.create_table(
        "analysis_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("portfolio_item_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("composition_advice", sa.Text(), nullable=False),
        sa.Column("lighting_advice", sa.Text(), nullable=False),
        sa.Column("color_advice", sa.Text(), nullable=False),
        sa.Column("editing_params", sa.Text(), nullable=False),
        sa.Column("model_used", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["portfolio_item_id"], ["portfolio_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_analysis_results_id"), "analysis_results", ["id"], unique=False)
    op.create_index(op.f("ix_analysis_results_portfolio_item_id"), "analysis_results", ["portfolio_item_id"], unique=False)
    op.create_index(op.f("ix_analysis_results_user_id"), "analysis_results", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_analysis_results_user_id"), table_name="analysis_results")
    op.drop_index(op.f("ix_analysis_results_portfolio_item_id"), table_name="analysis_results")
    op.drop_index(op.f("ix_analysis_results_id"), table_name="analysis_results")
    op.drop_table("analysis_results")
    op.drop_index(op.f("ix_portfolio_items_user_id"), table_name="portfolio_items")
    op.drop_index(op.f("ix_portfolio_items_id"), table_name="portfolio_items")
    op.drop_table("portfolio_items")
    op.drop_index(op.f("ix_preferences_user_id"), table_name="preferences")
    op.drop_index(op.f("ix_preferences_id"), table_name="preferences")
    op.drop_table("preferences")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
