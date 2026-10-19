"""Phase 6 customer trip summary authorization tests."""

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


def _auth(t: dict) -> dict:
    return {"Authorization": f"Bearer {t['access_token']}"}


BOOKING_BODY = {
    "pickup_lat": 17.385,
    "pickup_lon": 78.4867,
    "drop_lat": 17.448,
    "drop_lon": 78.391,
    "vehicle_type": "Cab",
}


@pytest.mark.db
def test_customer_trip_summary_and_idor(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()

    customer, cp = make_user(role="customer")
    other, op = make_user(role="customer")
    driver, dp = make_user(role="driver", name="Safe Driver")
    profile = get_or_create_driver_profile(db_session, driver.id)
    set_availability(db_session, profile, is_online=True, lat=17.385, lon=78.4867)

    ct = _login(client, customer.email, cp)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={**_auth(ct), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    assert created.status_code == 201
    booking_id = created.json()["id"]

    dt = _login(client, driver.email, dp)
    offers = client.get("/drivers/me/offers", headers=_auth(dt)).json()["items"]
    assert offers
    accept = client.post(
        f"/drivers/me/offers/{offers[0]['id']}/accept",
        headers=_auth(dt),
        json={},
    )
    assert accept.status_code == 200

    summary = client.get(f"/bookings/{booking_id}/summary", headers=_auth(ct))
    assert summary.status_code == 200, summary.text
    body = summary.json()
    assert body["booking"]["id"] == booking_id
    assert body["can_cancel"] is True
    assert body["assigned_driver"]["display_name"] == "Safe Driver"
    assert body["assigned_driver"]["vehicle_type"] == "Cab"
    # No driver coordinates in customer summary
    dumped = summary.text.lower()
    assert "last_lat" not in dumped
    assert "email" not in body.get("assigned_driver", {})

    ot = _login(client, other.email, op)
    denied = client.get(f"/bookings/{booking_id}/summary", headers=_auth(ot))
    assert denied.status_code == 403

    # Customer cannot call ops
    assert client.get("/ops/bookings", headers=_auth(ct)).status_code == 403
