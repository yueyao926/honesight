import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from types import SimpleNamespace

import pytest
from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.api import image_process
from app.database import Base
from app.models.analysis import AnalysisJob
from app.models.user import User
from app.services.image_generator import ImageGenerationError


def _session_factory(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'image-jobs.db'}")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


def _create_user(db, username: str = "image-job-user") -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        hashed_password="x",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _payload(edit_instruction: str = "稍微提亮主体") -> image_process.ImageProcessRequest:
    return image_process.ImageProcessRequest(
        image_url="/uploads/1_source.webp",
        target_style="电影感",
        target_platform="作品集",
        analysis_guidance="主体略暗",
        edit_instruction=edit_instruction,
        reference_image_urls=["/uploads/1_reference.webp"],
    )


def _start(db, user: User, payload: image_process.ImageProcessRequest):
    tasks = BackgroundTasks()
    response = image_process.start_image_process_job(payload, tasks, user, db)
    return response, tasks


def test_job_submission_reuses_active_and_recently_completed_result(tmp_path) -> None:
    factory = _session_factory(tmp_path)
    with factory() as db:
        user = _create_user(db)
        first, first_tasks = _start(db, user, _payload())
        second, second_tasks = _start(db, user, _payload())

        assert first["status"] == "queued"
        assert first["stage"] == "preparing"
        assert len(first_tasks.tasks) == 1
        assert second["id"] == first["id"]
        assert len(second_tasks.tasks) == 1
        assert db.query(AnalysisJob).count() == 1

        job = db.get(AnalysisJob, first["id"])
        job.status = "completed"
        job.stage = "completed"
        job.progress = 100
        job.result_json = json.dumps(
            {
                "image_url": "/uploads/generated/result.webp",
                "thumbnail_url": "/uploads/generated/result_thumb.webp",
                "model": "image-test",
                "prompt": "internal prompt",
            }
        )
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

        recovered, recovered_tasks = _start(db, user, _payload())
        assert recovered["id"] == first["id"]
        assert recovered["status"] == "completed"
        assert recovered["result"]["image_url"] == "/uploads/generated/result.webp"
        assert len(recovered_tasks.tasks) == 0
        assert db.query(AnalysisJob).count() == 1


def test_reused_queued_job_is_redispatched_but_generated_only_once(
    tmp_path,
    monkeypatch,
) -> None:
    factory = _session_factory(tmp_path)
    with factory() as db:
        user = _create_user(db)
        first, first_tasks = _start(db, user, _payload())
        second, second_tasks = _start(db, user, _payload())

    generation_calls = 0

    def generate(**_kwargs):
        nonlocal generation_calls
        generation_calls += 1
        return {
            "image_url": "/uploads/generated/result.webp",
            "thumbnail_url": "/uploads/generated/result_thumb.webp",
            "model": "safe-model",
            "prompt": "internal prompt",
        }

    monkeypatch.setattr(image_process, "SessionLocal", factory)
    monkeypatch.setattr(
        image_process,
        "get_settings",
        lambda: SimpleNamespace(image_model="safe-model"),
    )
    monkeypatch.setattr(image_process, "generate_edited_image", generate)

    assert first["id"] == second["id"]
    assert len(first_tasks.tasks) == len(second_tasks.tasks) == 1
    for tasks in (first_tasks, second_tasks):
        task = tasks.tasks[0]
        task.func(*task.args, **task.kwargs)

    assert generation_calls == 1
    with factory() as db:
        job = db.get(AnalysisJob, first["id"])
        assert job.status == "completed"


def test_changed_or_expired_request_creates_a_new_job(tmp_path) -> None:
    factory = _session_factory(tmp_path)
    with factory() as db:
        user = _create_user(db)
        first, _tasks = _start(db, user, _payload())
        first_job = db.get(AnalysisJob, first["id"])
        first_job.status = "completed"
        first_job.stage = "completed"
        first_job.progress = 100
        first_job.result_json = '{"image_url":"/uploads/generated/old.webp","model":"m","prompt":"p"}'
        first_job.completed_at = datetime.now(timezone.utc) - timedelta(
            minutes=image_process.IMAGE_PROCESS_RESULT_REUSE_MINUTES + 1
        )
        db.commit()

        expired, expired_tasks = _start(db, user, _payload())
        changed, changed_tasks = _start(db, user, _payload("改成冷色调"))

        assert expired["id"] != first["id"]
        assert changed["id"] != expired["id"]
        assert len(expired_tasks.tasks) == 1
        assert len(changed_tasks.tasks) == 1
        assert db.query(AnalysisJob).count() == 3


def test_concurrent_identical_submissions_create_only_one_job(tmp_path) -> None:
    factory = _session_factory(tmp_path)
    with factory() as db:
        user_id = _create_user(db).id
    payload = _payload()
    cache_key = image_process._image_process_cache_key(payload)
    request_json = payload.model_dump_json()
    barrier = Barrier(2)

    def submit():
        with factory() as db:
            barrier.wait()
            return image_process._get_or_create_image_process_job(
                db,
                user_id=user_id,
                cache_key=cache_key,
                request_json=request_json,
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _index: submit(), range(2)))

    assert len({result[0]["id"] for result in results}) == 1
    assert sorted(result[1] for result in results) == [False, True]
    with factory() as db:
        assert db.query(AnalysisJob).count() == 1


