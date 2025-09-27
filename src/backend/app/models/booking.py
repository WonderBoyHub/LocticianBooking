"""
Booking-related models.
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import BookingStatus, PaymentStatus
from app.models.mixins import AuditableModel, BaseModel


class Booking(Base, AuditableModel):
    """Main booking model."""

    __tablename__ = "bookings"

    booking_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    # Participants
    customer_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=False,
    )
    loctician_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=False,
    )

    # Service details
    service_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("services.id"),
        nullable=False,
    )

    # Timing (critical for double-booking prevention)
    appointment_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    appointment_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    # Status tracking
    status: Mapped[BookingStatus] = mapped_column(
        default=BookingStatus.PENDING, nullable=False
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        default=PaymentStatus.PENDING, nullable=False
    )

    # Pricing
    service_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    additional_charges: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=0, nullable=False
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=0, nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Customer information
    customer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    special_requests: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Internal notes
    loctician_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Confirmation and reminders
    confirmation_sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reminder_sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Cancellation handling
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True,
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cancellation_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=0, nullable=False
    )

    # Relationships
    customer: Mapped["User"] = relationship(
        "User",
        foreign_keys=[customer_id],
        back_populates="customer_bookings",
    )

    loctician: Mapped["User"] = relationship(
        "User",
        foreign_keys=[loctician_id],
        back_populates="loctician_bookings",
    )

    service: Mapped["Service"] = relationship(
        "Service",
        back_populates="bookings",
    )

    canceller: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[cancelled_by],
    )

    # Additional services and products
    booking_services: Mapped[List["BookingService"]] = relationship(
        "BookingService",
        back_populates="booking",
        cascade="all, delete-orphan",
    )

    booking_products: Mapped[List["BookingProduct"]] = relationship(
        "BookingProduct",
        back_populates="booking",
        cascade="all, delete-orphan",
    )

    # State changes
    state_changes: Mapped[List["BookingStateChange"]] = relationship(
        "BookingStateChange",
        back_populates="booking",
        cascade="all, delete-orphan",
    )

    # Constraints
    __table_args__ = (
        CheckConstraint("appointment_start < appointment_end", name="chk_appointment_times"),
        CheckConstraint("duration_minutes > 0", name="chk_duration_positive"),
        CheckConstraint("total_amount >= 0", name="chk_total_amount_positive"),
    )

    @property
    def is_active(self) -> bool:
        """Check if booking is active (not cancelled)."""
        return self.status != BookingStatus.CANCELLED

    @property
    def is_past(self) -> bool:
        """Check if booking is in the past."""
        return self.appointment_start < datetime.utcnow()

    @property
    def is_upcoming(self) -> bool:
        """Check if booking is upcoming."""
        return not self.is_past and self.is_active

    @property
    def can_be_cancelled(self) -> bool:
        """Check if booking can be cancelled."""
        return self.is_active and not self.is_past

    def calculate_total(self) -> Decimal:
        """Calculate total amount including services and products."""
        total = self.service_price + self.additional_charges - self.discount_amount

        # Add booking services
        for booking_service in self.booking_services:
            total += booking_service.total_price

        # Add booking products
        for booking_product in self.booking_products:
            total += booking_product.total_price

        return total

    def __repr__(self) -> str:
        return f"<Booking(id={self.id}, number={self.booking_number}, status={self.status})>"


class BookingService(Base, BaseModel):
    """Additional services added to a booking."""

    __tablename__ = "booking_services"

    booking_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
    )
    service_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("services.id"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    booking: Mapped["Booking"] = relationship(
        "Booking", back_populates="booking_services"
    )
    service: Mapped["Service"] = relationship(
        "Service", back_populates="booking_services"
    )

    # Constraints
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_booking_service_quantity"),
        CheckConstraint("unit_price >= 0", name="chk_booking_service_unit_price"),
        CheckConstraint("total_price >= 0", name="chk_booking_service_total_price"),
    )

    def __repr__(self) -> str:
        return f"<BookingService(booking_id={self.booking_id}, service_id={self.service_id})>"


class BookingProduct(Base, BaseModel):
    """Products sold during a booking."""

    __tablename__ = "booking_products"

    booking_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("products.id"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Relationships
    booking: Mapped["Booking"] = relationship(
        "Booking", back_populates="booking_products"
    )
    product: Mapped["Product"] = relationship(
        "Product", back_populates="booking_products"
    )

    # Constraints
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_booking_product_quantity"),
        CheckConstraint("unit_price >= 0", name="chk_booking_product_unit_price"),
        CheckConstraint("total_price >= 0", name="chk_booking_product_total_price"),
    )

    def __repr__(self) -> str:
        return f"<BookingProduct(booking_id={self.booking_id}, product_id={self.product_id})>"


class BookingStateChange(Base, BaseModel):
    """Track booking status changes for audit purposes."""

    __tablename__ = "booking_state_changes"

    booking_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("bookings.id"),
        nullable=False,
    )
    previous_status: Mapped[Optional[BookingStatus]] = mapped_column(nullable=True)
    new_status: Mapped[BookingStatus] = mapped_column(nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    changed_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True,
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationships
    booking: Mapped["Booking"] = relationship(
        "Booking", back_populates="state_changes"
    )
    changer: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[changed_by]
    )

    def __repr__(self) -> str:
        return f"<BookingStateChange(booking_id={self.booking_id}, {self.previous_status} -> {self.new_status})>"