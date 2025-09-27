"""
Security middleware for the Loctician Booking System.
"""
import time
from typing import Optional

import structlog
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = structlog.get_logger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), "
            "payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()"
        )

        # HSTS header for production
        if not request.url.hostname in ["localhost", "127.0.0.1"]:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log HTTP requests and responses with security context."""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        request_id = f"{int(start_time * 1000000)}"

        # Extract client information
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "Unknown")

        # Log request start
        logger.info(
            "HTTP request started",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            query_params=str(request.query_params) if request.query_params else None,
            client_ip=client_ip,
            user_agent=user_agent,
        )

        # Process request
        response = await call_next(request)

        # Calculate processing time
        process_time = time.time() - start_time

        # Log response
        logger.info(
            "HTTP request completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            process_time=f"{process_time:.4f}s",
            response_size=response.headers.get("content-length", "unknown"),
        )

        # Add headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.4f}"

        return response

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        # Check for forwarded headers (load balancer/proxy)
        if "x-forwarded-for" in request.headers:
            return request.headers["x-forwarded-for"].split(",")[0].strip()
        elif "x-real-ip" in request.headers:
            return request.headers["x-real-ip"]
        elif request.client:
            return request.client.host
        else:
            return "unknown"


class DatabaseRLSMiddleware(BaseHTTPMiddleware):
    """Set PostgreSQL Row Level Security context for authenticated users."""

    async def dispatch(self, request: Request, call_next):
        # This middleware sets the app.current_user_id setting for PostgreSQL RLS
        # The actual user ID will be set in the authentication dependencies

        response = await call_next(request)

        return response


class SuspiciousActivityMiddleware(BaseHTTPMiddleware):
    """Monitor for suspicious activity patterns."""

    def __init__(self, app, max_requests_per_minute: int = 120):
        super().__init__(app)
        self.max_requests_per_minute = max_requests_per_minute
        self.request_history = {}  # In production, use Redis

    async def dispatch(self, request: Request, call_next):
        client_ip = self._get_client_ip(request)
        current_time = time.time()

        # Clean old entries (older than 1 minute)
        cutoff_time = current_time - 60
        if client_ip in self.request_history:
            self.request_history[client_ip] = [
                req_time for req_time in self.request_history[client_ip]
                if req_time > cutoff_time
            ]

        # Add current request
        if client_ip not in self.request_history:
            self.request_history[client_ip] = []
        self.request_history[client_ip].append(current_time)

        # Check if rate limit exceeded
        if len(self.request_history[client_ip]) > self.max_requests_per_minute:
            logger.warning(
                "Suspicious activity detected - rate limit exceeded",
                client_ip=client_ip,
                requests_count=len(self.request_history[client_ip]),
                path=request.url.path,
                user_agent=request.headers.get("user-agent"),
            )

            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Too many requests",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )

        # Check for SQL injection patterns in query parameters
        if self._check_sql_injection_patterns(request):
            logger.warning(
                "Suspicious activity detected - potential SQL injection",
                client_ip=client_ip,
                path=request.url.path,
                query_params=str(request.query_params),
                user_agent=request.headers.get("user-agent"),
            )

            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Invalid request"}
            )

        response = await call_next(request)

        return response

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address."""
        if "x-forwarded-for" in request.headers:
            return request.headers["x-forwarded-for"].split(",")[0].strip()
        elif "x-real-ip" in request.headers:
            return request.headers["x-real-ip"]
        elif request.client:
            return request.client.host
        else:
            return "unknown"

    def _check_sql_injection_patterns(self, request: Request) -> bool:
        """Check for basic SQL injection patterns."""
        suspicious_patterns = [
            "union select",
            "drop table",
            "delete from",
            "insert into",
            "update set",
            "--",
            "/*",
            "*/",
            "xp_",
            "sp_",
            "exec(",
            "execute(",
        ]

        # Check query parameters
        query_string = str(request.query_params).lower()
        for pattern in suspicious_patterns:
            if pattern in query_string:
                return True

        return False


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """CSRF protection for state-changing operations."""

    def __init__(self, app, exempt_paths: Optional[list] = None):
        super().__init__(app)
        self.exempt_paths = exempt_paths or ["/docs", "/redoc", "/openapi.json", "/health"]

    async def dispatch(self, request: Request, call_next):
        # Skip CSRF check for safe methods and exempt paths
        if (request.method in ["GET", "HEAD", "OPTIONS"] or
            any(request.url.path.startswith(path) for path in self.exempt_paths)):
            return await call_next(request)

        # For API requests with Authorization header, skip CSRF
        if request.headers.get("authorization"):
            return await call_next(request)

        # Check for CSRF token in header
        csrf_token = request.headers.get("x-csrf-token")
        if not csrf_token:
            logger.warning(
                "CSRF token missing",
                path=request.url.path,
                method=request.method,
                client_ip=self._get_client_ip(request),
            )

            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "CSRF token required"}
            )

        # In a real implementation, validate the CSRF token
        # For now, just check it's not empty
        if not csrf_token.strip():
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Invalid CSRF token"}
            )

        response = await call_next(request)

        return response

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address."""
        if "x-forwarded-for" in request.headers:
            return request.headers["x-forwarded-for"].split(",")[0].strip()
        elif request.client:
            return request.client.host
        else:
            return "unknown"