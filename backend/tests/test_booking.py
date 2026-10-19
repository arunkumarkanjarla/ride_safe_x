"""Booking create / ownership / idempotency / cancel tests."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> dict:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


def _headers(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


BOOKING_BODY = {
    "pickup_lat": 17.385,
    "pickup_lon": 78.4867,
    "drop_lat": 17.448,
    "drop_lon": 78.391,
    "vehicle_type": "Cab",
}


@pytest.mark.db
def test_booking_create_and_history(
    client: TestClient, make_user, db_available: bool
) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, password = make_user(role="customer")
    tokens = _login(client, user.email, password)
    key = f"idem-{uuid.uuid4()}"
    body = {**BOOKING_BODY, "idempotency_key": key}
    res = client.post("/bookings", headers={**_headers(tokens), "Idempotency-Key": key}, json=body)
    assert res.status_code == 201, res.text
    booking = res.json()
    assert booking["customer_id"] == str(user.id)
    assert booking["estimate_paise"] > 0
    assert booking["status"] in (
        "SEARCHING_DRIVER",
        "DRIVER_ASSIGNED",
        "NO_DRIVER_FOUND",
    )

    again = client.post(
        "/bookings", headers={**_headers(tokens), "Idempotency-Key": key}, json=body
    )
    assert again.status_code == 201
    assert again.json()["id"] == booking["id"]

    conflict = client.post(
        "/bookings",
        headers={**_headers(tokens), "Idempotency-Key": key},
        json={**body, "drop_lat": 17.5},
    )
    assert conflict.status_code == 409

    hist = client.get("/bookings", headers=_headers(tokens))
    assert hist.status_code == 200
    assert any(b["id"] == booking["id"] for b in hist.json()["items"])


@pytest.mark.db
def test_cross_customer_denied(
    client: TestClient, make_user, db_available: bool
) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    a, pa = make_user(role="customer")
    b, pb = make_user(role="customer")
    ta = _login(client, a.email, pa)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={**_headers(ta), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    assert created.status_code == 201
    booking_id = created.json()["id"]

    tb = _login(client, b.email, pb)
    denied = client.get(f"/bookings/{booking_id}", headers=_headers(tb))
    assert denied.status_code == 403


@pytest.mark.db
def test_cancel_rules(client: TestClient, make_user, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, password = make_user(role="customer")
    tokens = _login(client, user.email, password)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={**_headers(tokens), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    booking_id = created.json()["id"]
    cancelled = client.post(
        f"/bookings/{booking_id}/cancel",
        headers=_headers(tokens),
        json={"reason": "changed_mind"},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "CANCELLED"

    again = client.post(
        f"/bookings/{booking_id}/cancel",
        headers=_headers(tokens),
        json={"reason": "again"},
    )
    assert again.status_code == 409


@pytest.mark.db
def test_resync(client: TestClient, make_user, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, password = make_user(role="customer")
    tokens = _login(client, user.email, password)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={**_headers(tokens), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    booking_id = created.json()["id"]
    resync = client.get(f"/bookings/{booking_id}/resync", headers=_headers(tokens))
    assert resync.status_code == 200
    body = resync.json()
    assert body["booking"]["id"] == booking_id
    assert len(body["events"]) >= 1
