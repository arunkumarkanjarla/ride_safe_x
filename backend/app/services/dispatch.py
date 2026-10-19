"""Driver availability, offer dispatch, atomic accept/reject, expiry."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.domain import booking_states as st
from app.models import (
    Booking,
    BookingEvent,
    DriverAvailability,
    DriverOffer,
    DriverProfile,
    TripAssignment,
)
from app.core.config import get_settings
from app.services.fare import haversine_km
from app.services.location import (
    DUTY_BUSY,
    driver_on_active_trip,
    is_dispatch_eligible,
    set_driver_online,
    sync_duty_status,
)
from app.services.outbox import enqueue_outbox
from app.services.ws_hub import hub

OFFER_TTL_SECONDS = 60
DISPATCH_RADIUS_KM = Decimal("15")
MAX_OFFERS_PER_ROUND = 3
MAX_DISPATCH_ROUNDS = 5


class DispatchError(Exception):
    def __init__(self, code: str, status_code: int = 400) -> None:
        self.code = code
        self.status_code = status_code
        super().__init__(code)


def get_or_create_driver_profile(
    db: Session, user_id: UUID, *, vehicle_type: str = "Cab"
) -> DriverProfile:
    profile = db.scalar(select(DriverProfile).where(DriverProfile.user_id == user_id))
    if profile is None:
        profile = DriverProfile(user_id=user_id, vehicle_type=vehicle_type, status="eligible")
        db.add(profile)
        db.flush()
        db.add(
            DriverAvailability(
                driver_profile_id=profile.id,
                is_online=False,
                duty_status="offline",
            )
        )
        db.commit()
        db.refresh(profile)
    return profile


def set_availability(
    db: Session,
    profile: DriverProfile,
    *,
    is_online: bool,
    lat: float | None = None,
    lon: float | None = None,
    actor_user_id: UUID | None = None,
) -> DriverAvailability:
    """Toggle online/offline. Location updates use update_driver_location (Phase 5)."""
    from app.services.location import LocationError, update_driver_location

    try:
        if lat is not None and lon is not None:
            avail = db.get(DriverAvailability, profile.id)
            next_seq = (avail.location_seq if avail else 0) + 1
            update_driver_location(
                db,
                profile,
                lat=lat,
                lon=lon,
                seq=next_seq,
                actor_user_id=actor_user_id,
            )
        return set_driver_online(
            db, profile, is_online=is_online, actor_user_id=actor_user_id
        )
    except LocationError as exc:
        raise DispatchError(exc.code, exc.status_code) from exc


def _driver_on_active_trip(db: Session, driver_profile_id: UUID) -> bool:
    return driver_on_active_trip(db, driver_profile_id)


def _eligible_drivers(db: Session, booking: Booking) -> list[tuple[DriverProfile, Decimal]]:
    freshness = get_settings().location_freshness_seconds
    rows = db.execute(
        select(DriverProfile, DriverAvailability)
        .join(
            DriverAvailability,
            DriverAvailability.driver_profile_id == DriverProfile.id,
        )
        .where(
            DriverProfile.status == "eligible",
            DriverProfile.vehicle_type == booking.vehicle_type,
            DriverAvailability.is_online.is_(True),
            DriverAvailability.duty_status == "available",
            DriverAvailability.last_lat.is_not(None),
            DriverAvailability.last_lon.is_not(None),
        )
    ).all()
    ranked: list[tuple[DriverProfile, Decimal]] = []
    for profile, avail in rows:
        if not is_dispatch_eligible(db, profile, avail, freshness_seconds=freshness):
            continue
        dist = haversine_km(
            float(booking.pickup_lat),
            float(booking.pickup_lon),
            float(avail.last_lat),
            float(avail.last_lon),
        )
        if dist > DISPATCH_RADIUS_KM:
            continue
        ranked.append((profile, dist))
    ranked.sort(key=lambda x: x[1])
    return ranked


def _record_event(
    db: Session,
    booking: Booking,
    *,
    from_status: str | None,
    to_status: str,
    reason: str | None = None,
) -> None:
    db.add(
        BookingEvent(
            booking_id=booking.id,
            from_status=from_status,
            to_status=to_status,
            actor_user_id=None,
            reason=reason,
        )
    )


def _notify(event_id, event_type: str, payload: dict) -> None:
    try:
        from uuid import UUID as _UUID

        from app.core.db import get_session_factory
        from app.services.notifications import materialize_outbox_event

        factory = get_session_factory()
        ndb = factory()
        try:
            materialize_outbox_event(ndb, _UUID(str(event_id)), emit_ws=True)
            ndb.commit()
        except Exception:
            ndb.rollback()
        finally:
            ndb.close()
    except Exception:
        pass
    hub.fanout_sync(
        {
            "event_id": str(event_id),
            "aggregate_type": "booking",
            "aggregate_id": payload.get("booking_id"),
            "event_type": event_type,
            "payload": payload,
        }
    )


def dispatch_booking(db: Session, booking_id: UUID) -> Booking:
    """Create offers for eligible drivers or mark NO_DRIVER_FOUND."""
    booking = db.execute(
        select(Booking).where(Booking.id == booking_id).with_for_update()
    ).scalar_one()
    if booking.status == st.BOOKING_CANCELLED:
        return booking
    if booking.status not in (st.BOOKING_SEARCHING, st.BOOKING_REQUESTED):
        return booking

    # Expire any stale pending first
    expire_due_offers(db, booking_id=booking.id, commit=False)

    prior_offers = db.scalars(
        select(DriverOffer).where(DriverOffer.booking_id == booking.id)
    ).all()
    if len(prior_offers) >= MAX_DISPATCH_ROUNDS * MAX_OFFERS_PER_ROUND:
        if booking.status != st.BOOKING_NO_DRIVER:
            prev = booking.status
            booking.status = st.BOOKING_NO_DRIVER
            _record_event(
                db, booking, from_status=prev, to_status=st.BOOKING_NO_DRIVER, reason="search.exhausted"
            )
            outbox = enqueue_outbox(
                db,
                aggregate_type="booking",
                aggregate_id=booking.id,
                event_type="dispatch.exhausted",
                payload={
                    "booking_id": str(booking.id),
                    "customer_id": str(booking.customer_id),
                    "status": booking.status,
                },
            )
            db.commit()
            _notify(outbox.id, "dispatch.exhausted", outbox.payload)
        return booking

    already = {o.driver_profile_id for o in prior_offers}
    candidates = [
        (p, d) for p, d in _eligible_drivers(db, booking) if p.id not in already
    ][:MAX_OFFERS_PER_ROUND]

    if not candidates:
        prev = booking.status
        booking.status = st.BOOKING_NO_DRIVER
        _record_event(
            db, booking, from_status=prev, to_status=st.BOOKING_NO_DRIVER, reason="search.exhausted"
        )
        outbox = enqueue_outbox(
            db,
            aggregate_type="booking",
            aggregate_id=booking.id,
            event_type="dispatch.exhausted",
            payload={
                "booking_id": str(booking.id),
                "customer_id": str(booking.customer_id),
                "status": booking.status,
            },
        )
        db.commit()
        db.refresh(booking)
        _notify(outbox.id, "dispatch.exhausted", outbox.payload)
        return booking

    expires = datetime.now(timezone.utc) + timedelta(seconds=OFFER_TTL_SECONDS)
    if booking.status != st.BOOKING_DRIVER_ASSIGNED:
        prev = booking.status
        booking.status = st.BOOKING_DRIVER_ASSIGNED
        _record_event(
            db, booking, from_status=prev, to_status=st.BOOKING_DRIVER_ASSIGNED, reason="offer.sent"
        )

    created_payloads = []
    for profile, _dist in candidates:
        offer = DriverOffer(
            booking_id=booking.id,
            driver_profile_id=profile.id,
            status=st.OFFER_PENDING,
            expires_at=expires,
        )
        db.add(offer)
        db.flush()
        outbox = enqueue_outbox(
            db,
            aggregate_type="booking",
            aggregate_id=booking.id,
            event_type="offer.created",
            payload={
                "booking_id": str(booking.id),
                "customer_id": str(booking.customer_id),
                "offer_id": str(offer.id),
                "driver_profile_id": str(profile.id),
                "status": booking.status,
                "expires_at": expires.isoformat(),
            },
        )
        created_payloads.append((outbox.id, outbox.payload))

    db.commit()
    db.refresh(booking)
    for eid, payload in created_payloads:
        _notify(eid, "offer.created", payload)
    return booking


def expire_due_offers(
    db: Session,
    *,
    booking_id: UUID | None = None,
    commit: bool = True,
    retry_dispatch: bool = True,
) -> int:
    now = datetime.now(timezone.utc)
    q = select(DriverOffer).where(
        DriverOffer.status == st.OFFER_PENDING,
        DriverOffer.expires_at <= now,
    )
    if booking_id:
        q = q.where(DriverOffer.booking_id == booking_id)
    offers = list(db.scalars(q.with_for_update()).all())
    affected_bookings: set[UUID] = set()
    count = 0
    for offer in offers:
        offer.status = st.OFFER_EXPIRED
        offer.responded_at = now
        count += 1
        affected_bookings.add(offer.booking_id)
        outbox = enqueue_outbox(
            db,
            aggregate_type="booking",
            aggregate_id=offer.booking_id,
            event_type="offer.expired",
            payload={
                "booking_id": str(offer.booking_id),
                "offer_id": str(offer.id),
                "driver_profile_id": str(offer.driver_profile_id),
            },
        )
        if commit:
            # defer notify until after booking transitions
            pass
        else:
            _notify(outbox.id, "offer.expired", outbox.payload)

    for bid in affected_bookings:
        booking = db.execute(
            select(Booking).where(Booking.id == bid).with_for_update()
        ).scalar_one()
        if booking.status not in (st.BOOKING_DRIVER_ASSIGNED,):
            continue
        pending = db.scalar(
            select(DriverOffer.id)
            .where(
                DriverOffer.booking_id == bid,
                DriverOffer.status == st.OFFER_PENDING,
            )
            .limit(1)
        )
        if pending is None:
            prev = booking.status
            booking.status = st.BOOKING_SEARCHING
            _record_event(
                db,
                booking,
                from_status=prev,
                to_status=st.BOOKING_SEARCHING,
                reason="offer.expired",
            )

    if commit and (offers or affected_bookings):
        db.commit()
        if retry_dispatch:
            for bid in affected_bookings:
                booking = db.get(Booking, bid)
                if booking and booking.status == st.BOOKING_SEARCHING:
                    dispatch_booking(db, bid)
    return count


def accept_offer(db: Session, offer_id: UUID, *, driver_profile_id: UUID) -> TripAssignment:
    now = datetime.now(timezone.utc)
    offer = db.execute(
        select(DriverOffer).where(DriverOffer.id == offer_id).with_for_update()
    ).scalar_one_or_none()
    if offer is None:
        raise DispatchError("not_found", 404)
    if offer.driver_profile_id != driver_profile_id:
        raise DispatchError("forbidden", 403)
    if offer.status != st.OFFER_PENDING:
        raise DispatchError("offer_not_pending", 409)
    if offer.expires_at <= now:
        offer.status = st.OFFER_EXPIRED
        offer.responded_at = now
        db.commit()
        raise DispatchError("offer_expired", 409)

    booking = db.execute(
        select(Booking).where(Booking.id == offer.booking_id).with_for_update()
    ).scalar_one()
    if booking.status == st.BOOKING_CANCELLED:
        raise DispatchError("booking_cancelled", 409)
    if booking.status not in (st.BOOKING_DRIVER_ASSIGNED, st.BOOKING_SEARCHING):
        raise DispatchError("booking_not_offerable", 409)
    if _driver_on_active_trip(db, driver_profile_id):
        raise DispatchError("driver_busy", 409)

    profile = db.get(DriverProfile, driver_profile_id)
    avail = db.get(DriverAvailability, driver_profile_id)
    if profile is None or avail is None or not is_dispatch_eligible(db, profile, avail):
        raise DispatchError("driver_not_eligible", 409)

    existing = db.scalar(
        select(TripAssignment).where(TripAssignment.booking_id == booking.id).limit(1)
    )
    if existing is not None:
        raise DispatchError("already_assigned", 409)

    assignment = TripAssignment(
        booking_id=booking.id,
        driver_profile_id=driver_profile_id,
        offer_id=offer.id,
        status="ACTIVE",
    )
    try:
        with db.begin_nested():
            db.add(assignment)
            db.flush()
    except IntegrityError as exc:
        raise DispatchError("already_assigned", 409) from exc

    offer.status = st.OFFER_ACCEPTED
    offer.responded_at = now
    # Withdraw other pending offers
    others = db.scalars(
        select(DriverOffer)
        .where(
            DriverOffer.booking_id == booking.id,
            DriverOffer.id != offer.id,
            DriverOffer.status == st.OFFER_PENDING,
        )
        .with_for_update()
    ).all()
    for other in others:
        other.status = st.OFFER_WITHDRAWN
        other.responded_at = now

    prev = booking.status
    booking.status = st.BOOKING_DRIVER_ACCEPTED
    booking.assigned_driver_profile_id = driver_profile_id
    if avail is not None:
        avail.duty_status = DUTY_BUSY
        avail.updated_at = now
    db.add(
        BookingEvent(
            booking_id=booking.id,
            from_status=prev,
            to_status=st.BOOKING_DRIVER_ACCEPTED,
            actor_user_id=None,
            reason="offer.accepted",
        )
    )
    outbox = enqueue_outbox(
        db,
        aggregate_type="booking",
        aggregate_id=booking.id,
        event_type="offer.accepted",
        payload={
            "booking_id": str(booking.id),
            "customer_id": str(booking.customer_id),
            "offer_id": str(offer.id),
            "driver_profile_id": str(driver_profile_id),
            "assignment_id": str(assignment.id),
            "status": booking.status,
        },
    )
    db.commit()
    db.refresh(assignment)
    _notify(outbox.id, "offer.accepted", outbox.payload)
    return assignment


def reject_offer(db: Session, offer_id: UUID, *, driver_profile_id: UUID) -> DriverOffer:
    now = datetime.now(timezone.utc)
    offer = db.execute(
        select(DriverOffer).where(DriverOffer.id == offer_id).with_for_update()
    ).scalar_one_or_none()
    if offer is None:
        raise DispatchError("not_found", 404)
    if offer.driver_profile_id != driver_profile_id:
        raise DispatchError("forbidden", 403)
    if offer.status != st.OFFER_PENDING:
        raise DispatchError("offer_not_pending", 409)
    offer.status = st.OFFER_DECLINED
    offer.responded_at = now

    booking = db.execute(
        select(Booking).where(Booking.id == offer.booking_id).with_for_update()
    ).scalar_one()
    outbox = enqueue_outbox(
        db,
        aggregate_type="booking",
        aggregate_id=booking.id,
        event_type="offer.rejected",
        payload={
            "booking_id": str(booking.id),
            "customer_id": str(booking.customer_id),
            "offer_id": str(offer.id),
            "driver_profile_id": str(driver_profile_id),
            "status": booking.status,
        },
    )

    pending = db.scalar(
        select(DriverOffer.id)
        .where(
            DriverOffer.booking_id == booking.id,
            DriverOffer.status == st.OFFER_PENDING,
            DriverOffer.id != offer.id,
        )
        .limit(1)
    )
    retry = False
    if pending is None and booking.status == st.BOOKING_DRIVER_ASSIGNED:
        prev = booking.status
        booking.status = st.BOOKING_SEARCHING
        _record_event(
            db, booking, from_status=prev, to_status=st.BOOKING_SEARCHING, reason="offer.declined"
        )
        retry = True

    db.commit()
    db.refresh(offer)
    _notify(outbox.id, "offer.rejected", outbox.payload)
    if retry:
        dispatch_booking(db, booking.id)
    return offer


def list_driver_offers(
    db: Session, driver_profile_id: UUID, *, include_expired: bool = False
) -> list[DriverOffer]:
    now = datetime.now(timezone.utc)
    # Expire lazily on read — do not redispath here (worker owns retries)
    expire_due_offers(db, commit=True, retry_dispatch=False)
    q = (
        select(DriverOffer)
        .options(joinedload(DriverOffer.booking))
        .where(DriverOffer.driver_profile_id == driver_profile_id)
        .order_by(DriverOffer.created_at.desc())
    )
    offers = list(db.scalars(q).unique().all())
    if include_expired:
        return offers
    return [
        o
        for o in offers
        if o.status == st.OFFER_PENDING and o.expires_at > now
    ]


def list_driver_assignments(db: Session, driver_profile_id: UUID) -> list[TripAssignment]:
    return list(
        db.scalars(
            select(TripAssignment)
            .options(joinedload(TripAssignment.booking))  # type: ignore[attr-defined]
            .where(TripAssignment.driver_profile_id == driver_profile_id)
            .order_by(TripAssignment.accepted_at.desc())
        ).unique().all()
    )


def list_driver_bookings(db: Session, driver_profile_id: UUID) -> list[Booking]:
    return list(
        db.scalars(
            select(Booking)
            .where(Booking.assigned_driver_profile_id == driver_profile_id)
            .order_by(Booking.created_at.desc())
            .limit(50)
        ).all()
    )
