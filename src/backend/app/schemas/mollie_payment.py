"""
Mollie Payment API schemas based on official Mollie API documentation.
https://docs.mollie.com/reference/overview
"""
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# Core Mollie Payment Models
class MollieAmount(BaseModel):
    """Mollie amount representation."""
    currency: str = Field(..., description="Three-letter ISO currency code")
    value: str = Field(..., description="Amount as string with exactly 2 decimals")

    @field_validator('currency')
    def validate_currency(cls, v: str) -> str:
        if len(v) != 3:
            raise ValueError('Currency must be exactly 3 characters')
        return v.upper()

    @field_validator('value')
    def validate_value(cls, v: str) -> str:
        try:
            amount = Decimal(v)
            if amount < 0:
                raise ValueError('Amount must be positive')
            # Check decimal places
            if '.' in v and len(v.split('.')[1]) != 2:
                raise ValueError('Amount must have exactly 2 decimal places')
        except (ValueError, InvalidOperation):
            raise ValueError('Invalid amount format')
        return v


class MollieAddress(BaseModel):
    """Address information for Mollie payments."""
    streetAndNumber: Optional[str] = None
    streetAdditional: Optional[str] = None
    postalCode: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None


class MolliePaymentMethod(BaseModel):
    """Mollie payment method configuration."""
    resource: str = "method"
    id: str
    description: str
    minimumAmount: Optional[MollieAmount] = None
    maximumAmount: Optional[MollieAmount] = None
    image: Optional[Dict[str, str]] = None
    pricing: Optional[List[Dict[str, Any]]] = None


