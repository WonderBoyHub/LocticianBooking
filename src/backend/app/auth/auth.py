"""Authentication utilities and JWT handling."""
import json
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union

import structlog
from fastapi import HTTPException, status
from jose import JWTError, jwk, jwt
from jose.exceptions import JWTClaimsError, JWKError
from passlib.context import CryptContext
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwks import JWKSClient, JWKSClientError
from app.core.config import settings
from app.models.user import User
from app.models.enums import UserRole, UserStatus

logger = structlog.get_logger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Optional JWKS client (for Neon RLS integration)
jwks_client: Optional[JWKSClient] = None
if settings.JWT_JWKS_URL:
    try:
        jwks_client = JWKSClient(
            settings.JWT_JWKS_URL,
            cache_ttl_seconds=settings.JWT_JWKS_CACHE_SECONDS,
        )
        logger.info("JWKS client configured", jwks_url=settings.JWT_JWKS_URL)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Failed to initialise JWKS client", error=str(exc))
        jwks_client = None


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
        """Verify and decode a JWT token."""
        if jwks_client:
            try:
                header = jwt.get_unverified_header(token)
                algorithm = header.get("alg")
            except JWTError:
                algorithm = None

            if algorithm in (settings.JWT_ALLOWED_ALGORITHMS or []):
                return AuthService._verify_with_jwks(token, token_type)

        return AuthService._verify_with_secret(token, token_type)

    @staticmethod
    def _verify_with_secret(token: str, token_type: str) -> Dict[str, Any]:
        """Verify a symmetric JWT signed with the local secret key."""
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )

            token_claim_type = payload.get("type")
            if token_claim_type is not None and token_claim_type != token_type:
                raise AuthenticationError("Invalid token type")

            return payload

        except JWTError as exc:
            logger.warning("JWT verification failed", error=str(exc))
            raise AuthenticationError("Invalid token") from exc

    @staticmethod
    def _verify_with_jwks(token: str, token_type: str) -> Dict[str, Any]:
        """Verify a JWT using the configured JWKS endpoint."""
        if jwks_client is None:
            raise AuthenticationError("JWKS client is not configured")

        try:
            header = jwt.get_unverified_header(token)
        except JWTError as exc:
            logger.warning("Unable to parse JWT header", error=str(exc))
            raise AuthenticationError("Invalid token") from exc

        kid = header.get("kid")
        algorithm = header.get("alg")

        allowed_algorithms = settings.JWT_ALLOWED_ALGORITHMS or []
        if not algorithm:
            if len(allowed_algorithms) == 1:
                algorithm = allowed_algorithms[0]
            else:
                logger.warning("JWT missing alg header and multiple algorithms configured")
                raise AuthenticationError("Unsupported token algorithm")

        if allowed_algorithms and algorithm not in allowed_algorithms:
            logger.warning("JWT signed with unsupported algorithm", algorithm=algorithm)
            raise AuthenticationError("Unsupported token algorithm")

        try:
            key_data = jwks_client.get_signing_key(kid)
        except JWKSClientError as exc:
            logger.error("Unable to fetch signing key from JWKS", error=str(exc))
            raise AuthenticationError("Invalid token") from exc

        try:
            public_key = jwk.construct(key_data, algorithm=algorithm)
            pem_key = public_key.to_pem().decode("utf-8")
        except (JWKError, ValueError) as exc:
            logger.error("Failed to construct public key from JWKS", error=str(exc))
            raise AuthenticationError("Invalid token") from exc

        audience = settings.JWT_AUDIENCE
        issuer = settings.JWT_ISSUER

        try:
            payload = jwt.decode(
                token,
                pem_key,
                algorithms=[algorithm],
                audience=audience if audience else None,
                issuer=issuer if issuer else None,
                options={"verify_aud": bool(audience)},
            )
        except JWTClaimsError as exc:
            logger.warning("JWT claims validation failed", error=str(exc))
            raise AuthenticationError("Invalid token claims") from exc
        except JWTError as exc:
            logger.warning("JWT verification failed", error=str(exc))
            raise AuthenticationError("Invalid token") from exc

        token_claim_type = payload.get("type")
        if token_type and token_claim_type is not None and token_claim_type != token_type:
            raise AuthenticationError("Invalid token type")

        return payload

    @staticmethod
    def _normalise_auth_result(value: Any) -> Optional[Dict[str, Any]]:
        """Convert authentication results from SQL into dictionaries."""

        if value is None:
            return None

        if isinstance(value, dict):
            return value

        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                return {"success": False, "error": value}

        return None

    @staticmethod
    def _should_use_fallback(auth_result: Optional[Dict[str, Any]]) -> bool:
        """Decide whether to use application-side authentication logic."""

        if not auth_result:
            return True

        success = auth_result.get("success")
        if success is None:
            return True

        if success is True:
            return not {"user_id", "role"}.issubset(auth_result.keys())

        error_value = str(auth_result.get("error", "")).upper()
        if "INVALID_CREDENTIAL" in error_value or "ACCOUNT_LOCKED" in error_value:
            return False

        if "SYSTEM" in error_value or "FUNCTION" in error_value or "DATABASE" in error_value:
            return True

        message_value = str(auth_result.get("message", "")).upper()
        return "SYSTEM" in message_value or "FUNCTION" in message_value

    @staticmethod
    def _build_auth_payload(user: User) -> Dict[str, Any]:
        """Create a consistent payload structure from a user model."""

        role_value = user.role.value if isinstance(user.role, UserRole) else user.role
        return {
            "success": True,
            "user_id": str(user.id),
            "email": user.email,
            "role": role_value,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_verified": bool(getattr(user, "email_verified", False)),
        }

    @staticmethod
    async def _authenticate_user_application(
        db: AsyncSession,
        *,
        email: str,
        password: str,
        ip_address: str,
        user_agent: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fallback authenticator that validates credentials against the users table."""

        normalised_email = email.strip().lower()

        result = await db.execute(
            select(User).where(func.lower(User.email) == normalised_email)
        )
        user: Optional[User] = result.scalar_one_or_none()

        if not user or user.status != UserStatus.ACTIVE:
            logger.info(
                "Fallback authentication failed - missing or inactive user",
                email=email,
                ip_address=ip_address,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if not AuthService.verify_password(password, user.password_hash):
            logger.info(
                "Fallback authentication failed - password mismatch",
                email=email,
                ip_address=ip_address,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(last_login_at=datetime.utcnow())
        )
        await db.flush()

        logger.info(
            "User authenticated via fallback",
            user_id=str(user.id),
            email=email,
        )

        return AuthService._build_auth_payload(user)

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

            auth_result = AuthService._normalise_auth_result(result.scalar())

            if AuthService._should_use_fallback(auth_result):
                logger.warning(
                    "Falling back to application authentication",
                    email=email,
                    ip_address=ip_address
                )
                return await AuthService._authenticate_user_application(
                    db,
                    email=email,
                    password=password,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )

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

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                "Database authentication error",
                error=str(e),
                email=email
            )
            return await AuthService._authenticate_user_application(
                db,
                email=email,
                password=password,
                ip_address=ip_address,
                user_agent=user_agent,
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
        user_dict = dict(user_data._mapping)
        for column, value in user_dict.items():
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
        """Create a new user in the database and return the user ID.

        The production database has evolved several times and some environments
        may still be on an older schema (for example without the inline role or
        GDPR columns).  A raw INSERT that assumes the newest schema would fail
        in those cases which results in a 500 error on registration.  To make
        the registration endpoint resilient we discover the available columns at
        runtime and only insert into the ones that actually exist, falling back
        to the legacy role mapping when necessary.
        """
        try:
            password_hash = AuthService.get_password_hash(password)

            # Discover available columns in the users table.  This allows the
            # service to work with both the legacy and the current schemas.
            columns_result = await db.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'users'
                      AND table_schema = current_schema()
                    """
                )
            )
            available_columns = {row[0] for row in columns_result}

            if not available_columns:
                raise RuntimeError("Users table is not available in the current schema")

            column_values: Dict[str, Any] = {
                "email": email,
                "password_hash": password_hash,
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone,
                "role": role.value,
                "status": UserStatus.ACTIVE.value,
                "email_verified": email_verified,
                "marketing_consent": marketing_consent,
                "gdpr_consent_date": datetime.utcnow(),
                "gdpr_consent_version": "1.0",
                "country": "DK",
                "preferred_language": "da",
                "timezone": "Europe/Copenhagen",
            }

            insert_columns = [col for col in column_values if col in available_columns]

            if "email" not in insert_columns or "password_hash" not in insert_columns:
                raise RuntimeError("Required columns missing from users table")

            insert_sql = ", ".join(insert_columns)
            values_sql = ", ".join(f":{col}" for col in insert_columns)

            result = await db.execute(
                text(
                    f"""
                    INSERT INTO users ({insert_sql})
                    VALUES ({values_sql})
                    RETURNING id
                    """
                ),
                {col: column_values[col] for col in insert_columns},
            )

            user_id = result.scalar()

            # If the legacy schema is in use (no inline role column), fall back
            # to the user_roles mapping table so the account receives a role.
            if "role" not in available_columns:
                role_id_result = await db.execute(
                    text(
                        "SELECT id FROM roles WHERE name = :role_name AND is_active = TRUE LIMIT 1"
                    ),
                    {"role_name": role.value},
                )
                role_id = role_id_result.scalar()
                if role_id is not None:
                    await db.execute(
                        text(
                            """
                            INSERT INTO user_roles (user_id, role_id, is_active)
                            VALUES (:user_id, :role_id, TRUE)
                            ON CONFLICT (user_id, role_id) DO UPDATE
                            SET is_active = EXCLUDED.is_active,
                                assigned_at = CURRENT_TIMESTAMP
                            """
                        ),
                        {"user_id": user_id, "role_id": role_id},
                    )
                else:
                    logger.warning(
                        "Role lookup failed during user creation", role=role.value
                    )

            await db.commit()

            logger.info(
                "User created successfully",
                user_id=user_id,
                email=email,
                role=role.value,
            )

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