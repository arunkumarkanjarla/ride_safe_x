"""FastAPI dependencies."""

from __future__ import annotations

from collections.abc import Generator
from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import get_session_factory
from app.models import Session as AuthSession
from app.models import User
from app.services.auth import AuthError, resolve_access_token, user_permission_codes

_bearer = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    factory = get_session_factory()
    db = factory()
    try:
        yield db
    finally:
        db.close()


@dataclass
class AuthContext:
    user: User
    session: AuthSession
    permissions: set[str]


def get_current_auth(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> AuthContext:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "not_authenticated"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user, session = resolve_access_token(db, settings, creds.credentials)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": exc.code},
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return AuthContext(user=user, session=session, permissions=user_permission_codes(user))


def require_permissions(*needed: str):
    def _dep(auth: AuthContext = Depends(get_current_auth)) -> AuthContext:
        missing = [p for p in needed if p not in auth.permissions]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "forbidden"},
            )
        return auth

    return _dep


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    if request.client:
        return request.client.host
    return None


def request_id_header(
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> str | None:
    return (x_request_id or "")[:64] or None


def parse_user_id(value: str) -> UUID:
    try:
        return UUID(value)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": "not_found"}) from exc
