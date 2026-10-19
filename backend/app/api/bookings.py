"""Booking and fare endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import permissions as perm
from app.deps import AuthContext, get_current_auth, get_db, require_permissions
from app.domain import booking_states as st
from app.models import DriverProfile, TripAssignment, User
from app.schemas.booking import (
    AssignedDriverSummary,
    BookingCreateIn,
    BookingListOut,
    BookingOut,
    CancelIn,
    CustomerTripSummaryOut,
    FareEstimateIn,
    FareEstimateOut,
    ResyncOut,
    TripTransitionIn,
)
from app.services.booking import (
    BookingError,
    booking_events,
    cancel_booking,
    create_booking,
    get_booking,
    list_customer_bookings,
    transition_trip,
)
from app.services.dispatch import (
    DispatchError,
    dispatch_booking,
    get_or_create_driver_profile,
)

router = APIRouter(tags=["bookings"])


def _http_booking(exc: BookingError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"error": exc.code})


@router.post("/fare/estimate", response_model=FareEstimateOut)
def fare_estimate(
    body: FareEstimateIn,
    _auth: AuthContext = Depends(require_permissions(perm.BOOKINGS_CREATE_SELF)),
) -> FareEstimateOut:
    from app.services.fare import FareEstimateRequest, estimate_fare

    try:
        result = estimate_fare(FareEstimateRequest(**body.model_dump()))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "invalid_fare_input", "message": str(exc)},
        ) from exc
    return FareEstimateOut(**result)


@router.post("/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking_endpoint(
    body: BookingCreateIn,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.BOOKINGS_CREATE_SELF)),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> BookingOut:
    key = idempotency_key or body.idempotency_key
    if not key or len(key) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "idempotency_key_required"},
        )
    try:
        booking, created = create_booking(
            db,
            customer_id=auth.user.id,
            pickup_lat=body.pickup_lat,
            pickup_lon=body.pickup_lon,
            drop_lat=body.drop_lat,
            drop_lon=body.drop_lon,
            vehicle_type=body.vehicle_type,
            idempotency_key=key,
        )
    except BookingError as exc:
        raise _http_booking(exc) from exc
    if created:
        dispatch_booking(db, booking.id)
        booking = get_booking(db, booking.id) or booking
    return BookingOut.model_validate(booking)


@router.get("/bookings", response_model=BookingListOut)
def list_my_bookings(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.BOOKINGS_READ_SELF)),
) -> BookingListOut:
    items = list_customer_bookings(db, auth.user.id)
    return BookingListOut(items=[BookingOut.model_validate(b) for b in items])


@router.get("/bookings/{booking_id}", response_model=BookingOut)
def get_booking_endpoint(
    booking_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> BookingOut:
    booking = get_booking(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    if perm.BOOKINGS_READ in auth.permissions:
        return BookingOut.model_validate(booking)
    if booking.customer_id == auth.user.id and perm.BOOKINGS_READ_SELF in auth.permissions:
        return BookingOut.model_validate(booking)
    if booking.assigned_driver_profile_id and perm.DRIVERS_TRIPS_SELF in auth.permissions:
        profile = get_or_create_driver_profile(db, auth.user.id)
        if profile.id == booking.assigned_driver_profile_id:
            return BookingOut.model_validate(booking)
    raise HTTPException(status_code=403, detail={"error": "forbidden"})


def _assert_booking_read(auth: AuthContext, booking, db: Session) -> None:
    if perm.BOOKINGS_READ in auth.permissions:
        return
    if booking.customer_id == auth.user.id and perm.BOOKINGS_READ_SELF in auth.permissions:
        return
    if booking.assigned_driver_profile_id and perm.DRIVERS_TRIPS_SELF in auth.permissions:
        profile = get_or_create_driver_profile(db, auth.user.id)
        if profile.id == booking.assigned_driver_profile_id:
            return
    raise HTTPException(status_code=403, detail={"error": "forbidden"})


@router.get("/bookings/{booking_id}/summary", response_model=CustomerTripSummaryOut)
def booking_trip_summary(
    booking_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> CustomerTripSummaryOut:
    """Customer-safe trip view: booking + optional assigned driver display name."""
    booking = get_booking(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    _assert_booking_read(auth, booking, db)

    assigned: AssignedDriverSummary | None = None
    if booking.assigned_driver_profile_id:
        profile = db.get(DriverProfile, booking.assigned_driver_profile_id)
        if profile is not None:
            driver_user = db.get(User, profile.user_id)
            assignment = db.scalar(
                select(TripAssignment).where(TripAssignment.booking_id == booking.id)
            )
            assigned = AssignedDriverSummary(
                display_name=(driver_user.display_name if driver_user else "Driver"),
                vehicle_type=profile.vehicle_type,
                assignment_status=assignment.status if assignment else None,
            )

    return CustomerTripSummaryOut(
        booking=BookingOut.model_validate(booking),
        can_cancel=st.can_cancel(booking.status),
        assigned_driver=assigned,
        status_updated_at=booking.updated_at,
    )


@router.get("/bookings/{booking_id}/resync", response_model=ResyncOut)
def resync_booking(
    booking_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> ResyncOut:
    booking = get_booking_endpoint(booking_id, db, auth)
    events = booking_events(db, booking_id)
    event_dicts = [
        {
            "id": str(e.id),
            "from_status": e.from_status,
            "to_status": e.to_status,
            "reason": e.reason,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]
    cursor = event_dicts[-1]["id"] if event_dicts else None
    return ResyncOut(booking=booking, events=event_dicts, cursor=cursor)


@router.post("/bookings/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking_endpoint(
    booking_id: UUID,
    body: CancelIn,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.BOOKINGS_CANCEL_SELF)),
) -> BookingOut:
    booking = get_booking(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    if booking.customer_id != auth.user.id:
        raise HTTPException(status_code=403, detail={"error": "forbidden"})
    try:
        booking = cancel_booking(
            db, booking, actor_user_id=auth.user.id, reason=body.reason
        )
    except BookingError as exc:
        raise _http_booking(exc) from exc
    return BookingOut.model_validate(booking)


@router.post("/bookings/{booking_id}/transition", response_model=BookingOut)
def transition_booking(
    booking_id: UUID,
    body: TripTransitionIn,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DRIVERS_TRIPS_SELF)),
) -> BookingOut:
    booking = get_booking(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    profile = get_or_create_driver_profile(db, auth.user.id)
    if booking.assigned_driver_profile_id != profile.id:
        raise HTTPException(status_code=403, detail={"error": "forbidden"})
    try:
        booking = transition_trip(
            db, booking, actor_user_id=auth.user.id, action=body.action
        )
    except BookingError as exc:
        raise _http_booking(exc) from exc
    except DispatchError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail={"error": exc.code}
        ) from exc
    return BookingOut.model_validate(booking)
