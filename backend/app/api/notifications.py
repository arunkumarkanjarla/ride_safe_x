"""Authenticated in-app notification APIs."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core import permissions as perm
from app.deps import AuthContext, get_db, require_permissions
from app.schemas.notification import (
    BulkReadIn,
    BulkReadOut,
    NotificationHealthOut,
    NotificationListOut,
    NotificationOut,
    UnreadCountOut,
)
from app.services import notifications as notif_svc

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=NotificationListOut)
def list_my_notifications(
    unread: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.NOTIFICATIONS_READ_SELF)),
) -> NotificationListOut:
    items, total = notif_svc.list_notifications(
        db,
        auth.user.id,
        unread_only=unread,
        page=page,
        page_size=page_size,
    )
    return NotificationListOut(
        items=[NotificationOut.model_validate(n) for n in items],
        page=page,
        page_size=page_size,
        total=total,
        unread_count=notif_svc.unread_count(db, auth.user.id),
    )


@router.get("/notifications/unread-count", response_model=UnreadCountOut)
def my_unread_count(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.NOTIFICATIONS_READ_SELF)),
) -> UnreadCountOut:
    return UnreadCountOut(unread_count=notif_svc.unread_count(db, auth.user.id))


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_one_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.NOTIFICATIONS_UPDATE_SELF)),
) -> NotificationOut:
    try:
        note = notif_svc.mark_read(db, auth.user.id, notification_id)
    except PermissionError:
        raise HTTPException(status_code=403, detail={"error": "forbidden"}) from None
    if note is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return NotificationOut.model_validate(note)


@router.post("/notifications/read-bulk", response_model=BulkReadOut)
def mark_bulk_read(
    body: BulkReadIn,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.NOTIFICATIONS_UPDATE_SELF)),
) -> BulkReadOut:
    try:
        marked = notif_svc.mark_read_bulk(db, auth.user.id, body.ids)
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail={"error": str(exc)}
        ) from exc
    return BulkReadOut(marked=marked)


@router.post("/notifications/read-all", response_model=BulkReadOut)
def mark_all_read(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.NOTIFICATIONS_UPDATE_SELF)),
) -> BulkReadOut:
    marked = notif_svc.mark_all_read(db, auth.user.id, limit=200)
    return BulkReadOut(marked=marked)


@router.get("/ops/notifications/health", response_model=NotificationHealthOut)
def notification_ops_health(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_permissions(perm.NOTIFICATIONS_OPS_HEALTH)),
) -> NotificationHealthOut:
    return NotificationHealthOut(**notif_svc.ops_health(db))
