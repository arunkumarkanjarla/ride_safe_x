from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.permissions import PERMISSIONS_READ, ROLES_READ
from app.deps import require_permissions, get_db
from app.models import Permission, Role

router = APIRouter(tags=["rbac"])


@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    _auth=Depends(require_permissions(ROLES_READ)),
) -> list[dict]:
    roles = db.scalars(select(Role).options(selectinload(Role.permissions))).all()
    return [
        {
            "code": r.code,
            "name": r.name,
            "description": r.description,
            "permissions": sorted(p.code for p in r.permissions),
        }
        for r in roles
    ]


@router.get("/permissions")
def list_permissions(
    db: Session = Depends(get_db),
    _auth=Depends(require_permissions(PERMISSIONS_READ)),
) -> list[dict]:
    perms = db.scalars(select(Permission)).all()
    return [{"code": p.code, "description": p.description} for p in perms]
