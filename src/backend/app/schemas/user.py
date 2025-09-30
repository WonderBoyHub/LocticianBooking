"""
User schemas.
"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import UserRole, UserStatus


class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr = Field(..., description="User email address")
    first_name: str = Field(..., min_length=1, max_length=100, description="First name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Last name")
    phone: Optional[str] = Field(None, max_length=20, description="Phone number")
    date_of_birth: Optional[date] = Field(None, description="Date of birth")
    street_address: Optional[str] = Field(None, description="Street address")
    city: Optional[str] = Field(None, max_length=100, description="City")
    postal_code: Optional[str] = Field(None, max_length=20, description="Postal code")
    country: str = Field(default="DK", max_length=2, description="Country code")
    preferred_language: str = Field(default="da", max_length=5, description="Preferred language")
    timezone: str = Field(default="Europe/Copenhagen", max_length=50, description="Timezone")
    marketing_consent: bool = Field(default=False, description="Marketing consent")


class UserCreate(UserBase):
    """Schema for creating a new user."""

    password: str = Field(..., min_length=8, description="Password")
    role: UserRole = Field(default=UserRole.CUSTOMER, description="User role")
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


class UserUpdate(BaseModel):
    """Schema for updating a user."""

    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[date] = None
    street_address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=2)
    preferred_language: Optional[str] = Field(None, max_length=5)
    timezone: Optional[str] = Field(None, max_length=50)
    marketing_consent: Optional[bool] = None


class UserProfileBase(BaseModel):
    """Base user profile schema."""

    bio: Optional[str] = Field(None, description="User biography")
    profile_image_url: Optional[str] = Field(None, description="Profile image URL")
    instagram_handle: Optional[str] = Field(None, max_length=50, description="Instagram handle")
    website_url: Optional[str] = Field(None, description="Website URL")


class UserProfileCreate(UserProfileBase):
    """Schema for creating a user profile."""

    # Loctician-specific fields
    specializations: Optional[List[str]] = Field(None, description="Specializations")
    years_experience: Optional[int] = Field(None, ge=0, description="Years of experience")
    certifications: Optional[List[str]] = Field(None, description="Certifications")
    business_hours: Optional[dict] = Field(None, description="Business hours")

    # Customer-specific fields
    hair_type: Optional[str] = Field(None, max_length=50, description="Hair type")
    hair_length: Optional[str] = Field(None, max_length=20, description="Hair length")
    allergies: Optional[List[str]] = Field(None, description="Allergies")
    notes: Optional[str] = Field(None, description="Additional notes")


class UserProfileUpdate(UserProfileBase):
    """Schema for updating a user profile."""

    # Loctician-specific fields
    specializations: Optional[List[str]] = None
    years_experience: Optional[int] = Field(None, ge=0)
    certifications: Optional[List[str]] = None
    business_hours: Optional[dict] = None

    # Customer-specific fields
    hair_type: Optional[str] = Field(None, max_length=50)
    hair_length: Optional[str] = Field(None, max_length=20)
    allergies: Optional[List[str]] = None
    notes: Optional[str] = None


class UserProfile(UserProfileBase):
    """User profile response schema."""

    user_id: str
    specializations: Optional[List[str]] = None
    years_experience: Optional[int] = None
    certifications: Optional[List[str]] = None
    business_hours: Optional[dict] = None
    hair_type: Optional[str] = None
    hair_length: Optional[str] = None
    allergies: Optional[List[str]] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class User(UserBase):
    """User response schema."""

    id: str
    role: UserRole
    status: UserStatus
    email_verified: bool
    data_retention_until: Optional[datetime] = None
    gdpr_consent_date: Optional[datetime] = None
    gdpr_consent_version: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    profile: Optional[UserProfile] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class UserWithProfile(User):
    """Detailed user schema that always includes profile information when available."""
    profile: Optional[UserProfile] = None


class UserSummary(BaseModel):
    """User summary schema for lists."""

    id: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    status: UserStatus
    email_verified: bool
    last_login_at: Optional[datetime] = None

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class UserSearch(BaseModel):
    """User search result schema."""

    id: str
    email: str
    full_name: str
    role: UserRole
    status: UserStatus
    last_visit: Optional[date] = None
    total_bookings: int = 0
    search_rank: float = 0.0

    class Config:
        from_attributes = True


class GDPRDataExport(BaseModel):
    """GDPR data export schema."""

    export_date: datetime
    user_id: str
    personal_data: dict
    profile_data: Optional[dict] = None
    booking_history: List[dict] = []
    recent_sessions: List[dict] = []

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
