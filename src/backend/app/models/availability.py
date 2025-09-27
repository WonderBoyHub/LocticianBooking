"""
Availability pattern and override models.
"""
from datetime import date, time
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import BaseModel


class AvailabilityPattern(Base, BaseModel):
    """Recurring availability patterns for locticians."""

    __tablename__ = "availability_patterns"

    loctician_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=False,
    )
    day_of_week: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # 0=Sunday, 1=Monday, etc.
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Effective date range
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Relationships
    loctician: Mapped["User"] = relationship(
        "User", back_populates="availability_patterns"
    )

    # Constraints
    __table_args__ = (
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="chk_day_of_week"),
        CheckConstraint("start_time < end_time", name="chk_start_before_end"),
        UniqueConstraint(
            "loctician_id",
            "day_of_week",
            "start_time",
            "effective_from",
            name="uq_availability_pattern",
        ),
    )

    @property
    def day_name(self) -> str:
        """Get the day name from day_of_week."""
        days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ]
        return days[self.day_of_week]

    def __repr__(self) -> str:
        return f"<AvailabilityPattern(loctician_id={self.loctician_id}, day={self.day_of_week}, time={self.start_time}-{self.end_time})>"


class AvailabilityOverride(Base, BaseModel):
    """Specific availability overrides for particular dates."""

    __tablename__ = "availability_overrides"

    loctician_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=False,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    created_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    loctician: Mapped["User"] = relationship(
        "User",
        back_populates="availability_overrides",
        foreign_keys=[loctician_id]
    )

    creator: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by]
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "(is_available = false) OR "
            "(is_available = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)",
            name="chk_availability_override_times",
        ),
        UniqueConstraint("loctician_id", "date", name="uq_availability_override"),
    )

    @property
    def is_blocking(self) -> bool:
        """Check if this override blocks availability."""
        return not self.is_available

    def __repr__(self) -> str:
        return f"<AvailabilityOverride(loctician_id={self.loctician_id}, date={self.date}, available={self.is_available})>"