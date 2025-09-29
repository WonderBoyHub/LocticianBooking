"""Pydantic schemas for calendar management."""
from datetime import date as DateType, datetime, time
from typing import List, Optional, Any, Dict
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, Field


class DayOfWeek(Enum):
    """Day of week enumeration."""
    SUNDAY = 0
    MONDAY = 1
    TUESDAY = 2
    WEDNESDAY = 3
    THURSDAY = 4
    FRIDAY = 5
    SATURDAY = 6


class CalendarResponse(BaseModel):
    """Generic calendar operation response."""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


class BulkOverrideCreate(BaseModel):
    """Bulk override creation schema."""
    loctician_id: str
    dates: List[DateType]
    is_available: bool = True
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    reason: Optional[str] = None


class ViewType(Enum):
    """Calendar view types."""
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class AvailabilityCheck(BaseModel):
    """Availability check request."""
    loctician_id: str
    date: DateType
    service_duration_minutes: int


class AvailabilityResponse(BaseModel):
    """Availability check response."""
    is_available: bool
    slots: List = []


class ConflictCheck(BaseModel):
    """Conflict check request."""
    loctician_id: str
    start_datetime: datetime
    end_datetime: datetime


class ScheduleItem(BaseModel):
    """Schedule item."""
    id: str
    title: str
    start_time: datetime
    end_time: datetime
    type: str


class ScheduleView(BaseModel):
    """Schedule view."""
    loctician_id: str
    start_date: DateType
    end_date: DateType
    items: List[ScheduleItem] = []


class RecurrenceRule(BaseModel):
    """Recurrence rule."""
    frequency: str
    interval: int = 1


class CalendarWebSocketMessage(BaseModel):
    """WebSocket message."""
    type: str
    data: Dict[str, Any]


class ICalExport(BaseModel):
    """iCal export."""
    calendar_data: str

class AvailabilityPatternBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: time
    end_time: time
    effective_from: DateType = Field(default_factory=DateType.today)
    effective_until: Optional[DateType] = None
    is_active: bool = True

class AvailabilityPatternCreate(AvailabilityPatternBase):
    loctician_id: Optional[UUID] = None

class AvailabilityPatternResponse(AvailabilityPatternBase):
    id: UUID
    loctician_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class CalendarEventBase(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    event_type: str
    start_time: datetime
    end_time: datetime
    is_recurring: bool = False
    recurrence_rule: Optional[str] = None
    is_public: bool = False

class CalendarEventCreate(CalendarEventBase):
    loctician_id: Optional[UUID] = None

class CalendarEventResponse(CalendarEventBase):
    id: UUID
    loctician_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class AvailableSlot(BaseModel):
    start_time: datetime
    end_time: datetime
    duration_minutes: int

class BookingInfo(BaseModel):
    id: UUID
    start_time: datetime
    end_time: datetime
    status: str
    service_name: str
    customer_name: Optional[str]
    customer_phone: Optional[str]
    notes: Optional[str]

class EventInfo(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    event_type: str
    start_time: datetime
    end_time: datetime
    is_public: bool

class ScheduleView(BaseModel):
    loctician_id: UUID
    start_date: DateType
    end_date: DateType
    bookings: List[BookingInfo]
    events: List[EventInfo]

class AvailabilityOverrideBase(BaseModel):
    date: DateType
    is_available: bool = True
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    reason: Optional[str] = Field(None, max_length=200)

class AvailabilityOverrideCreate(AvailabilityOverrideBase):
    loctician_id: Optional[UUID] = None

class AvailabilityOverrideResponse(AvailabilityOverrideBase):
    id: UUID
    loctician_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True
