"""Add direct messaging and community search indexes.

Revision ID: 0007_messaging_search
Revises: 0006_community_complete
"""
from collections.abc import Sequence
from alembic import op

revision: str = "0007_messaging_search"
down_revision: str = "0006_community_complete"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ["direct_conversations","direct_messages","conversation_user_states","message_reports","post_search_documents","search_history"]

def upgrade() -> None:
    from app.database import Base
    import app.models.messaging, app.models.search  # noqa: F401
    bind=op.get_bind()
    if bind.dialect.name=="postgresql": op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    for name in TABLES: Base.metadata.tables[name].create(bind,checkfirst=True)
    op.create_index("ix_direct_messages_conversation_created","direct_messages",["conversation_id","created_at"])
    op.create_index("ix_conversation_states_user_unread","conversation_user_states",["user_id","unread_count"])
    op.create_index("ix_message_reports_status_created","message_reports",["status","created_at"])
    if bind.dialect.name=="postgresql":
        op.execute("CREATE INDEX ix_users_username_trgm ON users USING gin (lower(username) gin_trgm_ops)")
        op.execute("CREATE INDEX ix_post_search_documents_trgm ON post_search_documents USING gin (normalized_text gin_trgm_ops)")
        op.execute("CREATE INDEX ix_post_search_documents_fts ON post_search_documents USING gin (to_tsvector('simple', search_text))")

def downgrade() -> None:
    from app.database import Base
    import app.models.messaging, app.models.search  # noqa: F401
    bind=op.get_bind()
    for name in reversed(TABLES):Base.metadata.tables[name].drop(bind,checkfirst=True)
