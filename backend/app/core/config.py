from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(default="postgresql://postgres:password@localhost:5432/lenscoach", alias="DATABASE_URL")
    jwt_secret_key: str = Field(default="please-change-this", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=10080, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    backend_cors_origins: str = Field(default="http://localhost:5173", alias="BACKEND_CORS_ORIGINS")
    upload_dir: str = Field(default="uploads", alias="UPLOAD_DIR")
    ark_api_key: str | None = Field(default=None, alias="ARK_API_KEY")
    ark_api_url: str = Field(default="https://ark.cn-beijing.volces.com/api/v3/responses", alias="ARK_API_URL")
    ark_vision_model: str = Field(default="doubao-seed-1-6-vision-250815", alias="ARK_VISION_MODEL")
    ai_analysis_enabled: bool = Field(default=True, alias="AI_ANALYSIS_ENABLED")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8-sig", populate_by_name=True, extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir)


@lru_cache
def get_settings() -> Settings:
    return Settings()
