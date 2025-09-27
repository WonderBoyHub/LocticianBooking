"""
Calendar management API endpoints for availability patterns, events, and scheduling.
"""
from datetime import date, datetime, time
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.dependencies import get_current_active_user, require_role
from app.models.user import User
from app.schemas.calendar import (
    AvailabilityPatternCreate,
    AvailabilityPatternResponse,
    CalendarEventCreate,
    CalendarEventResponse,
    AvailabilityOverrideCreate,
    AvailabilityOverrideResponse,
    AvailableSlot,
    ScheduleView
)

router = APIRouter()

@router.post("/availability-patterns", response_model=AvailabilityPatternResponse)
async def create_availability_pattern(
    pattern: AvailabilityPatternCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new recurring availability pattern."""
    # Ensure only locticians can manage their availability
    if current_user.role not in ['loctician', 'admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only locticians can manage availability patterns"
        )

    loctician_id = pattern.loctician_id or current_user.id
    if current_user.role != 'admin' and loctician_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot manage other loctician's availability"
        )

    query = """
    INSERT INTO availability_patterns (
        loctician_id, day_of_week, start_time, end_time,
        effective_from, effective_until, is_active
    ) VALUES (
        :loctician_id, :day_of_week, :start_time, :end_time,
        :effective_from, :effective_until, :is_active
    ) RETURNING id, created_at
    """

    result = await db.execute(text(query), {
        "loctician_id": loctician_id,
        "day_of_week": pattern.day_of_week,
        "start_time": pattern.start_time,
        "end_time": pattern.end_time,
        "effective_from": pattern.effective_from,
        "effective_until": pattern.effective_until,
        "is_active": pattern.is_active
    })

    row = result.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create availability pattern"
        )

    await db.commit()

    return AvailabilityPatternResponse(
        id=row.id,
        loctician_id=loctician_id,
        day_of_week=pattern.day_of_week,
        start_time=pattern.start_time,
        end_time=pattern.end_time,
        effective_from=pattern.effective_from,
        effective_until=pattern.effective_until,
        is_active=pattern.is_active,
        created_at=row.created_at
    )

@router.get("/availability-patterns", response_model=List[AvailabilityPatternResponse])
async def get_availability_patterns(
    loctician_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get availability patterns for a loctician."""
    target_loctician_id = loctician_id or current_user.id

    # Access control
    if current_user.role not in ['admin'] and target_loctician_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot view other loctician's availability patterns"
        )

    query = """
    SELECT id, loctician_id, day_of_week, start_time, end_time,
           effective_from, effective_until, is_active, created_at
    FROM availability_patterns
    WHERE loctician_id = :loctician_id
    ORDER BY day_of_week, start_time
    """

    result = await db.execute(text(query), {"loctician_id": target_loctician_id})
    patterns = result.fetchall()

    return [
        AvailabilityPatternResponse(
            id=row.id,
            loctician_id=row.loctician_id,
            day_of_week=row.day_of_week,
            start_time=row.start_time,
            end_time=row.end_time,
            effective_from=row.effective_from,
            effective_until=row.effective_until,
            is_active=row.is_active,
            created_at=row.created_at
        ) for row in patterns
    ]

@router.get("/available-slots", response_model=List[AvailableSlot])
async def get_available_slots(
    loctician_id: UUID,
    date: date,
    service_duration: int = Query(..., description="Service duration in minutes"),
    db: AsyncSession = Depends(get_db)
):
    """Get available time slots for a specific date and service duration."""
    query = """
    SELECT slot_start, slot_end, is_available
    FROM get_available_slots(:loctician_id, :date, :service_duration, 30)
    WHERE is_available = true
    ORDER BY slot_start
    """

    result = await db.execute(text(query), {
        "loctician_id": loctician_id,
        "date": date,
        "service_duration": service_duration
    })

    slots = result.fetchall()

    return [
        AvailableSlot(
            start_time=row.slot_start,
            end_time=row.slot_end,
            duration_minutes=service_duration
        ) for row in slots
    ]

