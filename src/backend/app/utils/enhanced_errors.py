"""
Enhanced error handling and validation utilities.
"""
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import uuid4

import structlog
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError

logger = structlog.get_logger(__name__)


class ErrorDetail(BaseModel):
    """Detailed error information."""
    type: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    field: Optional[str] = Field(None, description="Field that caused the error")
    code: Optional[str] = Field(None, description="Error code")


class ErrorResponse(BaseModel):
    """Standardized error response."""
    error: bool = True
    error_id: str = Field(..., description="Unique error identifier")
    message: str = Field(..., description="Human-readable error message")
    details: List[ErrorDetail] = Field(default=[], description="Detailed error information")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    path: Optional[str] = Field(None, description="Request path")
    method: Optional[str] = Field(None, description="HTTP method")
    status_code: int = Field(..., description="HTTP status code")


class BusinessLogicError(HTTPException):
    """Custom exception for business logic errors."""

    def __init__(self, message: str, details: List[ErrorDetail] = None, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.details = details or []
        super().__init__(status_code=status_code, detail=message)


class ValidationException(HTTPException):
    """Custom validation exception with detailed field errors."""

    def __init__(self, errors: List[ErrorDetail], message: str = "Validation failed"):
        self.errors = errors
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)


class ResourceNotFoundError(HTTPException):
    """Resource not found error."""

    def __init__(self, resource: str, identifier: str = None):
        message = f"{resource} not found"
        if identifier:
            message += f" with identifier: {identifier}"
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=message)


class PermissionDeniedError(HTTPException):
    """Permission denied error."""

    def __init__(self, message: str = "Access denied", required_role: str = None):
        if required_role:
            message += f". Required role: {required_role}"
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=message)


class RateLimitExceededError(HTTPException):
    """Rate limit exceeded error."""

    def __init__(self, message: str = "Rate limit exceeded", retry_after: int = None):
        headers = {}
        if retry_after:
            headers["Retry-After"] = str(retry_after)
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=message,
            headers=headers
        )


