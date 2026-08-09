"""Add likes for community comments.

Revision ID: 0008_comment_likes
Revises: 0007_messaging_search
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "0008_comment_likes"
down_revision: str = "0007_messaging_search"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.create_table(
        "community_comment_likes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("comment_id", sa.Integer(), sa.ForeignKey("community_comments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "comment_id", name="uq_community_comment_like"),
    )
    op.create_index("ix_community_comment_likes_user_id", "community_comment_likes", ["user_id"])
    op.create_index("ix_community_comment_likes_comment_id", "community_comment_likes", ["comment_id"])

def downgrade() -> None:
    op.drop_table("community_comment_likes")
