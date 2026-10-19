"""Operations / dispatch center schemas."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class OpsBookingSummaryOut(BaseModel):
    total: int
    by_status: dict[str, int]


class OpsBookingRow(BaseModel):
    id: UUID
    status: str
    vehicle_type: str
    customer_id: UUID
    customer_email: str | None = None
    estimate_paise: int
    currency: str
    assigned_driver_profile_id: UUID | None
    created_at: datetime
    updated_at: datetime
    open_offer_count: int = 0


class OpsBookingListOut(BaseModel):
    items: list[OpsBookingRow]
    page: int
    page_size: int
    total: int


class OpsOfferOut(BaseModel):
    id: UUID
    driver_profile_id: UUID
    driver_user_id: UUID | None = None
    status: str
    expires_at: datetime
    created_at: datetime
    responded_at: datetime | None
    driver_online: bool | None = None
    driver_last_lat: Decimal | None = None
    driver_last_lon: Decimal | None = None


class OpsEventOut(BaseModel):
    id: UUID
    from_status: str | None
    to_status: str
    reason: str | None
    actor_user_id: UUID | None
    created_at: datetime


class OpsAssignmentOut(BaseModel):
    id: UUID
    driver_profile_id: UUID
    offer_id: UUID
    status: str
    accepted_at: datetime


class OpsBookingDetailOut(BaseModel):
    id: UUID
    status: str
    vehicle_type: str
    customer_id: UUID
    customer_email: str | None = None
    pickup_lat: Decimal
    pickup_lon: Decimal
    drop_lat: Decimal
    drop_lon: Decimal
    distance_km: Decimal
    duration_min: int
    estimate_paise: int
    currency: str
    assigned_driver_profile_id: UUID | None
    cancel_reason: str | None
    created_at: datetime
    updated_at: datetime
    offers: list[OpsOfferOut]
    events: list[OpsEventOut]
    assignment: OpsAssignmentOut | None
    unassigned_reason: str | None = None
    offer_counts: dict[str, int] = Field(default_factory=dict)


class OpsCancelIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class OpsActionOut(BaseModel):
    booking_id: UUID
    status: str
    action: str
    detail: str | None = None


class OpsDriverRow(BaseModel):
    driver_profile_id: UUID
    user_id: UUID
    email: str | None = None
    vehicle_type: str
    profile_status: str
    is_online: bool
    duty_status: str
    location_freshness: str
    location_received_at: datetime | None
    dispatch_eligible: bool
    ineligibility_reason: str | None
    last_lat: Decimal | None = None
    last_lon: Decimal | None = None


class OpsDriverListOut(BaseModel):
    items: list[OpsDriverRow]
    page: int
    page_size: int
    total: int
