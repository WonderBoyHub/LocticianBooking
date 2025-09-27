"""
Molly Payment Integration with subscription management, webhooks, and billing.
"""
import hmac
import hashlib
import json
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any

import structlog
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status, Header
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
from app.schemas.payment import (
    PaymentIntent,
    PaymentIntentCreate,
    PaymentMethod,
    PaymentMethodCreate,
    PaymentStatus as PaymentStatusSchema,
    RefundRequest,
    RefundResponse,
    WebhookEvent,
)
from app.schemas.subscription import (
    Subscription,
    SubscriptionCreate,
    SubscriptionPlan,
    SubscriptionPlanCreate,
    SubscriptionUpdate,
    SubscriptionUsage,
    BillingPeriod,
    Invoice,
    InvoiceItem,
)

logger = structlog.get_logger(__name__)

router = APIRouter()

# Molly Payment Configuration
MOLLY_API_BASE_URL = "https://api.mollie.com/v2"
MOLLY_WEBHOOK_SECRET = settings.SECRET_KEY  # Use your webhook secret


class MollyPaymentService:
    """Service for Molly payment integration."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    async def create_payment(self, amount: Decimal, currency: str, description: str,
                           webhook_url: str, redirect_url: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a payment with Molly."""
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "amount": {
                        "currency": currency,
                        "value": f"{amount:.2f}"
                    },
                    "description": description,
                    "webhookUrl": webhook_url,
                    "redirectUrl": redirect_url,
                    "metadata": metadata or {}
                }

                response = await client.post(
                    f"{MOLLY_API_BASE_URL}/payments",
                    headers=self.headers,
                    json=payload
                )

                if response.status_code != 201:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Payment creation failed: {response.text}"
                    )

                return response.json()

        except httpx.RequestError as e:
            logger.error("Molly payment creation failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Payment service unavailable"
            )

    async def get_payment(self, payment_id: str) -> Dict[str, Any]:
        """Get payment details from Molly."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{MOLLY_API_BASE_URL}/payments/{payment_id}",
                    headers=self.headers
                )

                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Payment not found"
                    )

                return response.json()

        except httpx.RequestError as e:
            logger.error("Molly payment retrieval failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Payment service unavailable"
            )

    async def create_subscription(self, amount: Decimal, currency: str, interval: str,
                                description: str, webhook_url: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a subscription with Molly."""
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "amount": {
                        "currency": currency,
                        "value": f"{amount:.2f}"
                    },
                    "interval": interval,
                    "description": description,
                    "webhookUrl": webhook_url,
                    "metadata": metadata or {}
                }

                response = await client.post(
                    f"{MOLLY_API_BASE_URL}/subscriptions",
                    headers=self.headers,
                    json=payload
                )

                if response.status_code != 201:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Subscription creation failed: {response.text}"
                    )

                return response.json()

        except httpx.RequestError as e:
            logger.error("Molly subscription creation failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Subscription service unavailable"
            )

    async def cancel_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Cancel subscription with Molly."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{MOLLY_API_BASE_URL}/subscriptions/{subscription_id}",
                    headers=self.headers
                )

                if response.status_code not in [200, 204]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Subscription cancellation failed: {response.text}"
                    )

                return response.json() if response.content else {}

        except httpx.RequestError as e:
            logger.error("Molly subscription cancellation failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Subscription service unavailable"
            )

    async def create_refund(self, payment_id: str, amount: Decimal = None, description: str = None) -> Dict[str, Any]:
        """Create a refund with Molly."""
        try:
            async with httpx.AsyncClient() as client:
                payload = {}
                if amount:
                    payload["amount"] = {
                        "currency": "DKK",  # Assuming DKK for Danish business
                        "value": f"{amount:.2f}"
                    }
                if description:
                    payload["description"] = description

                response = await client.post(
                    f"{MOLLY_API_BASE_URL}/payments/{payment_id}/refunds",
                    headers=self.headers,
                    json=payload
                )

                if response.status_code != 201:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Refund creation failed: {response.text}"
                    )

                return response.json()

        except httpx.RequestError as e:
            logger.error("Molly refund creation failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Refund service unavailable"
            )


