"""
Service management API endpoints.
"""
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_admin, get_current_user, rate_limit_check
from app.core.database import get_db
from app.models.service import Service, ServiceCategory
from app.models.user import User
from app.schemas.service import (
    Service as ServiceSchema,
    ServiceCategory as ServiceCategorySchema,
    ServiceCategoryCreate,
    ServiceCategoryUpdate,
    ServiceCategoryWithServices,
    ServiceCreate,
    ServiceFilter,
    ServiceSearch,
    ServiceSummary,
    ServiceUpdate,
    ServiceWithStats,
)

logger = structlog.get_logger(__name__)

router = APIRouter()


# Service Category Endpoints
@router.get("/categories", response_model=List[ServiceCategoryWithServices])
async def list_service_categories(
    include_inactive: bool = Query(False, description="Include inactive categories"),
    db: AsyncSession = Depends(get_db),
) -> List[ServiceCategoryWithServices]:
    """List all service categories with their services."""
    try:
        query = (
            select(ServiceCategory)
            .options(selectinload(ServiceCategory.services))
            .order_by(ServiceCategory.display_order, ServiceCategory.name)
        )

        if not include_inactive:
            query = query.where(ServiceCategory.is_active == True)

        result = await db.execute(query)
        categories = result.scalars().all()

        return [
            ServiceCategoryWithServices(
                **category.__dict__,
                services=[ServiceSummary(**service.__dict__) for service in category.services if include_inactive or service.is_active]
            )
            for category in categories
        ]

    except Exception as e:
        logger.error("List service categories error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list service categories"
        )


@router.post("/categories", response_model=ServiceCategorySchema, status_code=status.HTTP_201_CREATED)
async def create_service_category(
    category_data: ServiceCategoryCreate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ServiceCategorySchema:
    """Create a new service category."""
    try:
        # Check for duplicate name
        existing = await db.execute(
            select(ServiceCategory).where(ServiceCategory.name == category_data.name)
        )
        if existing.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Service category with this name already exists"
            )

        # Create category
        category = ServiceCategory(**category_data.model_dump())
        db.add(category)
        await db.commit()
        await db.refresh(category)

        logger.info(
            "Service category created",
            category_id=category.id,
            name=category.name,
            created_by=current_user.id
        )

        return ServiceCategorySchema(**category.__dict__)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create service category error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create service category"
        )


@router.get("/categories/{category_id}", response_model=ServiceCategoryWithServices)
async def get_service_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
) -> ServiceCategoryWithServices:
    """Get service category by ID."""
    try:
        query = (
            select(ServiceCategory)
            .options(selectinload(ServiceCategory.services))
            .where(ServiceCategory.id == category_id)
        )

        result = await db.execute(query)
        category = result.scalar()

        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service category not found"
            )

        return ServiceCategoryWithServices(
            **category.__dict__,
            services=[ServiceSummary(**service.__dict__) for service in category.services]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get service category error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get service category"
        )


