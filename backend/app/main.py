from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.api import analyze, auth, community, image_process, inspiration, portfolio, preferences, profile, upload
from app.core.config import get_settings
from app.services.vision_analyzer import VisionAnalysisError


settings = get_settings()
settings.upload_path.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="LensCoach API", version="0.1.0")

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
app.include_router(inspiration.router)
app.include_router(image_process.router)
app.include_router(community.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
