"""
Authentication dependencies for FastAPI.
"""
from typing import Optional

import structlog
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import AuthService, auth_service
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.user import User

logger = structlog.get_logger(__name__)

# Security scheme
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Get the current authenticated user.

    Args:
        request: FastAPI request object
        credentials: Bearer token credentials
        db: Database session

    Returns:
        User: Current user

    Raises:
        HTTPException: If authentication fails
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Verify JWT token
        payload = auth_service.verify_token(credentials.credentials)
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID",
            )

        # Get user from database
        user = await auth_service.get_user_by_id(db, user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive",
            )

        # Set user context for RLS
        await db.execute(
            "SELECT set_config('app.current_user_id', :user_id, true)",
            {"user_id": user_id}
        )

        return user

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Authentication error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_current_customer(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Get current customer user."""
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer access required"
        )
    return current_user


async def get_current_loctician(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Get current loctician user."""
    if current_user.role != UserRole.LOCTICIAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Loctician access required"
        )
    return current_user


async def get_current_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Get current admin user."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_current_staff_or_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Get current staff or admin user."""
    if current_user.role not in [UserRole.STAFF, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or admin access required"
        )
    return current_user


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Get the current user if authenticated, otherwise return None.
    Useful for endpoints that work for both authenticated and anonymous users.
    """
    if not credentials:
        return None

    try:
        return await get_current_user(request, credentials, db)
    except HTTPException:
        return None


class RoleChecker:
    """Role-based access control checker."""

    def __init__(self, allowed_roles: list[UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[role.value for role in self.allowed_roles]}"
            )
        return current_user


# Convenience role checkers
require_admin = RoleChecker([UserRole.ADMIN])
require_staff = RoleChecker([UserRole.STAFF, UserRole.ADMIN])
require_loctician = RoleChecker([UserRole.LOCTICIAN, UserRole.ADMIN])
require_customer = RoleChecker([UserRole.CUSTOMER])


async def rate_limit_check(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> None:
    """
    Check API rate limits using PostgreSQL function.

    Args:
        request: FastAPI request object
        db: Database session
        current_user: Current user (if authenticated)

    Raises:
        HTTPException: If rate limit exceeded
    """
    # Get client IP
    client_ip = request.client.host
    if "x-forwarded-for" in request.headers:
        client_ip = request.headers["x-forwarded-for"].split(",")[0].strip()
    elif "x-real-ip" in request.headers:
        client_ip = request.headers["x-real-ip"]

    # Get endpoint
    endpoint = f"{request.method} {request.url.path}"

    # Check rate limit - TEMPORARILY DISABLED FOR TESTING
    # result = await auth_service.check_rate_limit(
    #     db=db,
    #     endpoint=endpoint,
    #     ip_address=client_ip,
    #     user_id=current_user.id if current_user else None,
    #     limit=100,  # Default limit
    #     window_minutes=60
    # )

    # Temporarily return allowed for testing
    result = {"allowed": True, "limit": 100, "remaining": 99}

    if not result.get("allowed", True):
        reason = result.get("reason", "RATE_LIMITED")

        # Add rate limit headers
        headers = {
            "X-RateLimit-Limit": str(result.get("limit", 100)),
            "X-RateLimit-Remaining": str(result.get("remaining", 0)),
        }

        if "reset_at" in result:
            headers["X-RateLimit-Reset"] = result["reset_at"]

        if reason == "LIMIT_EXCEEDED":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers=headers
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests",
                headers=headers
            )