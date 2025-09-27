-- Migration 010: Enhanced Payment System Tables for Mollie Integration
-- PostgreSQL 17 Payment Infrastructure
-- Created: 2025-09-26
-- Complete payment system with Mollie gateway integration

-- =====================================================
-- PAYMENT INFRASTRUCTURE TABLES
-- =====================================================

-- User payment customers (Mollie customer mapping)
CREATE TABLE user_payment_customers (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mollie_customer_id VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Payment intents table (for tracking payment creation to completion)
CREATE TABLE payment_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,

    -- Payment details
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'DKK',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_type VARCHAR(50) NOT NULL, -- booking, subscription, refund

    -- Mollie integration
    mollie_payment_id VARCHAR(255) UNIQUE,
    checkout_url TEXT,

    -- Metadata
    description TEXT,
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_payment_type CHECK (payment_type IN ('booking', 'subscription', 'refund')),
    CONSTRAINT chk_currency CHECK (LENGTH(currency) = 3),
    CONSTRAINT chk_status CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'expired'))
);

-- Refunds table
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
    mollie_refund_id VARCHAR(255) NOT NULL UNIQUE,

    -- Refund details
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'DKK',
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'processing',

    -- Admin details
    created_by UUID REFERENCES users(id),
    processed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_refund_status CHECK (status IN ('processing', 'pending', 'refunded', 'failed'))
);

-- =====================================================
-- SUBSCRIPTION PLAN TIERS SETUP
-- =====================================================

-- Insert default subscription statuses
INSERT INTO subscription_statuses (name, description, color_code, is_active_status, allows_billing, allows_usage, sort_order)
VALUES
    ('pending', 'Subscription is pending activation', '#FFA500', false, false, false, 1),
    ('trialing', 'Subscription is in trial period', '#87CEEB', true, false, true, 2),
    ('active', 'Subscription is active and billing', '#28A745', true, true, true, 3),
    ('past_due', 'Payment failed, subscription past due', '#DC3545', false, false, true, 4),
    ('canceled', 'Subscription has been canceled', '#6C757D', false, false, false, 5),
    ('unpaid', 'Subscription is unpaid', '#DC3545', false, false, false, 6),
    ('incomplete', 'Subscription creation incomplete', '#FFC107', false, false, false, 7),
    ('incomplete_expired', 'Incomplete subscription expired', '#6C757D', false, false, false, 8);

-- Insert default subscription plans with proper Danish pricing
INSERT INTO subscription_plans (
    name, description, slug, plan_type, billing_interval, price, currency,
    features, max_bookings_per_month, max_staff_members, max_services,
    priority_support, custom_branding, api_access, booking_discount_percentage,
    trial_period_days, is_featured, display_order
) VALUES
-- Basic Plan
(
    'Basic',
    'Perfect for individual locticians starting their business',
    'basic',
    'basic',
    'monthly',
    299.00,
    'DKK',
    '["Online booking system", "Customer management", "Basic calendar", "Email notifications", "Mobile responsive", "Basic reporting"]'::jsonb,
    50,
    1,
    10,
    false,
    false,
    false,
    0,
    14,
    false,
    1
),
-- Premium Plan
(
    'Premium',
    'Ideal for growing loctician businesses with multiple services',
    'premium',
    'premium',
    'monthly',
    599.00,
    'DKK',
    '["Everything in Basic", "Advanced calendar management", "Multiple service types", "Customer loyalty programs", "Advanced reporting", "SMS notifications", "Custom booking forms", "Inventory management"]'::jsonb,
    150,
    3,
    50,
    true,
    true,
    false,
    5,
    14,
    true,
    2
),
-- VIP Plan
(
    'VIP',
    'For established salons and multi-location businesses',
    'vip',
    'enterprise',
    'monthly',
    1199.00,
    'DKK',
    '["Everything in Premium", "Multi-location support", "Staff management", "Commission tracking", "Advanced analytics", "API access", "Custom integrations", "Priority support", "White-label options", "Financial reporting"]'::jsonb,
    500,
    10,
    200,
    true,
    true,
    true,
    10,
    14,
    true,
    3
),
-- Enterprise Plan
(
    'Enterprise',
    'Custom solutions for large salon chains and franchises',
    'enterprise',
    'enterprise',
    'monthly',
    2499.00,
    'DKK',
    '["Everything in VIP", "Unlimited locations", "Unlimited staff", "Custom development", "Dedicated account manager", "SLA guarantee", "Advanced security", "Custom reporting", "Third-party integrations", "Training and onboarding"]'::jsonb,
    null, -- unlimited
    null, -- unlimited
    null, -- unlimited
    true,
    true,
    true,
    15,
    0, -- no trial for enterprise
    false,
    4
);

