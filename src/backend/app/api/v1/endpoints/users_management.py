"""
User Management API with comprehensive admin CRUD and role management.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

import structlog
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import and_, func, or_, select, text, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import (
    get_current_user,
    get_current_admin,
    require_admin,
    require_staff,
    rate_limit_check
)
from app.core.database import get_db
from app.models.enums import UserRole, UserStatus
from app.models.user import User, UserProfile
from app.schemas.user import (
    User as UserSchema,
    UserCreate,
    UserUpdate,
    UserWithProfile,
)

logger = structlog.get_logger(__name__)

router = APIRouter()


# Enhanced User Management Schemas
class UserCreateAdmin(UserCreate):
    """Admin user creation schema with role assignment."""
    role: UserRole = UserRole.CUSTOMER
    status: UserStatus = UserStatus.ACTIVE
    email_verified: bool = False


class UserUpdateAdmin(UserUpdate):
    """Admin user update schema with full control."""
    email: Optional[EmailStr] = Field(None, description="Updated email address")
    password: Optional[str] = Field(None, min_length=8, description="New password")
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    email_verified: Optional[bool] = None
    last_login_at: Optional[datetime] = None
    data_retention_until: Optional[datetime] = None

    @field_validator("password")
    def validate_password(cls, v: Optional[str]):
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserSummary(BaseModel):
    """User summary for listings."""
    id: str
    email: str
    full_name: str
    role: UserRole
    status: UserStatus
    email_verified: bool
    created_at: datetime
    last_login_at: Optional[datetime]
    total_bookings: int = 0
    total_revenue: Decimal = Decimal('0')

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: float(v)
        }


class UserStats(BaseModel):
    """User statistics."""
    total_users: int
    active_users: int
    customers: int
    locticians: int
    staff: int
    admins: int
    new_users_this_month: int
    verified_users: int


class RoleChangeRequest(BaseModel):
    """Role change request."""
    user_id: str
    new_role: UserRole
    reason: str


class BulkUserAction(BaseModel):
    """Bulk user action."""
    user_ids: List[str] = Field(..., min_length=1, max_length=100)
    action: str  # 'activate', 'deactivate', 'verify_email', 'delete'
    reason: Optional[str] = None


# User CRUD Operations (Admin Only)
@router.get("/", response_model=List[UserSummary])
async def list_users(
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    status: Optional[UserStatus] = Query(None, description="Filter by status"),
    email_verified: Optional[bool] = Query(None, description="Filter by email verification"),
    search: Optional[str] = Query(None, min_length=2, description="Search by name or email"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order"),
    limit: int = Query(100, le=1000, description="Limit results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[UserSummary]:
    """List users with advanced filtering and search (admin only)."""
    try:
        # Base query with booking statistics
        base_query = text("""
            SELECT
                u.id,
                u.email,
                CONCAT(u.first_name, ' ', u.last_name) as full_name,
                u.role,
                u.status,
                u.email_verified,
                u.created_at,
                u.last_login_at,
                COALESCE(booking_stats.total_bookings, 0) as total_bookings,
                COALESCE(booking_stats.total_revenue, 0) as total_revenue
            FROM users u
            LEFT JOIN (
                SELECT
                    customer_id,
                    COUNT(*) as total_bookings,
                    SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as total_revenue
                FROM bookings
                GROUP BY customer_id
            ) booking_stats ON u.id = booking_stats.customer_id
            WHERE u.is_deleted = false
        """)

        # Build dynamic WHERE clause
        conditions = []
        params = {}

        if role:
            conditions.append("u.role = :role")
            params["role"] = role.value

        if status:
            conditions.append("u.status = :status")
            params["status"] = status.value

        if email_verified is not None:
            conditions.append("u.email_verified = :email_verified")
            params["email_verified"] = email_verified

        if search:
            conditions.append("""
                (u.email ILIKE :search
                OR CONCAT(u.first_name, ' ', u.last_name) ILIKE :search
                OR u.first_name ILIKE :search
                OR u.last_name ILIKE :search)
            """)
            params["search"] = f"%{search}%"

        # Add conditions to query
        if conditions:
            where_clause = " AND " + " AND ".join(conditions)
            base_query = text(str(base_query) + where_clause)

        # Add sorting and pagination
        valid_sort_fields = ["created_at", "email", "full_name", "role", "status", "last_login_at"]
        if sort_by not in valid_sort_fields:
            sort_by = "created_at"

        order_clause = f" ORDER BY {sort_by} {sort_order.upper()}"
        limit_clause = f" LIMIT :limit OFFSET :offset"

        params.update({"limit": limit, "offset": offset})

        final_query = text(str(base_query) + order_clause + limit_clause)

        result = await db.execute(final_query, params)

        users = []
        for row in result.fetchall():
            users.append(UserSummary(
                id=row.id,
                email=row.email,
                full_name=row.full_name,
                role=UserRole(row.role),
                status=UserStatus(row.status),
                email_verified=row.email_verified,
                created_at=row.created_at,
                last_login_at=row.last_login_at,
                total_bookings=row.total_bookings,
                total_revenue=row.total_revenue
            ))

        return users

    except Exception as e:
        logger.error("List users error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list users"
        )


@router.post("/", response_model=UserWithProfile, status_code=status.HTTP_201_CREATED)
async def create_user_admin(
    user_data: UserCreateAdmin,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserWithProfile:
    """Create user with admin privileges."""
    try:
        # Check if email already exists
        existing_user = await db.execute(
            select(User).where(User.email == user_data.email)
        )
        if existing_user.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Hash password
        password_hash = bcrypt.hashpw(
            user_data.password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')

        # Create user
        user = User(
            email=user_data.email,
            password_hash=password_hash,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            role=user_data.role,
            status=user_data.status,
            email_verified=user_data.email_verified,
            street_address=user_data.street_address,
            city=user_data.city,
            postal_code=user_data.postal_code,
            country=user_data.country,
            preferred_language=user_data.preferred_language,
            timezone=user_data.timezone,
            marketing_consent=user_data.marketing_consent,
        )

        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Create empty profile
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        user.profile = profile
        await db.refresh(user)

        logger.info(
            "User created by admin",
            user_id=user.id,
            email=user.email,
            role=user.role,
            created_by=current_user.id
        )

        return UserWithProfile.model_validate(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create user admin error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )


@router.get("/{user_id}", response_model=UserWithProfile)
async def get_user_admin(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserWithProfile:
    """Get user details with profile (admin only)."""
    try:
        user_query = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.id == user_id)
        )
        user = user_query.scalar()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return UserWithProfile.model_validate(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get user admin error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user"
        )


@router.put("/{user_id}", response_model=UserWithProfile)
async def update_user_admin(
    user_id: str,
    user_data: UserUpdateAdmin,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserWithProfile:
    """Update user with admin privileges."""
    try:
        # Get existing user
        user_query = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.id == user_id)
        )
        user = user_query.scalar()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Check email uniqueness if updating email
        if user_data.email and user_data.email != user.email:
            existing_user = await db.execute(
                select(User).where(and_(User.email == user_data.email, User.id != user_id))
            )
            if existing_user.scalar():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already taken"
                )

        # Update user fields
        update_data = user_data.model_dump(exclude_unset=True)

        # Handle password update
        password_value = update_data.pop('password', None)
        if password_value:
            update_data['password_hash'] = bcrypt.hashpw(
                password_value.encode('utf-8'),
                bcrypt.gensalt()
            ).decode('utf-8')

        for field, value in update_data.items():
            setattr(user, field, value)

        await db.commit()
        await db.refresh(user)

        logger.info(
            "User updated by admin",
            user_id=user.id,
            updated_by=current_user.id,
            fields_updated=list(update_data.keys())
        )

        return UserWithProfile.model_validate(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Update user admin error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_admin(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete user (admin only)."""
    try:
        # Get user
        user_query = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_query.scalar()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Prevent self-deletion
        if user.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete yourself"
            )

        # Check for active bookings
        active_bookings = await db.execute(
            text("""
                SELECT COUNT(*)
                FROM bookings
                WHERE (customer_id = :user_id OR loctician_id = :user_id)
                AND status IN ('pending', 'confirmed', 'in_progress')
                AND appointment_start > NOW()
            """),
            {"user_id": user_id}
        )

        if active_bookings.scalar() > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete user with active bookings"
            )

        # Soft delete
        user.is_deleted = True
        user.status = UserStatus.DELETED
        user.data_retention_until = datetime.utcnow() + timedelta(days=365)  # 1 year retention

        await db.commit()

        logger.info(
            "User soft deleted",
            user_id=user.id,
            deleted_by=current_user.id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Delete user admin error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )


