"""Fare estimate unit/API tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.services.fare import FareEstimateRequest, estimate_fare


def test_fare_estimate_hyd_cab_paise() -> None:
    result = estimate_fare(
        FareEstimateRequest(
            pickup_lat=17.385,
            pickup_lon=78.4867,
            drop_lat=17.448,
            drop_lon=78.391,
            vehicle_type="Cab",
        )
    )
    assert result["currency"] == "INR"
    assert result["estimate_paise"] > 0
    assert result["estimate_paise"] == result["subtotal_paise"] + result["tax_paise"]
    assert isinstance(result["estimate_paise"], int)


def test_fare_same_point_rejected() -> None:
    with pytest.raises(ValueError):
        estimate_fare(
            FareEstimateRequest(
                pickup_lat=17.0,
                pickup_lon=78.0,
                drop_lat=17.0,
                drop_lon=78.0,
            )
        )


def test_fare_bad_vehicle() -> None:
    with pytest.raises(Exception):
        FareEstimateRequest(
            pickup_lat=17.0,
            pickup_lon=78.0,
            drop_lat=17.1,
            drop_lon=78.1,
            vehicle_type="Spaceship",
        )


@pytest.mark.db
def test_fare_api(client: TestClient, make_user, db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")
    user, password = make_user(role="customer")
    login = client.post("/auth/login", json={"email": user.email, "password": password})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    res = client.post(
        "/fare/estimate",
        headers=headers,
        json={
            "pickup_lat": 17.385,
            "pickup_lon": 78.4867,
            "drop_lat": 17.448,
            "drop_lon": 78.391,
            "vehicle_type": "Cab",
        },
    )
    assert res.status_code == 200, res.text
    assert res.json()["currency"] == "INR"

    bad = client.post(
        "/fare/estimate",
        headers=headers,
        json={
            "pickup_lat": 17.385,
            "pickup_lon": 78.4867,
            "drop_lat": 17.385,
            "drop_lon": 78.4867,
            "vehicle_type": "Cab",
        },
    )
    assert bad.status_code == 422
