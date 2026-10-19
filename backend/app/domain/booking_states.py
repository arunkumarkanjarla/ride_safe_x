"""Booking / offer state machine helpers (Phase 3)."""

from __future__ import annotations

BOOKING_REQUESTED = "REQUESTED"
BOOKING_SEARCHING = "SEARCHING_DRIVER"
BOOKING_DRIVER_ASSIGNED = "DRIVER_ASSIGNED"
BOOKING_DRIVER_ACCEPTED = "DRIVER_ACCEPTED"
BOOKING_DRIVER_ARRIVING = "DRIVER_ARRIVING"
BOOKING_DRIVER_ARRIVED = "DRIVER_ARRIVED"
BOOKING_TRIP_STARTED = "TRIP_STARTED"
BOOKING_TRIP_COMPLETED = "TRIP_COMPLETED"
BOOKING_CANCELLED = "CANCELLED"
BOOKING_NO_DRIVER = "NO_DRIVER_FOUND"
BOOKING_CLOSED = "CLOSED"

OFFER_PENDING = "PENDING"
OFFER_ACCEPTED = "ACCEPTED"
OFFER_DECLINED = "DECLINED"
OFFER_EXPIRED = "EXPIRED"
OFFER_WITHDRAWN = "WITHDRAWN"

CANCELABLE = {
    BOOKING_REQUESTED,
    BOOKING_SEARCHING,
    BOOKING_DRIVER_ASSIGNED,
    BOOKING_DRIVER_ACCEPTED,
    BOOKING_DRIVER_ARRIVING,
    BOOKING_DRIVER_ARRIVED,
    BOOKING_NO_DRIVER,
}

ACTIVE_DRIVER_TRIP = {
    BOOKING_DRIVER_ACCEPTED,
    BOOKING_DRIVER_ARRIVING,
    BOOKING_DRIVER_ARRIVED,
    BOOKING_TRIP_STARTED,
}

DRIVER_TRANSITIONS: dict[tuple[str, str], str] = {
    (BOOKING_DRIVER_ACCEPTED, "driver.en_route"): BOOKING_DRIVER_ARRIVING,
    (BOOKING_DRIVER_ACCEPTED, "driver.arrived"): BOOKING_DRIVER_ARRIVED,
    (BOOKING_DRIVER_ARRIVING, "driver.arrived"): BOOKING_DRIVER_ARRIVED,
    (BOOKING_DRIVER_ARRIVED, "trip.start"): BOOKING_TRIP_STARTED,
    (BOOKING_TRIP_STARTED, "trip.end"): BOOKING_TRIP_COMPLETED,
}

# If booking is already at/beyond the effect of `action`, treat as idempotent success.
IDEMPOTENT_AFTER: dict[str, set[str]] = {
    "driver.en_route": {
        BOOKING_DRIVER_ARRIVING,
        BOOKING_DRIVER_ARRIVED,
        BOOKING_TRIP_STARTED,
        BOOKING_TRIP_COMPLETED,
        BOOKING_CLOSED,
    },
    "driver.arrived": {
        BOOKING_DRIVER_ARRIVED,
        BOOKING_TRIP_STARTED,
        BOOKING_TRIP_COMPLETED,
        BOOKING_CLOSED,
    },
    "trip.start": {
        BOOKING_TRIP_STARTED,
        BOOKING_TRIP_COMPLETED,
        BOOKING_CLOSED,
    },
    "trip.end": {
        BOOKING_TRIP_COMPLETED,
        BOOKING_CLOSED,
    },
}

# Primary next action for driver workspace UI (server-documented).
NEXT_DRIVER_ACTION: dict[str, str | None] = {
    BOOKING_DRIVER_ACCEPTED: "driver.en_route",
    BOOKING_DRIVER_ARRIVING: "driver.arrived",
    BOOKING_DRIVER_ARRIVED: "trip.start",
    BOOKING_TRIP_STARTED: "trip.end",
    BOOKING_TRIP_COMPLETED: None,
    BOOKING_CLOSED: None,
    BOOKING_CANCELLED: None,
}


def can_cancel(status: str) -> bool:
    return status in CANCELABLE


ACTION_LABELS: dict[str, str] = {
    "driver.en_route": "En route to pickup",
    "driver.arrived": "Arrived at pickup",
    "trip.start": "Start trip",
    "trip.end": "Complete trip",
}


def next_driver_action(status: str) -> str | None:
    return NEXT_DRIVER_ACTION.get(status)


def action_label(action: str | None) -> str | None:
    if action is None:
        return None
    return ACTION_LABELS.get(action, action)


def is_idempotent_driver_action(status: str, action: str) -> bool:
    return status in IDEMPOTENT_AFTER.get(action, set())
