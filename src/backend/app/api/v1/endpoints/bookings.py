"""
Booking API endpoints.
"""
import json
from datetime import date, datetime
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    get_current_admin,
    get_current_loctician,
    get_current_user,
    rate_limit_check,
)
from app.core.database import get_db
from app.models.enums import BookingStatus
from app.models.user import User
from app.schemas.booking import (
    AvailabilityCheck,
    AvailabilitySlot,
    Booking,
    BookingCancellation,
    BookingCreate,
    BookingSearch,
    BookingStatusUpdate,
    BookingSummary,
    BookingUpdate,
)

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.post("/", response_model=Booking, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> Booking:
    """
    Create a new booking using secure PostgreSQL function.

    This endpoint uses the create_secure_booking function which includes:
    - Anti-double-booking validation
    - Availability checking
    - Automatic pricing calculation
    - Email queue integration
    - Full audit trail
    """
    try:
        # Call the PostgreSQL secure booking function
        query = text(
            "SELECT create_secure_booking("
            ":customer_id, :loctician_id, :service_id, :appointment_start, "
            ":customer_notes, :special_requests, :session_token)"
        )

        result = await db.execute(
            query,
            {
                "customer_id": current_user.id,
                "loctician_id": booking_data.loctician_id,
                "service_id": booking_data.service_id,
                "appointment_start": booking_data.appointment_start,
                "customer_notes": booking_data.customer_notes,
                "special_requests": booking_data.special_requests,
                "session_token": None,  # We use JWT instead
            }
        )

        booking_result = result.scalar()

        if isinstance(booking_result, str):
            booking_result = json.loads(booking_result)

        if not booking_result.get("success"):
            error_code = booking_result.get("error", "BOOKING_FAILED")
            error_message = booking_result.get("message", "Booking creation failed")

            # Map database errors to HTTP status codes
            if error_code == "TIME_UNAVAILABLE":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=error_message
                )
            elif error_code == "INVALID_SERVICE":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_message
                )
            elif error_code == "INVALID_LOCTICIAN":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_message
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Booking creation failed"
                )

        booking_id = booking_result["booking_id"]

        # Fetch the created booking
        booking_query = text(
            """
            SELECT b.*, s.name as service_name,
                   c.first_name || ' ' || c.last_name as customer_name,
                   l.first_name || ' ' || l.last_name as loctician_name
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            JOIN users c ON b.customer_id = c.id
            JOIN users l ON b.loctician_id = l.id
            WHERE b.id = :booking_id
            """
        )

        booking_result = await db.execute(booking_query, {"booking_id": booking_id})
        booking_row = booking_result.fetchone()

        if not booking_row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Booking created but could not be retrieved"
            )

        # Convert to Booking schema
        booking_dict = dict(booking_row._mapping)
        booking = Booking(**booking_dict)

        logger.info(
            "Booking created successfully",
            booking_id=booking_id,
            customer_id=current_user.id,
            loctician_id=booking_data.loctician_id
        )

        return booking

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Booking creation error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Booking creation failed"
        )


