"""
Main FastAPI application entry point for the Loctician Booking System.

This application provides a comprehensive booking system with:
- Secure authentication using PostgreSQL security functions
- Anti-double-booking with database constraints
- Full-text search capabilities
- Real-time updates via WebSocket
- Rate limiting and security middleware
- GDPR compliance features
- Danish timezone and locale support
"""
import time
from contextlib import asynccontextmanager
from typing import Dict

import structlog
from fastapi import FastAPI, HTTPException, Request, status, WebSocket
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.v1.endpoints import (
    auth,
    bookings,
    users,
    # Consolidated and standardized endpoints
    availability,
    calendar,
    bookings_advanced,
    users_management,
    payments_mollie,
    websocket_calendar,
    monitoring
)
from app.middleware.enhanced_security import (
    SecurityHeadersMiddleware,
    IPFilterMiddleware,
    RequestSizeMiddleware
)
from app.utils.enhanced_errors import (
    handle_validation_error,
    handle_business_logic_error,
    handle_http_exception,
    handle_unexpected_error,
    BusinessLogicError,
    ValidationException
)
from pydantic import ValidationError
from app.core.config import settings
from app.core.database import close_db, db_health, init_db

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting Loctician Booking API", version=settings.PROJECT_VERSION)

    try:
        # Initialize database
        await init_db()
        logger.info("Database initialized successfully")

        # Check database health
        if await db_health.check():
            logger.info("Database health check passed")
        else:
            logger.error("Database health check failed")
            raise Exception("Database health check failed")

        logger.info("Application startup completed")

    except Exception as e:
        logger.error("Application startup failed", error=str(e))
        raise

    yield

    # Shutdown
    logger.info("Shutting down Loctician Booking API")

    try:
        await close_db()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error("Error during shutdown", error=str(e))

    logger.info("Application shutdown completed")


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.PROJECT_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# Add enhanced security middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(IPFilterMiddleware)
app.add_middleware(RequestSizeMiddleware)

# Add rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Add session middleware for CSRF protection
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    same_site="lax",
    https_only=not settings.DEBUG,
)

# Add trusted host middleware
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["loctician.dk", "*.loctician.dk", "localhost"]
    )

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
    ],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
    ],
)


# Request/Response logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests and responses."""
    start_time = time.time()

    # Log request
    logger.info(
        "HTTP request started",
        method=request.method,
        url=str(request.url),
        client=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    response = await call_next(request)

    # Calculate processing time
    process_time = time.time() - start_time

    # Log response
    logger.info(
        "HTTP request completed",
        method=request.method,
        url=str(request.url),
        status_code=response.status_code,
        process_time=f"{process_time:.4f}s",
    )

    # Add processing time header
    response.headers["X-Process-Time"] = str(process_time)

    return response


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response


# Enhanced exception handlers
@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    """Handle Pydantic validation errors."""
    return handle_validation_error(request, exc)


@app.exception_handler(BusinessLogicError)
async def business_logic_exception_handler(request: Request, exc: BusinessLogicError):
    """Handle business logic errors."""
    return handle_business_logic_error(request, exc)


@app.exception_handler(ValidationException)
async def custom_validation_exception_handler(request: Request, exc: ValidationException):
    """Handle custom validation exceptions."""
    return handle_business_logic_error(request, exc)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with enhanced logging."""
    return handle_http_exception(request, exc)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions with enhanced error tracking."""
    return handle_unexpected_error(request, exc)


# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check() -> Dict[str, str]:
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.PROJECT_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health/db", tags=["Health"])
async def database_health_check() -> Dict[str, str]:
    """Database health check endpoint."""
    if await db_health.check():
        return {"status": "healthy", "database": "connected"}
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed"
        )


@app.get("/health/ready", tags=["Health"])
async def readiness_check() -> Dict[str, str]:
    """Kubernetes readiness probe endpoint."""
    try:
        # Check database connection
        if not await db_health.check():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database not ready"
            )

        return {
            "status": "ready",
            "database": "healthy",
        }

    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not ready"
        )


@app.get("/health/live", tags=["Health"])
async def liveness_check() -> Dict[str, str]:
    """Kubernetes liveness probe endpoint."""
    return {"status": "alive"}


# API version info
@app.get("/", tags=["Root"])
async def root() -> Dict[str, str]:
    """API root endpoint with version information."""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "description": settings.DESCRIPTION,
        "docs_url": "/docs" if settings.DEBUG else "Contact administrator",
        "environment": settings.ENVIRONMENT,
    }


# Include API routers
app.include_router(
    auth.router,
    prefix=f"{settings.API_V1_PREFIX}/auth",
    tags=["Authentication"],
)

app.include_router(
    bookings.router,
    prefix=f"{settings.API_V1_PREFIX}/bookings",
    tags=["Bookings"],
)

app.include_router(
    users.router,
    prefix=f"{settings.API_V1_PREFIX}/users",
    tags=["Users"],
)

# Consolidated availability management
app.include_router(
    availability.router,
    prefix=f"{settings.API_V1_PREFIX}/availability",
    tags=["Availability Management"],
)

# Standardized calendar management
app.include_router(
    calendar.router,
    prefix=f"{settings.API_V1_PREFIX}/calendar",
    tags=["Calendar Management"],
)

app.include_router(
    bookings_advanced.router,
    prefix=f"{settings.API_V1_PREFIX}/bookings-advanced",
    tags=["Advanced Bookings"],
)

app.include_router(
    users_management.router,
    prefix=f"{settings.API_V1_PREFIX}/admin/users",
    tags=["User Management"],
)

app.include_router(
    payments_mollie.router,
    prefix=f"{settings.API_V1_PREFIX}/payments",
    tags=["Mollie Payments"],
)

app.include_router(
    websocket_calendar.router,
    prefix=f"{settings.API_V1_PREFIX}/ws",
    tags=["WebSocket"],
)

app.include_router(
    monitoring.router,
    prefix=f"{settings.API_V1_PREFIX}/monitoring",
    tags=["Monitoring"],
)

# Rate-limited endpoints
@app.get(f"{settings.API_V1_PREFIX}/test/rate-limit")
@limiter.limit("5/minute")
async def test_rate_limit(request: Request):
    """Test endpoint for rate limiting."""
    _ = request  # Access parameter so SlowAPI can inspect it and appease linters.
    return {"message": "Rate limit test successful", "timestamp": time.time()}


# WebSocket endpoint placeholder
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    # This will be implemented in the WebSocket module
    await websocket.accept()
    await websocket.send_json({"message": "WebSocket connected"})
    await websocket.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True,
    )
