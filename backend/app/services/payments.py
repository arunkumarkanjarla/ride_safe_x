"""Payment create / transition / sandbox callback (Phase 9)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.domain import booking_states as bst
from app.domain import payment_states as pst
from app.models import Booking, Payment, PaymentEvent
from app.services.outbox import enqueue_outbox
from app.services.payment_gateway import SandboxGateway, get_sandbox_gateway
from app.services.ws_hub import hub


class PaymentError(Exception):
    def __init__(self, code: str, status_code: int = 400) -> None:
        self.code = code
        self.status_code = status_code
        super().__init__(code)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _record_event(
    db: Session,
    payment: Payment,
    *,
    from_status: str | None,
    to_status: str,
    reason: str | None,
    actor_user_id: UUID | None,
    gateway_event_key: str | None = None,
) -> PaymentEvent:
    ev = PaymentEvent(
        payment_id=payment.id,
        from_status=from_status,
        to_status=to_status,
        reason=reason,
        actor_user_id=actor_user_id,
        gateway_event_key=gateway_event_key,
    )
    db.add(ev)
    return ev


def _enqueue_payment_event(
    db: Session, payment: Payment, event_type: str, extra: dict | None = None
):
    payload = {
        "payment_id": str(payment.id),
        "booking_id": str(payment.booking_id),
        "customer_id": str(payment.customer_id),
        "status": payment.status,
        "amount_paise": payment.amount_paise,
        "currency": payment.currency,
        "gateway": payment.gateway,
        "gateway_ref": payment.gateway_ref,
    }
    if extra:
        payload.update(extra)
    return enqueue_outbox(
        db,
        aggregate_type="payment",
        aggregate_id=payment.id,
        event_type=event_type,
        payload=payload,
    )


def _notify_local(event_id, event_type: str, payment: Payment) -> None:
    try:
        from app.core.db import get_session_factory
        from app.services.notifications import materialize_outbox_event

        factory = get_session_factory()
        ndb = factory()
        try:
            materialize_outbox_event(ndb, UUID(str(event_id)), emit_ws=True)
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
            "aggregate_type": "payment",
            "aggregate_id": str(payment.id),
            "event_type": event_type,
            "payload": {
                "payment_id": str(payment.id),
                "booking_id": str(payment.booking_id),
                "customer_id": str(payment.customer_id),
                "status": payment.status,
            },
        }
    )


def _assert_sandbox(settings: Settings) -> None:
    if not settings.sandbox_payments_allowed():
        raise PaymentError("sandbox_disabled", 403)


def create_payment(
    db: Session,
    *,
    customer_id: UUID,
    booking_id: UUID,
    idempotency_key: str,
    settings: Settings | None = None,
    gateway: SandboxGateway | None = None,
) -> tuple[Payment, bool]:
    settings = settings or get_settings()
    _assert_sandbox(settings)
    gateway = gateway or get_sandbox_gateway()

    existing = db.scalar(
        select(Payment).where(
            Payment.customer_id == customer_id,
            Payment.idempotency_key == idempotency_key,
        )
    )
    if existing is not None:
        if existing.booking_id != booking_id:
            raise PaymentError("idempotency_key_conflict", 409)
        return existing, False

    booking = db.execute(
        select(Booking).where(Booking.id == booking_id).with_for_update()
    ).scalar_one_or_none()
    if booking is None:
        raise PaymentError("booking_not_found", 404)
    if booking.customer_id != customer_id:
        raise PaymentError("forbidden", 403)
    if booking.status not in pst.ELIGIBLE_BOOKING_STATUSES:
        raise PaymentError("booking_not_eligible", 409)
    if booking.status == bst.BOOKING_CANCELLED:
        raise PaymentError("booking_not_eligible", 409)

    succeeded = db.scalar(
        select(Payment).where(
            Payment.booking_id == booking_id,
            Payment.status == pst.PAYMENT_SUCCEEDED,
        )
    )
    if succeeded is not None:
        raise PaymentError("payment_already_succeeded", 409)

    payment = Payment(
        booking_id=booking.id,
        customer_id=customer_id,
        amount_paise=int(booking.estimate_paise),
        currency=booking.currency or "INR",
        status=pst.PAYMENT_CREATED,
        gateway=pst.GATEWAY_SANDBOX,
        gateway_ref=f"pending_{uuid4().hex[:20]}",
        idempotency_key=idempotency_key,
    )
    db.add(payment)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        again = db.scalar(
            select(Payment).where(
                Payment.customer_id == customer_id,
                Payment.idempotency_key == idempotency_key,
            )
        )
        if again is not None and again.booking_id == booking_id:
            return again, False
        raise PaymentError("idempotency_key_conflict", 409) from exc

    _record_event(
        db,
        payment,
        from_status=None,
        to_status=pst.PAYMENT_CREATED,
        reason="payment.created",
        actor_user_id=customer_id,
    )

    created = gateway.create_attempt(
        payment_id=str(payment.id),
        amount_paise=payment.amount_paise,
        currency=payment.currency,
    )
    prev = payment.status
    payment.gateway = created.gateway
    payment.gateway_ref = created.gateway_ref
    payment.status = pst.PAYMENT_PENDING
    payment.updated_at = _now()
    _record_event(
        db,
        payment,
        from_status=prev,
        to_status=pst.PAYMENT_PENDING,
        reason="sandbox.initiate",
        actor_user_id=customer_id,
    )
    outbox = _enqueue_payment_event(db, payment, "payment.created")
    db.commit()
    db.refresh(payment)
    _notify_local(outbox.id, "payment.created", payment)
    return payment, True


def get_payment(db: Session, payment_id: UUID) -> Payment | None:
    return db.get(Payment, payment_id)


def list_customer_payments(
    db: Session, customer_id: UUID, *, booking_id: UUID | None = None, limit: int = 50
) -> list[Payment]:
    q = select(Payment).where(Payment.customer_id == customer_id)
    if booking_id is not None:
        q = q.where(Payment.booking_id == booking_id)
    return list(
        db.scalars(q.order_by(Payment.created_at.desc()).limit(min(100, max(1, limit)))).all()
    )


def _apply_outcome(
    db: Session,
    payment: Payment,
    *,
    outcome: str,
    actor_user_id: UUID | None,
    gateway_event_key: str,
) -> Payment:
    event_map = {
        "succeed": "sandbox.succeed",
        "fail": "sandbox.fail",
        "cancel": "payment.cancel",
        "expire": "sandbox.expire",
    }
    sm_event = event_map.get(outcome)
    if sm_event is None:
        raise PaymentError("invalid_sandbox_outcome", 422)

    # Deduplicate by gateway_event_key
    prior = db.scalar(
        select(PaymentEvent).where(PaymentEvent.gateway_event_key == gateway_event_key)
    )
    if prior is not None:
        db.refresh(payment)
        return payment

    payment = db.execute(
        select(Payment).where(Payment.id == payment.id).with_for_update()
    ).scalar_one()

    if pst.is_terminal(payment.status):
        # Out-of-order / duplicate after terminal — no regress
        raise PaymentError("payment_terminal", 409)

    nxt = pst.next_status(payment.status, sm_event)
    if nxt is None:
        raise PaymentError("invalid_transition", 409)

    prev = payment.status
    payment.status = nxt
    payment.updated_at = _now()
    if nxt == pst.PAYMENT_SUCCEEDED:
        payment.succeeded_at = _now()
        payment.failure_category = None
    elif nxt == pst.PAYMENT_FAILED:
        payment.failed_at = _now()
        payment.failure_category = "sandbox_declined"
    elif nxt == pst.PAYMENT_CANCELLED:
        payment.cancelled_at = _now()
        payment.failure_category = None

    try:
        _record_event(
            db,
            payment,
            from_status=prev,
            to_status=nxt,
            reason=sm_event,
            actor_user_id=actor_user_id,
            gateway_event_key=gateway_event_key,
        )
        event_type = {
            pst.PAYMENT_SUCCEEDED: "payment.succeeded",
            pst.PAYMENT_FAILED: "payment.failed",
            pst.PAYMENT_CANCELLED: "payment.cancelled",
            pst.PAYMENT_EXPIRED: "payment.expired",
        }[nxt]
        outbox = _enqueue_payment_event(db, payment, event_type, {"action": sm_event})
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # Concurrent duplicate event_key or second SUCCEEDED for booking
        again = db.get(Payment, payment.id)
        if again and pst.is_terminal(again.status):
            return again
        raise PaymentError("duplicate_or_conflict", 409) from exc

    db.refresh(payment)
    _notify_local(outbox.id, event_type, payment)
    return payment


def sandbox_simulate(
    db: Session,
    payment: Payment,
    *,
    outcome: str,
    actor_user_id: UUID,
    event_key: str | None = None,
    settings: Settings | None = None,
    gateway: SandboxGateway | None = None,
) -> Payment:
    settings = settings or get_settings()
    _assert_sandbox(settings)
    gateway = gateway or get_sandbox_gateway()
    built = gateway.build_event(
        gateway_ref=payment.gateway_ref, outcome=outcome, event_key=event_key
    )
    return _apply_outcome(
        db,
        payment,
        outcome=built.outcome,
        actor_user_id=actor_user_id,
        gateway_event_key=built.event_key,
    )


def sandbox_callback(
    db: Session,
    *,
    gateway_ref: str,
    outcome: str,
    event_key: str,
    token: str | None,
    settings: Settings | None = None,
    gateway: SandboxGateway | None = None,
) -> Payment:
    settings = settings or get_settings()
    _assert_sandbox(settings)
    gateway = gateway or get_sandbox_gateway()
    if not gateway.authenticate_callback(token, settings.payments_sandbox_token):
        raise PaymentError("invalid_sandbox_token", 401)

    payment = db.scalar(select(Payment).where(Payment.gateway_ref == gateway_ref))
    if payment is None:
        raise PaymentError("payment_not_found", 404)
    built = gateway.build_event(
        gateway_ref=gateway_ref, outcome=outcome, event_key=event_key
    )
    return _apply_outcome(
        db,
        payment,
        outcome=built.outcome,
        actor_user_id=None,
        gateway_event_key=built.event_key,
    )