# Role Management
@router.post("/{user_id}/change-role", response_model=UserSchema)
async def change_user_role(
    user_id: str,
    role_change: RoleChangeRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserSchema:
    """Change user role (admin only)."""
    try:
        # Get user
        user_query = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_query.scalar()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Prevent self-role change to non-admin
        if user.id == current_user.id and role_change.new_role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove admin role from yourself"
            )

        old_role = user.role
        user.role = role_change.new_role

        await db.commit()
        await db.refresh(user)

        # Log role change
        await db.execute(
            text("""
                INSERT INTO role_changes (user_id, old_role, new_role, changed_by, reason, changed_at)
                VALUES (:user_id::uuid, :old_role, :new_role, :changed_by::uuid, :reason, NOW())
            """),
            {
                "user_id": user_id,
                "old_role": old_role.value,
                "new_role": role_change.new_role.value,
                "changed_by": current_user.id,
                "reason": role_change.reason
            }
        )

        await db.commit()

        logger.info(
            "User role changed",
            user_id=user.id,
            old_role=old_role,
            new_role=role_change.new_role,
            changed_by=current_user.id,
            reason=role_change.reason
        )

        return UserSchema.model_validate(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Change user role error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change user role"
        )


# Bulk Operations
@router.post("/bulk-action", response_model=dict)
async def bulk_user_action(
    bulk_action: BulkUserAction,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Perform bulk action on users (admin only)."""
    try:
        # Validate users exist
        user_query = await db.execute(
            select(User).where(User.id.in_(bulk_action.user_ids))
        )
        users = user_query.scalars().all()

        if len(users) != len(bulk_action.user_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Some users not found"
            )

        affected_count = 0

        if bulk_action.action == "activate":
            await db.execute(
                update(User)
                .where(User.id.in_(bulk_action.user_ids))
                .values(status=UserStatus.ACTIVE)
            )
            affected_count = len(bulk_action.user_ids)

        elif bulk_action.action == "deactivate":
            # Don't deactivate self
            user_ids_to_update = [uid for uid in bulk_action.user_ids if uid != current_user.id]
            if user_ids_to_update:
                await db.execute(
                    update(User)
                    .where(User.id.in_(user_ids_to_update))
                    .values(status=UserStatus.INACTIVE)
                )
            affected_count = len(user_ids_to_update)

        elif bulk_action.action == "verify_email":
            await db.execute(
                update(User)
                .where(User.id.in_(bulk_action.user_ids))
                .values(email_verified=True)
            )
            affected_count = len(bulk_action.user_ids)

        elif bulk_action.action == "delete":
            # Don't delete self
            user_ids_to_delete = [uid for uid in bulk_action.user_ids if uid != current_user.id]
            if user_ids_to_delete:
                await db.execute(
                    update(User)
                    .where(User.id.in_(user_ids_to_delete))
                    .values(
                        is_deleted=True,
                        status=UserStatus.DELETED,
                        data_retention_until=datetime.utcnow() + timedelta(days=365)
                    )
                )
            affected_count = len(user_ids_to_delete)

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid bulk action"
            )

        await db.commit()

        logger.info(
            "Bulk user action performed",
            action=bulk_action.action,
            affected_count=affected_count,
            performed_by=current_user.id,
            reason=bulk_action.reason
        )

        return {
            "success": True,
            "affected_count": affected_count,
            "action": bulk_action.action
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Bulk user action error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to perform bulk action"
        )


# User Statistics
@router.get("/statistics/overview", response_model=UserStats)
async def get_user_statistics(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserStats:
    """Get user statistics overview (admin only)."""
    try:
        stats_query = await db.execute(
            text("""
                SELECT
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
                    COUNT(CASE WHEN role = 'customer' THEN 1 END) as customers,
                    COUNT(CASE WHEN role = 'loctician' THEN 1 END) as locticians,
                    COUNT(CASE WHEN role = 'staff' THEN 1 END) as staff,
                    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
                    COUNT(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) THEN 1 END) as new_users_this_month,
                    COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_users
                FROM users
                WHERE is_deleted = false
            """)
        )

        stats = stats_query.first()

        return UserStats(
            total_users=stats.total_users,
            active_users=stats.active_users,
            customers=stats.customers,
            locticians=stats.locticians,
            staff=stats.staff,
            admins=stats.admins,
            new_users_this_month=stats.new_users_this_month,
            verified_users=stats.verified_users
        )

    except Exception as e:
        logger.error("Get user statistics error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user statistics"
        )
