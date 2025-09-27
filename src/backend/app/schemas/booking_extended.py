"""
Extended booking schemas supporting both guest and authenticated users.
"""
from datetime import datetime, date as DateType, time
from decimal import Decimal
from typing import List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, validator, root_validator


# Guest Contact Information
class GuestContactInfo(BaseModel):
    """Guest contact information for non-authenticated bookings."""
    email: str = Field(..., max_length=255, description="Guest email address")
    first_name: str = Field(..., max_length=100, description="Guest first name")
    last_name: str = Field(..., max_length=100, description="Guest last name")
    phone: Optional[str] = Field(None, max_length=20, description="Guest phone number")

    @validator('email')
    def validate_email(cls, v):
        import re
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Invalid email format')
        return v.lower()


# Service Information
class ServiceInfo(BaseModel):
    """Service information for bookings."""
    id: int
    name: str
    description: Optional[str] = None
    duration_minutes: int
    price: Decimal
    requires_subscription: bool = False

    class Config:
        from_attributes = True


# Booking Status
class BookingStatusInfo(BaseModel):
    """Booking status information."""
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


# Base Booking Models
class BookingBase(BaseModel):
    """Base booking model with common fields."""
    service_id: int = Field(..., description="Service ID")
    booking_date: DateType = Field(..., description="Booking date")
    booking_time: time = Field(..., description="Booking time")
    duration_minutes: int = Field(..., gt=0, description="Duration in minutes")
    total_price: Decimal = Field(..., ge=0, description="Total price")
    notes: Optional[str] = Field(None, description="Customer notes")

    @validator('booking_date')
    def validate_booking_date(cls, v):
        if v < DateType.today():
            raise ValueError('Booking date cannot be in the past')
        return v

    @root_validator
    def validate_booking_datetime(cls, values):
        """Validate that booking datetime is in the future."""
        booking_date = values.get('booking_date')
        booking_time = values.get('booking_time')

        if booking_date and booking_time:
            booking_datetime = datetime.combine(booking_date, booking_time)
            if booking_datetime <= datetime.now():
                raise ValueError('Booking must be at least 1 hour in the future')

        return values


# Guest Booking Models
class GuestBookingCreate(BookingBase):
    """Schema for creating a guest booking."""
    guest_info: GuestContactInfo = Field(..., description="Guest contact information")

    class Config:
        schema_extra = {
            "example": {
                "service_id": 1,
                "booking_date": "2025-01-15",
                "booking_time": "14:30:00",
                "duration_minutes": 60,
                "total_price": 150.00,
                "notes": "First time client",
                "guest_info": {
                    "email": "guest@example.com",
                    "first_name": "John",
                    "last_name": "Doe",
                    "phone": "+1234567890"
                }
            }
        }


# User Booking Models
class UserBookingCreate(BookingBase):
    """Schema for creating a user booking (authenticated)."""

    class Config:
        schema_extra = {
            "example": {
                "service_id": 1,
                "booking_date": "2025-01-15",
                "booking_time": "14:30:00",
                "duration_minutes": 60,
                "total_price": 120.00,  # Potentially discounted for subscribers
                "notes": "Regular client appointment"
            }
        }


# Combined Booking Create (for API flexibility)
class BookingCreateRequest(BaseModel):
    """Flexible booking creation that supports both guest and user bookings."""
    service_id: int = Field(..., description="Service ID")
    booking_date: DateType = Field(..., description="Booking date")
    booking_time: time = Field(..., description="Booking time")
    notes: Optional[str] = Field(None, description="Customer notes")

    # Guest information (required only for guest bookings)
    guest_info: Optional[GuestContactInfo] = Field(None, description="Guest contact information")

    @validator('booking_date')
    def validate_booking_date(cls, v):
        if v < DateType.today():
            raise ValueError('Booking date cannot be in the past')
        return v

    @root_validator
    def validate_booking_request(cls, values):
        """Validate booking request based on authentication status."""
        booking_date = values.get('booking_date')
        booking_time = values.get('booking_time')

        if booking_date and booking_time:
            booking_datetime = datetime.combine(booking_date, booking_time)
            if booking_datetime <= datetime.now():
                raise ValueError('Booking must be at least 1 hour in the future')

        return values


