"""Authenticated WebSocket endpoints for booking/driver events."""

from __future__ import annotations

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import get_session_factory
from app.models import Booking, DriverProfile
from app.services.auth import AuthError, resolve_access_token, user_permission_codes
from app.services.ws_hub import Subscription, hub

logger = logging.getLogger("ridenova.ws")
router = APIRouter(tags=["websocket"])


async def _authenticate(websocket: WebSocket, token: str | None):
    if not token:
        await websocket.close(code=4401)
        return None
    settings = get_settings()
    factory = get_session_factory()
    db = factory()
    try:
        user, session = resolve_access_token(db, settings, token)
        roles = {r.code for r in user.roles}
        perms = user_permission_codes(user)
        profile = db.scalar(select(DriverProfile).where(DriverProfile.user_id == user.id))
        return user, session, roles, perms, profile
    except AuthError:
        await websocket.close(code=4401)
        return None
    finally:
        db.close()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(default=None),
) -> None:
    auth = await _authenticate(websocket, token)
    if auth is None:
        return
    user, _session, roles, perms, profile = auth
    await websocket.accept()
    sub = Subscription(
        websocket=websocket,
        user_id=user.id,
        role_codes=roles,
        driver_profile_id=str(profile.id) if profile else None,
    )
    await hub.connect(sub)
    try:
        await websocket.send_json({"event_type": "ws.connected", "payload": {"user_id": str(user.id)}})
        while True:
            raw = await websocket.receive_text()
            if len(raw) > 4096:
                await websocket.send_json({"error": "payload_too_large"})
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "invalid_json"})
                continue
            action = msg.get("action")
            if action == "subscribe.booking":
                booking_id = str(msg.get("booking_id") or "")
                try:
                    UUID(booking_id)
                except ValueError:
                    await websocket.send_json({"error": "invalid_booking_id"})
                    continue
                factory = get_session_factory()
                db = factory()
                try:
                    booking = db.get(Booking, UUID(booking_id))
                    if booking is None:
                        await websocket.send_json({"error": "not_found"})
                        continue
                    allowed = False
                    if booking.customer_id == user.id and "bookings.read_self" in perms:
                        allowed = True
                    elif "bookings.read" in perms:
                        allowed = True
                    elif (
                        profile
                        and booking.assigned_driver_profile_id == profile.id
                        and "drivers.trips_self" in perms
                    ):
                        allowed = True
                    if not allowed:
                        await websocket.send_json({"error": "forbidden"})
                        continue
                    await hub.subscribe_booking(websocket, booking_id, allowed=True)
                    await websocket.send_json(
                        {"event_type": "ws.subscribed", "payload": {"booking_id": booking_id}}
                    )
                finally:
                    db.close()
            elif action == "ping":
                await websocket.send_json({"event_type": "pong"})
            else:
                await websocket.send_json({"error": "unknown_action"})
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(websocket)
