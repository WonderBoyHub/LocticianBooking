"""
User and profile models.
"""
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    String,
    Text,
    Integer,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import UserRole, UserStatus
from app.models.mixins import FullAuditModel


class User(Base, FullAuditModel):
    """User model matching the PostgreSQL schema."""

    __tablename__ = "users"

    # Basic information
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(default=UserRole.CUSTOMER, nullable=False)
    status: Mapped[UserStatus] = mapped_column(default=UserStatus.ACTIVE, nullable=False)

    # Personal information (GDPR sensitive)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Address information
    street_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    country: Mapped[str] = mapped_column(String(2), default="DK", nullable=False)

    # Preferences
    preferred_language: Mapped[str] = mapped_column(String(5), default="da", nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Copenhagen", nullable=False)
    marketing_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # GDPR compliance fields
    data_retention_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    gdpr_consent_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    gdpr_consent_version: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Audit fields
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    profile: Mapped[Optional["UserProfile"]] = relationship(
        "UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    # Bookings as customer
    customer_bookings: Mapped[List["Booking"]] = relationship(
        "Booking", foreign_keys="Booking.customer_id", back_populates="customer"
    )

    # Bookings as loctician
    loctician_bookings: Mapped[List["Booking"]] = relationship(
        "Booking", foreign_keys="Booking.loctician_id", back_populates="loctician"
    )

    # Availability patterns
    availability_patterns: Mapped[List["AvailabilityPattern"]] = relationship(
        "AvailabilityPattern", back_populates="loctician"
    )

    # Availability overrides
    availability_overrides: Mapped[List["AvailabilityOverride"]] = relationship(
        "AvailabilityOverride", back_populates="loctician"
    )

    # Calendar events
    calendar_events: Mapped[List["CalendarEvent"]] = relationship(
        "CalendarEvent", back_populates="loctician"
    )

    @property
    def full_name(self) -> str:
        """Get user's full name."""
        return f"{self.first_name} {self.last_name}"

    @property
    def is_loctician(self) -> bool:
        """Check if user is a loctician."""
        return self.role == UserRole.LOCTICIAN

    @property
    def is_admin(self) -> bool:
        """Check if user is an admin."""
        return self.role == UserRole.ADMIN

    @property
    def is_staff(self) -> bool:
        """Check if user is staff."""
        return self.role == UserRole.STAFF

    @property
    def is_staff_or_admin(self) -> bool:
        """Check if user is staff or admin."""
        return self.role in [UserRole.STAFF, UserRole.ADMIN]

    @property
    def is_customer(self) -> bool:
        """Check if user is a customer."""
        return self.role == UserRole.CUSTOMER

    @property
    def is_active(self) -> bool:
        """Check if user is active."""
        return self.status == UserStatus.ACTIVE and not self.is_deleted

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"


class UserProfile(Base, FullAuditModel):
    """User profile model for additional information."""

    __tablename__ = "user_profiles"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # General profile information
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instagram_handle: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Loctician-specific fields
    specializations: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text), nullable=True)
    years_experience: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    certifications: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text), nullable=True)
    business_hours: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Customer-specific fields
    hair_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    hair_length: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    allergies: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="profile")

    def __repr__(self) -> str:
        return f"<UserProfile(user_id={self.user_id})>"