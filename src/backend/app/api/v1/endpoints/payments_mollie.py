"""
Mollie Payment Integration with subscription management, webhooks, and billing.
Complete implementation with proper Mollie API integration.
"""
import json
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status, Header, Query
from fastapi.responses import JSONResponse
from sqlalchemy import and_, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    get_current_user,
    get_current_admin,
    require_admin,
    get_optional_user,
    rate_limit_check
)
from app.core.config import settings
from app.core.database import get_db
from app.models.booking import Booking
from app.models.enums import BookingStatus, PaymentStatus, UserRole
from app.models.user import User
from app.services.mollie_service import (
    mollie_service,
    MollieServiceError,
    MollieAPIError,
    create_payment_for_booking,
    create_subscription_payment
)
from app.schemas.mollie_payment import (
    MolliePaymentCreate,
    MollieCustomerCreate,
    MollieSubscriptionCreate,
    MollieAmount,
    PaymentIntent,
    PaymentIntentCreate,
    PaymentMethod,
    PaymentMethodCreate,
    PaymentStatus as PaymentStatusSchema,
    RefundRequest,
    RefundResponse,
    WebhookEvent,
)
from app.schemas.subscription_extended import (
    SubscriptionPlan,
    SubscriptionCreate,
    Subscription,
    SubscriptionStatus,
    BillingPeriod,
    SubscriptionTier,
    Invoice,
    InvoiceItem,
)

logger = structlog.get_logger(__name__)

router = APIRouter()


# Payment Intent Endpoints
@router.post("/payments/create-intent", response_model=PaymentIntent, status_code=status.HTTP_201_CREATED)
async def create_payment_intent(
    payment_data: PaymentIntentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> PaymentIntent:
    """Create payment intent for booking or subscription using Mollie with enhanced validation."""
    try:
        # Enhanced payment validation
        if not mollie_service.validate_payment_amount(payment_data.amount, payment_data.currency):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payment amount"
            )

        # Validate customer data
        customer_name = f"{current_user.first_name} {current_user.last_name}".strip()
        if not mollie_service.validate_customer_data(current_user.email, customer_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid customer data"
            )

        # Validate booking if provided
        booking = None
        if payment_data.booking_id:
            booking_query = await db.execute(
                select(Booking).where(
                    and_(
                        Booking.id == payment_data.booking_id,
                        Booking.customer_id == current_user.id
                    )
                )
            )
            booking = booking_query.scalar()
            if not booking:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Booking not found"
                )

        # Create URLs
        base_url = settings.BACKEND_CORS_ORIGINS[0] if settings.BACKEND_CORS_ORIGINS else "http://localhost:8000"
        webhook_url = f"{base_url}/api/v1/payments/webhook"
        redirect_url = f"{base_url}/payment/success"

        # Prepare metadata
        metadata = {
            "user_id": str(current_user.id),
            "payment_type": payment_data.payment_type,
        }
        if booking:
            metadata["booking_id"] = str(booking.id)

        # Create Mollie payment
        mollie_payment_data = MolliePaymentCreate(
            amount=mollie_service.create_amount(payment_data.amount, payment_data.currency),
            description=payment_data.description,
            redirectUrl=redirect_url,
            webhookUrl=webhook_url,
            metadata=metadata
        )

        mollie_payment = await mollie_service.create_payment(mollie_payment_data)

        # Store payment intent in database
        payment_intent_id = mollie_payment.id

        await db.execute(
            text("""
                INSERT INTO payment_intents (
                    id, user_id, booking_id, amount, currency, status,
                    payment_type, mollie_payment_id, checkout_url, created_at
                ) VALUES (
                    gen_random_uuid(), :user_id::uuid, :booking_id::uuid, :amount, :currency, 'pending',
                    :payment_type, :mollie_payment_id, :checkout_url, NOW()
                )
            """),
            {
                "user_id": current_user.id,
                "booking_id": payment_data.booking_id,
                "amount": payment_data.amount,
                "currency": payment_data.currency,
                "payment_type": payment_data.payment_type,
                "mollie_payment_id": payment_intent_id,
                "checkout_url": mollie_service.get_checkout_url(mollie_payment)
            }
        )

        await db.commit()

        logger.info(
            "Payment intent created",
            user_id=current_user.id,
            mollie_payment_id=payment_intent_id,
            amount=float(payment_data.amount)
        )

        return PaymentIntent(
            id=payment_intent_id,
            user_id=current_user.id,
            booking_id=payment_data.booking_id,
            amount=payment_data.amount,
            currency=payment_data.currency,
            status="pending",
            payment_type=payment_data.payment_type,
            checkout_url=mollie_service.get_checkout_url(mollie_payment),
            mollie_payment_id=payment_intent_id,
            created_at=datetime.utcnow()
        )

    except MollieAPIError as e:
        logger.error("Mollie API error creating payment", error=str(e), status_code=e.status_code)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment creation failed: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create payment intent error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment intent"
        )


