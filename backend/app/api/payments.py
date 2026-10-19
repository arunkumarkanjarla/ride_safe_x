"""Customer payment APIs — Phase 9 sandbox foundation."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core import permissions as perm
from app.core.config import Settings, get_settings
from app.core.rate_limit import RateLimitExceeded, _memory_hit
from app.deps import AuthContext, get_db, require_permissions
from app.schemas.payment import (
    PaymentCreateIn,
    PaymentListOut,
    PaymentOut,
    SandboxCallbackIn,
    SandboxSimulateIn,
)
from app.services.payments import (
    PaymentError,
    create_payment,
    get_payment,
    list_customer_payments,
    sandbox_callback,
    sandbox_simulate,
)

router = APIRouter(tags=["payments"])


def _http(exc: PaymentError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"error": exc.code})


def _out(p) -> PaymentOut:
    data = PaymentOut.model_validate(p)
    data.sandbox = p.gateway == "sandbox"
    return data


@router.post("/payments", response_model=PaymentOut, status_code=201)
def initiate_payment(
    body: PaymentCreateIn,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.PAYMENTS_CREATE_SELF)),
    settings: Settings = Depends(get_settings),
) -> PaymentOut:
    if not settings.sandbox_payments_allowed():
        raise HTTPException(status_code=403, detail={"error": "sandbox_disabled"})
    try:
        _memory_hit(f"pay:{auth.user.id}", 30, 60)
    except RateLimitExceeded:
        raise HTTPException(status_code=429, detail={"error": "rate_limited"}) from None
    try:
        payment, created = create_payment(
            db,
            customer_id=auth.user.id,
            booking_id=body.booking_id,
            idempotency_key=body.idempotency_key,
            settings=settings,
        )
    except PaymentError as exc:
        raise _http(exc) from exc
    out = _out(payment)
    # Idempotent replay returns 200 semantics via same body; keep 201 for create
    if not created:
        # FastAPI already set 201; acceptable for idempotent POST
        pass
    return out


@router.get("/payments", response_model=PaymentListOut)
def list_payments(
    booking_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.PAYMENTS_READ_SELF)),
) -> PaymentListOut:
    items = list_customer_payments(db, auth.user.id, booking_id=booking_id)
    return PaymentListOut(items=[_out(p) for p in items])


@router.get("/payments/{payment_id}", response_model=PaymentOut)
def get_payment_endpoint(
    payment_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.PAYMENTS_READ_SELF)),
) -> PaymentOut:
    payment = get_payment(db, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    if payment.customer_id != auth.user.id:
        raise HTTPException(status_code=403, detail={"error": "forbidden"})
    return _out(payment)


@router.post("/payments/{payment_id}/sandbox/simulate", response_model=PaymentOut)
def simulate_sandbox_outcome(
    payment_id: UUID,
    body: SandboxSimulateIn,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.PAYMENTS_CREATE_SELF)),
    settings: Settings = Depends(get_settings),
) -> PaymentOut:
    if not settings.sandbox_payments_allowed():
        raise HTTPException(status_code=403, detail={"error": "sandbox_disabled"})
    payment = get_payment(db, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    if payment.customer_id != auth.user.id:
        raise HTTPException(status_code=403, detail={"error": "forbidden"})
    try:
        payment = sandbox_simulate(
            db,
            payment,
            outcome=body.outcome,
            actor_user_id=auth.user.id,
            event_key=body.event_key,
            settings=settings,
        )
    except PaymentError as exc:
        raise _http(exc) from exc
    return _out(payment)


@router.post("/payments/sandbox/callback", response_model=PaymentOut)
def sandbox_provider_callback(
    body: SandboxCallbackIn,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PaymentOut:
    """Simulated provider callback — not a live webhook; token-gated."""
    if not settings.sandbox_payments_allowed():
        raise HTTPException(status_code=403, detail={"error": "sandbox_disabled"})
    try:
        payment = sandbox_callback(
            db,
            gateway_ref=body.gateway_ref,
            outcome=body.outcome,
            event_key=body.event_key,
            token=body.sandbox_token,
            settings=settings,
        )
    except PaymentError as exc:
        raise _http(exc) from exc
    return _out(payment)
