"""Driver availability, location, offers, and assignments."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core import permissions as perm
from app.deps import AuthContext, get_db, require_permissions
from app.models import DriverAvailability, DriverProfile
from app.domain import booking_states as st
from app.schemas.booking import (
    ActiveTripOut,
    AssignmentListOut,
    AssignmentOut,
    AvailabilityIn,
    AvailabilityOut,
    BookingListOut,
    BookingOut,
    LocationIn,
    LocationOut,
    OfferListOut,
    OfferOut,
)
from app.services.dispatch import (
    DispatchError,
    accept_offer,
    get_or_create_driver_profile,
    list_driver_assignments,
    list_driver_bookings,
    list_driver_offers,
    reject_offer,
    set_availability,
)
from app.services.location import (
    LocationError,
    ineligibility_reason,
    location_freshness,
    update_driver_location,
)

router = APIRouter(prefix="/drivers", tags=["drivers"])


def _http(exc: DispatchError | LocationError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"error": exc.code})


def _availability_out(db: Session, profile: DriverProfile, avail: DriverAvailability) -> AvailabilityOut:
    freshness = location_freshness(avail)
    reason = ineligibility_reason(db, profile, avail)
    return AvailabilityOut(
        driver_profile_id=avail.driver_profile_id,
        is_online=avail.is_online,
        duty_status=avail.duty_status,
        last_lat=avail.last_lat,
        last_lon=avail.last_lon,
        location_received_at=avail.location_received_at,
        location_seq=avail.location_seq or 0,
        location_freshness=freshness,
        dispatch_eligible=reason is None,
        ineligibility_reason=reason,
        updated_at=avail.updated_at,
    )


@router.put("/me/availability", response_model=AvailabilityOut)
def update_availability(
    body: AvailabilityIn,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DRIVERS_AVAILABILITY_SELF)),
) -> AvailabilityOut:
    profile = get_or_create_driver_profile(db, auth.user.id)
    try:
        avail = set_availability(
            db,
            profile,
            is_online=body.is_online,
            lat=body.lat,
            lon=body.lon,
            actor_user_id=auth.user.id,
        )
    except DispatchError as exc:
        raise _http(exc) from exc
    return _availability_out(db, profile, avail)


@router.get("/me/availability", response_model=AvailabilityOut)
def get_availability(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DRIVERS_AVAILABILITY_SELF)),
) -> AvailabilityOut:
    profile = get_or_create_driver_profile(db, auth.user.id)
    avail = db.get(DriverAvailability, profile.id)
    if avail is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return _availability_out(db, profile, avail)


@router.put("/me/location", response_model=LocationOut)
def put_location(
    body: LocationIn,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DRIVERS_AVAILABILITY_SELF)),
) -> LocationOut:
    profile = get_or_create_driver_profile(db, auth.user.id)
    try:
        avail = update_driver_location(
            db,
            profile,
            lat=body.lat,
            lon=body.lon,
            seq=body.seq,
            accuracy_m=body.accuracy_m,
            captured_at=body.captured_at,
            actor_user_id=auth.user.id,
        )
    except LocationError as exc:
        raise _http(exc) from exc
    reason = ineligibility_reason(db, profile, avail)
    return LocationOut(
        driver_profile_id=avail.driver_profile_id,
        lat=avail.last_lat,
        lon=avail.last_lon,
        location_received_at=avail.location_received_at,
        location_client_at=avail.location_client_at,
        accuracy_m=avail.accuracy_m,
        location_seq=avail.location_seq,
        location_freshness=location_freshness(avail),
        duty_status=avail.duty_status,
        dispatch_eligible=reason is None,
        ineligibility_reason=reason,
    )


@router.get("/me/offers", response_model=OfferListOut)
def my_offers(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DRIVERS_OFFERS_SELF)),
) -> OfferListOut:
    profile = get_or_create_driver_profile(db, auth.user.id)
    offers = list_driver_offers(db, profile.id)
    items = []
    for o in offers:
        items.append(
            OfferOut(
                id=o.id,
                booking_id=o.booking_id,
                driver_profile_id=o.driver_profile_id,
                status=o.status,
                expires_at=o.expires_at,
                created_at=o.created_at,
                booking=BookingOut.model_validate(o.booking) if o.booking else None,
            )
        )
    return OfferListOut(items=items)


@router.post("/me/offers/{offer_id}/accept", response_model=AssignmentOut)
def accept_offer_endpoint(
    offer_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DRIVERS_OFFERS_SELF)),
) -> AssignmentOut:
    profile = get_or_create_driver_profile(db, auth.user.id)
    try:
        assignment = accept_offer(db, offer_id, driver_profile_id=profile.id)
    except DispatchError as exc:
        raise _http(exc) from exc
    from app.services.booking import get_booking

    if getattr(assignment, "booking", None) is None:
        assignment.booking = get_booking(db, assignment.booking_id)  # type: ignore[attr-defined]
    return _assignment_out(assignment)


@router.post("/me/offers/{offer_id}/reject", response_model=OfferOut)
def reject_offer_endpoint(
    offer_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DRIVERS_OFFERS_SELF)),
) -> OfferOut:
    profile = get_or_create_driver_profile(db, auth.user.id)
    try:
        offer = reject_offer(db, offer_id, driver_profile_id=profile.id)
    except DispatchError as exc:
        raise _http(exc) from exc
    return OfferOut(
        id=offer.id,
        booking_id=offer.booking_id,
        driver_profile_id=offer.driver_profile_id,
        status=offer.status,
        expires_at=offer.expires_at,
        created_at=offer.created_at,
    )


def _assignment_out(a) -> AssignmentOut:
    booking = a.booking if getattr(a, "booking", None) else None
    next_action = st.next_driver_action(booking.status) if booking else None
    return AssignmentOut(
        id=a.id,
        booking_id=a.booking_id,
        driver_profile_id=a.driver_profile_id,
        offer_id=a.offer_id,
        status=a.status,
        accepted_at=a.accepted_at,
        booking=BookingOut.model_validate(booking) if booking else None,
        next_action=next_action if a.status == "ACTIVE" else None,
    )


@router.get("/me/assignments", response_model=AssignmentListOut)
def my_assignments(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DRIVERS_TRIPS_SELF)),
) -> AssignmentListOut:
    profile = get_or_create_driver_profile(db, auth.user.id)
    rows = list_driver_assignments(db, profile.id)
    return AssignmentListOut(items=[_assignment_out(a) for a in rows])


@router.get("/me/active-trip", response_model=ActiveTripOut)
def my_active_trip(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DRIVERS_TRIPS_SELF)),
) -> ActiveTripOut:
    """Authoritative active assignment for the driver trip workspace."""
    profile = get_or_create_driver_profile(db, auth.user.id)
    rows = list_driver_assignments(db, profile.id)
    active = next((a for a in rows if a.status == "ACTIVE"), None)
    if active is None:
        return ActiveTripOut()
    out = _assignment_out(active)
    return ActiveTripOut(
        assignment=out,
        booking=out.booking,
        next_action=out.next_action,
        action_label=st.action_label(out.next_action),
    )


@router.get("/me/trips", response_model=BookingListOut)
def my_trips(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DRIVERS_TRIPS_SELF)),
) -> BookingListOut:
    profile = get_or_create_driver_profile(db, auth.user.id)
    items = list_driver_bookings(db, profile.id)
    return BookingListOut(items=[BookingOut.model_validate(b) for b in items])
