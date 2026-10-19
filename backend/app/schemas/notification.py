"""Notification API schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    id: UUID
    event_type: str
    title: str
    body: str
    booking_id: UUID | None
    payload: dict
    created_at: datetime
    read_at: datetime | None

    model_config = {"from_attributes": True}


class NotificationListOut(BaseModel):
    items: list[NotificationOut]
    page: int
    page_size: int
    total: int
    unread_count: int


class UnreadCountOut(BaseModel):
    unread_count: int


class BulkReadIn(BaseModel):
    ids: list[UUID] = Field(min_length=1, max_length=50)


class BulkReadOut(BaseModel):
    marked: int


class NotificationHealthOut(BaseModel):
    pending_notification_events: int
    unpublished_outbox_events: int
    processing_failures: int
    oldest_pending_created_at: str | None
    last_processed_at: str | None
