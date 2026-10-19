"""WebSocket auth and subscription authorization tests."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.models import DriverAvailability
from app.services.dispatch import get_or_create_driver_profile, set_availability


def _login(client: TestClient, email: str, password: str) -> dict:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()


BOOKING_BODY = {
    "pickup_lat": 17.385,
    "pickup_lon": 78.4867,
    "drop_lat": 17.448,
    "drop_lon": 78.391,
    "vehicle_type": "Cab",
}


@pytest.mark.db
def test_ws_requires_auth(client: TestClient, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    with pytest.raises(Exception):
        with client.websocket_connect("/ws"):
            pass


@pytest.mark.db
def test_ws_subscribe_own_booking(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
    customer, cp = make_user(role="customer")
    driver, _ = make_user(role="driver")
    profile = get_or_create_driver_profile(db_session, driver.id)
    set_availability(db_session, profile, is_online=True, lat=17.385, lon=78.4867)

    tokens = _login(client, customer.email, cp)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={
            "Authorization": f"Bearer {tokens['access_token']}",
            "Idempotency-Key": key,
        },
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    booking_id = created.json()["id"]

    with client.websocket_connect(
        f"/ws?token={tokens['access_token']}"
    ) as ws:
        hello = ws.receive_json()
        assert hello["event_type"] == "ws.connected"
        ws.send_json({"action": "subscribe.booking", "booking_id": booking_id})
        sub = ws.receive_json()
        assert sub["event_type"] == "ws.subscribed"


@pytest.mark.db
def test_ws_cross_customer_denied(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    a, pa = make_user(role="customer")
    b, pb = make_user(role="customer")
    tokens_a = _login(client, a.email, pa)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={
            "Authorization": f"Bearer {tokens_a['access_token']}",
            "Idempotency-Key": key,
        },
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    booking_id = created.json()["id"]
    tokens_b = _login(client, b.email, pb)

    with client.websocket_connect(
        f"/ws?token={tokens_b['access_token']}"
    ) as ws:
        ws.receive_json()
        ws.send_json({"action": "subscribe.booking", "booking_id": booking_id})
        msg = ws.receive_json()
        assert msg.get("error") == "forbidden"
