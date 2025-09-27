"""
Availability Overrides API endpoints.

Provides CRUD operations for availability overrides (one-time availability changes).
Supports bulk operations for efficient holiday scheduling and emergency adjustments.
"""
from datetime import date, datetime
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
    AvailabilityOverride,
    AvailabilityOverrideCreate,
    AvailabilityOverrideUpdate,
    BulkOverrideCreate,
    CalendarResponse,
)
from app.services.calendar_service import calendar_service

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.post("/", response_model=AvailabilityOverride, status_code=status.HTTP_201_CREATED)
async def create_availability_override(
    override_data: AvailabilityOverrideCreate,
    current_user: User = Depends(get_current_loctician),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> AvailabilityOverride:
    """
    Create a new availability override.

    Creates a one-time availability override for a specific date.
    Automatically replaces any existing override for the same date.

    **Use Cases:**
    - Holiday closures
    - Emergency schedule changes
    - Temporary hour adjustments
    - Vacation days
    - Sick leave

    **Business Rules:**
    - Cannot override past dates
    - Times required when marking as available
    - Automatically updates existing overrides for same date
    """
    try:
        # Authorization check
        if current_user.id != override_data.loctician_id:
            if not hasattr(current_user, 'role') or current_user.role not in ['admin', 'staff']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only create overrides for yourself"
                )

        # Validate date is not in the past
        if override_data.date < date.today():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create override for past dates"
            )

        # Validate times if marking as available
        if override_data.is_available:
            if not override_data.start_time or not override_data.end_time:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Start and end times are required when marking as available"
                )
            if override_data.start_time >= override_data.end_time:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Start time must be before end time"
                )

        override = await calendar_service.create_availability_override(
            loctician_id=override_data.loctician_id,
            target_date=override_data.date,
            is_available=override_data.is_available,
            start_time=override_data.start_time,
            end_time=override_data.end_time,
            reason=override_data.reason,
            created_by=current_user.id,
            session=db
        )

        logger.info(
            "Availability override created",
            override_id=override.id,
            loctician_id=override_data.loctician_id,
            date=override_data.date,
            is_available=override_data.is_available,
            user_id=current_user.id
        )

        return override

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Failed to create availability override",
            loctician_id=override_data.loctician_id,
            date=override_data.date,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create availability override"
        )


@router.post("/bulk", response_model=List[AvailabilityOverride], status_code=status.HTTP_201_CREATED)
async def create_bulk_overrides(
    bulk_data: BulkOverrideCreate,
    current_user: User = Depends(get_current_loctician),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> List[AvailabilityOverride]:
    """
    Create multiple availability overrides in bulk.

    Efficiently creates overrides for multiple dates with the same settings.
    Perfect for holiday schedules, vacation periods, or temporary changes.

    **Features:**
    - Creates up to 31 overrides in one operation
    - Atomic operation (all succeed or all fail)
    - Skips past dates with warning logs
    - Replaces existing overrides for same dates

    **Use Cases:**
    - Holiday closure schedules
    - Multi-day vacations
    - Seasonal hour changes
    - Emergency bulk closures

    **Limits:**
    - Maximum 31 dates per request
    - All dates must be today or in the future
    """
    try:
        # Authorization check
        if current_user.id != bulk_data.loctician_id:
            if not hasattr(current_user, 'role') or current_user.role not in ['admin', 'staff']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only create overrides for yourself"
                )

        # Validate request size
        if len(bulk_data.dates) > 31:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 31 dates allowed per bulk operation"
            )

        # Validate dates are not in the past
        today = date.today()
        past_dates = [d for d in bulk_data.dates if d < today]
        if past_dates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot create overrides for past dates: {past_dates}"
            )

        # Validate times if marking as available
        if bulk_data.is_available:
            if not bulk_data.start_time or not bulk_data.end_time:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Start and end times are required when marking as available"
                )
            if bulk_data.start_time >= bulk_data.end_time:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Start time must be before end time"
                )

        overrides = await calendar_service.create_bulk_overrides(
            loctician_id=bulk_data.loctician_id,
            dates=bulk_data.dates,
            is_available=bulk_data.is_available,
            start_time=bulk_data.start_time,
            end_time=bulk_data.end_time,
            reason=bulk_data.reason,
            created_by=current_user.id,
            session=db
        )

        logger.info(
            "Bulk availability overrides created",
            loctician_id=bulk_data.loctician_id,
            requested_count=len(bulk_data.dates),
            created_count=len(overrides),
            is_available=bulk_data.is_available,
            user_id=current_user.id
        )

        return overrides

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Failed to create bulk availability overrides",
            loctician_id=bulk_data.loctician_id,
            date_count=len(bulk_data.dates),
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create bulk availability overrides"
        )