class ServiceUnavailableError(HTTPException):
    """Service unavailable error."""

    def __init__(self, service: str, message: str = None):
        detail = message or f"{service} service is currently unavailable"
        super().__init__(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


def create_error_response(
    request: Request,
    status_code: int,
    message: str,
    details: List[ErrorDetail] = None,
    error_id: str = None
) -> ErrorResponse:
    """Create standardized error response."""
    return ErrorResponse(
        error_id=error_id or str(uuid4()),
        message=message,
        details=details or [],
        path=str(request.url.path),
        method=request.method,
        status_code=status_code
    )


def handle_validation_error(request: Request, exc: ValidationError) -> JSONResponse:
    """Handle Pydantic validation errors."""
    error_details = []

    for error in exc.errors():
        field_path = " -> ".join(str(loc) for loc in error["loc"])
        error_details.append(ErrorDetail(
            type="validation_error",
            message=error["msg"],
            field=field_path,
            code=error["type"]
        ))

    error_response = create_error_response(
        request=request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        message="Validation failed",
        details=error_details
    )

    logger.warning(
        "Validation error",
        path=request.url.path,
        method=request.method,
        errors=error_details
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=error_response.model_dump(mode="json")
    )


def handle_business_logic_error(request: Request, exc: BusinessLogicError) -> JSONResponse:
    """Handle business logic errors."""
    error_response = create_error_response(
        request=request,
        status_code=exc.status_code,
        message=exc.message,
        details=exc.details
    )

    logger.warning(
        "Business logic error",
        path=request.url.path,
        method=request.method,
        message=exc.message,
        status_code=exc.status_code
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.model_dump(mode="json")
    )


def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTP exceptions."""
    error_details = []

    # Handle specific exception types
    if isinstance(exc, ValidationException):
        error_details = exc.errors

    error_response = create_error_response(
        request=request,
        status_code=exc.status_code,
        message=exc.detail,
        details=error_details
    )

    logger.warning(
        "HTTP exception",
        path=request.url.path,
        method=request.method,
        status_code=exc.status_code,
        detail=exc.detail
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.model_dump(mode="json"),
        headers=getattr(exc, 'headers', None)
    )


def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected errors."""
    error_id = str(uuid4())

    error_response = create_error_response(
        request=request,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        message="An unexpected error occurred",
        error_id=error_id
    )

    # Log the full exception details
    logger.error(
        "Unexpected error",
        error_id=error_id,
        path=request.url.path,
        method=request.method,
        error=str(exc),
        traceback=traceback.format_exc(),
        exc_info=True
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response.model_dump(mode="json")
    )


# Validation utilities
class BookingValidation:
    """Booking-specific validation utilities."""

    @staticmethod
    def validate_appointment_time(appointment_start: datetime, service_duration: int) -> List[ErrorDetail]:
        """Validate appointment timing."""
        errors = []
        now = datetime.utcnow()

        # Check if appointment is in the future
        if appointment_start <= now:
            errors.append(ErrorDetail(
                type="validation_error",
                message="Appointment must be in the future",
                field="appointment_start",
                code="past_appointment"
            ))

        # Check business hours (example: 9 AM to 6 PM)
        hour = appointment_start.hour
        if hour < 9 or hour >= 18:
            errors.append(ErrorDetail(
                type="validation_error",
                message="Appointment must be during business hours (9 AM - 6 PM)",
                field="appointment_start",
                code="outside_business_hours"
            ))

        # Check service duration
        if service_duration < 15 or service_duration > 480:  # 15 minutes to 8 hours
            errors.append(ErrorDetail(
                type="validation_error",
                message="Service duration must be between 15 minutes and 8 hours",
                field="service_duration",
                code="invalid_duration"
            ))

        return errors

    @staticmethod
    def validate_booking_capacity(participant_count: int, max_participants: int) -> List[ErrorDetail]:
        """Validate booking capacity."""
        errors = []

        if participant_count > max_participants:
            errors.append(ErrorDetail(
                type="validation_error",
                message=f"Maximum {max_participants} participants allowed",
                field="participant_count",
                code="exceeds_capacity"
            ))

        if participant_count < 1:
            errors.append(ErrorDetail(
                type="validation_error",
                message="At least one participant required",
                field="participant_count",
                code="no_participants"
            ))

        return errors


class PaymentValidation:
    """Payment-specific validation utilities."""

    @staticmethod
    def validate_amount(amount: float, currency: str = "DKK") -> List[ErrorDetail]:
        """Validate payment amount."""
        errors = []

        if amount <= 0:
            errors.append(ErrorDetail(
                type="validation_error",
                message="Amount must be greater than zero",
                field="amount",
                code="invalid_amount"
            ))

        if currency != "DKK":
            errors.append(ErrorDetail(
                type="validation_error",
                message="Only DKK currency is supported",
                field="currency",
                code="unsupported_currency"
            ))

        # Check reasonable limits (e.g., max 10,000 DKK)
        if amount > 10000:
            errors.append(ErrorDetail(
                type="validation_error",
                message="Amount exceeds maximum limit of 10,000 DKK",
                field="amount",
                code="amount_too_high"
            ))

        return errors


class UserValidation:
    """User-specific validation utilities."""

    @staticmethod
    def validate_phone_number(phone: str) -> List[ErrorDetail]:
        """Validate Danish phone number."""
        errors = []

        if not phone:
            return errors

        # Remove spaces and special characters
        clean_phone = "".join(c for c in phone if c.isdigit() or c == "+")

        # Danish phone number validation
        if not (clean_phone.startswith("+45") or clean_phone.startswith("45")):
            if len(clean_phone) == 8 and clean_phone.isdigit():
                # Valid Danish local number
                pass
            else:
                errors.append(ErrorDetail(
                    type="validation_error",
                    message="Invalid Danish phone number format",
                    field="phone",
                    code="invalid_phone"
                ))

        return errors

    @staticmethod
    def validate_postal_code(postal_code: str, country: str = "DK") -> List[ErrorDetail]:
        """Validate postal code."""
        errors = []

        if not postal_code:
            return errors

        if country == "DK":
            # Danish postal codes are 4 digits
            if not (postal_code.isdigit() and len(postal_code) == 4):
                errors.append(ErrorDetail(
                    type="validation_error",
                    message="Danish postal code must be 4 digits",
                    field="postal_code",
                    code="invalid_postal_code"
                ))

        return errors


# Request validation decorators
def validate_request_size(max_size_mb: int = 10):
    """Decorator to validate request size."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break

            if request:
                content_length = request.headers.get("content-length")
                if content_length and int(content_length) > max_size_mb * 1024 * 1024:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Request size exceeds {max_size_mb}MB limit"
                    )

            return await func(*args, **kwargs)
        return wrapper
    return decorator


def validate_content_type(allowed_types: List[str]):
    """Decorator to validate request content type."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break

            if request:
                content_type = request.headers.get("content-type", "").lower()
                if not any(allowed_type in content_type for allowed_type in allowed_types):
                    raise HTTPException(
                        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                        detail=f"Content type must be one of: {', '.join(allowed_types)}"
                    )

            return await func(*args, **kwargs)
        return wrapper
    return decorator