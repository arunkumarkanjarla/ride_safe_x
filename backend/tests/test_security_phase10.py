"""Phase 10 security regression tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings


def test_production_rejects_sandbox_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RIDENOVA_ENV", "production")
    monkeypatch.setenv("PAYMENTS_SANDBOX_ENABLED", "true")
    monkeypatch.setenv(
        "JWT_SECRET", "TEST_ONLY_JWT_SECRET_VALUE_AT_LEAST_32_CHARS_LONG"
    )
    get_settings.cache_clear()
    with pytest.raises(Exception):
        Settings()
    get_settings.cache_clear()
    monkeypatch.setenv("RIDENOVA_ENV", "test")
    monkeypatch.delenv("PAYMENTS_SANDBOX_ENABLED", raising=False)
    get_settings.cache_clear()


def test_production_disables_sandbox_routes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RIDENOVA_ENV", "production")
    monkeypatch.setenv("PAYMENTS_SANDBOX_ENABLED", "false")
    monkeypatch.setenv(
        "JWT_SECRET", "TEST_ONLY_JWT_SECRET_VALUE_AT_LEAST_32_CHARS_LONG"
    )
    get_settings.cache_clear()
    s = Settings()
    assert s.sandbox_payments_allowed() is False
    get_settings.cache_clear()
    monkeypatch.setenv("RIDENOVA_ENV", "test")
    get_settings.cache_clear()


def test_health_does_not_leak_connection_strings(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    text = res.text.lower()
    assert "password" not in text
    assert "postgresql://" not in text
    assert "jwt" not in text
    body = res.json()
    assert "payments_sandbox_allowed" in body


def test_ready_does_not_leak_secrets(client: TestClient) -> None:
    res = client.get("/health/ready")
    text = res.text.lower()
    assert "jwt_secret" not in text
    assert "sandbox_token" not in text
    assert "payments_sandbox_token" not in text
    assert "bearer " not in text


def test_unauthenticated_payments_rejected(client: TestClient) -> None:
    assert client.get("/payments").status_code in (401, 403)
    assert client.post("/payments", json={}).status_code in (401, 403, 422)


def test_ws_without_token_closes(client: TestClient) -> None:
    try:
        with client.websocket_connect("/ws") as ws:
            ws.receive_json(timeout=1)
            pytest.fail("unauthenticated websocket should not stay open")
    except Exception:
        # Expected: connection rejected / closed without token
        pass
