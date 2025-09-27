"""
Users management API endpoints for admin operations.
"""
from datetime import datetime
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_admin, get_current_staff_or_admin, get_current_user
from app.core.database import get_db
from app.models.enums import UserRole, UserStatus
from app.models.user import User
from app.schemas.user import User as UserSchema, UserSummary, UserUpdate

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.get("/", response_model=List[UserSummary])
async def get_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_staff_or_admin),
    skip: int = Query(0, ge=0, description="Number of users to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of users to return"),
    role: Optional[UserRole] = Query(None, description="Filter by user role"),
    status: Optional[UserStatus] = Query(None, description="Filter by user status"),
    search: Optional[str] = Query(None, description="Search by name or email"),
) -> List[UserSummary]:
    """
    Get all users with optional filtering and pagination.
    Requires staff or admin role.
    """
    try:
        # Build base query
        query_conditions = ["deleted_at IS NULL"]
        query_params = {"skip": skip, "limit": limit}

        # Add role filter
        if role:
            query_conditions.append("role = :role")
            query_params["role"] = role.value

        # Add status filter
        if status:
            query_conditions.append("status = :status")
            query_params["status"] = status.value

        # Add search filter
        if search:
            query_conditions.append(
                "(LOWER(first_name || ' ' || last_name) LIKE LOWER(:search) OR LOWER(email) LIKE LOWER(:search))"
            )
            query_params["search"] = f"%{search}%"

        # Construct full query
        where_clause = " AND ".join(query_conditions)
        query = f"""
            SELECT id, email, first_name, last_name, role, status,
                   email_verified, last_login_at
            FROM users
            WHERE {where_clause}
            ORDER BY created_at DESC
            OFFSET :skip LIMIT :limit
        """

        result = await db.execute(text(query), query_params)
        rows = result.fetchall()

        users = []
        for row in rows:
            user_dict = dict(row._mapping)
            users.append(UserSummary(**user_dict))

        logger.info(
            "Users retrieved",
            count=len(users),
            admin_id=current_user.id,
            filters={"role": role, "status": status, "search": search}
        )

        return users

    except Exception as e:
        logger.error("Get users error", error=str(e), admin_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )


@router.get("/{user_id}", response_model=UserSchema)
async def get_user_by_id(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_staff_or_admin),
) -> UserSchema:
    """
    Get a specific user by ID.
    Requires staff or admin role.
    """
    try:
        # Query user with profile
        query = text("""
            SELECT u.*, up.bio, up.profile_image_url, up.instagram_handle,
                   up.website_url, up.specializations, up.years_experience,
                   up.certifications, up.business_hours, up.hair_type,
                   up.hair_length, up.allergies, up.notes,
                   up.created_at as profile_created_at, up.updated_at as profile_updated_at
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.id = :user_id AND u.deleted_at IS NULL
        """)

        result = await db.execute(query, {"user_id": user_id})
        row = result.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Convert to UserSchema
        user_data = dict(row._mapping)

        # Handle profile data if present
        if user_data.get('bio') is not None:
            profile_data = {
                "user_id": user_id,
                "bio": user_data.pop('bio'),
                "profile_image_url": user_data.pop('profile_image_url'),
                "instagram_handle": user_data.pop('instagram_handle'),
                "website_url": user_data.pop('website_url'),
                "specializations": user_data.pop('specializations'),
                "years_experience": user_data.pop('years_experience'),
                "certifications": user_data.pop('certifications'),
                "business_hours": user_data.pop('business_hours'),
                "hair_type": user_data.pop('hair_type'),
                "hair_length": user_data.pop('hair_length'),
                "allergies": user_data.pop('allergies'),
                "notes": user_data.pop('notes'),
                "created_at": user_data.pop('profile_created_at'),
                "updated_at": user_data.pop('profile_updated_at'),
            }
            user_data['profile'] = profile_data
        else:
            # Remove profile fields that are None
            profile_fields = ['bio', 'profile_image_url', 'instagram_handle', 'website_url',
                            'specializations', 'years_experience', 'certifications', 'business_hours',
                            'hair_type', 'hair_length', 'allergies', 'notes', 'profile_created_at',
                            'profile_updated_at']
            for field in profile_fields:
                user_data.pop(field, None)

        user = UserSchema(**user_data)

        logger.info(
            "User retrieved",
            user_id=user_id,
            admin_id=current_user.id
        )

        return user

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get user error", error=str(e), user_id=user_id, admin_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user"
        )


@router.put("/{user_id}", response_model=UserSchema)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
) -> UserSchema:
    """
    Update a user's basic information.
    Requires admin role.
    """
    try:
        # Check if user exists
        user_check = await db.execute(
            text("SELECT id FROM users WHERE id = :user_id AND deleted_at IS NULL"),
            {"user_id": user_id}
        )
        if not user_check.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Build update query dynamically
        update_fields = []
        update_params = {"user_id": user_id}

        for field, value in user_update.dict(exclude_unset=True).items():
            if value is not None:
                update_fields.append(f"{field} = :{field}")
                update_params[field] = value

        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        # Add updated_at
        update_fields.append("updated_at = NOW()")

        update_query = f"""
            UPDATE users
            SET {', '.join(update_fields)}
            WHERE id = :user_id
        """

        await db.execute(text(update_query), update_params)
        await db.commit()

        # Return updated user
        updated_user = await get_user_by_id(user_id, db, current_user)

        logger.info(
            "User updated",
            user_id=user_id,
            admin_id=current_user.id,
            updated_fields=list(user_update.dict(exclude_unset=True).keys())
        )

        return updated_user

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Update user error", error=str(e), user_id=user_id, admin_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )


