"""
Real-time WebSocket features for live calendar updates.
"""
import json
from datetime import datetime
from typing import Dict, List, Optional, Set
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import auth_service
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.user import User

logger = structlog.get_logger(__name__)

router = APIRouter()
security = HTTPBearer(auto_error=False)


class WebSocketManager:
    """WebSocket connection manager for real-time calendar updates."""

    def __init__(self):
        # Active connections grouped by user and calendar
        self.connections: Dict[str, Dict[str, WebSocket]] = {}
        # User to connection mapping
        self.user_connections: Dict[str, Set[str]] = {}
        # Calendar subscriptions (user_id -> set of loctician_ids)
        self.calendar_subscriptions: Dict[str, Set[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, connection_id: str = None):
        """Accept and store new WebSocket connection."""
        await websocket.accept()

        if connection_id is None:
            connection_id = str(uuid4())

        # Initialize user connections if not exists
        if user_id not in self.connections:
            self.connections[user_id] = {}
            self.user_connections[user_id] = set()
            self.calendar_subscriptions[user_id] = set()

        # Store connection
        self.connections[user_id][connection_id] = websocket
        self.user_connections[user_id].add(connection_id)

        logger.info(
            "WebSocket connected",
            user_id=user_id,
            connection_id=connection_id,
            total_connections=len(self.user_connections.get(user_id, []))
        )

        return connection_id

    async def disconnect(self, user_id: str, connection_id: str):
        """Remove WebSocket connection."""
        if user_id in self.connections and connection_id in self.connections[user_id]:
            del self.connections[user_id][connection_id]
            self.user_connections[user_id].discard(connection_id)

            # Clean up empty user entries
            if not self.connections[user_id]:
                del self.connections[user_id]
                if user_id in self.user_connections:
                    del self.user_connections[user_id]
                if user_id in self.calendar_subscriptions:
                    del self.calendar_subscriptions[user_id]

        logger.info(
            "WebSocket disconnected",
            user_id=user_id,
            connection_id=connection_id
        )

    async def subscribe_to_calendar(self, user_id: str, loctician_id: str):
        """Subscribe user to loctician's calendar updates."""
        if user_id not in self.calendar_subscriptions:
            self.calendar_subscriptions[user_id] = set()

        self.calendar_subscriptions[user_id].add(loctician_id)

        logger.info(
            "Calendar subscription added",
            user_id=user_id,
            loctician_id=loctician_id
        )

    async def unsubscribe_from_calendar(self, user_id: str, loctician_id: str):
        """Unsubscribe user from loctician's calendar updates."""
        if user_id in self.calendar_subscriptions:
            self.calendar_subscriptions[user_id].discard(loctician_id)

        logger.info(
            "Calendar subscription removed",
            user_id=user_id,
            loctician_id=loctician_id
        )

    async def send_personal_message(self, user_id: str, message: dict):
        """Send message to specific user's connections."""
        if user_id in self.connections:
            for connection_id, websocket in self.connections[user_id].items():
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(
                        "Failed to send message to user",
                        user_id=user_id,
                        connection_id=connection_id,
                        error=str(e)
                    )
                    # Remove failed connection
                    await self.disconnect(user_id, connection_id)

    async def broadcast_calendar_update(self, loctician_id: str, message: dict):
        """Broadcast calendar update to all subscribed users."""
        message["timestamp"] = datetime.utcnow().isoformat()
        message["loctician_id"] = loctician_id

        # Find all users subscribed to this loctician's calendar
        subscribed_users = [
            user_id for user_id, calendars in self.calendar_subscriptions.items()
            if loctician_id in calendars
        ]

        # Also send to the loctician themselves
        if loctician_id not in subscribed_users:
            subscribed_users.append(loctician_id)

        # Send to all subscribed users
        for user_id in subscribed_users:
            await self.send_personal_message(user_id, message)

        logger.info(
            "Calendar update broadcasted",
            loctician_id=loctician_id,
            message_type=message.get("type"),
            subscribers_count=len(subscribed_users)
        )

    async def broadcast_booking_update(self, booking_data: dict):
        """Broadcast booking update to relevant users."""
        message = {
            "type": "booking_update",
            "data": booking_data,
            "timestamp": datetime.utcnow().isoformat()
        }

        # Send to customer and loctician
        customer_id = booking_data.get("customer_id")
        loctician_id = booking_data.get("loctician_id")

        if customer_id:
            await self.send_personal_message(customer_id, message)
        if loctician_id and loctician_id != customer_id:
            await self.send_personal_message(loctician_id, message)

        logger.info(
            "Booking update broadcasted",
            booking_id=booking_data.get("id"),
            customer_id=customer_id,
            loctician_id=loctician_id
        )

    def get_connection_stats(self) -> dict:
        """Get WebSocket connection statistics."""
        total_connections = sum(len(conns) for conns in self.connections.values())
        return {
            "total_users": len(self.connections),
            "total_connections": total_connections,
            "calendar_subscriptions": sum(len(subs) for subs in self.calendar_subscriptions.values())
        }


# Global WebSocket manager instance
websocket_manager = WebSocketManager()


async def get_user_from_token(token: str, db: AsyncSession) -> Optional[User]:
    """Extract user from WebSocket token."""
    try:
        if not token:
            return None

        # Remove Bearer prefix if present
        if token.startswith("Bearer "):
            token = token[7:]

        # Verify token
        payload = auth_service.verify_token(token)
        user_id = payload.get("sub")

        if not user_id:
            return None

        # Get user from database
        user_query = await db.execute(
            select(User).where(User.id == user_id)
        )
        return user_query.scalar()

    except Exception as e:
        logger.error("WebSocket token verification failed", error=str(e))
        return None


@router.websocket("/calendar/{loctician_id}")
async def websocket_calendar_endpoint(
    websocket: WebSocket,
    loctician_id: str,
    token: str = None,
    db: AsyncSession = Depends(get_db),
):
    """WebSocket endpoint for real-time calendar updates."""
    connection_id = None
    user_id = None

    try:
        # Authenticate user from token
        user = await get_user_from_token(token, db)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication required")
            return

        user_id = user.id

        # Verify loctician exists
        loctician_query = await db.execute(
            select(User).where(User.id == loctician_id)
        )
        loctician = loctician_query.scalar()

        if not loctician or loctician.role != UserRole.LOCTICIAN:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid loctician")
            return

        # Check permissions
        if user.role == UserRole.CUSTOMER:
            # Customers can only view public calendar events
            pass
        elif user.role == UserRole.LOCTICIAN:
            # Locticians can view their own calendar and others' public events
            pass
        elif user.role in [UserRole.STAFF, UserRole.ADMIN]:
            # Staff and admin can view all calendars
            pass
        else:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Access denied")
            return

        # Connect and subscribe to calendar
        connection_id = await websocket_manager.connect(websocket, user_id)
        await websocket_manager.subscribe_to_calendar(user_id, loctician_id)

        # Send initial calendar data
        await _send_initial_calendar_data(websocket, loctician_id, user, db)

        # Handle incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                await _handle_websocket_message(message, user, loctician_id, websocket, db)

            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected normally", user_id=user_id, loctician_id=loctician_id)
    except Exception as e:
        logger.error("WebSocket error", error=str(e), user_id=user_id, loctician_id=loctician_id)
    finally:
        if user_id and connection_id:
            await websocket_manager.disconnect(user_id, connection_id)


async def _send_initial_calendar_data(websocket: WebSocket, loctician_id: str, user: User, db: AsyncSession):
    """Send initial calendar data to connected client."""
    try:
        # Get upcoming bookings
        bookings_query = await db.execute(
            text("""
                SELECT
                    b.id,
                    b.booking_number,
                    b.appointment_start,
                    b.appointment_end,
                    b.status,
                    s.name as service_name,
                    CASE
                        WHEN :user_role IN ('staff', 'admin') OR :user_id = b.loctician_id
                        THEN CONCAT(c.first_name, ' ', c.last_name)
                        ELSE 'Customer'
                    END as customer_name
                FROM bookings b
                JOIN services s ON b.service_id = s.id
                JOIN users c ON b.customer_id = c.id
                WHERE b.loctician_id = :loctician_id::uuid
                AND b.appointment_start >= NOW()
                AND b.status IN ('confirmed', 'in_progress')
                ORDER BY b.appointment_start
                LIMIT 50
            """),
            {
                "loctician_id": loctician_id,
                "user_role": user.role.value,
                "user_id": user.id
            }
        )

        bookings = []
        for row in bookings_query.fetchall():
            bookings.append({
                "id": row.id,
                "booking_number": row.booking_number,
                "start": row.appointment_start.isoformat(),
                "end": row.appointment_end.isoformat(),
                "status": row.status,
                "service_name": row.service_name,
                "customer_name": row.customer_name
            })

        # Get calendar events (visible based on role)
        events_visibility = "true" if user.role in [UserRole.STAFF, UserRole.ADMIN] or user.id == loctician_id else "is_public = true"

        events_query = await db.execute(
            text(f"""
                SELECT
                    id,
                    title,
                    event_type,
                    LOWER(time_range) as start_time,
                    UPPER(time_range) as end_time,
                    is_public
                FROM calendar_events
                WHERE loctician_id = :loctician_id::uuid
                AND LOWER(time_range) >= NOW()
                AND ({events_visibility})
                ORDER BY LOWER(time_range)
                LIMIT 20
            """),
            {"loctician_id": loctician_id}
        )

        events = []
        for row in events_query.fetchall():
            events.append({
                "id": row.id,
                "title": row.title,
                "type": row.event_type,
                "start": row.start_time.isoformat(),
                "end": row.end_time.isoformat(),
                "is_public": row.is_public
            })

        # Send initial data
        await websocket.send_text(json.dumps({
            "type": "initial_data",
            "data": {
                "bookings": bookings,
                "events": events,
                "loctician_id": loctician_id
            }
        }))

    except Exception as e:
        logger.error("Failed to send initial calendar data", error=str(e))
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Failed to load calendar data"
        }))


