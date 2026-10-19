"""Alembic migration smoke tests (require DB)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text

BACKEND = Path(__file__).resolve().parents[1]


@pytest.mark.db
def test_alembic_upgrade_head(db_available: bool, db_url: str | None) -> None:
    if not db_available or not db_url:
        pytest.skip("PostgreSQL not reachable with configured credentials")

    env = os.environ.copy()
    env["ALEMBIC_DATABASE_URL"] = db_url
    env["ALEMBIC_PREFER_HOST"] = "1"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + "\n" + result.stderr

    engine = create_engine(db_url, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            value = conn.execute(
                text("SELECT value FROM schema_meta WHERE key = 'phase'")
            ).scalar()
            assert value == "9-payments"
            ext = conn.execute(
                text(
                    "SELECT extversion FROM pg_extension WHERE extname = 'postgis'"
                )
            ).scalar()
            assert ext
            rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
            assert rev == "20261019_0007"
            col = conn.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name='driver_availability' AND column_name='duty_status'"
                )
            ).scalar()
            assert col
            tables = {
                r[0]
                for r in conn.execute(
                    text(
                        "SELECT tablename FROM pg_tables WHERE schemaname='public' "
                        "AND tablename IN ("
                        "'bookings','driver_offers','outbox_events','notifications','payments')"
                    )
                )
            }
            assert tables == {
                "bookings",
                "driver_offers",
                "outbox_events",
                "notifications",
                "payments",
            }
    finally:
        engine.dispose()
