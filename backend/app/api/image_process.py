from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from contextlib import contextmanager
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.database import SessionLocal, get_db
from app.models.analysis import AnalysisJob
from app.models.user import User
from app.services.image_generator import ImageGenerationError, generate_edited_image


router = APIRouter(prefix="/image-process", tags=["image-process"])
logger = logging.getLogger("uvicorn.error")
IMAGE_PROCESS_JOB_KIND = "image_generation"
IMAGE_PROCESS_RESULT_REUSE_MINUTES = 10
_job_creation_locks = tuple(threading.Lock() for _ in range(64))


def fail_interrupted_image_process_jobs() -> None:
    """Fail image jobs that cannot survive an application process restart."""
    model = get_settings().image_model
    with SessionLocal() as db:
        jobs = list(
            db.scalars(
                select(AnalysisJob).where(
                    AnalysisJob.kind == IMAGE_PROCESS_JOB_KIND,
                    AnalysisJob.status.in_(("queued", "processing")),
                )
            )
        )
        completed_at = datetime.now(timezone.utc)
        for job in jobs:
            job.status = "failed"
            job.stage = "failed"
            job.progress = 100
            job.error = "服务更新中断了本次图片精修，请重新提交"
            job.completed_at = completed_at
        if jobs:
            db.commit()
            for job in jobs:
                logger.warning(
                    "image_generation_job_failed job_id=%s model=%s elapsed_ms=%s reason=restart",
                    job.id,
                    model,
                    _datetime_elapsed_ms(job.created_at, completed_at),
                )
            logger.warning("image_generation_jobs_interrupted count=%s", len(jobs))


class ImageProcessRequest(BaseModel):
    image_url: str = Field(max_length=600)
    target_style: str = Field(min_length=1, max_length=80)
    target_platform: str = Field(min_length=1, max_length=80)
    analysis_guidance: str | None = Field(default=None, max_length=8000)
    edit_instruction: str | None = Field(default=None, max_length=600)
    reference_image_urls: list[str] = Field(default_factory=list, max_length=3)


class ImageProcessResponse(BaseModel):
    image_url: str
    thumbnail_url: str | None = None
    model: str
    prompt: str
    editing_strategy: str | None = None


class ImageProcessJobResponse(BaseModel):
    id: str
    status: str
    stage: str
    progress: int
    result: ImageProcessResponse | None = None
    error: str | None = None
    elapsed_ms: int = 0