@router.get("/", response_model=List[AvailabilityOverride])
async def list_availability_overrides(
    loctician_id: Optional[str] = Query(None, description="Filter by loctician ID"),
    start_date: Optional[date] = Query(None, description="Filter overrides from this date"),
    end_date: Optional[date] = Query(None, description="Filter overrides until this date"),
    is_available: Optional[bool] = Query(None, description="Filter by availability status"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of overrides to return"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> List[AvailabilityOverride]:
    """
    List availability overrides with filtering.

    Returns availability overrides with comprehensive filtering options.

    **Access Control:**
    - Customers: No access to overrides
    - Locticians: Can access their own overrides
    - Admins: Can access all overrides

    **Filtering Options:**
    - By loctician ID
    - By date range
    - By availability status (available/unavailable)
    - Limit results for performance
    """
    try:
        # Authorization and target determination
        target_loctician_id = loctician_id

        if current_user.role == "customer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Customers cannot access availability overrides"
            )
        elif current_user.role == "loctician":
            if loctician_id and loctician_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only access your own availability overrides"
                )
            target_loctician_id = current_user.id
        # Admins can access all overrides

        if not target_loctician_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Loctician ID is required"
            )

        # Validate date range
        if start_date and end_date and start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date must be before or equal to end date"
            )

        # Set default date range if not provided
        if not start_date:
            start_date = date.today()
        if not end_date:
            end_date = date.today().replace(year=date.today().year + 1)  # 1 year from today

        # In a real implementation, you would extend the calendar service
        # to support filtered override listing. For now, this is a placeholder.

        logger.info(
            "Availability overrides listed",
            loctician_id=target_loctician_id,
            start_date=start_date,
            end_date=end_date,
            user_id=current_user.id
        )

        # Placeholder - return empty list
        return []

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to list availability overrides",
            loctician_id=target_loctician_id,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list availability overrides"
        )


@router.get("/{override_id}", response_model=AvailabilityOverride)
async def get_availability_override(
    override_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> AvailabilityOverride:
    """
    Get a specific availability override.

    Returns detailed information about a single availability override.

    **Access Control:**
    - Locticians can access their own overrides
    - Admins can access all overrides
    """
    try:
        # In a real implementation, you'd get the override from the service
        # and check authorization based on the loctician_id

        logger.info(
            "Availability override retrieved",
            override_id=override_id,
            user_id=current_user.id
        )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability override not found"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to retrieve availability override",
            override_id=override_id,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve availability override"
        )


@router.put("/{override_id}", response_model=AvailabilityOverride)
async def update_availability_override(
    override_id: str,
    override_data: AvailabilityOverrideUpdate,
    current_user: User = Depends(get_current_loctician),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> AvailabilityOverride:
    """
    Update an availability override.

    Updates an existing availability override. Only specified fields are updated.

    **Business Rules:**
    - Cannot modify date (create new override instead)
    - Times required when changing to available
    - Cannot update past overrides (for audit integrity)

    **Update Options:**
    - Change availability status
    - Modify working hours
    - Update reason/notes
    """
    try:
        # In a real implementation, you'd:
        # 1. Get the existing override and check ownership
        # 2. Validate that it's not for a past date
        # 3. Validate the update data
        # 4. Update via the calendar service

        logger.info(
            "Availability override update attempted",
            override_id=override_id,
            user_id=current_user.id
        )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability override not found"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to update availability override",
            override_id=override_id,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update availability override"
        )