-- Insert yearly pricing (with discount)
INSERT INTO subscription_plans (
    name, description, slug, plan_type, billing_interval, billing_interval_count, price, currency,
    features, max_bookings_per_month, max_staff_members, max_services,
    priority_support, custom_branding, api_access, booking_discount_percentage,
    trial_period_days, is_featured, display_order
) VALUES
-- Basic Yearly (2 months free)
(
    'Basic (Yearly)',
    'Perfect for individual locticians - save 2 months with yearly billing',
    'basic-yearly',
    'basic',
    'yearly',
    1,
    2990.00, -- 10 months instead of 12
    'DKK',
    '["Online booking system", "Customer management", "Basic calendar", "Email notifications", "Mobile responsive", "Basic reporting", "2 months free with yearly billing"]'::jsonb,
    50,
    1,
    10,
    false,
    false,
    false,
    0,
    14,
    false,
    5
),
-- Premium Yearly
(
    'Premium (Yearly)',
    'Growing businesses - save 2 months with yearly billing',
    'premium-yearly',
    'premium',
    'yearly',
    1,
    5990.00, -- 10 months instead of 12
    'DKK',
    '["Everything in Basic", "Advanced calendar management", "Multiple service types", "Customer loyalty programs", "Advanced reporting", "SMS notifications", "Custom booking forms", "Inventory management", "2 months free with yearly billing"]'::jsonb,
    150,
    3,
    50,
    true,
    true,
    false,
    5,
    14,
    true,
    6
),
-- VIP Yearly
(
    'VIP (Yearly)',
    'Established salons - save 2 months with yearly billing',
    'vip-yearly',
    'enterprise',
    'yearly',
    1,
    11990.00, -- 10 months instead of 12
    'DKK',
    '["Everything in Premium", "Multi-location support", "Staff management", "Commission tracking", "Advanced analytics", "API access", "Custom integrations", "Priority support", "White-label options", "Financial reporting", "2 months free with yearly billing"]'::jsonb,
    500,
    10,
    200,
    true,
    true,
    true,
    10,
    14,
    true,
    7
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Payment intents indexes
CREATE INDEX idx_payment_intents_user ON payment_intents (user_id, created_at DESC);
CREATE INDEX idx_payment_intents_status ON payment_intents (status, created_at DESC);
CREATE INDEX idx_payment_intents_mollie ON payment_intents (mollie_payment_id) WHERE mollie_payment_id IS NOT NULL;
CREATE INDEX idx_payment_intents_booking ON payment_intents (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_payment_intents_type ON payment_intents (payment_type, status);

-- User payment customers indexes
CREATE INDEX idx_user_payment_customers_mollie ON user_payment_customers (mollie_customer_id);

-- Refunds indexes
CREATE INDEX idx_refunds_payment ON refunds (payment_intent_id, created_at DESC);
CREATE INDEX idx_refunds_mollie ON refunds (mollie_refund_id);
CREATE INDEX idx_refunds_status ON refunds (status, created_at DESC);
CREATE INDEX idx_refunds_admin ON refunds (created_by) WHERE created_by IS NOT NULL;

-- =====================================================
-- TRIGGERS AND AUTOMATION
-- =====================================================

-- Updated_at triggers
CREATE TRIGGER update_user_payment_customers_updated_at
    BEFORE UPDATE ON user_payment_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_intents_updated_at
    BEFORE UPDATE ON payment_intents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SUBSCRIPTION BUSINESS LOGIC ENHANCEMENTS
-- =====================================================

-- Function to get subscription plan recommendations
CREATE OR REPLACE FUNCTION get_plan_recommendations(
    current_user_id UUID,
    current_bookings_per_month INTEGER DEFAULT 0,
    projected_growth_percentage DECIMAL DEFAULT 20
)
RETURNS TABLE(
    plan_id UUID,
    plan_name VARCHAR(255),
    plan_type plan_type,
    monthly_price DECIMAL(10,2),
    yearly_price DECIMAL(10,2),
    max_bookings INTEGER,
    is_recommended BOOLEAN,
    recommendation_reason TEXT
) AS $$
DECLARE
    projected_bookings INTEGER;
BEGIN
    projected_bookings := CEIL(current_bookings_per_month * (1 + projected_growth_percentage / 100));

    RETURN QUERY
    SELECT
        sp.id,
        sp.name,
        sp.plan_type,
        sp.price as monthly_price,
        CASE
            WHEN sp.billing_interval = 'yearly' THEN sp.price
            ELSE sp.price * 10 -- Yearly discount
        END as yearly_price,
        sp.max_bookings_per_month,
        CASE
            WHEN sp.max_bookings_per_month IS NULL THEN true -- Unlimited
            WHEN sp.max_bookings_per_month >= projected_bookings THEN true
            ELSE false
        END as is_recommended,
        CASE
            WHEN sp.max_bookings_per_month IS NULL THEN 'Unlimited plan - no booking limits'
            WHEN sp.max_bookings_per_month >= projected_bookings THEN
                'Suitable for your projected ' || projected_bookings || ' bookings per month'
            ELSE
                'May be too limited - you need ' || projected_bookings || ' bookings but plan allows ' || sp.max_bookings_per_month
        END as recommendation_reason
    FROM subscription_plans sp
    WHERE sp.is_active = true
    AND sp.billing_interval = 'monthly' -- Show monthly plans for comparison
    ORDER BY sp.display_order, sp.price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate subscription metrics
CREATE OR REPLACE FUNCTION calculate_subscription_metrics(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    metric_name TEXT,
    metric_value DECIMAL,
    metric_unit TEXT,
    calculation_period TEXT
) AS $$
DECLARE
    total_subscribers INTEGER;
    new_subscribers INTEGER;
    churned_subscribers INTEGER;
    total_revenue DECIMAL(12,2);
    avg_revenue_per_user DECIMAL(10,2);
    churn_rate DECIMAL(5,2);
BEGIN
    -- Calculate metrics
    SELECT COUNT(*) INTO total_subscribers
    FROM user_subscriptions us
    JOIN subscription_statuses ss ON us.status_id = ss.id
    WHERE ss.is_active_status = true
    AND us.current_period_end > end_date;

    SELECT COUNT(*) INTO new_subscribers
    FROM user_subscriptions us
    WHERE us.created_at >= start_date
    AND us.created_at <= end_date;

    SELECT COUNT(*) INTO churned_subscribers
    FROM user_subscriptions us
    WHERE us.cancelled_at >= start_date
    AND us.cancelled_at <= end_date;

    SELECT COALESCE(SUM(pt.amount), 0) INTO total_revenue
    FROM payment_transactions pt
    WHERE pt.status = 'succeeded'
    AND pt.created_at >= start_date
    AND pt.created_at <= end_date
    AND pt.transaction_type IN ('subscription_charge', 'setup_fee');

    IF total_subscribers > 0 THEN
        avg_revenue_per_user := total_revenue / total_subscribers;
    ELSE
        avg_revenue_per_user := 0;
    END IF;

    IF total_subscribers > 0 THEN
        churn_rate := (churned_subscribers::DECIMAL / total_subscribers) * 100;
    ELSE
        churn_rate := 0;
    END IF;

    -- Return metrics
    RETURN QUERY VALUES
        ('Total Active Subscribers', total_subscribers::DECIMAL, 'subscribers', start_date || ' to ' || end_date),
        ('New Subscribers', new_subscribers::DECIMAL, 'subscribers', start_date || ' to ' || end_date),
        ('Churned Subscribers', churned_subscribers::DECIMAL, 'subscribers', start_date || ' to ' || end_date),
        ('Total Revenue', total_revenue, 'DKK', start_date || ' to ' || end_date),
        ('Average Revenue Per User', avg_revenue_per_user, 'DKK', start_date || ' to ' || end_date),
        ('Churn Rate', churn_rate, 'percentage', start_date || ' to ' || end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle subscription upgrades/downgrades with proration
CREATE OR REPLACE FUNCTION process_subscription_change(
    subscription_uuid UUID,
    new_plan_uuid UUID,
    effective_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    prorate BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
    current_subscription RECORD;
    new_plan RECORD;
    current_plan RECORD;
    days_remaining INTEGER;
    total_days INTEGER;
    credit_amount DECIMAL(10,2) := 0;
    charge_amount DECIMAL(10,2) := 0;
    proration_amount DECIMAL(10,2) := 0;
    result JSONB;
BEGIN
    -- Get current subscription
    SELECT us.*, sp.price as current_price, sp.name as current_plan_name
    INTO current_subscription
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.id = subscription_uuid;

    IF current_subscription IS NULL THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;

    -- Get new plan
    SELECT * INTO new_plan
    FROM subscription_plans
    WHERE id = new_plan_uuid AND is_active = true;

    IF new_plan IS NULL THEN
        RAISE EXCEPTION 'New plan not found or inactive';
    END IF;

    -- Calculate proration if enabled
    IF prorate THEN
        days_remaining := EXTRACT(DAYS FROM (current_subscription.current_period_end - effective_date));
        total_days := EXTRACT(DAYS FROM (current_subscription.current_period_end - current_subscription.current_period_start));

        IF days_remaining > 0 AND total_days > 0 THEN
            -- Credit for unused portion of current plan
            credit_amount := (current_subscription.plan_price * days_remaining) / total_days;

            -- Charge for new plan (prorated)
            charge_amount := (new_plan.price * days_remaining) / total_days;

            proration_amount := charge_amount - credit_amount;
        END IF;
    END IF;

    -- Update subscription
    UPDATE user_subscriptions
    SET plan_id = new_plan_uuid,
        plan_price = new_plan.price,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = subscription_uuid;

    -- Log the change
    INSERT INTO subscription_history (
        subscription_id,
        from_plan_id,
        to_plan_id,
        change_type,
        change_reason,
        metadata
    ) VALUES (
        subscription_uuid,
        current_subscription.plan_id,
        new_plan_uuid,
        CASE
            WHEN new_plan.price > current_subscription.plan_price THEN 'upgrade'
            WHEN new_plan.price < current_subscription.plan_price THEN 'downgrade'
            ELSE 'change'
        END,
        'Plan change from ' || current_subscription.current_plan_name || ' to ' || new_plan.name,
        jsonb_build_object(
            'proration_amount', proration_amount,
            'credit_amount', credit_amount,
            'charge_amount', charge_amount,
            'effective_date', effective_date
        )
    );

    -- Build result
    result := jsonb_build_object(
        'success', true,
        'subscription_id', subscription_uuid,
        'old_plan', current_subscription.current_plan_name,
        'new_plan', new_plan.name,
        'proration_amount', proration_amount,
        'credit_amount', credit_amount,
        'charge_amount', charge_amount,
        'effective_date', effective_date
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VIEWS FOR SUBSCRIPTION ANALYTICS
-- =====================================================

-- Monthly recurring revenue view
CREATE VIEW v_monthly_recurring_revenue AS
SELECT
    DATE_TRUNC('month', us.current_period_start) as month,
    sp.plan_type,
    COUNT(*) as subscriber_count,
    SUM(us.plan_price) as monthly_revenue,
    AVG(us.plan_price) as avg_price_per_subscriber
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
JOIN subscription_statuses ss ON us.status_id = ss.id
WHERE ss.is_active_status = true
AND us.current_period_end > CURRENT_TIMESTAMP
GROUP BY DATE_TRUNC('month', us.current_period_start), sp.plan_type
ORDER BY month DESC, sp.plan_type;

-- Subscription health dashboard view
CREATE VIEW v_subscription_dashboard AS
SELECT
    'Active Subscriptions' as metric,
    COUNT(*)::TEXT as value,
    'subscriptions' as unit
FROM user_subscriptions us
JOIN subscription_statuses ss ON us.status_id = ss.id
WHERE ss.is_active_status = true
AND us.current_period_end > CURRENT_TIMESTAMP

UNION ALL

SELECT
    'Monthly Recurring Revenue' as metric,
    ROUND(SUM(us.plan_price), 2)::TEXT as value,
    'DKK' as unit
FROM user_subscriptions us
JOIN subscription_statuses ss ON us.status_id = ss.id
WHERE ss.is_active_status = true
AND us.current_period_end > CURRENT_TIMESTAMP
AND us.billing_period = 'monthly'

UNION ALL

SELECT
    'Trial Subscriptions' as metric,
    COUNT(*)::TEXT as value,
    'subscriptions' as unit
FROM user_subscriptions us
JOIN subscription_statuses ss ON us.status_id = ss.id
WHERE ss.name = 'trialing'
AND us.trial_end > CURRENT_TIMESTAMP

UNION ALL

SELECT
    'Churn Rate (30 days)' as metric,
    ROUND(
        (COUNT(CASE WHEN us.cancelled_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END)::DECIMAL /
         NULLIF(COUNT(*), 0)) * 100, 2
    )::TEXT as value,
    '%' as unit
FROM user_subscriptions us;

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON TABLE user_payment_customers IS 'Maps users to Mollie customer IDs for payment processing';
COMMENT ON TABLE payment_intents IS 'Tracks payment creation through completion with Mollie integration';
COMMENT ON TABLE refunds IS 'Manages payment refunds through Mollie with admin approval workflow';

COMMENT ON FUNCTION get_plan_recommendations IS 'Recommends subscription plans based on usage patterns and growth projections';
COMMENT ON FUNCTION calculate_subscription_metrics IS 'Calculates key subscription business metrics for analytics';
COMMENT ON FUNCTION process_subscription_change IS 'Handles subscription upgrades/downgrades with proration calculations';

COMMENT ON VIEW v_monthly_recurring_revenue IS 'Monthly recurring revenue analytics by plan type';
COMMENT ON VIEW v_subscription_dashboard IS 'Key subscription metrics for dashboard display';