@router.put("/categories/{category_id}", response_model=ServiceCategorySchema)
async def update_service_category(
    category_id: str,
    category_data: ServiceCategoryUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ServiceCategorySchema:
    """Update service category."""
    try:
        # Get existing category
        result = await db.execute(
            select(ServiceCategory).where(ServiceCategory.id == category_id)
        )
        category = result.scalar()

        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service category not found"
            )

        # Check for duplicate name if updating name
        if category_data.name and category_data.name != category.name:
            existing = await db.execute(
                select(ServiceCategory)
                .where(and_(ServiceCategory.name == category_data.name, ServiceCategory.id != category_id))
            )
            if existing.scalar():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Service category with this name already exists"
                )

        # Update fields
        update_data = category_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(category, field, value)

        await db.commit()
        await db.refresh(category)

        logger.info(
            "Service category updated",
            category_id=category.id,
            updated_by=current_user.id
        )

        return ServiceCategorySchema(**category.__dict__)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Update service category error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update service category"
        )


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_category(
    category_id: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete service category."""
    try:
        # Check if category exists
        result = await db.execute(
            select(ServiceCategory).where(ServiceCategory.id == category_id)
        )
        category = result.scalar()

        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service category not found"
            )

        # Check if category has services
        services_count = await db.execute(
            select(func.count(Service.id)).where(Service.category_id == category_id)
        )
        if services_count.scalar() > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete category with existing services"
            )

        await db.delete(category)
        await db.commit()

        logger.info(
            "Service category deleted",
            category_id=category.id,
            deleted_by=current_user.id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Delete service category error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete service category"
        )


# Service Endpoints
@router.get("/", response_model=List[ServiceSummary])
async def list_services(
    category_id: Optional[str] = Query(None, description="Filter by category"),
    include_inactive: bool = Query(False, description="Include inactive services"),
    include_non_bookable: bool = Query(False, description="Include non-bookable services"),
    limit: int = Query(100, le=1000, description="Limit results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
) -> List[ServiceSummary]:
    """List services with filtering options."""
    try:
        query = (
            select(Service, ServiceCategory.name.label('category_name'))
            .outerjoin(ServiceCategory, Service.category_id == ServiceCategory.id)
            .order_by(Service.display_order, Service.name)
        )

        # Apply filters
        filters = []
        if not include_inactive:
            filters.append(Service.is_active == True)
        if not include_non_bookable:
            filters.append(Service.is_online_bookable == True)
        if category_id:
            filters.append(Service.category_id == category_id)

        if filters:
            query = query.where(and_(*filters))

        query = query.limit(limit).offset(offset)

        result = await db.execute(query)
        services = result.all()

        return [
            ServiceSummary(
                **service.Service.__dict__,
                category_name=service.category_name
            )
            for service in services
        ]

    except Exception as e:
        logger.error("List services error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list services"
        )


@router.post("/", response_model=ServiceSchema, status_code=status.HTTP_201_CREATED)
async def create_service(
    service_data: ServiceCreate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> ServiceSchema:
    """Create a new service."""
    try:
        # Validate category if provided
        if service_data.category_id:
            category_result = await db.execute(
                select(ServiceCategory).where(ServiceCategory.id == service_data.category_id)
            )
            if not category_result.scalar():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid category ID"
                )

        # Check for duplicate name
        existing = await db.execute(
            select(Service).where(Service.name == service_data.name)
        )
        if existing.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Service with this name already exists"
            )

        # Check for duplicate slug if provided
        if service_data.slug:
            existing_slug = await db.execute(
                select(Service).where(Service.slug == service_data.slug)
            )
            if existing_slug.scalar():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Service with this slug already exists"
                )

        # Create service
        service = Service(**service_data.model_dump())
        db.add(service)
        await db.commit()
        await db.refresh(service)

        # Get category name for response
        category_name = None
        if service.category_id:
            category_result = await db.execute(
                select(ServiceCategory.name).where(ServiceCategory.id == service.category_id)
            )
            category_name = category_result.scalar()

        logger.info(
            "Service created",
            service_id=service.id,
            name=service.name,
            created_by=current_user.id
        )

        return ServiceSchema(
            **service.__dict__,
            category_name=category_name,
            total_duration_with_buffer=service.total_duration_with_buffer,
            price_formatted=service.price_formatted
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create service error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create service"
        )


@router.get("/{service_id}", response_model=ServiceSchema)
async def get_service(
    service_id: str,
    db: AsyncSession = Depends(get_db),
) -> ServiceSchema:
    """Get service by ID."""
    try:
        query = (
            select(Service, ServiceCategory.name.label('category_name'))
            .outerjoin(ServiceCategory, Service.category_id == ServiceCategory.id)
            .where(Service.id == service_id)
        )

        result = await db.execute(query)
        service_row = result.first()

        if not service_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )

        service = service_row.Service
        return ServiceSchema(
            **service.__dict__,
            category_name=service_row.category_name,
            total_duration_with_buffer=service.total_duration_with_buffer,
            price_formatted=service.price_formatted
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get service error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get service"
        )


@router.put("/{service_id}", response_model=ServiceSchema)
async def update_service(
    service_id: str,
    service_data: ServiceUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ServiceSchema:
    """Update service."""
    try:
        # Get existing service
        result = await db.execute(
            select(Service).where(Service.id == service_id)
        )
        service = result.scalar()

        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )

        # Validate category if provided
        if service_data.category_id:
            category_result = await db.execute(
                select(ServiceCategory).where(ServiceCategory.id == service_data.category_id)
            )
            if not category_result.scalar():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid category ID"
                )

        # Check for duplicate name if updating name
        if service_data.name and service_data.name != service.name:
            existing = await db.execute(
                select(Service)
                .where(and_(Service.name == service_data.name, Service.id != service_id))
            )
            if existing.scalar():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Service with this name already exists"
                )

        # Check for duplicate slug if updating slug
        if service_data.slug and service_data.slug != service.slug:
            existing_slug = await db.execute(
                select(Service)
                .where(and_(Service.slug == service_data.slug, Service.id != service_id))
            )
            if existing_slug.scalar():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Service with this slug already exists"
                )

        # Update fields
        update_data = service_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(service, field, value)

        await db.commit()
        await db.refresh(service)

        # Get category name for response
        category_name = None
        if service.category_id:
            category_result = await db.execute(
                select(ServiceCategory.name).where(ServiceCategory.id == service.category_id)
            )
            category_name = category_result.scalar()

        logger.info(
            "Service updated",
            service_id=service.id,
            updated_by=current_user.id
        )

        return ServiceSchema(
            **service.__dict__,
            category_name=category_name,
            total_duration_with_buffer=service.total_duration_with_buffer,
            price_formatted=service.price_formatted
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Update service error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update service"
        )


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete service."""
    try:
        # Check if service exists
        result = await db.execute(
            select(Service).where(Service.id == service_id)
        )
        service = result.scalar()

        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )

        # Check if service has bookings
        bookings_count = await db.execute(
            text("SELECT COUNT(*) FROM bookings WHERE service_id = :service_id"),
            {"service_id": service_id}
        )
        if bookings_count.scalar() > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete service with existing bookings"
            )

        await db.delete(service)
        await db.commit()

        logger.info(
            "Service deleted",
            service_id=service.id,
            deleted_by=current_user.id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Delete service error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete service"
        )


