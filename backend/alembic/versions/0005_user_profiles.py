"""Add user profiles, privacy, follows, favorites and work visibility.

Revision ID: 0005_user_profiles
Revises: 0004_merge_heads
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "0005_user_profiles"
down_revision: str = "0004_merge_heads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for name, column in [
        ("signature", sa.Column("signature", sa.String(80), nullable=True)),
        ("bio", sa.Column("bio", sa.Text(), nullable=True)),
        ("location", sa.Column("location", sa.String(120), nullable=True)),
        ("photography_level", sa.Column("photography_level", sa.String(40), nullable=True)),
        ("equipment", sa.Column("equipment", sa.Text(), nullable=True)),
        ("email_verified", sa.Column("email_verified", sa.Boolean(), server_default=sa.false(), nullable=False)),
        ("is_deleted", sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=False)),
    ]: op.add_column("users", column)
    for column in [
        sa.Column("photography_categories", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("aesthetic_styles", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("editing_software", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("shooting_devices", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("daily_recommendation_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("daily_recommendation_count", sa.Integer(), server_default="5", nullable=False),
        sa.Column("use_favorite_behavior", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("use_browsing_behavior", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("prioritize_following", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("show_tutorial_content", sa.Boolean(), server_default=sa.true(), nullable=False),
    ]: op.add_column("preferences", column)
    for column in [
        sa.Column("visibility", sa.String(20), server_default="private", nullable=False),
        sa.Column("allow_favorite", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("is_published_to_community", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("allow_comments", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("view_count", sa.Integer(), server_default="0", nullable=False),
    ]: op.add_column("portfolio_items", column)
    op.create_check_constraint("ck_portfolio_items_visibility", "portfolio_items", "visibility IN ('public', 'private')")
    op.create_table("user_follows", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("follower_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("following_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.UniqueConstraint("follower_id", "following_id", name="uq_user_follows_pair"), sa.CheckConstraint("follower_id <> following_id", name="ck_user_follows_not_self"))
    op.create_index("ix_user_follows_follower_id", "user_follows", ["follower_id"])
    op.create_index("ix_user_follows_following_id", "user_follows", ["following_id"])
    op.create_table("portfolio_favorites", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("work_id", sa.Integer(), sa.ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.UniqueConstraint("user_id", "work_id", name="uq_portfolio_favorites_user_work"))
    op.create_index("ix_portfolio_favorites_user_id", "portfolio_favorites", ["user_id"])
    op.create_index("ix_portfolio_favorites_work_id", "portfolio_favorites", ["work_id"])
    op.create_table("user_privacy_settings", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("show_following", sa.Boolean(), server_default=sa.true(), nullable=False), sa.Column("show_followers", sa.Boolean(), server_default=sa.true(), nullable=False), sa.Column("allow_work_favorites", sa.Boolean(), server_default=sa.true(), nullable=False), sa.Column("discoverable_by_username", sa.Boolean(), server_default=sa.true(), nullable=False), sa.Column("allow_follow_notifications", sa.Boolean(), server_default=sa.true(), nullable=False), sa.UniqueConstraint("user_id", name="uq_user_privacy_user"))
    op.create_index("ix_user_privacy_settings_user_id", "user_privacy_settings", ["user_id"])


def downgrade() -> None:
    op.drop_table("user_privacy_settings"); op.drop_table("portfolio_favorites"); op.drop_table("user_follows")
    op.drop_constraint("ck_portfolio_items_visibility", "portfolio_items", type_="check")
    for name in ["view_count", "allow_comments", "is_published_to_community", "allow_favorite", "visibility"]: op.drop_column("portfolio_items", name)
    for name in ["show_tutorial_content", "prioritize_following", "use_browsing_behavior", "use_favorite_behavior", "daily_recommendation_count", "daily_recommendation_enabled", "shooting_devices", "editing_software", "aesthetic_styles", "photography_categories"]: op.drop_column("preferences", name)
    for name in ["is_deleted", "email_verified", "equipment", "photography_level", "location", "bio", "signature"]: op.drop_column("users", name)
