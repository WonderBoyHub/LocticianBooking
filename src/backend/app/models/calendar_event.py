"""
Calendar event model.
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import TSTZRANGE, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import CalendarEventType
from app.models.mixins import BaseModel


class CalendarEvent(Base, BaseModel):
    """Calendar events (breaks, meetings, etc.) for locticians."""

    __tablename__ = "calendar_events"

    loctician_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_type: Mapped[CalendarEventType] = mapped_column(nullable=False)

    # Time range using PostgreSQL's tstzrange type
    time_range: Mapped[str] = mapped_column(TSTZRANGE, nullable=False)

    # Recurrence (if applicable)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recurrence_rule: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # RRULE format

    # Visibility
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    loctician: Mapped["User"] = relationship(
        "User",
        back_populates="calendar_events",
        foreign_keys=[loctician_id]
    )

    creator: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by]
    )

    @property
    def event_type_display(self) -> str:
        """Get display name for event type."""
        type_names = {
            CalendarEventType.BREAK: "Break",
            CalendarEventType.MEETING: "Meeting",
            CalendarEventType.VACATION: "Vacation",
            CalendarEventType.SICK_LEAVE: "Sick Leave",
            CalendarEventType.TRAINING: "Training",
            CalendarEventType.PERSONAL: "Personal",
        }
        return type_names.get(self.event_type, str(self.event_type))

    def __repr__(self) -> str:
        return f"<CalendarEvent(id={self.id}, title={self.title}, type={self.event_type})>"