# Booking Update Models
class BookingUpdate(BaseModel):
    """Schema for updating a booking."""
    booking_date: Optional[DateType] = None
    booking_time: Optional[time] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None  # Staff-only notes

    @validator('booking_date')
    def validate_booking_date(cls, v):
        if v and v < DateType.today():
            raise ValueError('Booking date cannot be in the past')
        return v


class BookingStatusUpdate(BaseModel):
    """Schema for updating booking status."""
    status_id: int = Field(..., description="New status ID")
    change_reason: Optional[str] = Field(None, description="Reason for status change")


# Complete Booking Models
class BookingResponse(BaseModel):
    """Complete booking response model."""
    id: UUID

    # User information (nullable for guest bookings)
    user_id: Optional[UUID] = None

    # Guest information (for guest bookings)
    guest_email: Optional[str] = None
    guest_first_name: Optional[str] = None
    guest_last_name: Optional[str] = None
    guest_phone: Optional[str] = None

    # Service and scheduling
    service_id: int
    booking_date: DateType
    booking_time: time
    duration_minutes: int

    # Status and pricing
    status_id: int
    total_price: Decimal

    # Additional information
    notes: Optional[str] = None
    internal_notes: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    # Relationships
    service: Optional[ServiceInfo] = None
    status: Optional[BookingStatusInfo] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            DateType: lambda v: v.isoformat(),
            time: lambda v: v.isoformat(),
            Decimal: lambda v: float(v)
        }


class BookingSummary(BaseModel):
    """Booking summary for list views."""
    id: UUID
    booking_date: DateType
    booking_time: time
    duration_minutes: int
    total_price: Decimal
    service_name: str
    customer_name: str  # Combined name for both guest and user bookings
    customer_email: str
    status_name: str
    is_guest_booking: bool

    class Config:
        json_encoders = {
            DateType: lambda v: v.isoformat(),
            time: lambda v: v.isoformat(),
            Decimal: lambda v: float(v)
        }


# Contact Information Response (unified for guest and user bookings)
class BookingContactInfo(BaseModel):
    """Unified contact information for any booking."""
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    full_name: str
    is_user_booking: bool

    @validator('full_name', pre=True, always=True)
    def create_full_name(cls, v, values):
        first_name = values.get('first_name', '')
        last_name = values.get('last_name', '')
        return f"{first_name} {last_name}".strip()


# Availability Models
class AvailabilitySlot(BaseModel):
    """Available time slot."""
    date: DateType
    start_time: time
    end_time: time
    duration_minutes: int
    is_available: bool

    class Config:
        json_encoders = {
            DateType: lambda v: v.isoformat(),
            time: lambda v: v.isoformat()
        }


class AvailabilityRequest(BaseModel):
    """Request for checking availability."""
    service_id: int = Field(..., description="Service ID")
    start_date: DateType = Field(..., description="Start date for availability check")
    end_date: Optional[DateType] = Field(None, description="End date for availability check")
    min_duration: Optional[int] = Field(None, ge=15, description="Minimum slot duration in minutes")

    @validator('end_date')
    def validate_date_range(cls, v, values):
        if v and 'start_date' in values and v < values['start_date']:
            raise ValueError('End date must be after start date')
        return v

    @validator('start_date')
    def validate_start_date(cls, v):
        if v < DateType.today():
            raise ValueError('Start date cannot be in the past')
        return v


class AvailabilityResponse(BaseModel):
    """Response with available slots."""
    service_id: int
    service_name: str
    requested_date_range: dict
    available_slots: List[AvailabilitySlot]
    total_slots: int


# Booking Conflict Check
class ConflictCheckRequest(BaseModel):
    """Request to check for booking conflicts."""
    service_id: int
    booking_date: DateType
    booking_time: time
    duration_minutes: int
    exclude_booking_id: Optional[UUID] = None


class ConflictCheckResponse(BaseModel):
    """Response for booking conflict check."""
    has_conflict: bool
    conflicting_bookings: List[BookingSummary] = []
    suggested_times: List[AvailabilitySlot] = []