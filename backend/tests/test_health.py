"""Health endpoint tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


def test_health_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "ridenova-api"
    assert "payments_sandbox_allowed" in body
    assert "postgresql://" not in response.text.lower()


@pytest.mark.db
def test_health_db_ok(client: TestClient, db_available: bool, db_url: str | None) -> None:
    if not db_available or not db_url:
        pytest.skip("PostgreSQL not reachable with configured credentials")
    # Ensure engine uses host URL
    from app.core.config import get_settings
    from app.core.db import reset_engine

    get_settings.cache_clear()
    reset_engine()
    response = client.get("/health/db")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ride_safe_x"
    assert body["postgis"]["extname"] == "postgis"
    assert body["postgis"]["extversion"]


@pytest.mark.db
def test_postgis_via_sqlalchemy(db_available: bool, db_url: str | None) -> None:
    if not db_available or not db_url:
        pytest.skip("PostgreSQL not reachable with configured credentials")
    engine = create_engine(db_url, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    "SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'"
                )
            ).one()
            assert row[0] == "postgis"
            full = conn.execute(text("SELECT PostGIS_Full_Version()")).scalar()
            assert full and "POSTGIS=" in full
    except SQLAlchemyError as exc:
        pytest.fail(f"database error: {type(exc).__name__}")
    finally:
        engine.dispose()
