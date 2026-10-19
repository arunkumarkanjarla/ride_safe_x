"""Idempotent role/permission catalogue seed."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import ALL_PERMISSIONS, ROLE_META, ROLE_PERMISSIONS
from app.models import Permission, Role, RolePermission


def seed_rbac_catalogue(db: Session) -> None:
    perm_by_code: dict[str, Permission] = {}
    for code, description in ALL_PERMISSIONS:
        existing = db.scalar(select(Permission).where(Permission.code == code))
        if existing is None:
            existing = Permission(code=code, description=description)
            db.add(existing)
            db.flush()
        else:
            existing.description = description
        perm_by_code[code] = existing

    for role_code, (name, description) in ROLE_META.items():
        role = db.scalar(select(Role).where(Role.code == role_code))
        if role is None:
            role = Role(code=role_code, name=name, description=description)
            db.add(role)
            db.flush()
        else:
            role.name = name
            role.description = description

        wanted = set(ROLE_PERMISSIONS.get(role_code, []))
        current = {
            rp.permission_id
            for rp in db.scalars(
                select(RolePermission).where(RolePermission.role_id == role.id)
            ).all()
        }
        for code in wanted:
            perm = perm_by_code[code]
            if perm.id not in current:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    db.commit()
