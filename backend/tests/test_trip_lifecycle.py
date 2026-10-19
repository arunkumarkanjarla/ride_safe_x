"""Phase 7 — trip lifecycle ownership, idempotency, concurrency, customer sync."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update

from app.models import BookingEvent, DriverAvailability, TripAssignment
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


def _accept_trip(client, db_session, make_user):
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
    customer, cp = make_user(role="customer")
    driver, dp = make_user(role="driver")
    other_driver, odp = make_user(role="driver")
    profile = get_or_create_driver_profile(db_session, driver.id)
    set_availability(db_session, profile, is_online=True, lat=17.385, lon=78.4867)
    get_or_create_driver_profile(db_session, other_driver.id)

    ct = _login(client, customer.email, cp)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={**_auth(ct), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    assert created.status_code == 201, created.text
    booking_id = created.json()["id"]

    dt = _login(client, driver.email, dp)
    offers = client.get("/drivers/me/offers", headers=_auth(dt)).json()["items"]
    assert offers
    accept = client.post(
        f"/drivers/me/offers/{offers[0]['id']}/accept",
        headers=_auth(dt),
        json={},
    )
    assert accept.status_code == 200, accept.text
    return {
        "booking_id": booking_id,
        "customer": customer,
        "cp": cp,
        "ct": ct,
        "driver": driver,
        "dp": dp,
        "dt": dt,
        "other_driver": other_driver,
        "odp": odp,
        "profile": profile,
    }


@pytest.mark.db
def test_driver_lifecycle_and_active_trip(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    ctx = _accept_trip(client, db_session, make_user)
    bid = ctx["booking_id"]
    dt = ctx["dt"]

    active = client.get("/drivers/me/active-trip", headers=_auth(dt))
    assert active.status_code == 200, active.text
    body = active.json()
    assert body["booking"]["id"] == bid
    assert body["next_action"] == "driver.en_route"
    assert body["action_label"]
    assert "pickup_lat" in body["booking"]

    for action, expected_next in (
        ("driver.en_route", "driver.arrived"),
        ("driver.arrived", "trip.start"),
        ("trip.start", "trip.end"),
        ("trip.end", None),
    ):
        tr = client.post(
            f"/bookings/{bid}/transition",
            headers=_auth(dt),
            json={"action": action},
        )
        assert tr.status_code == 200, tr.text
        active = client.get("/drivers/me/active-trip", headers=_auth(dt)).json()
        if action == "trip.end":
            assert tr.json()["status"] == "CLOSED"
            assert active["assignment"] is None or active["assignment"]["status"] != "ACTIVE"
            assert active["next_action"] is None
        else:
            assert active["next_action"] == expected_next

    # Assignment completed + duty released
    asg = db_session.scalar(
        select(TripAssignment).where(TripAssignment.booking_id == uuid.UUID(bid))
    )
    assert asg is not None
    assert asg.status == "COMPLETED"
    db_session.expire_all()
    avail = db_session.get(DriverAvailability, ctx["profile"].id)
    assert avail is not None
    assert avail.duty_status == "available"

    trips = client.get("/drivers/me/trips", headers=_auth(dt)).json()["items"]
    assert any(t["id"] == bid and t["status"] == "CLOSED" for t in trips)


@pytest.mark.db
def test_ownership_and_customer_denied_transition(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    ctx = _accept_trip(client, db_session, make_user)
    bid = ctx["booking_id"]

    ot = _login(client, ctx["other_driver"].email, ctx["odp"])
    denied = client.post(
        f"/bookings/{bid}/transition",
        headers=_auth(ot),
        json={"action": "driver.en_route"},
    )
    assert denied.status_code == 403

    cust = client.post(
        f"/bookings/{bid}/transition",
        headers=_auth(ctx["ct"]),
        json={"action": "driver.en_route"},
    )
    assert cust.status_code in (401, 403)


@pytest.mark.db
def test_invalid_and_idempotent_transitions(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    ctx = _accept_trip(client, db_session, make_user)
    bid = ctx["booking_id"]
    dt = ctx["dt"]

    bad = client.post(
        f"/bookings/{bid}/transition",
        headers=_auth(dt),
        json={"action": "trip.end"},
    )
    assert bad.status_code == 409
    assert bad.json()["detail"]["error"] == "invalid_transition"

    first = client.post(
        f"/bookings/{bid}/transition",
        headers=_auth(dt),
        json={"action": "driver.en_route"},
    )
    assert first.status_code == 200
    count_after = db_session.scalar(
        select(func.count()).select_from(BookingEvent).where(
            BookingEvent.booking_id == uuid.UUID(bid)
        )
    )

    dup = client.post(
        f"/bookings/{bid}/transition",
        headers=_auth(dt),
        json={"action": "driver.en_route"},
    )
    assert dup.status_code == 200
    assert dup.json()["status"] == "DRIVER_ARRIVING"
    count_dup = db_session.scalar(
        select(func.count()).select_from(BookingEvent).where(
            BookingEvent.booking_id == uuid.UUID(bid)
        )
    )
    assert count_dup == count_after

    # Complete then duplicate complete
    for action in ("driver.arrived", "trip.start", "trip.end"):
        assert (
            client.post(
                f"/bookings/{bid}/transition",
                headers=_auth(dt),
                json={"action": action},
            ).status_code
            == 200
        )
    count_closed = db_session.scalar(
        select(func.count()).select_from(BookingEvent).where(
            BookingEvent.booking_id == uuid.UUID(bid)
        )
    )
    again = client.post(
        f"/bookings/{bid}/transition",
        headers=_auth(dt),
        json={"action": "trip.end"},
    )
    assert again.status_code == 200
    assert again.json()["status"] == "CLOSED"
    count_again = db_session.scalar(
        select(func.count()).select_from(BookingEvent).where(
            BookingEvent.booking_id == uuid.UUID(bid)
        )
    )
    assert count_again == count_closed


@pytest.mark.db
def test_customer_summary_tracks_lifecycle(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    ctx = _accept_trip(client, db_session, make_user)
    bid = ctx["booking_id"]
    ct = ctx["ct"]
    dt = ctx["dt"]

    for action, status in (
        ("driver.en_route", "DRIVER_ARRIVING"),
        ("driver.arrived", "DRIVER_ARRIVED"),
        ("trip.start", "TRIP_STARTED"),
        ("trip.end", "CLOSED"),
    ):
        assert (
            client.post(
                f"/bookings/{bid}/transition",
                headers=_auth(dt),
                json={"action": action},
            ).status_code
            == 200
        )
        summary = client.get(f"/bookings/{bid}/summary", headers=_auth(ct))
        assert summary.status_code == 200
        body = summary.json()
        assert body["booking"]["status"] == status
        if status == "TRIP_STARTED":
            assert body["can_cancel"] is False
        dumped = summary.text.lower()
        assert "last_lat" not in dumped
        assert "email" not in body.get("assigned_driver", {}) or body["assigned_driver"] is None


@pytest.mark.db
def test_cancel_vs_start_ordering(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    """Cancel and start cannot both succeed into contradictory terminals.

    Uses sequential locked paths (deterministic) rather than threaded TestClient,
    which is not thread-safe and can hang under concurrent HTTP.
    """
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")

    # Path A: start first → cancel rejected
    ctx_a = _accept_trip(client, db_session, make_user)
    bid_a = ctx_a["booking_id"]
    for action in ("driver.en_route", "driver.arrived", "trip.start"):
        assert (
            client.post(
                f"/bookings/{bid_a}/transition",
                headers=_auth(ctx_a["dt"]),
                json={"action": action},
            ).status_code
            == 200
        )
    cancel_a = client.post(
        f"/bookings/{bid_a}/cancel",
        headers=_auth(ctx_a["ct"]),
        json={"reason": "late"},
    )
    assert cancel_a.status_code == 409
    assert client.get(f"/bookings/{bid_a}", headers=_auth(ctx_a["ct"])).json()["status"] == (
        "TRIP_STARTED"
    )

    # Path B: cancel first → start rejected
    ctx_b = _accept_trip(client, db_session, make_user)
    bid_b = ctx_b["booking_id"]
    for action in ("driver.en_route", "driver.arrived"):
        assert (
            client.post(
                f"/bookings/{bid_b}/transition",
                headers=_auth(ctx_b["dt"]),
                json={"action": action},
            ).status_code
            == 200
        )
    cancel_b = client.post(
        f"/bookings/{bid_b}/cancel",
        headers=_auth(ctx_b["ct"]),
        json={"reason": "first"},
    )
    assert cancel_b.status_code == 200
    assert cancel_b.json()["status"] == "CANCELLED"
    start_b = client.post(
        f"/bookings/{bid_b}/transition",
        headers=_auth(ctx_b["dt"]),
        json={"action": "trip.start"},
    )
    assert start_b.status_code == 409
    assert client.get(f"/bookings/{bid_b}", headers=_auth(ctx_b["ct"])).json()["status"] == (
        "CANCELLED"
    )
