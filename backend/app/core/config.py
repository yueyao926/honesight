from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(default="postgresql://postgres:password@localhost:5432/HoneSight", alias="DATABASE_URL")
    jwt_secret_key: str = Field(default="please-change-this", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=15, ge=1, le=10080, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=14, ge=1, le=365, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    refresh_token_reuse_grace_seconds: int = Field(
        default=30,
        ge=0,
        le=300,
        alias="REFRESH_TOKEN_REUSE_GRACE_SECONDS",
    )
    session_cookie_name: str = Field(default="lenscoach_refresh", alias="SESSION_COOKIE_NAME")
    session_cookie_secure: bool = Field(default=False, alias="SESSION_COOKIE_SECURE")
    session_cookie_samesite: Literal["lax", "strict", "none"] = Field(
        default="lax",
        alias="SESSION_COOKIE_SAMESITE",
    )
    session_cookie_domain: str | None = Field(default=None, alias="SESSION_COOKIE_DOMAIN")
    frontend_base_url: str = Field(default="http://localhost:5173", alias="FRONTEND_BASE_URL")
    smtp_host: str | None = Field(default=None, alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: str | None = Field(default=None, alias="SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_from: str = Field(default="HoneSight <noreply@honesight.app>", alias="SMTP_FROM")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")
    smtp_use_ssl: bool = Field(default=False, alias="SMTP_USE_SSL")
    email_verification_expire_minutes: int = Field(default=1440, ge=1, le=10080, alias="EMAIL_VERIFICATION_EXPIRE_MINUTES")
    password_reset_expire_minutes: int = Field(default=30, ge=1, le=1440, alias="PASSWORD_RESET_EXPIRE_MINUTES")
    backend_cors_origins: str = Field(default="http://localhost:5173", alias="BACKEND_CORS_ORIGINS")
    upload_dir: str = Field(default="uploads", alias="UPLOAD_DIR")
    ark_api_key: str | None = Field(default=None, alias="ARK_API_KEY")
    ark_api_url: str = Field(default="https://ark.cn-beijing.volces.com/api/v3/responses", alias="ARK_API_URL")
    ark_vision_model: str = Field(default="doubao-seed-1.6-vision-250815", alias="ARK_VISION_MODEL")
    ai_analysis_enabled: bool = Field(default=True, alias="AI_ANALYSIS_ENABLED")
    ai_analysis_mode: str = Field(default="api", alias="AI_ANALYSIS_MODE")
    ai_api_key: str | None = Field(default=None, alias="AI_API_KEY")
    ai_base_url: str = Field(default="https://ark.cn-beijing.volces.com/api/v3", alias="AI_BASE_URL")
    ai_model: str = Field(default="doubao-seed-1.6-vision-250815", alias="AI_MODEL")
    ai_practice_model: str = Field(default="", alias="AI_PRACTICE_MODEL")
    ai_fast_model: str = Field(default="doubao-seed-2-0-lite-260215", alias="AI_FAST_MODEL")
    ai_fast_timeout_seconds: int = Field(default=8, alias="AI_FAST_TIMEOUT_SECONDS")
    ai_timeout_seconds: int = Field(default=45, alias="AI_TIMEOUT_SECONDS")
    ai_public_api_base_url: str = Field(default="", alias="AI_PUBLIC_API_BASE_URL")
    analysis_cache_ttl_hours: int = Field(default=720, alias="ANALYSIS_CACHE_TTL_HOURS")
    upload_cleanup_enabled: bool = Field(default=True, alias="UPLOAD_CLEANUP_ENABLED")
    upload_cleanup_interval_hours: int = Field(default=12, alias="UPLOAD_CLEANUP_INTERVAL_HOURS")
    upload_cleanup_startup_delay_seconds: int = Field(default=30, alias="UPLOAD_CLEANUP_STARTUP_DELAY_SECONDS")
    analysis_image_retention_hours: int = Field(default=72, alias="ANALYSIS_IMAGE_RETENTION_HOURS")
    generated_image_retention_hours: int = Field(default=168, alias="GENERATED_IMAGE_RETENTION_HOURS")
    practice_image_retention_days: int = Field(default=30, alias="PRACTICE_IMAGE_RETENTION_DAYS")
    orphan_image_retention_hours: int = Field(default=72, alias="ORPHAN_IMAGE_RETENTION_HOURS")
    unsplash_access_key: str | None = Field(default=None, alias="UNSPLASH_ACCESS_KEY")
    openverse_client_id: str | None = Field(default=None, alias="OPENVERSE_CLIENT_ID")
    openverse_client_secret: str | None = Field(default=None, alias="OPENVERSE_CLIENT_SECRET")
    inspiration_daily_count: int = Field(default=4, alias="INSPIRATION_DAILY_COUNT")
    inspiration_recent_exclusion_days: int = Field(default=14, alias="INSPIRATION_RECENT_EXCLUSION_DAYS")
    inspiration_admin_emails: str = Field(default="", alias="INSPIRATION_ADMIN_EMAILS")
    inspiration_sync_enabled: bool = Field(default=True, alias="INSPIRATION_SYNC_ENABLED")
    inspiration_sync_interval_hours: int = Field(default=168, alias="INSPIRATION_SYNC_INTERVAL_HOURS")
    inspiration_sync_per_topic: int = Field(default=20, alias="INSPIRATION_SYNC_PER_TOPIC")
    inspiration_sync_startup_delay_seconds: int = Field(default=15, alias="INSPIRATION_SYNC_STARTUP_DELAY_SECONDS")
    inspiration_sync_topics: str = Field(
        default="portrait,landscape,street photography,architecture,still life,night photography,animals",
        alias="INSPIRATION_SYNC_TOPICS",
    )
    image_generation_enabled: bool = Field(default=False, alias="IMAGE_GENERATION_ENABLED")
    image_api_key: str | None = Field(default=None, alias="IMAGE_API_KEY")
    image_base_url: str = Field(default="https://ark.cn-beijing.volces.com/api/v3", alias="IMAGE_BASE_URL")
    image_model: str = Field(default="doubao-seedream-5-0-260128", alias="IMAGE_MODEL")
    image_size: str = Field(default="2K", alias="IMAGE_SIZE")
    image_timeout_seconds: int = Field(default=120, alias="IMAGE_TIMEOUT_SECONDS")
    image_watermark: bool = Field(default=False, alias="IMAGE_WATERMARK")
    message_image_max_size: int = Field(default=8 * 1024 * 1024, alias="MESSAGE_IMAGE_MAX_SIZE")
    message_rate_limit: int = Field(default=20, alias="MESSAGE_RATE_LIMIT")
    message_request_daily_limit: int = Field(default=10, alias="MESSAGE_REQUEST_DAILY_LIMIT")
    search_result_limit: int = Field(default=24, alias="SEARCH_RESULT_LIMIT")
    search_semantic_enabled: bool = Field(default=False, alias="SEARCH_SEMANTIC_ENABLED")
    embedding_provider: str = Field(default="", alias="EMBEDDING_PROVIDER")
    text_embedding_model: str = Field(default="", alias="TEXT_EMBEDDING_MODEL")
    image_embedding_model: str = Field(default="", alias="IMAGE_EMBEDDING_MODEL")
    embedding_dimension: int = Field(default=0, alias="EMBEDDING_DIMENSION")
    image_caption_enabled: bool = Field(default=False, alias="IMAGE_CAPTION_ENABLED")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8-sig", populate_by_name=True, extra="ignore")

    @model_validator(mode="after")
    def validate_session_cookie(self) -> "Settings":
        if self.session_cookie_samesite == "none" and not self.session_cookie_secure:
            raise ValueError("SESSION_COOKIE_SECURE must be true when SESSION_COOKIE_SAMESITE=none")
        return self

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def resolved_session_cookie_domain(self) -> str | None:
        return self.session_cookie_domain.strip() if self.session_cookie_domain else None

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
    def resolved_ai_fast_model(self) -> str:
        return self.ai_fast_model or self.resolved_ai_model

    @property
    def resolved_ai_practice_model(self) -> str:
        return self.ai_practice_model or self.resolved_ai_fast_model

    @property
    def resolved_ai_public_api_base_url(self) -> str:
        # A browser CORS origin does not prove that the matching /api route is
        # reachable by the external model provider. Keep direct image transport
        # as the safe default unless a public media base is explicitly set.
        return self.ai_public_api_base_url.strip().rstrip("/")

    @property
    def resolved_image_api_key(self) -> str | None:
        return self.image_api_key or self.ai_api_key or self.ark_api_key

    @property
    def resolved_image_base_url(self) -> str:
        return self.image_base_url.rstrip("/")

    @property
    def inspiration_topics(self) -> list[str]:
        return [topic.strip() for topic in self.inspiration_sync_topics.split(",") if topic.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
