"""Driver location updates, freshness, and duty-status helpers."""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.rate_limit import RateLimitExceeded, _memory_hit
from app.domain import booking_states as st
from app.models import Booking, DriverAvailability, DriverProfile, TripAssignment
from app.services.audit import record_audit
from app.services.outbox import enqueue_outbox
from app.services.ws_hub import hub

DUTY_OFFLINE = "offline"
DUTY_AVAILABLE = "available"
DUTY_BUSY = "busy"

FRESHNESS_MISSING = "missing"
FRESHNESS_STALE = "stale"
FRESHNESS_FRESH = "fresh"


class LocationError(Exception):
    def __init__(self, code: str, status_code: int = 400) -> None:
        self.code = code
        self.status_code = status_code
        super().__init__(code)


def check_location_rate_limit(driver_profile_id: UUID, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    key = f"loc:{driver_profile_id}"
    try:
        import redis

        client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=0.5)
        redis_key = f"ridenova:location:{driver_profile_id}"
        count = client.incr(redis_key)
        if count == 1:
            client.expire(redis_key, settings.location_rate_window_seconds)
        if int(count) > settings.location_rate_limit:
            raise RateLimitExceeded()
    except RateLimitExceeded:
        raise LocationError("rate_limited", 429) from None
    except LocationError:
        raise
    except Exception:
        try:
            _memory_hit(
                key, settings.location_rate_limit, settings.location_rate_window_seconds
            )
        except RateLimitExceeded as exc:
            raise LocationError("rate_limited", 429) from exc


def _validate_coords(lat: float, lon: float) -> None:
    if not math.isfinite(lat) or not math.isfinite(lon):
        raise LocationError("invalid_coordinates", 422)
    if lat < -90 or lat > 90 or lon < -180 or lon > 180:
        raise LocationError("invalid_coordinates", 422)


def location_freshness(
    avail: DriverAvailability | None,
    *,
    now: datetime | None = None,
    freshness_seconds: int | None = None,
) -> str:
    if avail is None or avail.last_lat is None or avail.last_lon is None:
        return FRESHNESS_MISSING
    if avail.location_received_at is None:
        return FRESHNESS_MISSING
    now = now or datetime.now(timezone.utc)
    window = freshness_seconds if freshness_seconds is not None else get_settings().location_freshness_seconds
    received = avail.location_received_at
    if received.tzinfo is None:
        received = received.replace(tzinfo=timezone.utc)
    age = now - received
    if age > timedelta(seconds=window):
        return FRESHNESS_STALE
    return FRESHNESS_FRESH


def driver_on_active_trip(db: Session, driver_profile_id: UUID) -> bool:
    row = db.scalar(
        select(TripAssignment.id)
        .join(Booking, Booking.id == TripAssignment.booking_id)
        .where(
            TripAssignment.driver_profile_id == driver_profile_id,
            TripAssignment.status == "ACTIVE",
            Booking.status.in_(tuple(st.ACTIVE_DRIVER_TRIP)),
        )
        .limit(1)
    )
    return row is not None


def compute_duty_status(db: Session, avail: DriverAvailability) -> str:
    if not avail.is_online:
        return DUTY_OFFLINE
    if driver_on_active_trip(db, avail.driver_profile_id):
        return DUTY_BUSY
    return DUTY_AVAILABLE


def sync_duty_status(db: Session, driver_profile_id: UUID, *, commit: bool = False) -> DriverAvailability | None:
    avail = db.get(DriverAvailability, driver_profile_id)
    if avail is None:
        return None
    avail.duty_status = compute_duty_status(db, avail)
    avail.updated_at = datetime.now(timezone.utc)
    if commit:
        db.commit()
        db.refresh(avail)
    return avail


def ineligibility_reason(
    db: Session,
    profile: DriverProfile,
    avail: DriverAvailability | None,
    *,
    freshness_seconds: int | None = None,
) -> str | None:
    if profile.status != "eligible":
        return "profile_not_eligible"
    if avail is None or not avail.is_online:
        return "offline"
    duty = avail.duty_status or compute_duty_status(db, avail)
    if duty == DUTY_BUSY or driver_on_active_trip(db, profile.id):
        return "busy"
    freshness = location_freshness(avail, freshness_seconds=freshness_seconds)
    if freshness == FRESHNESS_MISSING:
        return "location_missing"
    if freshness == FRESHNESS_STALE:
        return "location_stale"
    return None


