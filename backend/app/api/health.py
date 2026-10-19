"""Liveness and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app import __version__
from app.core.config import get_settings
from app.core.db import check_database

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "ridenova-api",
        "version": __version__,
        "env": settings.ridenova_env,
        "payments_sandbox_allowed": settings.sandbox_payments_allowed(),
    }


@router.get("/health/db")
def health_db() -> dict[str, object]:
    try:
        info = check_database()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail={"status": "unavailable", "error": "database_unreachable"},
        ) from exc
    except Exception as exc:  # noqa: BLE001 — surface connection misconfig safely
        raise HTTPException(
            status_code=503,
            detail={"status": "unavailable", "error": type(exc).__name__},
        ) from exc

    if info.get("postgis") is None:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "degraded",
                "error": "postgis_missing",
                "database": info.get("database"),
            },
        )

    return {"status": "ok", **info}


@router.get("/health/ready")
def health_ready() -> dict[str, object]:
    """Readiness: DB required; RabbitMQ optional (reported, not hard-fail)."""
    settings = get_settings()
    checks: dict[str, object] = {
        "env": settings.ridenova_env,
        "payments_sandbox_allowed": settings.sandbox_payments_allowed(),
    }
    try:
        info = check_database()
        checks["database"] = "ok"
        checks["postgis"] = bool(info.get("postgis"))
    except Exception:
        raise HTTPException(
            status_code=503,
            detail={"status": "unavailable", "error": "database_unreachable", "checks": checks},
        ) from None

    rabbit = "skipped"
    try:
        import pika

        params = pika.URLParameters(settings.rabbitmq_url)
        params.socket_timeout = 2
        conn = pika.BlockingConnection(params)
        conn.close()
        rabbit = "ok"
    except Exception as exc:  # noqa: BLE001
        rabbit = f"unavailable:{type(exc).__name__}"
    checks["rabbitmq"] = rabbit

    status = "ok" if checks.get("database") == "ok" else "unavailable"
    if rabbit != "ok":
        status = "degraded"
    return {"status": status, "service": "ridenova-api", "version": __version__, "checks": checks}
