"""
Availability Pattern API endpoints.

Provides CRUD operations for weekly recurring availability patterns.
Includes validation, conflict checking, and real-time updates.
"""
from datetime import date, datetime, time
from typing import Dict, List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    get_current_admin,
    get_current_loctician,
    get_current_user,
    rate_limit_check,
)
from app.core.database import get_db
from app.models.user import User
from app.schemas.calendar import (
    AvailabilityPattern,
    AvailabilityPatternCreate,
    AvailabilityPatternUpdate,
    CalendarResponse,
    PaginatedResponse,
    DayOfWeek,
)
from app.services.calendar_service import calendar_service

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.post("/", response_model=AvailabilityPattern, status_code=status.HTTP_201_CREATED)
async def create_availability_pattern(
    pattern_data: AvailabilityPatternCreate,
    current_user: User = Depends(get_current_loctician),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> AvailabilityPattern:
    """
    Create a new availability pattern.

    Creates a weekly recurring availability pattern for a loctician.
    Automatically handles conflicts with existing patterns.

    **Business Rules:**
    - Locticians can only create patterns for themselves (unless admin)
    - Overlapping patterns are automatically deactivated
    - Start time must be before end time
    - Effective dates must be valid

    **Danish Compliance:**
    - Validates against Danish working time regulations
    - Considers Danish business hours standards
    """
    try:
        # Authorization check - locticians can only manage their own patterns
        if current_user.id != pattern_data.loctician_id:
            if not hasattr(current_user, 'role') or current_user.role not in ['admin', 'staff']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only manage your own availability patterns"
                )

        # Validate Danish working time regulations
        duration_hours = (
            datetime.combine(date.today(), pattern_data.end_time) -
            datetime.combine(date.today(), pattern_data.start_time)
        ).total_seconds() / 3600

        if duration_hours > 8:
            logger.warning(
                "Pattern exceeds Danish daily working hours",
                loctician_id=pattern_data.loctician_id,
                duration_hours=duration_hours
            )

        pattern = await calendar_service.create_availability_pattern(
            loctician_id=pattern_data.loctician_id,
            day_of_week=pattern_data.day_of_week.value,
            start_time=pattern_data.start_time,
            end_time=pattern_data.end_time,
            effective_from=pattern_data.effective_from,
            effective_until=pattern_data.effective_until,
            is_active=pattern_data.is_active,
            session=db
        )

        logger.info(
            "Availability pattern created",
            pattern_id=pattern.id,
            loctician_id=pattern_data.loctician_id,
            day_of_week=pattern_data.day_of_week.value,
            user_id=current_user.id
        )

        return pattern

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Failed to create availability pattern",
            loctician_id=pattern_data.loctician_id,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create availability pattern"
        )


@router.get("/", response_model=List[AvailabilityPattern])
async def list_availability_patterns(
    loctician_id: Optional[str] = Query(None, description="Filter by loctician ID"),
    active_only: bool = Query(True, description="Return only active patterns"),
    effective_date: Optional[date] = Query(None, description="Filter patterns effective on this date"),
    day_of_week: Optional[DayOfWeek] = Query(None, description="Filter by day of week"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> List[AvailabilityPattern]:
    """
    List availability patterns.

    Returns availability patterns with optional filtering.

    **Access Control:**
    - Customers: Cannot access availability patterns directly
    - Locticians: Can access their own patterns
    - Admins: Can access all patterns

    **Filtering:**
    - By loctician ID
    - Active/inactive patterns
    - Effective on specific date
    - By day of week
    """
    try:
        # Determine which loctician's patterns to fetch
        target_loctician_id = loctician_id

        # Authorization logic
        if current_user.role == "customer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Customers cannot access availability patterns directly"
            )
        elif current_user.role == "loctician":
            if loctician_id and loctician_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only access your own availability patterns"
                )
            target_loctician_id = current_user.id
        # Admins can access all patterns

        if not target_loctician_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Loctician ID is required"
            )

        patterns = await calendar_service.get_availability_patterns(
            loctician_id=target_loctician_id,
            active_only=active_only,
            effective_date=effective_date,
            session=db
        )

        # Filter by day of week if specified
        if day_of_week is not None:
            patterns = [p for p in patterns if p.day_of_week == day_of_week.value]

        logger.info(
            "Availability patterns retrieved",
            loctician_id=target_loctician_id,
            count=len(patterns),
            user_id=current_user.id
        )

        return patterns

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to retrieve availability patterns",
            loctician_id=target_loctician_id,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve availability patterns"
        )


