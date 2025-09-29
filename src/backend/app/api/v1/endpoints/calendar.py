"""
Advanced Calendar API with role-based permissions and comprehensive availability management.
"""
from datetime import date, datetime, time, timedelta
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select, text, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import (
    get_current_user,
    get_current_admin,
    get_current_staff_or_admin,
    get_optional_user,
    require_admin,
    require_staff
)
from app.core.database import get_db
from app.models.availability import AvailabilityPattern, AvailabilityOverride
from app.models.booking import Booking
from app.models.calendar_event import CalendarEvent
from app.models.enums import BookingStatus, CalendarEventType, UserRole
from app.models.service import Service
from app.models.user import User
from app.schemas.availability import (
    AvailabilityPattern as AvailabilityPatternSchema,
    AvailabilityPatternCreate,
    AvailabilityPatternUpdate,
    AvailabilityOverride as AvailabilityOverrideSchema,
    AvailabilityOverrideCreate,
    AvailabilityOverrideUpdate,
    AvailabilityRequest,
    AvailabilitySlot,
    BulkAvailabilityOverrideCreate,
    BulkAvailabilityPatternCreate,
    CalendarConflictCheck,
    CalendarEvent as CalendarEventSchema,
    CalendarEventCreate,
    CalendarEventUpdate,
    ConflictResult,
    DayAvailability,
    WeeklyAvailability,
)

logger = structlog.get_logger(__name__)

router = APIRouter()


# Availability Pattern Management (Admin/Staff Only)
@router.get("/patterns", response_model=List[AvailabilityPatternSchema])
async def list_availability_patterns(
    loctician_id: Optional[str] = Query(None, description="Filter by loctician"),
    include_inactive: bool = Query(False, description="Include inactive patterns"),
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> List[AvailabilityPatternSchema]:
    """List availability patterns (staff/admin only)."""
    try:
        query = select(AvailabilityPattern).order_by(
            AvailabilityPattern.loctician_id,
            AvailabilityPattern.day_of_week,
            AvailabilityPattern.start_time
        )

        # Apply filters
        filters = []
        if loctician_id:
            filters.append(AvailabilityPattern.loctician_id == loctician_id)
        if not include_inactive:
            filters.append(AvailabilityPattern.is_active == True)

        if filters:
            query = query.where(and_(*filters))

        result = await db.execute(query)
        patterns = result.scalars().all()

        return [AvailabilityPatternSchema(**pattern.__dict__) for pattern in patterns]

    except Exception as e:
        logger.error("List availability patterns error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list availability patterns"
        )


@router.post("/patterns", response_model=AvailabilityPatternSchema, status_code=status.HTTP_201_CREATED)
async def create_availability_pattern(
    pattern_data: AvailabilityPatternCreate,
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> AvailabilityPatternSchema:
    """Create availability pattern (staff/admin only)."""
    try:
        # Validate loctician exists and is a loctician
        loctician_query = await db.execute(
            select(User).where(
                and_(User.id == pattern_data.loctician_id, User.role == UserRole.LOCTICIAN)
            )
        )
        if not loctician_query.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid loctician ID"
            )

        # Check for overlapping patterns
        overlap_query = await db.execute(
            select(AvailabilityPattern).where(
                and_(
                    AvailabilityPattern.loctician_id == pattern_data.loctician_id,
                    AvailabilityPattern.day_of_week == pattern_data.day_of_week,
                    AvailabilityPattern.is_active == True,
                    or_(
                        and_(
                            AvailabilityPattern.start_time <= pattern_data.start_time,
                            AvailabilityPattern.end_time > pattern_data.start_time
                        ),
                        and_(
                            AvailabilityPattern.start_time < pattern_data.end_time,
                            AvailabilityPattern.end_time >= pattern_data.end_time
                        ),
                        and_(
                            AvailabilityPattern.start_time >= pattern_data.start_time,
                            AvailabilityPattern.end_time <= pattern_data.end_time
                        )
                    )
                )
            )
        )
        if overlap_query.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Overlapping availability pattern exists"
            )

        pattern = AvailabilityPattern(**pattern_data.model_dump())
        db.add(pattern)
        await db.commit()
        await db.refresh(pattern)

        logger.info(
            "Availability pattern created",
            pattern_id=pattern.id,
            loctician_id=pattern.loctician_id,
            created_by=current_user.id
        )

        return AvailabilityPatternSchema(**pattern.__dict__)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create availability pattern error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create availability pattern"
        )


