"""Payment gateway abstraction — Phase 9 sandbox only (no live providers)."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Protocol

from app.domain import payment_states as pst


@dataclass(frozen=True)
class GatewayCreateResult:
    gateway: str
    gateway_ref: str
    status: str


@dataclass(frozen=True)
class GatewayEventResult:
    gateway_ref: str
    event_key: str
    outcome: str  # succeed | fail | cancel | expire


class PaymentGateway(Protocol):
    name: str

    def create_attempt(self, *, payment_id: str, amount_paise: int, currency: str) -> GatewayCreateResult:
        ...

    def authenticate_callback(self, token: str | None, expected_token: str) -> bool:
        ...


class SandboxGateway:
    """Deterministic local mock. Never contacts a real payment provider."""

    name = pst.GATEWAY_SANDBOX

    def create_attempt(self, *, payment_id: str, amount_paise: int, currency: str) -> GatewayCreateResult:
        # amount/currency accepted for interface symmetry; not sent off-box
        _ = (amount_paise, currency)
        ref = f"sbx_{payment_id.replace('-', '')[:16]}_{secrets.token_hex(4)}"
        return GatewayCreateResult(
            gateway=self.name,
            gateway_ref=ref,
            status=pst.PAYMENT_PENDING,
        )

    def authenticate_callback(self, token: str | None, expected_token: str) -> bool:
        if not token or not expected_token:
            return False
        return secrets.compare_digest(token, expected_token)

    def build_event(
        self, *, gateway_ref: str, outcome: str, event_key: str | None = None
    ) -> GatewayEventResult:
        if outcome not in ("succeed", "fail", "cancel", "expire"):
            raise ValueError("invalid_sandbox_outcome")
        key = event_key or f"sbx_evt_{secrets.token_hex(12)}"
        return GatewayEventResult(
            gateway_ref=gateway_ref, event_key=key, outcome=outcome
        )


def get_sandbox_gateway() -> SandboxGateway:
    return SandboxGateway()
