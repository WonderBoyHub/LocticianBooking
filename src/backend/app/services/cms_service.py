"""CMS service helpers for content aggregation and settings management."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cms import CMSContentSettings
from app.models.instagram import InstagramPost
from app.models.media import MediaFile

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class _DefaultContentSettings:
    instagram_max_items: int = 9
    instagram_featured_only: bool = True
    instagram_allow_videos: bool = True
    instagram_allow_carousels: bool = True
    media_max_items: int = 12
    media_featured_only: bool = True
    media_include_images: bool = True
    media_include_videos: bool = True

    def as_dict(self) -> Dict[str, Any]:
        return {
            "instagram_max_items": self.instagram_max_items,
            "instagram_featured_only": self.instagram_featured_only,
            "instagram_allow_videos": self.instagram_allow_videos,
            "instagram_allow_carousels": self.instagram_allow_carousels,
            "media_max_items": self.media_max_items,
            "media_featured_only": self.media_featured_only,
            "media_include_images": self.media_include_images,
            "media_include_videos": self.media_include_videos,
        }


_DEFAULT_SETTINGS = _DefaultContentSettings().as_dict()


class CMSService:
    """Utility service for CMS content aggregation."""

    SETTINGS_KEY = "homepage_content"

    def __init__(self) -> None:
        self._defaults = _DEFAULT_SETTINGS

    def _normalise_settings(self, data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        settings = {**self._defaults}
        if isinstance(data, dict):
            for key, value in data.items():
                if key in settings and value is not None:
                    settings[key] = value
        return self._sanitize_settings(settings)

    @staticmethod
    def _sanitize_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
        def _bool(value: Any) -> bool:
            return bool(value) if value is not None else False

        def _clamp(value: Any, minimum: int, maximum: int) -> int:
            try:
                numeric = int(value)
            except (TypeError, ValueError):
                numeric = minimum
            return max(minimum, min(maximum, numeric))

        settings["instagram_max_items"] = _clamp(settings.get("instagram_max_items"), 0, 50)
        settings["media_max_items"] = _clamp(settings.get("media_max_items"), 0, 50)

        for key in (
            "instagram_featured_only",
            "instagram_allow_videos",
            "instagram_allow_carousels",
            "media_featured_only",
            "media_include_images",
            "media_include_videos",
        ):
            settings[key] = _bool(settings.get(key, self._defaults.get(key)))

        return settings

    async def _get_settings_row(self, db: AsyncSession) -> Optional[CMSContentSettings]:
        result = await db.execute(
            select(CMSContentSettings).where(CMSContentSettings.key == self.SETTINGS_KEY)
        )
        return result.scalar_one_or_none()

    async def get_content_settings(self, db: AsyncSession) -> Dict[str, Any]:
        """Return merged content settings, creating defaults if necessary."""

        row = await self._get_settings_row(db)
        if row is None:
            settings = self._normalise_settings(None)
            row = CMSContentSettings(key=self.SETTINGS_KEY, value=settings)
            db.add(row)
            await db.flush()
            logger.info("Created default CMS content settings")
            return settings

        settings = self._normalise_settings(row.value)
        if settings != row.value:
            row.value = settings
            await db.flush()
        return settings

    async def update_content_settings(
        self, db: AsyncSession, updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Persist updated content settings."""

        current = await self.get_content_settings(db)
        merged = {**current}
        for key, value in updates.items():
            if key in merged and value is not None:
                merged[key] = value

        sanitised = self._sanitize_settings(merged)

        row = await self._get_settings_row(db)
        if row is None:
            row = CMSContentSettings(key=self.SETTINGS_KEY, value=sanitised)
            db.add(row)
        else:
            row.value = sanitised
        await db.flush()

        logger.info("CMS content settings updated", changes=list(updates.keys()))
        return sanitised

    async def fetch_instagram_posts(
        self,
        db: AsyncSession,
        settings: Dict[str, Any],
        *,
        for_admin: bool,
        limit_override: Optional[int] = None,
    ) -> List[InstagramPost]:
        """Return Instagram posts filtered according to settings."""

        query = select(InstagramPost)

        if settings.get("instagram_featured_only", True):
            query = query.where(InstagramPost.is_featured.is_(True))

        if not settings.get("instagram_allow_videos", True):
            query = query.where(func.lower(InstagramPost.post_type) != "video")

        if not settings.get("instagram_allow_carousels", True):
            query = query.where(~func.lower(InstagramPost.post_type).like("carousel%"))

        query = query.order_by(
            InstagramPost.display_order.asc(),
            InstagramPost.posted_at.desc(),
        )

        limit_value = limit_override
        if limit_value is None:
            limit_value = settings.get("instagram_max_items", self._defaults["instagram_max_items"])

        if limit_value and limit_value > 0:
            query = query.limit(limit_value)

        result = await db.execute(query)
        posts: Iterable[InstagramPost] = result.scalars().all()

        return list(posts)

    async def fetch_media_items(
        self,
        db: AsyncSession,
        settings: Dict[str, Any],
        *,
        for_admin: bool,
        limit_override: Optional[int] = None,
    ) -> List[MediaFile]:
        """Return media items filtered according to settings."""

        query = select(MediaFile)

        if not for_admin:
            query = query.where(MediaFile.is_published.is_(True))

        if settings.get("media_featured_only", True):
            query = query.where(MediaFile.is_featured.is_(True))

        include_images = settings.get("media_include_images", True)
        include_videos = settings.get("media_include_videos", True)

        if not include_images:
            query = query.where(~MediaFile.mime_type.ilike("image/%"))
        if not include_videos:
            query = query.where(~MediaFile.mime_type.ilike("video/%"))

        order_columns = [MediaFile.display_order.asc()]
        if for_admin:
            order_columns.append(MediaFile.uploaded_at.desc())
        else:
            order_columns.append(MediaFile.published_at.desc())

        query = query.order_by(*order_columns)

        limit_value = limit_override
        if limit_value is None:
            limit_value = settings.get("media_max_items", self._defaults["media_max_items"])

        if limit_value and limit_value > 0:
            query = query.limit(limit_value)

        result = await db.execute(query)
        media_items: Iterable[MediaFile] = result.scalars().all()

        return list(media_items)

    async def get_content_overview(
        self, db: AsyncSession, *, for_admin: bool
    ) -> Dict[str, Any]:
        """Return homepage content respecting stored settings."""

        settings = await self.get_content_settings(db)
        instagram_posts = await self.fetch_instagram_posts(
            db, settings, for_admin=for_admin, limit_override=None
        )
        media_items = await self.fetch_media_items(
            db, settings, for_admin=for_admin, limit_override=None
        )

        return {
            "settings": settings,
            "instagram": instagram_posts,
            "media": media_items,
        }


cms_service = CMSService()
