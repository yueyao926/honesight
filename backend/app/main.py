import asyncio
import logging
import mimetypes
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.api import analyze, auth, community, image_process, inspiration, messages, portfolio, practice, preferences, profile, search, upload
from app.core.config import get_settings
from app.services.vision_analyzer import VisionAnalysisError, close_vision_http_client
from app.services.inspiration_scheduler import run_inspiration_sync_loop
from app.services.upload_cleanup_scheduler import run_upload_cleanup_loop


settings = get_settings()
settings.upload_path.mkdir(parents=True, exist_ok=True)
logger = logging.getLogger("uvicorn.error")

# Python's minimal Linux images do not always register WebP. Starlette's
# StaticFiles then serves generated/uploaded photos as text/plain, which some
# browsers refuse to render as images.
def register_image_mime_types() -> None:
    mimetypes.add_type("image/webp", ".webp", strict=True)
    mimetypes.add_type("image/webp", ".webp", strict=False)


register_image_mime_types()

@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_settings.cache_clear()
    runtime = get_settings()
    logger.info(
        "AI runtime mode=%s model=%s enabled=%s",
        runtime.ai_analysis_mode,
        runtime.resolved_ai_model,
        runtime.ai_analysis_enabled,
    )
    logger.info(
        "Image generation model=%s enabled=%s configured=%s",
        runtime.image_model,
        runtime.image_generation_enabled,
        bool(runtime.resolved_image_api_key),
    )
    analyze.fail_stale_analysis_jobs()
    inspiration_sync_task = asyncio.create_task(run_inspiration_sync_loop())
    upload_cleanup_task = asyncio.create_task(run_upload_cleanup_loop())
    try:
        yield
    finally:
        inspiration_sync_task.cancel()
        upload_cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await inspiration_sync_task
        with suppress(asyncio.CancelledError):
            await upload_cleanup_task
        close_vision_http_client()


app = FastAPI(title="HoneSight API", version="0.1.0", lifespan=lifespan)

@app.exception_handler(VisionAnalysisError)
async def handle_vision_analysis_error(_request: Request, exc: VisionAnalysisError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(settings.upload_path)), name="uploads")

app.include_router(auth.router)
app.include_router(preferences.router)
app.include_router(portfolio.router)
app.include_router(upload.router)
app.include_router(profile.router)
app.include_router(analyze.router)
app.include_router(practice.router)
app.include_router(inspiration.router)
app.include_router(image_process.router)
app.include_router(community.router)
app.include_router(messages.router)
app.include_router(search.router)


@app.get("/health")
def health() -> dict[str, str | bool]:
    runtime = get_settings()
    return {
        "status": "ok",
        "ai_analysis_mode": runtime.ai_analysis_mode,
        "ai_model": runtime.resolved_ai_model,
        "image_generation_enabled": runtime.image_generation_enabled,
        "image_generation_configured": bool(runtime.resolved_image_api_key),
        "image_model": runtime.image_model,
    }
