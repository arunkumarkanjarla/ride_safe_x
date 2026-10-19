"""Operations & dispatch center API."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core import permissions as perm
from app.deps import AuthContext, client_ip, get_db, request_id_header, require_permissions
from app.schemas.ops import (
    OpsActionOut,
    OpsAssignmentOut,
    OpsBookingDetailOut,
    OpsBookingListOut,
    OpsBookingRow,
    OpsBookingSummaryOut,
    OpsCancelIn,
    OpsDriverListOut,
    OpsDriverRow,
    OpsEventOut,
    OpsOfferOut,
)
from app.services.ops import (
    OpsError,
    booking_summary,
    get_ops_booking_detail,
    list_ops_bookings,
    list_ops_drivers,
    ops_cancel_booking,
    retry_dispatch,
)

router = APIRouter(prefix="/ops", tags=["ops"])


def _http(exc: OpsError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"error": exc.code})


@router.get("/bookings/summary", response_model=OpsBookingSummaryOut)
def ops_summary(
    db: Session = Depends(get_db),
    _auth: AuthContext = Depends(require_permissions(perm.BOOKINGS_READ)),
) -> OpsBookingSummaryOut:
    total, by_status = booking_summary(db)
    return OpsBookingSummaryOut(total=total, by_status=by_status)


@router.get("/bookings", response_model=OpsBookingListOut)
def ops_list_bookings(
    db: Session = Depends(get_db),
    _auth: AuthContext = Depends(require_permissions(perm.BOOKINGS_READ)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=128),
    vehicle_type: str | None = Query(default=None),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
) -> OpsBookingListOut:
    rows, total = list_ops_bookings(
        db,
        page=page,
        page_size=page_size,
        status=status,
        q=q,
        created_from=created_from,
        created_to=created_to,
        vehicle_type=vehicle_type,
    )
    items = [
        OpsBookingRow(
            id=b.id,
            status=b.status,
            vehicle_type=b.vehicle_type,
            customer_id=b.customer_id,
            customer_email=email,
            estimate_paise=b.estimate_paise,
            currency=b.currency,
            assigned_driver_profile_id=b.assigned_driver_profile_id,
            created_at=b.created_at,
            updated_at=b.updated_at,
            open_offer_count=open_offers,
        )
        for b, email, open_offers in rows
    ]
    return OpsBookingListOut(
        items=items, page=page, page_size=page_size, total=total
    )


@router.get("/bookings/{booking_id}", response_model=OpsBookingDetailOut)
def ops_booking_detail(
    booking_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.BOOKINGS_READ)),
) -> OpsBookingDetailOut:
    # dispatch.read gates offer/driver location enrichment visibility conceptually;
    # bookings.read is enough for detail; offer data included for ops readers.
    try:
        data = get_ops_booking_detail(db, booking_id)
    except OpsError as exc:
        raise _http(exc) from exc
    b = data["booking"]
    include_dispatch = perm.DISPATCH_READ in auth.permissions
    offers = []
    if include_dispatch:
        offers = [OpsOfferOut(**o) for o in data["offers"]]
    assignment = None
    if data["assignment"] is not None:
        a = data["assignment"]
        assignment = OpsAssignmentOut(
            id=a.id,
            driver_profile_id=a.driver_profile_id,
            offer_id=a.offer_id,
            status=a.status,
            accepted_at=a.accepted_at,
        )
    return OpsBookingDetailOut(
        id=b.id,
        status=b.status,
        vehicle_type=b.vehicle_type,
        customer_id=b.customer_id,
        customer_email=data["customer_email"],
        pickup_lat=b.pickup_lat,
        pickup_lon=b.pickup_lon,
        drop_lat=b.drop_lat,
        drop_lon=b.drop_lon,
        distance_km=b.distance_km,
        duration_min=b.duration_min,
        estimate_paise=b.estimate_paise,
        currency=b.currency,
        assigned_driver_profile_id=b.assigned_driver_profile_id,
        cancel_reason=b.cancel_reason,
        created_at=b.created_at,
        updated_at=b.updated_at,
        offers=offers,
        events=[
            OpsEventOut(
                id=e.id,
                from_status=e.from_status,
                to_status=e.to_status,
                reason=e.reason,
                actor_user_id=e.actor_user_id,
                created_at=e.created_at,
            )
            for e in data["events"]
        ],
        assignment=assignment,
        unassigned_reason=data["unassigned_reason"] if include_dispatch else None,
        offer_counts=data["offer_counts"] if include_dispatch else {},
    )


@router.get("/drivers", response_model=OpsDriverListOut)
def ops_list_drivers(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DRIVERS_READ)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    online: bool | None = Query(default=None),
    eligible_only: bool = Query(default=False),
) -> OpsDriverListOut:
    include_coords = perm.DISPATCH_READ in auth.permissions
    rows, total = list_ops_drivers(
        db,
        page=page,
        page_size=page_size,
        online=online,
        eligible_only=eligible_only,
        include_coordinates=include_coords,
    )
    return OpsDriverListOut(
        items=[OpsDriverRow(**r) for r in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.post("/bookings/{booking_id}/dispatch-retry", response_model=OpsActionOut)
def ops_dispatch_retry(
    booking_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.DISPATCH_RETRY)),
    request_id: str | None = Depends(request_id_header),
) -> OpsActionOut:
    try:
        booking = retry_dispatch(
            db,
            booking_id,
            actor_user_id=auth.user.id,
            ip_address=client_ip(request),
            request_id=request_id,
        )
    except OpsError as exc:
        raise _http(exc) from exc
    return OpsActionOut(
        booking_id=booking.id,
        status=booking.status,
        action="dispatch_retry",
        detail="Dispatch retry completed",
    )


@router.post("/bookings/{booking_id}/cancel", response_model=OpsActionOut)
def ops_cancel(
    booking_id: UUID,
    body: OpsCancelIn,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.BOOKINGS_CANCEL)),
    request_id: str | None = Depends(request_id_header),
) -> OpsActionOut:
    try:
        booking = ops_cancel_booking(
            db,
            booking_id,
            actor_user_id=auth.user.id,
            reason=body.reason,
            ip_address=client_ip(request),
            request_id=request_id,
        )
    except OpsError as exc:
        raise _http(exc) from exc
    return OpsActionOut(
        booking_id=booking.id,
        status=booking.status,
        action="cancel",
        detail=body.reason,
    )
