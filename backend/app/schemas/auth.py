from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=512)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class RoleOut(BaseModel):
    code: str
    name: str

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    display_name: str
    status: str
    roles: list[RoleOut]
    permissions: list[str]

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class ProfileUpdateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=200)


class AssignRoleRequest(BaseModel):
    role_code: str = Field(min_length=2, max_length=64)


class AuditEventOut(BaseModel):
    id: UUID
    actor_user_id: UUID | None
    action: str
    target_type: str | None
    target_id: str | None
    outcome: str
    metadata: dict | None = Field(validation_alias="metadata_json")
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}
