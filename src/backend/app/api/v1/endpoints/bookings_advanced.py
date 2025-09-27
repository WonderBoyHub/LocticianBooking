"""
Advanced Booking API with role-based permissions, guest booking, and subscription benefits.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import (
    get_current_user,
    get_current_admin,
    get_current_staff_or_admin,
    get_optional_user,
    require_admin,
    require_staff,
    rate_limit_check
)
from app.core.database import get_db
from app.models.booking import Booking, BookingProduct, BookingService, BookingStateChange
from app.models.enums import BookingStatus, PaymentStatus, UserRole
from app.models.service import Service
from app.models.user import User
from app.schemas.booking import (
    Booking as BookingSchema,
    BookingCreate,
    BookingUpdate,
    BookingStatusUpdate,
    BookingCancellation,
    BookingSummary,
    BookingSearch,
    AvailabilityCheck,
    AvailabilitySlot,
)

logger = structlog.get_logger(__name__)

router = APIRouter()


# Guest Booking Schema (no authentication required)
class GuestBookingCreate(BookingCreate):
    """Schema for guest booking creation."""
    guest_email: str
    guest_phone: str
    guest_first_name: str
    guest_last_name: str
    marketing_consent: bool = False


class GuestBooking(BookingSchema):
    """Guest booking response schema."""
    guest_email: Optional[str] = None
    confirmation_token: Optional[str] = None


# Customer Booking Endpoints
@router.post("/customer/create", response_model=BookingSchema, status_code=status.HTTP_201_CREATED)
async def create_customer_booking(
    booking_data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> BookingSchema:
    """Create booking for authenticated customer with subscription benefits."""
    try:
        # Verify user is a customer
        if current_user.role != UserRole.CUSTOMER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only customers can create bookings through this endpoint"
            )

        # Validate service exists and is bookable
        service_query = await db.execute(
            select(Service).where(
                and_(Service.id == booking_data.service_id, Service.is_online_bookable == True)
            )
        )
        service = service_query.scalar()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or non-bookable service"
            )

        # Validate loctician exists and is active
        loctician_query = await db.execute(
            select(User).where(
                and_(
                    User.id == booking_data.loctician_id,
                    User.role == UserRole.LOCTICIAN,
                    User.is_active == True
                )
            )
        )
        if not loctician_query.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid loctician"
            )

        # Check availability and prevent double booking using PostgreSQL function
        availability_check = await db.execute(
            text("""
                SELECT check_booking_availability(
                    :loctician_id::uuid,
                    :start_time::timestamptz,
                    :duration_minutes::integer,
                    :buffer_before::integer,
                    :buffer_after::integer
                )
            """),
            {
                "loctician_id": booking_data.loctician_id,
                "start_time": booking_data.appointment_start.isoformat(),
                "duration_minutes": service.duration_minutes,
                "buffer_before": service.buffer_before_minutes,
                "buffer_after": service.buffer_after_minutes
            }
        )

        availability_result = availability_check.scalar()
        if not availability_result.get("is_available", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Time slot not available: {availability_result.get('reason', 'Unknown reason')}"
            )

        # Calculate appointment end time
        appointment_end = booking_data.appointment_start + timedelta(minutes=service.duration_minutes)

        # Check subscription benefits for pricing
        subscription_discount = await _get_subscription_discount(current_user.id, db)
        service_price = service.base_price * (1 - subscription_discount)

        # Generate booking number
        booking_number = await _generate_booking_number(db)

        # Create booking
        booking = Booking(
            booking_number=booking_number,
            customer_id=current_user.id,
            loctician_id=booking_data.loctician_id,
            service_id=booking_data.service_id,
            appointment_start=booking_data.appointment_start,
            appointment_end=appointment_end,
            duration_minutes=service.duration_minutes,
            status=BookingStatus.PENDING,
            payment_status=PaymentStatus.PENDING,
            service_price=service_price,
            additional_charges=Decimal('0'),
            discount_amount=service.base_price * subscription_discount,
            total_amount=service_price,
            customer_notes=booking_data.customer_notes,
            special_requests=booking_data.special_requests,
        )

        db.add(booking)
        await db.commit()
        await db.refresh(booking)

        # Create initial state change
        state_change = BookingStateChange(
            booking_id=booking.id,
            previous_status=None,
            new_status=BookingStatus.PENDING,
            changed_by=current_user.id,
            changed_at=datetime.utcnow(),
            reason="Booking created by customer"
        )
        db.add(state_change)

        # Handle additional services if provided
        if booking_data.additional_services:
            for service_data in booking_data.additional_services:
                booking_service = BookingService(
                    booking_id=booking.id,
                    service_id=service_data.service_id,
                    quantity=service_data.quantity,
                    unit_price=service_data.unit_price,
                    total_price=service_data.unit_price * service_data.quantity,
                    notes=service_data.notes
                )
                db.add(booking_service)
                booking.total_amount += booking_service.total_price

        # Handle additional products if provided
        if booking_data.additional_products:
            for product_data in booking_data.additional_products:
                booking_product = BookingProduct(
                    booking_id=booking.id,
                    product_id=product_data.product_id,
                    quantity=product_data.quantity,
                    unit_price=product_data.unit_price,
                    total_price=product_data.unit_price * product_data.quantity
                )
                db.add(booking_product)
                booking.total_amount += booking_product.total_price

        await db.commit()
        await db.refresh(booking)

        # Send confirmation email (async task)
        await _send_booking_confirmation_email(booking.id, db)

        logger.info(
            "Customer booking created",
            booking_id=booking.id,
            booking_number=booking.booking_number,
            customer_id=current_user.id,
            total_amount=float(booking.total_amount)
        )

        return BookingSchema(**booking.__dict__)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create customer booking error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create booking"
        )


# Guest Booking Endpoints (no authentication required)
@router.post("/guest/create", response_model=GuestBooking, status_code=status.HTTP_201_CREATED)
async def create_guest_booking(
    booking_data: GuestBookingCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> GuestBooking:
    """Create booking for guest user (no authentication required)."""
    try:
        # Create temporary guest user or find existing user by email
        guest_user = await _get_or_create_guest_user(
            email=booking_data.guest_email,
            phone=booking_data.guest_phone,
            first_name=booking_data.guest_first_name,
            last_name=booking_data.guest_last_name,
            marketing_consent=booking_data.marketing_consent,
            db=db
        )

        # Validate service exists and is bookable
        service_query = await db.execute(
            select(Service).where(
                and_(Service.id == booking_data.service_id, Service.is_online_bookable == True)
            )
        )
        service = service_query.scalar()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or non-bookable service"
            )

        # Validate loctician exists and is active
        loctician_query = await db.execute(
            select(User).where(
                and_(
                    User.id == booking_data.loctician_id,
                    User.role == UserRole.LOCTICIAN,
                    User.is_active == True
                )
            )
        )
        if not loctician_query.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid loctician"
            )

        # Check availability for guest booking
        availability_check = await db.execute(
            text("""
                SELECT check_booking_availability(
                    :loctician_id::uuid,
                    :start_time::timestamptz,
                    :duration_minutes::integer,
                    :buffer_before::integer,
                    :buffer_after::integer
                )
            """),
            {
                "loctician_id": booking_data.loctician_id,
                "start_time": booking_data.appointment_start.isoformat(),
                "duration_minutes": service.duration_minutes,
                "buffer_before": service.buffer_before_minutes,
                "buffer_after": service.buffer_after_minutes
            }
        )

        availability_result = availability_check.scalar()
        if not availability_result.get("is_available", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Time slot not available: {availability_result.get('reason', 'Unknown reason')}"
            )

        # Calculate appointment end time
        appointment_end = booking_data.appointment_start + timedelta(minutes=service.duration_minutes)

        # Generate booking number and confirmation token
        booking_number = await _generate_booking_number(db)
        confirmation_token = await _generate_confirmation_token()

        # Create booking with guest pricing (no subscription discounts)
        booking = Booking(
            booking_number=booking_number,
            customer_id=guest_user.id,
            loctician_id=booking_data.loctician_id,
            service_id=booking_data.service_id,
            appointment_start=booking_data.appointment_start,
            appointment_end=appointment_end,
            duration_minutes=service.duration_minutes,
            status=BookingStatus.PENDING,
            payment_status=PaymentStatus.PENDING,
            service_price=service.base_price,
            additional_charges=Decimal('0'),
            discount_amount=Decimal('0'),
            total_amount=service.base_price,
            customer_notes=booking_data.customer_notes,
            special_requests=booking_data.special_requests,
        )

        db.add(booking)
        await db.commit()
        await db.refresh(booking)

        # Create initial state change
        state_change = BookingStateChange(
            booking_id=booking.id,
            previous_status=None,
            new_status=BookingStatus.PENDING,
            changed_by=None,  # No user for guest booking
            changed_at=datetime.utcnow(),
            reason="Guest booking created"
        )
        db.add(state_change)
        await db.commit()

        # Send guest booking confirmation email
        await _send_guest_booking_confirmation_email(booking.id, booking_data.guest_email, confirmation_token, db)

        logger.info(
            "Guest booking created",
            booking_id=booking.id,
            booking_number=booking.booking_number,
            guest_email=booking_data.guest_email,
            total_amount=float(booking.total_amount)
        )

        return GuestBooking(
            **booking.__dict__,
            guest_email=booking_data.guest_email,
            confirmation_token=confirmation_token
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create guest booking error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create guest booking"
        )


# Staff/Admin Booking Management
@router.get("/admin/list", response_model=List[BookingSummary])
async def list_all_bookings_admin(
    status_filter: Optional[BookingStatus] = Query(None, description="Filter by status"),
    loctician_id: Optional[str] = Query(None, description="Filter by loctician"),
    customer_id: Optional[str] = Query(None, description="Filter by customer"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    limit: int = Query(100, le=1000, description="Limit results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> List[BookingSummary]:
    """List all bookings with advanced filtering (staff/admin only)."""
    try:
        # Complex query with joins for summary data
        query = text("""
            SELECT
                b.id,
                b.booking_number,
                b.appointment_start,
                b.appointment_end,
                b.status,
                b.payment_status,
                b.total_amount,
                CONCAT(c.first_name, ' ', c.last_name) as customer_name,
                CONCAT(l.first_name, ' ', l.last_name) as loctician_name,
                s.name as service_name
            FROM bookings b
            JOIN users c ON b.customer_id = c.id
            JOIN users l ON b.loctician_id = l.id
            JOIN services s ON b.service_id = s.id
            WHERE 1=1
                AND (:status_filter IS NULL OR b.status = :status_filter)
                AND (:loctician_id IS NULL OR b.loctician_id = :loctician_id::uuid)
                AND (:customer_id IS NULL OR b.customer_id = :customer_id::uuid)
                AND (:start_date IS NULL OR b.appointment_start >= :start_date::timestamptz)
                AND (:end_date IS NULL OR b.appointment_start <= :end_date::timestamptz)
            ORDER BY b.appointment_start DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await db.execute(query, {
            "status_filter": status_filter.value if status_filter else None,
            "loctician_id": loctician_id,
            "customer_id": customer_id,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "limit": limit,
            "offset": offset
        })

        bookings = []
        for row in result.fetchall():
            bookings.append(BookingSummary(
                id=row.id,
                booking_number=row.booking_number,
                appointment_start=row.appointment_start,
                appointment_end=row.appointment_end,
                status=BookingStatus(row.status),
                payment_status=PaymentStatus(row.payment_status),
                total_amount=row.total_amount,
                customer_name=row.customer_name,
                loctician_name=row.loctician_name,
                service_name=row.service_name
            ))

        return bookings

    except Exception as e:
        logger.error("List all bookings error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list bookings"
        )