@router.post(
    "/jobs",
    response_model=ImageProcessJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_image_process_job(
    payload: ImageProcessRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    request_json = payload.model_dump_json()
    cache_key = _image_process_cache_key(payload)
    job, _created = _get_or_create_image_process_job(
        db,
        user_id=current_user.id,
        cache_key=cache_key,
        request_json=request_json,
    )
    # Committing the queued row and attaching a Starlette background task are
    # not atomic. Redispatch every queued result so a retry repairs the narrow
    # window where the row committed but the original process never ran it.
    # The runner claims the row under FOR UPDATE, so duplicate dispatch is safe.
    if job["status"] == "queued":
        background_tasks.add_task(_run_image_process_job, job["id"])
    return job


@router.get("/jobs/{job_id}", response_model=ImageProcessJobResponse)
def get_image_process_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    job = db.scalar(
        select(AnalysisJob).where(
            AnalysisJob.id == job_id,
            AnalysisJob.user_id == current_user.id,
            AnalysisJob.kind == IMAGE_PROCESS_JOB_KIND,
        )
    )
    if not job:
        raise HTTPException(status_code=404, detail="图片精修任务不存在")
    return _image_process_job_to_dict(job)


@router.post("/generate", response_model=ImageProcessResponse)
def process_image(
    payload: ImageProcessRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    try:
        return generate_edited_image(
            image_url=payload.image_url,
            user_id=current_user.id,
            target_style=payload.target_style,
            target_platform=payload.target_platform,
            analysis_guidance=payload.analysis_guidance,
            edit_instruction=payload.edit_instruction,
            reference_image_urls=payload.reference_image_urls,
        )
    except ImageGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _image_process_cache_key(payload: ImageProcessRequest) -> str:
    canonical = json.dumps(
        payload.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(f"{IMAGE_PROCESS_JOB_KIND}:{canonical}".encode("utf-8")).hexdigest()


def _get_or_create_image_process_job(
    db: Session,
    *,
    user_id: int,
    cache_key: str,
    request_json: str,
) -> tuple[dict, bool]:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=IMAGE_PROCESS_RESULT_REUSE_MINUTES)
    with _image_job_creation_lock(db, user_id, cache_key):
        reusable = db.scalar(
            select(AnalysisJob)
            .where(
                AnalysisJob.user_id == user_id,
                AnalysisJob.cache_key == cache_key,
                AnalysisJob.kind == IMAGE_PROCESS_JOB_KIND,
                or_(
                    AnalysisJob.status.in_(("queued", "processing")),
                    (
                        (AnalysisJob.status == "completed")
                        & (AnalysisJob.completed_at >= cutoff)
                        & AnalysisJob.result_json.is_not(None)
                    ),
                ),
            )
            .order_by(AnalysisJob.created_at.desc())
            .with_for_update()
        )
        if reusable:
            result = _image_process_job_to_dict(reusable)
            db.commit()
            return result, False

        try:
            job = AnalysisJob(
                id=str(uuid4()),
                user_id=user_id,
                cache_key=cache_key,
                kind=IMAGE_PROCESS_JOB_KIND,
                status="queued",
                stage="preparing",
                progress=10,
                request_json=request_json,
            )
            db.add(job)
            db.commit()
            db.refresh(job)
        except IntegrityError:
            db.rollback()
            active = db.scalar(
                select(AnalysisJob)
                .where(
                    AnalysisJob.user_id == user_id,
                    AnalysisJob.cache_key == cache_key,
                    AnalysisJob.kind == IMAGE_PROCESS_JOB_KIND,
                    AnalysisJob.status.in_(("queued", "processing")),
                )
                .order_by(AnalysisJob.created_at.desc())
            )
            if active:
                return _image_process_job_to_dict(active), False
            raise
        return _image_process_job_to_dict(job), True


@contextmanager
def _image_job_creation_lock(db: Session, user_id: int, cache_key: str) -> Iterator[None]:
    digest = hashlib.sha256(f"{user_id}:{cache_key}".encode("utf-8")).digest()
    lock_key = int.from_bytes(digest[:8], byteorder="big", signed=True)
    local_lock = _job_creation_locks[lock_key % len(_job_creation_locks)]
    with local_lock:
        if db.get_bind().dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": lock_key})
        yield


def _run_image_process_job(job_id: str) -> None:
    started_at = time.perf_counter()
    model = get_settings().image_model
    with SessionLocal() as db:
        job = db.scalar(
            select(AnalysisJob)
            .where(
                AnalysisJob.id == job_id,
                AnalysisJob.kind == IMAGE_PROCESS_JOB_KIND,
            )
            .with_for_update()
        )
        if not job or job.status != "queued":
            return
        try:
            payload = ImageProcessRequest.model_validate_json(job.request_json)
        except Exception as exc:
            logger.warning(
                "image_generation_job_invalid job_id=%s model=%s error_type=%s",
                job_id,
                model,
                type(exc).__name__,
            )
            _fail_image_process_job(db, job, "图片精修请求数据无效", started_at, model)
            return

        user_id = job.user_id
        job.status = "processing"
        job.stage = "generating"
        job.progress = 35
        db.commit()
        logger.info(
            "image_generation_job_started job_id=%s model=%s elapsed_ms=%s",
            job_id,
            model,
            _elapsed_ms(started_at),
        )

        try:
            result = generate_edited_image(
                image_url=payload.image_url,
                user_id=user_id,
                target_style=payload.target_style,
                target_platform=payload.target_platform,
                analysis_guidance=payload.analysis_guidance,
                edit_instruction=payload.edit_instruction,
                reference_image_urls=payload.reference_image_urls,
            )
            job.stage = "saving"
            job.progress = 90
            db.commit()

            job.result_json = json.dumps(result, ensure_ascii=False, default=str)
            job.status = "completed"
            job.stage = "completed"
            job.progress = 100
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            elapsed_ms = _elapsed_ms(started_at)
            logger.info(
                "image_generation_job_completed job_id=%s model=%s elapsed_ms=%s",
                job_id,
                model,
                elapsed_ms,
            )
        except ImageGenerationError as exc:
            _fail_image_process_job(db, job, str(exc), started_at, model)
        except Exception as exc:
            logger.warning(
                "image_generation_job_unexpected_error job_id=%s model=%s error_type=%s",
                job_id,
                model,
                type(exc).__name__,
            )
            _fail_image_process_job(db, job, "图片精修暂时失败，请稍后重试", started_at, model)


def _fail_image_process_job(
    db: Session,
    job: AnalysisJob,
    message: str,
    started_at: float,
    model: str,
) -> None:
    job.status = "failed"
    job.stage = "failed"
    job.progress = 100
    job.error = message[:500]
    job.completed_at = datetime.now(timezone.utc)
    db.commit()
    logger.warning(
        "image_generation_job_failed job_id=%s model=%s elapsed_ms=%s",
        job.id,
        model,
        _elapsed_ms(started_at),
    )


def _elapsed_ms(started_at: float) -> int:
    return max(0, int(round((time.perf_counter() - started_at) * 1000)))


def _datetime_elapsed_ms(started_at: datetime, finished_at: datetime) -> int:
    if finished_at.tzinfo is None and started_at.tzinfo is not None:
        finished_at = finished_at.replace(tzinfo=started_at.tzinfo)
    elif finished_at.tzinfo is not None and started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=finished_at.tzinfo)
    return max(0, int((finished_at - started_at).total_seconds() * 1000))


def _image_process_job_to_dict(job: AnalysisJob) -> dict:
    result = None
    if job.result_json:
        try:
            parsed = json.loads(job.result_json)
            result = parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            result = None
    finished_at = job.completed_at or job.updated_at or job.created_at
    return {
        "id": job.id,
        "status": job.status,
        "stage": job.stage,
        "progress": job.progress,
        "result": result,
        "error": job.error,
        "elapsed_ms": _datetime_elapsed_ms(job.created_at, finished_at),
    }