@router.get("/payments/{payment_id}", response_model=Dict[str, Any])
async def get_payment_status(
    payment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Get payment status from Mollie."""
    try:
        # Verify user owns this payment
        payment_query = await db.execute(
            text("""
                SELECT * FROM payment_intents
                WHERE mollie_payment_id = :payment_id AND user_id = :user_id::uuid
            """),
            {"payment_id": payment_id, "user_id": current_user.id}
        )
        payment = payment_query.first()

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )

        # Get status from Mollie
        mollie_payment = await mollie_service.get_payment(payment_id)

        # Update local status if needed
        if mollie_payment.status != payment.status:
            await db.execute(
                text("""
                    UPDATE payment_intents
                    SET status = :status, updated_at = NOW()
                    WHERE mollie_payment_id = :payment_id
                """),
                {"status": mollie_payment.status, "payment_id": payment_id}
            )
            await db.commit()

        return {
            "id": mollie_payment.id,
            "status": mollie_payment.status,
            "amount": {
                "value": mollie_payment.amount.value,
                "currency": mollie_payment.amount.currency
            },
            "description": mollie_payment.description,
            "method": mollie_payment.method,
            "createdAt": mollie_payment.createdAt,
            "paidAt": mollie_payment.paidAt,
            "canceledAt": mollie_payment.canceledAt,
            "expiredAt": mollie_payment.expiredAt,
            "failedAt": mollie_payment.failedAt,
            "metadata": mollie_payment.metadata
        }

    except MollieAPIError as e:
        logger.error("Mollie API error getting payment", payment_id=payment_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get payment status: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get payment status error", payment_id=payment_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payment status"
        )


# Customer Management
@router.post("/customers/create", response_model=Dict[str, Any])
async def create_mollie_customer(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Create Mollie customer for recurring payments."""
    try:
        # Check if customer already exists
        existing_customer = await db.execute(
            text("""
                SELECT mollie_customer_id FROM user_payment_customers
                WHERE user_id = :user_id::uuid
            """),
            {"user_id": current_user.id}
        )
        existing = existing_customer.scalar()

        if existing:
            # Return existing customer
            mollie_customer = await mollie_service.get_customer(existing)
            return {
                "id": mollie_customer.id,
                "email": mollie_customer.email,
                "name": mollie_customer.name,
                "created": False
            }

        # Create new customer
        customer_data = MollieCustomerCreate(
            name=f"{current_user.first_name} {current_user.last_name}",
            email=current_user.email,
            metadata={
                "user_id": str(current_user.id),
                "created_at": datetime.utcnow().isoformat()
            }
        )

        mollie_customer = await mollie_service.create_customer(customer_data)

        # Store customer ID
        await db.execute(
            text("""
                INSERT INTO user_payment_customers (user_id, mollie_customer_id, created_at)
                VALUES (:user_id::uuid, :mollie_customer_id, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    mollie_customer_id = EXCLUDED.mollie_customer_id,
                    updated_at = NOW()
            """),
            {"user_id": current_user.id, "mollie_customer_id": mollie_customer.id}
        )
        await db.commit()

        logger.info("Mollie customer created", user_id=current_user.id, customer_id=mollie_customer.id)

        return {
            "id": mollie_customer.id,
            "email": mollie_customer.email,
            "name": mollie_customer.name,
            "created": True
        }

    except MollieAPIError as e:
        logger.error("Mollie API error creating customer", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Customer creation failed: {str(e)}"
        )
    except Exception as e:
        logger.error("Create customer error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create customer"
        )


# Subscription Plans Management
@router.get("/subscriptions/plans", response_model=List[SubscriptionPlan])
async def list_subscription_plans(
    active_only: bool = Query(True, description="Show only active plans"),
    db: AsyncSession = Depends(get_db),
) -> List[SubscriptionPlan]:
    """List available subscription plans."""
    try:
        query = text("""
            SELECT
                id, name, description, plan_type as tier,
                price as price_monthly,
                CASE
                    WHEN billing_interval = 'yearly' THEN price
                    ELSE price * 10 -- 2 months free for yearly
                END as price_yearly,
                currency, max_bookings_per_month, max_staff_members, max_services,
                priority_support, custom_branding, api_access,
                booking_discount_percentage, setup_fee, trial_period_days as trial_days,
                molly_price_id as mollie_price_id_monthly, molly_product_id as mollie_product_id,
                features, is_active, is_featured, display_order, created_at
            FROM subscription_plans
            WHERE (:active_only = false OR is_active = true)
            ORDER BY display_order, price
        """)

        result = await db.execute(query, {"active_only": active_only})
        plans = []

        for row in result.fetchall():
            # Parse features JSON
            features_list = []
            if row.features:
                try:
                    features_data = json.loads(row.features) if isinstance(row.features, str) else row.features
                    if isinstance(features_data, list):
                        features_list = features_data
                    elif isinstance(features_data, dict):
                        features_list = list(features_data.keys())
                except (json.JSONDecodeError, TypeError):
                    features_list = []

            plan = SubscriptionPlan(
                id=row.id,
                name=row.name,
                description=row.description,
                tier=SubscriptionTier(row.tier) if row.tier else SubscriptionTier.BASIC,
                price_monthly=row.price_monthly,
                price_yearly=row.price_yearly,
                currency=row.currency,
                max_bookings_per_month=row.max_bookings_per_month,
                max_staff_members=row.max_staff_members,
                max_services=row.max_services,
                priority_support=row.priority_support or False,
                custom_branding=row.custom_branding or False,
                api_access=row.api_access or False,
                advanced_analytics=False,  # Add to DB schema if needed
                multi_location=False,  # Add to DB schema if needed
                booking_discount_percentage=row.booking_discount_percentage or Decimal("0"),
                setup_fee=row.setup_fee or Decimal("0"),
                trial_days=row.trial_days or 0,
                mollie_price_id_monthly=row.mollie_price_id_monthly,
                mollie_product_id=row.mollie_product_id,
                features=features_list,
                is_active=row.is_active,
                is_featured=row.is_featured or False,
                display_order=row.display_order or 0,
                created_at=row.created_at
            )
            plans.append(plan)

        return plans

    except Exception as e:
        logger.error("List subscription plans error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list subscription plans"
        )


@router.post("/subscriptions/create", response_model=Subscription, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    subscription_data: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> Subscription:
    """Create new subscription for user."""
    try:
        # Check if user already has active subscription
        existing_sub = await db.execute(
            text("""
                SELECT id FROM user_subscriptions us
                JOIN subscription_statuses ss ON us.status_id = ss.id
                WHERE us.user_id = :user_id::uuid
                AND ss.is_active_status = true
                AND us.current_period_end > NOW()
            """),
            {"user_id": current_user.id}
        )

        if existing_sub.scalar():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already has an active subscription"
            )

        # Get subscription plan
        plan_query = await db.execute(
            text("SELECT * FROM subscription_plans WHERE id = :plan_id::uuid AND is_active = true"),
            {"plan_id": subscription_data.plan_id}
        )
        plan = plan_query.first()

        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription plan not found"
            )

        # Get or create Mollie customer
        customer_query = await db.execute(
            text("SELECT mollie_customer_id FROM user_payment_customers WHERE user_id = :user_id::uuid"),
            {"user_id": current_user.id}
        )
        mollie_customer_id = customer_query.scalar()

        if not mollie_customer_id:
            # Create customer first
            customer_data = MollieCustomerCreate(
                name=f"{current_user.first_name} {current_user.last_name}",
                email=current_user.email,
                metadata={"user_id": str(current_user.id)}
            )
            mollie_customer = await mollie_service.create_customer(customer_data)
            mollie_customer_id = mollie_customer.id

            # Store customer ID
            await db.execute(
                text("""
                    INSERT INTO user_payment_customers (user_id, mollie_customer_id, created_at)
                    VALUES (:user_id::uuid, :mollie_customer_id, NOW())
                """),
                {"user_id": current_user.id, "mollie_customer_id": mollie_customer_id}
            )

        # Calculate pricing and dates
        amount = plan.price_monthly if subscription_data.billing_period == BillingPeriod.MONTHLY else plan.price_yearly
        interval = "1 month" if subscription_data.billing_period == BillingPeriod.MONTHLY else "1 year"

        starts_at = datetime.utcnow()
        if subscription_data.billing_period == BillingPeriod.MONTHLY:
            ends_at = starts_at + timedelta(days=30)
        else:
            ends_at = starts_at + timedelta(days=365)

        # Handle trial period
        trial_ends_at = None
        trial_days = subscription_data.trial_period_override or plan.trial_period_days
        if trial_days > 0:
            trial_ends_at = starts_at + timedelta(days=trial_days)

        # Create subscription with Mollie
        webhook_url = f"{settings.BACKEND_CORS_ORIGINS[0]}/api/v1/payments/webhook"

        subscription_mollie_data = MollieSubscriptionCreate(
            amount=mollie_service.create_amount(amount, "DKK"),
            interval=interval,
            description=f"Subscription: {plan.name}",
            webhookUrl=webhook_url,
            metadata={
                "user_id": str(current_user.id),
                "plan_id": str(subscription_data.plan_id),
                "billing_period": subscription_data.billing_period.value
            }
        )

        mollie_subscription = await mollie_service.create_subscription(
            mollie_customer_id, subscription_mollie_data
        )

        # Get active status ID
        status_query = await db.execute(
            text("SELECT id FROM subscription_statuses WHERE name = 'pending' OR is_active_status = false LIMIT 1")
        )
        status_id = status_query.scalar() or 1  # Default to 1 if not found

        # Store subscription in database
        subscription_id = await db.execute(
            text("""
                INSERT INTO user_subscriptions (
                    id, user_id, plan_id, status_id, billing_period,
                    amount, currency, starts_at, ends_at, trial_end,
                    current_period_start, current_period_end,
                    mollie_subscription_id, mollie_customer_id, created_at
                ) VALUES (
                    gen_random_uuid(), :user_id::uuid, :plan_id::uuid, :status_id,
                    :billing_period, :amount, :currency, :starts_at, :ends_at, :trial_end,
                    :starts_at, :ends_at, :mollie_subscription_id, :mollie_customer_id, NOW()
                ) RETURNING id
            """),
            {
                "user_id": current_user.id,
                "plan_id": subscription_data.plan_id,
                "status_id": status_id,
                "billing_period": subscription_data.billing_period.value,
                "amount": amount,
                "currency": "DKK",
                "starts_at": starts_at,
                "ends_at": ends_at,
                "trial_end": trial_ends_at,
                "mollie_subscription_id": mollie_subscription.id,
                "mollie_customer_id": mollie_customer_id
            }
        )

        sub_id = subscription_id.scalar()
        await db.commit()

        logger.info(
            "Subscription created",
            user_id=current_user.id,
            subscription_id=sub_id,
            plan_id=subscription_data.plan_id,
            mollie_subscription_id=mollie_subscription.id
        )

        return Subscription(
            id=sub_id,
            user_id=current_user.id,
            plan_id=subscription_data.plan_id,
            status=SubscriptionStatus.PENDING,
            billing_period=subscription_data.billing_period,
            amount=amount,
            currency="DKK",
            starts_at=starts_at,
            ends_at=ends_at,
            trial_ends_at=trial_ends_at,
            current_period_start=starts_at,
            current_period_end=ends_at,
            mollie_subscription_id=mollie_subscription.id,
            mollie_customer_id=mollie_customer_id,
            metadata=subscription_data.metadata,
            created_at=datetime.utcnow()
        )

    except MollieAPIError as e:
        logger.error("Mollie API error creating subscription", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subscription creation failed: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create subscription error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription"
        )


