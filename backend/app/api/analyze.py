import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import SessionLocal, get_db
from app.models.analysis import AnalysisCache, AnalysisJob, AnalysisResult
from app.models.portfolio import PortfolioItem
from app.models.preference import Preference
from app.models.user import User
from app.schemas.analysis import (
    AnalysisDetailsRequest,
    AnalysisRead,
    AnalysisJobRead,
    AnalyzeRequest,
    PreviewAnalyzeRequest,
    analysis_to_read_dict,
    preview_to_read_dict,
)
from app.services.analysis_cache import get_cached_analysis
from app.services.analyzer import (
    analyze_details_context_cached,
    analyze_photo_context_cached,
    analyze_quick_context_cached,
    build_details_analysis_cache_key,
    build_full_analysis_cache_key,
    build_quick_analysis_cache_key,
)
from app.services.vision_analyzer import VisionAnalysisError


router = APIRouter(prefix="/analyze", tags=["analyze"])
logger = logging.getLogger("uvicorn.error")


def fail_stale_analysis_jobs() -> None:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=10)
    with SessionLocal() as db:
        rows = list(
            db.scalars(
                select(AnalysisJob).where(
                    AnalysisJob.status.in_(("queued", "processing")),
                    AnalysisJob.updated_at < cutoff,
                )
            )
        )
        for job in rows:
            job.status = "failed"
            job.stage = "failed"
            job.error = "服务更新中断了本次分析，请重新提交"
            job.completed_at = datetime.now(timezone.utc)
        if rows:
            db.flush()
        db.execute(delete(AnalysisCache).where(AnalysisCache.expires_at <= now))
        db.execute(
            delete(AnalysisJob).where(
                AnalysisJob.status.in_(("completed", "failed")),
                AnalysisJob.created_at < now - timedelta(days=7),
            )
        )
        db.commit()


