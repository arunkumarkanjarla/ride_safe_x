"""Operations booking list, detail, dispatch retry, ops cancel."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.domain import booking_states as st
from app.models import (
    Booking,
    BookingEvent,
    DriverAvailability,
    DriverOffer,
    DriverProfile,
    TripAssignment,
    User,
)
from app.services.location import ineligibility_reason, location_freshness
from app.services.audit import record_audit
from app.services.booking import BookingError, cancel_booking
from app.services.dispatch import dispatch_booking


class OpsError(Exception):
    def __init__(self, code: str, status_code: int = 400) -> None:
        self.code = code
        self.status_code = status_code
        super().__init__(code)


RETRYABLE = {st.BOOKING_SEARCHING, st.BOOKING_NO_DRIVER, st.BOOKING_REQUESTED}


def booking_summary(db: Session) -> tuple[int, dict[str, int]]:
    rows = db.execute(
        select(Booking.status, func.count()).group_by(Booking.status)
    ).all()
    by_status = {status: int(count) for status, count in rows}
    total = sum(by_status.values())
    return total, by_status


def list_ops_bookings(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    q: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    vehicle_type: str | None = None,
) -> tuple[list[tuple[Booking, str | None, int]], int]:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    filters = []
    if status:
        filters.append(Booking.status == status)
    if vehicle_type:
        filters.append(Booking.vehicle_type == vehicle_type)
    if created_from:
        filters.append(Booking.created_at >= created_from)
    if created_to:
        filters.append(Booking.created_at <= created_to)

    join_user = False
    if q:
        term = q.strip()
        clauses = []
        try:
            uid = UUID(term)
            clauses.extend(
                [
                    Booking.id == uid,
                    Booking.customer_id == uid,
                    Booking.assigned_driver_profile_id == uid,
                ]
            )
        except ValueError:
            join_user = True
            clauses.append(User.email.ilike(f"%{term}%"))
        filters.append(or_(*clauses))

    count_q = select(func.count()).select_from(Booking)
    list_q = select(Booking)
    if join_user:
        count_q = count_q.join(User, User.id == Booking.customer_id)
        list_q = list_q.join(User, User.id == Booking.customer_id)
    if filters:
        count_q = count_q.where(*filters)
        list_q = list_q.where(*filters)

    total = db.scalar(count_q) or 0
    rows = list(
        db.scalars(
            list_q.order_by(Booking.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )

    result: list[tuple[Booking, str | None, int]] = []
    for booking in rows:
        email = db.scalar(select(User.email).where(User.id == booking.customer_id))
        open_offers = (
            db.scalar(
                select(func.count())
                .select_from(DriverOffer)
                .where(
                    DriverOffer.booking_id == booking.id,
                    DriverOffer.status == st.OFFER_PENDING,
                )
            )
            or 0
        )
        result.append((booking, email, int(open_offers)))
    return result, int(total)


def _unassigned_reason(booking: Booking, offers: list[DriverOffer]) -> str | None:
    if booking.assigned_driver_profile_id and booking.status in st.ACTIVE_DRIVER_TRIP | {
        st.BOOKING_DRIVER_ACCEPTED,
        st.BOOKING_TRIP_COMPLETED,
        st.BOOKING_CLOSED,
    }:
        return None
    if booking.status == st.BOOKING_CANCELLED:
        return "Booking cancelled"
    if booking.status == st.BOOKING_NO_DRIVER:
        return "No eligible drivers found or search exhausted"
    pending = [o for o in offers if o.status == st.OFFER_PENDING]
    if booking.status == st.BOOKING_DRIVER_ASSIGNED and pending:
        return "Awaiting driver response to open offer(s)"
    if booking.status == st.BOOKING_SEARCHING:
        if not offers:
            return "Searching; no offers created yet"
        return "Searching after prior offers closed"
    if booking.status == st.BOOKING_REQUESTED:
        return "Booking created; dispatch not started"
    declined = sum(1 for o in offers if o.status == st.OFFER_DECLINED)
    expired = sum(1 for o in offers if o.status == st.OFFER_EXPIRED)
    if declined or expired:
        return f"Unassigned after offers closed (declined={declined}, expired={expired})"
    return None


def get_ops_booking_detail(db: Session, booking_id: UUID) -> dict:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise OpsError("not_found", 404)
    customer_email = db.scalar(select(User.email).where(User.id == booking.customer_id))
    offers = list(
        db.scalars(
            select(DriverOffer)
            .where(DriverOffer.booking_id == booking.id)
            .order_by(DriverOffer.created_at.asc())
        ).all()
    )
    events = list(
        db.scalars(
            select(BookingEvent)
            .where(BookingEvent.booking_id == booking.id)
            .order_by(BookingEvent.created_at.asc())
        ).all()
    )
    assignment = db.scalar(
        select(TripAssignment).where(TripAssignment.booking_id == booking.id)
    )

    offer_out = []
    counts: dict[str, int] = {}
    for offer in offers:
        counts[offer.status] = counts.get(offer.status, 0) + 1
        profile = db.get(DriverProfile, offer.driver_profile_id)
        avail = db.get(DriverAvailability, offer.driver_profile_id)
        offer_out.append(
            {
                "id": offer.id,
                "driver_profile_id": offer.driver_profile_id,
                "driver_user_id": profile.user_id if profile else None,
                "status": offer.status,
                "expires_at": offer.expires_at,
                "created_at": offer.created_at,
                "responded_at": offer.responded_at,
                "driver_online": avail.is_online if avail else None,
                "driver_last_lat": avail.last_lat if avail else None,
                "driver_last_lon": avail.last_lon if avail else None,
            }
        )

    return {
        "booking": booking,
        "customer_email": customer_email,
        "offers": offer_out,
        "events": events,
        "assignment": assignment,
        "unassigned_reason": _unassigned_reason(booking, offers),
        "offer_counts": counts,
    }


def retry_dispatch(
    db: Session,
    booking_id: UUID,
    *,
    actor_user_id: UUID,
    ip_address: str | None = None,
    request_id: str | None = None,
) -> Booking:
    booking = db.execute(
        select(Booking).where(Booking.id == booking_id).with_for_update()
    ).scalar_one_or_none()
    if booking is None:
        raise OpsError("not_found", 404)
    if booking.status not in RETRYABLE:
        raise OpsError("invalid_transition", 409)
    if booking.status == st.BOOKING_NO_DRIVER:
        prev = booking.status
        booking.status = st.BOOKING_SEARCHING
        db.add(
            BookingEvent(
                booking_id=booking.id,
                from_status=prev,
                to_status=st.BOOKING_SEARCHING,
                actor_user_id=actor_user_id,
                reason="ops.dispatch_retry",
            )
        )
        db.commit()
    record_audit(
        db,
        action="ops.dispatch_retry",
        outcome="attempt",
        actor_user_id=actor_user_id,
        target_type="booking",
        target_id=str(booking.id),
        metadata={"from_status": booking.status},
        ip_address=ip_address,
        request_id=request_id,
    )
    db.commit()
    booking = dispatch_booking(db, booking.id)
    record_audit(
        db,
        action="ops.dispatch_retry",
        outcome="success",
        actor_user_id=actor_user_id,
        target_type="booking",
        target_id=str(booking.id),
        metadata={"to_status": booking.status},
        ip_address=ip_address,
        request_id=request_id,
    )
    db.commit()
    db.refresh(booking)
    return booking


def list_ops_drivers(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    online: bool | None = None,
    eligible_only: bool = False,
    include_coordinates: bool = False,
) -> tuple[list[dict], int]:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    filters = []
    if online is not None:
        filters.append(DriverAvailability.is_online.is_(online))

    count_q = (
        select(func.count())
        .select_from(DriverProfile)
        .join(DriverAvailability, DriverAvailability.driver_profile_id == DriverProfile.id)
    )
    list_q = (
        select(DriverProfile, DriverAvailability, User)
        .join(DriverAvailability, DriverAvailability.driver_profile_id == DriverProfile.id)
        .join(User, User.id == DriverProfile.user_id)
    )
    if filters:
        count_q = count_q.where(*filters)
        list_q = list_q.where(*filters)

    total = db.scalar(count_q) or 0
    rows = db.execute(
        list_q.order_by(DriverAvailability.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    items: list[dict] = []
    for profile, avail, user in rows:
        reason = ineligibility_reason(db, profile, avail)
        if eligible_only and reason is not None:
            continue
        items.append(
            {
                "driver_profile_id": profile.id,
                "user_id": profile.user_id,
                "email": user.email,
                "vehicle_type": profile.vehicle_type,
                "profile_status": profile.status,
                "is_online": avail.is_online,
                "duty_status": avail.duty_status,
                "location_freshness": location_freshness(avail),
                "location_received_at": avail.location_received_at,
                "dispatch_eligible": reason is None,
                "ineligibility_reason": reason,
                "last_lat": avail.last_lat if include_coordinates else None,
                "last_lon": avail.last_lon if include_coordinates else None,
            }
        )
    return items, int(total)


def ops_cancel_booking(
    db: Session,
    booking_id: UUID,
    *,
    actor_user_id: UUID,
    reason: str | None,
    ip_address: str | None = None,
    request_id: str | None = None,
) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise OpsError("not_found", 404)
    try:
        booking = cancel_booking(
            db, booking, actor_user_id=actor_user_id, reason=reason or "ops.cancel"
        )
    except BookingError as exc:
        record_audit(
            db,
            action="ops.booking_cancel",
            outcome="denied",
            actor_user_id=actor_user_id,
            target_type="booking",
            target_id=str(booking_id),
            metadata={"error": exc.code},
            ip_address=ip_address,
            request_id=request_id,
        )
        db.commit()
        raise OpsError(exc.code, exc.status_code) from exc
    record_audit(
        db,
        action="ops.booking_cancel",
        outcome="success",
        actor_user_id=actor_user_id,
        target_type="booking",
        target_id=str(booking.id),
        metadata={"reason": reason},
        ip_address=ip_address,
        request_id=request_id,
    )
    db.commit()
    return booking
