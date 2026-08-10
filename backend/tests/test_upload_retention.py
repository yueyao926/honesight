import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.config import Settings
from app.database import Base
from app.models.analysis import AnalysisJob
from app.models.portfolio import PortfolioCollection, PortfolioItem
from app.models.practice import PracticeAttempt, PracticeProgress, PracticeSession
from app.models.user import User
from app.services.upload_retention import cleanup_expired_uploads


def _database_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _old_file(root: Path, relative: str, *, now: datetime, days: int) -> Path:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"image-content")
    timestamp = (now - timedelta(days=days)).timestamp()
    os.utime(path, (timestamp, timestamp))
    return path


def _settings(root: Path) -> Settings:
    return Settings(
        UPLOAD_DIR=str(root),
        ANALYSIS_IMAGE_RETENTION_HOURS=72,
        GENERATED_IMAGE_RETENTION_HOURS=168,
        PRACTICE_IMAGE_RETENTION_DAYS=30,
        ORPHAN_IMAGE_RETENTION_HOURS=72,
    )


def test_cleanup_removes_expired_temporary_images_but_keeps_saved_work(tmp_path) -> None:
    now = datetime(2026, 8, 11, tzinfo=timezone.utc)
    root = tmp_path / "uploads"
    expired = _old_file(root, "analysis/1_expired.webp", now=now, days=4)
    recent = _old_file(root, "analysis/1_recent.webp", now=now, days=2)
    saved = _old_file(root, "analysis/1_saved.webp", now=now, days=10)
    processing = _old_file(root, "analysis/1_processing.webp", now=now, days=4)
    generated = _old_file(root, "generated/1_generated_old.webp", now=now, days=8)

    db = _database_session()
    user = User(username="retention-user", email="retention@example.com", hashed_password="x")
    db.add(user)
    db.flush()
    collection = PortfolioCollection(user_id=user.id, name="长期保留")
    db.add(collection)
    db.flush()
    db.add(
        PortfolioItem(
            user_id=user.id,
            collection_id=collection.id,
            title="已保存照片",
            image_url="/uploads/analysis/1_saved.webp",
        )
    )
    db.add(
        AnalysisJob(
            id="processing-retention-job",
            user_id=user.id,
            cache_key="processing-cache-key",
            kind="preview",
            status="processing",
            request_json='{"image_url":"/uploads/analysis/1_processing.webp"}',
        )
    )
    db.commit()

    result = cleanup_expired_uploads(db, now=now, settings=_settings(root), upload_root=root)

    assert not expired.exists()
    assert recent.exists()
    assert saved.exists()
    assert processing.exists()
    assert not generated.exists()
    assert result.files_deleted == 2
    assert result.files_retained == 2
    db.close()


def test_cleanup_keeps_an_unfinished_four_week_cycle_and_expires_old_history(tmp_path) -> None:
    now = datetime(2026, 8, 11, tzinfo=timezone.utc)
    root = tmp_path / "uploads"
    cycle_source = _old_file(root, "practice/1_cycle_source.webp", now=now, days=45)
    cycle_attempt = _old_file(root, "practice/1_cycle_attempt.webp", now=now, days=44)
    grace_period_attempt = _old_file(root, "practice/1_grace_period.webp", now=now, days=45)
    expired_attempt = _old_file(root, "practice/1_expired_attempt.webp", now=now, days=45)

    db = _database_session()
    user = User(username="practice-user", email="practice-retention@example.com", hashed_password="x")
    db.add(user)
    db.flush()
    cycle_session = _practice_session(
        user.id,
        week_key="2026-W20",
        ability="构图",
        source_url="/uploads/practice/1_cycle_source.webp",
        completed_at=now - timedelta(days=40),
    )
    expired_session = _practice_session(
        user.id,
        week_key="2026-W19",
        ability="光线",
        source_url=None,
        completed_at=now - timedelta(days=45),
    )
    grace_period_session = _practice_session(
        user.id,
        week_key="2026-W18",
        ability="色彩",
        source_url=None,
        completed_at=now - timedelta(days=45),
    )
    db.add_all([cycle_session, expired_session, grace_period_session])
    db.flush()
    db.add_all(
        [
            _practice_attempt(cycle_session.id, user.id, "/uploads/practice/1_cycle_attempt.webp"),
            _practice_attempt(expired_session.id, user.id, "/uploads/practice/1_expired_attempt.webp"),
            _practice_attempt(grace_period_session.id, user.id, "/uploads/practice/1_grace_period.webp"),
            PracticeProgress(
                user_id=user.id,
                category="人像",
                ability="构图",
                level=1,
                cycle_week=3,
                cycle_source_image_url="/uploads/practice/1_cycle_source.webp",
            ),
            PracticeProgress(
                user_id=user.id,
                category="人像",
                ability="色彩",
                level=1,
                cycle_week=1,
                completed_count=1,
                last_practiced_at=now - timedelta(days=10),
            ),
        ]
    )
    db.commit()

    cleanup_expired_uploads(db, now=now, settings=_settings(root), upload_root=root)

    assert cycle_source.exists()
    assert cycle_attempt.exists()
    assert grace_period_attempt.exists()
    assert not expired_attempt.exists()
    db.close()


def _practice_session(
    user_id: int,
    *,
    week_key: str,
    ability: str,
    source_url: str | None,
    completed_at: datetime,
) -> PracticeSession:
    return PracticeSession(
        user_id=user_id,
        week_key=week_key,
        skill_focus=ability,
        entry_mode="improve" if source_url else "category",
        category="人像",
        level=1,
        cycle_week=1,
        time_minutes=20,
        source_image_url=source_url,
        target_goal=ability,
        title="练习",
        brief="练习说明",
        status="completed",
        completed_at=completed_at,
    )


def _practice_attempt(session_id: int, user_id: int, image_url: str) -> PracticeAttempt:
    return PracticeAttempt(
        session_id=session_id,
        user_id=user_id,
        stage="final",
        image_url=image_url,
        image_urls_json=f'["{image_url}"]',
        self_reflection="",
        strength="完成目标",
        key_issue="",
        action_step="",
        reshoot_task="",
    )
