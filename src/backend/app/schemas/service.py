"""
Service and service category schema definitions.
"""
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


# Service Category Schemas
class ServiceCategoryBase(BaseModel):
    """Base service category schema."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True


class ServiceCategoryCreate(ServiceCategoryBase):
    """Schema for creating a service category."""
    pass


class ServiceCategoryUpdate(BaseModel):
    """Schema for updating a service category."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    display_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class ServiceCategory(ServiceCategoryBase):
    """Complete service category schema."""
    id: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ServiceCategoryWithServices(ServiceCategory):
    """Service category with services included."""
    services: List["ServiceSummary"] = []


# Service Schemas
class ServiceBase(BaseModel):
    """Base service schema."""
    category_id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    duration_minutes: int = Field(..., gt=0, le=1440)  # Max 24 hours
    base_price: Decimal = Field(..., gt=0, decimal_places=2)
    min_advance_hours: int = Field(default=24, ge=0)
    max_advance_days: int = Field(default=90, ge=1)
    buffer_before_minutes: int = Field(default=15, ge=0)
    buffer_after_minutes: int = Field(default=15, ge=0)
    requires_consultation: bool = False
    is_addon_service: bool = False
    max_participants: int = Field(default=1, gt=0)
    is_active: bool = True
    is_online_bookable: bool = True
    display_order: int = Field(default=0, ge=0)
    slug: Optional[str] = Field(None, max_length=200)
    meta_title: Optional[str] = Field(None, max_length=200)
    meta_description: Optional[str] = None

    @field_validator('slug')
    def validate_slug(cls, v: Optional[str]):
        if v is not None:
            # Simple slug validation - only lowercase, numbers, and hyphens
            import re
            if not re.match(r'^[a-z0-9-]+$', v):
                raise ValueError('Slug must contain only lowercase letters, numbers, and hyphens')
        return v


class ServiceCreate(ServiceBase):
    """Schema for creating a service."""
    pass


class ServiceUpdate(BaseModel):
    """Schema for updating a service."""
    category_id: Optional[str] = None
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, gt=0, le=1440)
    base_price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    min_advance_hours: Optional[int] = Field(None, ge=0)
    max_advance_days: Optional[int] = Field(None, ge=1)
    buffer_before_minutes: Optional[int] = Field(None, ge=0)
    buffer_after_minutes: Optional[int] = Field(None, ge=0)
    requires_consultation: Optional[bool] = None
    is_addon_service: Optional[bool] = None
    max_participants: Optional[int] = Field(None, gt=0)
    is_active: Optional[bool] = None
    is_online_bookable: Optional[bool] = None
    display_order: Optional[int] = Field(None, ge=0)
    slug: Optional[str] = Field(None, max_length=200)
    meta_title: Optional[str] = Field(None, max_length=200)
    meta_description: Optional[str] = None

    @field_validator('slug')
    def validate_slug(cls, v: Optional[str]):
        if v is not None:
            import re
            if not re.match(r'^[a-z0-9-]+$', v):
                raise ValueError('Slug must contain only lowercase letters, numbers, and hyphens')
        return v


class ServiceSummary(BaseModel):
    """Service summary for listings."""
    id: str
    name: str
    duration_minutes: int
    base_price: Decimal
    is_active: bool
    is_online_bookable: bool
    category_name: Optional[str] = None

    class Config:
        from_attributes = True


class Service(ServiceBase):
    """Complete service schema."""
    id: str
    created_at: str
    updated_at: str
    category_name: Optional[str] = None
    total_duration_with_buffer: int
    price_formatted: str

    class Config:
        from_attributes = True


class ServiceWithStats(Service):
    """Service with booking statistics."""
    total_bookings: int = 0
    completed_bookings: int = 0
    total_revenue: Decimal = Decimal('0.00')
    average_rating: Optional[Decimal] = None


# Service Search and Filter Schemas
class ServiceSearch(BaseModel):
    """Service search results."""
    id: str
    name: str
    description: Optional[str]
    duration_minutes: int
    base_price: Decimal
    category_name: Optional[str]
    search_rank: float

    class Config:
        from_attributes = True


class ServiceFilter(BaseModel):
    """Service filtering options."""
    category_id: Optional[str] = None
    min_duration: Optional[int] = Field(None, gt=0)
    max_duration: Optional[int] = Field(None, gt=0)
    min_price: Optional[Decimal] = Field(None, gt=0)
    max_price: Optional[Decimal] = Field(None, gt=0)
    is_active: Optional[bool] = None
    is_online_bookable: Optional[bool] = None
    requires_consultation: Optional[bool] = None
    is_addon_service: Optional[bool] = None


# Update forward references
ServiceCategoryWithServices.model_rebuild()