@router.patch("/{user_id}/role", response_model=UserSchema)
async def update_user_role(
    user_id: str,
    new_role: UserRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
) -> UserSchema:
    """
    Update a user's role.
    Requires admin role.
    """
    try:
        # Check if user exists and is not the current admin
        user_check = await db.execute(
            text("SELECT id, role FROM users WHERE id = :user_id AND deleted_at IS NULL"),
            {"user_id": user_id}
        )
        user_row = user_check.fetchone()

        if not user_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Prevent admin from changing their own role
        if user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change your own role"
            )

        current_role = user_row._mapping['role']

        # Update role
        await db.execute(
            text("UPDATE users SET role = :new_role, updated_at = NOW() WHERE id = :user_id"),
            {"new_role": new_role.value, "user_id": user_id}
        )
        await db.commit()

        # Return updated user
        updated_user = await get_user_by_id(user_id, db, current_user)

        logger.info(
            "User role updated",
            user_id=user_id,
            admin_id=current_user.id,
            old_role=current_role,
            new_role=new_role.value
        )

        return updated_user

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Update user role error", error=str(e), user_id=user_id, admin_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user role"
        )


@router.patch("/{user_id}/status", response_model=UserSchema)
async def update_user_status(
    user_id: str,
    new_status: UserStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
) -> UserSchema:
    """
    Update a user's status (active, inactive, suspended).
    Requires admin role.
    """
    try:
        # Check if user exists and is not the current admin
        user_check = await db.execute(
            text("SELECT id, status FROM users WHERE id = :user_id AND deleted_at IS NULL"),
            {"user_id": user_id}
        )
        user_row = user_check.fetchone()

        if not user_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Prevent admin from changing their own status to inactive/suspended
        if user_id == current_user.id and new_status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate or suspend your own account"
            )

        current_status = user_row._mapping['status']

        # Update status
        await db.execute(
            text("UPDATE users SET status = :new_status, updated_at = NOW() WHERE id = :user_id"),
            {"new_status": new_status.value, "user_id": user_id}
        )

        # If suspending user, invalidate all their sessions
        if new_status in [UserStatus.SUSPENDED, UserStatus.INACTIVE]:
            await db.execute(
                text("UPDATE user_sessions SET is_active = FALSE WHERE user_id = :user_id"),
                {"user_id": user_id}
            )

        await db.commit()

        # Return updated user
        updated_user = await get_user_by_id(user_id, db, current_user)

        logger.info(
            "User status updated",
            user_id=user_id,
            admin_id=current_user.id,
            old_status=current_status,
            new_status=new_status.value
        )

        return updated_user

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Update user status error", error=str(e), user_id=user_id, admin_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user status"
        )


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
) -> dict:
    """
    Soft delete a user (GDPR compliant).
    Requires admin role.
    """
    try:
        # Check if user exists and is not the current admin
        user_check = await db.execute(
            text("SELECT id FROM users WHERE id = :user_id AND deleted_at IS NULL"),
            {"user_id": user_id}
        )

        if not user_check.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Prevent admin from deleting themselves
        if user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own account"
            )

        # Soft delete user
        await db.execute(
            text("""
                UPDATE users
                SET deleted_at = NOW(),
                    updated_at = NOW(),
                    status = 'deleted'
                WHERE id = :user_id
            """),
            {"user_id": user_id}
        )

        # Invalidate all user sessions
        await db.execute(
            text("UPDATE user_sessions SET is_active = FALSE WHERE user_id = :user_id"),
            {"user_id": user_id}
        )

        await db.commit()

        logger.info(
            "User deleted",
            user_id=user_id,
            admin_id=current_user.id
        )

        return {"message": "User deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Delete user error", error=str(e), user_id=user_id, admin_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )


@router.get("/stats/summary")
async def get_user_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_staff_or_admin),
) -> dict:
    """
    Get user statistics summary.
    Requires staff or admin role.
    """
    try:
        # Get user counts by role and status
        stats_query = text("""
            SELECT
                role,
                status,
                COUNT(*) as count,
                COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_count
            FROM users
            WHERE deleted_at IS NULL
            GROUP BY role, status
            ORDER BY role, status
        """)

        result = await db.execute(stats_query)
        rows = result.fetchall()

        # Process results
        stats = {
            "by_role": {},
            "by_status": {},
            "total_users": 0,
            "total_verified": 0
        }

        for row in rows:
            role = row._mapping['role']
            status_val = row._mapping['status']
            count = row._mapping['count']
            verified_count = row._mapping['verified_count']

            # By role
            if role not in stats["by_role"]:
                stats["by_role"][role] = {"total": 0, "verified": 0}
            stats["by_role"][role]["total"] += count
            stats["by_role"][role]["verified"] += verified_count

            # By status
            if status_val not in stats["by_status"]:
                stats["by_status"][status_val] = {"total": 0, "verified": 0}
            stats["by_status"][status_val]["total"] += count
            stats["by_status"][status_val]["verified"] += verified_count

            # Totals
            stats["total_users"] += count
            stats["total_verified"] += verified_count

        logger.info(
            "User stats retrieved",
            admin_id=current_user.id,
            total_users=stats["total_users"]
        )

        return stats

    except Exception as e:
        logger.error("Get user stats error", error=str(e), admin_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user statistics"
        )