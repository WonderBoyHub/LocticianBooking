"""
Subscription-related Pydantic models for API validation and serialization.
"""
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator


class SubscriptionPlanBase(BaseModel):
    """Base subscription plan model."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    price: Decimal = Field(..., ge=0)
    billing_interval: str = Field(..., pattern="^(monthly|yearly)$")
    billing_interval_count: int = Field(1, ge=1)
    features: Optional[Dict[str, Any]] = None
    max_bookings_per_month: Optional[int] = Field(None, ge=0)
    discount_percentage: Decimal = Field(0, ge=0, le=100)
    is_active: bool = True


class SubscriptionPlanCreate(SubscriptionPlanBase):
    """Schema for creating a subscription plan."""
    pass


class SubscriptionPlanUpdate(BaseModel):
    """Schema for updating a subscription plan."""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, ge=0)
    billing_interval: Optional[str] = Field(None, pattern="^(monthly|yearly)$")
    billing_interval_count: Optional[int] = Field(None, ge=1)
    features: Optional[Dict[str, Any]] = None
    max_bookings_per_month: Optional[int] = Field(None, ge=0)
    discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None


class SubscriptionPlan(SubscriptionPlanBase):
    """Complete subscription plan model with ID and timestamps."""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubscriptionStatusBase(BaseModel):
    """Base subscription status model."""
    name: str = Field(..., max_length=50)
    description: Optional[str] = None
    is_active_status: bool = False
    sort_order: int = 0


class SubscriptionStatus(SubscriptionStatusBase):
    """Complete subscription status model."""
    id: int

    class Config:
        from_attributes = True


class UserSubscriptionBase(BaseModel):
    """Base user subscription model."""
    plan_id: int
    current_period_start: datetime
    current_period_end: datetime
    next_billing_date: Optional[datetime] = None
    mollie_subscription_id: Optional[str] = Field(None, max_length=255)
    mollie_customer_id: Optional[str] = Field(None, max_length=255)
    mollie_mandate_id: Optional[str] = Field(None, max_length=255)
    bookings_used_this_period: int = Field(0, ge=0)
    plan_price: Decimal = Field(..., ge=0)
    discount_applied: Decimal = Field(0, ge=0, le=100)

    @validator('current_period_end')
    def validate_period_end(cls, v, values):
        if 'current_period_start' in values and v <= values['current_period_start']:
            raise ValueError('current_period_end must be after current_period_start')
        return v


class UserSubscriptionCreate(UserSubscriptionBase):
    """Schema for creating a user subscription."""
    user_id: UUID


class UserSubscriptionUpdate(BaseModel):
    """Schema for updating a user subscription."""
    status_id: Optional[int] = None
    next_billing_date: Optional[datetime] = None
    mollie_subscription_id: Optional[str] = Field(None, max_length=255)
    mollie_customer_id: Optional[str] = Field(None, max_length=255)
    mollie_mandate_id: Optional[str] = Field(None, max_length=255)
    bookings_used_this_period: Optional[int] = Field(None, ge=0)


class UserSubscription(UserSubscriptionBase):
    """Complete user subscription model with relationships."""
    id: UUID
    user_id: UUID
    status_id: int
    created_at: datetime
    updated_at: datetime
    cancelled_at: Optional[datetime] = None

    # Relationships
    plan: Optional[SubscriptionPlan] = None
    status: Optional[SubscriptionStatus] = None

    class Config:
        from_attributes = True


class CurrentSubscriptionInfo(BaseModel):
    """Current subscription information for a user."""
    subscription_id: Optional[UUID] = None
    plan_name: Optional[str] = None
    status_name: Optional[str] = None
    current_period_end: Optional[datetime] = None
    bookings_used: Optional[int] = None
    max_bookings: Optional[int] = None
    has_active_subscription: bool = False


class SubscriptionUsageInfo(BaseModel):
    """Subscription usage information."""
    subscription_id: UUID
    plan_name: str
    bookings_used: int
    max_bookings: Optional[int]
    usage_percentage: Optional[float] = None
    can_book: bool = True

    @validator('usage_percentage', pre=True)
    def calculate_usage_percentage(cls, v, values):
        if 'max_bookings' in values and values['max_bookings'] and values['max_bookings'] > 0:
            return (values.get('bookings_used', 0) / values['max_bookings']) * 100
        return None


class SubscriptionHistoryEntry(BaseModel):
    """Subscription history entry."""
    id: UUID
    subscription_id: UUID
    old_status_id: Optional[int]
    new_status_id: int
    changed_by: Optional[UUID]
    change_reason: Optional[str]
    changed_at: datetime

    # Relationships
    old_status: Optional[SubscriptionStatus] = None
    new_status: Optional[SubscriptionStatus] = None

    class Config:
        from_attributes = True


class SubscriptionPriceCalculation(BaseModel):
    """Subscription price calculation result."""
    plan_id: int
    base_price: Decimal
    discount_percentage: Decimal = 0
    final_price: Decimal
    currency: str = "USD"
    billing_interval: str
    billing_interval_count: int
