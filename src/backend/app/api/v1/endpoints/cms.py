"""CMS endpoints for managing content pages."""
from datetime import datetime
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_admin
from app.core.database import get_db
from app.models.cms import CMSPage
from app.models.enums import PageType
from app.models.user import User
from app.schemas.cms import (
    CMSPageCreate,
    CMSPageDetail,
    CMSPageList,
    CMSPagePublic,
    CMSPageSummary,
    CMSPageUpdate,
)

logger = structlog.get_logger(__name__)

router = APIRouter()


def _published_filters(now: datetime) -> List:
    """Generate SQLAlchemy filter clauses for published content."""

    return [
        CMSPage.is_published.is_(True),
        or_(CMSPage.publish_at.is_(None), CMSPage.publish_at <= now),
        or_(CMSPage.unpublish_at.is_(None), CMSPage.unpublish_at > now),
    ]


@router.get("/pages", response_model=CMSPageList)
async def list_published_pages(
    page_type: Optional[PageType] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> CMSPageList:
    """Return published CMS pages with optional filtering by type."""

    now = datetime.utcnow()
    query = (
        select(CMSPage)
        .options(selectinload(CMSPage.hero_media))
        .where(and_(*_published_filters(now)))
        .order_by(CMSPage.publish_at.asc().nullsfirst(), CMSPage.title.asc())
        .limit(limit)
    )

    if page_type:
        query = query.where(CMSPage.page_type == page_type)

    result = await db.execute(query)
    pages = result.scalars().all()

    return CMSPageList(
        data=[CMSPageSummary.model_validate(page, from_attributes=True) for page in pages]
    )


@router.get("/pages/{slug}", response_model=CMSPageDetail)
async def get_page_by_slug(slug: str, db: AsyncSession = Depends(get_db)) -> CMSPageDetail:
    """Fetch a published page by slug."""

    now = datetime.utcnow()
    query = (
        select(CMSPage)
        .options(selectinload(CMSPage.hero_media))
        .where(CMSPage.slug == slug)
        .where(and_(*_published_filters(now)))
    )

    result = await db.execute(query)
    page = result.scalar_one_or_none()

    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found",
        )

    return CMSPageDetail(data=CMSPagePublic.model_validate(page, from_attributes=True))


@router.get("/pages/admin", response_model=CMSPageList)
async def list_pages_admin(
    page_type: Optional[PageType] = Query(default=None),
    include_unpublished: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> CMSPageList:
    """List pages for CMS administrators."""

    query = select(CMSPage).options(selectinload(CMSPage.hero_media)).order_by(
        CMSPage.updated_at.desc()
    )

    if page_type:
        query = query.where(CMSPage.page_type == page_type)

    if not include_unpublished:
        query = query.where(and_(*_published_filters(datetime.utcnow())))

    result = await db.execute(query)
    pages = result.scalars().all()

    return CMSPageList(
        data=[CMSPageSummary.model_validate(page, from_attributes=True) for page in pages]
    )


@router.post("/pages", response_model=CMSPageDetail, status_code=status.HTTP_201_CREATED)
async def create_page(
    payload: CMSPageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
) -> CMSPageDetail:
    """Create a new CMS page."""

    page = CMSPage(
        title=payload.title,
        slug=payload.slug,
        content=payload.content,
        excerpt=payload.excerpt,
        page_type=payload.page_type,
        meta_title=payload.meta_title,
        meta_description=payload.meta_description,
        meta_keywords=payload.meta_keywords,
        gdpr_version=payload.gdpr_version,
        is_published=payload.is_published,
        publish_at=payload.publish_at,
        unpublish_at=payload.unpublish_at,
        hero_media_id=payload.hero_media_id,
        author_id=current_user.id,
    )

    if page.is_published and page.publish_at is None:
        page.published_at = datetime.utcnow()

    db.add(page)

    try:
        await db.commit()
    except Exception as exc:  # pragma: no cover - defensive logging
        await db.rollback()
        logger.error("Create CMS page error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create page",
        ) from exc

    await db.refresh(page)

    return CMSPageDetail(data=CMSPagePublic.model_validate(page, from_attributes=True))


@router.put("/pages/{page_id}", response_model=CMSPageDetail)
async def update_page(
    page_id: str,
    payload: CMSPageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
) -> CMSPageDetail:
    """Update an existing CMS page."""

    result = await db.execute(
        select(CMSPage).options(selectinload(CMSPage.hero_media)).where(CMSPage.id == page_id)
    )
    page = result.scalar_one_or_none()

    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(page, field, value)

    if page.is_published and page.published_at is None:
        page.published_at = datetime.utcnow()

    page.updated_at = datetime.utcnow()
    page.author_id = page.author_id or current_user.id

    await db.commit()
    await db.refresh(page)

    return CMSPageDetail(data=CMSPagePublic.model_validate(page, from_attributes=True))


@router.delete("/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(
    page_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> None:
    """Remove a CMS page."""

    result = await db.execute(select(CMSPage).where(CMSPage.id == page_id))
    page = result.scalar_one_or_none()

    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    await db.delete(page)
    await db.commit()

    return None
