"""Add email verification and password reset tokens.

Revision ID: 0017_email_verification
Revises: 0016_user_personality_tags
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0017_email_verification"
down_revision: str = "0016_user_personality_tags"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "email_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.String(length=30), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_email_tokens_user_id"), "email_tokens", ["user_id"], unique=False)
    op.create_index(op.f("ix_email_tokens_purpose"), "email_tokens", ["purpose"], unique=False)
    op.create_index(op.f("ix_email_tokens_token_hash"), "email_tokens", ["token_hash"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_email_tokens_token_hash"), table_name="email_tokens")
    op.drop_index(op.f("ix_email_tokens_purpose"), table_name="email_tokens")
    op.drop_index(op.f("ix_email_tokens_user_id"), table_name="email_tokens")
    op.drop_table("email_tokens")
