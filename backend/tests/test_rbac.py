"""RBAC and object-level authorization tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> dict:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.db
def test_self_profile_allowed(client: TestClient, make_user, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, password = make_user(role="customer")
    tokens = _login(client, user.email, password)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    res = client.get(f"/users/{user.id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["email"] == user.email


@pytest.mark.db
def test_idor_blocked(client: TestClient, make_user, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    a, pw_a = make_user(role="customer", name="User A")
    b, _ = make_user(role="customer", name="User B")
    tokens = _login(client, a.email, pw_a)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    res = client.get(f"/users/{b.id}", headers=headers)
    assert res.status_code == 403


@pytest.mark.db
def test_admin_can_read_other(client: TestClient, make_user, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    admin, pw = make_user(role="admin")
    other, _ = make_user(role="customer")
    tokens = _login(client, admin.email, pw)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    res = client.get(f"/users/{other.id}", headers=headers)
    assert res.status_code == 200


@pytest.mark.db
def test_customer_cannot_assign_roles(
    client: TestClient, make_user, db_available: bool
) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, pw = make_user(role="customer")
    tokens = _login(client, user.email, pw)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    res = client.post(
        f"/users/{user.id}/roles",
        headers=headers,
        json={"role_code": "super_admin"},
    )
    assert res.status_code == 403


@pytest.mark.db
def test_roles_endpoint_requires_permission(
    client: TestClient, make_user, db_available: bool
) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, pw = make_user(role="customer")
    tokens = _login(client, user.email, pw)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert client.get("/roles", headers=headers).status_code == 403
    admin, apw = make_user(role="admin")
    at = _login(client, admin.email, apw)
    assert (
        client.get(
            "/roles", headers={"Authorization": f"Bearer {at['access_token']}"}
        ).status_code
        == 200
    )


@pytest.mark.db
def test_unauthenticated_privileged(client: TestClient, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    assert client.get("/roles").status_code == 401
    assert client.get("/audit-events").status_code == 401