@router.get("/subscriptions/my-subscription", response_model=Optional[Subscription])
async def get_my_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Optional[Subscription]:
    """Get current user's active subscription."""
    try:
        subscription_query = await db.execute(
            text("""
                SELECT
                    us.id, us.user_id, us.plan_id, us.billing_period,
                    us.amount, us.currency, us.starts_at, us.ends_at, us.trial_end,
                    us.current_period_start, us.current_period_end,
                    us.mollie_subscription_id, us.mollie_customer_id,
                    us.cancel_at_period_end, us.cancelled_at, us.cancellation_reason,
                    us.metadata, us.created_at, us.bookings_used_this_period,
                    ss.name as status_name
                FROM user_subscriptions us
                JOIN subscription_statuses ss ON us.status_id = ss.id
                WHERE us.user_id = :user_id::uuid
                AND ss.is_active_status = true
                ORDER BY us.created_at DESC
                LIMIT 1
            """),
            {"user_id": current_user.id}
        )

        subscription = subscription_query.first()
        if not subscription:
            return None

        # Map status name to enum
        status_mapping = {
            'active': SubscriptionStatus.ACTIVE,
            'pending': SubscriptionStatus.PENDING,
            'trialing': SubscriptionStatus.TRIALING,
            'past_due': SubscriptionStatus.PAST_DUE,
            'canceled': SubscriptionStatus.CANCELED,
            'unpaid': SubscriptionStatus.UNPAID,
            'incomplete': SubscriptionStatus.INCOMPLETE,
            'incomplete_expired': SubscriptionStatus.INCOMPLETE_EXPIRED,
        }
        status = status_mapping.get(subscription.status_name, SubscriptionStatus.PENDING)

        return Subscription(
            id=subscription.id,
            user_id=subscription.user_id,
            plan_id=subscription.plan_id,
            status=status,
            billing_period=BillingPeriod(subscription.billing_period),
            amount=subscription.amount,
            currency=subscription.currency,
            starts_at=subscription.starts_at,
            ends_at=subscription.ends_at,
            trial_ends_at=subscription.trial_end,
            next_billing_date=None,  # Can be calculated or stored separately
            bookings_used_this_period=subscription.bookings_used_this_period,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            mollie_subscription_id=subscription.mollie_subscription_id,
            mollie_customer_id=subscription.mollie_customer_id,
            cancel_at_period_end=subscription.cancel_at_period_end or False,
            canceled_at=subscription.cancelled_at,
            cancellation_reason=subscription.cancellation_reason,
            metadata=subscription.metadata,
            created_at=subscription.created_at
        )

    except Exception as e:
        logger.error("Get user subscription error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get subscription"
        )


