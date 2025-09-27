"""
Comprehensive calendar management service for the loctician booking system.

Handles:
- Availability patterns (weekly recurring availability)
- Calendar events (breaks, meetings, vacations)
- Availability overrides (one-time availability changes)
- Schedule views and availability checking
- Conflict detection and validation
- Danish timezone support
- Real-time updates via WebSocket
"""
import asyncio
import calendar as py_calendar
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import uuid4

import pytz
import structlog
from dateutil.rrule import rrule, DAILY, WEEKLY, MONTHLY, YEARLY
from icalendar import Calendar, Event as ICalEvent
from sqlalchemy import and_, or_, select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db_session
from app.models.availability import AvailabilityPattern, AvailabilityOverride
from app.models.booking import Booking
from app.models.calendar_event import CalendarEvent
from app.models.enums import BookingStatus, CalendarEventType
from app.models.user import User
from app.schemas.calendar import (
    AvailabilitySlot,
    AvailabilityCheck,
    AvailabilityResponse,
    ConflictCheck,
    ConflictResult,
    ScheduleItem,
    ScheduleView,
    ViewType,
    RecurrenceRule,
    DayOfWeek,
    CalendarWebSocketMessage,
    ICalExport
)
from app.websocket.connection_manager import connection_manager

logger = structlog.get_logger(__name__)

# Danish timezone
DANISH_TZ = pytz.timezone(settings.DEFAULT_TIMEZONE)


class DateTimeHelper:
    """Helper class for date/time operations with Danish timezone support."""

    @staticmethod
    def now_danish() -> datetime:
        """Get current time in Danish timezone."""
        return datetime.now(DANISH_TZ)

    @staticmethod
    def to_danish_tz(dt: datetime) -> datetime:
        """Convert datetime to Danish timezone."""
        if dt.tzinfo is None:
            dt = pytz.utc.localize(dt)
        return dt.astimezone(DANISH_TZ)

    @staticmethod
    def from_danish_tz(dt: datetime) -> datetime:
        """Convert Danish timezone datetime to UTC."""
        if dt.tzinfo is None:
            dt = DANISH_TZ.localize(dt)
        return dt.astimezone(pytz.utc)

    @staticmethod
    def danish_business_hours(d: date) -> Tuple[time, time]:
        """Get standard Danish business hours for a date."""
        # Standard Danish working hours: 8:00-16:00 weekdays
        weekday = d.weekday()  # 0=Monday, 6=Sunday
        if weekday < 5:  # Monday-Friday
            return time(8, 0), time(16, 0)
        else:  # Weekend
            return time(10, 0), time(14, 0)

    @staticmethod
    def is_danish_holiday(d: date) -> bool:
        """Check if date is a Danish public holiday."""
        # Basic Danish holidays (can be extended with a proper holiday library)
        year = d.year

        # Fixed holidays
        fixed_holidays = [
            date(year, 1, 1),   # New Year's Day
            date(year, 12, 25), # Christmas Day
            date(year, 12, 26), # Boxing Day
        ]

        if d in fixed_holidays:
            return True

        # TODO: Add calculation for Easter-based holidays
        # (Maundy Thursday, Good Friday, Easter Monday, etc.)
        return False

    @staticmethod
    def get_week_dates(d: date) -> List[date]:
        """Get all dates in the week containing the given date."""
        # ISO week starts on Monday
        monday = d - timedelta(days=d.weekday())
        return [monday + timedelta(days=i) for i in range(7)]

    @staticmethod
    def get_month_dates(year: int, month: int) -> List[date]:
        """Get all dates in the given month."""
        _, last_day = py_calendar.monthrange(year, month)
        return [date(year, month, day) for day in range(1, last_day + 1)]


