"""
Service and service category models.
"""
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import BaseModel


class ServiceCategory(Base, BaseModel):
    """Service category model."""

    __tablename__ = "service_categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    services: Mapped[List["Service"]] = relationship(
        "Service", back_populates="category", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ServiceCategory(id={self.id}, name={self.name})>"


class Service(Base, BaseModel):
    """Service model."""

    __tablename__ = "services"

    category_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("service_categories.id"),
        nullable=True,
    )

    # Basic information
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    base_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )

    # Booking constraints
    min_advance_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    max_advance_days: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    buffer_before_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    buffer_after_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)

    # Service attributes
    requires_consultation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_addon_service: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_participants: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Visibility and availability
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_online_bookable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # SEO and content
    slug: Mapped[Optional[str]] = mapped_column(String(200), unique=True, nullable=True)
    meta_title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    meta_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    category: Mapped[Optional["ServiceCategory"]] = relationship(
        "ServiceCategory", back_populates="services"
    )

    bookings: Mapped[List["Booking"]] = relationship(
        "Booking", back_populates="service"
    )

    booking_services: Mapped[List["BookingService"]] = relationship(
        "BookingService", back_populates="service"
    )

    @property
    def total_duration_with_buffer(self) -> int:
        """Get total duration including buffers."""
        return self.duration_minutes + self.buffer_before_minutes + self.buffer_after_minutes

    @property
    def price_formatted(self) -> str:
        """Get formatted price string."""
        return f"{self.base_price:.2f} DKK"

    @property
    def category_name(self) -> Optional[str]:
        """Expose related category name for serializers."""
        return self.category.name if self.category else None

    def __repr__(self) -> str:
        return f"<Service(id={self.id}, name={self.name}, price={self.base_price})>"