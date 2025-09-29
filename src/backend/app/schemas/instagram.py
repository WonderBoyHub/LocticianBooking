"""Pydantic schemas for Instagram posts."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class InstagramPostBase(BaseModel):
    """Base schema shared by Instagram post responses."""

    id: str
    instagram_id: str
    post_type: str
    caption: Optional[str] = None
    media_url: str
    thumbnail_url: Optional[str] = None
    permalink: str
    likes_count: int = 0
    comments_count: int = 0
    posted_at: datetime
    is_featured: bool = False
    display_order: int = 0

    class Config:
        from_attributes = True


class InstagramPostPublic(InstagramPostBase):
    """Public Instagram post payload."""

    pass


class InstagramPostAdmin(InstagramPostBase):
    """Instagram post payload for admin views including sync metadata."""

    synced_at: Optional[datetime] = None
    sync_error: Optional[str] = None


class InstagramPostUpdate(BaseModel):
    """Payload for updating Instagram post display settings."""

    is_featured: Optional[bool] = None
    display_order: Optional[int] = Field(default=None, ge=0)
