from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.deps import AuthContext, client_ip, get_current_auth, get_db, request_id_header
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    TokenResponse,
    UserOut,
)
from app.services.auth import AuthError, authenticate, logout, refresh_session, user_permission_codes

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        status=user.status,
        roles=[{"code": r.code, "name": r.name} for r in user.roles],
        permissions=sorted(user_permission_codes(user)),
    )


def _tokens(user, access: str, refresh: str, settings: Settings) -> TokenResponse:
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_minutes * 60,
        user=_user_out(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    request_id: str | None = Depends(request_id_header),
) -> TokenResponse:
    try:
        user, access, refresh, _ = authenticate(
            db,
            settings,
            email=str(body.email),
            password=body.password,
            ip_address=client_ip(request),
            user_agent=request.headers.get("user-agent"),
            request_id=request_id,
        )
    except AuthError as exc:
        code = (
            status.HTTP_429_TOO_MANY_REQUESTS
            if exc.code == "rate_limited"
            else status.HTTP_401_UNAUTHORIZED
        )
        raise HTTPException(status_code=code, detail={"error": exc.code}) from exc
    return _tokens(user, access, refresh, settings)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    body: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    request_id: str | None = Depends(request_id_header),
) -> TokenResponse:
    try:
        user, access, refresh_tok, _ = refresh_session(
            db,
            settings,
            refresh_token=body.refresh_token,
            ip_address=client_ip(request),
            user_agent=request.headers.get("user-agent"),
            request_id=request_id,
        )
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": exc.code}
        ) from exc
    return _tokens(user, access, refresh_tok, settings)


@router.post("/logout")
def logout_endpoint(
    request: Request,
    body: LogoutRequest | None = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
    request_id: str | None = Depends(request_id_header),
) -> dict[str, bool]:
    logout(
        db,
        user=auth.user,
        session_id=auth.session.id,
        refresh_token=body.refresh_token if body else None,
        ip_address=client_ip(request),
        request_id=request_id,
    )
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(auth: AuthContext = Depends(get_current_auth)) -> UserOut:
    return _user_out(auth.user)
