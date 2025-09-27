"""
Booking schemas.
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, validator

from app.models.enums import BookingStatus, PaymentStatus


class BookingServiceBase(BaseModel):
    """Base booking service schema."""

    service_id: str = Field(..., description="Service ID")
    quantity: int = Field(default=1, ge=1, description="Quantity")
    unit_price: Decimal = Field(..., ge=0, description="Unit price")
    notes: Optional[str] = Field(None, description="Notes")


class BookingServiceCreate(BookingServiceBase):
    """Schema for creating booking service."""
    pass


class BookingService(BookingServiceBase):
    """Booking service response schema."""

    id: str
    booking_id: str
    total_price: Decimal
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: float(v)
        }


class BookingProductBase(BaseModel):
    """Base booking product schema."""

    product_id: str = Field(..., description="Product ID")
    quantity: int = Field(..., ge=1, description="Quantity")
    unit_price: Decimal = Field(..., ge=0, description="Unit price")


class BookingProductCreate(BookingProductBase):
    """Schema for creating booking product."""
    pass


class BookingProduct(BookingProductBase):
    """Booking product response schema."""

    id: str
    booking_id: str
    total_price: Decimal
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: float(v)
        }


class BookingBase(BaseModel):
    """Base booking schema."""

    customer_notes: Optional[str] = Field(None, description="Customer notes")
    special_requests: Optional[str] = Field(None, description="Special requests")


class BookingCreate(BookingBase):
    """Schema for creating a booking."""

    loctician_id: str = Field(..., description="Loctician ID")
    service_id: str = Field(..., description="Service ID")
    appointment_start: datetime = Field(..., description="Appointment start time")
    additional_services: Optional[List[BookingServiceCreate]] = Field(
        default=[], description="Additional services"
    )
    additional_products: Optional[List[BookingProductCreate]] = Field(
        default=[], description="Additional products"
    )

    @validator("appointment_start")
    def validate_appointment_time(cls, v):
        if v <= datetime.utcnow():
            raise ValueError("Appointment must be in the future")
        return v


class BookingUpdate(BookingBase):
    """Schema for updating a booking."""

    appointment_start: Optional[datetime] = Field(None, description="Appointment start time")
    loctician_notes: Optional[str] = Field(None, description="Loctician notes")
    admin_notes: Optional[str] = Field(None, description="Admin notes")

    @validator("appointment_start")
    def validate_appointment_time(cls, v):
        if v and v <= datetime.utcnow():
            raise ValueError("Appointment must be in the future")
        return v


class BookingStatusUpdate(BaseModel):
    """Schema for updating booking status."""

    status: BookingStatus = Field(..., description="New booking status")
    reason: Optional[str] = Field(None, description="Reason for status change")


class BookingCancellation(BaseModel):
    """Schema for booking cancellation."""

    reason: str = Field(..., description="Cancellation reason")
    cancellation_fee: Decimal = Field(default=0, ge=0, description="Cancellation fee")


class BookingStateChange(BaseModel):
    """Booking state change schema."""

    id: str
    booking_id: str
    previous_status: Optional[BookingStatus]
    new_status: BookingStatus
    reason: Optional[str]
    changed_by: Optional[str]
    changed_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class Booking(BookingBase):
    """Booking response schema."""

    id: str
    booking_number: str
    customer_id: str
    loctician_id: str
    service_id: str
    appointment_start: datetime
    appointment_end: datetime
    duration_minutes: int
    status: BookingStatus
    payment_status: PaymentStatus
    service_price: Decimal
    additional_charges: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    loctician_notes: Optional[str]
    admin_notes: Optional[str]
    confirmation_sent_at: Optional[datetime]
    reminder_sent_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    cancelled_by: Optional[str]
    cancellation_reason: Optional[str]
    cancellation_fee: Decimal
    created_at: datetime
    updated_at: datetime
    booking_services: List[BookingService] = []
    booking_products: List[BookingProduct] = []
    state_changes: List[BookingStateChange] = []

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: float(v)
        }


class BookingSummary(BaseModel):
    """Booking summary schema for lists."""

    id: str
    booking_number: str
    appointment_start: datetime
    appointment_end: datetime
    status: BookingStatus
    payment_status: PaymentStatus
    total_amount: Decimal
    customer_name: str
    loctician_name: str
    service_name: str

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: float(v)
        }


class BookingSearch(BaseModel):
    """Booking search result schema."""

    booking_id: str
    booking_number: str
    customer_name: str
    loctician_name: str
    service_name: str
    appointment_date: datetime
    status: BookingStatus
    total_amount: Decimal
    search_rank: float

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: float(v)
        }


class AvailabilitySlot(BaseModel):
    """Availability slot schema."""

    slot_start: datetime
    slot_end: datetime
    is_available: bool

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class AvailabilityCheck(BaseModel):
    """Availability check request schema."""

    loctician_id: str = Field(..., description="Loctician ID")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    service_duration: int = Field(..., ge=1, description="Service duration in minutes")
    slot_interval: int = Field(default=30, ge=15, description="Slot interval in minutes")

    @validator("date")
    def validate_date_format(cls, v):
        try:
            datetime.strptime(v, "%Y-%m-%d")
            return v
        except ValueError:
            raise ValueError("Date must be in YYYY-MM-DD format")