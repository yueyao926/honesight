import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.api import analyze, auth, community, image_process, inspiration, messages, portfolio, practice, preferences, profile, search, upload
from app.core.config import get_settings
from app.services.vision_analyzer import VisionAnalysisError, close_vision_http_client
from app.services.inspiration_scheduler import run_inspiration_sync_loop


settings = get_settings()
settings.upload_path.mkdir(parents=True, exist_ok=True)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    analyze.fail_stale_analysis_jobs()
    inspiration_sync_task = asyncio.create_task(run_inspiration_sync_loop())
    try:
        yield
    finally:
        inspiration_sync_task.cancel()
        with suppress(asyncio.CancelledError):
            await inspiration_sync_task
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
def health() -> dict[str, str]:
    return {"status": "ok"}
