"""
Comprehensive error handling for the Loctician Booking System.
"""
import traceback
from typing import Any, Dict, Optional

import structlog
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

logger = structlog.get_logger(__name__)


class ErrorResponse(BaseModel):
    """Standard error response format."""

    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
    error_id: Optional[str] = None
    status_code: int


class BookingError(HTTPException):
    """Custom booking-related error."""

    def __init__(
        self,
        detail: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        error_code: str = "BOOKING_ERROR",
        headers: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.error_code = error_code


class AuthenticationError(HTTPException):
    """Custom authentication error."""

    def __init__(
        self,
        detail: str = "Authentication failed",
        status_code: int = status.HTTP_401_UNAUTHORIZED,
        error_code: str = "AUTH_ERROR",
    ):
        super().__init__(
            status_code=status_code,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )
        self.error_code = error_code


class AuthorizationError(HTTPException):
    """Custom authorization error."""

    def __init__(
        self,
        detail: str = "Access denied",
        status_code: int = status.HTTP_403_FORBIDDEN,
        error_code: str = "AUTHORIZATION_ERROR",
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code


class ValidationError(HTTPException):
    """Custom validation error."""

    def __init__(
        self,
        detail: str,
        field_errors: Optional[Dict[str, str]] = None,
        status_code: int = status.HTTP_422_UNPROCESSABLE_ENTITY,
        error_code: str = "VALIDATION_ERROR",
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code
        self.field_errors = field_errors or {}


class DatabaseError(HTTPException):
    """Custom database error."""

    def __init__(
        self,
        detail: str = "Database operation failed",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: str = "DATABASE_ERROR",
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code


class RateLimitError(HTTPException):
    """Custom rate limit error."""

    def __init__(
        self,
        detail: str = "Rate limit exceeded",
        retry_after: int = 60,
        status_code: int = status.HTTP_429_TOO_MANY_REQUESTS,
    ):
        super().__init__(
            status_code=status_code,
            detail=detail,
            headers={"Retry-After": str(retry_after)},
        )


class ErrorHandler:
    """Central error handler for the application."""

    @staticmethod
    async def booking_error_handler(request: Request, exc: BookingError) -> JSONResponse:
        """Handle booking-related errors."""
        logger.warning(
            "Booking error occurred",
            error_code=exc.error_code,
            detail=exc.detail,
            path=request.url.path,
            method=request.method,
        )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.error_code,
                "message": exc.detail,
                "status_code": exc.status_code,
            },
            headers=exc.headers,
        )

    @staticmethod
    async def authentication_error_handler(
        request: Request, exc: AuthenticationError
    ) -> JSONResponse:
        """Handle authentication errors."""
        logger.warning(
            "Authentication error occurred",
            error_code=exc.error_code,
            detail=exc.detail,
            path=request.url.path,
            method=request.method,
            client_ip=request.client.host if request.client else None,
        )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.error_code,
                "message": exc.detail,
                "status_code": exc.status_code,
            },
            headers=exc.headers,
        )

    @staticmethod
    async def authorization_error_handler(
        request: Request, exc: AuthorizationError
    ) -> JSONResponse:
        """Handle authorization errors."""
        logger.warning(
            "Authorization error occurred",
            error_code=exc.error_code,
            detail=exc.detail,
            path=request.url.path,
            method=request.method,
            client_ip=request.client.host if request.client else None,
        )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.error_code,
                "message": exc.detail,
                "status_code": exc.status_code,
            },
        )

    @staticmethod
    async def validation_error_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        """Handle validation errors."""
        logger.warning(
            "Validation error occurred",
            error_code=exc.error_code,
            detail=exc.detail,
            field_errors=exc.field_errors,
            path=request.url.path,
            method=request.method,
        )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.error_code,
                "message": exc.detail,
                "field_errors": exc.field_errors,
                "status_code": exc.status_code,
            },
        )

    @staticmethod
    async def database_error_handler(
        request: Request, exc: DatabaseError
    ) -> JSONResponse:
        """Handle database errors."""
        logger.error(
            "Database error occurred",
            error_code=exc.error_code,
            detail=exc.detail,
            path=request.url.path,
            method=request.method,
        )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.error_code,
                "message": "A database error occurred. Please try again later.",
                "status_code": exc.status_code,
            },
        )

    @staticmethod
    async def rate_limit_error_handler(
        request: Request, exc: RateLimitError
    ) -> JSONResponse:
        """Handle rate limit errors."""
        logger.warning(
            "Rate limit exceeded",
            path=request.url.path,
            method=request.method,
            client_ip=request.client.host if request.client else None,
        )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "RATE_LIMIT_EXCEEDED",
                "message": exc.detail,
                "status_code": exc.status_code,
            },
            headers=exc.headers,
        )

    @staticmethod
    async def pydantic_validation_error_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        """Handle Pydantic validation errors."""
        errors = {}
        for error in exc.errors():
            field = ".".join(str(x) for x in error["loc"])
            errors[field] = error["msg"]

        logger.warning(
            "Pydantic validation error",
            errors=errors,
            path=request.url.path,
            method=request.method,
        )

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "VALIDATION_ERROR",
                "message": "Input validation failed",
                "field_errors": errors,
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
            },
        )

    @staticmethod
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        """Handle generic HTTP exceptions."""
        logger.warning(
            "HTTP exception occurred",
            status_code=exc.status_code,
            detail=exc.detail,
            path=request.url.path,
            method=request.method,
        )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "HTTP_ERROR",
                "message": exc.detail,
                "status_code": exc.status_code,
            },
            headers=exc.headers,
        )

    @staticmethod
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle all other unhandled exceptions."""
        error_id = f"{request.method}_{request.url.path}_{hash(str(exc))}"

        logger.error(
            "Unhandled exception occurred",
            error_id=error_id,
            error=str(exc),
            path=request.url.path,
            method=request.method,
            traceback=traceback.format_exc(),
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
                "error_id": error_id,
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
        )


def register_error_handlers(app):
    """Register all error handlers with the FastAPI app."""
    app.add_exception_handler(BookingError, ErrorHandler.booking_error_handler)
    app.add_exception_handler(AuthenticationError, ErrorHandler.authentication_error_handler)
    app.add_exception_handler(AuthorizationError, ErrorHandler.authorization_error_handler)
    app.add_exception_handler(ValidationError, ErrorHandler.validation_error_handler)
    app.add_exception_handler(DatabaseError, ErrorHandler.database_error_handler)
    app.add_exception_handler(RateLimitError, ErrorHandler.rate_limit_error_handler)
    app.add_exception_handler(ValidationError, ErrorHandler.pydantic_validation_error_handler)
    app.add_exception_handler(HTTPException, ErrorHandler.http_exception_handler)
    app.add_exception_handler(Exception, ErrorHandler.general_exception_handler)


# Helper functions for common error scenarios
def raise_booking_not_found(booking_id: str):
    """Raise booking not found error."""
    raise BookingError(
        detail=f"Booking with ID {booking_id} not found",
        status_code=status.HTTP_404_NOT_FOUND,
        error_code="BOOKING_NOT_FOUND",
    )


def raise_booking_conflict(message: str = "Booking conflict"):
    """Raise booking conflict error."""
    raise BookingError(
        detail=message,
        status_code=status.HTTP_409_CONFLICT,
        error_code="BOOKING_CONFLICT",
    )


def raise_invalid_booking_time(message: str = "Invalid booking time"):
    """Raise invalid booking time error."""
    raise BookingError(
        detail=message,
        status_code=status.HTTP_400_BAD_REQUEST,
        error_code="INVALID_BOOKING_TIME",
    )


def raise_user_not_found(user_id: str):
    """Raise user not found error."""
    raise AuthenticationError(
        detail=f"User with ID {user_id} not found",
        status_code=status.HTTP_404_NOT_FOUND,
        error_code="USER_NOT_FOUND",
    )


def raise_access_denied(resource: str = "resource"):
    """Raise access denied error."""
    raise AuthorizationError(
        detail=f"Access denied to {resource}",
        error_code="ACCESS_DENIED",
    )


def raise_invalid_credentials():
    """Raise invalid credentials error."""
    raise AuthenticationError(
        detail="Invalid email or password",
        error_code="INVALID_CREDENTIALS",
    )


def raise_account_locked():
    """Raise account locked error."""
    raise AuthenticationError(
        detail="Account temporarily locked due to too many failed attempts",
        status_code=status.HTTP_423_LOCKED,
        error_code="ACCOUNT_LOCKED",
    )


def raise_validation_error(message: str, field_errors: Optional[Dict[str, str]] = None):
    """Raise validation error."""
    raise ValidationError(
        detail=message,
        field_errors=field_errors,
    )


def raise_database_error(message: str = "Database operation failed"):
    """Raise database error."""
    raise DatabaseError(detail=message)


def raise_rate_limit_exceeded(retry_after: int = 60):
    """Raise rate limit exceeded error."""
    raise RateLimitError(retry_after=retry_after)