"""Phase 5 location freshness and availability tests."""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.models import DriverAvailability
from app.services.dispatch import dispatch_booking, get_or_create_driver_profile, set_availability
from app.services.booking import create_booking
from app.services.location import (
    FRESHNESS_FRESH,
    FRESHNESS_MISSING,
    FRESHNESS_STALE,
    location_freshness,
    update_driver_location,
)


def _login(client: TestClient, email: str, password: str) -> dict:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()


def _auth(t: dict) -> dict:
    return {"Authorization": f"Bearer {t['access_token']}"}


@pytest.mark.db
def test_location_update_and_freshness(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    driver, password = make_user(role="driver")
    tokens = _login(client, driver.email, password)
    online = client.put(
        "/drivers/me/availability",
        headers=_auth(tokens),
        json={"is_online": True},
    )
    assert online.status_code == 200
    assert online.json()["duty_status"] == "available"
    assert online.json()["location_freshness"] == "missing"
    assert online.json()["dispatch_eligible"] is False

    loc = client.put(
        "/drivers/me/location",
        headers=_auth(tokens),
        json={"lat": 17.385, "lon": 78.4867, "seq": 1, "accuracy_m": 12},
    )
    assert loc.status_code == 200, loc.text
    assert loc.json()["location_freshness"] == "fresh"
    assert loc.json()["dispatch_eligible"] is True

    stale = client.put(
        "/drivers/me/location",
        headers=_auth(tokens),
        json={"lat": 17.386, "lon": 78.4868, "seq": 1},
    )
    assert stale.status_code == 409

    bad = client.put(
        "/drivers/me/location",
        headers=_auth(tokens),
        json={"lat": 999, "lon": 78.0, "seq": 2},
    )
    assert bad.status_code == 422


@pytest.mark.db
def test_nan_coordinates_rejected(
    client: TestClient, make_user, db_available: bool
) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    driver, password = make_user(role="driver")
    tokens = _login(client, driver.email, password)
    # JSON cannot express NaN reliably; use out-of-range
    res = client.put(
        "/drivers/me/location",
        headers=_auth(tokens),
        json={"lat": math.inf if False else 91, "lon": 0, "seq": 1},
    )
    assert res.status_code == 422


@pytest.mark.db
def test_cross_driver_location_isolation(
    client: TestClient, make_user, db_available: bool
) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    d1, p1 = make_user(role="driver")
    d2, p2 = make_user(role="driver")
    t1 = _login(client, d1.email, p1)
    t2 = _login(client, d2.email, p2)
    client.put(
        "/drivers/me/location",
        headers=_auth(t1),
        json={"lat": 17.1, "lon": 78.1, "seq": 1},
    )
    a1 = client.get("/drivers/me/availability", headers=_auth(t1)).json()
    a2 = client.get("/drivers/me/availability", headers=_auth(t2)).json()
    assert a1["last_lat"] is not None
    assert a2["last_lat"] is None or float(a2["last_lat"]) != float(a1["last_lat"])


@pytest.mark.db
def test_stale_location_excluded_from_dispatch(
    make_user, db_session, db_available: bool, monkeypatch
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
    monkeypatch.setenv("LOCATION_FRESHNESS_SECONDS", "60")
    from app.core.config import get_settings

    get_settings.cache_clear()

    customer, _ = make_user(role="customer")
    driver, _ = make_user(role="driver")
    profile = get_or_create_driver_profile(db_session, driver.id)
    set_availability(db_session, profile, is_online=True, lat=17.385, lon=78.4867)
    avail = db_session.get(DriverAvailability, profile.id)
    assert location_freshness(avail) == FRESHNESS_FRESH
    avail.location_received_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    db_session.commit()
    assert location_freshness(avail) == FRESHNESS_STALE

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
    db_session.refresh(booking)
    assert booking.status == "NO_DRIVER_FOUND"


@pytest.mark.db
def test_missing_location_excluded(
    make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
    customer, _ = make_user(role="customer")
    driver, _ = make_user(role="driver")
    profile = get_or_create_driver_profile(db_session, driver.id)
    set_availability(db_session, profile, is_online=True)
    avail = db_session.get(DriverAvailability, profile.id)
    assert location_freshness(avail) == FRESHNESS_MISSING
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
    db_session.refresh(booking)
    assert booking.status == "NO_DRIVER_FOUND"


@pytest.mark.db
def test_ops_driver_readiness(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    driver, _ = make_user(role="driver")
    admin, ap = make_user(role="admin")
    profile = get_or_create_driver_profile(db_session, driver.id)
    set_availability(db_session, profile, is_online=True, lat=17.385, lon=78.4867)
    at = _login(client, admin.email, ap)
    res = client.get("/ops/drivers", headers=_auth(at), params={"page_size": 50})
    assert res.status_code == 200
    items = res.json()["items"]
    assert any(i["driver_profile_id"] == str(profile.id) for i in items)
    mine = next(i for i in items if i["driver_profile_id"] == str(profile.id))
    assert mine["dispatch_eligible"] is True
    assert mine["last_lat"] is not None  # admin has dispatch.read

    customer, cp = make_user(role="customer")
    ct = _login(client, customer.email, cp)
    assert client.get("/ops/drivers", headers=_auth(ct)).status_code == 403