# Initialize payment service
molly_service = MollyPaymentService(settings.MOLLY_API_KEY if hasattr(settings, 'MOLLY_API_KEY') else "test_key")


# Payment Intent Endpoints
@router.post("/payments/create-intent", response_model=PaymentIntent, status_code=status.HTTP_201_CREATED)
async def create_payment_intent(
    payment_data: PaymentIntentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_check),
) -> PaymentIntent:
    """Create payment intent for booking or subscription."""
    try:
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

        # Create webhook URL
        webhook_url = f"{settings.BACKEND_CORS_ORIGINS[0]}/api/v1/payments/webhook"
        redirect_url = f"{settings.BACKEND_CORS_ORIGINS[0]}/payment/success"

        # Prepare metadata
        metadata = {
            "user_id": current_user.id,
            "payment_type": payment_data.payment_type,
        }
        if booking:
            metadata["booking_id"] = booking.id

        # Create payment with Molly
        molly_payment = await molly_service.create_payment(
            amount=payment_data.amount,
            currency=payment_data.currency,
            description=payment_data.description,
            webhook_url=webhook_url,
            redirect_url=redirect_url,
            metadata=metadata
        )

        # Store payment intent in database
        payment_intent_id = molly_payment["id"]

        await db.execute(
            text("""
                INSERT INTO payment_intents (
                    id, user_id, booking_id, amount, currency, status,
                    payment_type, molly_payment_id, checkout_url, created_at
                ) VALUES (
                    gen_random_uuid(), :user_id::uuid, :booking_id::uuid, :amount, :currency, 'pending',
                    :payment_type, :molly_payment_id, :checkout_url, NOW()
                )
            """),
            {
                "user_id": current_user.id,
                "booking_id": payment_data.booking_id,
                "amount": payment_data.amount,
                "currency": payment_data.currency,
                "payment_type": payment_data.payment_type,
                "molly_payment_id": payment_intent_id,
                "checkout_url": molly_payment["_links"]["checkout"]["href"]
            }
        )

        await db.commit()

        logger.info(
            "Payment intent created",
            user_id=current_user.id,
            molly_payment_id=payment_intent_id,
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
            checkout_url=molly_payment["_links"]["checkout"]["href"],
            created_at=datetime.utcnow()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create payment intent error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment intent"
        )