@router.post("/subscriptions/{subscription_id}/cancel", response_model=Subscription)
async def cancel_subscription(
    subscription_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    """Cancel user subscription."""
    try:
        # Get subscription and verify ownership
        subscription_query = await db.execute(
            text("""
                SELECT us.*, ss.name as status_name, ss.is_active_status
                FROM user_subscriptions us
                JOIN subscription_statuses ss ON us.status_id = ss.id
                WHERE us.id = :subscription_id::uuid
                AND us.user_id = :user_id::uuid
                AND ss.is_active_status = true
            """),
            {"subscription_id": subscription_id, "user_id": current_user.id}
        )

        subscription = subscription_query.first()
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active subscription not found"
            )

        # Cancel with Mollie
        if subscription.mollie_subscription_id and subscription.mollie_customer_id:
            await mollie_service.cancel_subscription(
                subscription.mollie_customer_id,
                subscription.mollie_subscription_id
            )

        # Get canceled status ID
        canceled_status_query = await db.execute(
            text("SELECT id FROM subscription_statuses WHERE name = 'canceled' LIMIT 1")
        )
        canceled_status_id = canceled_status_query.scalar() or 1

        # Update subscription status
        await db.execute(
            text("""
                UPDATE user_subscriptions
                SET status_id = :status_id, cancelled_at = NOW(),
                    cancellation_reason = 'User requested cancellation'
                WHERE id = :subscription_id::uuid
            """),
            {"subscription_id": subscription_id, "status_id": canceled_status_id}
        )

        await db.commit()

        logger.info(
            "Subscription cancelled",
            user_id=current_user.id,
            subscription_id=subscription_id
        )

        return Subscription(
            id=subscription.id,
            user_id=subscription.user_id,
            plan_id=subscription.plan_id,
            status=SubscriptionStatus.CANCELED,
            billing_period=BillingPeriod(subscription.billing_period),
            amount=subscription.amount,
            currency=subscription.currency,
            starts_at=subscription.starts_at,
            ends_at=subscription.ends_at,
            trial_ends_at=subscription.trial_end,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            mollie_subscription_id=subscription.mollie_subscription_id,
            mollie_customer_id=subscription.mollie_customer_id,
            canceled_at=datetime.utcnow(),
            cancellation_reason="User requested cancellation",
            created_at=subscription.created_at
        )

    except MollieAPIError as e:
        logger.error("Mollie API error canceling subscription", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subscription cancellation failed: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Cancel subscription error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription"
        )


