from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import AUDIT_READ
from app.deps import require_permissions, get_db
from app.models import AuditEvent
from app.schemas.auth import AuditEventOut

router = APIRouter(prefix="/audit-events", tags=["audit"])


@router.get("", response_model=list[AuditEventOut])
def list_audit_events(
    db: Session = Depends(get_db),
    _auth=Depends(require_permissions(AUDIT_READ)),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[AuditEvent]:
    return list(
        db.scalars(
            select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)
        ).all()
    )