# Subscription Management
@router.get("/subscriptions/plans", response_model=List[SubscriptionPlan])
async def list_subscription_plans(
    active_only: bool = Query(True, description="Show only active plans"),
    db: AsyncSession = Depends(get_db),
) -> List[SubscriptionPlan]:
    """List available subscription plans."""
    try:
        query = text("""
            SELECT * FROM subscription_plans
            WHERE (:active_only = false OR is_active = true)
            ORDER BY display_order, price_monthly
        """)

        result = await db.execute(query, {"active_only": active_only})
        plans = []

        for row in result.fetchall():
            plans.append(SubscriptionPlan(
                id=row.id,
                name=row.name,
                description=row.description,
                price_monthly=row.price_monthly,
                price_yearly=row.price_yearly,
                features=json.loads(row.features) if row.features else [],
                max_bookings_per_month=row.max_bookings_per_month,
                discount_percentage=row.discount_percentage,
                is_active=row.is_active,
                display_order=row.display_order,
                created_at=row.created_at
            ))

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
                SELECT id FROM user_subscriptions
                WHERE user_id = :user_id::uuid
                AND status = 'active'
                AND ends_at > NOW()
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

        # Calculate pricing based on billing period
        amount = plan.price_monthly if subscription_data.billing_period == BillingPeriod.MONTHLY else plan.price_yearly
        interval = "1 month" if subscription_data.billing_period == BillingPeriod.MONTHLY else "1 year"

        # Create subscription with Molly
        webhook_url = f"{settings.BACKEND_CORS_ORIGINS[0]}/api/v1/payments/webhook"

        molly_subscription = await molly_service.create_subscription(
            amount=amount,
            currency="DKK",
            interval=interval,
            description=f"Subscription: {plan.name}",
            webhook_url=webhook_url,
            metadata={
                "user_id": current_user.id,
                "plan_id": subscription_data.plan_id,
                "billing_period": subscription_data.billing_period.value
            }
        )

        # Store subscription in database
        starts_at = datetime.utcnow()
        ends_at = starts_at + (timedelta(days=30) if subscription_data.billing_period == BillingPeriod.MONTHLY else timedelta(days=365))

        subscription_id = await db.execute(
            text("""
                INSERT INTO user_subscriptions (
                    id, user_id, plan_id, molly_subscription_id, status, billing_period,
                    amount, currency, starts_at, ends_at, created_at
                ) VALUES (
                    gen_random_uuid(), :user_id::uuid, :plan_id::uuid, :molly_subscription_id,
                    'pending', :billing_period, :amount, :currency, :starts_at, :ends_at, NOW()
                ) RETURNING id
            """),
            {
                "user_id": current_user.id,
                "plan_id": subscription_data.plan_id,
                "molly_subscription_id": molly_subscription["id"],
                "billing_period": subscription_data.billing_period.value,
                "amount": amount,
                "currency": "DKK",
                "starts_at": starts_at,
                "ends_at": ends_at
            }
        )

        sub_id = subscription_id.scalar()
        await db.commit()

        logger.info(
            "Subscription created",
            user_id=current_user.id,
            subscription_id=sub_id,
            plan_id=subscription_data.plan_id,
            molly_subscription_id=molly_subscription["id"]
        )

        return Subscription(
            id=sub_id,
            user_id=current_user.id,
            plan_id=subscription_data.plan_id,
            status="pending",
            billing_period=subscription_data.billing_period,
            amount=amount,
            currency="DKK",
            starts_at=starts_at,
            ends_at=ends_at,
            created_at=datetime.utcnow()
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
                SELECT * FROM user_subscriptions
                WHERE user_id = :user_id::uuid
                AND status IN ('active', 'pending')
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"user_id": current_user.id}
        )

        subscription = subscription_query.first()
        if not subscription:
            return None

        return Subscription(
            id=subscription.id,
            user_id=subscription.user_id,
            plan_id=subscription.plan_id,
            status=subscription.status,
            billing_period=BillingPeriod(subscription.billing_period),
            amount=subscription.amount,
            currency=subscription.currency,
            starts_at=subscription.starts_at,
            ends_at=subscription.ends_at,
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
                SELECT * FROM user_subscriptions
                WHERE id = :subscription_id::uuid
                AND user_id = :user_id::uuid
                AND status = 'active'
            """),
            {"subscription_id": subscription_id, "user_id": current_user.id}
        )

        subscription = subscription_query.first()
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active subscription not found"
            )

        # Cancel with Molly
        await molly_service.cancel_subscription(subscription.molly_subscription_id)

        # Update subscription status
        await db.execute(
            text("""
                UPDATE user_subscriptions
                SET status = 'cancelled', cancelled_at = NOW()
                WHERE id = :subscription_id::uuid
            """),
            {"subscription_id": subscription_id}
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
            status="cancelled",
            billing_period=BillingPeriod(subscription.billing_period),
            amount=subscription.amount,
            currency=subscription.currency,
            starts_at=subscription.starts_at,
            ends_at=subscription.ends_at,
            created_at=subscription.created_at
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
async def handle_molly_webhook(
    request: Request,
    molly_signature: str = Header(None, alias="molly-signature"),
    db: AsyncSession = Depends(get_db),
):
    """Handle Molly payment webhooks."""
    try:
        # Get raw body
        body = await request.body()

        # Verify webhook signature
        if not _verify_webhook_signature(body, molly_signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature"
            )

        # Parse webhook data
        webhook_data = json.loads(body)
        event_type = webhook_data.get("event", {}).get("type")
        payment_data = webhook_data.get("data", {})

        logger.info(
            "Webhook received",
            event_type=event_type,
            payment_id=payment_data.get("id"),
            status=payment_data.get("status")
        )

        # Handle different event types
        if event_type == "payment.paid":
            await _handle_payment_paid(payment_data, db)
        elif event_type == "payment.failed":
            await _handle_payment_failed(payment_data, db)
        elif event_type == "subscription.created":
            await _handle_subscription_created(payment_data, db)
        elif event_type == "subscription.cancelled":
            await _handle_subscription_cancelled(payment_data, db)
        else:
            logger.warning("Unhandled webhook event type", event_type=event_type)

        return {"status": "ok"}

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    except Exception as e:
        logger.error("Webhook handling error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed"
        )


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
            text("SELECT * FROM payment_intents WHERE molly_payment_id = :payment_id"),
            {"payment_id": payment_id}
        )
        payment = payment_query.first()

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )

        # Create refund with Molly
        molly_refund = await molly_service.create_refund(
            payment_id=payment_id,
            amount=refund_data.amount,
            description=refund_data.reason
        )

        # Store refund in database
        await db.execute(
            text("""
                INSERT INTO refunds (
                    id, payment_intent_id, molly_refund_id, amount, reason, status, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), :payment_intent_id::uuid, :molly_refund_id, :amount, :reason, 'processing', :created_by::uuid, NOW()
                )
            """),
            {
                "payment_intent_id": payment.id,
                "molly_refund_id": molly_refund["id"],
                "amount": refund_data.amount,
                "reason": refund_data.reason,
                "created_by": current_user.id
            }
        )

        await db.commit()

        logger.info(
            "Refund created",
            payment_id=payment_id,
            refund_id=molly_refund["id"],
            amount=float(refund_data.amount),
            created_by=current_user.id
        )

        return RefundResponse(
            id=molly_refund["id"],
            payment_id=payment_id,
            amount=refund_data.amount,
            status="processing",
            created_at=datetime.utcnow()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create refund error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create refund"
        )


# Utility Functions
def _verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify Molly webhook signature."""
    if not signature:
        return False

    expected_signature = hmac.new(
        MOLLY_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)


