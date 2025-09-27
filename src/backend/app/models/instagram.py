"""
Instagram integration model.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import UUIDMixin


class InstagramPost(Base, UUIDMixin):
    """Instagram posts cache for displaying feed."""

    __tablename__ = "instagram_posts"

    instagram_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    post_type: Mapped[str] = mapped_column(String(20), nullable=False)  # image, video, carousel
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    media_url: Mapped[str] = mapped_column(Text, nullable=False)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    permalink: Mapped[str] = mapped_column(Text, nullable=False)

    # Engagement metrics
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Display settings
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Sync metadata
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sync_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    @property
    def engagement_rate(self) -> float:
        """Calculate engagement rate (simplified)."""
        total_engagement = self.likes_count + self.comments_count
        # This would need follower count for accurate calculation
        return total_engagement

    def __repr__(self) -> str:
        return f"<InstagramPost(id={self.id}, instagram_id={self.instagram_id}, type={self.post_type})>"