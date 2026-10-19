"""Phase 4 operations / dispatch center API tests."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.models import AuditEvent, DriverAvailability
from app.services.dispatch import get_or_create_driver_profile, set_availability


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
def test_ops_list_requires_permission(
    client: TestClient, make_user, db_available: bool
) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, password = make_user(role="customer")
    tokens = _login(client, user.email, password)
    res = client.get("/ops/bookings", headers=_auth(tokens))
    assert res.status_code == 403


@pytest.mark.db
def test_ops_summary_list_detail_pagination(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()

    customer, cp = make_user(role="customer")
    admin, ap = make_user(role="admin")
    ct = _login(client, customer.email, cp)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={**_auth(ct), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    assert created.status_code == 201, created.text
    booking_id = created.json()["id"]

    at = _login(client, admin.email, ap)
    summary = client.get("/ops/bookings/summary", headers=_auth(at))
    assert summary.status_code == 200
    assert summary.json()["total"] >= 1

    listed = client.get(
        "/ops/bookings",
        headers=_auth(at),
        params={"page": 1, "page_size": 5, "q": booking_id},
    )
    assert listed.status_code == 200
    body = listed.json()
    assert body["page_size"] == 5
    assert body["total"] >= 1
    assert any(i["id"] == booking_id for i in body["items"])
    assert len(body["items"]) <= 5

    detail = client.get(f"/ops/bookings/{booking_id}", headers=_auth(at))
    assert detail.status_code == 200
    d = detail.json()
    assert d["id"] == booking_id
    assert "events" in d
    assert isinstance(d["offers"], list)
    assert d["customer_email"] == customer.email
    assert d.get("unassigned_reason") is not None or d["status"] != "NO_DRIVER_FOUND"


@pytest.mark.db
def test_support_agent_cannot_retry_or_cancel(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
    customer, cp = make_user(role="customer")
    agent, agp = make_user(role="support_agent")
    ct = _login(client, customer.email, cp)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={**_auth(ct), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    booking_id = created.json()["id"]
    at = _login(client, agent.email, agp)
    assert client.get("/ops/bookings", headers=_auth(at)).status_code == 200
    assert (
        client.post(
            f"/ops/bookings/{booking_id}/dispatch-retry",
            headers=_auth(at),
            json={},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/ops/bookings/{booking_id}/cancel",
            headers=_auth(at),
            json={"reason": "nope"},
        ).status_code
        == 403
    )


@pytest.mark.db
def test_ops_retry_and_cancel(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()

    customer, cp = make_user(role="customer")
    admin, ap = make_user(role="admin")
    ct = _login(client, customer.email, cp)
    key = f"idem-{uuid.uuid4()}"
    created = client.post(
        "/bookings",
        headers={**_auth(ct), "Idempotency-Key": key},
        json={**BOOKING_BODY, "idempotency_key": key},
    )
    booking_id = created.json()["id"]
    assert created.json()["status"] == "NO_DRIVER_FOUND"

    at = _login(client, admin.email, ap)
    driver, _dp = make_user(role="driver")
    profile = get_or_create_driver_profile(db_session, driver.id)
    set_availability(db_session, profile, is_online=True, lat=17.385, lon=78.4867)

    retry = client.post(
        f"/ops/bookings/{booking_id}/dispatch-retry",
        headers=_auth(at),
        json={},
    )
    assert retry.status_code == 200, retry.text
    assert retry.json()["status"] in (
        "DRIVER_ASSIGNED",
        "NO_DRIVER_FOUND",
        "SEARCHING_DRIVER",
    )

    denied = client.post(
        f"/ops/bookings/{booking_id}/dispatch-retry",
        headers=_auth(ct),
        json={},
    )
    assert denied.status_code == 403

    cancel = client.post(
        f"/ops/bookings/{booking_id}/cancel",
        headers=_auth(at),
        json={"reason": "ops_test_cancel"},
    )
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "CANCELLED"

    again = client.post(
        f"/ops/bookings/{booking_id}/cancel",
        headers=_auth(at),
        json={"reason": "again"},
    )
    assert again.status_code == 409

    audits = list(
        db_session.scalars(
            select(AuditEvent).where(
                AuditEvent.target_id == booking_id,
                AuditEvent.action.in_(["ops.dispatch_retry", "ops.booking_cancel"]),
            )
        ).all()
    )
    assert any(a.action == "ops.dispatch_retry" for a in audits)
    assert any(
        a.action == "ops.booking_cancel" and a.outcome == "success" for a in audits
    )


@pytest.mark.db
def test_ops_retry_rejected_after_accept(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
    customer, cp = make_user(role="customer")
    admin, ap = make_user(role="admin")
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

    at = _login(client, admin.email, ap)
    retry = client.post(
        f"/ops/bookings/{booking_id}/dispatch-retry",
        headers=_auth(at),
        json={},
    )
    assert retry.status_code == 409