@router.get("/search/", response_model=List[ServiceSearch])
async def search_services(
    q: str = Query(..., min_length=1, description="Search query"),
    category_id: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, le=100, description="Limit results"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> List[ServiceSearch]:
    """Search services using PostgreSQL full-text search."""
    try:
        # Use PostgreSQL full-text search
        query = text("""
            SELECT s.id, s.name, s.description, s.duration_minutes, s.base_price,
                   sc.name as category_name,
                   ts_rank(search_vector, plainto_tsquery('danish', :search_query)) as search_rank
            FROM services s
            LEFT JOIN service_categories sc ON s.category_id = sc.id
            WHERE s.is_active = true
            AND s.is_online_bookable = true
            AND search_vector @@ plainto_tsquery('danish', :search_query)
            AND (:category_id IS NULL OR s.category_id = :category_id)
            ORDER BY search_rank DESC, s.name
            LIMIT :limit
        """)

        result = await db.execute(query, {
            "search_query": q,
            "category_id": category_id,
            "limit": limit
        })

        search_results = []
        for row in result.fetchall():
            search_results.append(ServiceSearch(
                id=row.id,
                name=row.name,
                description=row.description,
                duration_minutes=row.duration_minutes,
                base_price=row.base_price,
                category_name=row.category_name,
                search_rank=row.search_rank
            ))

        return search_results

    except Exception as e:
        logger.error("Search services error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search failed"
        )


@router.post("/filter", response_model=List[ServiceSummary])
async def filter_services(
    filters: ServiceFilter,
    limit: int = Query(100, le=1000, description="Limit results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
) -> List[ServiceSummary]:
    """Filter services with advanced options."""
    try:
        query = (
            select(Service, ServiceCategory.name.label('category_name'))
            .outerjoin(ServiceCategory, Service.category_id == ServiceCategory.id)
        )

        # Build filters
        conditions = []

        if filters.category_id:
            conditions.append(Service.category_id == filters.category_id)
        if filters.min_duration:
            conditions.append(Service.duration_minutes >= filters.min_duration)
        if filters.max_duration:
            conditions.append(Service.duration_minutes <= filters.max_duration)
        if filters.min_price:
            conditions.append(Service.base_price >= filters.min_price)
        if filters.max_price:
            conditions.append(Service.base_price <= filters.max_price)
        if filters.is_active is not None:
            conditions.append(Service.is_active == filters.is_active)
        if filters.is_online_bookable is not None:
            conditions.append(Service.is_online_bookable == filters.is_online_bookable)
        if filters.requires_consultation is not None:
            conditions.append(Service.requires_consultation == filters.requires_consultation)
        if filters.is_addon_service is not None:
            conditions.append(Service.is_addon_service == filters.is_addon_service)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(Service.display_order, Service.name).limit(limit).offset(offset)

        result = await db.execute(query)
        services = result.all()

        return [
            ServiceSummary(
                **service.Service.__dict__,
                category_name=service.category_name
            )
            for service in services
        ]

    except Exception as e:
        logger.error("Filter services error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to filter services"
        )


@router.get("/{service_id}/stats", response_model=ServiceWithStats)
async def get_service_stats(
    service_id: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ServiceWithStats:
    """Get service statistics (admin only)."""
    try:
        # Get service first
        service_result = await db.execute(
            select(Service, ServiceCategory.name.label('category_name'))
            .outerjoin(ServiceCategory, Service.category_id == ServiceCategory.id)
            .where(Service.id == service_id)
        )
        service_row = service_result.first()

        if not service_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found"
            )

        service = service_row.Service

        # Get booking statistics
        stats_query = text("""
            SELECT
                COUNT(*) as total_bookings,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as total_revenue,
                AVG(CASE WHEN status = 'completed' AND rating IS NOT NULL THEN rating END) as average_rating
            FROM bookings
            WHERE service_id = :service_id
        """)

        stats_result = await db.execute(stats_query, {"service_id": service_id})
        stats = stats_result.first()

        return ServiceWithStats(
            **service.__dict__,
            category_name=service_row.category_name,
            total_duration_with_buffer=service.total_duration_with_buffer,
            price_formatted=service.price_formatted,
            total_bookings=stats.total_bookings or 0,
            completed_bookings=stats.completed_bookings or 0,
            total_revenue=stats.total_revenue or 0,
            average_rating=stats.average_rating
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get service stats error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get service statistics"
        )