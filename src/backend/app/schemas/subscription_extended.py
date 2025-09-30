"""
Extended subscription models for Mollie payment integration with business logic.
"""
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ValidationInfo, field_validator


# Subscription Plan Tiers
class SubscriptionTier(str, Enum):
    """Subscription tier enumeration."""
    BASIC = "basic"
    PREMIUM = "premium"
    VIP = "vip"
    ENTERPRISE = "enterprise"
    TRIAL = "trial"


class BillingPeriod(str, Enum):
    """Billing period enumeration."""
    MONTHLY = "monthly"
    YEARLY = "yearly"
    WEEKLY = "weekly"


class SubscriptionStatus(str, Enum):
    """Subscription status enumeration."""
    ACTIVE = "active"
    PENDING = "pending"
    TRIALING = "trialing"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    UNPAID = "unpaid"
    INCOMPLETE = "incomplete"
    INCOMPLETE_EXPIRED = "incomplete_expired"


# Subscription Plan Models
class SubscriptionPlan(BaseModel):
    """Enhanced subscription plan with all features."""
    id: UUID
    name: str
    description: Optional[str] = None
    tier: SubscriptionTier
    price_monthly: Decimal
    price_yearly: Decimal
    currency: str = "DKK"

    # Features and limits
    max_bookings_per_month: Optional[int] = None
    max_staff_members: Optional[int] = None
    max_services: Optional[int] = None
    storage_gb: Optional[int] = None

    # Premium features
    priority_support: bool = False
    custom_branding: bool = False
    api_access: bool = False
    advanced_analytics: bool = False
    multi_location: bool = False

    # Discounts and pricing
    booking_discount_percentage: Decimal = Decimal("0")
    setup_fee: Decimal = Decimal("0")

    # Trial configuration
    trial_days: int = 0

    # Mollie integration
    mollie_price_id_monthly: Optional[str] = None
    mollie_price_id_yearly: Optional[str] = None
    mollie_product_id: Optional[str] = None

    # Plan metadata
    features: List[str] = []
    is_active: bool = True
    is_featured: bool = False
    display_order: int = 0
    created_at: datetime


class SubscriptionPlanCreate(BaseModel):
    """Create subscription plan request."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    tier: SubscriptionTier
    price_monthly: Decimal = Field(..., ge=0)
    price_yearly: Decimal = Field(..., ge=0)

    # Limits
    max_bookings_per_month: Optional[int] = Field(None, ge=0)
    max_staff_members: Optional[int] = Field(None, ge=1)
    max_services: Optional[int] = Field(None, ge=1)
    storage_gb: Optional[int] = Field(None, ge=1)

    # Features
    priority_support: bool = False
    custom_branding: bool = False
    api_access: bool = False
    advanced_analytics: bool = False
    multi_location: bool = False

    # Pricing
    booking_discount_percentage: Decimal = Field(Decimal("0"), ge=0, le=100)
    setup_fee: Decimal = Field(Decimal("0"), ge=0)
    trial_days: int = Field(0, ge=0, le=365)

    # Features list
    features: List[str] = []
    is_featured: bool = False
    display_order: int = 0

    @field_validator('price_yearly')
    def yearly_should_be_discounted(cls, v: Decimal, info: ValidationInfo) -> Decimal:
        """Yearly price should typically be less than 12x monthly."""
        price_monthly = info.data.get('price_monthly') if info.data else None
        if price_monthly is not None:
            monthly_yearly = price_monthly * 12
            if v > monthly_yearly:
                raise ValueError('Yearly price should not exceed 12x monthly price')
        return v


# User Subscription Models
class Subscription(BaseModel):
    """User subscription with comprehensive details."""
    id: UUID
    user_id: UUID
    plan_id: UUID
    status: SubscriptionStatus
    billing_period: BillingPeriod

    # Pricing
    amount: Decimal
    currency: str = "DKK"

    # Dates
    starts_at: datetime
    ends_at: datetime
    trial_ends_at: Optional[datetime] = None
    next_billing_date: Optional[datetime] = None

    # Usage tracking
    bookings_used_this_period: int = 0
    current_period_start: datetime
    current_period_end: datetime

    # Mollie integration
    mollie_subscription_id: Optional[str] = None
    mollie_customer_id: Optional[str] = None
    mollie_mandate_id: Optional[str] = None

    # Cancellation
    cancel_at_period_end: bool = False
    canceled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None

    # Metadata
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


class SubscriptionCreate(BaseModel):
    """Create subscription request."""
    plan_id: UUID
    billing_period: BillingPeriod
    trial_period_override: Optional[int] = Field(None, ge=0, le=365)
    metadata: Optional[Dict[str, Any]] = None


class SubscriptionUpdate(BaseModel):
    """Update subscription request."""
    plan_id: Optional[UUID] = None
    billing_period: Optional[BillingPeriod] = None
    cancel_at_period_end: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None


# Usage and Analytics Models
class SubscriptionUsage(BaseModel):
    """Subscription usage analytics."""
    subscription_id: UUID
    period_start: datetime
    period_end: datetime

    # Usage metrics
    bookings_count: int = 0
    revenue_generated: Decimal = Decimal("0")
    services_used: int = 0
    staff_active: int = 0
    storage_used_gb: Decimal = Decimal("0")
    api_calls: int = 0

    # Feature usage
    advanced_features_used: List[str] = []

    # Performance metrics
    average_booking_value: Decimal = Decimal("0")
    customer_satisfaction_score: Optional[Decimal] = None


class UsageReport(BaseModel):
    """Usage report for subscription analytics."""
    subscription_id: UUID
    user_id: UUID
    plan_name: str
    period: str

    # Current usage vs limits
    bookings_used: int
    bookings_limit: Optional[int]
    bookings_usage_percentage: Optional[float]

    staff_count: int
    staff_limit: Optional[int]

    services_count: int
    services_limit: Optional[int]

    storage_used_gb: Decimal
    storage_limit_gb: Optional[int]

    # Recommendations
    needs_upgrade: bool = False
    recommended_plan: Optional[str] = None
    cost_savings_yearly: Optional[Decimal] = None


# Invoice and Billing Models
class Invoice(BaseModel):
    """Subscription invoice."""
    id: UUID
    subscription_id: UUID
    user_id: UUID
    invoice_number: str

    # Amounts
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    currency: str = "DKK"

    # Status and dates
    status: str  # draft, open, paid, void, uncollectible
    due_date: Optional[datetime] = None
    issued_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None

    # Period
    period_start: datetime
    period_end: datetime

    # Line items
    line_items: List[Dict[str, Any]] = []

    # Mollie integration
    mollie_invoice_id: Optional[str] = None
    mollie_payment_id: Optional[str] = None

    # Files
    pdf_url: Optional[str] = None

    created_at: datetime


class InvoiceItem(BaseModel):
    """Individual invoice line item."""
    description: str
    quantity: int = 1
    unit_price: Decimal
    total_price: Decimal
    tax_rate: Decimal = Decimal("0")
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


class InvoiceCreate(BaseModel):
    """Create invoice request."""
    subscription_id: UUID
    line_items: List[InvoiceItem]
    due_date: Optional[datetime] = None
    notes: Optional[str] = None


# Plan Comparison Models
class PlanComparison(BaseModel):
    """Plan comparison for upgrade/downgrade decisions."""
    current_plan: SubscriptionPlan
    target_plan: SubscriptionPlan

    # Cost analysis
    monthly_difference: Decimal
    yearly_difference: Decimal
    proration_amount: Decimal

    # Feature comparison
    features_gained: List[str]
    features_lost: List[str]
    limits_changed: Dict[str, Dict[str, Any]]  # limit_name -> {old: x, new: y}

    # Recommendations
    recommended_billing_period: BillingPeriod
    effective_date: datetime

    # Calculations
    savings_yearly: Decimal
    roi_months: Optional[int] = None


# Webhook and Event Models
class SubscriptionEvent(BaseModel):
    """Subscription lifecycle event."""
    id: UUID
    subscription_id: UUID
    user_id: UUID
    event_type: str  # created, updated, canceled, renewed, trial_ended

    # Event data
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None

    # Context
    triggered_by: Optional[UUID] = None  # User ID who triggered
    mollie_event_id: Optional[str] = None

    # Metadata
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


# Analytics Models
class SubscriptionAnalytics(BaseModel):
    """Subscription business analytics."""
    period_start: datetime
    period_end: datetime

    # Revenue metrics
    total_revenue: Decimal
    recurring_revenue: Decimal
    new_revenue: Decimal
    expansion_revenue: Decimal
    contraction_revenue: Decimal
    churn_revenue: Decimal

    # Customer metrics
    total_subscribers: int
    new_subscribers: int
    churned_subscribers: int
    active_trials: int

    # Plan distribution
    subscribers_by_plan: Dict[str, int]
    revenue_by_plan: Dict[str, Decimal]

    # Key metrics
    monthly_churn_rate: Decimal
    customer_lifetime_value: Decimal
    average_revenue_per_user: Decimal

    # Growth metrics
    monthly_growth_rate: Decimal
    yearly_growth_rate: Decimal


# Payment Method Models
class PaymentMethodInfo(BaseModel):
    """Payment method information for subscriptions."""
    id: str
    type: str  # card, sepa_debit, etc.
    last_four: Optional[str] = None
    brand: Optional[str] = None
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    is_default: bool = False
    mollie_mandate_id: Optional[str] = None
    created_at: datetime


class PaymentMethodUpdate(BaseModel):
    """Update payment method request."""
    is_default: Optional[bool] = None
    billing_address: Optional[Dict[str, str]] = None


# Subscription Management Actions
class SubscriptionAction(BaseModel):
    """Subscription management action."""
    action: str  # upgrade, downgrade, cancel, reactivate, change_payment_method
    effective_date: Optional[datetime] = None
    reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class BulkSubscriptionAction(BaseModel):
    """Bulk subscription action for admin operations."""
    subscription_ids: List[UUID]
    action: SubscriptionAction
    send_notifications: bool = True
    dry_run: bool = False


# Subscription Metrics Dashboard Models
class DashboardMetrics(BaseModel):
    """Dashboard metrics for subscription overview."""
    # Current state
    active_subscriptions: int
    trial_subscriptions: int
    canceled_subscriptions: int
    total_subscribers: int

    # Revenue
    monthly_recurring_revenue: Decimal
    annual_recurring_revenue: Decimal
    average_revenue_per_user: Decimal

    # Growth
    new_subscribers_this_month: int
    churned_subscribers_this_month: int
    growth_rate: Decimal
    churn_rate: Decimal

    # Popular plans
    most_popular_plan: str
    highest_revenue_plan: str

    # Forecasting
    predicted_revenue_next_month: Decimal
    predicted_churn_next_month: int