# Webhook Handling
@router.post("/webhook", status_code=status.HTTP_200_OK)
async def handle_mollie_webhook(
    request: Request,
    mollie_signature: str = Header(None, alias="mollie-signature"),
    mollie_timestamp: Optional[str] = Header(None, alias="mollie-timestamp"),
    db: AsyncSession = Depends(get_db),
):
    """Handle Mollie payment webhooks with enhanced security."""
    try:
        # Get raw body
        body = await request.body()

        # Enhanced webhook signature verification with timestamp
        if not mollie_service.verify_webhook_signature(body, mollie_signature, mollie_timestamp):
            logger.warning("Invalid webhook signature received",
                         has_signature=bool(mollie_signature),
                         has_timestamp=bool(mollie_timestamp))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature"
            )

        # Parse webhook data
        try:
            webhook_data = json.loads(body)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload"
            )

        # Extract payment/subscription ID
        resource_id = webhook_data.get("id")
        if not resource_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing resource ID in webhook"
            )

        logger.info("Webhook received", resource_id=resource_id)

        # Determine resource type and handle accordingly
        if resource_id.startswith("tr_"):
            # Payment webhook
            await _handle_payment_webhook(resource_id, db)
        elif resource_id.startswith("sub_"):
            # Subscription webhook
            await _handle_subscription_webhook(resource_id, db)
        else:
            logger.warning("Unknown webhook resource type", resource_id=resource_id)

        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Webhook handling error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed"
        )


