from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import analyze, auth, inspiration, portfolio, preferences, upload
from app.core.config import get_settings


settings = get_settings()
settings.upload_path.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="LensCoach API", version="0.1.0")

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
app.include_router(analyze.router)
app.include_router(inspiration.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
