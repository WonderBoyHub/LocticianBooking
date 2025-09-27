"""
Availability pattern and override schemas.
"""
from datetime import date as DateType, time, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator

from app.models.enums import CalendarEventType


# Availability Pattern Schemas
class AvailabilityPatternBase(BaseModel):
    """Base availability pattern schema."""
    day_of_week: int = Field(..., ge=0, le=6, description="0=Sunday, 1=Monday, etc.")
    start_time: time = Field(..., description="Start time")
    end_time: time = Field(..., description="End time")
    effective_from: DateType = Field(..., description="Effective from date")
    effective_until: Optional[DateType] = Field(None, description="Effective until date")
    is_active: bool = Field(default=True, description="Is pattern active")

    @validator('end_time')
    def validate_end_time(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('End time must be after start time')
        return v

    @validator('effective_until')
    def validate_effective_until(cls, v, values):
        if v and 'effective_from' in values and v <= values['effective_from']:
            raise ValueError('Effective until must be after effective from')
        return v


class AvailabilityPatternCreate(AvailabilityPatternBase):
    """Schema for creating availability pattern."""
    loctician_id: str = Field(..., description="Loctician ID")


class AvailabilityPatternUpdate(BaseModel):
    """Schema for updating availability pattern."""
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    effective_from: Optional[DateType] = None
    effective_until: Optional[DateType] = None
    is_active: Optional[bool] = None

    @validator('end_time')
    def validate_end_time(cls, v, values):
        if v and 'start_time' in values and values['start_time'] and v <= values['start_time']:
            raise ValueError('End time must be after start time')
        return v


class AvailabilityPattern(AvailabilityPatternBase):
    """Complete availability pattern schema."""
    id: str
    loctician_id: str
    day_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            DateType: lambda v: v.isoformat(),
            time: lambda v: v.strftime('%H:%M:%S')
        }


# Availability Override Schemas
class AvailabilityOverrideBase(BaseModel):
    """Base availability override schema."""
    date: DateType = Field(..., description="Override date")
    start_time: Optional[time] = Field(None, description="Start time (null for unavailable)")
    end_time: Optional[time] = Field(None, description="End time (null for unavailable)")
    is_available: bool = Field(default=True, description="Is available on this date")
    reason: Optional[str] = Field(None, max_length=200, description="Reason for override")

    @validator('end_time')
    def validate_end_time(cls, v, values):
        if v and 'start_time' in values and values['start_time'] and v <= values['start_time']:
            raise ValueError('End time must be after start time')
        return v

    @validator('start_time')
    def validate_availability_times(cls, v, values):
        is_available = values.get('is_available', True)
        if is_available and not v:
            raise ValueError('Start time required when is_available is True')
        return v


class AvailabilityOverrideCreate(AvailabilityOverrideBase):
    """Schema for creating availability override."""
    loctician_id: str = Field(..., description="Loctician ID")


class AvailabilityOverrideUpdate(BaseModel):
    """Schema for updating availability override."""
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_available: Optional[bool] = None
    reason: Optional[str] = Field(None, max_length=200)

    @validator('end_time')
    def validate_end_time(cls, v, values):
        if v and 'start_time' in values and values['start_time'] and v <= values['start_time']:
            raise ValueError('End time must be after start time')
        return v


class AvailabilityOverride(AvailabilityOverrideBase):
    """Complete availability override schema."""
    id: str
    loctician_id: str
    created_by: Optional[str]
    is_blocking: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            DateType: lambda v: v.isoformat(),
            time: lambda v: v.strftime('%H:%M:%S') if v else None
        }


# Calendar Event Schemas
class CalendarEventBase(BaseModel):
    """Base calendar event schema."""
    title: str = Field(..., min_length=1, max_length=200, description="Event title")
    description: Optional[str] = Field(None, description="Event description")
    event_type: CalendarEventType = Field(..., description="Event type")
    start_datetime: datetime = Field(..., description="Event start datetime")
    end_datetime: datetime = Field(..., description="Event end datetime")
    is_recurring: bool = Field(default=False, description="Is recurring event")
    recurrence_rule: Optional[str] = Field(None, description="RRULE format recurrence")
    is_public: bool = Field(default=False, description="Is publicly visible")

    @validator('end_datetime')
    def validate_end_datetime(cls, v, values):
        if 'start_datetime' in values and v <= values['start_datetime']:
            raise ValueError('End datetime must be after start datetime')
        return v

    @validator('recurrence_rule')
    def validate_recurrence_rule(cls, v, values):
        if values.get('is_recurring') and not v:
            raise ValueError('Recurrence rule required for recurring events')
        return v


