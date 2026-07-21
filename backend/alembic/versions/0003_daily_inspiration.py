"""Daily photography inspiration

Revision ID: 0003_daily_inspiration
Revises: 0002_core_coach_analysis
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "0003_daily_inspiration"
down_revision: str | None = "0002_core_coach_analysis"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table("inspiration_photos",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("external_id", sa.String(255)), sa.Column("title", sa.String(255), nullable=False), sa.Column("description", sa.Text()),
        sa.Column("poetic_caption", sa.Text(), nullable=False), sa.Column("appreciation_summary", sa.Text(), nullable=False),
        sa.Column("composition_analysis", sa.Text(), nullable=False), sa.Column("light_analysis", sa.Text(), nullable=False),
        sa.Column("color_analysis", sa.Text(), nullable=False), sa.Column("emotion_analysis", sa.Text(), nullable=False), sa.Column("learning_tip", sa.Text(), nullable=False),
        sa.Column("image_url", sa.String(1500), nullable=False), sa.Column("thumbnail_url", sa.String(1500), nullable=False),
        sa.Column("width", sa.Integer()), sa.Column("height", sa.Integer()), sa.Column("orientation", sa.String(20)),
        sa.Column("photographer_name", sa.String(255), nullable=False), sa.Column("photographer_url", sa.String(1500), nullable=False),
        sa.Column("source_name", sa.String(120), nullable=False), sa.Column("source_page_url", sa.String(1500), nullable=False),
        sa.Column("license_code", sa.String(80)), sa.Column("license_name", sa.String(255)), sa.Column("license_url", sa.String(1500)),
        sa.Column("attribution_text", sa.Text(), nullable=False), sa.Column("tags", sa.Text(), nullable=False, server_default=""),
        sa.Column("license_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("moderation_status", sa.String(20), nullable=False, server_default="pending"), sa.Column("moderation_note", sa.Text()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("community_owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("community_visibility", sa.String(20)),
        sa.Column("recommendation_consent", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("recommendation_consent_at", sa.DateTime(timezone=True)),
        sa.Column("authorization_revoked_at", sa.DateTime(timezone=True)), sa.Column("quality_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("verified_at", sa.DateTime(timezone=True)), sa.Column("verified_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("source_type", "external_id", name="uq_inspiration_source_external"))
    for col in ("source_type", "moderation_status", "is_active"): op.create_index(f"ix_inspiration_photos_{col}", "inspiration_photos", [col])
    op.create_table("inspiration_favorites", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("photo_id", sa.Integer(), sa.ForeignKey("inspiration_photos.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("user_id", "photo_id", name="uq_inspiration_favorite_user_photo"))
    op.create_index("ix_inspiration_favorites_user_id", "inspiration_favorites", ["user_id"]); op.create_index("ix_inspiration_favorites_photo_id", "inspiration_favorites", ["photo_id"])
    op.create_table("daily_inspiration_recommendations", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE")), sa.Column("user_key", sa.String(80), nullable=False), sa.Column("photo_id", sa.Integer(), sa.ForeignKey("inspiration_photos.id", ondelete="CASCADE"), nullable=False), sa.Column("recommendation_date", sa.Date(), nullable=False), sa.Column("position", sa.Integer(), nullable=False), sa.Column("score", sa.Float(), nullable=False), sa.Column("recommendation_reason", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("user_key", "recommendation_date", "position", name="uq_daily_inspiration_position"), sa.UniqueConstraint("user_key", "recommendation_date", "photo_id", name="uq_daily_inspiration_photo"))
    for col in ("user_id", "user_key", "photo_id", "recommendation_date"): op.create_index(f"ix_daily_inspiration_recommendations_{col}", "daily_inspiration_recommendations", [col])


def downgrade() -> None:
    op.drop_table("daily_inspiration_recommendations"); op.drop_table("inspiration_favorites"); op.drop_table("inspiration_photos")
