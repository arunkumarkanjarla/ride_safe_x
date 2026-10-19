"""Environment-driven settings. Secrets come from env / `.env` only."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_REPO_ENV = Path(__file__).resolve().parents[3] / ".env"
_LOCAL_ENV = Path(".env")
_ENV_FILES = tuple(str(p) for p in (_REPO_ENV, _LOCAL_ENV) if p.is_file())


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES or None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ridenova_env: str = Field(default="development", alias="RIDENOVA_ENV")
    database_url: str = Field(
        default="postgresql+psycopg://postgres:CHANGE_ME@localhost:5432/ride_safe_x",
        alias="DATABASE_URL",
    )
    database_url_host: str | None = Field(default=None, alias="DATABASE_URL_HOST")
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    rabbitmq_url: str = Field(
        default="amqp://ridenova:ridenova@localhost:5672/",
        alias="RABBITMQ_URL",
    )
    ridenova_storage_path: Path = Field(
        default=Path("/data/ridenova/uploads"),
        alias="RIDENOVA_STORAGE_PATH",
    )
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    jwt_secret: str = Field(
        default="DEV_ONLY_CHANGE_ME_TO_A_LONG_RANDOM_SECRET_VALUE_32+",
        alias="JWT_SECRET",
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_minutes: int = Field(default=15, alias="ACCESS_TOKEN_MINUTES")
    refresh_token_days: int = Field(default=14, alias="REFRESH_TOKEN_DAYS")
    login_rate_limit: int = Field(default=20, alias="LOGIN_RATE_LIMIT")
    login_rate_window_seconds: int = Field(default=300, alias="LOGIN_RATE_WINDOW_SECONDS")
    cors_origins: str = Field(
        default="http://127.0.0.1:5173,http://localhost:5173",
        alias="CORS_ORIGINS",
    )
    disable_events_consumer: bool = Field(
        default=False, alias="RIDENOVA_DISABLE_EVENTS_CONSUMER"
    )
    location_freshness_seconds: int = Field(
        default=120, alias="LOCATION_FRESHNESS_SECONDS"
    )
    location_rate_limit: int = Field(default=30, alias="LOCATION_RATE_LIMIT")
    location_rate_window_seconds: int = Field(
        default=60, alias="LOCATION_RATE_WINDOW_SECONDS"
    )
    payments_sandbox_enabled: bool | None = Field(
        default=None, alias="PAYMENTS_SANDBOX_ENABLED"
    )
    payments_sandbox_token: str = Field(
        default="DEV_ONLY_SANDBOX_PAYMENT_TOKEN_CHANGE_ME",
        alias="PAYMENTS_SANDBOX_TOKEN",
    )

    @field_validator("ridenova_storage_path", mode="before")
    @classmethod
    def _path(cls, value: object) -> Path:
        return Path(str(value))

    @model_validator(mode="after")
    def _validate_secrets(self) -> Settings:
        weak = "CHANGE_ME" in self.jwt_secret or len(self.jwt_secret) < 32
        if self.ridenova_env == "production" and weak:
            raise ValueError("JWT_SECRET must be a strong secret in production")
        if self.ridenova_env == "production" and self.payments_sandbox_enabled is True:
            raise ValueError(
                "PAYMENTS_SANDBOX_ENABLED cannot be true when RIDENOVA_ENV=production"
            )
        return self

    def sandbox_payments_allowed(self) -> bool:
        if self.ridenova_env == "production":
            return False
        if self.payments_sandbox_enabled is None:
            return True
        return bool(self.payments_sandbox_enabled)

    def sqlalchemy_url(self, *, prefer_host: bool = False) -> str:
        if prefer_host and self.database_url_host:
            return self.database_url_host
        return self.database_url

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