@router.get("/", response_model=List[BookingSummary])
async def list_bookings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[BookingStatus] = Query(None, description="Filter by status"),
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    limit: int = Query(default=100, le=1000, description="Limit results"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
) -> List[BookingSummary]:
    """
    List bookings for the current user.

    Customers see their own bookings.
    Locticians see bookings they're assigned to.
    Admins see all bookings.
    """
    try:
        # Build query based on user role
        if current_user.role.value == "customer":
            where_clause = "WHERE b.customer_id = :user_id"
        elif current_user.role.value == "loctician":
            where_clause = "WHERE b.loctician_id = :user_id"
        else:  # admin
            where_clause = "WHERE 1=1"

        # Add additional filters
        if status_filter:
            where_clause += f" AND b.status = '{status_filter.value}'"
        if date_from:
            where_clause += f" AND DATE(b.appointment_start) >= '{date_from}'"
        if date_to:
            where_clause += f" AND DATE(b.appointment_start) <= '{date_to}'"

        query = text(f"""
            SELECT
                b.id, b.booking_number, b.appointment_start, b.appointment_end,
                b.status, b.payment_status, b.total_amount,
                c.first_name || ' ' || c.last_name as customer_name,
                l.first_name || ' ' || l.last_name as loctician_name,
                s.name as service_name
            FROM bookings b
            JOIN users c ON b.customer_id = c.id
            JOIN users l ON b.loctician_id = l.id
            JOIN services s ON b.service_id = s.id
            {where_clause}
            ORDER BY b.appointment_start DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await db.execute(
            query,
            {
                "user_id": current_user.id,
                "limit": limit,
                "offset": offset
            }
        )

        bookings = []
        for row in result.fetchall():
            booking_dict = dict(row._mapping)
            bookings.append(BookingSummary(**booking_dict))

        return bookings

    except Exception as e:
        logger.error("List bookings error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list bookings"
        )


@router.get("/{booking_id}", response_model=Booking)
async def get_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Booking:
    """Get booking details by ID."""
    try:
        query = text("""
            SELECT b.*,
                   array_agg(
                       json_build_object(
                           'id', bs.id,
                           'service_id', bs.service_id,
                           'quantity', bs.quantity,
                           'unit_price', bs.unit_price,
                           'total_price', bs.total_price,
                           'notes', bs.notes
                       )
                   ) FILTER (WHERE bs.id IS NOT NULL) as booking_services,
                   array_agg(
                       json_build_object(
                           'id', bp.id,
                           'product_id', bp.product_id,
                           'quantity', bp.quantity,
                           'unit_price', bp.unit_price,
                           'total_price', bp.total_price
                       )
                   ) FILTER (WHERE bp.id IS NOT NULL) as booking_products
            FROM bookings b
            LEFT JOIN booking_services bs ON b.id = bs.booking_id
            LEFT JOIN booking_products bp ON b.id = bp.booking_id
            WHERE b.id = :booking_id
            GROUP BY b.id
        """)

        result = await db.execute(query, {"booking_id": booking_id})
        booking_row = result.fetchone()

        if not booking_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        booking_dict = dict(booking_row._mapping)

        # Check access permissions
        if (current_user.role.value == "customer" and
            booking_dict["customer_id"] != current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        elif (current_user.role.value == "loctician" and
              booking_dict["loctician_id"] != current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Convert JSON arrays to proper lists
        booking_dict["booking_services"] = booking_dict.get("booking_services") or []
        booking_dict["booking_products"] = booking_dict.get("booking_products") or []
        booking_dict["state_changes"] = []  # Will be populated separately if needed

        return Booking(**booking_dict)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get booking error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get booking"
        )


@router.put("/{booking_id}", response_model=Booking)
async def update_booking(
    booking_id: str,
    booking_data: BookingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Booking:
    """Update booking details."""
    try:
        # First check if booking exists and user has permission
        booking = await get_booking(booking_id, current_user, db)

        # Only allow updates if booking is not completed or cancelled
        if booking.status in [BookingStatus.COMPLETED, BookingStatus.CANCELLED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update completed or cancelled booking"
            )

        # Build update query
        update_fields = []
        update_values = {"booking_id": booking_id}

        if booking_data.appointment_start:
            # Check availability for new time
            if booking_data.appointment_start != booking.appointment_start:
                # Use check_availability function
                availability_query = text(
                    "SELECT check_availability(:loctician_id, :start_time, :end_time, :exclude_booking_id)"
                )

                # Calculate new end time based on service duration
                new_end_time = booking_data.appointment_start + timedelta(minutes=booking.duration_minutes)

                availability_result = await db.execute(
                    availability_query,
                    {
                        "loctician_id": booking.loctician_id,
                        "start_time": booking_data.appointment_start,
                        "end_time": new_end_time,
                        "exclude_booking_id": booking_id
                    }
                )

                if not availability_result.scalar():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Selected time slot is not available"
                    )

                update_fields.append("appointment_start = :appointment_start")
                update_fields.append("appointment_end = :appointment_end")
                update_values["appointment_start"] = booking_data.appointment_start
                update_values["appointment_end"] = new_end_time

        if booking_data.customer_notes is not None:
            update_fields.append("customer_notes = :customer_notes")
            update_values["customer_notes"] = booking_data.customer_notes

        if booking_data.loctician_notes is not None:
            update_fields.append("loctician_notes = :loctician_notes")
            update_values["loctician_notes"] = booking_data.loctician_notes

        if booking_data.admin_notes is not None:
            update_fields.append("admin_notes = :admin_notes")
            update_values["admin_notes"] = booking_data.admin_notes

        if update_fields:
            update_fields.append("updated_at = NOW()")

            update_query = text(f"""
                UPDATE bookings
                SET {', '.join(update_fields)}
                WHERE id = :booking_id
            """)

            await db.execute(update_query, update_values)
            await db.commit()

        # Return updated booking
        return await get_booking(booking_id, current_user, db)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Update booking error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update booking"
        )


@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    cancellation_data: BookingCancellation,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a booking."""
    try:
        # Check if booking exists and user has permission
        booking = await get_booking(booking_id, current_user, db)

        if booking.status == BookingStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking is already cancelled"
            )

        if booking.status == BookingStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel completed booking"
            )

        # Update booking
        await db.execute(
            text("""
                UPDATE bookings
                SET status = 'cancelled',
                    cancelled_at = NOW(),
                    cancelled_by = :cancelled_by,
                    cancellation_reason = :reason,
                    cancellation_fee = :fee,
                    updated_at = NOW()
                WHERE id = :booking_id
            """),
            {
                "booking_id": booking_id,
                "cancelled_by": current_user.id,
                "reason": cancellation_data.reason,
                "fee": cancellation_data.cancellation_fee
            }
        )

        # Add state change record
        await db.execute(
            text("""
                INSERT INTO booking_state_changes
                (booking_id, previous_status, new_status, reason, changed_by, changed_at)
                VALUES (:booking_id, :previous_status, 'cancelled', :reason, :changed_by, NOW())
            """),
            {
                "booking_id": booking_id,
                "previous_status": booking.status.value,
                "reason": cancellation_data.reason,
                "changed_by": current_user.id
            }
        )

        await db.commit()

        logger.info(
            "Booking cancelled",
            booking_id=booking_id,
            cancelled_by=current_user.id,
            reason=cancellation_data.reason
        )

        return {"message": "Booking cancelled successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Cancel booking error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel booking"
        )


