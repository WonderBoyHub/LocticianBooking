"""
Enhanced security middleware and utilities.
"""
import hashlib
import hmac
import ipaddress
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from urllib.parse import urlparse

import structlog
from fastapi import HTTPException, Request, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.database import get_db

logger = structlog.get_logger(__name__)


class SecurityConfig:
    """Security configuration."""

    # Rate limiting
    DEFAULT_RATE_LIMIT = 100  # requests per minute
    AUTH_RATE_LIMIT = 5      # auth attempts per minute
    API_RATE_LIMIT = 1000    # API requests per minute

    # Security headers
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }

    # Allowed file types for uploads
    ALLOWED_UPLOAD_TYPES = {
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf", "text/plain", "text/csv"
    }

    # Maximum file sizes (in bytes)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_REQUEST_SIZE = 50 * 1024 * 1024  # 50MB

    # IP whitelist and blacklist
    WHITELISTED_IPS: Set[str] = set()
    BLACKLISTED_IPS: Set[str] = set()

    # Trusted proxies (for getting real client IP)
    TRUSTED_PROXIES = {"127.0.0.1", "::1"}


class RateLimiter:
    """Advanced rate limiter with different tiers."""

    def __init__(self):
        self.requests: Dict[str, Dict[str, List[float]]] = {}
        self.blocked_ips: Dict[str, float] = {}

    def _get_client_ip(self, request: Request) -> str:
        """Get real client IP address."""
        # Check for forwarded headers
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the first IP in the chain
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.headers.get("x-real-ip") or request.client.host

        return client_ip

    def _get_rate_limit_key(self, request: Request, user_id: Optional[str] = None) -> str:
        """Generate rate limit key."""
        client_ip = self._get_client_ip(request)
        endpoint = f"{request.method}:{request.url.path}"

        if user_id:
            return f"user:{user_id}:{endpoint}"
        else:
            return f"ip:{client_ip}:{endpoint}"

    def _clean_old_requests(self, requests: List[float], window_seconds: int = 60):
        """Remove old requests outside the time window."""
        current_time = time.time()
        return [req_time for req_time in requests if current_time - req_time < window_seconds]

    async def check_rate_limit(
        self,
        request: Request,
        user_id: Optional[str] = None,
        limit: int = SecurityConfig.DEFAULT_RATE_LIMIT,
        window_seconds: int = 60
    ) -> bool:
        """Check if request is within rate limits."""
        client_ip = self._get_client_ip(request)

        # Check if IP is blocked
        if client_ip in self.blocked_ips:
            block_time = self.blocked_ips[client_ip]
            if time.time() - block_time < 3600:  # 1 hour block
                return False
            else:
                del self.blocked_ips[client_ip]

        rate_limit_key = self._get_rate_limit_key(request, user_id)
        current_time = time.time()

        # Initialize tracking for this key
        if rate_limit_key not in self.requests:
            self.requests[rate_limit_key] = {"requests": [], "violations": 0}

        # Clean old requests
        self.requests[rate_limit_key]["requests"] = self._clean_old_requests(
            self.requests[rate_limit_key]["requests"], window_seconds
        )

        # Check if limit is exceeded
        request_count = len(self.requests[rate_limit_key]["requests"])

        if request_count >= limit:
            # Increment violation count
            self.requests[rate_limit_key]["violations"] += 1

            # Block IP after multiple violations
            if self.requests[rate_limit_key]["violations"] >= 5:
                self.blocked_ips[client_ip] = current_time
                logger.warning(
                    "IP blocked due to repeated rate limit violations",
                    ip=client_ip,
                    violations=self.requests[rate_limit_key]["violations"]
                )

            logger.warning(
                "Rate limit exceeded",
                key=rate_limit_key,
                limit=limit,
                current_count=request_count,
                window_seconds=window_seconds
            )

            return False

        # Add current request
        self.requests[rate_limit_key]["requests"].append(current_time)
        return True


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Add security headers
        for header, value in SecurityConfig.SECURITY_HEADERS.items():
            response.headers[header] = value

        # Add HSTS header for HTTPS
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


class IPFilterMiddleware(BaseHTTPMiddleware):
    """Middleware to filter IPs."""

    def _is_ip_allowed(self, ip: str) -> bool:
        """Check if IP is allowed."""
        # Check blacklist first
        if ip in SecurityConfig.BLACKLISTED_IPS:
            return False

        # If whitelist is configured, only allow whitelisted IPs
        if SecurityConfig.WHITELISTED_IPS and ip not in SecurityConfig.WHITELISTED_IPS:
            return False

        return True

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host

        # Get real IP if behind proxy
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        if not self._is_ip_allowed(client_ip):
            logger.warning("Blocked IP access attempt", ip=client_ip, path=request.url.path)
            return Response(
                content="Access denied",
                status_code=status.HTTP_403_FORBIDDEN
            )

        return await call_next(request)


class RequestSizeMiddleware(BaseHTTPMiddleware):
    """Middleware to limit request size."""

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")

        if content_length:
            content_length = int(content_length)
            if content_length > SecurityConfig.MAX_REQUEST_SIZE:
                logger.warning(
                    "Request size exceeded",
                    size=content_length,
                    max_size=SecurityConfig.MAX_REQUEST_SIZE,
                    path=request.url.path
                )
                return Response(
                    content="Request too large",
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
                )

        return await call_next(request)


