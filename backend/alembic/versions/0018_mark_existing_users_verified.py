"""Mark existing users as email-verified.

Revision ID: 0018_mark_existing_users_verified
Revises: 0017_email_verification
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0018_mark_existing_users_verified"
down_revision: str = "0017_email_verification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # This revision identifier is longer than Alembic's default VARCHAR(32).
    # Widen the marker column before Alembic records this migration as current.
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(length=32),
        type_=sa.String(length=64),
        existing_nullable=False,
    )
    # Accounts created before email verification shipped were never asked to
    # verify. Trust them by default so hard verification doesn't lock them out.
    op.execute("UPDATE users SET email_verified = true WHERE email_verified = false")


def downgrade() -> None:
    # One-way: we cannot distinguish originally-unverified accounts from
    # accounts that verify after this migration, so there is nothing to reverse.
    pass