@router.post("/check-availability", response_model=List[AvailabilitySlot])
async def check_availability(
    availability_data: AvailabilityCheck,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> List[AvailabilitySlot]:
    """
    Check availability for a loctician on a specific date.

    Uses PostgreSQL get_available_slots function for accurate results.
    """
    try:
        query = text(
            "SELECT * FROM get_available_slots(:loctician_id, :date, :service_duration, :slot_interval)"
        )

        result = await db.execute(
            query,
            {
                "loctician_id": availability_data.loctician_id,
                "date": availability_data.date,
                "service_duration": availability_data.service_duration,
                "slot_interval": availability_data.slot_interval
            }
        )

        slots = []
        for row in result.fetchall():
            slots.append(AvailabilitySlot(
                slot_start=row.slot_start,
                slot_end=row.slot_end,
                is_available=row.is_available
            ))

        return slots

    except Exception as e:
        logger.error("Check availability error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check availability"
        )


@router.get("/search/", response_model=List[BookingSearch])
async def search_bookings(
    q: str = Query(..., min_length=1, description="Search query"),
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    status_filter: Optional[BookingStatus] = Query(None, description="Filter by status"),
    limit: int = Query(default=50, le=100, description="Limit results"),
    current_user: User = Depends(get_current_loctician),  # Only locticians can search
    db: AsyncSession = Depends(get_db),
) -> List[BookingSearch]:
    """
    Search bookings using PostgreSQL full-text search.

    Only available to locticians and admins.
    """
    try:
        query = text(
            "SELECT * FROM search_bookings(:search_query, :date_from, :date_to, :status_filter, :limit_results)"
        )

        result = await db.execute(
            query,
            {
                "search_query": q,
                "date_from": date_from,
                "date_to": date_to,
                "status_filter": status_filter.value if status_filter else None,
                "limit_results": limit
            }
        )

        search_results = []
        for row in result.fetchall():
            search_results.append(BookingSearch(
                booking_id=row.booking_id,
                booking_number=row.booking_number,
                customer_name=row.customer_name,
                loctician_name=row.loctician_name,
                service_name=row.service_name,
                appointment_date=row.appointment_date,
                status=BookingStatus(row.status),
                total_amount=row.total_amount,
                search_rank=row.search_rank
            ))

        return search_results

    except Exception as e:
        logger.error("Search bookings error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search failed"
        )