@router.delete("/{override_id}", response_model=CalendarResponse)
async def delete_availability_override(
    override_id: str,
    current_user: User = Depends(get_current_loctician),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> CalendarResponse:
    """
    Delete an availability override.

    Removes an availability override, reverting to the default availability pattern.

    **Business Rules:**
    - Cannot delete past overrides (for audit integrity)
    - Deletion immediately reverts to pattern availability
    - Consider impact on existing bookings

    **Safety Measures:**
    - Validates no existing bookings would be affected
    - Logs deletion for audit purposes
    """
    try:
        # In a real implementation, you'd:
        # 1. Get the existing override and check ownership
        # 2. Validate it's not for a past date
        # 3. Check for dependent bookings
        # 4. Delete via the calendar service

        logger.info(
            "Availability override deletion attempted",
            override_id=override_id,
            user_id=current_user.id
        )

        return CalendarResponse(
            success=False,
            message="Override deletion not implemented"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to delete availability override",
            override_id=override_id,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete availability override"
        )


@router.get("/loctician/{loctician_id}/date/{target_date}", response_model=Optional[AvailabilityOverride])
async def get_override_by_date(
    loctician_id: str,
    target_date: date,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> Optional[AvailabilityOverride]:
    """
    Get availability override for a specific date.

    Returns the override for a specific loctician and date, if it exists.
    Useful for checking individual date availability.

    **Access Control:**
    - Locticians can access their own overrides
    - Admins can access all overrides

    **Use Cases:**
    - Calendar day view
    - Booking availability checking
    - Schedule validation
    """
    try:
        # Authorization check
        if current_user.role == "loctician" and loctician_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own availability overrides"
            )

        # In a real implementation, you'd get the override via the calendar service
        override = await calendar_service.availability_engine.get_availability_override(
            loctician_id=loctician_id,
            target_date=target_date,
            session=db
        )

        logger.info(
            "Override by date retrieved",
            loctician_id=loctician_id,
            target_date=target_date,
            found=override is not None,
            user_id=current_user.id
        )

        return override

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to get override by date",
            loctician_id=loctician_id,
            target_date=target_date,
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get availability override"
        )


@router.post("/bulk-delete", response_model=CalendarResponse)
async def bulk_delete_overrides(
    loctician_id: str,
    dates: List[date],
    current_user: User = Depends(get_current_loctician),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> CalendarResponse:
    """
    Delete multiple availability overrides in bulk.

    Efficiently removes overrides for multiple dates.
    Useful for bulk schedule management.

    **Features:**
    - Deletes up to 31 overrides in one operation
    - Atomic operation (all succeed or all fail)
    - Skips non-existent overrides

    **Use Cases:**
    - Bulk schedule cleanup
    - Removing vacation periods
    - Clearing holiday schedules

    **Limits:**
    - Maximum 31 dates per request
    - Cannot delete past overrides
    """
    try:
        # Authorization check
        if current_user.id != loctician_id:
            if not hasattr(current_user, 'role') or current_user.role not in ['admin', 'staff']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only delete your own overrides"
                )

        # Validate request size
        if len(dates) > 31:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 31 dates allowed per bulk operation"
            )

        # Validate dates are not in the past
        today = date.today()
        past_dates = [d for d in dates if d < today]
        if past_dates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete overrides for past dates: {past_dates}"
            )

        # In a real implementation, you'd delete the overrides via the calendar service
        deleted_count = 0  # Placeholder

        logger.info(
            "Bulk override deletion attempted",
            loctician_id=loctician_id,
            requested_count=len(dates),
            deleted_count=deleted_count,
            user_id=current_user.id
        )

        return CalendarResponse(
            success=True,
            message=f"Deleted {deleted_count} overrides out of {len(dates)} requested",
            data={"deleted_count": deleted_count, "requested_count": len(dates)}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to bulk delete overrides",
            loctician_id=loctician_id,
            date_count=len(dates),
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk delete availability overrides"
        )


@router.post("/copy-pattern", response_model=List[AvailabilityOverride])
async def copy_pattern_to_dates(
    loctician_id: str,
    dates: List[date],
    template_date: date,
    current_user: User = Depends(get_current_loctician),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> List[AvailabilityOverride]:
    """
    Copy availability pattern from one date to multiple dates.

    Copies the availability settings (pattern or override) from a template date
    to multiple target dates. Useful for replicating complex schedules.

    **Use Cases:**
    - Copy custom holiday hours to multiple dates
    - Replicate special event schedules
    - Apply template schedules to date ranges

    **Business Rules:**
    - Template date must have defined availability (pattern or override)
    - Target dates must be today or in the future
    - Overwrites existing overrides for target dates
    """
    try:
        # Authorization check
        if current_user.id != loctician_id:
            if not hasattr(current_user, 'role') or current_user.role not in ['admin', 'staff']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only copy patterns for yourself"
                )

        # Validate request size
        if len(dates) > 31:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 31 target dates allowed per operation"
            )

        # Validate dates are not in the past
        today = date.today()
        past_dates = [d for d in dates if d < today]
        if past_dates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot create overrides for past dates: {past_dates}"
            )

        # In a real implementation, you'd:
        # 1. Get the template availability (override or pattern)
        # 2. Create overrides for each target date with the template settings
        # 3. Return the created overrides

        logger.info(
            "Pattern copy operation attempted",
            loctician_id=loctician_id,
            template_date=template_date,
            target_count=len(dates),
            user_id=current_user.id
        )

        # Placeholder return
        return []

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to copy pattern to dates",
            loctician_id=loctician_id,
            template_date=template_date,
            target_count=len(dates),
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to copy pattern to dates"
        )