def is_dispatch_eligible(
    db: Session,
    profile: DriverProfile,
    avail: DriverAvailability,
    *,
    freshness_seconds: int | None = None,
) -> bool:
    return ineligibility_reason(db, profile, avail, freshness_seconds=freshness_seconds) is None


def update_driver_location(
    db: Session,
    profile: DriverProfile,
    *,
    lat: float,
    lon: float,
    seq: int,
    accuracy_m: float | None = None,
    captured_at: datetime | None = None,
    actor_user_id: UUID | None = None,
) -> DriverAvailability:
    if profile.status != "eligible":
        raise LocationError("profile_not_eligible", 403)
    _validate_coords(lat, lon)
    if seq < 1:
        raise LocationError("invalid_seq", 422)
    if accuracy_m is not None and (not math.isfinite(accuracy_m) or accuracy_m < 0):
        raise LocationError("invalid_accuracy", 422)
    if captured_at is not None:
        now_utc = datetime.now(timezone.utc)
        cap = captured_at if captured_at.tzinfo else captured_at.replace(tzinfo=timezone.utc)
        # Reject wildly future or ancient (>24h) client timestamps as metadata only
        if cap > now_utc + timedelta(minutes=5):
            raise LocationError("invalid_captured_at", 422)
        if now_utc - cap > timedelta(hours=24):
            raise LocationError("invalid_captured_at", 422)

    check_location_rate_limit(profile.id)

    avail = db.execute(
        select(DriverAvailability)
        .where(DriverAvailability.driver_profile_id == profile.id)
        .with_for_update()
    ).scalar_one_or_none()
    if avail is None:
        avail = DriverAvailability(driver_profile_id=profile.id, is_online=False, duty_status=DUTY_OFFLINE)
        db.add(avail)
        db.flush()

    if seq <= (avail.location_seq or 0):
        raise LocationError("stale_update", 409)

    now = datetime.now(timezone.utc)
    avail.last_lat = Decimal(str(round(lat, 7)))
    avail.last_lon = Decimal(str(round(lon, 7)))
    avail.location_received_at = now
    avail.location_client_at = captured_at
    avail.accuracy_m = Decimal(str(accuracy_m)) if accuracy_m is not None else None
    avail.location_seq = seq
    avail.updated_at = now
    avail.duty_status = compute_duty_status(db, avail)
    db.commit()
    db.refresh(avail)
    return avail


def set_driver_online(
    db: Session,
    profile: DriverProfile,
    *,
    is_online: bool,
    actor_user_id: UUID | None = None,
) -> DriverAvailability:
    avail = db.execute(
        select(DriverAvailability)
        .where(DriverAvailability.driver_profile_id == profile.id)
        .with_for_update()
    ).scalar_one_or_none()
    if avail is None:
        avail = DriverAvailability(driver_profile_id=profile.id)
        db.add(avail)
        db.flush()

    prev = avail.duty_status
    if is_online and profile.status != "eligible":
        raise LocationError("profile_not_eligible", 403)

    avail.is_online = is_online
    if not is_online:
        avail.duty_status = DUTY_OFFLINE
    else:
        avail.duty_status = (
            DUTY_BUSY if driver_on_active_trip(db, profile.id) else DUTY_AVAILABLE
        )
    avail.updated_at = datetime.now(timezone.utc)

    if prev != avail.duty_status or True:
        enqueue_outbox(
            db,
            aggregate_type="driver",
            aggregate_id=profile.id,
            event_type="driver.availability_changed",
            payload={
                "driver_profile_id": str(profile.id),
                "is_online": avail.is_online,
                "duty_status": avail.duty_status,
                "freshness": location_freshness(avail),
            },
        )
        record_audit(
            db,
            action="driver.availability_changed",
            outcome="success",
            actor_user_id=actor_user_id,
            target_type="driver_profile",
            target_id=str(profile.id),
            metadata={"is_online": is_online, "duty_status": avail.duty_status},
        )
    db.commit()
    db.refresh(avail)
    hub.fanout_sync(
        {
            "event_id": str(profile.id),
            "aggregate_type": "driver",
            "aggregate_id": str(profile.id),
            "event_type": "driver.availability_changed",
            "payload": {
                "driver_profile_id": str(profile.id),
                "is_online": avail.is_online,
                "duty_status": avail.duty_status,
            },
        }
    )
    return avail