async def _handle_payment_paid(payment_data: Dict[str, Any], db: AsyncSession):
    """Handle successful payment."""
    payment_id = payment_data["id"]

    # Update payment intent status
    await db.execute(
        text("""
            UPDATE payment_intents
            SET status = 'succeeded', paid_at = NOW()
            WHERE molly_payment_id = :payment_id
        """),
        {"payment_id": payment_id}
    )

    # Update booking payment status if applicable
    booking_query = await db.execute(
        text("""
            SELECT booking_id FROM payment_intents
            WHERE molly_payment_id = :payment_id AND booking_id IS NOT NULL
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
    logger.info("Payment marked as paid", payment_id=payment_id)


async def _handle_payment_failed(payment_data: Dict[str, Any], db: AsyncSession):
    """Handle failed payment."""
    payment_id = payment_data["id"]

    await db.execute(
        text("""
            UPDATE payment_intents
            SET status = 'failed'
            WHERE molly_payment_id = :payment_id
        """),
        {"payment_id": payment_id}
    )

    await db.commit()
    logger.info("Payment marked as failed", payment_id=payment_id)


async def _handle_subscription_created(subscription_data: Dict[str, Any], db: AsyncSession):
    """Handle subscription creation."""
    subscription_id = subscription_data["id"]

    await db.execute(
        text("""
            UPDATE user_subscriptions
            SET status = 'active'
            WHERE molly_subscription_id = :subscription_id
        """),
        {"subscription_id": subscription_id}
    )

    await db.commit()
    logger.info("Subscription activated", subscription_id=subscription_id)


async def _handle_subscription_cancelled(subscription_data: Dict[str, Any], db: AsyncSession):
    """Handle subscription cancellation."""
    subscription_id = subscription_data["id"]

    await db.execute(
        text("""
            UPDATE user_subscriptions
            SET status = 'cancelled', cancelled_at = NOW()
            WHERE molly_subscription_id = :subscription_id
        """),
        {"subscription_id": subscription_id}
    )

    await db.commit()
    logger.info("Subscription cancelled via webhook", subscription_id=subscription_id)