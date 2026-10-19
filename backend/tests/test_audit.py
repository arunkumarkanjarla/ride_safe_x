"""Audit trail tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import AuditEvent


@pytest.mark.db
def test_login_creates_audit(
    client: TestClient, make_user, db_session, db_available: bool
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    user, password = make_user()
    client.post("/auth/login", json={"email": user.email, "password": password})
    client.post(
        "/auth/login", json={"email": user.email, "password": "BadPassword99!"}
    )
    rows = db_session.scalars(
        select(AuditEvent)
        .where(AuditEvent.action == "auth.login")
        .order_by(AuditEvent.created_at.desc())
        .limit(10)
    ).all()
    outcomes = {r.outcome for r in rows if r.actor_user_id == user.id or r.outcome == "failure"}
    assert "success" in {r.outcome for r in rows}
    assert "failure" in {r.outcome for r in rows}
    for row in rows:
        meta = row.metadata_json or {}
        blob = str(meta).lower()
        assert "password" not in blob
        assert "token" not in blob
        assert "bearer" not in blob


@pytest.mark.db
def test_audit_read_permission(
    client: TestClient, make_user, db_available: bool
) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    customer, cpw = make_user(role="customer")
    ct = client.post(
        "/auth/login", json={"email": customer.email, "password": cpw}
    ).json()
    assert (
        client.get(
            "/audit-events",
            headers={"Authorization": f"Bearer {ct['access_token']}"},
        ).status_code
        == 403
    )
    agent, apw = make_user(role="support_agent")
    at = client.post(
        "/auth/login", json={"email": agent.email, "password": apw}
    ).json()
    res = client.get(
        "/audit-events",
        headers={"Authorization": f"Bearer {at['access_token']}"},
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)
