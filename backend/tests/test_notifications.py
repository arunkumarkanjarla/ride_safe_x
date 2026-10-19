"""Phase 8 — in-app notifications persistence, ownership, idempotency."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update

from app.models import DriverAvailability, Notification, OutboxEvent
from app.services.dispatch import get_or_create_driver_profile, set_availability
from app.services.notifications import materialize_notifications, process_pending_notifications


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


@pytest.mark.db
def test_notifications_from_booking_lifecycle(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()

    customer, cp = make_user(role="customer")
    driver, dp = make_user(role="driver")
    other, op = make_user(role="customer")
    admin, ap = make_user(role="admin")
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

    # Materialize any pending (inline path may already have run)
    process_pending_notifications(db_session, limit=50)

    mine = client.get("/notifications", headers=_auth(ct))
    assert mine.status_code == 200, mine.text
    titles = [n["title"] for n in mine.json()["items"]]
    assert any("Booking" in t or "requested" in t.lower() for t in titles)

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
    process_pending_notifications(db_session, limit=50)

    cust_notes = client.get("/notifications", headers=_auth(ct)).json()["items"]
    assert any("assigned" in n["title"].lower() or "Driver" in n["title"] for n in cust_notes)

    drv_notes = client.get("/notifications", headers=_auth(dt)).json()["items"]
    assert any("offer" in n["title"].lower() or "Assignment" in n["title"] for n in drv_notes)

    # Cross-user denied
    ot = _login(client, other.email, op)
    other_list = client.get("/notifications", headers=_auth(ot)).json()["items"]
    assert all(n.get("booking_id") != booking_id or True for n in other_list)
    # Other customer must not see this booking's notifications
    assert not any(n.get("booking_id") == booking_id for n in other_list)

    if cust_notes:
        forbidden = client.post(
            f"/notifications/{cust_notes[0]['id']}/read",
            headers=_auth(ot),
        )
        assert forbidden.status_code in (403, 404)

    # Mark read + unread count
    unread = client.get("/notifications/unread-count", headers=_auth(ct)).json()["unread_count"]
    assert unread >= 1
    target = next(n for n in cust_notes if n["read_at"] is None)
    marked = client.post(f"/notifications/{target['id']}/read", headers=_auth(ct))
    assert marked.status_code == 200
    assert marked.json()["read_at"] is not None
    unread2 = client.get("/notifications/unread-count", headers=_auth(ct)).json()["unread_count"]
    assert unread2 == unread - 1

    # Ops health
    at = _login(client, admin.email, ap)
    health = client.get("/ops/notifications/health", headers=_auth(at))
    assert health.status_code == 200
    assert "pending_notification_events" in health.json()

    # Customer cannot see ops health
    assert client.get("/ops/notifications/health", headers=_auth(ct)).status_code == 403


@pytest.mark.db
def test_duplicate_materialize_idempotent(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
    customer, cp = make_user(role="customer")
    ct = _login(client, customer.email, cp)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={**_auth(ct), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    assert created.status_code == 201
    # Force re-process: clear processed flag and re-run
    events = list(db_session.scalars(select(OutboxEvent)).all())
    assert events
    for ev in events:
        ev.notifications_processed_at = None
    db_session.commit()

    before = db_session.scalar(select(func.count()).select_from(Notification)) or 0
    for ev in db_session.scalars(select(OutboxEvent)).all():
        if ev.notifications_processed_at is None:
            materialize_notifications(db_session, ev, emit_ws=False)
    db_session.commit()
    mid = db_session.scalar(select(func.count()).select_from(Notification)) or 0

    for ev in db_session.scalars(select(OutboxEvent)).all():
        ev.notifications_processed_at = None
    db_session.commit()
    for ev in db_session.scalars(select(OutboxEvent)).all():
        if ev.notifications_processed_at is None:
            materialize_notifications(db_session, ev, emit_ws=False)
    db_session.commit()
    after = db_session.scalar(select(func.count()).select_from(Notification)) or 0
    assert after == mid
    assert mid >= before


@pytest.mark.db
def test_bulk_and_pagination(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
    customer, cp = make_user(role="customer")
    ct = _login(client, customer.email, cp)
    for _ in range(3):
        key = f"idem-{uuid.uuid4()}"
        assert (
            client.post(
                "/bookings",
                headers={**_auth(ct), "Idempotency-Key": key},
                json={**BOOKING_BODY, "idempotency_key": key},
            ).status_code
            == 201
        )
    process_pending_notifications(db_session, limit=50)

    page = client.get("/notifications?page=1&page_size=2", headers=_auth(ct))
    assert page.status_code == 200
    body = page.json()
    assert len(body["items"]) <= 2
    assert body["page_size"] == 2
    assert body["total"] >= 2

    ids = [n["id"] for n in client.get("/notifications", headers=_auth(ct)).json()["items"][:2]]
    bulk = client.post(
        "/notifications/read-bulk",
        headers=_auth(ct),
        json={"ids": ids},
    )
    assert bulk.status_code == 200
    assert bulk.json()["marked"] >= 1