async def _handle_payment_webhook(payment_id: str, db: AsyncSession):
    """Handle payment webhook events."""
    try:
        # Get payment details from Mollie
        mollie_payment = await mollie_service.get_payment(payment_id)

        # Update payment intent status
        await db.execute(
            text("""
                UPDATE payment_intents
                SET status = :status, updated_at = NOW()
                WHERE mollie_payment_id = :payment_id
            """),
            {"status": mollie_payment.status, "payment_id": payment_id}
        )

        # If payment is successful, update related booking
        if mollie_payment.status == "paid":
            booking_query = await db.execute(
                text("""
                    SELECT booking_id FROM payment_intents
                    WHERE mollie_payment_id = :payment_id AND booking_id IS NOT NULL
                """),
                {"payment_id": payment_id}
            )

            booking_id = booking_query.scalar()
            if booking_id:
                await db.execute(
                    update(Booking)
                    .where(Booking.id == booking_id)
                    .values(payment_status=PaymentStatus.PAID, status=BookingStatus.CONFIRMED)
                )

        await db.commit()
        logger.info("Payment webhook processed", payment_id=payment_id, status=mollie_payment.status)

    except Exception as e:
        logger.error("Payment webhook processing error", payment_id=payment_id, error=str(e))
        raise


async def _handle_subscription_webhook(subscription_id: str, db: AsyncSession):
    """Handle subscription webhook events."""
    try:
        # Find subscription in our database
        subscription_query = await db.execute(
            text("""
                SELECT us.*, ss.name as current_status
                FROM user_subscriptions us
                JOIN subscription_statuses ss ON us.status_id = ss.id
                WHERE us.mollie_subscription_id = :subscription_id
            """),
            {"subscription_id": subscription_id}
        )

        subscription = subscription_query.first()
        if not subscription:
            logger.warning("Subscription not found for webhook", subscription_id=subscription_id)
            return

        # Get subscription details from Mollie
        mollie_subscription = await mollie_service.get_subscription(
            subscription.mollie_customer_id,
            subscription_id
        )

        # Map Mollie status to our status
        status_mapping = {
            "pending": "pending",
            "active": "active",
            "canceled": "canceled",
            "suspended": "past_due",
            "completed": "completed"
        }

        new_status = status_mapping.get(mollie_subscription.status, "pending")

        # Update subscription status if changed
        if new_status != subscription.current_status:
            status_id_query = await db.execute(
                text("SELECT id FROM subscription_statuses WHERE name = :status LIMIT 1"),
                {"status": new_status}
            )
            status_id = status_id_query.scalar()

            if status_id:
                await db.execute(
                    text("""
                        UPDATE user_subscriptions
                        SET status_id = :status_id, updated_at = NOW()
                        WHERE mollie_subscription_id = :subscription_id
                    """),
                    {"status_id": status_id, "subscription_id": subscription_id}
                )

        await db.commit()
        logger.info("Subscription webhook processed", subscription_id=subscription_id, status=mollie_subscription.status)

    except Exception as e:
        logger.error("Subscription webhook processing error", subscription_id=subscription_id, error=str(e))
        raise


