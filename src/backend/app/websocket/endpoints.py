"""
WebSocket endpoints for real-time updates.
"""
import json
from typing import Optional

import structlog
from fastapi import Depends, Query, WebSocket, WebSocketDisconnect
from fastapi.routing import APIRouter
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import auth_service
from app.core.database import get_db
from app.models.enums import UserRole
from app.websocket.connection_manager import connection_manager

logger = structlog.get_logger(__name__)

router = APIRouter()


async def get_current_user_ws(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get current user from WebSocket token."""
    if not token:
        await websocket.close(code=4001, reason="Authentication required")
        return None

    try:
        # Verify JWT token
        payload = auth_service.verify_token(token)
        user_id = payload.get("sub")

        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return None

        # Get user from database
        user = await auth_service.get_user_by_id(db, user_id)

        if not user or not user.is_active:
            await websocket.close(code=4001, reason="User not found or inactive")
            return None

        return user

    except JWTError:
        await websocket.close(code=4001, reason="Invalid token")
        return None
    except Exception as e:
        logger.error("WebSocket authentication error", error=str(e))
        await websocket.close(code=4000, reason="Authentication error")
        return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="JWT token for authentication"),
    loctician_id: Optional[str] = Query(None, description="Subscribe to loctician updates"),
    db: AsyncSession = Depends(get_db),
):
    """
    Main WebSocket endpoint for real-time updates.

    Supports:
    - Booking updates
    - Availability changes
    - System notifications
    - Admin broadcasts

    Authentication via JWT token in query parameter.
    """
    connection_id = None
    user = None

    try:
        # Authenticate user
        user = await get_current_user_ws(websocket, token, db)
        if not user:
            return

        # Connect to manager
        connection_id = await connection_manager.connect(
            websocket=websocket,
            user_id=user.id,
            user_role=user.role,
            loctician_id=loctician_id
        )

        # Send initial connection info
        stats = await connection_manager.get_connection_stats()
        await connection_manager.send_personal_message({
            "type": "connection_info",
            "user_id": user.id,
            "role": user.role.value,
            "connection_stats": stats
        }, connection_id)

        # WebSocket message loop
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                await handle_client_message(message, user, connection_id, db)
            except json.JSONDecodeError:
                await connection_manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON format"
                }, connection_id)
            except Exception as e:
                logger.error(
                    "Error handling client message",
                    error=str(e),
                    user_id=user.id,
                    connection_id=connection_id
                )
                await connection_manager.send_personal_message({
                    "type": "error",
                    "message": "Message processing error"
                }, connection_id)

    except WebSocketDisconnect:
        logger.info(
            "WebSocket disconnected",
            user_id=user.id if user else "unknown",
            connection_id=connection_id
        )
    except Exception as e:
        logger.error(
            "WebSocket error",
            error=str(e),
            user_id=user.id if user else "unknown",
            connection_id=connection_id
        )
    finally:
        # Cleanup connection
        if connection_id and user:
            await connection_manager.disconnect(connection_id, user.id)


async def handle_client_message(
    message: dict,
    user,
    connection_id: str,
    db: AsyncSession
):
    """Handle incoming WebSocket messages from clients."""
    message_type = message.get("type")

    if message_type == "ping":
        # Respond to ping with pong
        await connection_manager.send_personal_message({
            "type": "pong",
            "timestamp": message.get("timestamp")
        }, connection_id)

    elif message_type == "subscribe_booking":
        # Subscribe to specific booking updates
        booking_id = message.get("booking_id")
        if booking_id:
            # Verify user has access to this booking
            has_access = await verify_booking_access(user, booking_id, db)
            if has_access:
                await connection_manager.send_personal_message({
                    "type": "subscription_confirmed",
                    "booking_id": booking_id
                }, connection_id)
            else:
                await connection_manager.send_personal_message({
                    "type": "error",
                    "message": "Access denied to booking"
                }, connection_id)

    elif message_type == "unsubscribe_booking":
        # Unsubscribe from booking updates
        booking_id = message.get("booking_id")
        await connection_manager.send_personal_message({
            "type": "unsubscription_confirmed",
            "booking_id": booking_id
        }, connection_id)

    elif message_type == "get_stats" and user.role == UserRole.ADMIN:
        # Send connection statistics (admin only)
        stats = await connection_manager.get_connection_stats()
        await connection_manager.send_personal_message({
            "type": "stats",
            "data": stats
        }, connection_id)

    elif message_type == "broadcast" and user.role == UserRole.ADMIN:
        # Broadcast message to all users (admin only)
        broadcast_message = message.get("message", {})
        await connection_manager.broadcast_system_message(
            "admin_broadcast",
            {
                "message": broadcast_message,
                "from_user": user.id,
                "timestamp": message.get("timestamp")
            }
        )

    else:
        await connection_manager.send_personal_message({
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        }, connection_id)


async def verify_booking_access(user, booking_id: str, db: AsyncSession) -> bool:
    """Verify if user has access to a specific booking."""
    try:
        from sqlalchemy import text

        # Check if user is customer or loctician for this booking
        query = text("""
            SELECT 1 FROM bookings
            WHERE id = :booking_id
            AND (customer_id = :user_id OR loctician_id = :user_id)
        """)

        result = await db.execute(query, {
            "booking_id": booking_id,
            "user_id": user.id
        })

        return result.scalar() is not None or user.role == UserRole.ADMIN

    except Exception as e:
        logger.error("Error verifying booking access", error=str(e))
        return False


@router.websocket("/ws/loctician/{loctician_id}")
async def loctician_websocket(
    websocket: WebSocket,
    loctician_id: str,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket endpoint specifically for loctician availability updates.

    This endpoint allows customers to subscribe to real-time availability
    updates for a specific loctician.
    """
    connection_id = None
    user = None

    try:
        # Authenticate user
        user = await get_current_user_ws(websocket, token, db)
        if not user:
            return

        # Verify loctician exists
        loctician = await auth_service.get_user_by_id(db, loctician_id)
        if not loctician or loctician.role != UserRole.LOCTICIAN:
            await websocket.close(code=4004, reason="Loctician not found")
            return

        # Connect with loctician subscription
        connection_id = await connection_manager.connect(
            websocket=websocket,
            user_id=user.id,
            user_role=user.role,
            loctician_id=loctician_id
        )

        # Send initial availability data
        await send_initial_availability(loctician_id, connection_id, db)

        # Keep connection alive
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await connection_manager.send_personal_message({
                    "type": "pong"
                }, connection_id)

    except WebSocketDisconnect:
        logger.info(
            "Loctician WebSocket disconnected",
            user_id=user.id if user else "unknown",
            loctician_id=loctician_id
        )
    except Exception as e:
        logger.error(
            "Loctician WebSocket error",
            error=str(e),
            loctician_id=loctician_id
        )
    finally:
        if connection_id and user:
            await connection_manager.disconnect(connection_id, user.id)


async def send_initial_availability(
    loctician_id: str,
    connection_id: str,
    db: AsyncSession
):
    """Send initial availability data for a loctician."""
    try:
        from sqlalchemy import text

        # Get current availability patterns
        query = text("""
            SELECT day_of_week, start_time, end_time, is_active
            FROM availability_patterns
            WHERE loctician_id = :loctician_id
            AND is_active = TRUE
            ORDER BY day_of_week, start_time
        """)

        result = await db.execute(query, {"loctician_id": loctician_id})
        patterns = []

        for row in result.fetchall():
            patterns.append({
                "day_of_week": row.day_of_week,
                "start_time": str(row.start_time),
                "end_time": str(row.end_time),
                "is_active": row.is_active
            })

        await connection_manager.send_personal_message({
            "type": "initial_availability",
            "loctician_id": loctician_id,
            "availability_patterns": patterns
        }, connection_id)

    except Exception as e:
        logger.error("Error sending initial availability", error=str(e))