class FileUploadValidator:
    """File upload validation utilities."""

    @staticmethod
    def validate_file_type(content_type: str, filename: str) -> bool:
        """Validate file type."""
        if content_type not in SecurityConfig.ALLOWED_UPLOAD_TYPES:
            return False

        # Additional extension check
        allowed_extensions = {
            "image/jpeg": [".jpg", ".jpeg"],
            "image/png": [".png"],
            "image/gif": [".gif"],
            "image/webp": [".webp"],
            "application/pdf": [".pdf"],
            "text/plain": [".txt"],
            "text/csv": [".csv"]
        }

        if content_type in allowed_extensions:
            file_ext = filename.lower().split(".")[-1] if "." in filename else ""
            valid_extensions = [ext.lstrip(".") for ext in allowed_extensions[content_type]]
            return file_ext in valid_extensions

        return False

    @staticmethod
    def validate_file_size(file_size: int) -> bool:
        """Validate file size."""
        return file_size <= SecurityConfig.MAX_FILE_SIZE

    @staticmethod
    def scan_file_content(file_content: bytes) -> bool:
        """Basic file content scanning."""
        # Check for common malicious patterns
        malicious_patterns = [
            b"<script",
            b"javascript:",
            b"vbscript:",
            b"onload=",
            b"onerror=",
            b"<?php",
            b"<%",
            b"exec(",
            b"eval(",
            b"base64_decode"
        ]

        content_lower = file_content.lower()
        for pattern in malicious_patterns:
            if pattern in content_lower:
                return False

        return True


class CSRFProtection:
    """CSRF protection utilities."""

    @staticmethod
    def generate_csrf_token(user_id: str, session_id: str) -> str:
        """Generate CSRF token."""
        message = f"{user_id}:{session_id}:{int(time.time())}"
        token = hmac.new(
            SecurityConfig.SECRET_KEY.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return token

    @staticmethod
    def validate_csrf_token(token: str, user_id: str, session_id: str) -> bool:
        """Validate CSRF token."""
        try:
            # Extract timestamp from token (simplified approach)
            current_time = int(time.time())

            # Generate expected token for current time window (5 minute window)
            for time_offset in range(0, 300, 60):  # Check 5 minute window
                test_time = current_time - time_offset
                message = f"{user_id}:{session_id}:{test_time}"
                expected_token = hmac.new(
                    SecurityConfig.SECRET_KEY.encode(),
                    message.encode(),
                    hashlib.sha256
                ).hexdigest()

                if hmac.compare_digest(token, expected_token):
                    return True

            return False
        except Exception:
            return False


class SQLInjectionDetector:
    """SQL injection detection utilities."""

    SUSPICIOUS_PATTERNS = [
        r"(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)",
        r"(\b(or|and)\s+['\"]?\w+['\"]?\s*=\s*['\"]?\w+['\"]?)",
        r"(['\"];?\s*(or|and|union|select|insert|update|delete)\s)",
        r"(\b(script|javascript|vbscript|onload|onerror)\b)",
        r"(--|#|/\*|\*/)",
        r"(\bxp_cmdshell\b|\bsp_executesql\b)"
    ]

    @staticmethod
    def detect_sql_injection(value: str) -> bool:
        """Detect potential SQL injection attempts."""
        import re

        if not isinstance(value, str):
            return False

        value_lower = value.lower()

        for pattern in SQLInjectionDetector.SUSPICIOUS_PATTERNS:
            if re.search(pattern, value_lower, re.IGNORECASE):
                return True

        return False

    @staticmethod
    def sanitize_input(value: str) -> str:
        """Basic input sanitization."""
        if not isinstance(value, str):
            return value

        # Remove or escape dangerous characters
        dangerous_chars = ["'", '"', ";", "--", "/*", "*/", "<", ">"]
        for char in dangerous_chars:
            value = value.replace(char, "")

        return value.strip()


class SecurityAuditor:
    """Security auditing utilities."""

    @staticmethod
    async def log_security_event(
        db: AsyncSession,
        event_type: str,
        description: str,
        ip_address: str,
        user_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """Log security events."""
        try:
            await db.execute(
                text("""
                    INSERT INTO security_events (
                        id, event_type, description, ip_address, user_id, metadata, created_at
                    ) VALUES (
                        gen_random_uuid(), :event_type, :description, :ip_address,
                        :user_id::uuid, :metadata::jsonb, NOW()
                    )
                """),
                {
                    "event_type": event_type,
                    "description": description,
                    "ip_address": ip_address,
                    "user_id": user_id,
                    "metadata": metadata or {}
                }
            )
            await db.commit()
        except Exception as e:
            logger.error("Failed to log security event", error=str(e))

    @staticmethod
    async def check_suspicious_activity(
        db: AsyncSession,
        ip_address: str,
        time_window_minutes: int = 10
    ) -> bool:
        """Check for suspicious activity patterns."""
        try:
            # Check for multiple failed login attempts
            result = await db.execute(
                text("""
                    SELECT COUNT(*) as count
                    FROM security_events
                    WHERE ip_address = :ip_address
                    AND event_type = 'failed_login'
                    AND created_at >= NOW() - INTERVAL ':time_window minutes'
                """),
                {"ip_address": ip_address, "time_window": time_window_minutes}
            )

            failed_logins = result.scalar()
            return failed_logins >= 5

        except Exception as e:
            logger.error("Failed to check suspicious activity", error=str(e))
            return False


# Rate limiter instance
rate_limiter = RateLimiter()


async def apply_rate_limiting(
    request: Request,
    user_id: Optional[str] = None,
    limit: int = SecurityConfig.DEFAULT_RATE_LIMIT
) -> None:
    """Apply rate limiting to request."""
    if not await rate_limiter.check_rate_limit(request, user_id, limit):
        # Get retry after time
        retry_after = 60  # 1 minute

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
            headers={"Retry-After": str(retry_after)}
        )


def get_security_headers() -> Dict[str, str]:
    """Get security headers."""
    return SecurityConfig.SECURITY_HEADERS.copy()