"""Pydantic schemas for CMS pages."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.enums import PageType
from app.schemas.media import MediaFilePublic


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