# Payment Creation Models
class MolliePaymentCreate(BaseModel):
    """Create payment request for Mollie API."""
    amount: MollieAmount
    description: str = Field(..., max_length=255)
    redirectUrl: str = Field(..., description="URL to redirect customer after payment")
    webhookUrl: Optional[str] = Field(None, description="Webhook URL for status updates")
    method: Optional[List[str]] = Field(None, description="Limit payment methods")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Custom metadata")

    # Optional fields
    locale: Optional[str] = Field(None, description="Customer language preference")
    customerId: Optional[str] = Field(None, description="Mollie customer ID")
    mandateId: Optional[str] = Field(None, description="Mandate for recurring payments")
    sequenceType: Optional[str] = Field(None, description="Payment sequence type")
    billingAddress: Optional[MollieAddress] = None
    shippingAddress: Optional[MollieAddress] = None

    # Due date for bank transfers
    dueDate: Optional[str] = Field(None, description="Due date for bank transfer")

    @field_validator('sequenceType')
    def validate_sequence_type(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in ['oneoff', 'first', 'recurring']:
            raise ValueError('Invalid sequence type')
        return v


class MolliePaymentLinks(BaseModel):
    """Payment links from Mollie response."""
    self: Dict[str, str]
    checkout: Optional[Dict[str, str]] = None
    dashboard: Optional[Dict[str, str]] = None
    documentation: Optional[Dict[str, str]] = None


class MolliePaymentResponse(BaseModel):
    """Response from Mollie payment creation/retrieval."""
    resource: str = "payment"
    id: str
    mode: str  # live or test
    createdAt: datetime
    status: str
    isCancelable: bool
    amount: MollieAmount
    amountRefunded: Optional[MollieAmount] = None
    amountRemaining: Optional[MollieAmount] = None
    amountCaptured: Optional[MollieAmount] = None
    amountChargedBack: Optional[MollieAmount] = None
    description: str
    redirectUrl: str
    webhookUrl: Optional[str] = None
    method: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    locale: Optional[str] = None
    countryCode: Optional[str] = None
    profileId: str
    settlementAmount: Optional[MollieAmount] = None
    settlementId: Optional[str] = None
    customerId: Optional[str] = None
    mandateId: Optional[str] = None
    subscriptionId: Optional[str] = None
    orderId: Optional[str] = None

    # Payment method specific details
    details: Optional[Dict[str, Any]] = None

    # Links
    _links: MolliePaymentLinks

    # Dates
    authorizedAt: Optional[datetime] = None
    paidAt: Optional[datetime] = None
    canceledAt: Optional[datetime] = None
    expiresAt: Optional[datetime] = None
    expiredAt: Optional[datetime] = None
    failedAt: Optional[datetime] = None


# Customer Management Models
class MollieCustomerCreate(BaseModel):
    """Create customer request for Mollie API."""
    name: Optional[str] = Field(None, max_length=256)
    email: Optional[str] = Field(None, max_length=320)
    locale: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class MollieCustomerResponse(BaseModel):
    """Response from Mollie customer operations."""
    resource: str = "customer"
    id: str
    mode: str
    name: Optional[str] = None
    email: Optional[str] = None
    locale: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    createdAt: datetime
    _links: Dict[str, Any]


# Subscription Models
class MollieSubscriptionCreate(BaseModel):
    """Create subscription request for Mollie API."""
    amount: MollieAmount
    times: Optional[int] = Field(None, description="Number of payments")
    interval: str = Field(..., description="Payment interval")
    description: str = Field(..., max_length=255)
    method: Optional[List[str]] = Field(None, description="Allowed payment methods")
    mandateId: Optional[str] = Field(None, description="Mandate for payments")
    webhookUrl: Optional[str] = Field(None, description="Webhook URL")
    metadata: Optional[Dict[str, Any]] = None

    @field_validator('interval')
    def validate_interval(cls, v: str) -> str:
        # Validate interval format (e.g., "1 month", "2 weeks")
        parts = v.split()
        if len(parts) != 2:
            raise ValueError('Interval must be in format "X period"')
        try:
            int(parts[0])
        except ValueError:
            raise ValueError('Interval must start with a number')
        valid_periods = {'day', 'days', 'week', 'weeks', 'month', 'months'}
        if parts[1] not in valid_periods:
            raise ValueError('Interval period must be days, weeks, or months')
        return v


class MollieSubscriptionResponse(BaseModel):
    """Response from Mollie subscription operations."""
    resource: str = "subscription"
    id: str
    mode: str
    createdAt: datetime
    status: str
    amount: MollieAmount
    times: Optional[int] = None
    timesRemaining: Optional[int] = None
    interval: str
    description: str
    method: Optional[str] = None
    mandateId: Optional[str] = None
    webhookUrl: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    customerId: str
    nextPaymentDate: Optional[str] = None
    startDate: Optional[str] = None
    _links: Dict[str, Any]


# Webhook Models
class MollieWebhookPayload(BaseModel):
    """Webhook payload from Mollie."""
    id: str

    @field_validator('id')
    def validate_id(cls, v: str) -> str:
        if not v.startswith(('tr_', 'sub_', 'ord_', 'chb_', 'rf_')):
            raise ValueError('Invalid Mollie ID format')
        return v


# Mandate Models
class MollieMandateCreate(BaseModel):
    """Create mandate request for recurring payments."""
    method: str = Field(..., description="Payment method for mandate")
    consumerName: Optional[str] = Field(None, description="Consumer name")
    consumerAccount: Optional[str] = Field(None, description="Consumer account")
    consumerBic: Optional[str] = Field(None, description="Consumer BIC")
    signatureDate: Optional[str] = Field(None, description="Signature date")
    mandateReference: Optional[str] = Field(None, description="Mandate reference")

    @field_validator('method')
    def validate_method(cls, v: str) -> str:
        if v not in ['directdebit', 'creditcard', 'paypal']:
            raise ValueError('Invalid mandate method')
        return v


class MollieMandateResponse(BaseModel):
    """Response from Mollie mandate operations."""
    resource: str = "mandate"
    id: str
    mode: str
    status: str
    method: str
    details: Optional[Dict[str, Any]] = None
    mandateReference: Optional[str] = None
    signatureDate: Optional[str] = None
    createdAt: datetime
    _links: Dict[str, Any]


# Refund Models
class MollieRefundCreate(BaseModel):
    """Create refund request for Mollie API."""
    amount: Optional[MollieAmount] = Field(None, description="Amount to refund")
    description: Optional[str] = Field(None, max_length=255)
    metadata: Optional[Dict[str, Any]] = None


class MollieRefundResponse(BaseModel):
    """Response from Mollie refund operations."""
    resource: str = "refund"
    id: str
    amount: MollieAmount
    settlementId: Optional[str] = None
    settlementAmount: Optional[MollieAmount] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    status: str
    paymentId: str
    createdAt: datetime
    _links: Dict[str, Any]


# Enhanced payment schemas for internal use
class PaymentIntent(BaseModel):
    """Internal payment intent representation."""
    id: str
    user_id: UUID
    booking_id: Optional[UUID] = None
    amount: Decimal
    currency: str
    status: str
    payment_type: str  # 'booking', 'subscription', 'refund'
    checkout_url: Optional[str] = None
    mollie_payment_id: Optional[str] = None
    created_at: datetime


class PaymentIntentCreate(BaseModel):
    """Create payment intent request."""
    booking_id: Optional[UUID] = None
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="DKK", max_length=3)
    description: str = Field(..., max_length=255)
    payment_type: str = Field(..., pattern="^(booking|subscription)$")
    metadata: Optional[Dict[str, Any]] = None


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


class PaymentStatus(BaseModel):
    """Payment status information."""
    payment_id: str
    status: str
    amount: Decimal
    currency: str
    created_at: datetime
    updated_at: datetime


class RefundRequest(BaseModel):
    """Refund request."""
    amount: Optional[Decimal] = Field(None, gt=0)
    reason: Optional[str] = Field(None, max_length=500)


class RefundResponse(BaseModel):
    """Refund response."""
    id: str
    payment_id: str
    amount: Decimal
    status: str
    created_at: datetime


class WebhookEvent(BaseModel):
    """Webhook event representation."""
    id: str
    type: str
    data: Dict[str, Any]
    created_at: datetime
    livemode: bool = False
