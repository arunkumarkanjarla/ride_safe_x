"""SQLAlchemy engine and session helpers."""

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def create_db_engine(settings: Settings | None = None, *, prefer_host: bool = False) -> Engine:
    cfg = settings or get_settings()
    return create_engine(
        cfg.sqlalchemy_url(prefer_host=prefer_host),
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )


def _env_prefer_host() -> bool:
    import os

    return os.getenv("RIDENOVA_DB_PREFER_HOST", "").lower() in {"1", "true", "yes"}


def get_engine(*, prefer_host: bool | None = None) -> Engine:
    global _engine, _SessionLocal
    if _engine is None:
        use_host = _env_prefer_host() if prefer_host is None else prefer_host
        _engine = create_db_engine(prefer_host=use_host)
        _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    get_engine()
    assert _SessionLocal is not None
    return _SessionLocal


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_database(engine: Engine | None = None) -> dict[str, object]:
    """Ping DB and report PostGIS status. Raises on connection failure."""
    eng = engine or get_engine()
    with eng.connect() as conn:
        db_row = conn.execute(text("SELECT current_database(), current_user")).one()
        ext = conn.execute(
            text(
                "SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'"
            )
        ).first()
        postgis_full = None
        if ext is not None:
            postgis_full = conn.execute(text("SELECT PostGIS_Full_Version()")).scalar()
        return {
            "database": db_row[0],
            "user": db_row[1],
            "postgis": (
                {"extname": ext[0], "extversion": ext[1], "full_version": postgis_full}
                if ext
                else None
            ),
        }


def reset_engine() -> None:
    """Dispose cached engine (tests)."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionLocal = None