# Refund Operations (Admin Only)
@router.post("/refunds/{payment_id}/create", response_model=RefundResponse)
async def create_refund(
    payment_id: str,
    refund_data: RefundRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> RefundResponse:
    """Create refund for payment (admin only)."""
    try:
        # Get payment intent
        payment_query = await db.execute(
            text("SELECT * FROM payment_intents WHERE mollie_payment_id = :payment_id"),
            {"payment_id": payment_id}
        )
        payment = payment_query.first()

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )

        # Create refund with Mollie
        from app.schemas.mollie_payment import MollieRefundCreate
        mollie_refund_data = MollieRefundCreate(
            amount=mollie_service.create_amount(refund_data.amount, payment.currency) if refund_data.amount else None,
            description=refund_data.reason,
            metadata={
                "admin_user_id": str(current_user.id),
                "refund_reason": refund_data.reason
            }
        )

        mollie_refund = await mollie_service.create_refund(payment_id, mollie_refund_data)

        # Store refund in database
        await db.execute(
            text("""
                INSERT INTO refunds (
                    id, payment_intent_id, mollie_refund_id, amount, reason, status, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), :payment_intent_id::uuid, :mollie_refund_id, :amount, :reason, 'processing', :created_by::uuid, NOW()
                )
            """),
            {
                "payment_intent_id": payment.id,
                "mollie_refund_id": mollie_refund.id,
                "amount": refund_data.amount or payment.amount,
                "reason": refund_data.reason,
                "created_by": current_user.id
            }
        )

        await db.commit()

        logger.info(
            "Refund created",
            payment_id=payment_id,
            refund_id=mollie_refund.id,
            amount=refund_data.amount or payment.amount,
            created_by=current_user.id
        )

        return RefundResponse(
            id=mollie_refund.id,
            payment_id=payment_id,
            amount=Decimal(mollie_refund.amount.value),
            status=mollie_refund.status,
            created_at=mollie_refund.createdAt
        )

    except MollieAPIError as e:
        logger.error("Mollie API error creating refund", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Refund creation failed: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create refund error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create refund"
        )


