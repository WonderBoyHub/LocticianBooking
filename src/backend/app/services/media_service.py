"""Media library service helpers."""
from __future__ import annotations

import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.media import MediaFile


class MediaService:
    """Service responsible for handling media uploads and metadata updates."""

    def __init__(self) -> None:
        self.base_path = Path(settings.UPLOAD_PATH).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.allowed_extensions = {ext.lower() for ext in settings.ALLOWED_EXTENSIONS}
        self.max_file_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024

    async def save_upload(
        self,
        db: AsyncSession,
        upload: UploadFile,
        *,
        user_id: Optional[str],
        alt_text: Optional[str] = None,
        caption: Optional[str] = None,
        is_featured: bool = False,
        display_order: int = 0,
        is_published: bool = True,
    ) -> MediaFile:
        """Persist an uploaded file and create the corresponding database row."""

        original_filename = upload.filename or "untitled"
        extension = Path(original_filename).suffix.lower().lstrip(".")

        if not extension and upload.content_type:
            guessed = mimetypes.guess_extension(upload.content_type)
            if guessed:
                extension = guessed.lstrip(".")

        if not extension or extension not in self.allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File type is not allowed",
            )

        contents = await upload.read()
        if not contents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file was empty",
            )

        if len(contents) > self.max_file_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds the maximum size of {settings.MAX_FILE_SIZE_MB} MB",
            )

        unique_name = f"{uuid4().hex}.{extension}"
        destination = self.base_path / unique_name

        destination.write_bytes(contents)

        mime_type = upload.content_type or mimetypes.guess_type(original_filename)[0] or "application/octet-stream"

        media = MediaFile(
            filename=unique_name,
            original_filename=original_filename,
            file_path=unique_name,
            file_size=len(contents),
            mime_type=mime_type,
            alt_text=alt_text,
            caption=caption,
            uploaded_by=user_id,
            is_featured=is_featured,
            display_order=display_order,
            is_published=is_published,
            published_at=datetime.now(timezone.utc),
            uploaded_at=datetime.now(timezone.utc),
        )

        db.add(media)
        await db.commit()
        await db.refresh(media)

        return media

    async def update_media(
        self,
        db: AsyncSession,
        media: MediaFile,
        *,
        alt_text: Optional[str] = None,
        caption: Optional[str] = None,
        is_featured: Optional[bool] = None,
        display_order: Optional[int] = None,
        is_published: Optional[bool] = None,
    ) -> MediaFile:
        """Apply updates to an existing media file."""

        if alt_text is not None:
            media.alt_text = alt_text
        if caption is not None:
            media.caption = caption
        if is_featured is not None:
            media.is_featured = is_featured
        if display_order is not None:
            media.display_order = display_order
        if is_published is not None:
            media.is_published = is_published
            if is_published and media.published_at is None:
                media.published_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(media)
        return media

    async def delete_media(self, db: AsyncSession, media: MediaFile) -> None:
        """Delete a media file from disk and the database."""

        storage_path = self.base_path / media.file_path
        if storage_path.exists():
            storage_path.unlink()

        await db.delete(media)
        await db.commit()


media_service = MediaService()
