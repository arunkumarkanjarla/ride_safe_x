"""Booking / dispatch / driver schemas."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class FareEstimateIn(BaseModel):
    pickup_lat: float = Field(ge=-90, le=90)
    pickup_lon: float = Field(ge=-180, le=180)
    drop_lat: float = Field(ge=-90, le=90)
    drop_lon: float = Field(ge=-180, le=180)
    vehicle_type: str = "Cab"

    @field_validator("vehicle_type")
    @classmethod
    def _vehicle(cls, value: str) -> str:
        if value not in ("Cab", "Auto", "Bike"):
            raise ValueError("unsupported vehicle_type")
        return value


class FareLineOut(BaseModel):
    label: str
    paise: int


class FareEstimateOut(BaseModel):
    vehicle_type: str
    distance_km: float
    duration_min: int
    currency: str
    subtotal_paise: int
    tax_paise: int
    estimate_paise: int
    lines: list[FareLineOut]


class BookingCreateIn(FareEstimateIn):
    idempotency_key: str = Field(min_length=8, max_length=128)


class BookingOut(BaseModel):
    id: UUID
    customer_id: UUID
    status: str
    vehicle_type: str
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

    model_config = {"from_attributes": True}


class BookingListOut(BaseModel):
    items: list[BookingOut]


class AssignedDriverSummary(BaseModel):
    """Customer-safe assigned driver fields only — no coordinates or contact."""

    display_name: str
    vehicle_type: str
    assignment_status: str | None = None


class CustomerTripSummaryOut(BaseModel):
    booking: BookingOut
    can_cancel: bool
    assigned_driver: AssignedDriverSummary | None = None
    status_updated_at: datetime


class CancelIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class TripTransitionIn(BaseModel):
    action: str = Field(min_length=3, max_length=64)


class AvailabilityIn(BaseModel):
    is_online: bool
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)


class AvailabilityOut(BaseModel):
    driver_profile_id: UUID
    is_online: bool
    duty_status: str
    last_lat: Decimal | None
    last_lon: Decimal | None
    location_received_at: datetime | None = None
    location_seq: int = 0
    location_freshness: str
    dispatch_eligible: bool
    ineligibility_reason: str | None = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class LocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    seq: int = Field(ge=1)
    accuracy_m: float | None = Field(default=None, ge=0)
    captured_at: datetime | None = None


class LocationOut(BaseModel):
    driver_profile_id: UUID
    lat: Decimal
    lon: Decimal
    location_received_at: datetime
    location_client_at: datetime | None
    accuracy_m: Decimal | None
    location_seq: int
    location_freshness: str
    duty_status: str
    dispatch_eligible: bool
    ineligibility_reason: str | None = None


class OfferOut(BaseModel):
    id: UUID
    booking_id: UUID
    driver_profile_id: UUID
    status: str
    expires_at: datetime
    created_at: datetime
    booking: BookingOut | None = None

    model_config = {"from_attributes": True}


class OfferListOut(BaseModel):
    items: list[OfferOut]


class AssignmentOut(BaseModel):
    id: UUID
    booking_id: UUID
    driver_profile_id: UUID
    offer_id: UUID
    status: str
    accepted_at: datetime
    booking: BookingOut | None = None
    next_action: str | None = None

    model_config = {"from_attributes": True}


class AssignmentListOut(BaseModel):
    items: list[AssignmentOut]


class ActiveTripOut(BaseModel):
    """Driver trip workspace payload — authoritative booking + next action."""

    assignment: AssignmentOut | None = None
    booking: BookingOut | None = None
    next_action: str | None = None
    action_label: str | None = None


class ResyncOut(BaseModel):
    booking: BookingOut
    events: list[dict]
    cursor: str | None = None


class WsEventOut(BaseModel):
    event_id: str
    event_type: str
    aggregate_type: str
    aggregate_id: str
    payload: dict
    created_at: datetime
