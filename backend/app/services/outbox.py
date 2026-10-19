"""Transactional outbox helpers and RabbitMQ publisher."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import OutboxEvent

logger = logging.getLogger("ridenova.outbox")

EXCHANGE = "ridenova.events"
ROUTING_KEY = "booking"


def enqueue_outbox(
    db: Session,
    *,
    aggregate_type: str,
    aggregate_id: UUID | str,
    event_type: str,
    payload: dict[str, Any],
) -> OutboxEvent:
    event = OutboxEvent(
        aggregate_type=aggregate_type,
        aggregate_id=str(aggregate_id),
        event_type=event_type,
        payload=payload,
    )
    db.add(event)
    db.flush()
    return event


def unpublished_events(db: Session, *, limit: int = 50) -> list[OutboxEvent]:
    return list(
        db.scalars(
            select(OutboxEvent)
            .where(OutboxEvent.published_at.is_(None))
            .order_by(OutboxEvent.created_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        ).all()
    )


def mark_published(db: Session, event: OutboxEvent) -> None:
    event.published_at = datetime.now(timezone.utc)
    event.publish_attempts = (event.publish_attempts or 0) + 1


def bump_attempt(db: Session, event: OutboxEvent) -> None:
    event.publish_attempts = (event.publish_attempts or 0) + 1


def publish_to_rabbitmq(rabbitmq_url: str, event: OutboxEvent) -> None:
    import pika

    body = json.dumps(
        {
            "event_id": str(event.id),
            "aggregate_type": event.aggregate_type,
            "aggregate_id": event.aggregate_id,
            "event_type": event.event_type,
            "payload": event.payload,
            "created_at": event.created_at.isoformat() if event.created_at else None,
        },
        default=str,
    )
    params = pika.URLParameters(rabbitmq_url)
    connection = pika.BlockingConnection(params)
    try:
        channel = connection.channel()
        channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
        channel.basic_publish(
            exchange=EXCHANGE,
            routing_key=f"{ROUTING_KEY}.{event.event_type}",
            body=body.encode("utf-8"),
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,
                message_id=str(event.id),
            ),
        )
    finally:
        connection.close()


def publish_pending(db: Session, rabbitmq_url: str, *, limit: int = 50) -> int:
    """Materialize notifications then publish unpublished outbox rows.

    At-least-once: notification inserts are idempotent on
    (source_event_id, recipient_user_id).
    """
    from app.services.notifications import process_pending_notifications

    try:
        process_pending_notifications(db, limit=limit)
    except Exception:
        logger.exception("notification_process_tick_failed")

    events = unpublished_events(db, limit=limit)
    published = 0
    for event in events:
        try:
            # Ensure notifications exist even if earlier tick failed mid-flight
            if event.notifications_processed_at is None:
                from app.services.notifications import materialize_notifications

                materialize_notifications(db, event, emit_ws=True)
            publish_to_rabbitmq(rabbitmq_url, event)
            mark_published(db, event)
            published += 1
        except Exception:
            logger.exception("outbox_publish_failed event_id=%s", event.id)
            bump_attempt(db, event)
    if events:
        db.commit()
    return published
