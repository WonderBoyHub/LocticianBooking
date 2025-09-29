"""Media library endpoints."""
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_admin
from app.core.database import get_db
from app.models.media import MediaFile
from app.models.user import User
from app.schemas.media import (
    MediaFileAdmin,
    MediaFileList,
    MediaFilePublic,
    MediaFilePublicList,
    MediaFileUpdate,
)
from app.services.media_service import media_service

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.get("/featured", response_model=MediaFilePublicList)
async def list_featured_media(
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
) -> MediaFilePublicList:
    """Return featured media for public display."""

    result = await db.execute(
        select(MediaFile)
        .where(MediaFile.is_published.is_(True), MediaFile.is_featured.is_(True))
        .order_by(MediaFile.display_order.asc(), MediaFile.published_at.desc())
        .limit(limit)
    )
    media_items = result.scalars().all()

    return MediaFilePublicList(
        data=[MediaFilePublic.model_validate(item, from_attributes=True) for item in media_items]
    )


@router.get("/", response_model=MediaFileList)
async def list_media_admin(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> MediaFileList:
    """List media for administrators."""

    result = await db.execute(
        select(MediaFile)
        .options(selectinload(MediaFile.uploader))
        .order_by(MediaFile.uploaded_at.desc())
    )
    media_items = result.scalars().all()

    return MediaFileList(
        data=[MediaFileAdmin.model_validate(item, from_attributes=True) for item in media_items]
    )


@router.post("/upload", response_model=MediaFileAdmin, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile = File(...),
    alt_text: Optional[str] = None,
    caption: Optional[str] = None,
    is_featured: bool = False,
    display_order: int = 0,
    is_published: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
) -> MediaFileAdmin:
    """Upload a new media file."""

    media = await media_service.save_upload(
        db,
        file,
        user_id=current_user.id,
        alt_text=alt_text,
        caption=caption,
        is_featured=is_featured,
        display_order=display_order,
        is_published=is_published,
    )

    return MediaFileAdmin.model_validate(media, from_attributes=True)


@router.put("/{media_id}", response_model=MediaFileAdmin)
async def update_media(
    media_id: str,
    payload: MediaFileUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> MediaFileAdmin:
    """Update metadata for a media file."""

    result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media = result.scalar_one_or_none()

    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    media = await media_service.update_media(
        db,
        media,
        alt_text=payload.alt_text,
        caption=payload.caption,
        is_featured=payload.is_featured,
        display_order=payload.display_order,
        is_published=payload.is_published,
    )

    return MediaFileAdmin.model_validate(media, from_attributes=True)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    media_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> None:
    """Delete a media file."""

    result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media = result.scalar_one_or_none()

    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    await media_service.delete_media(db, media)

    return None