class CalendarEventCreate(CalendarEventBase):
    """Schema for creating calendar event."""
    loctician_id: str = Field(..., description="Loctician ID")


class CalendarEventUpdate(BaseModel):
    """Schema for updating calendar event."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    event_type: Optional[CalendarEventType] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    is_recurring: Optional[bool] = None
    recurrence_rule: Optional[str] = None
    is_public: Optional[bool] = None

    @validator('end_datetime')
    def validate_end_datetime(cls, v, values):
        if v and 'start_datetime' in values and values['start_datetime'] and v <= values['start_datetime']:
            raise ValueError('End datetime must be after start datetime')
        return v


class CalendarEvent(CalendarEventBase):
    """Complete calendar event schema."""
    id: str
    loctician_id: str
    created_by: Optional[str]
    event_type_display: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Availability Check Schemas
class AvailabilitySlot(BaseModel):
    """Individual availability slot."""
    start_time: datetime
    end_time: datetime
    is_available: bool
    reason: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class DayAvailability(BaseModel):
    """Full day availability information."""
    date: DateType
    is_working_day: bool
    slots: List[AvailabilitySlot] = []
    total_available_minutes: int = 0
    business_hours_start: Optional[time] = None
    business_hours_end: Optional[time] = None

    class Config:
        json_encoders = {
            DateType: lambda v: v.isoformat(),
            time: lambda v: v.strftime('%H:%M:%S') if v else None
        }


class WeeklyAvailability(BaseModel):
    """Weekly availability overview."""
    start_date: DateType
    end_date: DateType
    days: List[DayAvailability]
    total_working_days: int
    total_available_hours: float

    class Config:
        json_encoders = {
            DateType: lambda v: v.isoformat()
        }


class AvailabilityRequest(BaseModel):
    """Availability check request."""
    loctician_id: str = Field(..., description="Loctician ID")
    start_date: DateType = Field(..., description="Start date")
    end_date: DateType = Field(..., description="End date")
    service_duration_minutes: int = Field(..., gt=0, description="Service duration in minutes")
    buffer_minutes: int = Field(default=15, ge=0, description="Buffer time in minutes")
    slot_interval_minutes: int = Field(default=30, ge=15, description="Time slot intervals")

    @validator('end_date')
    def validate_end_date(cls, v, values):
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('End date must be after or equal to start date')
        return v

    @validator('start_date')
    def validate_start_date(cls, v):
        if v < DateType.today():
            raise ValueError('Start date cannot be in the past')
        return v


# Bulk Operations
class BulkAvailabilityPatternCreate(BaseModel):
    """Bulk create availability patterns."""
    loctician_id: str = Field(..., description="Loctician ID")
    patterns: List[AvailabilityPatternBase] = Field(..., min_items=1, description="Patterns to create")


class BulkAvailabilityOverrideCreate(BaseModel):
    """Bulk create availability overrides."""
    loctician_id: str = Field(..., description="Loctician ID")
    overrides: List[AvailabilityOverrideBase] = Field(..., min_items=1, description="Overrides to create")


class CalendarConflictCheck(BaseModel):
    """Calendar conflict checking."""
    loctician_id: str = Field(..., description="Loctician ID")
    start_datetime: datetime = Field(..., description="Proposed start datetime")
    end_datetime: datetime = Field(..., description="Proposed end datetime")
    exclude_booking_id: Optional[str] = Field(None, description="Booking ID to exclude from conflict check")

    @validator('end_datetime')
    def validate_end_datetime(cls, v, values):
        if 'start_datetime' in values and v <= values['start_datetime']:
            raise ValueError('End datetime must be after start datetime')
        return v


class ConflictResult(BaseModel):
    """Conflict check result."""
    has_conflict: bool
    conflicts: List[str] = []  # List of conflict descriptions
    suggested_slots: List[AvailabilitySlot] = []

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
