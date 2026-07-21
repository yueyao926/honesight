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
    ai_analysis_mode: str = Field(default="api", alias="AI_ANALYSIS_MODE")
    ai_api_key: str | None = Field(default=None, alias="AI_API_KEY")
    ai_base_url: str = Field(default="https://ark.cn-beijing.volces.com/api/v3", alias="AI_BASE_URL")
    ai_model: str = Field(default="doubao-seed-1-6-vision-250815", alias="AI_MODEL")
    ai_timeout_seconds: int = Field(default=45, alias="AI_TIMEOUT_SECONDS")
    image_generation_enabled: bool = Field(default=False, alias="IMAGE_GENERATION_ENABLED")
    image_api_key: str | None = Field(default=None, alias="IMAGE_API_KEY")
    image_base_url: str = Field(default="https://ark.cn-beijing.volces.com/api/v3", alias="IMAGE_BASE_URL")
    image_model: str = Field(default="doubao-seedream-5-0-260128", alias="IMAGE_MODEL")
    image_size: str = Field(default="2K", alias="IMAGE_SIZE")
    image_timeout_seconds: int = Field(default=120, alias="IMAGE_TIMEOUT_SECONDS")
    image_watermark: bool = Field(default=False, alias="IMAGE_WATERMARK")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8-sig", populate_by_name=True, extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir)

    @property
    def resolved_ai_api_key(self) -> str | None:
        return self.ai_api_key or self.ark_api_key

    @property
    def resolved_ai_base_url(self) -> str:
        return self.ai_base_url.rstrip("/")

    @property
    def resolved_ai_model(self) -> str:
        return self.ai_model or self.ark_vision_model

    @property
    def resolved_image_api_key(self) -> str | None:
        return self.image_api_key or self.ai_api_key or self.ark_api_key

    @property
    def resolved_image_base_url(self) -> str:
        return self.image_base_url.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
