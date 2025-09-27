"""Pydantic schemas for calendar management."""
from datetime import date as DateType, datetime, time
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field

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
