"""Dispatch eligibility, accept/reject, expiry tests."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.domain import booking_states as st
from app.models import DriverAvailability, DriverOffer
from app.services.dispatch import (
    dispatch_booking,
    expire_due_offers,
    get_or_create_driver_profile,
    set_availability,
)


def _offline_all_drivers(db) -> None:
    db.execute(update(DriverAvailability).values(is_online=False))
    db.commit()


def _login(client: TestClient, email: str, password: str) -> dict:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


def _auth(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


BOOKING_BODY = {
    "pickup_lat": 17.385,
    "pickup_lon": 78.4867,
    "drop_lat": 17.448,
    "drop_lon": 78.391,
    "vehicle_type": "Cab",
}


@pytest.mark.db
def test_offline_driver_not_offered(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    _offline_all_drivers(db_session)
    customer, cp = make_user(role="customer")
    driver, _dp = make_user(role="driver")
    profile = get_or_create_driver_profile(db_session, driver.id)
    set_availability(db_session, profile, is_online=False, lat=17.385, lon=78.4867)

    tokens = _login(client, customer.email, cp)
    key = f"idem-{uuid.uuid4()}"
    res = client.post(
        "/bookings",
        headers={**_auth(tokens), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    assert res.status_code == 201
    assert res.json()["status"] == "NO_DRIVER_FOUND"
    offers = db_session.scalars(
        select(DriverOffer).where(DriverOffer.driver_profile_id == profile.id)
    ).all()
    assert offers == []


@pytest.mark.db
def test_eligible_driver_gets_offer_and_accept(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    _offline_all_drivers(db_session)
    customer, cp = make_user(role="customer")
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
    assert created.json()["status"] == "DRIVER_ASSIGNED"
    booking_id = created.json()["id"]

    dt = _login(client, driver.email, dp)
    offers = client.get("/drivers/me/offers", headers=_auth(dt))
    assert offers.status_code == 200
    items = [o for o in offers.json()["items"] if o["booking_id"] == booking_id]
    assert len(items) >= 1

    accepted = client.post(
        f"/drivers/me/offers/{items[0]['id']}/accept",
        headers=_auth(dt),
        json={},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["booking"]["status"] == "DRIVER_ACCEPTED"

    # lifecycle
    for action in ("driver.en_route", "driver.arrived", "trip.start", "trip.end"):
        tr = client.post(
            f"/bookings/{booking_id}/transition",
            headers=_auth(dt),
            json={"action": action},
        )
        assert tr.status_code == 200, tr.text
    assert tr.json()["status"] == "CLOSED"


@pytest.mark.db
def test_reject_retries_or_exhausts(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    _offline_all_drivers(db_session)
    customer, cp = make_user(role="customer")
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
    dt = _login(client, driver.email, dp)
    offers = client.get("/drivers/me/offers", headers=_auth(dt)).json()["items"]
    assert offers
    rejected = client.post(
        f"/drivers/me/offers/{offers[0]['id']}/reject",
        headers=_auth(dt),
        json={},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "DECLINED"


@pytest.mark.db
def test_offer_expiry(db_session, make_user, db_available: bool) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    _offline_all_drivers(db_session)
    customer, _ = make_user(role="customer")
    driver, _ = make_user(role="driver")
    profile = get_or_create_driver_profile(db_session, driver.id)
    set_availability(db_session, profile, is_online=True, lat=17.385, lon=78.4867)

    from app.services.booking import create_booking

    booking, _ = create_booking(
        db_session,
        customer_id=customer.id,
        pickup_lat=17.385,
        pickup_lon=78.4867,
        drop_lat=17.448,
        drop_lon=78.391,
        vehicle_type="Cab",
        idempotency_key=f"idem-{uuid.uuid4()}",
    )
    dispatch_booking(db_session, booking.id)
    offer = db_session.scalar(
        select(DriverOffer).where(DriverOffer.booking_id == booking.id)
    )
    assert offer is not None
    offer.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    expired = expire_due_offers(db_session, booking_id=booking.id, commit=True)
    assert expired >= 1
    db_session.refresh(offer)
    assert offer.status == st.OFFER_EXPIRED


@pytest.mark.db
def test_cross_driver_offer_forbidden(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    _offline_all_drivers(db_session)
    customer, cp = make_user(role="customer")
    d1, p1 = make_user(role="driver")
    d2, p2 = make_user(role="driver")
    profile = get_or_create_driver_profile(db_session, d1.id)
    set_availability(db_session, profile, is_online=True, lat=17.385, lon=78.4867)

    ct = _login(client, customer.email, cp)
    key = f"idem-{uuid.uuid4()}"
    client.post(
        "/bookings",
        headers={**_auth(ct), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    t1 = _login(client, d1.email, p1)
    offer_id = client.get("/drivers/me/offers", headers=_auth(t1)).json()["items"][0]["id"]
    t2 = _login(client, d2.email, p2)
    denied = client.post(
        f"/drivers/me/offers/{offer_id}/accept",
        headers=_auth(t2),
        json={},
    )
    assert denied.status_code == 403
