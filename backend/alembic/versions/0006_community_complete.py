"""Add the LensCoach photography community domain.

Revision ID: 0006_community_complete
Revises: 0005_user_profiles
"""
from collections.abc import Sequence
from alembic import op

revision: str = "0006_community_complete"
down_revision: str = "0005_user_profiles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = [
    "community_posts", "community_post_images", "community_tags", "community_post_tags",
    "community_post_likes", "community_favorite_collections", "community_post_favorites",
    "community_comments", "community_user_blocks", "community_notifications", "community_reports",
    "community_post_views", "community_content_actions",
]

def upgrade() -> None:
    # Models are the single source of truth; creating in dependency order keeps this
    # migration compact while retaining every declared FK, unique constraint and index.
    from app.database import Base
    import app.models.community  # noqa: F401
    bind = op.get_bind()
    for name in TABLES:
        Base.metadata.tables[name].create(bind, checkfirst=True)
    op.create_index("ix_community_posts_feed", "community_posts", ["status", "visibility", "published_at"])
    op.create_index("ix_community_comments_post_created", "community_comments", ["post_id", "created_at"])
    op.create_index("ix_community_notifications_inbox", "community_notifications", ["recipient_id", "is_read", "created_at"])

def downgrade() -> None:
    from app.database import Base
    import app.models.community  # noqa: F401
    bind = op.get_bind()
    for name in reversed(TABLES):
        Base.metadata.tables[name].drop(bind, checkfirst=True)
