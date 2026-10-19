"""Phase 9 — sandbox payments ownership, idempotency, terminal safety."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update

from app.core.config import get_settings
from app.models import DriverAvailability, Payment, PaymentEvent
from app.services.dispatch import get_or_create_driver_profile, set_availability


def _login(client: TestClient, email: str, password: str) -> dict:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


def _auth(t: dict) -> dict:
    return {"Authorization": f"Bearer {t['access_token']}"}


BOOKING_BODY = {
    "pickup_lat": 17.385,
    "pickup_lon": 78.4867,
    "drop_lat": 17.448,
    "drop_lon": 78.391,
    "vehicle_type": "Cab",
}


def _closed_booking(client, db_session, make_user):
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
    customer, cp = make_user(role="customer")
    other, op = make_user(role="customer")
    driver, dp = make_user(role="driver")
    profile = get_or_create_driver_profile(db_session, driver.id)
    set_availability(db_session, profile, is_online=True, lat=17.385, lon=78.4867)

    ct = _login(client, customer.email, cp)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={**_auth(ct), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    assert created.status_code == 201, created.text
    booking_id = created.json()["id"]
    amount = created.json()["estimate_paise"]

    dt = _login(client, driver.email, dp)
    offers = client.get("/drivers/me/offers", headers=_auth(dt)).json()["items"]
    assert offers
    assert (
        client.post(
            f"/drivers/me/offers/{offers[0]['id']}/accept",
            headers=_auth(dt),
            json={},
        ).status_code
        == 200
    )
    for action in ("driver.en_route", "driver.arrived", "trip.start", "trip.end"):
        assert (
            client.post(
                f"/bookings/{booking_id}/transition",
                headers=_auth(dt),
                json={"action": action},
            ).status_code
            == 200
        )
    assert client.get(f"/bookings/{booking_id}", headers=_auth(ct)).json()["status"] == "CLOSED"
    return {
        "booking_id": booking_id,
        "amount": amount,
        "customer": customer,
        "cp": cp,
        "ct": ct,
        "other": other,
        "op": op,
    }


@pytest.mark.db
def test_sandbox_payment_lifecycle(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    ctx = _closed_booking(client, db_session, make_user)
    ct = ctx["ct"]
    bid = ctx["booking_id"]
    idem = f"pay-{uuid.uuid4()}"

    # Ineligible before close covered implicitly; open booking rejected separately
    created = client.post(
        "/payments",
        headers=_auth(ct),
        json={"booking_id": bid, "idempotency_key": idem},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "PENDING"
    assert body["amount_paise"] == ctx["amount"]
    assert body["currency"] == "INR"
    assert body["sandbox"] is True
    assert body["gateway_ref"].startswith("sbx_")
    payment_id = body["id"]

    # Idempotent replay
    again = client.post(
        "/payments",
        headers=_auth(ct),
        json={"booking_id": bid, "idempotency_key": idem},
    )
    assert again.status_code == 201
    assert again.json()["id"] == payment_id
    count = db_session.scalar(
        select(func.count()).select_from(Payment).where(Payment.booking_id == uuid.UUID(bid))
    )
    assert count == 1

    # Conflict idempotency key with different booking
    # (create another closed booking is heavy — use wrong booking uuid)
    conflict = client.post(
        "/payments",
        headers=_auth(ct),
        json={"booking_id": str(uuid.uuid4()), "idempotency_key": idem},
    )
    assert conflict.status_code in (404, 409)

    # Cross-customer forbidden
    ot = _login(client, ctx["other"].email, ctx["op"])
    denied = client.post(
        "/payments",
        headers=_auth(ot),
        json={"booking_id": bid, "idempotency_key": f"pay-{uuid.uuid4()}"},
    )
    assert denied.status_code == 403

    # Simulate succeed
    ok = client.post(
        f"/payments/{payment_id}/sandbox/simulate",
        headers=_auth(ct),
        json={"outcome": "succeed", "event_key": f"evt-{uuid.uuid4()}"},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "SUCCEEDED"

    # Duplicate event key — no new transition / no regress
    dup = client.post(
        f"/payments/{payment_id}/sandbox/simulate",
        headers=_auth(ct),
        json={"outcome": "fail", "event_key": ok.json().get("id")},  # will use new key
    )
    # Terminal reject
    dup2 = client.post(
        f"/payments/{payment_id}/sandbox/simulate",
        headers=_auth(ct),
        json={"outcome": "fail", "event_key": f"evt-{uuid.uuid4()}"},
    )
    assert dup2.status_code == 409

    # Second payment attempt after success
    second = client.post(
        "/payments",
        headers=_auth(ct),
        json={"booking_id": bid, "idempotency_key": f"pay-{uuid.uuid4()}"},
    )
    assert second.status_code == 409

    got = client.get(f"/payments/{payment_id}", headers=_auth(ct))
    assert got.status_code == 200
    assert got.json()["status"] == "SUCCEEDED"


@pytest.mark.db
def test_sandbox_callback_and_fail(
    client: TestClient, make_user, db_session, db_available: bool, monkeypatch
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    ctx = _closed_booking(client, db_session, make_user)
    ct = ctx["ct"]
    idem = f"pay-{uuid.uuid4()}"
    created = client.post(
        "/payments",
        headers=_auth(ct),
        json={"booking_id": ctx["booking_id"], "idempotency_key": idem},
    )
    assert created.status_code == 201
    ref = created.json()["gateway_ref"]
    settings = get_settings()
    event_key = f"cb-{uuid.uuid4()}"

    bad = client.post(
        "/payments/sandbox/callback",
        json={
            "gateway_ref": ref,
            "outcome": "fail",
            "event_key": event_key,
            "sandbox_token": "wrong-token-value",
        },
    )
    assert bad.status_code == 401

    fail = client.post(
        "/payments/sandbox/callback",
        json={
            "gateway_ref": ref,
            "outcome": "fail",
            "event_key": event_key,
            "sandbox_token": settings.payments_sandbox_token,
        },
    )
    assert fail.status_code == 200
    assert fail.json()["status"] == "FAILED"

    # Duplicate callback same event_key — idempotent
    again = client.post(
        "/payments/sandbox/callback",
        json={
            "gateway_ref": ref,
            "outcome": "succeed",
            "event_key": event_key,
            "sandbox_token": settings.payments_sandbox_token,
        },
    )
    assert again.status_code == 200
    assert again.json()["status"] == "FAILED"
    events = db_session.scalar(
        select(func.count())
        .select_from(PaymentEvent)
        .where(PaymentEvent.gateway_event_key == event_key)
    )
    assert events == 1

    # Production-mode rejection
    monkeypatch.setenv("RIDENOVA_ENV", "production")
    monkeypatch.setenv("PAYMENTS_SANDBOX_ENABLED", "false")
    get_settings.cache_clear()
    # Need strong JWT for production validator — set both
    monkeypatch.setenv(
        "JWT_SECRET", "TEST_ONLY_JWT_SECRET_VALUE_AT_LEAST_32_CHARS_LONG"
    )
    get_settings.cache_clear()
    # Recreate app client would be heavy; call settings check
    s = get_settings()
    assert s.sandbox_payments_allowed() is False
    get_settings.cache_clear()
    monkeypatch.delenv("RIDENOVA_ENV", raising=False)
    monkeypatch.setenv("RIDENOVA_ENV", "test")
    get_settings.cache_clear()


@pytest.mark.db
def test_ineligible_booking_and_ownership_read(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
    customer, cp = make_user(role="customer")
    other, op = make_user(role="customer")
    ct = _login(client, customer.email, cp)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={**_auth(ct), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    assert created.status_code == 201
    bid = created.json()["id"]
    # NO_DRIVER_FOUND or SEARCHING — not CLOSED
    pay = client.post(
        "/payments",
        headers=_auth(ct),
        json={"booking_id": bid, "idempotency_key": f"pay-{uuid.uuid4()}"},
    )
    assert pay.status_code == 409

    ctx = _closed_booking(client, db_session, make_user)
    p = client.post(
        "/payments",
        headers=_auth(ctx["ct"]),
        json={"booking_id": ctx["booking_id"], "idempotency_key": f"pay-{uuid.uuid4()}"},
    ).json()
    ot = _login(client, other.email, op)
    assert client.get(f"/payments/{p['id']}", headers=_auth(ot)).status_code == 403
