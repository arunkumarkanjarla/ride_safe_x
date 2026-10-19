"""Configuration loading tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.config import Settings


def test_storage_path_from_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("RIDENOVA_STORAGE_PATH", str(tmp_path))
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://u:p@localhost:5432/ride_safe_x"
    )
    settings = Settings()
    assert settings.ridenova_storage_path == tmp_path
    assert "ride_safe_x" in settings.database_url


def test_prefer_host_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://u:p@host.docker.internal:5432/ride_safe_x",
    )
    monkeypatch.setenv(
        "DATABASE_URL_HOST",
        "postgresql+psycopg://u:p@localhost:5432/ride_safe_x",
    )
    settings = Settings()
    assert "host.docker.internal" in settings.sqlalchemy_url(prefer_host=False)
    assert "localhost" in settings.sqlalchemy_url(prefer_host=True)
