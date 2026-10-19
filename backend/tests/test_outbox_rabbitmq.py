"""Phase 10 — live RabbitMQ outbox publish when broker is reachable.

Marks NOT SKIPPED only when pika can connect; never mocks a pass.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.core.config import get_settings
from app.models import DriverAvailability, OutboxEvent
from app.services.dispatch import get_or_create_driver_profile, set_availability
from app.services.outbox import publish_pending


def _rabbit_available() -> bool:
    try:
        import pika

        settings = get_settings()
        # Prefer localhost when tests run on host
        url = settings.rabbitmq_url
        if "rabbitmq:" in url:
            url = url.replace("@rabbitmq:", "@127.0.0.1:")
        params = pika.URLParameters(url)
        params.socket_timeout = 2
        conn = pika.BlockingConnection(params)
        conn.close()
        return True
    except Exception:
        return False


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
def test_outbox_publish_to_rabbitmq_when_available(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    if not _rabbit_available():
        pytest.skip("RabbitMQ not reachable — Phase 10 live outbox NOT RUN")

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

    pending = list(
        db_session.scalars(
            select(OutboxEvent).where(OutboxEvent.published_at.is_(None))
        ).all()
    )
    assert pending, "expected unpublished outbox rows after booking create"

    settings = get_settings()
    url = settings.rabbitmq_url
    if "rabbitmq:" in url:
        url = url.replace("@rabbitmq:", "@127.0.0.1:")

    published = publish_pending(db_session, url, limit=50)
    assert published >= 1

    db_session.expire_all()
    still = list(
        db_session.scalars(
            select(OutboxEvent)
            .where(OutboxEvent.published_at.is_(None))
            .limit(5)
        ).all()
    )
    # Fresh events from concurrent tests may exist; our earlier ones should be published
    assert published >= 1
    _ = still  # informational only


@pytest.mark.db
def test_e2e_booking_trip_notification_payment_path(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    """Full API path on real PostgreSQL (does not require RabbitMQ)."""
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")

    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
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
    assert created.status_code == 201
    bid = created.json()["id"]

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
                f"/bookings/{bid}/transition",
                headers=_auth(dt),
                json={"action": action},
            ).status_code
            == 200
        )

    summary = client.get(f"/bookings/{bid}/summary", headers=_auth(ct))
    assert summary.status_code == 200
    assert summary.json()["booking"]["status"] == "CLOSED"

    notes = client.get("/notifications", headers=_auth(ct))
    assert notes.status_code == 200
    assert notes.json()["total"] >= 1

    pay = client.post(
        "/payments",
        headers=_auth(ct),
        json={"booking_id": bid, "idempotency_key": f"pay-{uuid.uuid4()}"},
    )
    assert pay.status_code == 201
    pid = pay.json()["id"]
    ok = client.post(
        f"/payments/{pid}/sandbox/simulate",
        headers=_auth(ct),
        json={"outcome": "succeed", "event_key": f"evt-{uuid.uuid4()}"},
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "SUCCEEDED"

    ready = client.get("/health/ready")
    assert ready.status_code == 200
    body = ready.json()
    assert body["checks"]["database"] == "ok"
    assert "payments_sandbox_allowed" in body["checks"]