async def _handle_websocket_message(message: dict, user: User, loctician_id: str, websocket: WebSocket, db: AsyncSession):
    """Handle incoming WebSocket messages."""
    message_type = message.get("type")

    if message_type == "ping":
        await websocket.send_text(json.dumps({"type": "pong"}))

    elif message_type == "subscribe_availability":
        # Subscribe to availability updates for specific date range
        date_range = message.get("date_range", {})
        await websocket.send_text(json.dumps({
            "type": "availability_subscription",
            "status": "subscribed",
            "date_range": date_range
        }))

    elif message_type == "get_availability":
        # Get real-time availability for specific date
        date = message.get("date")
        if date:
            await _send_availability_data(websocket, loctician_id, date, db)

    elif message_type == "booking_intent":
        # Handle booking intent (pre-booking check)
        if user.role == UserRole.CUSTOMER:
            booking_data = message.get("data", {})
            await _handle_booking_intent(websocket, user.id, loctician_id, booking_data, db)

    else:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        }))


async def _send_availability_data(websocket: WebSocket, loctician_id: str, date: str, db: AsyncSession):
    """Send real-time availability data for specific date."""
    try:
        availability_query = await db.execute(
            text("""
                SELECT * FROM get_loctician_availability(
                    :loctician_id::uuid,
                    :check_date::date,
                    60, -- Default 60 minute slots
                    15, -- 15 minute buffer
                    30  -- 30 minute intervals
                )
            """),
            {"loctician_id": loctician_id, "check_date": date}
        )

        availability_data = availability_query.fetchone()

        if availability_data:
            await websocket.send_text(json.dumps({
                "type": "availability_data",
                "date": date,
                "data": {
                    "is_working_day": availability_data.is_working_day,
                    "available_slots": availability_data.available_slots or [],
                    "total_available_minutes": availability_data.total_available_minutes or 0
                }
            }))
        else:
            await websocket.send_text(json.dumps({
                "type": "availability_data",
                "date": date,
                "data": {
                    "is_working_day": False,
                    "available_slots": [],
                    "total_available_minutes": 0
                }
            }))

    except Exception as e:
        logger.error("Failed to send availability data", error=str(e))
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Failed to get availability data"
        }))


