"""In-process authenticated WebSocket subscription hub."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger("ridenova.ws")


@dataclass
class Subscription:
    websocket: WebSocket
    user_id: UUID
    role_codes: set[str]
    booking_ids: set[str] = field(default_factory=set)
    driver_profile_id: str | None = None
    seen_event_ids: set[str] = field(default_factory=set)


class WsHub:
    def __init__(self) -> None:
        self._subs: list[Subscription] = []
        self._lock = asyncio.Lock()

    async def connect(self, sub: Subscription) -> None:
        async with self._lock:
            self._subs.append(sub)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._subs = [s for s in self._subs if s.websocket is not websocket]

    async def subscribe_booking(
        self, websocket: WebSocket, booking_id: str, *, allowed: bool
    ) -> None:
        if not allowed:
            raise PermissionError("forbidden")
        async with self._lock:
            for sub in self._subs:
                if sub.websocket is websocket:
                    sub.booking_ids.add(booking_id)
                    return
        raise KeyError("not_connected")

    def _targets(self, event: dict[str, Any]) -> list[Subscription]:
        aggregate_type = event.get("aggregate_type")
        aggregate_id = str(event.get("aggregate_id") or "")
        payload = event.get("payload") or {}
        event_type = str(event.get("event_type") or "")
        customer_id = str(payload.get("customer_id") or "")
        driver_profile_id = str(payload.get("driver_profile_id") or "")
        booking_id = str(payload.get("booking_id") or aggregate_id)
        recipient_user_id = str(payload.get("recipient_user_id") or "")
        targets: list[Subscription] = []

        # Recipient-scoped notification hints — never broadcast
        if event_type == "notification.created" and recipient_user_id:
            for sub in self._subs:
                if str(sub.user_id) == recipient_user_id:
                    targets.append(sub)
            return targets

        for sub in self._subs:
            if "admin" in sub.role_codes or "super_admin" in sub.role_codes:
                if booking_id in sub.booking_ids or not sub.booking_ids:
                    # ops must explicitly subscribe unless listening to driver channel
                    if booking_id in sub.booking_ids:
                        targets.append(sub)
                continue
            if customer_id and str(sub.user_id) == customer_id:
                if not sub.booking_ids or booking_id in sub.booking_ids:
                    targets.append(sub)
                    continue
            if driver_profile_id and sub.driver_profile_id == driver_profile_id:
                targets.append(sub)
                continue
            if aggregate_type == "booking" and booking_id in sub.booking_ids:
                if str(sub.user_id) == customer_id or (
                    sub.driver_profile_id and sub.driver_profile_id == driver_profile_id
                ):
                    targets.append(sub)
        return targets

    async def fanout(self, event: dict[str, Any]) -> int:
        event_id = str(event.get("event_id") or "")
        async with self._lock:
            targets = self._targets(event)
            dead: list[WebSocket] = []
            delivered = 0
            for sub in targets:
                if event_id and event_id in sub.seen_event_ids:
                    continue
                try:
                    await sub.websocket.send_json(event)
                    if event_id:
                        sub.seen_event_ids.add(event_id)
                        if len(sub.seen_event_ids) > 500:
                            sub.seen_event_ids = set(list(sub.seen_event_ids)[-250:])
                    delivered += 1
                except Exception:
                    logger.exception("ws_deliver_failed")
                    dead.append(sub.websocket)
            if dead:
                self._subs = [s for s in self._subs if s.websocket not in dead]
            return delivered

    def fanout_sync(self, event: dict[str, Any]) -> None:
        """Schedule fanout from sync code paths (after commit)."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(self.fanout(event))


hub = WsHub()
