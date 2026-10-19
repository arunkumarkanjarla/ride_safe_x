"""Authentication and session tests (PostgreSQL)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.db
def test_login_success(client: TestClient, make_user, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, password = make_user(role="customer")
    res = client.post("/auth/login", json={"email": user.email, "password": password})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user"]["email"] == user.email
    assert "profile.read_self" in body["user"]["permissions"]
    assert "password" not in res.text.lower() or "password_hash" not in res.text


@pytest.mark.db
def test_login_invalid_password(client: TestClient, make_user, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, _ = make_user()
    res = client.post(
        "/auth/login", json={"email": user.email, "password": "WrongPassword1!"}
    )
    assert res.status_code == 401
    assert res.json()["detail"]["error"] == "invalid_credentials"


@pytest.mark.db
def test_login_unknown_account_same_shape(
    client: TestClient, db_available: bool, make_user
) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    make_user()  # ensure catalogue seeded
    res = client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "WhateverPass1!"},
    )
    assert res.status_code == 401
    assert res.json()["detail"]["error"] == "invalid_credentials"


@pytest.mark.db
def test_disabled_account(client: TestClient, make_user, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, password = make_user(status="disabled")
    res = client.post("/auth/login", json={"email": user.email, "password": password})
    assert res.status_code == 401


@pytest.mark.db
def test_malformed_login(client: TestClient, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    res = client.post("/auth/login", json={"email": "not-an-email", "password": "x"})
    assert res.status_code == 422


@pytest.mark.db
def test_me_and_logout(client: TestClient, make_user, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, password = make_user()
    login = client.post("/auth/login", json={"email": user.email, "password": password})
    tokens = login.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["id"] == str(user.id)

    out = client.post(
        "/auth/logout",
        headers=headers,
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert out.status_code == 200
    assert out.json()["ok"] is True
    me2 = client.get("/auth/me", headers=headers)
    assert me2.status_code == 401


@pytest.mark.db
def test_refresh_rotation_and_reuse(
    client: TestClient, make_user, db_available: bool
) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, password = make_user()
    login = client.post("/auth/login", json={"email": user.email, "password": password})
    old_refresh = login.json()["refresh_token"]
    refreshed = client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert refreshed.status_code == 200
    reuse = client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert reuse.status_code == 401


@pytest.mark.db
def test_missing_auth(client: TestClient, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    assert client.get("/auth/me").status_code == 401
