"""Core AI photography coach analysis fields

Revision ID: 0002_core_coach_analysis
Revises: 0001_initial
Create Date: 2026-07-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_core_coach_analysis"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("analysis_results", sa.Column("photo_type", sa.String(length=80), nullable=False, server_default="general"))
    op.add_column("analysis_results", sa.Column("detected_style", sa.String(length=80), nullable=False, server_default="其他"))
    op.add_column("analysis_results", sa.Column("style_confidence", sa.String(length=20), nullable=False, server_default="0"))
    op.add_column("analysis_results", sa.Column("style_reasoning", sa.Text(), nullable=False, server_default=""))
    op.add_column("analysis_results", sa.Column("exposure_score", sa.Integer(), nullable=False, server_default="70"))
    op.add_column("analysis_results", sa.Column("focus_score", sa.Integer(), nullable=False, server_default="70"))
    op.add_column("analysis_results", sa.Column("composition_score", sa.Integer(), nullable=False, server_default="70"))
    op.add_column("analysis_results", sa.Column("color_score", sa.Integer(), nullable=False, server_default="70"))
    op.add_column("analysis_results", sa.Column("exposure_weight", sa.String(length=20), nullable=False, server_default="0.25"))
    op.add_column("analysis_results", sa.Column("focus_weight", sa.String(length=20), nullable=False, server_default="0.25"))
    op.add_column("analysis_results", sa.Column("composition_weight", sa.String(length=20), nullable=False, server_default="0.25"))
    op.add_column("analysis_results", sa.Column("color_weight", sa.String(length=20), nullable=False, server_default="0.25"))
    op.add_column("analysis_results", sa.Column("overall_score", sa.Integer(), nullable=False, server_default="70"))
    op.add_column("analysis_results", sa.Column("target_style_match_score", sa.Integer(), nullable=False, server_default="70"))
    op.add_column("analysis_results", sa.Column("benchmark_detail_json", sa.Text(), nullable=False, server_default="{}"))
    op.add_column("analysis_results", sa.Column("editing_params_json", sa.Text(), nullable=False, server_default="{}"))
    op.add_column("analysis_results", sa.Column("platform_suggestions_json", sa.Text(), nullable=False, server_default="{}"))
    op.add_column("analysis_results", sa.Column("shooting_tips", sa.Text(), nullable=False, server_default=""))
    op.add_column("analysis_results", sa.Column("next_step", sa.Text(), nullable=False, server_default=""))
    op.add_column("analysis_results", sa.Column("raw_response", sa.Text(), nullable=True))
    op.add_column("analysis_results", sa.Column("analysis_mode", sa.String(length=40), nullable=False, server_default="mock"))

    op.create_table(
        "photo_chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("portfolio_item_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["portfolio_item_id"], ["portfolio_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_photo_chat_messages_id"), "photo_chat_messages", ["id"], unique=False)
    op.create_index(op.f("ix_photo_chat_messages_portfolio_item_id"), "photo_chat_messages", ["portfolio_item_id"], unique=False)
    op.create_index(op.f("ix_photo_chat_messages_user_id"), "photo_chat_messages", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_photo_chat_messages_user_id"), table_name="photo_chat_messages")
    op.drop_index(op.f("ix_photo_chat_messages_portfolio_item_id"), table_name="photo_chat_messages")
    op.drop_index(op.f("ix_photo_chat_messages_id"), table_name="photo_chat_messages")
    op.drop_table("photo_chat_messages")
    for column in [
        "analysis_mode",
        "raw_response",
        "next_step",
        "shooting_tips",
        "platform_suggestions_json",
        "editing_params_json",
        "benchmark_detail_json",
        "target_style_match_score",
        "overall_score",
        "color_weight",
        "composition_weight",
        "focus_weight",
        "exposure_weight",
        "color_score",
        "composition_score",
        "focus_score",
        "exposure_score",
        "style_reasoning",
        "style_confidence",
        "detected_style",
        "photo_type",
    ]:
        op.drop_column("analysis_results", column)
