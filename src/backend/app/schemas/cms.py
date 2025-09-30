"""Pydantic schemas for CMS pages."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.enums import PageType
from app.schemas.instagram import InstagramPostAdmin, InstagramPostPublic
from app.schemas.media import MediaFileAdmin, MediaFilePublic


class CMSPageBase(BaseModel):
    """Shared CMS page fields."""

    title: str
    slug: str
    excerpt: Optional[str] = None
    page_type: PageType = PageType.PAGE
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[List[str]] = None
    gdpr_version: Optional[str] = Field(default=None, max_length=20)


class CMSPageCreate(CMSPageBase):
    """Schema for creating a CMS page."""

    content: Optional[str] = None
    is_published: bool = False
    publish_at: Optional[datetime] = None
    unpublish_at: Optional[datetime] = None
    hero_media_id: Optional[str] = None


class CMSPageUpdate(BaseModel):
    """Schema for updating a CMS page."""

    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    page_type: Optional[PageType] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[List[str]] = None
    gdpr_version: Optional[str] = Field(default=None, max_length=20)
    is_published: Optional[bool] = None
    publish_at: Optional[datetime] = None
    unpublish_at: Optional[datetime] = None
    hero_media_id: Optional[str] = None


class CMSPagePublic(CMSPageBase):
    """Public CMS page payload."""

    id: str
    content: Optional[str] = None
    is_published: bool
    published_at: Optional[datetime] = None
    publish_at: Optional[datetime] = None
    unpublish_at: Optional[datetime] = None
    updated_at: datetime
    hero_media: Optional[MediaFilePublic] = None

    class Config:
        from_attributes = True


class CMSPageSummary(BaseModel):
    """Slimmed-down page summary for listings."""

    id: str
    title: str
    slug: str
    page_type: PageType
    is_published: bool
    published_at: Optional[datetime] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class CMSPageList(BaseModel):
    """Wrapper for CMS page list responses."""

    data: List[CMSPageSummary]


class CMSPageDetail(BaseModel):
    """Wrapper for page detail responses."""

    data: CMSPagePublic


class CMSContentSettings(BaseModel):
    """Settings controlling homepage CMS content."""

    instagram_max_items: int = Field(default=9, ge=0, le=50)
    instagram_featured_only: bool = True
    instagram_allow_videos: bool = True
    instagram_allow_carousels: bool = True
    media_max_items: int = Field(default=12, ge=0, le=50)
    media_featured_only: bool = True
    media_include_images: bool = True
    media_include_videos: bool = True


class CMSContentSettingsUpdate(BaseModel):
    """Partial update payload for content settings."""

    instagram_max_items: Optional[int] = Field(default=None, ge=0, le=50)
    instagram_featured_only: Optional[bool] = None
    instagram_allow_videos: Optional[bool] = None
    instagram_allow_carousels: Optional[bool] = None
    media_max_items: Optional[int] = Field(default=None, ge=0, le=50)
    media_featured_only: Optional[bool] = None
    media_include_images: Optional[bool] = None
    media_include_videos: Optional[bool] = None


class CMSContentSettingsResponse(BaseModel):
    """Response wrapper for settings endpoints."""

    data: CMSContentSettings


class CMSContentOverview(BaseModel):
    """Admin facing overview of homepage content."""

    settings: CMSContentSettings
    instagram: List[InstagramPostAdmin]
    media: List[MediaFileAdmin]


class CMSContentOverviewResponse(BaseModel):
    """Wrapper for admin content overview responses."""

    data: CMSContentOverview


class CMSContentOverviewPublic(BaseModel):
    """Public facing overview of homepage content."""

    settings: CMSContentSettings
    instagram: List[InstagramPostPublic]
    media: List[MediaFilePublic]


class CMSContentOverviewPublicResponse(BaseModel):
    """Wrapper for public content overview responses."""

    data: CMSContentOverviewPublic
