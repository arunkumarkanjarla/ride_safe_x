"""Alembic migration environment — URL from settings / env."""

from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool, text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings  # noqa: E402

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None


def get_url() -> str:
    # Prefer explicit override for host-side migrations.
    if os.getenv("ALEMBIC_DATABASE_URL"):
        return os.environ["ALEMBIC_DATABASE_URL"]
    settings = get_settings()
    prefer_host = os.getenv("ALEMBIC_PREFER_HOST", "").lower() in {"1", "true", "yes"}
    return settings.sqlalchemy_url(prefer_host=prefer_host)


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
        # Sanity: never drop application data in Phase 1
        connection.execute(text("SELECT 1"))


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