class AvailabilityEngine:
    """Core engine for calculating availability and detecting conflicts."""

    def __init__(self):
        self.dt_helper = DateTimeHelper()

    async def get_base_availability(
        self,
        loctician_id: str,
        target_date: date,
        session: AsyncSession
    ) -> Optional[Tuple[time, time]]:
        """
        Get base availability for a loctician on a specific date.

        Args:
            loctician_id: ID of the loctician
            target_date: Date to check
            session: Database session

        Returns:
            Tuple of (start_time, end_time) or None if not available
        """
        day_of_week = target_date.weekday()
        # Convert to Sunday=0 format
        if day_of_week == 6:  # Sunday
            day_of_week = 0
        else:
            day_of_week += 1

        # Find active availability pattern for this day
        result = await session.execute(
            select(AvailabilityPattern)
            .where(
                and_(
                    AvailabilityPattern.loctician_id == loctician_id,
                    AvailabilityPattern.day_of_week == day_of_week,
                    AvailabilityPattern.is_active == True,
                    AvailabilityPattern.effective_from <= target_date,
                    or_(
                        AvailabilityPattern.effective_until.is_(None),
                        AvailabilityPattern.effective_until >= target_date
                    )
                )
            )
            .order_by(AvailabilityPattern.effective_from.desc())
            .limit(1)
        )

        pattern = result.scalar_one_or_none()
        if not pattern:
            return None

        return pattern.start_time, pattern.end_time

    async def get_availability_override(
        self,
        loctician_id: str,
        target_date: date,
        session: AsyncSession
    ) -> Optional[AvailabilityOverride]:
        """
        Get availability override for a specific date.

        Args:
            loctician_id: ID of the loctician
            target_date: Date to check
            session: Database session

        Returns:
            AvailabilityOverride instance or None
        """
        result = await session.execute(
            select(AvailabilityOverride)
            .where(
                and_(
                    AvailabilityOverride.loctician_id == loctician_id,
                    AvailabilityOverride.date == target_date
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_conflicting_bookings(
        self,
        loctician_id: str,
        start_time: datetime,
        end_time: datetime,
        exclude_booking_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> List[Booking]:
        """
        Get bookings that conflict with the given time range.

        Args:
            loctician_id: ID of the loctician
            start_time: Start time to check
            end_time: End time to check
            exclude_booking_id: Booking ID to exclude from conflict check
            session: Database session

        Returns:
            List of conflicting bookings
        """
        conditions = [
            Booking.loctician_id == loctician_id,
            Booking.status.in_([
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.IN_PROGRESS
            ]),
            # Check for time overlap
            and_(
                Booking.appointment_start < end_time,
                Booking.appointment_end > start_time
            )
        ]

        if exclude_booking_id:
            conditions.append(Booking.id != exclude_booking_id)

        result = await session.execute(
            select(Booking)
            .where(and_(*conditions))
            .order_by(Booking.appointment_start)
        )
        return result.scalars().all()

    async def get_conflicting_events(
        self,
        loctician_id: str,
        start_time: datetime,
        end_time: datetime,
        exclude_event_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> List[CalendarEvent]:
        """
        Get calendar events that conflict with the given time range.

        Args:
            loctician_id: ID of the loctician
            start_time: Start time to check
            end_time: End time to check
            exclude_event_id: Event ID to exclude from conflict check
            session: Database session

        Returns:
            List of conflicting calendar events
        """
        # Note: This is a simplified version. In practice, you'd need to expand
        # recurring events and check their occurrences
        conditions = [
            CalendarEvent.loctician_id == loctician_id,
            # Basic time range overlap check
            # For recurring events, this would need more complex logic
        ]

        if exclude_event_id:
            conditions.append(CalendarEvent.id != exclude_event_id)

        result = await session.execute(
            select(CalendarEvent)
            .where(and_(*conditions))
        )
        return result.scalars().all()

    async def check_conflicts(
        self,
        loctician_id: str,
        start_time: datetime,
        end_time: datetime,
        exclude_booking_id: Optional[str] = None,
        exclude_event_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> ConflictResult:
        """
        Comprehensive conflict checking.

        Args:
            loctician_id: ID of the loctician
            start_time: Start time to check
            end_time: End time to check
            exclude_booking_id: Booking ID to exclude
            exclude_event_id: Event ID to exclude
            session: Database session

        Returns:
            ConflictResult with detailed conflict information
        """
        conflicts = []
        conflicting_bookings = []
        conflicting_events = []
        availability_issues = []

        # Check for booking conflicts
        booking_conflicts = await self.get_conflicting_bookings(
            loctician_id, start_time, end_time, exclude_booking_id, session
        )

        for booking in booking_conflicts:
            conflicts.append(
                f"Booking conflict: {booking.booking_number} "
                f"({booking.appointment_start.strftime('%H:%M')} - "
                f"{booking.appointment_end.strftime('%H:%M')})"
            )
            conflicting_bookings.append(booking.id)

        # Check for event conflicts
        event_conflicts = await self.get_conflicting_events(
            loctician_id, start_time, end_time, exclude_event_id, session
        )

        for event in event_conflicts:
            conflicts.append(f"Event conflict: {event.title}")
            conflicting_events.append(event.id)

        # Check availability patterns and overrides
        target_date = start_time.date()

        # Check override first
        override = await self.get_availability_override(loctician_id, target_date, session)
        if override:
            if not override.is_available:
                availability_issues.append(f"Not available on {target_date}: {override.reason or 'Override'}")
            elif override.start_time and override.end_time:
                override_start = datetime.combine(target_date, override.start_time)
                override_end = datetime.combine(target_date, override.end_time)

                if start_time < override_start or end_time > override_end:
                    availability_issues.append(
                        f"Outside override hours: {override.start_time.strftime('%H:%M')} - "
                        f"{override.end_time.strftime('%H:%M')}"
                    )
        else:
            # Check base availability pattern
            base_availability = await self.get_base_availability(loctician_id, target_date, session)
            if not base_availability:
                availability_issues.append(f"No availability pattern for {target_date}")
            else:
                pattern_start = datetime.combine(target_date, base_availability[0])
                pattern_end = datetime.combine(target_date, base_availability[1])

                if start_time < pattern_start or end_time > pattern_end:
                    availability_issues.append(
                        f"Outside working hours: {base_availability[0].strftime('%H:%M')} - "
                        f"{base_availability[1].strftime('%H:%M')}"
                    )

        # Check Danish holidays
        if self.dt_helper.is_danish_holiday(target_date):
            availability_issues.append(f"Danish public holiday on {target_date}")

        all_conflicts = conflicts + availability_issues

        return ConflictResult(
            has_conflicts=len(all_conflicts) > 0,
            conflicts=all_conflicts,
            conflicting_bookings=conflicting_bookings,
            conflicting_events=conflicting_events,
            availability_issues=availability_issues
        )

    async def calculate_available_slots(
        self,
        loctician_id: str,
        target_date: date,
        duration_minutes: int,
        slot_interval: int = 30,
        exclude_booking_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> List[AvailabilitySlot]:
        """
        Calculate available time slots for a specific date.

        Args:
            loctician_id: ID of the loctician
            target_date: Date to check
            duration_minutes: Required duration in minutes
            slot_interval: Interval between slots in minutes
            exclude_booking_id: Booking ID to exclude from conflicts
            session: Database session

        Returns:
            List of available time slots
        """
        slots = []

        # Get working hours for the date
        override = await self.get_availability_override(loctician_id, target_date, session)

        if override and not override.is_available:
            return slots  # No availability on this date

        if override and override.start_time and override.end_time:
            start_time = override.start_time
            end_time = override.end_time
        else:
            base_availability = await self.get_base_availability(loctician_id, target_date, session)
            if not base_availability:
                return slots  # No base availability pattern
            start_time, end_time = base_availability

        # Generate time slots
        current_time = datetime.combine(target_date, start_time)
        end_datetime = datetime.combine(target_date, end_time)

        # Ensure we don't go past the end of availability
        duration_delta = timedelta(minutes=duration_minutes)
        slot_delta = timedelta(minutes=slot_interval)

        while current_time + duration_delta <= end_datetime:
            slot_end = current_time + duration_delta

            # Check for conflicts
            conflict_result = await self.check_conflicts(
                loctician_id,
                current_time,
                slot_end,
                exclude_booking_id=exclude_booking_id,
                session=session
            )

            is_available = not conflict_result.has_conflicts
            conflicts = conflict_result.conflicts if conflict_result.has_conflicts else []

            # Add buffer time consideration
            if is_available and settings.DEFAULT_BOOKING_BUFFER_MINUTES > 0:
                buffer_delta = timedelta(minutes=settings.DEFAULT_BOOKING_BUFFER_MINUTES)

                # Check conflicts with buffer before
                buffer_conflict = await self.check_conflicts(
                    loctician_id,
                    current_time - buffer_delta,
                    current_time,
                    exclude_booking_id=exclude_booking_id,
                    session=session
                )

                if buffer_conflict.has_conflicts:
                    is_available = False
                    conflicts.extend(["Buffer time conflict (before)"] + buffer_conflict.conflicts)

                # Check conflicts with buffer after
                buffer_conflict = await self.check_conflicts(
                    loctician_id,
                    slot_end,
                    slot_end + buffer_delta,
                    exclude_booking_id=exclude_booking_id,
                    session=session
                )

                if buffer_conflict.has_conflicts:
                    is_available = False
                    conflicts.extend(["Buffer time conflict (after)"] + buffer_conflict.conflicts)

            slot = AvailabilitySlot(
                start_time=current_time,
                end_time=slot_end,
                is_available=is_available,
                conflicts=conflicts
            )

            slots.append(slot)
            current_time += slot_delta

        return slots


class RecurrenceExpander:
    """Handles expansion of recurring events."""

    @staticmethod
    def expand_recurrence(
        event: CalendarEvent,
        start_date: date,
        end_date: date
    ) -> List[Tuple[datetime, datetime]]:
        """
        Expand recurring event occurrences within date range.

        Args:
            event: CalendarEvent instance with recurrence rule
            start_date: Start date for expansion
            end_date: End date for expansion

        Returns:
            List of (start_time, end_time) tuples for each occurrence
        """
        if not event.is_recurring or not event.recurrence_rule:
            # Single occurrence
            return [(event.start_time, event.end_time)]

        occurrences = []

        try:
            # Parse recurrence rule
            rule = RecurrenceRule.from_rrule(event.recurrence_rule)

            # Map frequency to dateutil constants
            freq_map = {
                "DAILY": DAILY,
                "WEEKLY": WEEKLY,
                "MONTHLY": MONTHLY,
                "YEARLY": YEARLY
            }

            freq = freq_map.get(rule.frequency.value, WEEKLY)

            # Create rrule parameters
            rrule_params = {
                'freq': freq,
                'interval': rule.interval,
                'dtstart': event.start_time
            }

            if rule.count:
                rrule_params['count'] = rule.count
            elif rule.until:
                rrule_params['until'] = rule.until

            if rule.by_day:
                # Convert DayOfWeek to dateutil weekday constants
                weekday_map = {0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5}  # Sunday=0 to dateutil format
                rrule_params['byweekday'] = [weekday_map[day.value] for day in rule.by_day]

            if rule.by_month_day:
                rrule_params['bymonthday'] = rule.by_month_day

            if rule.by_month:
                rrule_params['bymonth'] = rule.by_month

            # Generate occurrences
            r = rrule(**rrule_params)
            event_duration = event.end_time - event.start_time

            for occurrence_start in r:
                occurrence_date = occurrence_start.date()

                # Filter by date range
                if occurrence_date < start_date or occurrence_date > end_date:
                    continue

                occurrence_end = occurrence_start + event_duration
                occurrences.append((occurrence_start, occurrence_end))

        except Exception as e:
            logger.error(
                "Failed to expand recurrence rule",
                event_id=event.id,
                recurrence_rule=event.recurrence_rule,
                error=str(e)
            )
            # Fallback to single occurrence
            return [(event.start_time, event.end_time)]

        return occurrences


class CalendarService:
    """Main calendar management service."""

    def __init__(self):
        self.dt_helper = DateTimeHelper()
        self.availability_engine = AvailabilityEngine()
        self.recurrence_expander = RecurrenceExpander()

    # Availability Pattern Management
    async def create_availability_pattern(
        self,
        loctician_id: str,
        day_of_week: int,
        start_time: time,
        end_time: time,
        effective_from: date,
        effective_until: Optional[date] = None,
        is_active: bool = True,
        session: AsyncSession = None
    ) -> AvailabilityPattern:
        """
        Create new availability pattern.

        Args:
            loctician_id: ID of the loctician
            day_of_week: Day of week (0=Sunday, 1=Monday, etc.)
            start_time: Start time for availability
            end_time: End time for availability
            effective_from: Date when pattern becomes effective
            effective_until: Date when pattern expires (optional)
            is_active: Whether pattern is active
            session: Database session

        Returns:
            Created AvailabilityPattern instance
        """
        if session is None:
            async with get_db_session() as session:
                return await self.create_availability_pattern(
                    loctician_id, day_of_week, start_time, end_time,
                    effective_from, effective_until, is_active, session
                )

        # Validate times
        if start_time >= end_time:
            raise ValueError("Start time must be before end time")

        if effective_until and effective_until <= effective_from:
            raise ValueError("Effective until date must be after effective from date")

        # Check for conflicts with existing patterns
        existing_result = await session.execute(
            select(AvailabilityPattern)
            .where(
                and_(
                    AvailabilityPattern.loctician_id == loctician_id,
                    AvailabilityPattern.day_of_week == day_of_week,
                    AvailabilityPattern.is_active == True,
                    or_(
                        # New pattern starts during existing pattern
                        and_(
                            AvailabilityPattern.effective_from <= effective_from,
                            or_(
                                AvailabilityPattern.effective_until.is_(None),
                                AvailabilityPattern.effective_until >= effective_from
                            )
                        ),
                        # New pattern ends during existing pattern
                        and_(
                            effective_until.is_not(None),
                            AvailabilityPattern.effective_from <= effective_until,
                            or_(
                                AvailabilityPattern.effective_until.is_(None),
                                AvailabilityPattern.effective_until >= effective_until
                            )
                        ),
                        # New pattern encompasses existing pattern
                        and_(
                            AvailabilityPattern.effective_from >= effective_from,
                            or_(
                                effective_until.is_(None),
                                and_(
                                    AvailabilityPattern.effective_until.is_not(None),
                                    AvailabilityPattern.effective_until <= effective_until
                                )
                            )
                        )
                    )
                )
            )
        )

        existing_patterns = existing_result.scalars().all()
        if existing_patterns:
            # Deactivate overlapping patterns
            for pattern in existing_patterns:
                pattern.is_active = False

        # Create new pattern
        pattern = AvailabilityPattern(
            loctician_id=loctician_id,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            effective_from=effective_from,
            effective_until=effective_until,
            is_active=is_active
        )

        session.add(pattern)
        await session.commit()
        await session.refresh(pattern)

        # Send WebSocket notification
        await self._send_websocket_update(
            "availability_pattern",
            "create",
            loctician_id,
            pattern.id,
            {
                "day_of_week": pattern.day_of_week,
                "start_time": pattern.start_time.isoformat(),
                "end_time": pattern.end_time.isoformat(),
                "effective_from": pattern.effective_from.isoformat()
            }
        )

        logger.info(
            "Availability pattern created",
            pattern_id=pattern.id,
            loctician_id=loctician_id,
            day_of_week=day_of_week
        )

        return pattern

    async def get_availability_patterns(
        self,
        loctician_id: str,
        active_only: bool = True,
        effective_date: Optional[date] = None,
        session: AsyncSession = None
    ) -> List[AvailabilityPattern]:
        """
        Get availability patterns for a loctician.

        Args:
            loctician_id: ID of the loctician
            active_only: Whether to return only active patterns
            effective_date: Filter patterns effective on this date
            session: Database session

        Returns:
            List of AvailabilityPattern instances
        """
        if session is None:
            async with get_db_session() as session:
                return await self.get_availability_patterns(
                    loctician_id, active_only, effective_date, session
                )

        conditions = [AvailabilityPattern.loctician_id == loctician_id]

        if active_only:
            conditions.append(AvailabilityPattern.is_active == True)

        if effective_date:
            conditions.extend([
                AvailabilityPattern.effective_from <= effective_date,
                or_(
                    AvailabilityPattern.effective_until.is_(None),
                    AvailabilityPattern.effective_until >= effective_date
                )
            ])

        result = await session.execute(
            select(AvailabilityPattern)
            .where(and_(*conditions))
            .order_by(
                AvailabilityPattern.day_of_week,
                AvailabilityPattern.start_time
            )
        )
        return result.scalars().all()

    async def update_availability_pattern(
        self,
        pattern_id: str,
        start_time: Optional[time] = None,
        end_time: Optional[time] = None,
        effective_from: Optional[date] = None,
        effective_until: Optional[date] = None,
        is_active: Optional[bool] = None,
        session: AsyncSession = None
    ) -> Optional[AvailabilityPattern]:
        """
        Update availability pattern.

        Args:
            pattern_id: ID of the pattern to update
            start_time: New start time
            end_time: New end time
            effective_from: New effective from date
            effective_until: New effective until date
            is_active: New active status
            session: Database session

        Returns:
            Updated AvailabilityPattern instance or None if not found
        """
        if session is None:
            async with get_db_session() as session:
                return await self.update_availability_pattern(
                    pattern_id, start_time, end_time, effective_from,
                    effective_until, is_active, session
                )

        result = await session.execute(
            select(AvailabilityPattern)
            .where(AvailabilityPattern.id == pattern_id)
        )
        pattern = result.scalar_one_or_none()

        if not pattern:
            return None

        # Update fields
        if start_time is not None:
            pattern.start_time = start_time
        if end_time is not None:
            pattern.end_time = end_time
        if effective_from is not None:
            pattern.effective_from = effective_from
        if effective_until is not None:
            pattern.effective_until = effective_until
        if is_active is not None:
            pattern.is_active = is_active

        # Validate times
        if pattern.start_time >= pattern.end_time:
            raise ValueError("Start time must be before end time")

        await session.commit()
        await session.refresh(pattern)

        # Send WebSocket notification
        await self._send_websocket_update(
            "availability_pattern",
            "update",
            pattern.loctician_id,
            pattern.id,
            {
                "start_time": pattern.start_time.isoformat(),
                "end_time": pattern.end_time.isoformat(),
                "is_active": pattern.is_active
            }
        )

        logger.info(
            "Availability pattern updated",
            pattern_id=pattern.id,
            loctician_id=pattern.loctician_id
        )

        return pattern

    async def delete_availability_pattern(
        self,
        pattern_id: str,
        session: AsyncSession = None
    ) -> bool:
        """
        Delete availability pattern.

        Args:
            pattern_id: ID of the pattern to delete
            session: Database session

        Returns:
            True if deleted successfully
        """
        if session is None:
            async with get_db_session() as session:
                return await self.delete_availability_pattern(pattern_id, session)

        result = await session.execute(
            select(AvailabilityPattern)
            .where(AvailabilityPattern.id == pattern_id)
        )
        pattern = result.scalar_one_or_none()

        if not pattern:
            return False

        loctician_id = pattern.loctician_id

        await session.execute(
            delete(AvailabilityPattern)
            .where(AvailabilityPattern.id == pattern_id)
        )
        await session.commit()

        # Send WebSocket notification
        await self._send_websocket_update(
            "availability_pattern",
            "delete",
            loctician_id,
            pattern_id,
            {}
        )

        logger.info(
            "Availability pattern deleted",
            pattern_id=pattern_id,
            loctician_id=loctician_id
        )

        return True

    # Calendar Event Management
    async def create_calendar_event(
        self,
        loctician_id: str,
        title: str,
        start_time: datetime,
        end_time: datetime,
        event_type: CalendarEventType,
        description: Optional[str] = None,
        is_public: bool = False,
        is_recurring: bool = False,
        recurrence_rule: Optional[RecurrenceRule] = None,
        created_by: Optional[str] = None,
        session: AsyncSession = None
    ) -> CalendarEvent:
        """
        Create new calendar event.

        Args:
            loctician_id: ID of the loctician
            title: Event title
            start_time: Event start time
            end_time: Event end time
            event_type: Type of calendar event
            description: Event description
            is_public: Whether event is publicly visible
            is_recurring: Whether event is recurring
            recurrence_rule: Recurrence rule for recurring events
            created_by: User ID who created the event
            session: Database session

        Returns:
            Created CalendarEvent instance
        """
        if session is None:
            async with get_db_session() as session:
                return await self.create_calendar_event(
                    loctician_id, title, start_time, end_time, event_type,
                    description, is_public, is_recurring, recurrence_rule,
                    created_by, session
                )

        # Validate times
        if start_time >= end_time:
            raise ValueError("Start time must be before end time")

        if is_recurring and not recurrence_rule:
            raise ValueError("Recurrence rule is required for recurring events")

        # Check for conflicts
        conflict_result = await self.availability_engine.check_conflicts(
            loctician_id, start_time, end_time, session=session
        )

        if conflict_result.has_conflicts:
            logger.warning(
                "Creating event with conflicts",
                loctician_id=loctician_id,
                conflicts=conflict_result.conflicts
            )

        # Create event
        event = CalendarEvent(
            loctician_id=loctician_id,
            title=title,
            description=description,
            event_type=event_type,
            start_time=start_time,
            end_time=end_time,
            is_public=is_public,
            is_recurring=is_recurring,
            recurrence_rule=recurrence_rule.to_rrule() if recurrence_rule else None,
            created_by=created_by
        )

        session.add(event)
        await session.commit()
        await session.refresh(event)

        # Send WebSocket notification
        await self._send_websocket_update(
            "calendar_event",
            "create",
            loctician_id,
            event.id,
            {
                "title": event.title,
                "event_type": event.event_type.value,
                "start_time": event.start_time.isoformat(),
                "end_time": event.end_time.isoformat(),
                "is_recurring": event.is_recurring
            }
        )

        logger.info(
            "Calendar event created",
            event_id=event.id,
            loctician_id=loctician_id,
            title=title,
            event_type=event_type.value
        )

        return event

    # Availability Override Management
    async def create_availability_override(
        self,
        loctician_id: str,
        target_date: date,
        is_available: bool,
        start_time: Optional[time] = None,
        end_time: Optional[time] = None,
        reason: Optional[str] = None,
        created_by: Optional[str] = None,
        session: AsyncSession = None
    ) -> AvailabilityOverride:
        """
        Create availability override.

        Args:
            loctician_id: ID of the loctician
            target_date: Date for override
            is_available: Whether available on this date
            start_time: Start time if available
            end_time: End time if available
            reason: Reason for override
            created_by: User ID who created the override
            session: Database session

        Returns:
            Created AvailabilityOverride instance
        """
        if session is None:
            async with get_db_session() as session:
                return await self.create_availability_override(
                    loctician_id, target_date, is_available, start_time,
                    end_time, reason, created_by, session
                )

        # Validate
        if target_date < date.today():
            raise ValueError("Override date cannot be in the past")

        if is_available:
            if not start_time or not end_time:
                raise ValueError("Start and end times are required when available")
            if start_time >= end_time:
                raise ValueError("Start time must be before end time")

        # Check for existing override
        existing_result = await session.execute(
            select(AvailabilityOverride)
            .where(
                and_(
                    AvailabilityOverride.loctician_id == loctician_id,
                    AvailabilityOverride.date == target_date
                )
            )
        )
        existing_override = existing_result.scalar_one_or_none()

        if existing_override:
            # Update existing override
            existing_override.is_available = is_available
            existing_override.start_time = start_time
            existing_override.end_time = end_time
            existing_override.reason = reason

            await session.commit()
            await session.refresh(existing_override)

            # Send WebSocket notification
            await self._send_websocket_update(
                "availability_override",
                "update",
                loctician_id,
                existing_override.id,
                {
                    "date": existing_override.date.isoformat(),
                    "is_available": existing_override.is_available,
                    "reason": existing_override.reason
                }
            )

            return existing_override

        # Create new override
        override = AvailabilityOverride(
            loctician_id=loctician_id,
            date=target_date,
            is_available=is_available,
            start_time=start_time,
            end_time=end_time,
            reason=reason,
            created_by=created_by
        )

        session.add(override)
        await session.commit()
        await session.refresh(override)

        # Send WebSocket notification
        await self._send_websocket_update(
            "availability_override",
            "create",
            loctician_id,
            override.id,
            {
                "date": override.date.isoformat(),
                "is_available": override.is_available,
                "reason": override.reason
            }
        )

        logger.info(
            "Availability override created",
            override_id=override.id,
            loctician_id=loctician_id,
            date=target_date,
            is_available=is_available
        )

        return override

    async def create_bulk_overrides(
        self,
        loctician_id: str,
        dates: List[date],
        is_available: bool,
        start_time: Optional[time] = None,
        end_time: Optional[time] = None,
        reason: Optional[str] = None,
        created_by: Optional[str] = None,
        session: AsyncSession = None
    ) -> List[AvailabilityOverride]:
        """
        Create multiple availability overrides.

        Args:
            loctician_id: ID of the loctician
            dates: List of dates for overrides
            is_available: Whether available on these dates
            start_time: Start time if available
            end_time: End time if available
            reason: Reason for overrides
            created_by: User ID who created the overrides
            session: Database session

        Returns:
            List of created AvailabilityOverride instances
        """
        if session is None:
            async with get_db_session() as session:
                return await self.create_bulk_overrides(
                    loctician_id, dates, is_available, start_time,
                    end_time, reason, created_by, session
                )

        overrides = []
        today = date.today()

        for target_date in dates:
            if target_date < today:
                logger.warning(
                    "Skipping past date in bulk override",
                    date=target_date,
                    loctician_id=loctician_id
                )
                continue

            try:
                override = await self.create_availability_override(
                    loctician_id, target_date, is_available,
                    start_time, end_time, reason, created_by, session
                )
                overrides.append(override)
            except Exception as e:
                logger.error(
                    "Failed to create override in bulk",
                    date=target_date,
                    loctician_id=loctician_id,
                    error=str(e)
                )

        logger.info(
            "Bulk overrides created",
            loctician_id=loctician_id,
            created_count=len(overrides),
            total_requested=len(dates)
        )

        return overrides

    # Availability Checking
    async def check_availability(
        self,
        loctician_id: str,
        start_date: date,
        end_date: Optional[date] = None,
        duration_minutes: int = 60,
        slot_interval: int = 30,
        exclude_booking_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> Dict[date, AvailabilityResponse]:
        """
        Check availability for date range.

        Args:
            loctician_id: ID of the loctician
            start_date: Start date for check
            end_date: End date for check (defaults to start_date)
            duration_minutes: Duration in minutes
            slot_interval: Slot interval in minutes
            exclude_booking_id: Booking ID to exclude from conflicts
            session: Database session

        Returns:
            Dictionary mapping dates to availability responses
        """
        if session is None:
            async with get_db_session() as session:
                return await self.check_availability(
                    loctician_id, start_date, end_date, duration_minutes,
                    slot_interval, exclude_booking_id, session
                )

        if not end_date:
            end_date = start_date

        results = {}
        current_date = start_date

        while current_date <= end_date:
            # Get available slots for this date
            slots = await self.availability_engine.calculate_available_slots(
                loctician_id, current_date, duration_minutes,
                slot_interval, exclude_booking_id, session
            )

            available_count = sum(1 for slot in slots if slot.is_available)

            # Get working hours
            override = await self.availability_engine.get_availability_override(
                loctician_id, current_date, session
            )

            working_hours = None
            if override and override.is_available:
                working_hours = {
                    "start": override.start_time,
                    "end": override.end_time
                }
            else:
                base_availability = await self.availability_engine.get_base_availability(
                    loctician_id, current_date, session
                )
                if base_availability:
                    working_hours = {
                        "start": base_availability[0],
                        "end": base_availability[1]
                    }

            # General conflicts for the day
            conflicts = []
            if self.dt_helper.is_danish_holiday(current_date):
                conflicts.append("Danish public holiday")
            if override and not override.is_available:
                conflicts.append(f"Not available: {override.reason or 'Override'}")

            response = AvailabilityResponse(
                loctician_id=loctician_id,
                date=current_date,
                available_slots=slots,
                total_slots=len(slots),
                available_count=available_count,
                conflicts=conflicts,
                working_hours=working_hours
            )

            results[current_date] = response
            current_date += timedelta(days=1)

        return results

    async def check_conflicts(
        self,
        loctician_id: str,
        start_time: datetime,
        end_time: datetime,
        exclude_booking_id: Optional[str] = None,
        exclude_event_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> ConflictResult:
        """
        Check for scheduling conflicts.

        Args:
            loctician_id: ID of the loctician
            start_time: Proposed start time
            end_time: Proposed end time
            exclude_booking_id: Booking ID to exclude
            exclude_event_id: Event ID to exclude
            session: Database session

        Returns:
            ConflictResult with detailed conflict information
        """
        if session is None:
            async with get_db_session() as session:
                return await self.check_conflicts(
                    loctician_id, start_time, end_time,
                    exclude_booking_id, exclude_event_id, session
                )

        return await self.availability_engine.check_conflicts(
            loctician_id, start_time, end_time,
            exclude_booking_id, exclude_event_id, session
        )

    # Schedule Views
    async def get_schedule_view(
        self,
        loctician_id: str,
        view_type: ViewType,
        reference_date: date,
        session: AsyncSession = None
    ) -> ScheduleView:
        """
        Get schedule view for loctician.

        Args:
            loctician_id: ID of the loctician
            view_type: Type of view (day, week, month, agenda)
            reference_date: Reference date for the view
            session: Database session

        Returns:
            ScheduleView with schedule items and metadata
        """
        if session is None:
            async with get_db_session() as session:
                return await self.get_schedule_view(
                    loctician_id, view_type, reference_date, session
                )

        # Calculate date range based on view type
        if view_type == ViewType.DAY:
            start_date = end_date = reference_date
        elif view_type == ViewType.WEEK:
            week_dates = self.dt_helper.get_week_dates(reference_date)
            start_date = week_dates[0]
            end_date = week_dates[-1]
        elif view_type == ViewType.MONTH:
            start_date = reference_date.replace(day=1)
            next_month = start_date.replace(month=start_date.month + 1) if start_date.month < 12 else start_date.replace(year=start_date.year + 1, month=1)
            end_date = (next_month - timedelta(days=1))
        else:  # AGENDA
            start_date = reference_date
            end_date = reference_date + timedelta(days=30)  # 30-day agenda

        schedule_items = []

        # Get bookings in date range
        start_datetime = datetime.combine(start_date, time.min)
        end_datetime = datetime.combine(end_date, time.max)

        bookings_result = await session.execute(
            select(Booking)
            .options(
                selectinload(Booking.customer),
                selectinload(Booking.service)
            )
            .where(
                and_(
                    Booking.loctician_id == loctician_id,
                    Booking.appointment_start >= start_datetime,
                    Booking.appointment_end <= end_datetime,
                    Booking.status.in_([
                        BookingStatus.PENDING,
                        BookingStatus.CONFIRMED,
                        BookingStatus.IN_PROGRESS,
                        BookingStatus.COMPLETED
                    ])
                )
            )
            .order_by(Booking.appointment_start)
        )

        bookings = bookings_result.scalars().all()

        for booking in bookings:
            # Color based on status
            status_colors = {
                BookingStatus.PENDING: "#FFA500",      # Orange
                BookingStatus.CONFIRMED: "#4CAF50",    # Green
                BookingStatus.IN_PROGRESS: "#2196F3",  # Blue
                BookingStatus.COMPLETED: "#9E9E9E"     # Gray
            }

            schedule_item = ScheduleItem(
                id=booking.id,
                title=f"{booking.service.name} - {booking.customer.first_name} {booking.customer.last_name}",
                start_time=booking.appointment_start,
                end_time=booking.appointment_end,
                type="booking",
                status=booking.status.value,
                color=status_colors.get(booking.status, "#9E9E9E"),
                is_editable=booking.status in [BookingStatus.PENDING, BookingStatus.CONFIRMED],
                metadata={
                    "booking_number": booking.booking_number,
                    "customer_name": f"{booking.customer.first_name} {booking.customer.last_name}",
                    "service_name": booking.service.name,
                    "duration_minutes": booking.duration_minutes,
                    "total_amount": float(booking.total_amount),
                    "customer_notes": booking.customer_notes or "",
                    "special_requests": booking.special_requests or ""
                }
            )
            schedule_items.append(schedule_item)

        # Get calendar events in date range
        events_result = await session.execute(
            select(CalendarEvent)
            .where(
                and_(
                    CalendarEvent.loctician_id == loctician_id,
                    CalendarEvent.start_time >= start_datetime,
                    CalendarEvent.end_time <= end_datetime
                )
            )
            .order_by(CalendarEvent.start_time)
        )

        events = events_result.scalars().all()

        for event in events:
            # Expand recurring events if needed
            if event.is_recurring:
                occurrences = self.recurrence_expander.expand_recurrence(
                    event, start_date, end_date
                )
                for occurrence_start, occurrence_end in occurrences:
                    schedule_item = ScheduleItem(
                        id=f"{event.id}_{occurrence_start.isoformat()}",
                        title=event.title,
                        start_time=occurrence_start,
                        end_time=occurrence_end,
                        type="event",
                        color=self._get_event_color(event.event_type),
                        is_editable=True,
                        metadata={
                            "event_id": event.id,
                            "event_type": event.event_type.value,
                            "description": event.description or "",
                            "is_recurring": True,
                            "is_public": event.is_public
                        }
                    )
                    schedule_items.append(schedule_item)
            else:
                schedule_item = ScheduleItem(
                    id=event.id,
                    title=event.title,
                    start_time=event.start_time,
                    end_time=event.end_time,
                    type="event",
                    color=self._get_event_color(event.event_type),
                    is_editable=True,
                    metadata={
                        "event_type": event.event_type.value,
                        "description": event.description or "",
                        "is_recurring": False,
                        "is_public": event.is_public
                    }
                )
                schedule_items.append(schedule_item)

        # Get availability patterns and overrides
        patterns = await self.get_availability_patterns(
            loctician_id, active_only=True, session=session
        )

        overrides_result = await session.execute(
            select(AvailabilityOverride)
            .where(
                and_(
                    AvailabilityOverride.loctician_id == loctician_id,
                    AvailabilityOverride.date >= start_date,
                    AvailabilityOverride.date <= end_date
                )
            )
        )
        overrides = overrides_result.scalars().all()

        # Build working hours dictionary
        working_hours = {}
        current_date = start_date
        while current_date <= end_date:
            # Check for override first
            override = next((o for o in overrides if o.date == current_date), None)
            day_key = current_date.strftime("%Y-%m-%d")

            if override:
                if override.is_available and override.start_time and override.end_time:
                    working_hours[day_key] = {
                        "start": override.start_time.isoformat(),
                        "end": override.end_time.isoformat()
                    }
                # If override is not available, no working hours for that day
            else:
                # Use pattern
                base_hours = await self.availability_engine.get_base_availability(
                    loctician_id, current_date, session
                )
                if base_hours:
                    working_hours[day_key] = {
                        "start": base_hours[0].isoformat(),
                        "end": base_hours[1].isoformat()
                    }

            current_date += timedelta(days=1)

        # Sort schedule items by start time
        schedule_items.sort(key=lambda x: x.start_time)

        return ScheduleView(
            view_type=view_type,
            start_date=start_date,
            end_date=end_date,
            loctician_id=loctician_id,
            items=schedule_items,
            availability_patterns=patterns,
            availability_overrides=overrides,
            working_hours=working_hours
        )

    # iCal Export
    async def export_ical(
        self,
        loctician_id: str,
        start_date: date,
        end_date: date,
        include_bookings: bool = True,
        include_events: bool = True,
        include_availability: bool = False,
        session: AsyncSession = None
    ) -> str:
        """
        Export calendar data in iCal format.

        Args:
            loctician_id: ID of the loctician
            start_date: Start date for export
            end_date: End date for export
            include_bookings: Include bookings in export
            include_events: Include calendar events
            include_availability: Include availability patterns
            session: Database session

        Returns:
            iCal formatted string
        """
        if session is None:
            async with get_db_session() as session:
                return await self.export_ical(
                    loctician_id, start_date, end_date,
                    include_bookings, include_events, include_availability,
                    session
                )

        # Create calendar
        cal = Calendar()
        cal.add('prodid', '-//Loctician Booking System//Calendar//EN')
        cal.add('version', '2.0')
        cal.add('calscale', 'GREGORIAN')
        cal.add('method', 'PUBLISH')

        # Get loctician name
        loctician_result = await session.execute(
            select(User).where(User.id == loctician_id)
        )
        loctician = loctician_result.scalar_one_or_none()
        loctician_name = f"{loctician.first_name} {loctician.last_name}" if loctician else "Unknown"

        cal.add('x-wr-calname', f'{loctician_name} Calendar')
        cal.add('x-wr-timezone', settings.DEFAULT_TIMEZONE)

        start_datetime = datetime.combine(start_date, time.min)
        end_datetime = datetime.combine(end_date, time.max)

        # Add bookings
        if include_bookings:
            bookings_result = await session.execute(
                select(Booking)
                .options(
                    selectinload(Booking.customer),
                    selectinload(Booking.service)
                )
                .where(
                    and_(
                        Booking.loctician_id == loctician_id,
                        Booking.appointment_start >= start_datetime,
                        Booking.appointment_end <= end_datetime,
                        Booking.status.in_([
                            BookingStatus.CONFIRMED,
                            BookingStatus.IN_PROGRESS,
                            BookingStatus.COMPLETED
                        ])
                    )
                )
            )

            bookings = bookings_result.scalars().all()

            for booking in bookings:
                event = ICalEvent()
                event.add('uid', f'booking-{booking.id}@locticianbooking.com')
                event.add('dtstart', booking.appointment_start)
                event.add('dtend', booking.appointment_end)
                event.add('summary', f'{booking.service.name} - {booking.customer.first_name} {booking.customer.last_name}')
                event.add('description', f'''Booking: {booking.booking_number}
Customer: {booking.customer.first_name} {booking.customer.last_name}
Service: {booking.service.name}
Duration: {booking.duration_minutes} minutes
Status: {booking.status.value}
{f"Notes: {booking.customer_notes}" if booking.customer_notes else ""}
{f"Special requests: {booking.special_requests}" if booking.special_requests else ""}''')
                event.add('status', 'CONFIRMED' if booking.status == BookingStatus.CONFIRMED else 'TENTATIVE')
                event.add('created', booking.created_at)
                event.add('last-modified', booking.updated_at)

                cal.add_component(event)

        # Add calendar events
        if include_events:
            events_result = await session.execute(
                select(CalendarEvent)
                .where(
                    and_(
                        CalendarEvent.loctician_id == loctician_id,
                        CalendarEvent.start_time >= start_datetime,
                        CalendarEvent.end_time <= end_datetime
                    )
                )
            )

            events = events_result.scalars().all()

            for cal_event in events:
                if cal_event.is_recurring:
                    # Expand recurring events
                    occurrences = self.recurrence_expander.expand_recurrence(
                        cal_event, start_date, end_date
                    )

                    for i, (occurrence_start, occurrence_end) in enumerate(occurrences):
                        event = ICalEvent()
                        event.add('uid', f'event-{cal_event.id}-{i}@locticianbooking.com')
                        event.add('dtstart', occurrence_start)
                        event.add('dtend', occurrence_end)
                        event.add('summary', cal_event.title)
                        if cal_event.description:
                            event.add('description', cal_event.description)
                        event.add('categories', cal_event.event_type.value)
                        event.add('created', cal_event.created_at)
                        event.add('last-modified', cal_event.updated_at)

                        cal.add_component(event)
                else:
                    event = ICalEvent()
                    event.add('uid', f'event-{cal_event.id}@locticianbooking.com')
                    event.add('dtstart', cal_event.start_time)
                    event.add('dtend', cal_event.end_time)
                    event.add('summary', cal_event.title)
                    if cal_event.description:
                        event.add('description', cal_event.description)
                    event.add('categories', cal_event.event_type.value)
                    event.add('created', cal_event.created_at)
                    event.add('last-modified', cal_event.updated_at)

                    cal.add_component(event)

        return cal.to_ical().decode('utf-8')

    # WebSocket Notifications
    async def _send_websocket_update(
        self,
        resource_type: str,
        action: str,
        loctician_id: str,
        resource_id: str,
        data: Dict[str, Any]
    ) -> None:
        """Send WebSocket update notification."""
        try:
            message = CalendarWebSocketMessage(
                type="calendar_update",
                action=action,
                loctician_id=loctician_id,
                resource_type=resource_type,
                resource_id=resource_id,
                data=data,
                timestamp=self.dt_helper.now_danish()
            )

            # Send to all connected clients for this loctician
            await connection_manager.broadcast_to_user(
                loctician_id,
                message.dict()
            )

        except Exception as e:
            logger.error(
                "Failed to send WebSocket update",
                resource_type=resource_type,
                action=action,
                loctician_id=loctician_id,
                error=str(e)
            )

    @staticmethod
    def _get_event_color(event_type: CalendarEventType) -> str:
        """Get display color for event type."""
        colors = {
            CalendarEventType.BREAK: "#FF9800",        # Orange
            CalendarEventType.MEETING: "#2196F3",      # Blue
            CalendarEventType.VACATION: "#4CAF50",     # Green
            CalendarEventType.SICK_LEAVE: "#F44336",   # Red
            CalendarEventType.TRAINING: "#9C27B0",     # Purple
            CalendarEventType.PERSONAL: "#607D8B"      # Blue Gray
        }
        return colors.get(event_type, "#9E9E9E")


# Create service instance
calendar_service = CalendarService()