def test_background_job_completes_and_logs_only_safe_identifiers(
    tmp_path,
    monkeypatch,
    caplog,
) -> None:
    factory = _session_factory(tmp_path)
    with factory() as db:
        user = _create_user(db)
        queued, _tasks = _start(db, user, _payload("private-instruction-marker"))
        user_id = user.id

    generated = {
        "image_url": "/uploads/generated/result.webp",
        "thumbnail_url": "/uploads/generated/result_thumb.webp",
        "model": "safe-model",
        "prompt": "provider-prompt-marker",
        "editing_strategy": "完成精修",
    }
    monkeypatch.setattr(image_process, "SessionLocal", factory)
    monkeypatch.setattr(
        image_process,
        "get_settings",
        lambda: SimpleNamespace(image_model="safe-model"),
    )
    generation_calls = 0

    def generate(**_kwargs):
        nonlocal generation_calls
        generation_calls += 1
        return generated

    monkeypatch.setattr(image_process, "generate_edited_image", generate)
    caplog.set_level(logging.INFO, logger="uvicorn.error")

    image_process._run_image_process_job(queued["id"])
    image_process._run_image_process_job(queued["id"])

    with factory() as db:
        job = db.get(AnalysisJob, queued["id"])
        assert job.user_id == user_id
        assert job.status == "completed"
        assert job.stage == "completed"
        assert job.progress == 100
        assert json.loads(job.result_json) == generated
    assert generation_calls == 1
    assert f"image_generation_job_started job_id={queued['id']} model=safe-model" in caplog.text
    assert f"image_generation_job_completed job_id={queued['id']} model=safe-model" in caplog.text
    assert "elapsed_ms=" in caplog.text
    assert "private-instruction-marker" not in caplog.text
    assert "provider-prompt-marker" not in caplog.text
    assert "/uploads/" not in caplog.text


def test_background_job_records_provider_failure_without_sensitive_log_data(
    tmp_path,
    monkeypatch,
    caplog,
) -> None:
    factory = _session_factory(tmp_path)
    with factory() as db:
        user = _create_user(db)
        queued, _tasks = _start(db, user, _payload("secret-edit-marker"))

    monkeypatch.setattr(image_process, "SessionLocal", factory)
    monkeypatch.setattr(
        image_process,
        "get_settings",
        lambda: SimpleNamespace(image_model="safe-model"),
    )

    def fail_generation(**_kwargs):
        raise ImageGenerationError("上游暂时不可用")

    monkeypatch.setattr(image_process, "generate_edited_image", fail_generation)
    caplog.set_level(logging.INFO, logger="uvicorn.error")

    image_process._run_image_process_job(queued["id"])

    with factory() as db:
        job = db.get(AnalysisJob, queued["id"])
        assert job.status == "failed"
        assert job.stage == "failed"
        assert job.error == "上游暂时不可用"
    assert f"image_generation_job_failed job_id={queued['id']} model=safe-model" in caplog.text
    assert "elapsed_ms=" in caplog.text
    assert "secret-edit-marker" not in caplog.text
    assert "/uploads/" not in caplog.text


def test_job_lookup_is_scoped_to_its_owner(tmp_path) -> None:
    factory = _session_factory(tmp_path)
    with factory() as db:
        owner = _create_user(db, "image-owner")
        stranger = _create_user(db, "image-stranger")
        queued, _tasks = _start(db, owner, _payload())

        with pytest.raises(HTTPException) as exc_info:
            image_process.get_image_process_job(queued["id"], stranger, db)

        assert exc_info.value.status_code == 404


def test_startup_fails_only_interrupted_image_generation_jobs(tmp_path, monkeypatch) -> None:
    factory = _session_factory(tmp_path)
    with factory() as db:
        user = _create_user(db)
        image_queued = AnalysisJob(
            id="image-queued",
            user_id=user.id,
            cache_key="a" * 64,
            kind=image_process.IMAGE_PROCESS_JOB_KIND,
            status="queued",
            stage="preparing",
            progress=10,
            request_json="{}",
        )
        image_processing = AnalysisJob(
            id="image-processing",
            user_id=user.id,
            cache_key="b" * 64,
            kind=image_process.IMAGE_PROCESS_JOB_KIND,
            status="processing",
            stage="generating",
            progress=35,
            request_json="{}",
        )
        analysis_queued = AnalysisJob(
            id="analysis-queued",
            user_id=user.id,
            cache_key="c" * 64,
            kind="preview",
            status="queued",
            stage="preparing",
            progress=10,
            request_json="{}",
        )
        db.add_all((image_queued, image_processing, analysis_queued))
        db.commit()

    monkeypatch.setattr(image_process, "SessionLocal", factory)
    image_process.fail_interrupted_image_process_jobs()

    with factory() as db:
        rows = {
            job.id: job
            for job in db.scalars(select(AnalysisJob).where(AnalysisJob.id.in_((
                "image-queued",
                "image-processing",
                "analysis-queued",
            ))))
        }
        assert rows["image-queued"].status == "failed"
        assert rows["image-processing"].status == "failed"
        assert rows["image-queued"].error == "服务更新中断了本次图片精修，请重新提交"
        assert rows["analysis-queued"].status == "queued"