# Payment Methods
@router.get("/payment-methods", response_model=List[Dict[str, Any]])
async def list_payment_methods(
    amount: Optional[Decimal] = Query(None, description="Filter by minimum amount"),
    currency: str = Query("DKK", description="Currency code"),
    danish_optimized: bool = Query(True, description="Optimize for Danish customers"),
) -> List[Dict[str, Any]]:
    """List available payment methods from Mollie with Danish optimization."""
    try:
        if danish_optimized:
            methods = await mollie_service.get_danish_payment_methods(amount)
        else:
            mollie_amount = None
            if amount:
                mollie_amount = mollie_service.create_amount(amount, currency)
            methods = await mollie_service.list_payment_methods(mollie_amount)

        return [
            {
                "id": method.get("id"),
                "displayName": method.get("displayName", method.get("description")),
                "description": method.get("description"),
                "image": method.get("image", {}).get("size1x", ""),
                "minimumAmount": method.get("minimumAmount"),
                "maximumAmount": method.get("maximumAmount"),
                "priority": method.get("priority", 10),
                "pricing": method.get("pricing", [])
            }
            for method in methods
        ]

    except Exception as e:
        logger.error("List payment methods error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list payment methods"
        )


@router.get("/payment-methods/danish", response_model=List[Dict[str, Any]])
async def list_danish_payment_methods(
    amount: Optional[Decimal] = Query(None, description="Filter by amount"),
) -> List[Dict[str, Any]]:
    """List Danish-optimized payment methods with MobilePay priority."""
    try:
        methods = await mollie_service.get_danish_payment_methods(amount)

        return [
            {
                "id": method.get("id"),
                "displayName": method.get("displayName", method.get("description")),
                "description": method.get("description"),
                "image": method.get("image", {}).get("size1x", ""),
                "minimumAmount": method.get("minimumAmount"),
                "maximumAmount": method.get("maximumAmount"),
                "priority": method.get("priority", 10),
                "recommended": method.get("priority", 10) <= 4,
                "pricing": method.get("pricing", [])
            }
            for method in methods
        ]

    except Exception as e:
        logger.error("List Danish payment methods error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list Danish payment methods"
        )


# Health Check
@router.get("/health")
async def health_check():
    """Health check endpoint for payment service."""
    try:
        # Test Mollie API connection
        org = await mollie_service.get_organization()

        return {
            "status": "healthy",
            "mollie_connected": True,
            "organization": org.get("name", "Unknown"),
            "test_mode": mollie_service.test_mode,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "mollie_connected": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )