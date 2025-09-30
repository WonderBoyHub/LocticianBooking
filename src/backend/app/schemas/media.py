"""Pydantic schemas for media assets exposed via the CMS API."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class MediaFileBase(BaseModel):
    """Base media file representation."""

    id: str
    original_filename: str
    mime_type: str
    file_size: int
    alt_text: Optional[str] = None
    caption: Optional[str] = None
    is_featured: bool = False
    display_order: int = 0
    is_published: bool = True
    published_at: datetime
    url: str = Field(..., alias="public_url")

    class Config:
        from_attributes = True
        populate_by_name = True


class MediaFilePublic(MediaFileBase):
    """Media file payload exposed to the public frontend."""

    pass


class MediaFileAdmin(MediaFileBase):
    """Media file payload for CMS administrators."""

    filename: str
    file_path: str
    uploaded_by: Optional[str] = None
    uploaded_at: datetime
    file_size_mb: float = Field(..., alias="file_size_mb")

    class Config(MediaFileBase.Config):
        pass


class MediaFileUpdate(BaseModel):
    """Payload for updating media metadata."""

    alt_text: Optional[str] = None
    caption: Optional[str] = None
    is_featured: Optional[bool] = None
    display_order: Optional[int] = Field(default=None, ge=0)
    is_published: Optional[bool] = None


class MediaFileList(BaseModel):
    """Wrapper schema for list responses."""

    data: List[MediaFileAdmin]


class MediaFilePublicList(BaseModel):
    """Wrapper schema for public list responses."""

    data: List[MediaFilePublic]