@router.put("/admin/{booking_id}/status", response_model=BookingSchema)
async def update_booking_status_admin(
    booking_id: str,
    status_update: BookingStatusUpdate,
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> BookingSchema:
    """Update booking status (staff/admin only)."""
    try:
        # Get existing booking
        booking_query = await db.execute(
            select(Booking).where(Booking.id == booking_id)
        )
        booking = booking_query.scalar()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Validate status transition
        valid_transitions = await _get_valid_status_transitions(booking.status)
        if status_update.status not in valid_transitions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status transition from {booking.status} to {status_update.status}"
            )

        previous_status = booking.status
        booking.status = status_update.status

        # Handle specific status changes
        if status_update.status == BookingStatus.CANCELLED:
            booking.cancelled_at = datetime.utcnow()
            booking.cancelled_by = current_user.id
            booking.cancellation_reason = status_update.reason

        await db.commit()
        await db.refresh(booking)

        # Create state change record
        state_change = BookingStateChange(
            booking_id=booking.id,
            previous_status=previous_status,
            new_status=status_update.status,
            changed_by=current_user.id,
            changed_at=datetime.utcnow(),
            reason=status_update.reason
        )
        db.add(state_change)
        await db.commit()

        # Send status update notification
        await _send_booking_status_notification(booking.id, previous_status, status_update.status, db)

        logger.info(
            "Booking status updated",
            booking_id=booking.id,
            old_status=previous_status,
            new_status=status_update.status,
            updated_by=current_user.id
        )

        return BookingSchema(**booking.__dict__)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Update booking status error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update booking status"
        )


