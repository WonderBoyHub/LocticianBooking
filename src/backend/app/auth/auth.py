"""
Authentication utilities and JWT handling.
"""
import json
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union

import structlog
from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.models.enums import UserRole, UserStatus

logger = structlog.get_logger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthenticationError(HTTPException):
    """Custom authentication error."""

    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class AuthService:
    """Authentication service integrating with PostgreSQL security functions."""

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a password."""
        return pwd_context.hash(password)

    @staticmethod
    def create_access_token(
        data: Dict[str, Any], expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create JWT access token."""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )

        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        })

        encoded_jwt = jwt.encode(
            to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
        )
        return encoded_jwt

    @staticmethod
    def create_refresh_token(data: Dict[str, Any]) -> str:
        """Create JWT refresh token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh"
        })

        encoded_jwt = jwt.encode(
            to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
        )
        return encoded_jwt

    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> Dict[str, Any]:
        """Verify and decode JWT token."""
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )

            if payload.get("type") != token_type:
                raise AuthenticationError("Invalid token type")

            return payload

        except JWTError as e:
            logger.warning("JWT verification failed", error=str(e))
            raise AuthenticationError("Invalid token")

    @staticmethod
    async def authenticate_user_db(
        db: AsyncSession,
        email: str,
        password: str,
        ip_address: str,
        user_agent: str = None
    ) -> Dict[str, Any]:
        """Authenticate user using PostgreSQL security functions."""
        try:
            # Call the PostgreSQL authenticate_user function
            query = text(
                "SELECT authenticate_user(:email, :password, :ip_address, :user_agent)"
            )

            result = await db.execute(
                query,
                {
                    "email": email,
                    "password": password,
                    "ip_address": ip_address,
                    "user_agent": user_agent,
                }
            )

            auth_result = result.scalar()

            if isinstance(auth_result, str):
                auth_result = json.loads(auth_result)

            if not auth_result.get("success"):
                error_code = auth_result.get("error", "AUTHENTICATION_FAILED")
                error_message = auth_result.get("message", "Authentication failed")

                logger.warning(
                    "Authentication failed",
                    email=email,
                    error=error_code,
                    ip_address=ip_address
                )

                # Map database errors to HTTP status codes
                if error_code == "ACCOUNT_LOCKED":
                    raise HTTPException(
                        status_code=status.HTTP_423_LOCKED,
                        detail=error_message
                    )
                elif error_code == "INVALID_CREDENTIALS":
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=error_message
                    )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Authentication system error"
                    )

            logger.info(
                "User authenticated successfully",
                user_id=auth_result.get("user_id"),
                email=email
            )

            return auth_result

        except Exception as e:
            logger.error(
                "Database authentication error",
                error=str(e),
                email=email
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication system error"
            )

    @staticmethod
    async def validate_session_db(
        db: AsyncSession, session_token: str
    ) -> Dict[str, Any]:
        """Validate session using PostgreSQL function."""
        try:
            query = text("SELECT validate_session(:session_token)")

            result = await db.execute(
                query, {"session_token": session_token}
            )

            session_result = result.scalar()

            if isinstance(session_result, str):
                session_result = json.loads(session_result)

            if not session_result.get("valid"):
                raise AuthenticationError("Invalid or expired session")

            return session_result

        except Exception as e:
            logger.error("Session validation error", error=str(e))
            raise AuthenticationError("Session validation failed")

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
        """Get user by ID."""
        query = text(
            "SELECT * FROM users WHERE id = :user_id AND status = 'active' AND deleted_at IS NULL"
        )

        result = await db.execute(query, {"user_id": user_id})
        user_data = result.fetchone()

        if not user_data:
            return None

        # Convert row to User object (simplified)
        user = User()
        for column, value in user_data._mapping.items():
            setattr(user, column, value)

        return user

    @staticmethod
    async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
        """Get user by email."""
        query = text(
            "SELECT * FROM users WHERE email = :email AND status = 'active' AND deleted_at IS NULL"
        )

        result = await db.execute(query, {"email": email})
        user_data = result.fetchone()

        if not user_data:
            return None

        # Convert row to User object (simplified)
        user = User()
        for column, value in user_data._mapping.items():
            setattr(user, column, value)

        return user

    @staticmethod
    async def check_rate_limit(
        db: AsyncSession,
        endpoint: str,
        ip_address: str,
        user_id: Optional[str] = None,
        limit: int = 100,
        window_minutes: int = 60
    ) -> Dict[str, Any]:
        """Check API rate limit using PostgreSQL function."""
        try:
            query = text(
                "SELECT check_rate_limit(:endpoint, :ip_address, :user_id, :limit, :window_minutes)"
            )

            result = await db.execute(
                query,
                {
                    "endpoint": endpoint,
                    "ip_address": ip_address,
                    "user_id": user_id,
                    "limit": limit,
                    "window_minutes": window_minutes,
                }
            )

            rate_limit_result = result.scalar()

            if isinstance(rate_limit_result, str):
                rate_limit_result = json.loads(rate_limit_result)

            return rate_limit_result

        except Exception as e:
            logger.error("Rate limit check error", error=str(e))
            # Allow request if rate limit check fails
            return {"allowed": True}

    @staticmethod
    async def create_user_db(
        db: AsyncSession,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        role: UserRole = UserRole.CUSTOMER,
        phone: Optional[str] = None,
        marketing_consent: bool = False,
        email_verified: bool = False
    ) -> str:
        """Create a new user in the database and return user ID."""
        try:
            password_hash = AuthService.get_password_hash(password)

            query = text("""
                INSERT INTO users (
                    email, password_hash, first_name, last_name, phone, role,
                    email_verified, marketing_consent, gdpr_consent_date,
                    gdpr_consent_version, country, preferred_language, timezone, status
                )
                VALUES (
                    :email, :password_hash, :first_name, :last_name, :phone, :role,
                    :email_verified, :marketing_consent, NOW(), '1.0',
                    'DK', 'da', 'Europe/Copenhagen', 'active'
                )
                RETURNING id
            """)

            result = await db.execute(
                query,
                {
                    "email": email,
                    "password_hash": password_hash,
                    "first_name": first_name,
                    "last_name": last_name,
                    "phone": phone,
                    "role": role.value,
                    "email_verified": email_verified,
                    "marketing_consent": marketing_consent,
                }
            )

            user_id = result.scalar()
            await db.commit()

            logger.info("User created successfully", user_id=user_id, email=email, role=role.value)

            return user_id

        except Exception as e:
            await db.rollback()
            logger.error("Create user error", error=str(e), email=email)
            raise e

    @staticmethod
    async def is_email_available(db: AsyncSession, email: str) -> bool:
        """Check if email is available for registration."""
        try:
            query = text(
                "SELECT 1 FROM users WHERE email = :email AND deleted_at IS NULL LIMIT 1"
            )
            result = await db.execute(query, {"email": email})
            return result.fetchone() is None
        except Exception as e:
            logger.error("Email availability check error", error=str(e), email=email)
            return False


# Create auth service instance
auth_service = AuthService()