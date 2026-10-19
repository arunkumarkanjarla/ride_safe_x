"""Audit event writer — never stores passwords or tokens."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AuditEvent

log = logging.getLogger("ridenova.audit")

_SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "cookie",
    "secret",
    "jwt",
}


def _sanitize(meta: dict[str, Any] | None) -> dict[str, Any] | None:
    if not meta:
        return None
    clean: dict[str, Any] = {}
    for key, value in meta.items():
        if key.lower() in _SENSITIVE_KEYS or any(s in key.lower() for s in _SENSITIVE_KEYS):
            continue
        if isinstance(value, str) and len(value) > 500:
            clean[key] = value[:500] + "…"
        else:
            clean[key] = value
    return clean


def record_audit(
    db: Session,
    *,
    action: str,
    outcome: str,
    actor_user_id: UUID | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    ip_address: str | None = None,
    request_id: str | None = None,
    raise_on_failure: bool = False,
) -> AuditEvent | None:
    event = AuditEvent(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        outcome=outcome,
        metadata_json=_sanitize(metadata),
        ip_address=ip_address,
        request_id=request_id,
    )
    try:
        db.add(event)
        db.flush()
        return event
    except Exception:
        log.exception("audit_persist_failed action=%s outcome=%s", action, outcome)
        if raise_on_failure:
            raise
        return None
