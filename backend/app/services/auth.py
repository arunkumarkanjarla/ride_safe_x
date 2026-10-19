"""Authentication and session lifecycle."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.rate_limit import RateLimitExceeded, check_login_rate_limit
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_token,
    new_refresh_token,
    verify_password,
)
from app.models import Role, Session as AuthSession, User, UserRole
from app.services.audit import record_audit


class AuthError(Exception):
    def __init__(self, code: str, message: str = "Authentication failed") -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def user_permission_codes(user: User) -> set[str]:
    codes: set[str] = set()
    for role in user.roles:
        for perm in role.permissions:
            codes.add(perm.code)
    return codes


def load_user(db: Session, user_id: UUID) -> User | None:
    return db.scalar(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )


def authenticate(
    db: Session,
    settings: Settings,
    *,
    email: str,
    password: str,
    ip_address: str | None,
    user_agent: str | None,
    request_id: str | None,
) -> tuple[User, str, str, datetime]:
    key = f"{(ip_address or 'unknown')}:{(email or '').lower()}"
    try:
        check_login_rate_limit(key, settings)
    except RateLimitExceeded as exc:
        record_audit(
            db,
            action="auth.login",
            outcome="rate_limited",
            metadata={"email_domain": _email_domain(email)},
            ip_address=ip_address,
            request_id=request_id,
        )
        db.commit()
        raise AuthError("rate_limited", "Too many attempts. Try again later.") from exc

    user = db.scalar(
        select(User)
        .where(User.email == email.lower().strip())
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )
    # Constant-ish failure path
    if user is None or not verify_password(password, user.password_hash):
        record_audit(
            db,
            action="auth.login",
            outcome="failure",
            actor_user_id=user.id if user else None,
            metadata={"email_domain": _email_domain(email)},
            ip_address=ip_address,
            request_id=request_id,
        )
        db.commit()
        raise AuthError("invalid_credentials", "Invalid email or password")

    if user.status != "active":
        record_audit(
            db,
            action="auth.login",
            outcome="disabled",
            actor_user_id=user.id,
            ip_address=ip_address,
            request_id=request_id,
        )
        db.commit()
        raise AuthError("disabled", "Invalid email or password")

    access, refresh, expires = _issue_session(
        db,
        settings,
        user=user,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    record_audit(
        db,
        action="auth.login",
        outcome="success",
        actor_user_id=user.id,
        target_type="user",
        target_id=str(user.id),
        ip_address=ip_address,
        request_id=request_id,
        raise_on_failure=True,
    )
    db.commit()
    return user, access, refresh, expires


def refresh_session(
    db: Session,
    settings: Settings,
    *,
    refresh_token: str,
    ip_address: str | None,
    user_agent: str | None,
    request_id: str | None,
) -> tuple[User, str, str, datetime]:
    token_hash = hash_token(refresh_token)
    session = db.scalar(select(AuthSession).where(AuthSession.refresh_token_hash == token_hash))
    if session is None or session.revoked_at is not None:
        record_audit(
            db,
            action="auth.refresh",
            outcome="failure",
            ip_address=ip_address,
            request_id=request_id,
        )
        db.commit()
        raise AuthError("invalid_token", "Invalid session")

    if _as_utc(session.expires_at) < datetime.now(UTC):
        session.revoked_at = datetime.now(UTC)
        record_audit(
            db,
            action="auth.refresh",
            outcome="expired",
            actor_user_id=session.user_id,
            ip_address=ip_address,
            request_id=request_id,
        )
        db.commit()
        raise AuthError("invalid_token", "Invalid session")

    user = load_user(db, session.user_id)
    if user is None or user.status != "active":
        session.revoked_at = datetime.now(UTC)
        db.commit()
        raise AuthError("invalid_token", "Invalid session")

    # Rotate refresh
    session.revoked_at = datetime.now(UTC)
    access, refresh, expires = _issue_session(
        db,
        settings,
        user=user,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    record_audit(
        db,
        action="auth.refresh",
        outcome="success",
        actor_user_id=user.id,
        target_type="session",
        target_id=str(session.id),
        ip_address=ip_address,
        request_id=request_id,
    )
    db.commit()
    return user, access, refresh, expires


def logout(
    db: Session,
    *,
    user: User,
    session_id: UUID,
    refresh_token: str | None,
    ip_address: str | None,
    request_id: str | None,
) -> None:
    session = db.get(AuthSession, session_id)
    if session and session.user_id == user.id and session.revoked_at is None:
        session.revoked_at = datetime.now(UTC)
    if refresh_token:
        other = db.scalar(
            select(AuthSession).where(
                AuthSession.refresh_token_hash == hash_token(refresh_token)
            )
        )
        if other and other.user_id == user.id and other.revoked_at is None:
            other.revoked_at = datetime.now(UTC)
    record_audit(
        db,
        action="auth.logout",
        outcome="success",
        actor_user_id=user.id,
        target_type="session",
        target_id=str(session_id),
        ip_address=ip_address,
        request_id=request_id,
    )
    db.commit()


def resolve_access_token(
    db: Session, settings: Settings, token: str
) -> tuple[User, AuthSession]:
    try:
        payload = decode_access_token(token, settings)
    except Exception as exc:  # noqa: BLE001
        raise AuthError("invalid_token", "Not authenticated") from exc

    user_id = UUID(payload["sub"])
    session_id = UUID(payload["sid"])
    session = db.get(AuthSession, session_id)
    if session is None or session.revoked_at is not None or session.user_id != user_id:
        raise AuthError("invalid_token", "Not authenticated")
    if _as_utc(session.expires_at) < datetime.now(UTC):
        raise AuthError("invalid_token", "Not authenticated")

    user = load_user(db, user_id)
    if user is None or user.status != "active":
        raise AuthError("invalid_token", "Not authenticated")
    return user, session


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def create_user(
    db: Session,
    *,
    email: str,
    password: str,
    display_name: str,
    role_codes: list[str],
    status: str = "active",
) -> User:
    user = User(
        email=email.lower().strip(),
        password_hash=hash_password(password),
        display_name=display_name,
        status=status,
    )
    db.add(user)
    db.flush()
    for code in role_codes:
        role = db.scalar(select(Role).where(Role.code == code))
        if role is None:
            raise ValueError(f"unknown role: {code}")
        db.add(UserRole(user_id=user.id, role_id=role.id))
    db.commit()
    loaded = load_user(db, user.id)
    assert loaded is not None
    return loaded


def _issue_session(
    db: Session,
    settings: Settings,
    *,
    user: User,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[str, str, datetime]:
    refresh = new_refresh_token()
    expires = datetime.now(UTC) + timedelta(days=settings.refresh_token_days)
    session = AuthSession(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh),
        expires_at=expires,
        user_agent=(user_agent or "")[:512] or None,
        ip_address=ip_address,
    )
    db.add(session)
    db.flush()
    access, _ = create_access_token(
        user_id=user.id, session_id=session.id, settings=settings
    )
    return access, refresh, expires


def _email_domain(email: str) -> str:
    if "@" in email:
        return email.split("@", 1)[1].lower()[:120]
    return "unknown"
