"""
WebSocket connection manager for real-time updates.
"""
import json
from typing import Dict, List, Optional, Set
import uuid

import structlog
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.models.enums import UserRole

logger = structlog.get_logger(__name__)


class ConnectionManager:
    """Manage WebSocket connections for real-time updates."""

    def __init__(self):
        # Active connections by connection ID
        self.active_connections: Dict[str, WebSocket] = {}

        # User connections mapping
        self.user_connections: Dict[str, Set[str]] = {}

        # Loctician connections for booking updates
        self.loctician_connections: Dict[str, Set[str]] = {}

        # Admin connections for system-wide updates
        self.admin_connections: Set[str] = set()

    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        user_role: UserRole,
        loctician_id: Optional[str] = None
    ) -> str:
        """
        Accept WebSocket connection and register user.

        Args:
            websocket: WebSocket instance
            user_id: User ID
            user_role: User role
            loctician_id: Loctician ID if user is subscribing to loctician updates

        Returns:
            Connection ID
        """
        await websocket.accept()

        # Generate unique connection ID
        connection_id = str(uuid.uuid4())

        # Store connection
        self.active_connections[connection_id] = websocket

        # Register user connection
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(connection_id)

        # Register role-specific connections
        if user_role == UserRole.ADMIN:
            self.admin_connections.add(connection_id)
        elif user_role == UserRole.LOCTICIAN:
            if user_id not in self.loctician_connections:
                self.loctician_connections[user_id] = set()
            self.loctician_connections[user_id].add(connection_id)

        # If customer is subscribing to loctician updates
        if loctician_id and user_role == UserRole.CUSTOMER:
            if loctician_id not in self.loctician_connections:
                self.loctician_connections[loctician_id] = set()
            self.loctician_connections[loctician_id].add(connection_id)

        logger.info(
            "WebSocket connection established",
            connection_id=connection_id,
            user_id=user_id,
            user_role=user_role.value,
            total_connections=len(self.active_connections)
        )

        # Send welcome message
        await self.send_personal_message({
            "type": "connection_established",
            "connection_id": connection_id,
            "message": "Real-time updates enabled"
        }, connection_id)

        return connection_id

    async def disconnect(self, connection_id: str, user_id: str):
        """Disconnect and cleanup connection."""
        try:
            # Remove from active connections
            if connection_id in self.active_connections:
                del self.active_connections[connection_id]

            # Remove from user connections
            if user_id in self.user_connections:
                self.user_connections[user_id].discard(connection_id)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]

            # Remove from role-specific connections
            self.admin_connections.discard(connection_id)

            for loctician_id, connections in list(self.loctician_connections.items()):
                connections.discard(connection_id)
                if not connections:
                    del self.loctician_connections[loctician_id]

            logger.info(
                "WebSocket connection closed",
                connection_id=connection_id,
                user_id=user_id,
                total_connections=len(self.active_connections)
            )

        except Exception as e:
            logger.error("Error during disconnect", error=str(e), connection_id=connection_id)

    async def send_personal_message(self, message: dict, connection_id: str):
        """Send message to specific connection."""
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text(json.dumps(message))
                else:
                    # Connection is closed, remove it
                    await self._cleanup_dead_connection(connection_id)
            except Exception as e:
                logger.error(
                    "Error sending personal message",
                    error=str(e),
                    connection_id=connection_id
                )
                await self._cleanup_dead_connection(connection_id)

    async def send_user_message(self, message: dict, user_id: str):
        """Send message to all connections of a specific user."""
        if user_id in self.user_connections:
            for connection_id in list(self.user_connections[user_id]):
                await self.send_personal_message(message, connection_id)

    async def send_loctician_message(self, message: dict, loctician_id: str):
        """Send message to all connections subscribed to a loctician."""
        if loctician_id in self.loctician_connections:
            for connection_id in list(self.loctician_connections[loctician_id]):
                await self.send_personal_message(message, connection_id)

    async def send_admin_message(self, message: dict):
        """Send message to all admin connections."""
        for connection_id in list(self.admin_connections):
            await self.send_personal_message(message, connection_id)

    async def broadcast_booking_update(self, booking_data: dict):
        """Broadcast booking update to relevant users."""
        message = {
            "type": "booking_update",
            "data": booking_data,
            "timestamp": json.dumps(booking_data.get("updated_at"), default=str)
        }

        # Send to customer
        if "customer_id" in booking_data:
            await self.send_user_message(message, booking_data["customer_id"])

        # Send to loctician
        if "loctician_id" in booking_data:
            await self.send_loctician_message(message, booking_data["loctician_id"])

        # Send to admins
        await self.send_admin_message(message)

        logger.info(
            "Booking update broadcasted",
            booking_id=booking_data.get("id"),
            status=booking_data.get("status")
        )

    async def broadcast_availability_update(self, loctician_id: str, availability_data: dict):
        """Broadcast availability update for a loctician."""
        message = {
            "type": "availability_update",
            "loctician_id": loctician_id,
            "data": availability_data,
            "timestamp": availability_data.get("updated_at")
        }

        # Send to loctician and their subscribers
        await self.send_loctician_message(message, loctician_id)

        # Send to admins
        await self.send_admin_message(message)

        logger.info(
            "Availability update broadcasted",
            loctician_id=loctician_id
        )

    async def broadcast_system_message(self, message_type: str, content: dict):
        """Broadcast system-wide message to all connections."""
        message = {
            "type": message_type,
            "data": content,
            "timestamp": content.get("timestamp")
        }

        # Send to all active connections
        for connection_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, connection_id)

        logger.info(
            "System message broadcasted",
            message_type=message_type,
            recipients=len(self.active_connections)
        )

    async def send_notification(self, user_id: str, notification: dict):
        """Send notification to specific user."""
        message = {
            "type": "notification",
            "data": notification,
            "timestamp": notification.get("created_at")
        }

        await self.send_user_message(message, user_id)

        logger.info(
            "Notification sent",
            user_id=user_id,
            notification_type=notification.get("type")
        )

    async def get_connection_stats(self) -> dict:
        """Get WebSocket connection statistics."""
        return {
            "total_connections": len(self.active_connections),
            "user_connections": len(self.user_connections),
            "loctician_connections": len(self.loctician_connections),
            "admin_connections": len(self.admin_connections),
        }

    async def _cleanup_dead_connection(self, connection_id: str):
        """Clean up a dead connection."""
        try:
            # Find user ID for this connection
            user_id = None
            for uid, connections in self.user_connections.items():
                if connection_id in connections:
                    user_id = uid
                    break

            if user_id:
                await self.disconnect(connection_id, user_id)
        except Exception as e:
            logger.error("Error cleaning up dead connection", error=str(e))


# Global connection manager instance
connection_manager = ConnectionManager()