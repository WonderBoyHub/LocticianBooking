"""API endpoints for Instagram content management."""
from typing import List

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_admin
from app.core.database import get_db
from app.models.instagram import InstagramPost
from app.models.user import User
from app.schemas.instagram import (
    InstagramPostAdmin,
    InstagramPostPublic,
    InstagramPostUpdate,
)

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.get("/posts", response_model=List[InstagramPostPublic])
async def list_featured_instagram_posts(
    limit: int = Query(9, ge=1, le=24, description="Maximum number of posts to return"),
    db: AsyncSession = Depends(get_db),
) -> List[InstagramPostPublic]:
    """Return featured Instagram posts ordered for the homepage feed."""
    try:
        query = (
            select(InstagramPost)
            .where(InstagramPost.is_featured.is_(True))
            .order_by(InstagramPost.display_order.asc(), InstagramPost.posted_at.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        posts = result.scalars().all()

        return [
            InstagramPostPublic.model_validate(post, from_attributes=True)
            for post in posts
        ]
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Fetch featured Instagram posts error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch Instagram posts",
        ) from exc


@router.get("/posts/admin", response_model=List[InstagramPostAdmin])
async def list_instagram_posts_admin(
    featured_only: bool = Query(
        False, description="Return only featured posts when true"
    ),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> List[InstagramPostAdmin]:
    """Return Instagram posts for CMS management."""
    try:
        query = select(InstagramPost)

        if featured_only:
            query = query.where(InstagramPost.is_featured.is_(True))

        query = query.order_by(
            InstagramPost.display_order.asc(), InstagramPost.posted_at.desc()
        )

        result = await db.execute(query)
        posts = result.scalars().all()

        return [
            InstagramPostAdmin.model_validate(post, from_attributes=True)
            for post in posts
        ]
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Fetch admin Instagram posts error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch Instagram posts",
        ) from exc


@router.put("/posts/{post_id}", response_model=InstagramPostAdmin)
async def update_instagram_post(
    post_id: str,
    update_data: InstagramPostUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> InstagramPostAdmin:
    """Update display settings for an Instagram post."""
    try:
        result = await db.execute(
            select(InstagramPost).where(InstagramPost.id == post_id)
        )
        post = result.scalar_one_or_none()

        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Instagram post not found",
            )

        changes = update_data.model_dump(exclude_unset=True)
        if not changes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update fields provided",
            )

        for field, value in changes.items():
            setattr(post, field, value)

        await db.commit()
        await db.refresh(post)

        logger.info(
            "Instagram post updated",
            post_id=post.id,
            updated_by=current_user.id,
            changes=list(changes.keys()),
        )

        return InstagramPostAdmin.model_validate(post, from_attributes=True)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Update Instagram post error", error=str(exc), post_id=post_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update Instagram post",
        ) from exc
