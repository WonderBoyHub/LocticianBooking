"""
Authentication API endpoints.
"""
from datetime import timedelta
from typing import Dict

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import auth_service
from app.auth.dependencies import get_current_user, rate_limit_check
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import (
    EmailVerificationRequest,
    LoginRequest,
    LoginResponse,
    PasswordChangeRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    RegisterRequest,
    RegisterResponse,
    TokenInfo,
)

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> LoginResponse:
    """
    Authenticate user and return JWT tokens.

    This endpoint uses the PostgreSQL security functions for authentication
    with built-in rate limiting and security checks.
    """
    # Get client IP and user agent
    client_ip = request.client.host
    if "x-forwarded-for" in request.headers:
        client_ip = request.headers["x-forwarded-for"].split(",")[0].strip()
    elif "x-real-ip" in request.headers:
        client_ip = request.headers["x-real-ip"]

    user_agent = request.headers.get("user-agent", "Unknown")

    try:
        # Authenticate using PostgreSQL function
        auth_result = await auth_service.authenticate_user_db(
            db=db,
            email=login_data.email,
            password=login_data.password,
            ip_address=client_ip,
            user_agent=user_agent,
        )

        # Create JWT tokens
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth_service.create_access_token(
            data={"sub": auth_result["user_id"], "role": auth_result["role"]},
            expires_delta=access_token_expires,
        )

        refresh_token = auth_service.create_refresh_token(
            data={"sub": auth_result["user_id"], "role": auth_result["role"]}
        )

        logger.info(
            "User logged in successfully",
            user_id=auth_result["user_id"],
            email=login_data.email,
            ip_address=client_ip,
        )

        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=auth_result["user_id"],
            role=auth_result["role"],
            email=login_data.email,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Login error", error=str(e), email=login_data.email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    registration_data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> RegisterResponse:
    """
    Register a new user with email verification.

    This endpoint creates a new user account and sends an email verification link.
    The user account will be created but email_verified will be False until verified.
    """
    # Get client IP for audit logging
    client_ip = request.client.host
    if "x-forwarded-for" in request.headers:
        client_ip = request.headers["x-forwarded-for"].split(",")[0].strip()
    elif "x-real-ip" in request.headers:
        client_ip = request.headers["x-real-ip"]

    try:
        # Check if email is available
        if not await auth_service.is_email_available(db, registration_data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )

        # Create user
        user_id = await auth_service.create_user_db(
            db=db,
            email=registration_data.email,
            password=registration_data.password,
            first_name=registration_data.first_name,
            last_name=registration_data.last_name,
            phone=registration_data.phone,
            role=registration_data.role,
            marketing_consent=registration_data.marketing_consent,
            email_verified=False
        )

        # Generate email verification token
        verification_token = auth_service.create_access_token(
            data={"sub": user_id, "type": "email_verification"},
            expires_delta=timedelta(hours=24)
        )

        # Queue verification email
        import json

        welcome_variables_dict = {
            "verification_token": verification_token,
            "user_name": registration_data.first_name
        }

        result = await db.execute(
            text("""
            INSERT INTO email_queue (
                template_id, to_email, to_name, from_email, from_name,
                subject, template_variables, user_id, status, scheduled_at, created_at
            )
            SELECT
                et.id, :email, :name, 'noreply@loctician.dk', 'Loctician',
                'Welcome - Please Verify Your Email',
                cast(:variables as jsonb), :user_id, 'queued'::emailstatus, NOW(), NOW()
            FROM email_templates et
            WHERE et.template_type = 'WELCOME'::templatetype AND et.is_active = TRUE
            LIMIT 1
            """),
            {
                "email": registration_data.email,
                "name": f"{registration_data.first_name} {registration_data.last_name}",
                "variables": json.dumps(welcome_variables_dict),
                "user_id": str(user_id)
            }
        )

        if getattr(result, "rowcount", 0) == 0:
            logger.warning(
                "Welcome email template not queued",
                reason="template_not_found",
                email=registration_data.email
            )

        await db.commit()

        logger.info(
            "User registered successfully",
            user_id=user_id,
            email=registration_data.email,
            role=registration_data.role.value,
            ip_address=client_ip
        )

        return RegisterResponse(
            user_id=user_id,
            email=registration_data.email,
            message="Registration successful. Please check your email to verify your account.",
            email_verification_required=True
        )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Registration error", error=str(e), email=registration_data.email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    _: None = Depends(rate_limit_check),
) -> RefreshTokenResponse:
    """
    Refresh access token using refresh token.
    """
    try:
        # Verify refresh token
        payload = auth_service.verify_token(refresh_data.refresh_token, "refresh")

        # Create new access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth_service.create_access_token(
            data={"sub": payload["sub"], "role": payload["role"]},
            expires_delta=access_token_expires,
        )

        return RefreshTokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    except Exception as e:
        logger.error("Token refresh error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """
    Logout user by invalidating session.
    """
    try:
        # Invalidate all user sessions in database
        await db.execute(
            "UPDATE user_sessions SET is_active = FALSE WHERE user_id = :user_id",
            {"user_id": current_user.id}
        )
        await db.commit()

        logger.info("User logged out", user_id=current_user.id)

        return {"message": "Successfully logged out"}

    except Exception as e:
        logger.error("Logout error", error=str(e), user_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """
    Change user password.
    """
    try:
        # Verify current password
        if not auth_service.verify_password(
            password_data.current_password, current_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )

        # Hash new password
        new_password_hash = auth_service.get_password_hash(password_data.new_password)

        # Update password in database
        await db.execute(
            "UPDATE users SET password_hash = :password_hash, updated_at = NOW() WHERE id = :user_id",
            {"password_hash": new_password_hash, "user_id": current_user.id}
        )

        # Invalidate all sessions except current one
        await db.execute(
            "UPDATE user_sessions SET is_active = FALSE WHERE user_id = :user_id",
            {"user_id": current_user.id}
        )

        await db.commit()

        logger.info("Password changed successfully", user_id=current_user.id)

        return {"message": "Password changed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Password change error", error=str(e), user_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )


@router.post("/request-password-reset", status_code=status.HTTP_200_OK)
async def request_password_reset(
    reset_data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> Dict[str, str]:
    """
    Request password reset email.
    """
    try:
        # Check if user exists
        user = await auth_service.get_user_by_email(db, reset_data.email)

        if user:
            # Generate reset token
            reset_token = auth_service.create_access_token(
                data={"sub": user.id, "type": "password_reset"},
                expires_delta=timedelta(hours=1)
            )

            # Queue password reset email
            user_full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email
            user_first_name = user.first_name or user.email.split('@')[0]

            import json
            from sqlalchemy import cast, type_coerce
            from sqlalchemy.dialects.postgresql import JSONB

            variables_dict = {"reset_token": reset_token, "user_name": user_first_name}

            result = await db.execute(
                text("""
                INSERT INTO email_queue (
                    template_id, to_email, to_name, from_email, from_name,
                    subject, template_variables, user_id, status, scheduled_at, created_at
                )
                SELECT
                    et.id, :email, :name, 'noreply@loctician.dk', 'Loctician',
                    'Password Reset Request',
                    cast(:variables as jsonb), :user_id, 'queued'::emailstatus, NOW(), NOW()
                FROM email_templates et
                WHERE et.template_type = 'PASSWORD_RESET'::templatetype AND et.is_active = TRUE
                LIMIT 1
                """),
                {
                    "email": user.email,
                    "name": user_full_name,
                    "variables": json.dumps(variables_dict),
                    "user_id": str(user.id)
                }
            )
            await db.commit()

            if getattr(result, "rowcount", 0) == 0:
                logger.warning(
                    "Password reset email template not queued",
                    reason="template_not_found",
                    email=reset_data.email
                )

            logger.info("Password reset requested", email=reset_data.email)

        # Always return success to prevent email enumeration
        return {"message": "If the email exists, a password reset link has been sent"}

    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error("Password reset request error", error=str(e), traceback=error_traceback)
        print(f"ERROR in password reset: {str(e)}")
        print(error_traceback)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password reset request failed: {str(e)}"
        )


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    reset_data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """
    Reset password using reset token.
    """
    try:
        # Verify reset token
        payload = auth_service.verify_token(reset_data.token)

        if payload.get("type") != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )

        # Hash new password
        new_password_hash = auth_service.get_password_hash(reset_data.new_password)

        # Update password
        await db.execute(
            "UPDATE users SET password_hash = :password_hash, updated_at = NOW() WHERE id = :user_id",
            {"password_hash": new_password_hash, "user_id": user_id}
        )

        # Invalidate all user sessions
        await db.execute(
            "UPDATE user_sessions SET is_active = FALSE WHERE user_id = :user_id",
            {"user_id": user_id}
        )

        await db.commit()

        logger.info("Password reset successfully", user_id=user_id)

        return {"message": "Password reset successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Password reset error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )


@router.post("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(
    verification_data: EmailVerificationRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """
    Verify email address using verification token.
    """
    try:
        # Verify token
        payload = auth_service.verify_token(verification_data.token)

        if payload.get("type") != "email_verification":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token"
            )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token"
            )

        # Update email verification status
        await db.execute(
            "UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = :user_id",
            {"user_id": user_id}
        )
        await db.commit()

        logger.info("Email verified successfully", user_id=user_id)

        return {"message": "Email verified successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Email verification error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )


@router.get("/me", response_model=TokenInfo)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> TokenInfo:
    """
    Get current user information from token.
    """
    return TokenInfo(
        token_type="access",
        user_id=current_user.id,
        role=current_user.role.value,
        issued_at=current_user.updated_at,
        expires_at=current_user.updated_at,  # This should be calculated from token
    )
