"""
Structured logging configuration.
"""
import logging
import sys
from typing import Any, Dict, Optional

import structlog
from uvicorn.logging import DefaultFormatter

from app.core.config import settings


def configure_logging() -> None:
    """Configure structured logging for the application."""

    # Configure structlog
    timestamper = structlog.processors.TimeStamper(fmt="ISO")

    shared_processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        timestamper,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.LOG_FORMAT == "json":
        # JSON output for production
        processors = shared_processors + [
            structlog.processors.JSONRenderer()
        ]
    else:
        # Human-readable output for development
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True)
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.LOG_LEVEL.upper()),
    )

    # Set log levels for specific modules
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.SQL_ECHO else logging.WARNING
    )


class RequestLoggerMiddleware:
    """Middleware to log HTTP requests and responses."""

    def __init__(self, app):
        self.app = app
        self.logger = structlog.get_logger(__name__)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        request_id = None
        start_time = None

        async def send_wrapper(message):
            nonlocal start_time
            if message["type"] == "http.response.start":
                start_time = structlog.get_logger().info
                # Extract request ID from headers if available
                headers = dict(message.get("headers", []))
                request_id = headers.get(b"x-request-id", b"").decode()

            elif message["type"] == "http.response.body" and start_time:
                # Log response
                self.logger.info(
                    "HTTP request completed",
                    method=scope["method"],
                    path=scope["path"],
                    status_code=message.get("status", 0),
                    request_id=request_id,
                )

            return await send(message)

        return await self.app(scope, receive, send_wrapper)


def get_logger(name: str) -> structlog.BoundLogger:
    """
    Get a structured logger instance.

    Args:
        name: Logger name (usually __name__)

    Returns:
        structlog.BoundLogger: Configured logger instance
    """
    return structlog.get_logger(name)


def log_security_event(
    event_type: str,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    additional_data: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Log security-related events.

    Args:
        event_type: Type of security event
        user_id: User ID if available
        ip_address: Client IP address
        user_agent: Client user agent
        additional_data: Additional event data
    """
    logger = get_logger("security")

    event_data = {
        "event_type": event_type,
        "user_id": user_id,
        "ip_address": ip_address,
        "user_agent": user_agent,
    }

    if additional_data:
        event_data.update(additional_data)

    logger.warning("Security event", **event_data)


def log_audit_event(
    action: str,
    resource_type: str,
    resource_id: str,
    user_id: str,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Log audit events for data changes.

    Args:
        action: Action performed (create, update, delete)
        resource_type: Type of resource affected
        resource_id: ID of the resource
        user_id: User who performed the action
        old_values: Previous values (for updates/deletes)
        new_values: New values (for creates/updates)
    """
    logger = get_logger("audit")

    logger.info(
        "Audit event",
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=user_id,
        old_values=old_values,
        new_values=new_values,
    )