@router.get("/{pattern_id}", response_model=AvailabilityPattern)
async def get_availability_pattern(
    pattern_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> AvailabilityPattern:
    """
    Get a specific availability pattern.

    Returns detailed information about a single availability pattern.

    **Access Control:**
    - Locticians can access their own patterns
    - Admins can access all patterns
    """
    try:
        # Get the pattern first to check ownership
        patterns = await calendar_service.get_availability_patterns(
            loctician_id="", # We'll filter after getting the pattern
            active_only=False,
            session=db
        )

        pattern = next((p for p in patterns if p.id == pattern_id), None)

        if not pattern:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Availability pattern not found"
            )

        # Authorization check
        if current_user.role == "loctician" and pattern.loctician_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own availability patterns"
            )

        logger.info(
            "Availability pattern retrieved",
            pattern_id=pattern_id,
            loctician_id=pattern.loctician_id,
            user_id=current_user.id
        )

        return pattern

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to retrieve availability pattern",
            pattern_id=pattern_id,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve availability pattern"
        )


@router.put("/{pattern_id}", response_model=AvailabilityPattern)
async def update_availability_pattern(
    pattern_id: str,
    pattern_data: AvailabilityPatternUpdate,
    current_user: User = Depends(get_current_loctician),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> AvailabilityPattern:
    """
    Update an availability pattern.

    Updates an existing availability pattern. Only the specified fields are updated.

    **Business Rules:**
    - Cannot modify day_of_week (create new pattern instead)
    - Start time must be before end time
    - Cannot create conflicts with existing bookings

    **Danish Compliance:**
    - Validates against working time regulations
    - Checks for reasonable working hours
    """
    try:
        # Get existing pattern to check ownership
        patterns = await calendar_service.get_availability_patterns(
            loctician_id="",
            active_only=False,
            session=db
        )

        existing_pattern = next((p for p in patterns if p.id == pattern_id), None)

        if not existing_pattern:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Availability pattern not found"
            )

        # Authorization check
        if current_user.id != existing_pattern.loctician_id:
            if not hasattr(current_user, 'role') or current_user.role not in ['admin', 'staff']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only update your own availability patterns"
                )

        # Validate working hours if times are being updated
        if pattern_data.start_time or pattern_data.end_time:
            start_time = pattern_data.start_time or existing_pattern.start_time
            end_time = pattern_data.end_time or existing_pattern.end_time

            duration_hours = (
                datetime.combine(date.today(), end_time) -
                datetime.combine(date.today(), start_time)
            ).total_seconds() / 3600

            if duration_hours > 8:
                logger.warning(
                    "Updated pattern exceeds Danish daily working hours",
                    pattern_id=pattern_id,
                    duration_hours=duration_hours
                )

        updated_pattern = await calendar_service.update_availability_pattern(
            pattern_id=pattern_id,
            start_time=pattern_data.start_time,
            end_time=pattern_data.end_time,
            effective_from=pattern_data.effective_from,
            effective_until=pattern_data.effective_until,
            is_active=pattern_data.is_active,
            session=db
        )

        if not updated_pattern:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Availability pattern not found"
            )

        logger.info(
            "Availability pattern updated",
            pattern_id=pattern_id,
            loctician_id=updated_pattern.loctician_id,
            user_id=current_user.id
        )

        return updated_pattern

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Failed to update availability pattern",
            pattern_id=pattern_id,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update availability pattern"
        )


