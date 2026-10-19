"""Server-side fare estimate — HYD Cab rates from static platform defaults."""

from __future__ import annotations

import math
from decimal import Decimal, ROUND_HALF_UP

from pydantic import BaseModel, Field, field_validator

# Static platform-config HYD Cab (rupees)
RATES = {
    "Cab": {
        "base": Decimal("50"),
        "per_km": Decimal("14.5"),
        "per_min": Decimal("1.5"),
        "min_fare": Decimal("70"),
        "booking_fee": Decimal("0"),
    },
    "Auto": {
        "base": Decimal("30"),
        "per_km": Decimal("11"),
        "per_min": Decimal("1"),
        "min_fare": Decimal("45"),
        "booking_fee": Decimal("0"),
    },
    "Bike": {
        "base": Decimal("20"),
        "per_km": Decimal("6.5"),
        "per_min": Decimal("0.8"),
        "min_fare": Decimal("30"),
        "booking_fee": Decimal("0"),
    },
}
TAX_PCT = Decimal("5")  # static pricing.taxPct


class FareEstimateRequest(BaseModel):
    pickup_lat: float = Field(ge=-90, le=90)
    pickup_lon: float = Field(ge=-180, le=180)
    drop_lat: float = Field(ge=-90, le=90)
    drop_lon: float = Field(ge=-180, le=180)
    vehicle_type: str = "Cab"

    @field_validator("vehicle_type")
    @classmethod
    def _vehicle(cls, value: str) -> str:
        if value not in RATES:
            raise ValueError("unsupported vehicle_type")
        return value


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> Decimal:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    km = 2 * r * math.asin(math.sqrt(a))
    return Decimal(str(round(km, 3)))


def estimate_fare(req: FareEstimateRequest) -> dict:
    if req.pickup_lat == req.drop_lat and req.pickup_lon == req.drop_lon:
        raise ValueError("pickup and drop must differ")
    km = haversine_km(req.pickup_lat, req.pickup_lon, req.drop_lat, req.drop_lon)
    if km <= 0:
        raise ValueError("invalid distance")
    duration_min = max(1, int((km * Decimal("3")).to_integral_value(rounding=ROUND_HALF_UP)))
    rate = RATES[req.vehicle_type]
    base = (rate["base"] * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    dist = (km * rate["per_km"] * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    time = (Decimal(duration_min) * rate["per_min"] * 100).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )
    booking_fee = (rate["booking_fee"] * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    pre = base + dist + time + booking_fee
    min_fare = (rate["min_fare"] * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if pre < min_fare:
        pre = min_fare
    tax = (pre * TAX_PCT / Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    total = int(pre + tax)
    return {
        "vehicle_type": req.vehicle_type,
        "distance_km": float(km),
        "duration_min": duration_min,
        "currency": "INR",
        "subtotal_paise": int(pre),
        "tax_paise": int(tax),
        "estimate_paise": total,
        "lines": [
            {"label": "Base fare", "paise": int(base)},
            {"label": f"Distance {km} km", "paise": int(dist)},
            {"label": f"Time {duration_min} min", "paise": int(time)},
            {"label": "GST 5%", "paise": int(tax)},
        ],
    }
