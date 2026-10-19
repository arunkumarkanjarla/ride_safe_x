"""In-app notification materialization from authoritative outbox events."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import permissions as perm
from app.models import (
    DriverProfile,
    Notification,
    NotificationProcessingFailure,
    OutboxEvent,
    Permission,
    RolePermission,
    User,
    UserRole,
)
from app.services.ws_hub import hub

logger = logging.getLogger("ridenova.notifications")

MAX_PAGE_SIZE = 50
MAX_BULK_READ = 50


def _safe_uuid(value: Any) -> UUID | None:
    if value is None:
        return None
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return None


def _booking_ref(payload: dict) -> str:
    bid = payload.get("booking_id")
    if not bid:
        return ""
    s = str(bid)
    return s[:8]


def _resolve_recipients(db: Session, event: OutboxEvent) -> list[tuple[UUID, str, str, dict]]:
    """Return list of (user_id, title, body, safe_payload)."""
    payload = dict(event.payload or {})
    et = event.event_type
    booking_id = _safe_uuid(payload.get("booking_id") or event.aggregate_id)
    action = str(payload.get("action") or "")
    ref = _booking_ref(payload)
    safe = {
        "booking_id": str(booking_id) if booking_id else None,
        "status": payload.get("status"),
        "action": action or None,
        "event_type": et,
    }
    out: list[tuple[UUID, str, str, dict]] = []

    customer_id = _safe_uuid(payload.get("customer_id"))
    driver_profile_id = _safe_uuid(
        payload.get("driver_profile_id") or payload.get("assigned_driver_profile_id")
    )
    driver_user_id: UUID | None = None
    if driver_profile_id:
        profile = db.get(DriverProfile, driver_profile_id)
        if profile is not None:
            driver_user_id = profile.user_id

    def add(uid: UUID | None, title: str, body: str) -> None:
        if uid is None:
            return
        out.append((uid, title[:200], body[:500], safe))

    if et == "booking.created":
        add(customer_id, "Booking requested", f"Your booking {ref} was created.")
    elif et == "offer.created":
        add(driver_user_id, "New trip offer", f"Offer for booking {ref} is waiting.")
    elif et == "offer.accepted":
        add(customer_id, "Driver assigned", f"A driver accepted booking {ref}.")
        add(driver_user_id, "Assignment confirmed", f"You accepted booking {ref}.")
    elif et == "dispatch.exhausted":
        add(customer_id, "No driver found", f"No driver available for booking {ref}.")
        for uid in _ops_user_ids(db):
            add(uid, "Dispatch exhausted", f"No driver found for booking {ref}.")
    elif et == "booking.cancelled":
        add(customer_id, "Booking cancelled", f"Booking {ref} was cancelled.")
        add(driver_user_id, "Booking cancelled", f"Assigned booking {ref} was cancelled.")
    elif et == "booking.status_changed":
        if action == "driver.en_route":
            add(customer_id, "Driver en route", f"Driver is heading to pickup ({ref}).")
        elif action == "driver.arrived":
            add(customer_id, "Driver arrived", f"Driver arrived at pickup ({ref}).")
        elif action == "trip.start":
            add(customer_id, "Trip started", f"Your trip {ref} has started.")
        elif action == "trip.end":
            add(customer_id, "Trip completed", f"Your trip {ref} is complete.")
            add(driver_user_id, "Trip completed", f"Trip {ref} marked complete.")
    elif et == "payment.created":
        add(customer_id, "Payment started", f"Sandbox payment pending for booking {ref}.")
    elif et == "payment.succeeded":
        add(customer_id, "Payment succeeded", f"Sandbox payment completed for booking {ref}.")
    elif et == "payment.failed":
        add(customer_id, "Payment failed", f"Sandbox payment failed for booking {ref}.")
    elif et == "payment.cancelled":
        add(customer_id, "Payment cancelled", f"Sandbox payment cancelled for booking {ref}.")
    # else: intentionally skip noisy events

    # Deduplicate same user within one event
    seen: set[UUID] = set()
    unique: list[tuple[UUID, str, str, dict]] = []
    for row in out:
        if row[0] in seen:
            continue
        seen.add(row[0])
        unique.append(row)
    return unique


def _ops_user_ids(db: Session) -> list[UUID]:
    """Users holding dispatch.read — for no-driver ops alerts."""
    rows = db.execute(
        select(User.id)
        .join(UserRole, UserRole.user_id == User.id)
        .join(RolePermission, RolePermission.role_id == UserRole.role_id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .where(Permission.code == perm.DISPATCH_READ, User.status == "active")
        .distinct()
        .limit(200)
    ).scalars().all()
    return list(rows)


def materialize_notifications(
    db: Session,
    event: OutboxEvent,
    *,
    emit_ws: bool = True,
) -> list[Notification]:
    """Idempotently create notifications for an outbox event. Persist before WS."""
    if event.notifications_processed_at is not None:
        return list(
            db.scalars(
                select(Notification).where(Notification.source_event_id == event.id)
            ).all()
        )

    created: list[Notification] = []
    try:
        recipients = _resolve_recipients(db, event)
        booking_id = _safe_uuid((event.payload or {}).get("booking_id") or event.aggregate_id)
        for user_id, title, body, safe_payload in recipients:
            stmt = (
                insert(Notification)
                .values(
                    recipient_user_id=user_id,
                    event_type=event.event_type,
                    title=title,
                    body=body,
                    booking_id=booking_id,
                    source_event_id=event.id,
                    payload=safe_payload,
                )
                .on_conflict_do_nothing(
                    constraint="uq_notification_source_recipient"
                )
                .returning(Notification.id)
            )
            row = db.execute(stmt).first()
            if row is None:
                existing = db.scalar(
                    select(Notification).where(
                        Notification.source_event_id == event.id,
                        Notification.recipient_user_id == user_id,
                    )
                )
                if existing:
                    created.append(existing)
                continue
            note = db.get(Notification, row[0])
            if note:
                created.append(note)

        event.notifications_processed_at = datetime.now(timezone.utc)
        # Clear prior failure record on success
        fail = db.scalar(
            select(NotificationProcessingFailure).where(
                NotificationProcessingFailure.source_event_id == event.id
            )
        )
        if fail is not None:
            db.delete(fail)
        db.flush()
    except Exception:
        logger.exception("notification_materialize_failed event_id=%s", event.id)
        _record_failure(db, event.id, "materialize_error")
        raise

    if emit_ws:
        for note in created:
            _emit_hint(note)
    return created


def _record_failure(db: Session, source_event_id: UUID, category: str) -> None:
    existing = db.scalar(
        select(NotificationProcessingFailure).where(
            NotificationProcessingFailure.source_event_id == source_event_id
        )
    )
    now = datetime.now(timezone.utc)
    if existing is None:
        db.add(
            NotificationProcessingFailure(
                source_event_id=source_event_id,
                error_category=category[:64],
                attempt_count=1,
                last_error_at=now,
            )
        )
    else:
        existing.attempt_count = (existing.attempt_count or 0) + 1
        existing.error_category = category[:64]
        existing.last_error_at = now
    try:
        db.flush()
    except IntegrityError:
        db.rollback()


def _emit_hint(note: Notification) -> None:
    """Best-effort WS hint after durable insert — failures must not undo persist."""
    try:
        hub.fanout_sync(
            {
                "event_id": str(note.id),
                "aggregate_type": "notification",
                "aggregate_id": str(note.id),
                "event_type": "notification.created",
                "payload": {
                    "notification_id": str(note.id),
                    "recipient_user_id": str(note.recipient_user_id),
                    "event_type": note.event_type,
                    "booking_id": str(note.booking_id) if note.booking_id else None,
                },
            }
        )
    except Exception:
        logger.exception("notification_ws_hint_failed id=%s", note.id)


def materialize_outbox_event(
    db: Session, event_id: UUID, *, emit_ws: bool = True
) -> list[Notification]:
    event = db.get(OutboxEvent, event_id)
    if event is None:
        return []
    return materialize_notifications(db, event, emit_ws=emit_ws)


def process_pending_notifications(db: Session, *, limit: int = 50) -> int:
    """Worker entry: materialize notifications for unprocessed outbox rows."""
    events = list(
        db.scalars(
            select(OutboxEvent)
            .where(OutboxEvent.notifications_processed_at.is_(None))
            .order_by(OutboxEvent.created_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        ).all()
    )
    done = 0
    for event in events:
        try:
            materialize_notifications(db, event, emit_ws=True)
            done += 1
        except Exception:
            logger.exception("pending_notification_failed event_id=%s", event.id)
            continue
    if events:
        db.commit()
    return done


def list_notifications(
    db: Session,
    user_id: UUID,
    *,
    unread_only: bool | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Notification], int]:
    page = max(1, page)
    page_size = min(MAX_PAGE_SIZE, max(1, page_size))
    filters = [Notification.recipient_user_id == user_id]
    if unread_only is True:
        filters.append(Notification.read_at.is_(None))
    elif unread_only is False:
        filters.append(Notification.read_at.is_not(None))
    total = db.scalar(
        select(func.count()).select_from(Notification).where(and_(*filters))
    ) or 0
    items = list(
        db.scalars(
            select(Notification)
            .where(and_(*filters))
            .order_by(Notification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return items, int(total)


def unread_count(db: Session, user_id: UUID) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.recipient_user_id == user_id,
                Notification.read_at.is_(None),
            )
        )
        or 0
    )


def mark_read(db: Session, user_id: UUID, notification_id: UUID) -> Notification | None:
    note = db.get(Notification, notification_id)
    if note is None:
        return None
    if note.recipient_user_id != user_id:
        raise PermissionError("forbidden")
    if note.read_at is None:
        note.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(note)
    return note


def mark_read_bulk(db: Session, user_id: UUID, ids: list[UUID]) -> int:
    if len(ids) > MAX_BULK_READ:
        raise ValueError("bulk_limit_exceeded")
    if not ids:
        return 0
    now = datetime.now(timezone.utc)
    notes = list(
        db.scalars(
            select(Notification).where(
                Notification.recipient_user_id == user_id,
                Notification.id.in_(ids),
                Notification.read_at.is_(None),
            )
        ).all()
    )
    for n in notes:
        n.read_at = now
    db.commit()
    return len(notes)


def mark_all_read(db: Session, user_id: UUID, *, limit: int = 200) -> int:
    limit = min(500, max(1, limit))
    now = datetime.now(timezone.utc)
    notes = list(
        db.scalars(
            select(Notification)
            .where(
                Notification.recipient_user_id == user_id,
                Notification.read_at.is_(None),
            )
            .order_by(Notification.created_at.asc())
            .limit(limit)
        ).all()
    )
    for n in notes:
        n.read_at = now
    db.commit()
    return len(notes)


def ops_health(db: Session) -> dict[str, Any]:
    pending = db.scalar(
        select(func.count())
        .select_from(OutboxEvent)
        .where(OutboxEvent.notifications_processed_at.is_(None))
    ) or 0
    unpublished = db.scalar(
        select(func.count())
        .select_from(OutboxEvent)
        .where(OutboxEvent.published_at.is_(None))
    ) or 0
    failures = db.scalar(select(func.count()).select_from(NotificationProcessingFailure)) or 0
    oldest = db.scalar(
        select(OutboxEvent.created_at)
        .where(OutboxEvent.notifications_processed_at.is_(None))
        .order_by(OutboxEvent.created_at.asc())
        .limit(1)
    )
    last_ok = db.scalar(
        select(OutboxEvent.notifications_processed_at)
        .where(OutboxEvent.notifications_processed_at.is_not(None))
        .order_by(OutboxEvent.notifications_processed_at.desc())
        .limit(1)
    )
    return {
        "pending_notification_events": int(pending),
        "unpublished_outbox_events": int(unpublished),
        "processing_failures": int(failures),
        "oldest_pending_created_at": oldest.isoformat() if oldest else None,
        "last_processed_at": last_ok.isoformat() if last_ok else None,
    }
