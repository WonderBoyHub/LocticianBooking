"""
Usage-Based Billing Service
Integrates subscription limits with booking system and tracks usage for billing.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from uuid import UUID

import structlog
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.subscription_extended import SubscriptionUsage, UsageReport

logger = structlog.get_logger(__name__)


class UsageBillingService:
    """Service for managing usage-based billing and subscription limits."""

    def __init__(self):
        """Initialize usage billing service."""
        self.overage_rates = {
            'basic': {
                'bookings': Decimal('10.00'),  # DKK per extra booking
                'storage_gb': Decimal('5.00'),  # DKK per extra GB
            },
            'premium': {
                'bookings': Decimal('8.00'),   # DKK per extra booking
                'storage_gb': Decimal('4.00'), # DKK per extra GB
            },
            'vip': {
                'bookings': Decimal('5.00'),   # DKK per extra booking
                'storage_gb': Decimal('3.00'), # DKK per extra GB
            },
            'enterprise': {
                'bookings': Decimal('0.00'),   # No overage for enterprise
                'storage_gb': Decimal('0.00'), # No overage for enterprise
            }
        }

        logger.info("Usage billing service initialized")

    async def check_booking_limit(
        self,
        user_id: UUID,
        db: AsyncSession,
        booking_count: int = 1
    ) -> Tuple[bool, Dict[str, any]]:
        """
        Check if user can create additional bookings based on subscription limits.
        Returns (allowed, usage_info)
        """
        try:
            # Get user's current subscription and usage
            subscription_query = await db.execute(
                text("""
                    SELECT
                        us.id as subscription_id,
                        us.bookings_used_this_period,
                        us.current_period_start,
                        us.current_period_end,
                        sp.name as plan_name,
                        sp.plan_type,
                        sp.max_bookings_per_month,
                        sp.booking_discount_percentage,
                        ss.name as status,
                        ss.allows_usage
                    FROM user_subscriptions us
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    JOIN subscription_statuses ss ON us.status_id = ss.id
                    WHERE us.user_id = :user_id::uuid
                    AND ss.is_active_status = true
                    AND us.current_period_end > NOW()
                    ORDER BY us.created_at DESC
                    LIMIT 1
                """),
                {"user_id": user_id}
            )

            subscription = subscription_query.first()

            if not subscription:
                # No active subscription - deny booking
                return False, {
                    "error": "No active subscription",
                    "message": "Please subscribe to a plan to make bookings",
                    "upgrade_required": True
                }

            if not subscription.allows_usage:
                # Subscription doesn't allow usage (e.g., suspended)
                return False, {
                    "error": "Subscription suspended",
                    "message": "Your subscription doesn't allow bookings at this time",
                    "contact_support": True
                }

            # Check if unlimited bookings (enterprise plan)
            if subscription.max_bookings_per_month is None:
                return True, {
                    "allowed": True,
                    "plan": subscription.plan_name,
                    "unlimited": True,
                    "current_usage": subscription.bookings_used_this_period
                }

            # Check usage against limit
            current_usage = subscription.bookings_used_this_period
            max_bookings = subscription.max_bookings_per_month
            new_total = current_usage + booking_count

            if new_total <= max_bookings:
                # Within limits
                return True, {
                    "allowed": True,
                    "plan": subscription.plan_name,
                    "current_usage": current_usage,
                    "max_bookings": max_bookings,
                    "remaining": max_bookings - new_total,
                    "usage_percentage": (new_total / max_bookings) * 100
                }
            else:
                # Over limit - check if overages are allowed and calculate cost
                overage_count = new_total - max_bookings
                overage_rate = self.overage_rates.get(subscription.plan_type, {}).get('bookings', Decimal('15.00'))
                overage_cost = overage_count * overage_rate

                if subscription.plan_type == 'enterprise' or overage_rate == 0:
                    # No overages for enterprise or if rate is 0
                    return True, {
                        "allowed": True,
                        "plan": subscription.plan_name,
                        "current_usage": current_usage,
                        "max_bookings": max_bookings,
                        "overage_count": overage_count,
                        "overage_cost": 0,
                        "unlimited_overages": True
                    }
                else:
                    # Overages are allowed but will be charged
                    return True, {
                        "allowed": True,
                        "plan": subscription.plan_name,
                        "current_usage": current_usage,
                        "max_bookings": max_bookings,
                        "overage_count": overage_count,
                        "overage_cost": float(overage_cost),
                        "overage_rate": float(overage_rate),
                        "total_cost": float(overage_cost),
                        "warning": f"This will incur an overage charge of {overage_cost} DKK"
                    }

        except Exception as e:
            logger.error("Error checking booking limit", error=str(e), user_id=user_id)
            # Allow booking but log error for investigation
            return True, {
                "allowed": True,
                "error": "Could not verify limits",
                "message": "Booking allowed but usage tracking may be affected"
            }

    async def increment_booking_usage(
        self,
        user_id: UUID,
        booking_count: int,
        db: AsyncSession
    ) -> bool:
        """Increment booking usage for user's subscription."""
        try:
            # Update booking usage
            result = await db.execute(
                text("""
                    UPDATE user_subscriptions
                    SET bookings_used_this_period = bookings_used_this_period + :booking_count,
                        updated_at = NOW()
                    WHERE user_id = :user_id::uuid
                    AND id = (
                        SELECT us.id
                        FROM user_subscriptions us
                        JOIN subscription_statuses ss ON us.status_id = ss.id
                        WHERE us.user_id = :user_id::uuid
                        AND ss.is_active_status = true
                        AND us.current_period_end > NOW()
                        ORDER BY us.created_at DESC
                        LIMIT 1
                    )
                """),
                {"user_id": user_id, "booking_count": booking_count}
            )

            await db.commit()

            if result.rowcount > 0:
                logger.info(
                    "Booking usage incremented",
                    user_id=user_id,
                    booking_count=booking_count
                )
                return True
            else:
                logger.warning(
                    "No subscription found to update usage",
                    user_id=user_id
                )
                return False

        except Exception as e:
            logger.error("Error incrementing booking usage", error=str(e), user_id=user_id)
            await db.rollback()
            return False

    async def calculate_overage_charges(
        self,
        subscription_id: UUID,
        period_start: datetime,
        period_end: datetime,
        db: AsyncSession
    ) -> Dict[str, any]:
        """Calculate overage charges for a billing period."""
        try:
            # Get subscription details and usage
            subscription_query = await db.execute(
                text("""
                    SELECT
                        us.id,
                        us.user_id,
                        us.bookings_used_this_period,
                        sp.name as plan_name,
                        sp.plan_type,
                        sp.max_bookings_per_month,
                        sp.price as base_price
                    FROM user_subscriptions us
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    WHERE us.id = :subscription_id::uuid
                """),
                {"subscription_id": subscription_id}
            )

            subscription = subscription_query.first()
            if not subscription:
                raise ValueError(f"Subscription {subscription_id} not found")

            overage_charges = []
            total_overage = Decimal('0.00')

            # Calculate booking overages
            if (subscription.max_bookings_per_month is not None and
                subscription.bookings_used_this_period > subscription.max_bookings_per_month):

                booking_overage = subscription.bookings_used_this_period - subscription.max_bookings_per_month
                rate = self.overage_rates.get(subscription.plan_type, {}).get('bookings', Decimal('10.00'))
                charge = booking_overage * rate

                if charge > 0:
                    overage_charges.append({
                        "type": "bookings",
                        "description": f"Booking overage ({booking_overage} bookings)",
                        "quantity": booking_overage,
                        "rate": float(rate),
                        "amount": float(charge)
                    })
                    total_overage += charge

            # TODO: Add storage overage calculation when implemented
            # storage_overage = await self._calculate_storage_overage(subscription_id, db)

            logger.info(
                "Overage charges calculated",
                subscription_id=subscription_id,
                total_overage=float(total_overage),
                charges_count=len(overage_charges)
            )

            return {
                "subscription_id": subscription_id,
                "period_start": period_start,
                "period_end": period_end,
                "base_price": float(subscription.base_price),
                "overage_charges": overage_charges,
                "total_overage": float(total_overage),
                "total_amount": float(subscription.base_price + total_overage)
            }

        except Exception as e:
            logger.error("Error calculating overage charges", error=str(e), subscription_id=subscription_id)
            raise

    async def get_usage_report(
        self,
        user_id: UUID,
        db: AsyncSession
    ) -> Optional[UsageReport]:
        """Get comprehensive usage report for user's current subscription."""
        try:
            # Get current subscription with usage details
            subscription_query = await db.execute(
                text("""
                    SELECT
                        us.id as subscription_id,
                        us.bookings_used_this_period,
                        us.current_period_start,
                        us.current_period_end,
                        sp.name as plan_name,
                        sp.plan_type,
                        sp.max_bookings_per_month,
                        sp.max_staff_members,
                        sp.max_services,
                        sp.price as current_price,
                        us.staff_members_count,
                        us.services_count
                    FROM user_subscriptions us
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    JOIN subscription_statuses ss ON us.status_id = ss.id
                    WHERE us.user_id = :user_id::uuid
                    AND ss.is_active_status = true
                    AND us.current_period_end > NOW()
                    ORDER BY us.created_at DESC
                    LIMIT 1
                """),
                {"user_id": user_id}
            )

            subscription = subscription_query.first()
            if not subscription:
                return None

            # Calculate usage percentages
            bookings_usage_percentage = None
            if subscription.max_bookings_per_month:
                bookings_usage_percentage = (subscription.bookings_used_this_period / subscription.max_bookings_per_month) * 100

            # Determine if upgrade is needed
            needs_upgrade = False
            recommended_plan = None

            if (subscription.max_bookings_per_month and
                subscription.bookings_used_this_period >= subscription.max_bookings_per_month * 0.8):
                needs_upgrade = True

            # Get upgrade recommendations
            if needs_upgrade:
                upgrade_query = await db.execute(
                    text("""
                        SELECT name, price, max_bookings_per_month
                        FROM subscription_plans
                        WHERE is_active = true
                        AND billing_interval = 'monthly'
                        AND (max_bookings_per_month > :current_limit OR max_bookings_per_month IS NULL)
                        AND price > :current_price
                        ORDER BY price
                        LIMIT 1
                    """),
                    {
                        "current_limit": subscription.max_bookings_per_month,
                        "current_price": subscription.current_price
                    }
                )
                upgrade_plan = upgrade_query.first()
                if upgrade_plan:
                    recommended_plan = upgrade_plan.name

            # Calculate potential yearly savings
            yearly_savings = None
            yearly_query = await db.execute(
                text("""
                    SELECT price as yearly_price
                    FROM subscription_plans
                    WHERE plan_type = :plan_type
                    AND billing_interval = 'yearly'
                    AND is_active = true
                    LIMIT 1
                """),
                {"plan_type": subscription.plan_type}
            )
            yearly_plan = yearly_query.first()
            if yearly_plan:
                monthly_yearly_cost = subscription.current_price * 12
                yearly_savings = monthly_yearly_cost - yearly_plan.yearly_price

            # Calculate storage usage (placeholder for future implementation)
            storage_used_gb = Decimal('0.0')  # TODO: Implement actual storage calculation

            period = f"{subscription.current_period_start.strftime('%Y-%m-%d')} to {subscription.current_period_end.strftime('%Y-%m-%d')}"

            return UsageReport(
                subscription_id=subscription.subscription_id,
                user_id=user_id,
                plan_name=subscription.plan_name,
                period=period,
                bookings_used=subscription.bookings_used_this_period,
                bookings_limit=subscription.max_bookings_per_month,
                bookings_usage_percentage=bookings_usage_percentage,
                staff_count=subscription.staff_members_count or 0,
                staff_limit=subscription.max_staff_members,
                services_count=subscription.services_count or 0,
                services_limit=subscription.max_services,
                storage_used_gb=storage_used_gb,
                storage_limit_gb=None,  # TODO: Add to subscription plans
                needs_upgrade=needs_upgrade,
                recommended_plan=recommended_plan,
                cost_savings_yearly=yearly_savings
            )

        except Exception as e:
            logger.error("Error getting usage report", error=str(e), user_id=user_id)
            raise

    async def reset_usage_counters(
        self,
        subscription_id: UUID,
        new_period_start: datetime,
        new_period_end: datetime,
        db: AsyncSession
    ) -> bool:
        """Reset usage counters for new billing period."""
        try:
            await db.execute(
                text("""
                    UPDATE user_subscriptions
                    SET bookings_used_this_period = 0,
                        current_period_start = :period_start,
                        current_period_end = :period_end,
                        updated_at = NOW()
                    WHERE id = :subscription_id::uuid
                """),
                {
                    "subscription_id": subscription_id,
                    "period_start": new_period_start,
                    "period_end": new_period_end
                }
            )

            await db.commit()

            logger.info(
                "Usage counters reset for new billing period",
                subscription_id=subscription_id,
                period_start=new_period_start,
                period_end=new_period_end
            )

            return True

        except Exception as e:
            logger.error("Error resetting usage counters", error=str(e), subscription_id=subscription_id)
            await db.rollback()
            return False

    async def check_service_limits(
        self,
        user_id: UUID,
        service_count: int,
        db: AsyncSession
    ) -> Tuple[bool, Dict[str, any]]:
        """Check if user can create additional services."""
        try:
            subscription_query = await db.execute(
                text("""
                    SELECT
                        sp.max_services,
                        sp.name as plan_name,
                        us.services_count
                    FROM user_subscriptions us
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    JOIN subscription_statuses ss ON us.status_id = ss.id
                    WHERE us.user_id = :user_id::uuid
                    AND ss.is_active_status = true
                    AND us.current_period_end > NOW()
                    ORDER BY us.created_at DESC
                    LIMIT 1
                """),
                {"user_id": user_id}
            )

            subscription = subscription_query.first()
            if not subscription:
                return False, {"error": "No active subscription"}

            if subscription.max_services is None:
                return True, {"allowed": True, "unlimited": True}

            current_count = subscription.services_count or 0
            if current_count + service_count <= subscription.max_services:
                return True, {
                    "allowed": True,
                    "current_count": current_count,
                    "max_services": subscription.max_services,
                    "remaining": subscription.max_services - current_count - service_count
                }
            else:
                return False, {
                    "allowed": False,
                    "current_count": current_count,
                    "max_services": subscription.max_services,
                    "upgrade_required": True,
                    "plan": subscription.plan_name
                }

        except Exception as e:
            logger.error("Error checking service limits", error=str(e), user_id=user_id)
            return True, {"allowed": True, "error": "Could not verify limits"}

    async def check_staff_limits(
        self,
        user_id: UUID,
        staff_count: int,
        db: AsyncSession
    ) -> Tuple[bool, Dict[str, any]]:
        """Check if user can add additional staff members."""
        try:
            subscription_query = await db.execute(
                text("""
                    SELECT
                        sp.max_staff_members,
                        sp.name as plan_name,
                        us.staff_members_count
                    FROM user_subscriptions us
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    JOIN subscription_statuses ss ON us.status_id = ss.id
                    WHERE us.user_id = :user_id::uuid
                    AND ss.is_active_status = true
                    AND us.current_period_end > NOW()
                    ORDER BY us.created_at DESC
                    LIMIT 1
                """),
                {"user_id": user_id}
            )

            subscription = subscription_query.first()
            if not subscription:
                return False, {"error": "No active subscription"}

            if subscription.max_staff_members is None:
                return True, {"allowed": True, "unlimited": True}

            current_count = subscription.staff_members_count or 1
            if current_count + staff_count <= subscription.max_staff_members:
                return True, {
                    "allowed": True,
                    "current_count": current_count,
                    "max_staff": subscription.max_staff_members,
                    "remaining": subscription.max_staff_members - current_count - staff_count
                }
            else:
                return False, {
                    "allowed": False,
                    "current_count": current_count,
                    "max_staff": subscription.max_staff_members,
                    "upgrade_required": True,
                    "plan": subscription.plan_name
                }

        except Exception as e:
            logger.error("Error checking staff limits", error=str(e), user_id=user_id)
            return True, {"allowed": True, "error": "Could not verify limits"}


# Global service instance
usage_billing_service = UsageBillingService()