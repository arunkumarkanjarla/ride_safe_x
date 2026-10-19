"""Payment API schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class PaymentCreateIn(BaseModel):
    booking_id: UUID
    idempotency_key: str = Field(min_length=8, max_length=128)


class PaymentOut(BaseModel):
    id: UUID
    booking_id: UUID
    customer_id: UUID
    amount_paise: int
    currency: str
    status: str
    gateway: str
    gateway_ref: str
    failure_category: str | None
    created_at: datetime
    updated_at: datetime
    succeeded_at: datetime | None
    failed_at: datetime | None
    cancelled_at: datetime | None
    sandbox: bool = True

    model_config = {"from_attributes": True}


class PaymentListOut(BaseModel):
    items: list[PaymentOut]


class SandboxSimulateIn(BaseModel):
    outcome: str
    event_key: str | None = Field(default=None, max_length=128)

    @field_validator("outcome")
    @classmethod
    def _outcome(cls, value: str) -> str:
        if value not in ("succeed", "fail", "cancel", "expire"):
            raise ValueError("invalid outcome")
        return value


class SandboxCallbackIn(BaseModel):
    gateway_ref: str = Field(min_length=4, max_length=128)
    outcome: str
    event_key: str = Field(min_length=8, max_length=128)
    sandbox_token: str = Field(min_length=8, max_length=256)

    @field_validator("outcome")
    @classmethod
    def _outcome(cls, value: str) -> str:
        if value not in ("succeed", "fail", "cancel", "expire"):
            raise ValueError("invalid outcome")
        return value