async def _handle_booking_intent(websocket: WebSocket, customer_id: str, loctician_id: str, booking_data: dict, db: AsyncSession):
    """Handle booking intent and check real-time availability."""
    try:
        start_time = booking_data.get("start_time")
        service_id = booking_data.get("service_id")

        if not start_time or not service_id:
            await websocket.send_text(json.dumps({
                "type": "booking_intent_response",
                "status": "error",
                "message": "Missing required fields"
            }))
            return

        # Get service details
        service_query = await db.execute(
            text("SELECT duration_minutes, buffer_before_minutes, buffer_after_minutes FROM services WHERE id = :service_id::uuid"),
            {"service_id": service_id}
        )
        service = service_query.first()

        if not service:
            await websocket.send_text(json.dumps({
                "type": "booking_intent_response",
                "status": "error",
                "message": "Service not found"
            }))
            return

        # Check availability
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
                "loctician_id": loctician_id,
                "start_time": start_time,
                "duration_minutes": service.duration_minutes,
                "buffer_before": service.buffer_before_minutes,
                "buffer_after": service.buffer_after_minutes
            }
        )

        availability_result = availability_check.scalar()

        await websocket.send_text(json.dumps({
            "type": "booking_intent_response",
            "status": "success" if availability_result.get("is_available") else "unavailable",
            "data": availability_result,
            "booking_data": booking_data
        }))

    except Exception as e:
        logger.error("Failed to handle booking intent", error=str(e))
        await websocket.send_text(json.dumps({
            "type": "booking_intent_response",
            "status": "error",
            "message": "Failed to check availability"
        }))


# API endpoints for triggering WebSocket updates
@router.post("/broadcast/booking-update")
async def broadcast_booking_update(
    booking_data: dict,
    current_user: User = Depends(lambda: None),  # This would be called from internal services
):
    """Broadcast booking update to relevant WebSocket connections."""
    await websocket_manager.broadcast_booking_update(booking_data)
    return {"status": "broadcasted"}


@router.post("/broadcast/calendar-update")
async def broadcast_calendar_update(
    loctician_id: str,
    update_data: dict,
    current_user: User = Depends(lambda: None),  # This would be called from internal services
):
    """Broadcast calendar update to subscribed WebSocket connections."""
    message = {
        "type": "calendar_update",
        "data": update_data
    }
    await websocket_manager.broadcast_calendar_update(loctician_id, message)
    return {"status": "broadcasted"}


@router.get("/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics."""
    return websocket_manager.get_connection_stats()