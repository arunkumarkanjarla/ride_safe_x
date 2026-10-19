from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.permissions import (
    PROFILE_READ_SELF,
    PROFILE_UPDATE_SELF,
    ROLES_MANAGE,
    USERS_MANAGE,
    USERS_READ,
)
from app.deps import AuthContext, client_ip, get_current_auth, get_db, parse_user_id, request_id_header
from app.models import Role, UserRole
from app.schemas.auth import AssignRoleRequest, ProfileUpdateRequest, UserOut
from app.services.audit import record_audit
from app.services.auth import load_user, user_permission_codes
from sqlalchemy import select

router = APIRouter(prefix="/users", tags=["users"])


def _user_out(user) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        status=user.status,
        roles=[{"code": r.code, "name": r.name} for r in user.roles],
        permissions=sorted(user_permission_codes(user)),
    )


def _can_read(auth: AuthContext, target_id: UUID) -> bool:
    if target_id == auth.user.id and PROFILE_READ_SELF in auth.permissions:
        return True
    return USERS_READ in auth.permissions or USERS_MANAGE in auth.permissions


def _can_update(auth: AuthContext, target_id: UUID) -> bool:
    if target_id == auth.user.id and PROFILE_UPDATE_SELF in auth.permissions:
        return True
    return USERS_MANAGE in auth.permissions


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
) -> UserOut:
    uid = parse_user_id(user_id)
    if not _can_read(auth, uid):
        # Avoid leaking existence to unauthorized callers
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "forbidden"})
    user = load_user(db, uid)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": "not_found"})
    return _user_out(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
    request_id: str | None = Depends(request_id_header),
) -> UserOut:
    uid = parse_user_id(user_id)
    if not _can_update(auth, uid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "forbidden"})
    user = load_user(db, uid)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": "not_found"})
    if uid != auth.user.id and USERS_MANAGE not in auth.permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "forbidden"})
    user.display_name = body.display_name.strip()
    record_audit(
        db,
        action="user.profile_update",
        outcome="success",
        actor_user_id=auth.user.id,
        target_type="user",
        target_id=str(uid),
        ip_address=client_ip(request),
        request_id=request_id,
        raise_on_failure=True,
    )
    db.commit()
    return _user_out(load_user(db, uid))  # type: ignore[arg-type]


@router.post("/{user_id}/roles", response_model=UserOut)
def assign_role(
    user_id: str,
    body: AssignRoleRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
    request_id: str | None = Depends(request_id_header),
) -> UserOut:
    if ROLES_MANAGE not in auth.permissions:
        record_audit(
            db,
            action="user.role_assign",
            outcome="forbidden",
            actor_user_id=auth.user.id,
            target_type="user",
            target_id=user_id,
            metadata={"role_code": body.role_code},
            ip_address=client_ip(request),
            request_id=request_id,
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "forbidden"})

    uid = parse_user_id(user_id)
    user = load_user(db, uid)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": "not_found"})

    role = db.scalar(select(Role).where(Role.code == body.role_code))
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": "not_found"})

    exists = db.scalar(
        select(UserRole).where(UserRole.user_id == uid, UserRole.role_id == role.id)
    )
    if exists is None:
        db.add(UserRole(user_id=uid, role_id=role.id))

    record_audit(
        db,
        action="user.role_assign",
        outcome="success",
        actor_user_id=auth.user.id,
        target_type="user",
        target_id=str(uid),
        metadata={"role_code": body.role_code},
        ip_address=client_ip(request),
        request_id=request_id,
        raise_on_failure=True,
    )
    db.commit()
    return _user_out(load_user(db, uid))  # type: ignore[arg-type]
