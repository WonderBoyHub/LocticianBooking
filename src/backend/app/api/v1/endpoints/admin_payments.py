"""
Admin Payment Management API
Comprehensive admin interface for managing payments, subscriptions, and billing.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin, get_current_admin
from app.core.database import get_db
from app.models.user import User
from app.services.mollie_service import mollie_service, MollieAPIError
from app.services.invoice_service import invoice_service
from app.services.usage_billing_service import usage_billing_service
from app.schemas.mollie_payment import RefundRequest, RefundResponse
from app.schemas.subscription_extended import (
    SubscriptionPlan,
    SubscriptionPlanCreate,
    Subscription,
    SubscriptionAnalytics,
    DashboardMetrics,
    SubscriptionEvent,
    BulkSubscriptionAction,
    SubscriptionAction
)

logger = structlog.get_logger(__name__)

router = APIRouter()


# Dashboard and Analytics
@router.get("/dashboard", response_model=DashboardMetrics)
async def get_payment_dashboard(
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DashboardMetrics:
    """Get payment dashboard metrics for admin overview."""
    try:
        # Get subscription metrics
        metrics_query = await db.execute(
            text("""
                WITH subscription_metrics AS (
                    SELECT
                        COUNT(CASE WHEN ss.is_active_status = true THEN 1 END) as active_subscriptions,
                        COUNT(CASE WHEN ss.name = 'trialing' THEN 1 END) as trial_subscriptions,
                        COUNT(CASE WHEN ss.name = 'canceled' THEN 1 END) as canceled_subscriptions,
                        COUNT(*) as total_subscribers,
                        SUM(CASE WHEN ss.is_active_status = true AND us.billing_period = 'monthly' THEN us.plan_price ELSE 0 END) as monthly_recurring_revenue,
                        AVG(CASE WHEN ss.is_active_status = true THEN us.plan_price ELSE NULL END) as avg_revenue_per_user,
                        COUNT(CASE WHEN us.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_subscribers_this_month,
                        COUNT(CASE WHEN us.cancelled_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as churned_subscribers_this_month
                    FROM user_subscriptions us
                    JOIN subscription_statuses ss ON us.status_id = ss.id
                ),
                plan_metrics AS (
                    SELECT
                        sp.name as most_popular_plan,
                        COUNT(*) as subscriber_count
                    FROM user_subscriptions us
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    JOIN subscription_statuses ss ON us.status_id = ss.id
                    WHERE ss.is_active_status = true
                    GROUP BY sp.name
                    ORDER BY COUNT(*) DESC
                    LIMIT 1
                ),
                revenue_plan AS (
                    SELECT
                        sp.name as highest_revenue_plan,
                        SUM(us.plan_price) as total_revenue
                    FROM user_subscriptions us
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    JOIN subscription_statuses ss ON us.status_id = ss.id
                    WHERE ss.is_active_status = true
                    GROUP BY sp.name
                    ORDER BY SUM(us.plan_price) DESC
                    LIMIT 1
                )
                SELECT
                    sm.*,
                    pm.most_popular_plan,
                    rp.highest_revenue_plan
                FROM subscription_metrics sm
                CROSS JOIN plan_metrics pm
                CROSS JOIN revenue_plan rp
            """)
        )

        metrics = metrics_query.first()

        if not metrics:
            # Return empty metrics if no data
            return DashboardMetrics(
                active_subscriptions=0,
                trial_subscriptions=0,
                canceled_subscriptions=0,
                total_subscribers=0,
                monthly_recurring_revenue=Decimal('0'),
                annual_recurring_revenue=Decimal('0'),
                average_revenue_per_user=Decimal('0'),
                new_subscribers_this_month=0,
                churned_subscribers_this_month=0,
                growth_rate=Decimal('0'),
                churn_rate=Decimal('0'),
                most_popular_plan="N/A",
                highest_revenue_plan="N/A",
                predicted_revenue_next_month=Decimal('0'),
                predicted_churn_next_month=0
            )

        # Calculate derived metrics
        annual_recurring_revenue = metrics.monthly_recurring_revenue * 12

        growth_rate = Decimal('0')
        if metrics.total_subscribers > 0:
            growth_rate = (Decimal(str(metrics.new_subscribers_this_month)) / Decimal(str(metrics.total_subscribers))) * 100

        churn_rate = Decimal('0')
        if metrics.active_subscriptions > 0:
            churn_rate = (Decimal(str(metrics.churned_subscribers_this_month)) / Decimal(str(metrics.active_subscriptions))) * 100

        # Simple prediction based on current trends
        predicted_revenue_next_month = metrics.monthly_recurring_revenue * (1 + (growth_rate / 100))
        predicted_churn_next_month = int(metrics.churned_subscribers_this_month * 1.1)  # Slight increase assumption

        return DashboardMetrics(
            active_subscriptions=metrics.active_subscriptions,
            trial_subscriptions=metrics.trial_subscriptions,
            canceled_subscriptions=metrics.canceled_subscriptions,
            total_subscribers=metrics.total_subscribers,
            monthly_recurring_revenue=Decimal(str(metrics.monthly_recurring_revenue)),
            annual_recurring_revenue=annual_recurring_revenue,
            average_revenue_per_user=Decimal(str(metrics.avg_revenue_per_user or 0)),
            new_subscribers_this_month=metrics.new_subscribers_this_month,
            churned_subscribers_this_month=metrics.churned_subscribers_this_month,
            growth_rate=growth_rate,
            churn_rate=churn_rate,
            most_popular_plan=metrics.most_popular_plan or "N/A",
            highest_revenue_plan=metrics.highest_revenue_plan or "N/A",
            predicted_revenue_next_month=predicted_revenue_next_month,
            predicted_churn_next_month=predicted_churn_next_month
        )

    except Exception as e:
        logger.error("Error getting payment dashboard", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get dashboard metrics"
        )


@router.get("/analytics", response_model=SubscriptionAnalytics)
async def get_subscription_analytics(
    start_date: datetime = Query(default_factory=lambda: datetime.utcnow() - timedelta(days=30)),
    end_date: datetime = Query(default_factory=datetime.utcnow),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionAnalytics:
    """Get detailed subscription analytics for specified period."""
    try:
        # Revenue analytics
        revenue_query = await db.execute(
            text("""
                WITH revenue_metrics AS (
                    SELECT
                        SUM(CASE WHEN pt.transaction_type = 'subscription_charge' THEN pt.amount ELSE 0 END) as recurring_revenue,
                        SUM(CASE WHEN pt.transaction_type = 'setup_fee' THEN pt.amount ELSE 0 END) as setup_revenue,
                        SUM(pt.amount) as total_revenue
                    FROM payment_transactions pt
                    WHERE pt.status = 'succeeded'
                    AND pt.created_at BETWEEN :start_date AND :end_date
                ),
                customer_metrics AS (
                    SELECT
                        COUNT(CASE WHEN us.created_at BETWEEN :start_date AND :end_date THEN 1 END) as new_subscribers,
                        COUNT(CASE WHEN us.cancelled_at BETWEEN :start_date AND :end_date THEN 1 END) as churned_subscribers,
                        COUNT(CASE WHEN ss.name = 'trialing' THEN 1 END) as active_trials
                    FROM user_subscriptions us
                    JOIN subscription_statuses ss ON us.status_id = ss.id
                ),
                plan_distribution AS (
                    SELECT
                        sp.name,
                        COUNT(*) as subscriber_count,
                        SUM(us.plan_price) as plan_revenue
                    FROM user_subscriptions us
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    JOIN subscription_statuses ss ON us.status_id = ss.id
                    WHERE ss.is_active_status = true
                    GROUP BY sp.name
                )
                SELECT
                    rm.recurring_revenue,
                    rm.setup_revenue,
                    rm.total_revenue,
                    cm.new_subscribers,
                    cm.churned_subscribers,
                    cm.active_trials,
                    json_object_agg(pd.name, pd.subscriber_count) as subscribers_by_plan,
                    json_object_agg(pd.name, pd.plan_revenue) as revenue_by_plan
                FROM revenue_metrics rm
                CROSS JOIN customer_metrics cm
                CROSS JOIN plan_distribution pd
                GROUP BY rm.recurring_revenue, rm.setup_revenue, rm.total_revenue,
                         cm.new_subscribers, cm.churned_subscribers, cm.active_trials
            """),
            {"start_date": start_date, "end_date": end_date}
        )

        analytics = revenue_query.first()

        if not analytics:
            # Return empty analytics
            return SubscriptionAnalytics(
                period_start=start_date,
                period_end=end_date,
                total_revenue=Decimal('0'),
                recurring_revenue=Decimal('0'),
                new_revenue=Decimal('0'),
                expansion_revenue=Decimal('0'),
                contraction_revenue=Decimal('0'),
                churn_revenue=Decimal('0'),
                total_subscribers=0,
                new_subscribers=0,
                churned_subscribers=0,
                active_trials=0,
                subscribers_by_plan={},
                revenue_by_plan={},
                monthly_churn_rate=Decimal('0'),
                customer_lifetime_value=Decimal('0'),
                average_revenue_per_user=Decimal('0'),
                monthly_growth_rate=Decimal('0'),
                yearly_growth_rate=Decimal('0')
            )

        # Calculate derived metrics
        total_subscribers = sum(analytics.subscribers_by_plan.values()) if analytics.subscribers_by_plan else 0
        avg_revenue_per_user = analytics.total_revenue / total_subscribers if total_subscribers > 0 else Decimal('0')

        # Calculate churn rate
        monthly_churn_rate = Decimal('0')
        if total_subscribers > 0:
            monthly_churn_rate = (Decimal(str(analytics.churned_subscribers)) / Decimal(str(total_subscribers))) * 100

        # Estimate customer lifetime value (simplified)
        customer_lifetime_value = avg_revenue_per_user / (monthly_churn_rate / 100) if monthly_churn_rate > 0 else avg_revenue_per_user * 24

        # Calculate growth rates (simplified)
        monthly_growth_rate = (Decimal(str(analytics.new_subscribers)) / Decimal(str(total_subscribers))) * 100 if total_subscribers > 0 else Decimal('0')
        yearly_growth_rate = monthly_growth_rate * 12

        return SubscriptionAnalytics(
            period_start=start_date,
            period_end=end_date,
            total_revenue=Decimal(str(analytics.total_revenue or 0)),
            recurring_revenue=Decimal(str(analytics.recurring_revenue or 0)),
            new_revenue=Decimal(str(analytics.new_subscribers * avg_revenue_per_user)),
            expansion_revenue=Decimal('0'),  # TODO: Calculate from plan upgrades
            contraction_revenue=Decimal('0'),  # TODO: Calculate from plan downgrades
            churn_revenue=Decimal(str(analytics.churned_subscribers * avg_revenue_per_user)),
            total_subscribers=total_subscribers,
            new_subscribers=analytics.new_subscribers,
            churned_subscribers=analytics.churned_subscribers,
            active_trials=analytics.active_trials,
            subscribers_by_plan=analytics.subscribers_by_plan or {},
            revenue_by_plan={k: Decimal(str(v)) for k, v in (analytics.revenue_by_plan or {}).items()},
            monthly_churn_rate=monthly_churn_rate,
            customer_lifetime_value=customer_lifetime_value,
            average_revenue_per_user=avg_revenue_per_user,
            monthly_growth_rate=monthly_growth_rate,
            yearly_growth_rate=yearly_growth_rate
        )

    except Exception as e:
        logger.error("Error getting subscription analytics", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get analytics"
        )


# Subscription Plan Management
@router.post("/plans", response_model=SubscriptionPlan, status_code=status.HTTP_201_CREATED)
async def create_subscription_plan(
    plan_data: SubscriptionPlanCreate,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionPlan:
    """Create a new subscription plan."""
    try:
        # Insert plan into database
        plan_id = await db.execute(
            text("""
                INSERT INTO subscription_plans (
                    name, description, plan_type, price, billing_interval,
                    max_bookings_per_month, max_staff_members, max_services,
                    priority_support, custom_branding, api_access,
                    booking_discount_percentage, setup_fee, trial_period_days,
                    features, is_featured, display_order, created_at
                ) VALUES (
                    :name, :description, :tier, :price_monthly, 'monthly',
                    :max_bookings_per_month, :max_staff_members, :max_services,
                    :priority_support, :custom_branding, :api_access,
                    :booking_discount_percentage, :setup_fee, :trial_days,
                    :features::jsonb, :is_featured, :display_order, NOW()
                ) RETURNING id
            """),
            {
                "name": plan_data.name,
                "description": plan_data.description,
                "tier": plan_data.tier.value,
                "price_monthly": plan_data.price_monthly,
                "max_bookings_per_month": plan_data.max_bookings_per_month,
                "max_staff_members": plan_data.max_staff_members,
                "max_services": plan_data.max_services,
                "priority_support": plan_data.priority_support,
                "custom_branding": plan_data.custom_branding,
                "api_access": plan_data.api_access,
                "booking_discount_percentage": plan_data.booking_discount_percentage,
                "setup_fee": plan_data.setup_fee,
                "trial_days": plan_data.trial_days,
                "features": plan_data.features,
                "is_featured": plan_data.is_featured,
                "display_order": plan_data.display_order
            }
        )

        plan_uuid = plan_id.scalar()
        await db.commit()

        logger.info("Subscription plan created", plan_id=plan_uuid, name=plan_data.name, admin_user=admin_user.id)

        # Return created plan
        return SubscriptionPlan(
            id=plan_uuid,
            name=plan_data.name,
            description=plan_data.description,
            tier=plan_data.tier,
            price_monthly=plan_data.price_monthly,
            price_yearly=plan_data.price_yearly,
            max_bookings_per_month=plan_data.max_bookings_per_month,
            max_staff_members=plan_data.max_staff_members,
            max_services=plan_data.max_services,
            priority_support=plan_data.priority_support,
            custom_branding=plan_data.custom_branding,
            api_access=plan_data.api_access,
            advanced_analytics=False,
            multi_location=False,
            booking_discount_percentage=plan_data.booking_discount_percentage,
            setup_fee=plan_data.setup_fee,
            trial_days=plan_data.trial_days,
            features=plan_data.features,
            is_active=True,
            is_featured=plan_data.is_featured,
            display_order=plan_data.display_order,
            created_at=datetime.utcnow()
        )

    except Exception as e:
        logger.error("Error creating subscription plan", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription plan"
        )


@router.get("/plans", response_model=List[SubscriptionPlan])
async def list_all_subscription_plans(
    include_inactive: bool = Query(False, description="Include inactive plans"),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[SubscriptionPlan]:
    """List all subscription plans for admin management."""
    try:
        query = text("""
            SELECT
                id, name, description, plan_type as tier, price as price_monthly,
                CASE
                    WHEN billing_interval = 'yearly' THEN price
                    ELSE price * 10
                END as price_yearly,
                currency, max_bookings_per_month, max_staff_members, max_services,
                priority_support, custom_branding, api_access,
                booking_discount_percentage, setup_fee, trial_period_days as trial_days,
                molly_price_id as mollie_price_id_monthly, molly_product_id as mollie_product_id,
                features, is_active, is_featured, display_order, created_at
            FROM subscription_plans
            WHERE (:include_inactive = true OR is_active = true)
            ORDER BY display_order, created_at
        """)

        result = await db.execute(query, {"include_inactive": include_inactive})
        plans = []

        for row in result.fetchall():
            # Parse features
            features_list = row.features if isinstance(row.features, list) else []

            plan = SubscriptionPlan(
                id=row.id,
                name=row.name,
                description=row.description,
                tier=row.tier,
                price_monthly=row.price_monthly,
                price_yearly=row.price_yearly,
                currency=row.currency,
                max_bookings_per_month=row.max_bookings_per_month,
                max_staff_members=row.max_staff_members,
                max_services=row.max_services,
                priority_support=row.priority_support or False,
                custom_branding=row.custom_branding or False,
                api_access=row.api_access or False,
                advanced_analytics=False,
                multi_location=False,
                booking_discount_percentage=row.booking_discount_percentage or Decimal('0'),
                setup_fee=row.setup_fee or Decimal('0'),
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
        logger.error("Error listing subscription plans", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list subscription plans"
        )


# Subscription Management
@router.get("/subscriptions", response_model=List[Dict[str, Any]])
async def list_subscriptions(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    plan_filter: Optional[str] = Query(None, description="Filter by plan"),
    user_email: Optional[str] = Query(None, description="Filter by user email"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """List all subscriptions with filtering options."""
    try:
        # Build dynamic query
        conditions = []
        params = {"limit": limit, "offset": offset}

        if status_filter:
            conditions.append("ss.name = :status_filter")
            params["status_filter"] = status_filter

        if plan_filter:
            conditions.append("sp.name ILIKE :plan_filter")
            params["plan_filter"] = f"%{plan_filter}%"

        if user_email:
            conditions.append("u.email ILIKE :user_email")
            params["user_email"] = f"%{user_email}%"

        where_clause = " AND " + " AND ".join(conditions) if conditions else ""

        query = text(f"""
            SELECT
                us.id,
                us.user_id,
                u.email,
                u.first_name,
                u.last_name,
                sp.name as plan_name,
                sp.plan_type,
                ss.name as status,
                us.plan_price,
                us.currency,
                us.billing_period,
                us.current_period_start,
                us.current_period_end,
                us.trial_end,
                us.bookings_used_this_period,
                sp.max_bookings_per_month,
                us.mollie_subscription_id,
                us.mollie_customer_id,
                us.cancel_at_period_end,
                us.cancelled_at,
                us.created_at
            FROM user_subscriptions us
            JOIN users u ON us.user_id = u.id
            JOIN subscription_plans sp ON us.plan_id = sp.id
            JOIN subscription_statuses ss ON us.status_id = ss.id
            WHERE 1=1 {where_clause}
            ORDER BY us.created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await db.execute(query, params)
        subscriptions = []

        for row in result.fetchall():
            subscriptions.append({
                "id": str(row.id),
                "user": {
                    "id": str(row.user_id),
                    "email": row.email,
                    "name": f"{row.first_name} {row.last_name}"
                },
                "plan": {
                    "name": row.plan_name,
                    "type": row.plan_type,
                    "price": float(row.plan_price),
                    "currency": row.currency
                },
                "status": row.status,
                "billing_period": row.billing_period,
                "current_period": {
                    "start": row.current_period_start.isoformat(),
                    "end": row.current_period_end.isoformat()
                },
                "trial_end": row.trial_end.isoformat() if row.trial_end else None,
                "usage": {
                    "bookings_used": row.bookings_used_this_period,
                    "bookings_limit": row.max_bookings_per_month,
                    "usage_percentage": (row.bookings_used_this_period / row.max_bookings_per_month * 100) if row.max_bookings_per_month else None
                },
                "mollie": {
                    "subscription_id": row.mollie_subscription_id,
                    "customer_id": row.mollie_customer_id
                },
                "cancellation": {
                    "cancel_at_period_end": row.cancel_at_period_end,
                    "cancelled_at": row.cancelled_at.isoformat() if row.cancelled_at else None
                },
                "created_at": row.created_at.isoformat()
            })

        return subscriptions

    except Exception as e:
        logger.error("Error listing subscriptions", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list subscriptions"
        )


@router.post("/subscriptions/{subscription_id}/actions", response_model=Dict[str, Any])
async def perform_subscription_action(
    subscription_id: UUID,
    action: SubscriptionAction,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Perform administrative action on subscription."""
    try:
        # Get subscription details
        subscription_query = await db.execute(
            text("""
                SELECT us.*, u.email, sp.name as plan_name, ss.name as status
                FROM user_subscriptions us
                JOIN users u ON us.user_id = u.id
                JOIN subscription_plans sp ON us.plan_id = sp.id
                JOIN subscription_statuses ss ON us.status_id = ss.id
                WHERE us.id = :subscription_id::uuid
            """),
            {"subscription_id": subscription_id}
        )

        subscription = subscription_query.first()
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found"
            )

        result = {}

        if action.action == "cancel":
            # Cancel subscription
            if subscription.mollie_subscription_id and subscription.mollie_customer_id:
                try:
                    await mollie_service.cancel_subscription(
                        subscription.mollie_customer_id,
                        subscription.mollie_subscription_id
                    )
                except MollieAPIError as e:
                    logger.warning("Failed to cancel subscription in Mollie", error=str(e))

            # Update database
            canceled_status_id = await db.execute(
                text("SELECT id FROM subscription_statuses WHERE name = 'canceled' LIMIT 1")
            )
            status_id = canceled_status_id.scalar()

            await db.execute(
                text("""
                    UPDATE user_subscriptions
                    SET status_id = :status_id, cancelled_at = NOW(),
                        cancellation_reason = :reason
                    WHERE id = :subscription_id::uuid
                """),
                {
                    "subscription_id": subscription_id,
                    "status_id": status_id,
                    "reason": action.reason or f"Cancelled by admin {admin_user.email}"
                }
            )

            result = {"action": "cancelled", "reason": action.reason}

        elif action.action == "reactivate":
            # Reactivate subscription
            active_status_id = await db.execute(
                text("SELECT id FROM subscription_statuses WHERE name = 'active' LIMIT 1")
            )
            status_id = active_status_id.scalar()

            await db.execute(
                text("""
                    UPDATE user_subscriptions
                    SET status_id = :status_id, cancelled_at = NULL,
                        cancellation_reason = NULL
                    WHERE id = :subscription_id::uuid
                """),
                {"subscription_id": subscription_id, "status_id": status_id}
            )

            result = {"action": "reactivated"}

        elif action.action == "reset_usage":
            # Reset usage counters
            await db.execute(
                text("""
                    UPDATE user_subscriptions
                    SET bookings_used_this_period = 0, updated_at = NOW()
                    WHERE id = :subscription_id::uuid
                """),
                {"subscription_id": subscription_id}
            )

            result = {"action": "usage_reset"}

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown action: {action.action}"
            )

        # Log the action
        await db.execute(
            text("""
                INSERT INTO subscription_history (
                    subscription_id, change_type, change_reason, changed_by, metadata
                ) VALUES (
                    :subscription_id::uuid, :action, :reason, :admin_id::uuid, :metadata::jsonb
                )
            """),
            {
                "subscription_id": subscription_id,
                "action": f"admin_{action.action}",
                "reason": action.reason or f"Admin action by {admin_user.email}",
                "admin_id": admin_user.id,
                "metadata": action.metadata or {}
            }
        )

        await db.commit()

        logger.info(
            "Admin subscription action performed",
            subscription_id=subscription_id,
            action=action.action,
            admin_user=admin_user.id,
            user_email=subscription.email
        )

        return {
            "subscription_id": str(subscription_id),
            "user_email": subscription.email,
            "plan_name": subscription.plan_name,
            "previous_status": subscription.status,
            **result,
            "performed_by": admin_user.email,
            "performed_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error performing subscription action", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to perform subscription action"
        )


# Payment and Transaction Management
@router.get("/transactions", response_model=List[Dict[str, Any]])
async def list_payment_transactions(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    transaction_type: Optional[str] = Query(None, description="Filter by type"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """List payment transactions with filtering."""
    try:
        conditions = []
        params = {"limit": limit, "offset": offset}

        if status_filter:
            conditions.append("pt.status = :status_filter")
            params["status_filter"] = status_filter

        if transaction_type:
            conditions.append("pt.transaction_type = :transaction_type")
            params["transaction_type"] = transaction_type

        if start_date:
            conditions.append("pt.created_at >= :start_date")
            params["start_date"] = start_date

        if end_date:
            conditions.append("pt.created_at <= :end_date")
            params["end_date"] = end_date

        where_clause = " AND " + " AND ".join(conditions) if conditions else ""

        query = text(f"""
            SELECT
                pt.id,
                pt.user_id,
                u.email,
                u.first_name,
                u.last_name,
                pt.transaction_type,
                pt.amount,
                pt.currency,
                pt.status,
                pt.mollie_payment_intent_id,
                pt.mollie_charge_id,
                pt.description,
                pt.failure_reason,
                pt.created_at,
                pt.processed_at
            FROM payment_transactions pt
            JOIN users u ON pt.user_id = u.id
            WHERE 1=1 {where_clause}
            ORDER BY pt.created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await db.execute(query, params)
        transactions = []

        for row in result.fetchall():
            transactions.append({
                "id": str(row.id),
                "user": {
                    "id": str(row.user_id),
                    "email": row.email,
                    "name": f"{row.first_name} {row.last_name}"
                },
                "type": row.transaction_type,
                "amount": float(row.amount),
                "currency": row.currency,
                "status": row.status,
                "mollie": {
                    "payment_intent_id": row.mollie_payment_intent_id,
                    "charge_id": row.mollie_charge_id
                },
                "description": row.description,
                "failure_reason": row.failure_reason,
                "created_at": row.created_at.isoformat(),
                "processed_at": row.processed_at.isoformat() if row.processed_at else None
            })

        return transactions

    except Exception as e:
        logger.error("Error listing payment transactions", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list transactions"
        )


@router.get("/revenue-report")
async def get_revenue_report(
    start_date: datetime = Query(default_factory=lambda: datetime.utcnow() - timedelta(days=30)),
    end_date: datetime = Query(default_factory=datetime.utcnow),
    group_by: str = Query("day", pattern="^(day|week|month)$"),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Generate revenue report with time-based grouping."""
    try:
        # Determine date trunc format
        date_format = {
            "day": "day",
            "week": "week",
            "month": "month"
        }[group_by]

        query = text(f"""
            SELECT
                DATE_TRUNC('{date_format}', pt.created_at) as period,
                COUNT(*) as transaction_count,
                SUM(pt.amount) as total_revenue,
                AVG(pt.amount) as avg_transaction_value,
                COUNT(CASE WHEN pt.status = 'succeeded' THEN 1 END) as successful_transactions,
                COUNT(CASE WHEN pt.status = 'failed' THEN 1 END) as failed_transactions,
                SUM(CASE WHEN pt.transaction_type = 'subscription_charge' THEN pt.amount ELSE 0 END) as subscription_revenue,
                SUM(CASE WHEN pt.transaction_type = 'booking_payment' THEN pt.amount ELSE 0 END) as booking_revenue
            FROM payment_transactions pt
            WHERE pt.created_at BETWEEN :start_date AND :end_date
            AND pt.status = 'succeeded'
            GROUP BY DATE_TRUNC('{date_format}', pt.created_at)
            ORDER BY period
        """)

        result = await db.execute(query, {"start_date": start_date, "end_date": end_date})
        data = []
        total_revenue = Decimal('0')
        total_transactions = 0

        for row in result.fetchall():
            period_data = {
                "period": row.period.isoformat(),
                "transaction_count": row.transaction_count,
                "total_revenue": float(row.total_revenue),
                "avg_transaction_value": float(row.avg_transaction_value),
                "successful_transactions": row.successful_transactions,
                "failed_transactions": row.failed_transactions,
                "subscription_revenue": float(row.subscription_revenue),
                "booking_revenue": float(row.booking_revenue)
            }
            data.append(period_data)
            total_revenue += row.total_revenue
            total_transactions += row.transaction_count

        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "group_by": group_by
            },
            "summary": {
                "total_revenue": float(total_revenue),
                "total_transactions": total_transactions,
                "avg_transaction_value": float(total_revenue / total_transactions) if total_transactions > 0 else 0
            },
            "data": data,
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": admin_user.email
        }

    except Exception as e:
        logger.error("Error generating revenue report", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate revenue report"
        )
