"""
CMS page model.
"""
from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, IS_POSTGRES
from app.models.enums import PageType
from app.models.mixins import BaseModel


class CMSPage(Base, BaseModel):
    """CMS pages for content management."""

    __tablename__ = "cms_pages"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    excerpt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    page_type: Mapped[PageType] = mapped_column(default=PageType.PAGE, nullable=False)
    gdpr_version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # SEO
    meta_title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    meta_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    _KeywordsType = ARRAY(Text) if IS_POSTGRES else JSON
    meta_keywords: Mapped[Optional[List[str]]] = mapped_column(_KeywordsType, nullable=True)

    # Visibility
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Scheduling
    publish_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    unpublish_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Authoring
    author_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True,
    )
    hero_media_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("media_files.id"),
        nullable=True,
    )

    # Relationships
    author: Mapped[Optional["User"]] = relationship("User")
    hero_media: Mapped[Optional["MediaFile"]] = relationship("MediaFile")

    @property
    def is_currently_published(self) -> bool:
        """Check if page is currently published."""
        if not self.is_published:
            return False

        now = datetime.utcnow()

        # Check publish_at
        if self.publish_at and self.publish_at > now:
            return False

        # Check unpublish_at
        if self.unpublish_at and self.unpublish_at <= now:
            return False

        return True

    @property
    def status_display(self) -> str:
        """Get display status."""
        if not self.is_published:
            return "Draft"
        elif self.is_currently_published:
            return "Published"
        else:
            return "Scheduled"

    def __repr__(self) -> str:
        return f"<CMSPage(id={self.id}, title={self.title}, type={self.page_type})>"