@router.put("/patterns/{pattern_id}", response_model=AvailabilityPatternSchema)
async def update_availability_pattern(
    pattern_id: str,
    pattern_data: AvailabilityPatternUpdate,
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> AvailabilityPatternSchema:
    """Update availability pattern (staff/admin only)."""
    try:
        pattern_result = await db.execute(
            select(AvailabilityPattern).where(AvailabilityPattern.id == pattern_id)
        )
        pattern = pattern_result.scalar()

        if not pattern:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Availability pattern not found"
            )

        # Update fields
        update_data = pattern_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(pattern, field, value)

        await db.commit()
        await db.refresh(pattern)

        logger.info(
            "Availability pattern updated",
            pattern_id=pattern.id,
            updated_by=current_user.id
        )

        return AvailabilityPatternSchema(**pattern.__dict__)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Update availability pattern error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update availability pattern"
        )


@router.delete("/patterns/{pattern_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_availability_pattern(
    pattern_id: str,
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Delete availability pattern (staff/admin only)."""
    try:
        pattern_result = await db.execute(
            select(AvailabilityPattern).where(AvailabilityPattern.id == pattern_id)
        )
        pattern = pattern_result.scalar()

        if not pattern:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Availability pattern not found"
            )

        await db.delete(pattern)
        await db.commit()

        logger.info(
            "Availability pattern deleted",
            pattern_id=pattern.id,
            deleted_by=current_user.id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Delete availability pattern error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete availability pattern"
        )


# Availability Override Management (Admin/Staff Only)
@router.get("/overrides", response_model=List[AvailabilityOverrideSchema])
async def list_availability_overrides(
    loctician_id: Optional[str] = Query(None, description="Filter by loctician"),
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> List[AvailabilityOverrideSchema]:
    """List availability overrides (staff/admin only)."""
    try:
        query = select(AvailabilityOverride).order_by(
            AvailabilityOverride.loctician_id,
            AvailabilityOverride.date
        )

        # Apply filters
        filters = []
        if loctician_id:
            filters.append(AvailabilityOverride.loctician_id == loctician_id)
        if start_date:
            filters.append(AvailabilityOverride.date >= start_date)
        if end_date:
            filters.append(AvailabilityOverride.date <= end_date)

        if filters:
            query = query.where(and_(*filters))

        result = await db.execute(query)
        overrides = result.scalars().all()

        return [AvailabilityOverrideSchema(**override.__dict__) for override in overrides]

    except Exception as e:
        logger.error("List availability overrides error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list availability overrides"
        )


@router.post("/overrides", response_model=AvailabilityOverrideSchema, status_code=status.HTTP_201_CREATED)
async def create_availability_override(
    override_data: AvailabilityOverrideCreate,
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> AvailabilityOverrideSchema:
    """Create availability override (staff/admin only)."""
    try:
        # Validate loctician exists and is a loctician
        loctician_query = await db.execute(
            select(User).where(
                and_(User.id == override_data.loctician_id, User.role == UserRole.LOCTICIAN)
            )
        )
        if not loctician_query.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid loctician ID"
            )

        # Check for existing override on the same date
        existing_query = await db.execute(
            select(AvailabilityOverride).where(
                and_(
                    AvailabilityOverride.loctician_id == override_data.loctician_id,
                    AvailabilityOverride.date == override_data.date
                )
            )
        )
        if existing_query.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Override already exists for this date"
            )

        override = AvailabilityOverride(
            **override_data.model_dump(),
            created_by=current_user.id
        )
        db.add(override)
        await db.commit()
        await db.refresh(override)

        logger.info(
            "Availability override created",
            override_id=override.id,
            loctician_id=override.loctician_id,
            date=override.date,
            created_by=current_user.id
        )

        return AvailabilityOverrideSchema(**override.__dict__)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create availability override error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create availability override"
        )


@router.post("/overrides/bulk", response_model=List[AvailabilityOverrideSchema])
async def bulk_create_availability_overrides(
    bulk_data: BulkAvailabilityOverrideCreate,
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> List[AvailabilityOverrideSchema]:
    """Bulk create availability overrides (staff/admin only)."""
    try:
        # Validate loctician exists
        loctician_query = await db.execute(
            select(User).where(
                and_(User.id == bulk_data.loctician_id, User.role == UserRole.LOCTICIAN)
            )
        )
        if not loctician_query.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid loctician ID"
            )

        created_overrides = []
        for override_data in bulk_data.overrides:
            # Check for existing override
            existing_query = await db.execute(
                select(AvailabilityOverride).where(
                    and_(
                        AvailabilityOverride.loctician_id == bulk_data.loctician_id,
                        AvailabilityOverride.date == override_data.date
                    )
                )
            )
            if existing_query.scalar():
                continue  # Skip existing overrides

            override = AvailabilityOverride(
                loctician_id=bulk_data.loctician_id,
                **override_data.model_dump(),
                created_by=current_user.id
            )
            db.add(override)
            created_overrides.append(override)

        await db.commit()
        for override in created_overrides:
            await db.refresh(override)

        logger.info(
            "Bulk availability overrides created",
            count=len(created_overrides),
            loctician_id=bulk_data.loctician_id,
            created_by=current_user.id
        )

        return [AvailabilityOverrideSchema(**override.__dict__) for override in created_overrides]

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Bulk create availability overrides error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk create availability overrides"
        )


# Calendar Event Management
@router.get("/events", response_model=List[CalendarEventSchema])
async def list_calendar_events(
    loctician_id: Optional[str] = Query(None, description="Filter by loctician"),
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    event_type: Optional[CalendarEventType] = Query(None, description="Filter by event type"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[CalendarEventSchema]:
    """List calendar events with role-based filtering."""
    try:
        query = select(CalendarEvent)

        # Role-based filtering
        if current_user.role == UserRole.CUSTOMER:
            # Customers can only see public events
            query = query.where(CalendarEvent.is_public == True)
        elif current_user.role == UserRole.LOCTICIAN:
            # Locticians see their own events and public events
            query = query.where(
                or_(
                    CalendarEvent.loctician_id == current_user.id,
                    CalendarEvent.is_public == True
                )
            )
        # Staff and Admin see all events (no additional filtering)

        # Apply other filters
        if loctician_id:
            query = query.where(CalendarEvent.loctician_id == loctician_id)
        if event_type:
            query = query.where(CalendarEvent.event_type == event_type)
        if start_date or end_date:
            # Filter by date range using PostgreSQL tstzrange
            date_filter = []
            if start_date:
                date_filter.append(text("time_range && tstzrange(:start_date::timestamptz, null)"))
            if end_date:
                date_filter.append(text("time_range && tstzrange(null, :end_date::timestamptz)"))
            if date_filter:
                query = query.where(and_(*date_filter))

        query = query.order_by(CalendarEvent.created_at.desc())

        result = await db.execute(query, {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None
        })
        events = result.scalars().all()

        return [CalendarEventSchema(**event.__dict__) for event in events]

    except Exception as e:
        logger.error("List calendar events error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list calendar events"
        )


@router.post("/events", response_model=CalendarEventSchema, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    event_data: CalendarEventCreate,
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventSchema:
    """Create calendar event (staff/admin only)."""
    try:
        # Validate loctician exists
        loctician_query = await db.execute(
            select(User).where(
                and_(User.id == event_data.loctician_id, User.role == UserRole.LOCTICIAN)
            )
        )
        if not loctician_query.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid loctician ID"
            )

        # Convert datetime to PostgreSQL tstzrange format
        time_range = f"[{event_data.start_datetime.isoformat()},{event_data.end_datetime.isoformat()})"

        event = CalendarEvent(
            loctician_id=event_data.loctician_id,
            title=event_data.title,
            description=event_data.description,
            event_type=event_data.event_type,
            time_range=time_range,
            is_recurring=event_data.is_recurring,
            recurrence_rule=event_data.recurrence_rule,
            is_public=event_data.is_public,
            created_by=current_user.id
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)

        logger.info(
            "Calendar event created",
            event_id=event.id,
            loctician_id=event.loctician_id,
            created_by=current_user.id
        )

        return CalendarEventSchema(
            **event.__dict__,
            start_datetime=event_data.start_datetime,
            end_datetime=event_data.end_datetime
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create calendar event error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create calendar event"
        )


# Public Availability Checking (for customers and guests)
@router.post("/availability/check", response_model=DayAvailability)
async def check_availability(
    availability_request: AvailabilityRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> DayAvailability:
    """Check availability for a specific date (public endpoint)."""
    try:
        # Call PostgreSQL function for availability checking
        availability_query = text("""
            SELECT * FROM get_loctician_availability(
                :loctician_id::uuid,
                :check_date::date,
                :service_duration,
                :buffer_minutes,
                :slot_interval
            )
        """)

        result = await db.execute(availability_query, {
            "loctician_id": availability_request.loctician_id,
            "check_date": availability_request.start_date,
            "service_duration": availability_request.service_duration_minutes,
            "buffer_minutes": availability_request.buffer_minutes,
            "slot_interval": availability_request.slot_interval_minutes
        })

        availability_data = result.fetchone()
        if not availability_data:
            # Return empty availability if no data found
            return DayAvailability(
                date=availability_request.start_date,
                is_working_day=False,
                slots=[],
                total_available_minutes=0
            )

        # Parse availability slots from database result
        slots = []
        if availability_data.available_slots:
            for slot in availability_data.available_slots:
                slots.append(AvailabilitySlot(
                    start_time=slot['start_time'],
                    end_time=slot['end_time'],
                    is_available=slot['is_available'],
                    reason=slot.get('reason')
                ))

        return DayAvailability(
            date=availability_request.start_date,
            is_working_day=availability_data.is_working_day,
            slots=slots,
            total_available_minutes=availability_data.total_available_minutes or 0,
            business_hours_start=availability_data.business_hours_start,
            business_hours_end=availability_data.business_hours_end
        )

    except Exception as e:
        logger.error("Check availability error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check availability"
        )


@router.post("/availability/week", response_model=WeeklyAvailability)
async def check_weekly_availability(
    availability_request: AvailabilityRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> WeeklyAvailability:
    """Check availability for a week range (public endpoint)."""
    try:
        days = []
        current_date = availability_request.start_date
        total_working_days = 0
        total_available_minutes = 0

        while current_date <= availability_request.end_date:
            # Check availability for each day
            day_request = AvailabilityRequest(
                loctician_id=availability_request.loctician_id,
                start_date=current_date,
                end_date=current_date,
                service_duration_minutes=availability_request.service_duration_minutes,
                buffer_minutes=availability_request.buffer_minutes,
                slot_interval_minutes=availability_request.slot_interval_minutes
            )

            day_availability = await check_availability(day_request, current_user, db)
            days.append(day_availability)

            if day_availability.is_working_day:
                total_working_days += 1
            total_available_minutes += day_availability.total_available_minutes

            current_date += timedelta(days=1)

        return WeeklyAvailability(
            start_date=availability_request.start_date,
            end_date=availability_request.end_date,
            days=days,
            total_working_days=total_working_days,
            total_available_hours=round(total_available_minutes / 60, 2)
        )

    except Exception as e:
        logger.error("Check weekly availability error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check weekly availability"
        )


@router.post("/conflicts/check", response_model=ConflictResult)
async def check_calendar_conflicts(
    conflict_request: CalendarConflictCheck,
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> ConflictResult:
    """Check for calendar conflicts (staff/admin only)."""
    try:
        # Check for booking conflicts
        booking_conflicts = await db.execute(
            select(Booking).where(
                and_(
                    Booking.loctician_id == conflict_request.loctician_id,
                    Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS]),
                    or_(
                        and_(
                            Booking.appointment_start <= conflict_request.start_datetime,
                            Booking.appointment_end > conflict_request.start_datetime
                        ),
                        and_(
                            Booking.appointment_start < conflict_request.end_datetime,
                            Booking.appointment_end >= conflict_request.end_datetime
                        ),
                        and_(
                            Booking.appointment_start >= conflict_request.start_datetime,
                            Booking.appointment_end <= conflict_request.end_datetime
                        )
                    ),
                    Booking.id != (conflict_request.exclude_booking_id or "")
                )
            )
        )

        conflicts = []
        booking_conflicts_list = booking_conflicts.scalars().all()

        for booking in booking_conflicts_list:
            conflicts.append(f"Booking conflict: {booking.booking_number}")

        # Check for calendar event conflicts
        event_conflicts = await db.execute(
            text("""
                SELECT title, event_type
                FROM calendar_events
                WHERE loctician_id = :loctician_id
                AND time_range && tstzrange(:start_time::timestamptz, :end_time::timestamptz)
            """),
            {
                "loctician_id": conflict_request.loctician_id,
                "start_time": conflict_request.start_datetime.isoformat(),
                "end_time": conflict_request.end_datetime.isoformat()
            }
        )

        for event in event_conflicts.fetchall():
            conflicts.append(f"Calendar event: {event.title} ({event.event_type})")

        # Suggest alternative slots if there are conflicts
        suggested_slots = []
        if conflicts:
            # Find next available slots
            availability_request = AvailabilityRequest(
                loctician_id=conflict_request.loctician_id,
                start_date=conflict_request.start_datetime.date(),
                end_date=(conflict_request.start_datetime + timedelta(days=7)).date(),
                service_duration_minutes=int((conflict_request.end_datetime - conflict_request.start_datetime).total_seconds() / 60),
                buffer_minutes=15,
                slot_interval_minutes=30
            )

            weekly_availability = await check_weekly_availability(availability_request, current_user, db)

            # Get first 3 available slots as suggestions
            slot_count = 0
            for day in weekly_availability.days:
                for slot in day.slots:
                    if slot.is_available and slot_count < 3:
                        suggested_slots.append(slot)
                        slot_count += 1
                    if slot_count >= 3:
                        break
                if slot_count >= 3:
                    break

        return ConflictResult(
            has_conflict=len(conflicts) > 0,
            conflicts=conflicts,
            suggested_slots=suggested_slots
        )

    except Exception as e:
        logger.error("Check calendar conflicts error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check calendar conflicts"
        )