@router.post("/preview", response_model=AnalysisRead)
def analyze_preview(
    payload: PreviewAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    report, _cache_hit = analyze_photo_context_cached(
        db=db,
        user_id=current_user.id,
        image_url=payload.image_url,
        preference=preference,
        target_style=payload.target_style,
        target_platform=payload.target_platform,
        style_reference_urls=payload.style_reference_image_urls,
        title=payload.title or "待分析作品",
        description=payload.description,
        category=payload.category,
    )
    result = preview_to_read_dict(report)
    result["analysis_report"] = report
    db.commit()
    return result


@router.post(
    "/preview/quick-jobs",
    response_model=AnalysisJobRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_quick_analysis_job(
    payload: PreviewAnalyzeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    cache_key = build_quick_analysis_cache_key(
        user_id=current_user.id,
        image_url=payload.image_url,
        target_style=payload.target_style or "清新自然",
        target_platform=payload.target_platform or "作品集",
        category=payload.category,
    )
    cached = get_cached_analysis(db, current_user.id, cache_key)
    if cached is not None:
        return _create_completed_job(
            db,
            user_id=current_user.id,
            cache_key=cache_key,
            kind="preview_quick",
            request_json=payload.model_dump_json(),
            result=cached,
        )
    active = _find_active_job(db, current_user.id, cache_key)
    if active:
        return _job_to_dict(active)
    job = _create_queued_job(
        db,
        user_id=current_user.id,
        cache_key=cache_key,
        kind="preview_quick",
        request_json=payload.model_dump_json(),
    )
    background_tasks.add_task(_run_quick_analysis_job, job.id)
    return _job_to_dict(job)


@router.post(
    "/details/jobs",
    response_model=AnalysisJobRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_analysis_details_job(
    payload: AnalysisDetailsRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    cache_key = build_details_analysis_cache_key(
        user_id=current_user.id,
        image_url=payload.image_url,
        target_style=payload.target_style,
        target_platform=payload.target_platform,
        analysis_summary=payload.analysis_summary,
    )
    cached = get_cached_analysis(db, current_user.id, cache_key)
    if cached is not None:
        return _create_completed_job(
            db,
            user_id=current_user.id,
            cache_key=cache_key,
            kind="preview_details",
            request_json=payload.model_dump_json(),
            result=cached,
        )
    active = _find_active_job(db, current_user.id, cache_key)
    if active:
        return _job_to_dict(active)
    job = _create_queued_job(
        db,
        user_id=current_user.id,
        cache_key=cache_key,
        kind="preview_details",
        request_json=payload.model_dump_json(),
    )
    background_tasks.add_task(_run_analysis_details_job, job.id)
    return _job_to_dict(job)


@router.post(
    "/preview/jobs",
    response_model=AnalysisJobRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_preview_analysis_job(
    payload: PreviewAnalyzeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    title = payload.title or "待分析作品"
    cache_key = build_full_analysis_cache_key(
        user_id=current_user.id,
        image_url=payload.image_url,
        preference=preference,
        target_style=payload.target_style,
        target_platform=payload.target_platform,
        style_reference_urls=payload.style_reference_image_urls,
        title=title,
        description=payload.description,
        category=payload.category,
    )
    cached = get_cached_analysis(db, current_user.id, cache_key)
    if cached is not None:
        result = preview_to_read_dict(cached)
        job = AnalysisJob(
            id=str(uuid4()),
            user_id=current_user.id,
            cache_key=cache_key,
            kind="preview",
            status="completed",
            stage="completed",
            progress=100,
            request_json=payload.model_dump_json(),
            result_json=json.dumps(result, ensure_ascii=False, default=str),
            cache_hit=1,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return _job_to_dict(job)

    active = db.scalar(
        select(AnalysisJob)
        .where(
            AnalysisJob.user_id == current_user.id,
            AnalysisJob.cache_key == cache_key,
            AnalysisJob.status.in_(("queued", "processing")),
        )
        .order_by(AnalysisJob.created_at.desc())
    )
    if active:
        return _job_to_dict(active)

    job = AnalysisJob(
        id=str(uuid4()),
        user_id=current_user.id,
        cache_key=cache_key,
        kind="preview",
        status="queued",
        stage="preparing",
        progress=10,
        request_json=payload.model_dump_json(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(_run_preview_analysis_job, job.id)
    return _job_to_dict(job)


@router.get("/jobs/{job_id}", response_model=AnalysisJobRead)
def get_analysis_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    job = db.scalar(
        select(AnalysisJob).where(
            AnalysisJob.id == job_id,
            AnalysisJob.user_id == current_user.id,
        )
    )
    if not job:
        raise HTTPException(status_code=404, detail="分析任务不存在")
    return _job_to_dict(job)


@router.post("/photo", response_model=AnalysisRead)
def analyze_photo(
    payload: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisResult:
    item = db.scalar(
        select(PortfolioItem).where(
            PortfolioItem.id == payload.portfolio_item_id,
            PortfolioItem.user_id == current_user.id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Portfolio item not found")

    if payload.target_style:
        item.target_style = payload.target_style
    if payload.target_platform:
        item.target_platform = payload.target_platform

    preference = db.scalar(select(Preference).where(Preference.user_id == current_user.id))
    report, _cache_hit = analyze_photo_context_cached(
        db=db,
        user_id=current_user.id,
        image_url=item.image_url,
        preference=preference,
        target_style=payload.target_style or item.target_style,
        target_platform=payload.target_platform or item.target_platform,
        style_reference_urls=payload.style_reference_image_urls,
        title=item.title,
        description=item.description,
        category=item.category,
    )
    analysis = AnalysisResult(
        portfolio_item_id=item.id,
        user_id=current_user.id,
        **report,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis_to_read_dict(analysis)


def _run_quick_analysis_job(job_id: str) -> None:
    with SessionLocal() as db:
        job = db.get(AnalysisJob, job_id)
        if not job or job.status == "completed":
            return
        try:
            payload = PreviewAnalyzeRequest.model_validate_json(job.request_json)
            job.status = "processing"
            job.stage = "quick_analyzing"
            job.progress = 45
            db.commit()
            result, cache_hit = analyze_quick_context_cached(
                db=db,
                user_id=job.user_id,
                image_url=payload.image_url,
                target_style=payload.target_style,
                target_platform=payload.target_platform,
                category=payload.category,
            )
            _complete_job(db, job, result, cache_hit)
        except VisionAnalysisError as exc:
            _fail_job(db, job, str(exc))
        except Exception:
            logger.exception("quick analysis job failed job_id=%s", job_id)
            _fail_job(db, job, "快速分析暂时失败，请稍后重试")


def _run_analysis_details_job(job_id: str) -> None:
    with SessionLocal() as db:
        job = db.get(AnalysisJob, job_id)
        if not job or job.status == "completed":
            return
        try:
            payload = AnalysisDetailsRequest.model_validate_json(job.request_json)
            job.status = "processing"
            job.stage = "details_analyzing"
            job.progress = 45
            db.commit()
            result, cache_hit = analyze_details_context_cached(
                db=db,
                user_id=job.user_id,
                image_url=payload.image_url,
                target_style=payload.target_style,
                target_platform=payload.target_platform,
                analysis_summary=payload.analysis_summary,
            )
            _complete_job(db, job, result, cache_hit)
        except VisionAnalysisError as exc:
            _fail_job(db, job, str(exc))
        except Exception:
            logger.exception("analysis details job failed job_id=%s", job_id)
            _fail_job(db, job, "详细参数暂时生成失败，请稍后重试")


def _run_preview_analysis_job(job_id: str) -> None:
    with SessionLocal() as db:
        job = db.get(AnalysisJob, job_id)
        if not job or job.status == "completed":
            return
        try:
            payload = PreviewAnalyzeRequest.model_validate_json(job.request_json)
            preference = db.scalar(select(Preference).where(Preference.user_id == job.user_id))
            job.status = "processing"
            job.stage = "analyzing"
            job.progress = 35
            db.commit()

            report, cache_hit = analyze_photo_context_cached(
                db=db,
                user_id=job.user_id,
                image_url=payload.image_url,
                preference=preference,
                target_style=payload.target_style,
                target_platform=payload.target_platform,
                style_reference_urls=payload.style_reference_image_urls,
                title=payload.title or "待分析作品",
                description=payload.description,
                category=payload.category,
            )
            job.stage = "organizing"
            job.progress = 90
            db.commit()

            result = preview_to_read_dict(report)
            _complete_job(db, job, result, cache_hit)
        except VisionAnalysisError as exc:
            _fail_job(db, job, str(exc))
        except Exception:
            logger.exception("preview analysis job failed job_id=%s", job_id)
            _fail_job(db, job, "分析暂时失败，请稍后重试")


def _fail_job(db: Session, job: AnalysisJob, message: str) -> None:
    job.status = "failed"
    job.stage = "failed"
    job.error = message[:500]
    job.completed_at = datetime.now(timezone.utc)
    db.commit()


def _complete_job(db: Session, job: AnalysisJob, result: dict, cache_hit: bool) -> None:
    job.result_json = json.dumps(result, ensure_ascii=False, default=str)
    job.cache_hit = int(cache_hit)
    job.status = "completed"
    job.stage = "completed"
    job.progress = 100
    job.completed_at = datetime.now(timezone.utc)
    db.commit()


def _find_active_job(db: Session, user_id: int, cache_key: str) -> AnalysisJob | None:
    return db.scalar(
        select(AnalysisJob)
        .where(
            AnalysisJob.user_id == user_id,
            AnalysisJob.cache_key == cache_key,
            AnalysisJob.status.in_(("queued", "processing")),
        )
        .order_by(AnalysisJob.created_at.desc())
    )


def _create_queued_job(
    db: Session,
    *,
    user_id: int,
    cache_key: str,
    kind: str,
    request_json: str,
) -> AnalysisJob:
    job = AnalysisJob(
        id=str(uuid4()),
        user_id=user_id,
        cache_key=cache_key,
        kind=kind,
        status="queued",
        stage="preparing",
        progress=10,
        request_json=request_json,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def _create_completed_job(
    db: Session,
    *,
    user_id: int,
    cache_key: str,
    kind: str,
    request_json: str,
    result: dict,
) -> dict:
    job = AnalysisJob(
        id=str(uuid4()),
        user_id=user_id,
        cache_key=cache_key,
        kind=kind,
        status="completed",
        stage="completed",
        progress=100,
        request_json=request_json,
        result_json=json.dumps(result, ensure_ascii=False, default=str),
        cache_hit=1,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


def _job_to_dict(job: AnalysisJob) -> dict:
    result = None
    if job.result_json:
        try:
            parsed = json.loads(job.result_json)
            result = parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            result = None
    finished_at = job.completed_at or job.updated_at or job.created_at
    elapsed_ms = max(0, int((finished_at - job.created_at).total_seconds() * 1000))
    return {
        "id": job.id,
        "status": job.status,
        "stage": job.stage,
        "progress": job.progress,
        "cache_hit": bool(job.cache_hit),
        "result": result,
        "error": job.error,
        "elapsed_ms": elapsed_ms,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }
