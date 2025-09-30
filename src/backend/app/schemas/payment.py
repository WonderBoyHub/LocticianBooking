"""
Payment-related Pydantic models for Mollie integration and transaction handling.
"""
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class PaymentTransactionBase(BaseModel):
    """Base payment transaction model."""
    transaction_type: str = Field(..., pattern="^(subscription|booking|refund|partial_refund)$")
    amount: Decimal = Field(..., ge=0)
    currency: str = Field("USD", max_length=3)
    status: str = Field(..., max_length=50)
    molly_transaction_id: Optional[str] = Field(None, max_length=255)
    molly_payment_intent_id: Optional[str] = Field(None, max_length=255)
    molly_charge_id: Optional[str] = Field(None, max_length=255)
    metadata: Optional[Dict[str, Any]] = None
    failure_reason: Optional[str] = None

    @field_validator('currency')
    def validate_currency(cls, v: str) -> str:
        if len(v) != 3:
            raise ValueError('Currency must be exactly 3 characters')
        return v.upper()


class PaymentTransactionCreate(PaymentTransactionBase):
    """Schema for creating a payment transaction."""
    user_id: UUID
    subscription_id: Optional[UUID] = None
    booking_id: Optional[UUID] = None


class PaymentTransactionUpdate(BaseModel):
    """Schema for updating a payment transaction."""
    status: Optional[str] = Field(None, max_length=50)
    molly_transaction_id: Optional[str] = Field(None, max_length=255)
    molly_payment_intent_id: Optional[str] = Field(None, max_length=255)
    molly_charge_id: Optional[str] = Field(None, max_length=255)
    metadata: Optional[Dict[str, Any]] = None
    failure_reason: Optional[str] = None
    processed_at: Optional[datetime] = None


class PaymentTransaction(PaymentTransactionBase):
    """Complete payment transaction model."""
    id: UUID
    user_id: UUID
    subscription_id: Optional[UUID] = None
    booking_id: Optional[UUID] = None
    processed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Molly Payment Integration Models

class MollyPaymentIntent(BaseModel):
    """Molly payment intent creation."""
    amount: Decimal = Field(..., ge=0)
    currency: str = Field("USD", max_length=3)
    payment_method_types: list = Field(default=["card"])
    metadata: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    customer_id: Optional[str] = None

    @field_validator('currency')
    def validate_currency(cls, v: str) -> str:
        return v.upper()


class MollyPaymentIntentResponse(BaseModel):
    """Response from Molly payment intent creation."""
    id: str
    client_secret: str
    amount: Decimal
    currency: str
    status: str
    metadata: Dict[str, Any] = {}


class MollyCustomer(BaseModel):
    """Molly customer creation/update."""
    email: str = Field(..., max_length=255)
    name: Optional[str] = None
    phone: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class MollyCustomerResponse(BaseModel):
    """Response from Molly customer operations."""
    id: str
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    metadata: Dict[str, Any] = {}
    created_at: datetime


class MollySubscription(BaseModel):
    """Molly subscription creation."""
    customer_id: str
    price_id: str
    payment_method_id: Optional[str] = None
    trial_period_days: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class MollySubscriptionResponse(BaseModel):
    """Response from Molly subscription operations."""
    id: str
    customer_id: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    plan: Dict[str, Any]
    metadata: Dict[str, Any] = {}


class MollyWebhookEvent(BaseModel):
    """Molly webhook event structure."""
    id: str
    type: str
    data: Dict[str, Any]
    created_at: datetime
    livemode: bool = False


# Payment Method Models

class PaymentMethod(BaseModel):
    """Payment method information."""
    id: str
    type: str
    card: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = {}


class PaymentMethodCreate(BaseModel):
    """Payment method creation."""
    type: str = Field(default="card")
    card: Optional[Dict[str, str]] = None
    billing_details: Optional[Dict[str, str]] = None


# Checkout Session Models

class CheckoutSessionCreate(BaseModel):
    """Checkout session creation for subscription purchase."""
    user_id: UUID
    plan_id: int
    success_url: str
    cancel_url: str
    metadata: Optional[Dict[str, Any]] = None


class CheckoutSessionResponse(BaseModel):
    """Checkout session response."""
    id: str
    url: str
    payment_status: str
    expires_at: datetime


# Refund Models

class RefundCreate(BaseModel):
    """Refund creation."""
    payment_transaction_id: UUID
    amount: Optional[Decimal] = None  # If None, refund full amount
    reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class RefundResponse(BaseModel):
    """Refund response."""
    id: str
    amount: Decimal
    currency: str
    status: str
    reason: Optional[str] = None
    created_at: datetime
