"""
Authentication schemas.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, ValidationInfo, field_validator

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    """Login request schema."""

    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password")


class LoginResponse(BaseModel):
    """Login response schema."""

    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration in seconds")
    user_id: str = Field(..., description="User ID")
    role: str = Field(..., description="User role")
    email: str = Field(..., description="User email")


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema."""

    refresh_token: str = Field(..., description="Refresh token")


class RefreshTokenResponse(BaseModel):
    """Refresh token response schema."""

    access_token: str = Field(..., description="New JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration in seconds")


class PasswordChangeRequest(BaseModel):
    """Password change request schema."""

    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")
    confirm_password: str = Field(..., description="Confirm new password")

    @field_validator("confirm_password")
    def passwords_match(cls, v: str, info: ValidationInfo) -> str:
        new_password = info.data.get("new_password") if info.data else None
        if new_password is not None and v != new_password:
            raise ValueError("Passwords do not match")
        return v


class PasswordResetRequest(BaseModel):
    """Password reset request schema."""

    email: EmailStr = Field(..., description="User email address")


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation schema."""

    token: str = Field(..., description="Reset token")
    new_password: str = Field(..., min_length=8, description="New password")
    confirm_password: str = Field(..., description="Confirm new password")

    @field_validator("confirm_password")
    def passwords_match(cls, v: str, info: ValidationInfo) -> str:
        new_password = info.data.get("new_password") if info.data else None
        if new_password is not None and v != new_password:
            raise ValueError("Passwords do not match")
        return v


class EmailVerificationRequest(BaseModel):
    """Email verification request schema."""

    token: str = Field(..., description="Verification token")


class RegisterRequest(BaseModel):
    """User registration request schema."""

    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="Password")
    confirm_password: str = Field(..., description="Confirm password")
    first_name: str = Field(..., min_length=1, max_length=100, description="First name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Last name")
    phone: Optional[str] = Field(None, max_length=20, description="Phone number")
    role: UserRole = Field(default=UserRole.CUSTOMER, description="User role")
    marketing_consent: bool = Field(default=False, description="Marketing consent")
    gdpr_consent: bool = Field(..., description="GDPR consent required")

    @field_validator("password")
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("confirm_password")
    def passwords_match(cls, v: str, info: ValidationInfo) -> str:
        password = info.data.get("password") if info.data else None
        if password is not None and v != password:
            raise ValueError("Passwords do not match")
        return v

    @field_validator("gdpr_consent")
    def validate_gdpr_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("GDPR consent is required")
        return v


class RegisterResponse(BaseModel):
    """User registration response schema."""

    user_id: str = Field(..., description="Created user ID")
    email: str = Field(..., description="User email")
    message: str = Field(..., description="Registration status message")
    email_verification_required: bool = Field(True, description="Whether email verification is required")


class TokenInfo(BaseModel):
    """Token information schema."""

    token_type: str = Field(..., description="Token type")
    user_id: str = Field(..., description="User ID")
    role: str = Field(..., description="User role")
    issued_at: datetime = Field(..., description="Token issued at")
    expires_at: datetime = Field(..., description="Token expires at")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }