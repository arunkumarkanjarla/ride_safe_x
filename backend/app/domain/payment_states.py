"""Payment lifecycle helpers (Phase 9 sandbox)."""

from __future__ import annotations

PAYMENT_CREATED = "CREATED"
PAYMENT_PENDING = "PENDING"
PAYMENT_SUCCEEDED = "SUCCEEDED"
PAYMENT_FAILED = "FAILED"
PAYMENT_CANCELLED = "CANCELLED"
PAYMENT_EXPIRED = "EXPIRED"

TERMINAL = {
    PAYMENT_SUCCEEDED,
    PAYMENT_FAILED,
    PAYMENT_CANCELLED,
    PAYMENT_EXPIRED,
}

# (from_status, event) -> to_status
TRANSITIONS: dict[tuple[str, str], str] = {
    (PAYMENT_CREATED, "sandbox.initiate"): PAYMENT_PENDING,
    (PAYMENT_CREATED, "payment.cancel"): PAYMENT_CANCELLED,
    (PAYMENT_PENDING, "sandbox.succeed"): PAYMENT_SUCCEEDED,
    (PAYMENT_PENDING, "sandbox.fail"): PAYMENT_FAILED,
    (PAYMENT_PENDING, "payment.cancel"): PAYMENT_CANCELLED,
    (PAYMENT_PENDING, "sandbox.expire"): PAYMENT_EXPIRED,
}

# Booking must be CLOSED for post-trip sandbox settlement (Phase 9 policy).
ELIGIBLE_BOOKING_STATUSES = {"CLOSED"}

GATEWAY_SANDBOX = "sandbox"


def is_terminal(status: str) -> bool:
    return status in TERMINAL


def next_status(current: str, event: str) -> str | None:
    return TRANSITIONS.get((current, event))
