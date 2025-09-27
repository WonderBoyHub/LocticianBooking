"""
Booking Service Layer
Handles booking operations for both guest and authenticated users.
"""
import logging
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4

import structlog
from sqlalchemy import text, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.schemas.booking_extended import (
    BookingCreateRequest,
    GuestBookingCreate,
    UserBookingCreate,
    BookingResponse,
    BookingSummary,
    BookingContactInfo,
    AvailabilityRequest,
    AvailabilityResponse,
    AvailabilitySlot,
    ConflictCheckRequest,
    ConflictCheckResponse,
    BookingUpdate,
    BookingStatusUpdate,
    ServiceInfo
)
from app.schemas.subscription import CurrentSubscriptionInfo

logger = structlog.get_logger(__name__)


class BookingConflictError(Exception):
    """Raised when booking conflicts with existing appointments."""
    pass


class BookingPermissionError(Exception):
    """Raised when user doesn't have permission to book."""
    pass


class SubscriptionRequiredError(Exception):
    """Raised when service requires subscription but user doesn't have one."""
    pass


class BookingService:
    """Service layer for booking operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_guest_booking(
        self,
        booking_data: GuestBookingCreate
    ) -> BookingResponse:
        """Create a booking for a guest user (no authentication required)."""
        try:
            logger.info(
                "Creating guest booking",
                service_id=booking_data.service_id,
                guest_email=booking_data.guest_info.email,
                booking_date=booking_data.booking_date.isoformat(),
                booking_time=booking_data.booking_time.isoformat()
            )

            # Check if service exists and is active
            service = await self._get_service(booking_data.service_id)
            if not service:
                raise ValueError("Service not found or not active")

            # Services requiring subscription cannot be booked by guests
            if service.requires_subscription:
                raise SubscriptionRequiredError(
                    "This service requires a subscription. Please create an account and subscribe first."
                )

            # Check for conflicts
            conflict_check = ConflictCheckRequest(
                service_id=booking_data.service_id,
                booking_date=booking_data.booking_date,
                booking_time=booking_data.booking_time,
                duration_minutes=booking_data.duration_minutes
            )

            if await self.check_booking_conflict(conflict_check):
                raise BookingConflictError("Time slot is already booked")

            # Calculate pricing
            total_price = await self._calculate_guest_price(service, booking_data)

            # Create booking using database function
            booking_id = await self._create_booking_in_db(
                user_id=None,
                guest_email=booking_data.guest_info.email,
                guest_first_name=booking_data.guest_info.first_name,
                guest_last_name=booking_data.guest_info.last_name,
                guest_phone=booking_data.guest_info.phone,
                service_id=booking_data.service_id,
                booking_date=booking_data.booking_date,
                booking_time=booking_data.booking_time,
                duration_minutes=booking_data.duration_minutes,
                total_price=total_price,
                notes=booking_data.notes
            )

            # Retrieve and return the created booking
            booking = await self.get_booking_by_id(booking_id)

            logger.info(
                "Guest booking created successfully",
                booking_id=str(booking_id),
                guest_email=booking_data.guest_info.email
            )

            return booking

        except Exception as e:
            logger.error(
                "Failed to create guest booking",
                error=str(e),
                guest_email=booking_data.guest_info.email
            )
            raise

    async def create_user_booking(
        self,
        booking_data: UserBookingCreate,
        user_id: UUID
    ) -> BookingResponse:
        """Create a booking for an authenticated user."""
        try:
            logger.info(
                "Creating user booking",
                user_id=str(user_id),
                service_id=booking_data.service_id,
                booking_date=booking_data.booking_date.isoformat(),
                booking_time=booking_data.booking_time.isoformat()
            )

            # Get user information
            user = await self._get_user_info(user_id)
            if not user:
                raise ValueError("User not found")

            # Check if service exists and is active
            service = await self._get_service(booking_data.service_id)
            if not service:
                raise ValueError("Service not found or not active")

            # Check subscription requirements
            subscription_info = await self._get_user_subscription_info(user_id)

            if service.requires_subscription and not subscription_info.has_active_subscription:
                raise SubscriptionRequiredError(
                    "This service requires an active subscription"
                )

            # Check booking limits for subscribed users
            if subscription_info.has_active_subscription:
                if not await self._check_subscription_booking_limits(subscription_info):
                    raise BookingPermissionError(
                        "You have reached your monthly booking limit for your current subscription"
                    )

            # Check for conflicts
            conflict_check = ConflictCheckRequest(
                service_id=booking_data.service_id,
                booking_date=booking_data.booking_date,
                booking_time=booking_data.booking_time,
                duration_minutes=booking_data.duration_minutes
            )

            if await self.check_booking_conflict(conflict_check):
                raise BookingConflictError("Time slot is already booked")

            # Calculate pricing (potentially with subscription discounts)
            total_price = await self._calculate_user_price(service, subscription_info)

            # Create booking using database function
            booking_id = await self._create_booking_in_db(
                user_id=user_id,
                guest_email=None,
                guest_first_name=None,
                guest_last_name=None,
                guest_phone=None,
                service_id=booking_data.service_id,
                booking_date=booking_data.booking_date,
                booking_time=booking_data.booking_time,
                duration_minutes=booking_data.duration_minutes,
                total_price=total_price,
                notes=booking_data.notes
            )

            # Increment subscription usage if applicable
            if subscription_info.has_active_subscription:
                await self._increment_subscription_usage(user_id)

            # Retrieve and return the created booking
            booking = await self.get_booking_by_id(booking_id)

            logger.info(
                "User booking created successfully",
                booking_id=str(booking_id),
                user_id=str(user_id)
            )

            return booking

        except Exception as e:
            logger.error(
                "Failed to create user booking",
                error=str(e),
                user_id=str(user_id)
            )
            raise

    async def get_booking_by_id(self, booking_id: UUID) -> Optional[BookingResponse]:
        """Get booking by ID with full details."""
        try:
            query = """
            SELECT
                b.*,
                s.name as service_name,
                s.description as service_description,
                s.duration_minutes as service_duration,
                s.price as service_price,
                s.requires_subscription,
                bs.name as status_name,
                bs.description as status_description
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            JOIN booking_statuses bs ON b.status_id = bs.id
            WHERE b.id = :booking_id
            """

            result = await self.db.execute(text(query), {"booking_id": booking_id})
            row = result.fetchone()

            if not row:
                return None

            return BookingResponse(
                id=row.id,
                user_id=row.user_id,
                guest_email=row.guest_email,
                guest_first_name=row.guest_first_name,
                guest_last_name=row.guest_last_name,
                guest_phone=row.guest_phone,
                service_id=row.service_id,
                booking_date=row.booking_date,
                booking_time=row.booking_time,
                duration_minutes=row.duration_minutes,
                status_id=row.status_id,
                total_price=row.total_price,
                notes=row.notes,
                internal_notes=row.internal_notes,
                created_at=row.created_at,
                updated_at=row.updated_at,
                service=ServiceInfo(
                    id=row.service_id,
                    name=row.service_name,
                    description=row.service_description,
                    duration_minutes=row.service_duration,
                    price=row.service_price,
                    requires_subscription=row.requires_subscription
                ),
                status={
                    "id": row.status_id,
                    "name": row.status_name,
                    "description": row.status_description
                }
            )

        except Exception as e:
            logger.error("Failed to get booking by ID", booking_id=str(booking_id), error=str(e))
            raise

    async def get_user_bookings(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
        include_past: bool = False
    ) -> List[BookingSummary]:
        """Get bookings for a specific user."""
        try:
            date_filter = "" if include_past else "AND b.booking_date >= CURRENT_DATE"

            query = f"""
            SELECT
                b.id,
                b.booking_date,
                b.booking_time,
                b.duration_minutes,
                b.total_price,
                s.name as service_name,
                COALESCE(u.first_name || ' ' || u.last_name,
                         b.guest_first_name || ' ' || b.guest_last_name) as customer_name,
                COALESCE(u.email, b.guest_email) as customer_email,
                bs.name as status_name,
                (b.user_id IS NULL) as is_guest_booking
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            JOIN booking_statuses bs ON b.status_id = bs.id
            LEFT JOIN users u ON b.user_id = u.id
            WHERE b.user_id = :user_id
            {date_filter}
            ORDER BY b.booking_date DESC, b.booking_time DESC
            LIMIT :limit OFFSET :offset
            """

            result = await self.db.execute(
                text(query),
                {"user_id": user_id, "limit": limit, "offset": offset}
            )

            bookings = []
            for row in result.fetchall():
                bookings.append(BookingSummary(
                    id=row.id,
                    booking_date=row.booking_date,
                    booking_time=row.booking_time,
                    duration_minutes=row.duration_minutes,
                    total_price=row.total_price,
                    service_name=row.service_name,
                    customer_name=row.customer_name,
                    customer_email=row.customer_email,
                    status_name=row.status_name,
                    is_guest_booking=row.is_guest_booking
                ))

            return bookings

        except Exception as e:
            logger.error("Failed to get user bookings", user_id=str(user_id), error=str(e))
            raise

    async def check_booking_conflict(self, conflict_check: ConflictCheckRequest) -> bool:
        """Check if the requested booking time conflicts with existing bookings."""
        try:
            result = await self.db.execute(
                text("SELECT check_booking_conflict(:service_id, :booking_date, :booking_time, :duration_minutes, :exclude_booking_id)"),
                {
                    "service_id": conflict_check.service_id,
                    "booking_date": conflict_check.booking_date,
                    "booking_time": conflict_check.booking_time,
                    "duration_minutes": conflict_check.duration_minutes,
                    "exclude_booking_id": conflict_check.exclude_booking_id
                }
            )

            has_conflict = result.scalar()
            return bool(has_conflict)

        except Exception as e:
            logger.error("Failed to check booking conflict", error=str(e))
            raise

    async def get_availability(self, availability_request: AvailabilityRequest) -> AvailabilityResponse:
        """Get available time slots for a service."""
        try:
            service = await self._get_service(availability_request.service_id)
            if not service:
                raise ValueError("Service not found")

            # Generate available slots (this is a simplified implementation)
            # In a real system, this would consider business hours, holidays, existing bookings, etc.

            available_slots = []
            current_date = availability_request.start_date
            end_date = availability_request.end_date or current_date

            while current_date <= end_date:
                # Generate slots for business hours (9 AM to 5 PM as example)
                current_time = time(9, 0)
                end_time = time(17, 0)

                while current_time < end_time:
                    slot_datetime = datetime.combine(current_date, current_time)

                    # Check if this slot is available
                    conflict_check = ConflictCheckRequest(
                        service_id=availability_request.service_id,
                        booking_date=current_date,
                        booking_time=current_time,
                        duration_minutes=service.duration_minutes
                    )

                    is_available = not await self.check_booking_conflict(conflict_check)

                    if is_available:
                        available_slots.append(AvailabilitySlot(
                            date=current_date,
                            start_time=current_time,
                            end_time=(slot_datetime + timedelta(minutes=service.duration_minutes)).time(),
                            duration_minutes=service.duration_minutes,
                            is_available=True
                        ))

                    # Move to next slot (30-minute intervals)
                    slot_datetime += timedelta(minutes=30)
                    current_time = slot_datetime.time()

                current_date += timedelta(days=1)

            return AvailabilityResponse(
                service_id=availability_request.service_id,
                service_name=service.name,
                requested_date_range={
                    "start_date": availability_request.start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                available_slots=available_slots,
                total_slots=len(available_slots)
            )

        except Exception as e:
            logger.error("Failed to get availability", error=str(e))
            raise

    async def update_booking(
        self,
        booking_id: UUID,
        booking_update: BookingUpdate,
        user_id: Optional[UUID] = None
    ) -> BookingResponse:
        """Update a booking."""
        try:
            # First, get the existing booking to verify permissions
            booking = await self.get_booking_by_id(booking_id)
            if not booking:
                raise ValueError("Booking not found")

            # Permission check: only the booking owner or staff can update
            if user_id and booking.user_id != user_id:
                raise BookingPermissionError("You can only update your own bookings")

            # Build update query dynamically
            update_fields = []
            params = {"booking_id": booking_id}

            if booking_update.booking_date:
                update_fields.append("booking_date = :booking_date")
                params["booking_date"] = booking_update.booking_date

            if booking_update.booking_time:
                update_fields.append("booking_time = :booking_time")
                params["booking_time"] = booking_update.booking_time

            if booking_update.notes is not None:
                update_fields.append("notes = :notes")
                params["notes"] = booking_update.notes

            if booking_update.internal_notes is not None:
                update_fields.append("internal_notes = :internal_notes")
                params["internal_notes"] = booking_update.internal_notes

            if not update_fields:
                return booking  # Nothing to update

            update_fields.append("updated_at = CURRENT_TIMESTAMP")

            query = f"""
            UPDATE bookings
            SET {', '.join(update_fields)}
            WHERE id = :booking_id
            """

            await self.db.execute(text(query), params)
            await self.db.commit()

            # Return updated booking
            return await self.get_booking_by_id(booking_id)

        except Exception as e:
            await self.db.rollback()
            logger.error("Failed to update booking", booking_id=str(booking_id), error=str(e))
            raise

    async def cancel_booking(self, booking_id: UUID, reason: str, user_id: Optional[UUID] = None) -> bool:
        """Cancel a booking."""
        try:
            # Get booking to verify permissions
            booking = await self.get_booking_by_id(booking_id)
            if not booking:
                raise ValueError("Booking not found")

            # Permission check
            if user_id and booking.user_id != user_id:
                raise BookingPermissionError("You can only cancel your own bookings")

            # Update booking status to cancelled
            query = """
            UPDATE bookings
            SET status_id = (SELECT id FROM booking_statuses WHERE name = 'cancelled'),
                internal_notes = COALESCE(internal_notes || '\n', '') || 'Cancelled: ' || :reason,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :booking_id
            """

            await self.db.execute(text(query), {"booking_id": booking_id, "reason": reason})
            await self.db.commit()

            logger.info("Booking cancelled", booking_id=str(booking_id), reason=reason)
            return True

        except Exception as e:
            await self.db.rollback()
            logger.error("Failed to cancel booking", booking_id=str(booking_id), error=str(e))
            raise

    # Private helper methods

    async def _get_service(self, service_id: int) -> Optional[ServiceInfo]:
        """Get service information."""
        query = """
        SELECT id, name, description, duration_minutes, price, requires_subscription
        FROM services
        WHERE id = :service_id AND is_active = true
        """

        result = await self.db.execute(text(query), {"service_id": service_id})
        row = result.fetchone()

        if not row:
            return None

        return ServiceInfo(
            id=row.id,
            name=row.name,
            description=row.description,
            duration_minutes=row.duration_minutes,
            price=row.price,
            requires_subscription=row.requires_subscription
        )

    async def _get_user_info(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Get user information."""
        query = "SELECT id, email, first_name, last_name, phone FROM users WHERE id = :user_id"
        result = await self.db.execute(text(query), {"user_id": user_id})
        row = result.fetchone()

        if not row:
            return None

        return {
            "id": row.id,
            "email": row.email,
            "first_name": row.first_name,
            "last_name": row.last_name,
            "phone": row.phone
        }

    async def _get_user_subscription_info(self, user_id: UUID) -> CurrentSubscriptionInfo:
        """Get user's current subscription information."""
        result = await self.db.execute(
            text("SELECT * FROM get_user_current_subscription(:user_id)"),
            {"user_id": user_id}
        )
        row = result.fetchone()

        if not row or not row.subscription_id:
            return CurrentSubscriptionInfo(has_active_subscription=False)

        return CurrentSubscriptionInfo(
            subscription_id=row.subscription_id,
            plan_name=row.plan_name,
            status_name=row.status_name,
            current_period_end=row.current_period_end,
            bookings_used=row.bookings_used,
            max_bookings=row.max_bookings,
            has_active_subscription=True
        )

    async def _check_subscription_booking_limits(self, subscription_info: CurrentSubscriptionInfo) -> bool:
        """Check if user can book more appointments under their subscription."""
        if not subscription_info.max_bookings:
            return True  # No limits

        return (subscription_info.bookings_used or 0) < subscription_info.max_bookings

    async def _calculate_guest_price(self, service: ServiceInfo, booking_data: GuestBookingCreate) -> Decimal:
        """Calculate price for guest booking (no discounts)."""
        return service.price

    async def _calculate_user_price(self, service: ServiceInfo, subscription_info: CurrentSubscriptionInfo) -> Decimal:
        """Calculate price for user booking (potentially with subscription discounts)."""
        base_price = service.price

        # Apply subscription discounts if applicable
        if subscription_info.has_active_subscription:
            # This could be more complex based on subscription plan features
            # For now, assume 10% discount for subscribers
            return base_price * Decimal('0.9')

        return base_price

    async def _create_booking_in_db(
        self,
        user_id: Optional[UUID],
        guest_email: Optional[str],
        guest_first_name: Optional[str],
        guest_last_name: Optional[str],
        guest_phone: Optional[str],
        service_id: int,
        booking_date: date,
        booking_time: time,
        duration_minutes: int,
        total_price: Decimal,
        notes: Optional[str]
    ) -> UUID:
        """Create booking record in database."""

        booking_id = uuid4()

        # Get default status (assuming 'pending' is the default)
        status_result = await self.db.execute(
            text("SELECT id FROM booking_statuses WHERE name = 'pending' LIMIT 1")
        )
        status_id = status_result.scalar()

        if not status_id:
            raise ValueError("Default booking status 'pending' not found")

        query = """
        INSERT INTO bookings (
            id, user_id, guest_email, guest_first_name, guest_last_name, guest_phone,
            service_id, booking_date, booking_time, duration_minutes, status_id,
            total_price, notes, created_at, updated_at
        ) VALUES (
            :id, :user_id, :guest_email, :guest_first_name, :guest_last_name, :guest_phone,
            :service_id, :booking_date, :booking_time, :duration_minutes, :status_id,
            :total_price, :notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        """

        await self.db.execute(text(query), {
            "id": booking_id,
            "user_id": user_id,
            "guest_email": guest_email,
            "guest_first_name": guest_first_name,
            "guest_last_name": guest_last_name,
            "guest_phone": guest_phone,
            "service_id": service_id,
            "booking_date": booking_date,
            "booking_time": booking_time,
            "duration_minutes": duration_minutes,
            "status_id": status_id,
            "total_price": total_price,
            "notes": notes
        })

        await self.db.commit()
        return booking_id

    async def _increment_subscription_usage(self, user_id: UUID) -> bool:
        """Increment booking usage for user's active subscription."""
        result = await self.db.execute(
            text("SELECT increment_subscription_usage(:user_id)"),
            {"user_id": user_id}
        )
        success = result.scalar()
        await self.db.commit()
        return bool(success)


# Factory function for dependency injection
async def get_booking_service(db: AsyncSession = get_db()) -> BookingService:
    """Factory function to get BookingService instance."""
    return BookingService(db)