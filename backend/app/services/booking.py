"""Booking create / retrieve / cancel / lifecycle."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain import booking_states as st
from app.models import Booking, BookingEvent, TripAssignment
from app.services.fare import FareEstimateRequest, estimate_fare
from app.services.outbox import enqueue_outbox
from app.services.ws_hub import hub


class BookingError(Exception):
    def __init__(self, code: str, status_code: int = 400) -> None:
        self.code = code
        self.status_code = status_code
        super().__init__(code)


def _coords_match(booking: Booking, req: FareEstimateRequest) -> bool:
    def q(v: Decimal | float) -> str:
        return f"{Decimal(str(v)):.7f}"

    return (
        q(booking.pickup_lat) == q(req.pickup_lat)
        and q(booking.pickup_lon) == q(req.pickup_lon)
        and q(booking.drop_lat) == q(req.drop_lat)
        and q(booking.drop_lon) == q(req.drop_lon)
        and booking.vehicle_type == req.vehicle_type
    )


def _record_event(
    db: Session,
    booking: Booking,
    *,
    from_status: str | None,
    to_status: str,
    actor_user_id: UUID | None,
    reason: str | None = None,
) -> BookingEvent:
    ev = BookingEvent(
        booking_id=booking.id,
        from_status=from_status,
        to_status=to_status,
        actor_user_id=actor_user_id,
        reason=reason,
    )
    db.add(ev)
    return ev


def _outbox_booking(
    db: Session,
    booking: Booking,
    event_type: str,
    extra: dict | None = None,
) -> None:
    payload = {
        "booking_id": str(booking.id),
        "customer_id": str(booking.customer_id),
        "status": booking.status,
        "vehicle_type": booking.vehicle_type,
        "estimate_paise": booking.estimate_paise,
        "currency": booking.currency,
        "assigned_driver_profile_id": (
            str(booking.assigned_driver_profile_id)
            if booking.assigned_driver_profile_id
            else None
        ),
    }
    if extra:
        payload.update(extra)
    enqueue_outbox(
        db,
        aggregate_type="booking",
        aggregate_id=booking.id,
        event_type=event_type,
        payload=payload,
    )


def notify_local(event_id, event_type: str, booking: Booking, extra: dict | None = None) -> None:
    payload = {
        "booking_id": str(booking.id),
        "customer_id": str(booking.customer_id),
        "status": booking.status,
        "assigned_driver_profile_id": (
            str(booking.assigned_driver_profile_id)
            if booking.assigned_driver_profile_id
            else None
        ),
    }
    if extra:
        payload.update(extra)
    # Persist in-app notifications from authoritative outbox (idempotent)
    try:
        from app.core.db import get_session_factory
        from app.services.notifications import materialize_outbox_event
        from uuid import UUID as _UUID

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
            "aggregate_id": str(booking.id),
            "event_type": event_type,
            "payload": payload,
        }
    )


def create_booking(
    db: Session,
    *,
    customer_id: UUID,
    pickup_lat: float,
    pickup_lon: float,
    drop_lat: float,
    drop_lon: float,
    vehicle_type: str,
    idempotency_key: str,
) -> tuple[Booking, bool]:
    """Returns (booking, created)."""
    fare_req = FareEstimateRequest(
        pickup_lat=pickup_lat,
        pickup_lon=pickup_lon,
        drop_lat=drop_lat,
        drop_lon=drop_lon,
        vehicle_type=vehicle_type,
    )
    try:
        fare = estimate_fare(fare_req)
    except ValueError as exc:
        raise BookingError("invalid_fare_input", 422) from exc

    existing = db.scalar(
        select(Booking).where(
            Booking.customer_id == customer_id,
            Booking.idempotency_key == idempotency_key,
        )
    )
    if existing is not None:
        if not _coords_match(existing, fare_req):
            raise BookingError("idempotency_key_conflict", 409)
        return existing, False

    booking = Booking(
        customer_id=customer_id,
        status=st.BOOKING_REQUESTED,
        vehicle_type=vehicle_type,
        pickup_lat=Decimal(str(pickup_lat)),
        pickup_lon=Decimal(str(pickup_lon)),
        drop_lat=Decimal(str(drop_lat)),
        drop_lon=Decimal(str(drop_lon)),
        distance_km=Decimal(str(fare["distance_km"])),
        duration_min=int(fare["duration_min"]),
        estimate_paise=int(fare["estimate_paise"]),
        currency="INR",
        idempotency_key=idempotency_key,
    )
    db.add(booking)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        existing = db.scalar(
            select(Booking).where(
                Booking.customer_id == customer_id,
                Booking.idempotency_key == idempotency_key,
            )
        )
        if existing is not None and _coords_match(existing, fare_req):
            return existing, False
        raise BookingError("idempotency_key_conflict", 409) from exc

    _record_event(
        db,
        booking,
        from_status=None,
        to_status=st.BOOKING_REQUESTED,
        actor_user_id=customer_id,
        reason="booking.created",
    )
    outbox = enqueue_outbox(
        db,
        aggregate_type="booking",
        aggregate_id=booking.id,
        event_type="booking.created",
        payload={
            "booking_id": str(booking.id),
            "customer_id": str(customer_id),
            "status": booking.status,
            "estimate_paise": booking.estimate_paise,
            "currency": booking.currency,
        },
    )
    booking.status = st.BOOKING_SEARCHING
    _record_event(
        db,
        booking,
        from_status=st.BOOKING_REQUESTED,
        to_status=st.BOOKING_SEARCHING,
        actor_user_id=None,
        reason="dispatch.start",
    )
    _outbox_booking(db, booking, "dispatch.started")
    db.commit()
    db.refresh(booking)
    notify_local(outbox.id, "booking.created", booking)
    return booking, True


def get_booking(db: Session, booking_id: UUID) -> Booking | None:
    return db.get(Booking, booking_id)


def list_customer_bookings(
    db: Session, customer_id: UUID, *, limit: int = 50
) -> list[Booking]:
    return list(
        db.scalars(
            select(Booking)
            .where(Booking.customer_id == customer_id)
            .order_by(Booking.created_at.desc())
            .limit(limit)
        ).all()
    )


def cancel_booking(
    db: Session,
    booking: Booking,
    *,
    actor_user_id: UUID,
    reason: str | None = None,
) -> Booking:
    booking = db.execute(
        select(Booking).where(Booking.id == booking.id).with_for_update()
    ).scalar_one()
    if not st.can_cancel(booking.status):
        raise BookingError("invalid_transition", 409)
    prev = booking.status
    booking.status = st.BOOKING_CANCELLED
    booking.cancel_reason = reason
    _record_event(
        db,
        booking,
        from_status=prev,
        to_status=st.BOOKING_CANCELLED,
        actor_user_id=actor_user_id,
        reason=reason or "ride.cancel",
    )
    from app.models import DriverOffer

    offers = db.scalars(
        select(DriverOffer)
        .where(
            DriverOffer.booking_id == booking.id,
            DriverOffer.status == st.OFFER_PENDING,
        )
        .with_for_update()
    ).all()
    for offer in offers:
        offer.status = st.OFFER_WITHDRAWN

    assignment = db.execute(
        select(TripAssignment)
        .where(TripAssignment.booking_id == booking.id)
        .with_for_update()
    ).scalar_one_or_none()
    if assignment is not None and assignment.status == "ACTIVE":
        assignment.status = "CANCELLED"

    assigned = booking.assigned_driver_profile_id
    outbox = enqueue_outbox(
        db,
        aggregate_type="booking",
        aggregate_id=booking.id,
        event_type="booking.cancelled",
        payload={
            "booking_id": str(booking.id),
            "customer_id": str(booking.customer_id),
            "status": booking.status,
            "reason": reason,
            "assigned_driver_profile_id": str(assigned) if assigned else None,
        },
    )
    db.commit()
    if assigned:
        from app.services.location import sync_duty_status

        sync_duty_status(db, assigned, commit=True)
    db.refresh(booking)
    notify_local(outbox.id, "booking.cancelled", booking, {"reason": reason})
    return booking


def transition_trip(
    db: Session,
    booking: Booking,
    *,
    actor_user_id: UUID,
    action: str,
) -> Booking:
    booking = db.execute(
        select(Booking).where(Booking.id == booking.id).with_for_update()
    ).scalar_one()

    if booking.status in (st.BOOKING_CANCELLED,):
        raise BookingError("booking_cancelled", 409)

    # Idempotent: already past this action — return without new events
    if st.is_idempotent_driver_action(booking.status, action):
        return booking

    key = (booking.status, action)
    if key not in st.DRIVER_TRANSITIONS:
        raise BookingError("invalid_transition", 409)

    assignment = db.execute(
        select(TripAssignment)
        .where(TripAssignment.booking_id == booking.id)
        .with_for_update()
    ).scalar_one_or_none()
    if assignment is None or assignment.status != "ACTIVE":
        raise BookingError("no_active_assignment", 409)

    prev = booking.status
    booking.status = st.DRIVER_TRANSITIONS[key]
    _record_event(
        db,
        booking,
        from_status=prev,
        to_status=booking.status,
        actor_user_id=actor_user_id,
        reason=action,
    )
    if booking.status == st.BOOKING_TRIP_COMPLETED:
        booking.status = st.BOOKING_CLOSED
        _record_event(
            db,
            booking,
            from_status=st.BOOKING_TRIP_COMPLETED,
            to_status=st.BOOKING_CLOSED,
            actor_user_id=None,
            reason="ride.close",
        )
        assignment.status = "COMPLETED"

    outbox = enqueue_outbox(
        db,
        aggregate_type="booking",
        aggregate_id=booking.id,
        event_type="booking.status_changed",
        payload={
            "booking_id": str(booking.id),
            "customer_id": str(booking.customer_id),
            "status": booking.status,
            "action": action,
            "assigned_driver_profile_id": (
                str(booking.assigned_driver_profile_id)
                if booking.assigned_driver_profile_id
                else None
            ),
            "driver_profile_id": (
                str(booking.assigned_driver_profile_id)
                if booking.assigned_driver_profile_id
                else None
            ),
            "next_action": st.next_driver_action(booking.status),
        },
    )
    assigned = booking.assigned_driver_profile_id
    closed = booking.status == st.BOOKING_CLOSED
    db.commit()
    if closed and assigned:
        from app.services.location import sync_duty_status

        sync_duty_status(db, assigned, commit=True)
    db.refresh(booking)
    notify_local(
        outbox.id,
        "booking.status_changed",
        booking,
        {
            "action": action,
            "driver_profile_id": str(booking.assigned_driver_profile_id)
            if booking.assigned_driver_profile_id
            else None,
            "next_action": st.next_driver_action(booking.status),
        },
    )
    return booking


def booking_events(db: Session, booking_id: UUID) -> list[BookingEvent]:
    return list(
        db.scalars(
            select(BookingEvent)
            .where(BookingEvent.booking_id == booking_id)
            .order_by(BookingEvent.created_at.asc())
        ).all()
    )
