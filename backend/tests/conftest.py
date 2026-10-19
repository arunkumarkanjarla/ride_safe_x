"""Test fixtures. DB integration tests skip cleanly when credentials/DB unavailable."""

from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

os.environ.setdefault("ALEMBIC_PREFER_HOST", "1")
os.environ.setdefault("RIDENOVA_DB_PREFER_HOST", "1")
os.environ.setdefault("RIDENOVA_ENV", "test")
os.environ.setdefault("RIDENOVA_DISABLE_EVENTS_CONSUMER", "1")
os.environ.setdefault(
    "JWT_SECRET",
    "TEST_ONLY_JWT_SECRET_VALUE_AT_LEAST_32_CHARS_LONG",
)

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_dotenv() -> None:
    env_path = REPO_ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        # Do not override test JWT secret from developer .env
        if key.strip() == "JWT_SECRET":
            continue
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()
os.environ.setdefault("RIDENOVA_STORAGE_PATH", str(REPO_ROOT / ".pytest-uploads"))


@pytest.fixture(scope="session")
def db_url() -> str | None:
    from app.core.config import get_settings
    from app.core.db import reset_engine

    reset_engine()
    get_settings.cache_clear()
    settings = get_settings()
    url = settings.sqlalchemy_url(prefer_host=True)
    if "CHANGE_ME" in url:
        return None
    return url


@pytest.fixture(scope="session")
def db_available(db_url: str | None) -> bool:
    if not db_url:
        return False
    try:
        engine = create_engine(db_url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return True
    except SQLAlchemyError:
        return False


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    from app.core.config import get_settings
    from app.core.db import reset_engine
    from app.core.rate_limit import reset_memory_limits
    from app.main import create_app

    monkeypatch.setenv("RIDENOVA_STORAGE_PATH", str(tmp_path / "uploads"))
    monkeypatch.setenv(
        "JWT_SECRET", "TEST_ONLY_JWT_SECRET_VALUE_AT_LEAST_32_CHARS_LONG"
    )
    get_settings.cache_clear()
    reset_engine()
    reset_memory_limits()
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
    get_settings.cache_clear()
    reset_engine()
    reset_memory_limits()


@pytest.fixture
def db_session(db_available: bool) -> Generator[Session | None, None, None]:
    if not db_available:
        yield None
        return
    from app.core.db import get_session_factory, reset_engine
    from app.core.config import get_settings
    from app.services.seed import seed_rbac_catalogue

    get_settings.cache_clear()
    reset_engine()
    factory = get_session_factory()
    session = factory()
    seed_rbac_catalogue(session)
    try:
        yield session
    finally:
        session.close()
        reset_engine()


@pytest.fixture
def make_user(db_session: Session | None):
    from app.services.auth import create_user

    created: list = []

    def _make(
        *,
        role: str = "customer",
        email: str | None = None,
        password: str = "CorrectHorseBattery1!",
        status: str = "active",
        name: str = "Test User",
    ):
        if db_session is None:
            pytest.skip("PostgreSQL not reachable")
        mail = email or f"user_{uuid.uuid4().hex[:10]}@example.com"
        user = create_user(
            db_session,
            email=mail,
            password=password,
            display_name=name,
            role_codes=[role],
            status=status,
        )
        created.append(user.id)
        return user, password

    yield _make


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "db: tests that require PostgreSQL")