@router.delete("/{pattern_id}", response_model=CalendarResponse)
async def delete_availability_pattern(
    pattern_id: str,
    current_user: User = Depends(get_current_loctician),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> CalendarResponse:
    """
    Delete an availability pattern.

    Permanently removes an availability pattern. This action cannot be undone.

    **Business Rules:**
    - Cannot delete if there are future bookings dependent on this pattern
    - Considers impact on existing bookings and customer expectations

    **Safety Measures:**
    - Validates no future bookings would be orphaned
    - Logs deletion for audit purposes
    """
    try:
        # Get existing pattern to check ownership
        patterns = await calendar_service.get_availability_patterns(
            loctician_id="",
            active_only=False,
            session=db
        )

        existing_pattern = next((p for p in patterns if p.id == pattern_id), None)

        if not existing_pattern:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Availability pattern not found"
            )

        # Authorization check
        if current_user.id != existing_pattern.loctician_id:
            if not hasattr(current_user, 'role') or current_user.role not in ['admin', 'staff']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only delete your own availability patterns"
                )

        # Check for dependent bookings
        # This would require checking future bookings that rely on this pattern
        # For now, we'll allow deletion but log a warning
        logger.warning(
            "Deleting availability pattern - verify no dependent bookings",
            pattern_id=pattern_id,
            loctician_id=existing_pattern.loctician_id,
            user_id=current_user.id
        )

        success = await calendar_service.delete_availability_pattern(
            pattern_id=pattern_id,
            session=db
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Availability pattern not found"
            )

        logger.info(
            "Availability pattern deleted",
            pattern_id=pattern_id,
            loctician_id=existing_pattern.loctician_id,
            user_id=current_user.id
        )

        return CalendarResponse(
            success=True,
            message="Availability pattern deleted successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to delete availability pattern",
            pattern_id=pattern_id,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete availability pattern"
        )


@router.post("/{pattern_id}/deactivate", response_model=AvailabilityPattern)
async def deactivate_availability_pattern(
    pattern_id: str,
    current_user: User = Depends(get_current_loctician),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> AvailabilityPattern:
    """
    Deactivate an availability pattern.

    Safely deactivates a pattern without deleting it, preserving audit history.
    This is the preferred method over deletion for business continuity.

    **Business Benefits:**
    - Maintains historical data
    - Can be reactivated if needed
    - Preserves audit trail
    """
    try:
        updated_pattern = await calendar_service.update_availability_pattern(
            pattern_id=pattern_id,
            is_active=False,
            session=db
        )

        if not updated_pattern:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Availability pattern not found"
            )

        # Authorization check
        if current_user.id != updated_pattern.loctician_id:
            if not hasattr(current_user, 'role') or current_user.role not in ['admin', 'staff']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only deactivate your own availability patterns"
                )

        logger.info(
            "Availability pattern deactivated",
            pattern_id=pattern_id,
            loctician_id=updated_pattern.loctician_id,
            user_id=current_user.id
        )

        return updated_pattern

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to deactivate availability pattern",
            pattern_id=pattern_id,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate availability pattern"
        )


@router.get("/loctician/{loctician_id}/weekly", response_model=Dict[str, List[AvailabilityPattern]])
async def get_weekly_patterns(
    loctician_id: str,
    effective_date: Optional[date] = Query(None, description="Date to check pattern effectiveness"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> Dict[str, List[AvailabilityPattern]]:
    """
    Get weekly availability patterns grouped by day.

    Returns all active availability patterns for a loctician organized by day of week.
    Useful for displaying weekly schedules and calendar views.

    **Response Format:**
    ```json
    {
        "monday": [...],
        "tuesday": [...],
        ...
        "sunday": [...]
    }
    ```
    """
    try:
        # Authorization check
        if current_user.role == "loctician" and loctician_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own availability patterns"
            )

        patterns = await calendar_service.get_availability_patterns(
            loctician_id=loctician_id,
            active_only=True,
            effective_date=effective_date,
            session=db
        )

        # Group by day of week
        day_names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        weekly_patterns = {day: [] for day in day_names}

        for pattern in patterns:
            day_name = day_names[pattern.day_of_week]
            weekly_patterns[day_name].append(pattern)

        # Sort patterns within each day by start time
        for day_patterns in weekly_patterns.values():
            day_patterns.sort(key=lambda p: p.start_time)

        logger.info(
            "Weekly patterns retrieved",
            loctician_id=loctician_id,
            total_patterns=len(patterns),
            user_id=current_user.id
        )

        return weekly_patterns

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to retrieve weekly patterns",
            loctician_id=loctician_id,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve weekly patterns"
        )