# Customer Booking Management
@router.get("/my-bookings", response_model=List[BookingSummary])
async def list_customer_bookings(
    status_filter: Optional[BookingStatus] = Query(None, description="Filter by status"),
    upcoming_only: bool = Query(False, description="Show only upcoming bookings"),
    limit: int = Query(50, le=100, description="Limit results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[BookingSummary]:
    """List bookings for authenticated customer."""
    try:
        query = text("""
            SELECT
                b.id,
                b.booking_number,
                b.appointment_start,
                b.appointment_end,
                b.status,
                b.payment_status,
                b.total_amount,
                CONCAT(c.first_name, ' ', c.last_name) as customer_name,
                CONCAT(l.first_name, ' ', l.last_name) as loctician_name,
                s.name as service_name
            FROM bookings b
            JOIN users c ON b.customer_id = c.id
            JOIN users l ON b.loctician_id = l.id
            JOIN services s ON b.service_id = s.id
            WHERE b.customer_id = :customer_id::uuid
                AND (:status_filter IS NULL OR b.status = :status_filter)
                AND (:upcoming_only = false OR b.appointment_start > NOW())
            ORDER BY b.appointment_start DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await db.execute(query, {
            "customer_id": current_user.id,
            "status_filter": status_filter.value if status_filter else None,
            "upcoming_only": upcoming_only,
            "limit": limit,
            "offset": offset
        })

        bookings = []
        for row in result.fetchall():
            bookings.append(BookingSummary(
                id=row.id,
                booking_number=row.booking_number,
                appointment_start=row.appointment_start,
                appointment_end=row.appointment_end,
                status=BookingStatus(row.status),
                payment_status=PaymentStatus(row.payment_status),
                total_amount=row.total_amount,
                customer_name=row.customer_name,
                loctician_name=row.loctician_name,
                service_name=row.service_name
            ))

        return bookings

    except Exception as e:
        logger.error("List customer bookings error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list customer bookings"
        )


@router.post("/cancel/{booking_id}", response_model=BookingSchema)
async def cancel_booking(
    booking_id: str,
    cancellation_data: BookingCancellation,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BookingSchema:
    """Cancel booking (customer can cancel their own bookings)."""
    try:
        # Get booking and verify ownership or staff permission
        booking_query = await db.execute(
            select(Booking).where(Booking.id == booking_id)
        )
        booking = booking_query.scalar()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Check permissions
        if (current_user.role == UserRole.CUSTOMER and booking.customer_id != current_user.id and
            current_user.role not in [UserRole.STAFF, UserRole.ADMIN]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this booking"
            )

        # Check if booking can be cancelled
        if not booking.can_be_cancelled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking cannot be cancelled"
            )

        # Apply cancellation policy
        cancellation_fee = await _calculate_cancellation_fee(booking, db)

        # Update booking
        previous_status = booking.status
        booking.status = BookingStatus.CANCELLED
        booking.cancelled_at = datetime.utcnow()
        booking.cancelled_by = current_user.id
        booking.cancellation_reason = cancellation_data.reason
        booking.cancellation_fee = cancellation_fee

        await db.commit()
        await db.refresh(booking)

        # Create state change record
        state_change = BookingStateChange(
            booking_id=booking.id,
            previous_status=previous_status,
            new_status=BookingStatus.CANCELLED,
            changed_by=current_user.id,
            changed_at=datetime.utcnow(),
            reason=f"Cancelled: {cancellation_data.reason}"
        )
        db.add(state_change)
        await db.commit()

        # Send cancellation notification
        await _send_booking_cancellation_notification(booking.id, db)

        logger.info(
            "Booking cancelled",
            booking_id=booking.id,
            cancelled_by=current_user.id,
            cancellation_fee=float(cancellation_fee)
        )

        return BookingSchema(**booking.__dict__)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Cancel booking error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel booking"
        )


# Utility functions
async def _get_subscription_discount(user_id: str, db: AsyncSession) -> Decimal:
    """Get subscription discount for user."""
    # Check if user has active subscription
    subscription_query = await db.execute(
        text("""
            SELECT discount_percentage
            FROM user_subscriptions us
            JOIN subscription_plans sp ON us.plan_id = sp.id
            WHERE us.user_id = :user_id::uuid
            AND us.status = 'active'
            AND us.ends_at > NOW()
        """),
        {"user_id": user_id}
    )

    result = subscription_query.scalar()
    return Decimal(str(result)) / 100 if result else Decimal('0')


async def _generate_booking_number(db: AsyncSession) -> str:
    """Generate unique booking number."""
    # Use database sequence or implement custom logic
    sequence_query = await db.execute(text("SELECT nextval('booking_number_seq')"))
    sequence_number = sequence_query.scalar()
    return f"BK{sequence_number:06d}"


async def _generate_confirmation_token() -> str:
    """Generate confirmation token for guest bookings."""
    import secrets
    return secrets.token_urlsafe(32)


async def _get_or_create_guest_user(
    email: str, phone: str, first_name: str, last_name: str,
    marketing_consent: bool, db: AsyncSession
) -> User:
    """Get existing user by email or create guest user."""
    # Check if user exists
    existing_user = await db.execute(
        select(User).where(User.email == email)
    )
    user = existing_user.scalar()

    if user:
        return user

    # Create new guest user
    import bcrypt
    from uuid import uuid4

    guest_user = User(
        id=str(uuid4()),
        email=email,
        phone=phone,
        first_name=first_name,
        last_name=last_name,
        password_hash=bcrypt.hashpw(b"guest_password", bcrypt.gensalt()).decode(),
        role=UserRole.CUSTOMER,
        marketing_consent=marketing_consent,
        email_verified=False
    )

    db.add(guest_user)
    await db.commit()
    await db.refresh(guest_user)

    return guest_user


async def _get_valid_status_transitions(current_status: BookingStatus) -> List[BookingStatus]:
    """Get valid status transitions for current status."""
    transitions = {
        BookingStatus.PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
        BookingStatus.CONFIRMED: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        BookingStatus.IN_PROGRESS: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
        BookingStatus.COMPLETED: [],  # Final status
        BookingStatus.CANCELLED: [],  # Final status
        BookingStatus.NO_SHOW: [],   # Final status
    }
    return transitions.get(current_status, [])


async def _calculate_cancellation_fee(booking: Booking, db: AsyncSession) -> Decimal:
    """Calculate cancellation fee based on policy."""
    hours_until_appointment = (booking.appointment_start - datetime.utcnow()).total_seconds() / 3600

    # Simple cancellation policy
    if hours_until_appointment < 24:
        return booking.total_amount * Decimal('0.5')  # 50% fee
    elif hours_until_appointment < 48:
        return booking.total_amount * Decimal('0.25')  # 25% fee
    else:
        return Decimal('0')  # No fee


async def _send_booking_confirmation_email(booking_id: str, db: AsyncSession):
    """Send booking confirmation email (placeholder for email service)."""
    # This would integrate with your email service
    logger.info("Booking confirmation email queued", booking_id=booking_id)


async def _send_guest_booking_confirmation_email(booking_id: str, email: str, token: str, db: AsyncSession):
    """Send guest booking confirmation email with token."""
    logger.info("Guest booking confirmation email queued", booking_id=booking_id, email=email)


async def _send_booking_status_notification(booking_id: str, old_status: BookingStatus, new_status: BookingStatus, db: AsyncSession):
    """Send booking status change notification."""
    logger.info("Booking status notification queued", booking_id=booking_id, old_status=old_status, new_status=new_status)


async def _send_booking_cancellation_notification(booking_id: str, db: AsyncSession):
    """Send booking cancellation notification."""
    logger.info("Booking cancellation notification queued", booking_id=booking_id)