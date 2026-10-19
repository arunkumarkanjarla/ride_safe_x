"""RideNova API entrypoint — Phase 3 booking / dispatch / websocket."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.bookings import router as bookings_router
from app.api.drivers import router as drivers_router
from app.api.health import router as health_router
from app.api.notifications import router as notifications_router
from app.api.ops import router as ops_router
from app.api.payments import router as payments_router
from app.api.roles import router as roles_router
from app.api.users import router as users_router
from app.api.ws import router as ws_router
from app.core.config import get_settings
from app.core.db import get_session_factory, reset_engine
from app.core.storage import FileSystemStorage
from app.services.seed import seed_rbac_catalogue
from app.services.ws_hub import hub

logger = logging.getLogger("ridenova.api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    storage = FileSystemStorage(settings.ridenova_storage_path)
    try:
        storage.ensure_root()
    except OSError:
        pass
    try:
        factory = get_session_factory()
        db = factory()
        try:
            seed_rbac_catalogue(db)
        finally:
            db.close()
    except Exception:
        reset_engine()

    consumer_thread = None
    if not settings.disable_events_consumer:
        try:
            from app.services.events_consumer import start_events_consumer

            loop = asyncio.get_running_loop()
            consumer_thread = start_events_consumer(settings.rabbitmq_url, hub, loop)
        except Exception:
            logger.exception("events_consumer_start_failed")

    yield
    # daemon thread exits with process


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="RideNova API",
        version="0.9.0",
        description="Phase 9 — payments foundation (sandbox gateway).",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID", "Idempotency-Key"],
    )
    application.include_router(health_router)
    application.include_router(auth_router)
    application.include_router(users_router)
    application.include_router(roles_router)
    application.include_router(audit_router)
    application.include_router(bookings_router)
    application.include_router(drivers_router)
    application.include_router(ops_router)
    application.include_router(notifications_router)
    application.include_router(payments_router)
    application.include_router(ws_router)
    return application


app = create_app()