@router.post("/events", response_model=CalendarEventResponse)
async def create_calendar_event(
    event: CalendarEventCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a calendar event (break, meeting, vacation, etc.)."""
    loctician_id = event.loctician_id or current_user.id

    # Access control
    if current_user.role not in ['admin'] and loctician_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create events for other locticians"
        )

    query = """
    INSERT INTO calendar_events (
        loctician_id, title, description, event_type, time_range,
        is_recurring, recurrence_rule, is_public, created_by
    ) VALUES (
        :loctician_id, :title, :description, :event_type,
        tstzrange(:start_time, :end_time),
        :is_recurring, :recurrence_rule, :is_public, :created_by
    ) RETURNING id, created_at
    """

    try:
        result = await db.execute(text(query), {
            "loctician_id": loctician_id,
            "title": event.title,
            "description": event.description,
            "event_type": event.event_type,
            "start_time": event.start_time,
            "end_time": event.end_time,
            "is_recurring": event.is_recurring,
            "recurrence_rule": event.recurrence_rule,
            "is_public": event.is_public,
            "created_by": current_user.id
        })

        row = result.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create calendar event"
            )

        await db.commit()

        return CalendarEventResponse(
            id=row.id,
            loctician_id=loctician_id,
            title=event.title,
            description=event.description,
            event_type=event.event_type,
            start_time=event.start_time,
            end_time=event.end_time,
            is_recurring=event.is_recurring,
            recurrence_rule=event.recurrence_rule,
            is_public=event.is_public,
            created_at=row.created_at
        )

    except Exception as e:
        await db.rollback()
        if "overlapping" in str(e) or "conflict" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Calendar event conflicts with existing event or booking"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create calendar event"
        )

@router.get("/schedule", response_model=ScheduleView)
async def get_schedule(
    loctician_id: UUID,
    start_date: date,
    end_date: date,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get schedule view for a loctician including bookings and events."""
    # Access control for viewing schedules
    if current_user.role == 'customer':
        # Customers can only see public schedule info
        is_public_view = True
    else:
        is_public_view = current_user.id != loctician_id and current_user.role != 'admin'

    # Get bookings for the date range
    booking_query = """
    SELECT b.id, b.appointment_start, b.appointment_end, b.status,
           s.name as service_name, s.duration_minutes,
           c.first_name || ' ' || c.last_name as customer_name,
           c.phone as customer_phone, b.customer_notes
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN users c ON b.customer_id = c.id
    WHERE b.loctician_id = :loctician_id
    AND DATE(b.appointment_start) BETWEEN :start_date AND :end_date
    AND b.status NOT IN ('cancelled')
    ORDER BY b.appointment_start
    """

    booking_result = await db.execute(text(booking_query), {
        "loctician_id": loctician_id,
        "start_date": start_date,
        "end_date": end_date
    })
    bookings = booking_result.fetchall()

    # Get calendar events for the date range
    event_query = """
    SELECT id, title, description, event_type,
           lower(time_range) as start_time, upper(time_range) as end_time,
           is_public
    FROM calendar_events
    WHERE loctician_id = :loctician_id
    AND lower(time_range)::date <= :end_date
    AND upper(time_range)::date >= :start_date
    """ + (" AND is_public = true" if is_public_view else "")

    event_result = await db.execute(text(event_query), {
        "loctician_id": loctician_id,
        "start_date": start_date,
        "end_date": end_date
    })
    events = event_result.fetchall()

    return ScheduleView(
        loctician_id=loctician_id,
        start_date=start_date,
        end_date=end_date,
        bookings=[
            {
                "id": b.id,
                "start_time": b.appointment_start,
                "end_time": b.appointment_end,
                "status": b.status,
                "service_name": b.service_name,
                "customer_name": b.customer_name if not is_public_view else "Booked",
                "customer_phone": b.customer_phone if not is_public_view else None,
                "notes": b.customer_notes if not is_public_view else None
            } for b in bookings
        ],
        events=[
            {
                "id": e.id,
                "title": e.title,
                "description": e.description if not is_public_view else None,
                "event_type": e.event_type,
                "start_time": e.start_time,
                "end_time": e.end_time,
                "is_public": e.is_public
            } for e in events
        ]
    )