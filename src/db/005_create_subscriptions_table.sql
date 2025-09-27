-- Migration 005: Enhanced Subscription & Molly Payment Integration
-- PostgreSQL 17 Advanced Payment Platform
-- Created: 2025-09-26
-- Comprehensive subscription management with Molly payment gateway

-- =====================================================
-- SUBSCRIPTION PLANS & PRICING
-- =====================================================

-- Plan types enum
CREATE TYPE plan_type AS ENUM ('basic', 'premium', 'enterprise', 'custom', 'trial');

-- Enhanced subscription plans table
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    slug VARCHAR(100) NOT NULL UNIQUE,

    -- Plan configuration
    plan_type plan_type NOT NULL DEFAULT 'basic',
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly', -- monthly, yearly, weekly
    billing_interval_count INTEGER NOT NULL DEFAULT 1,

    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    setup_fee DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'DKK',

    -- Features and limits
    features JSONB,
    max_bookings_per_month INTEGER,
    max_staff_members INTEGER,
    max_services INTEGER,
    priority_support BOOLEAN DEFAULT false,
    custom_branding BOOLEAN DEFAULT false,
    api_access BOOLEAN DEFAULT false,

    -- Booking discounts
    booking_discount_percentage DECIMAL(5,2) DEFAULT 0,
    service_commission_rate DECIMAL(5,2) DEFAULT 0,

    -- Trial configuration
    trial_period_days INTEGER DEFAULT 0,
    has_trial BOOLEAN DEFAULT false,

    -- Molly payment integration
    molly_price_id VARCHAR(255), -- Molly recurring price ID
    molly_product_id VARCHAR(255), -- Molly product ID

    -- Plan visibility and ordering
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true, -- Hide from public listing
    display_order INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_billing_interval CHECK (billing_interval IN ('monthly', 'yearly', 'weekly')),
    CONSTRAINT chk_billing_interval_count CHECK (billing_interval_count > 0),
    CONSTRAINT chk_price CHECK (price >= 0),
    CONSTRAINT chk_booking_discount CHECK (booking_discount_percentage >= 0 AND booking_discount_percentage <= 100),
    CONSTRAINT chk_commission_rate CHECK (service_commission_rate >= 0 AND service_commission_rate <= 100)
);

-- Plan addons/features table
CREATE TABLE subscription_plan_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,

    feature_name VARCHAR(100) NOT NULL,
    feature_value TEXT,
    feature_type VARCHAR(50) DEFAULT 'boolean', -- boolean, number, text, json
    is_highlighted BOOLEAN DEFAULT false,

    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(plan_id, feature_name)
);

-- =====================================================
-- SUBSCRIPTION STATUSES & WORKFLOWS
-- =====================================================

-- Enhanced subscription statuses
CREATE TABLE subscription_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color_code VARCHAR(7), -- Hex color for UI

    -- Status behavior
    is_active_status BOOLEAN NOT NULL DEFAULT false,
    is_trial_status BOOLEAN DEFAULT false,
    allows_billing BOOLEAN DEFAULT true,
    allows_usage BOOLEAN DEFAULT true,

    -- Workflow
    can_cancel BOOLEAN DEFAULT true,
    can_upgrade BOOLEAN DEFAULT true,
    can_downgrade BOOLEAN DEFAULT true,

    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- USER SUBSCRIPTIONS & BILLING
-- =====================================================

-- Enhanced user subscriptions table
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status_id INTEGER NOT NULL REFERENCES subscription_statuses(id),

    -- Billing cycle
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    next_billing_date TIMESTAMPTZ,
    billing_cycle_anchor DATE, -- Day of month for billing

    -- Molly payment integration
    molly_subscription_id VARCHAR(255) UNIQUE,
    molly_customer_id VARCHAR(255),
    molly_payment_method_id VARCHAR(255),

    -- Trial management
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    trial_used BOOLEAN DEFAULT false,

    -- Usage tracking
    bookings_used_this_period INTEGER NOT NULL DEFAULT 0,
    staff_members_count INTEGER DEFAULT 1,
    services_count INTEGER DEFAULT 0,

    -- Pricing (stored for historical records)
    plan_price DECIMAL(10,2) NOT NULL,
    setup_fee_paid DECIMAL(10,2) DEFAULT 0,
    discount_applied DECIMAL(5,2) DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'DKK',

    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Metadata and notes
    metadata JSONB,
    admin_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_period_dates CHECK (current_period_end > current_period_start),
    CONSTRAINT chk_bookings_used CHECK (bookings_used_this_period >= 0),
    CONSTRAINT chk_trial_dates CHECK (trial_end IS NULL OR trial_end > trial_start)
);

-- Subscription change requests (for upgrades/downgrades)
CREATE TABLE subscription_change_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,

    -- Change details
    from_plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    to_plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    change_type VARCHAR(20) NOT NULL, -- upgrade, downgrade, change

    -- Timing
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_date TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, processed, cancelled

    -- Pricing calculation
    proration_amount DECIMAL(10,2),
    next_charge_amount DECIMAL(10,2),

    -- Processing
    requested_by UUID REFERENCES users(id),
    processed_by UUID REFERENCES users(id),
    processing_notes TEXT,

    CONSTRAINT chk_change_type CHECK (change_type IN ('upgrade', 'downgrade', 'change')),
    CONSTRAINT chk_status CHECK (status IN ('pending', 'approved', 'processed', 'cancelled'))
);

-- =====================================================
-- MOLLY PAYMENT TRANSACTIONS
-- =====================================================

-- Payment transaction types
CREATE TYPE transaction_type AS ENUM (
    'subscription_charge',
    'setup_fee',
    'booking_payment',
    'refund',
    'partial_refund',
    'chargeback',
    'credit'
);

-- Payment statuses
CREATE TYPE payment_status AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'cancelled',
    'refunded',
    'disputed'
);

-- Enhanced payment transactions table
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    subscription_id UUID REFERENCES user_subscriptions(id),
    booking_id UUID REFERENCES bookings(id),

    -- Transaction details
    transaction_type transaction_type NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'DKK',
    status payment_status NOT NULL DEFAULT 'pending',

    -- Molly payment fields
    molly_payment_intent_id VARCHAR(255),
    molly_charge_id VARCHAR(255),
    molly_transaction_id VARCHAR(255) UNIQUE,
    molly_invoice_id VARCHAR(255),

    -- Payment method
    payment_method_type VARCHAR(50), -- card, bank_transfer, mobile_pay
    payment_method_details JSONB,

    -- Fees and taxes
    application_fee DECIMAL(10,2) DEFAULT 0,
    processing_fee DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(10,2),

    -- Additional data
    description TEXT,
    metadata JSONB,
    failure_reason TEXT,
    failure_code VARCHAR(100),

    -- Refund information
    refunded_amount DECIMAL(10,2) DEFAULT 0,
    refund_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,

    CONSTRAINT chk_amount CHECK (amount >= 0),
    CONSTRAINT chk_currency CHECK (LENGTH(currency) = 3),
    CONSTRAINT chk_refunded_amount CHECK (refunded_amount >= 0 AND refunded_amount <= amount)
);

-- Payment method storage (for repeat customers)
CREATE TABLE customer_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Molly payment method
    molly_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
    molly_customer_id VARCHAR(255) NOT NULL,

    -- Payment method details
    type VARCHAR(50) NOT NULL, -- card, bank_account, mobile_pay
    last_four VARCHAR(4),
    brand VARCHAR(50), -- visa, mastercard, etc.
    expires_month INTEGER,
    expires_year INTEGER,

    -- Status
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    billing_details JSONB,
    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_expires_month CHECK (expires_month >= 1 AND expires_month <= 12),
    CONSTRAINT chk_expires_year CHECK (expires_year >= EXTRACT(YEAR FROM CURRENT_DATE))
);

-- =====================================================
-- SUBSCRIPTION HISTORY & AUDIT
-- =====================================================

-- Subscription state changes history
CREATE TABLE subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,

    -- Change details
    from_status_id INTEGER REFERENCES subscription_statuses(id),
    to_status_id INTEGER NOT NULL REFERENCES subscription_statuses(id),
    from_plan_id UUID REFERENCES subscription_plans(id),
    to_plan_id UUID REFERENCES subscription_plans(id),

    -- Change context
    change_reason TEXT,
    change_type VARCHAR(50), -- status_change, plan_change, billing_change

    -- Who made the change
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- System context
    ip_address INET,
    user_agent TEXT,

    -- Additional data
    metadata JSONB
);

-- Invoice generation and tracking
CREATE TABLE subscription_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),

    -- Invoice details
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    amount_due DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'DKK',

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, open, paid, void, uncollectible

    -- Billing period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Molly integration
    molly_invoice_id VARCHAR(255),

    -- Dates
    due_date DATE,
    issued_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,

    -- Payment tracking
    payment_transaction_id UUID REFERENCES payment_transactions(id),

    -- Line items (stored as JSON for flexibility)
    line_items JSONB NOT NULL,

    -- Additional data
    notes TEXT,
    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_invoice_status CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    CONSTRAINT chk_amounts CHECK (total_amount = amount_due + tax_amount)
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Subscription plans indexes
CREATE INDEX idx_subscription_plans_active ON subscription_plans (is_active, is_public, display_order) WHERE is_active = true;
CREATE INDEX idx_subscription_plans_type ON subscription_plans (plan_type, is_active) WHERE is_active = true;
CREATE INDEX idx_subscription_plans_featured ON subscription_plans (is_featured, display_order) WHERE is_featured = true;
CREATE INDEX idx_subscription_plans_molly ON subscription_plans (molly_price_id) WHERE molly_price_id IS NOT NULL;

-- Plan features indexes
CREATE INDEX idx_plan_features_plan ON subscription_plan_features (plan_id, display_order);

-- User subscriptions indexes
CREATE INDEX idx_user_subscriptions_active ON user_subscriptions (user_id, status_id)
    WHERE status_id IN (SELECT id FROM subscription_statuses WHERE is_active_status = true);
CREATE INDEX idx_user_subscriptions_billing ON user_subscriptions (next_billing_date)
    WHERE next_billing_date IS NOT NULL;
CREATE INDEX idx_user_subscriptions_trial ON user_subscriptions (trial_end)
    WHERE trial_end IS NOT NULL;
CREATE INDEX idx_user_subscriptions_molly ON user_subscriptions (molly_subscription_id)
    WHERE molly_subscription_id IS NOT NULL;
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions (status_id, current_period_end);

-- Payment transactions indexes
CREATE INDEX idx_payment_transactions_user ON payment_transactions (user_id, created_at DESC);
CREATE INDEX idx_payment_transactions_subscription ON payment_transactions (subscription_id, created_at DESC);
CREATE INDEX idx_payment_transactions_status ON payment_transactions (status, transaction_type);
CREATE INDEX idx_payment_transactions_molly ON payment_transactions (molly_payment_intent_id)
    WHERE molly_payment_intent_id IS NOT NULL;
CREATE INDEX idx_payment_transactions_failed ON payment_transactions (failed_at)
    WHERE status = 'failed';

-- Payment methods indexes
CREATE INDEX idx_payment_methods_user ON customer_payment_methods (user_id, is_active, is_default);
CREATE INDEX idx_payment_methods_molly ON customer_payment_methods (molly_payment_method_id);

-- History and audit indexes
CREATE INDEX idx_subscription_history_subscription ON subscription_history (subscription_id, changed_at DESC);
CREATE INDEX idx_subscription_history_user ON subscription_history (changed_by, changed_at DESC);

-- Invoice indexes
CREATE INDEX idx_invoices_subscription ON subscription_invoices (subscription_id, created_at DESC);
CREATE INDEX idx_invoices_user ON subscription_invoices (user_id, status, due_date);
CREATE INDEX idx_invoices_status ON subscription_invoices (status, due_date) WHERE status IN ('open', 'overdue');

-- =====================================================
-- TRIGGERS AND AUTOMATION
-- =====================================================

-- Updated_at triggers
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_payment_methods_updated_at
    BEFORE UPDATE ON customer_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_invoices_updated_at
    BEFORE UPDATE ON subscription_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Subscription status change trigger
CREATE OR REPLACE FUNCTION log_subscription_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Log status changes
        IF OLD.status_id != NEW.status_id THEN
            INSERT INTO subscription_history (
                subscription_id,
                from_status_id,
                to_status_id,
                change_type,
                change_reason
            ) VALUES (
                NEW.id,
                OLD.status_id,
                NEW.status_id,
                'status_change',
                'Status changed from ' || (SELECT name FROM subscription_statuses WHERE id = OLD.status_id) ||
                ' to ' || (SELECT name FROM subscription_statuses WHERE id = NEW.status_id)
            );
        END IF;

        -- Log plan changes
        IF OLD.plan_id != NEW.plan_id THEN
            INSERT INTO subscription_history (
                subscription_id,
                from_plan_id,
                to_plan_id,
                change_type,
                change_reason
            ) VALUES (
                NEW.id,
                OLD.plan_id,
                NEW.plan_id,
                'plan_change',
                'Plan changed from ' || (SELECT name FROM subscription_plans WHERE id = OLD.plan_id) ||
                ' to ' || (SELECT name FROM subscription_plans WHERE id = NEW.plan_id)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_change_trigger
    AFTER UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION log_subscription_status_change();

-- Auto-generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
           LPAD(NEXTVAL('invoice_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE invoice_number_seq START 1000;

CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number_trigger
    BEFORE INSERT ON subscription_invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_number();

-- =====================================================
-- SUBSCRIPTION BUSINESS LOGIC FUNCTIONS
-- =====================================================

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION user_has_active_subscription(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_active BOOLEAN := false;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM user_subscriptions us
        JOIN subscription_statuses ss ON us.status_id = ss.id
        WHERE us.user_id = user_uuid
          AND ss.is_active_status = true
          AND us.current_period_end > CURRENT_TIMESTAMP
          AND (us.trial_end IS NULL OR us.trial_end > CURRENT_TIMESTAMP)
    ) INTO has_active;

    RETURN has_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current subscription details
CREATE OR REPLACE FUNCTION get_user_current_subscription(user_uuid UUID)
RETURNS TABLE(
    subscription_id UUID,
    plan_name VARCHAR(255),
    plan_type plan_type,
    status_name VARCHAR(50),
    current_period_end TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    bookings_used INTEGER,
    max_bookings INTEGER,
    booking_discount DECIMAL(5,2),
    features JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        us.id,
        sp.name,
        sp.plan_type,
        ss.name,
        us.current_period_end,
        us.trial_end,
        us.bookings_used_this_period,
        sp.max_bookings_per_month,
        sp.booking_discount_percentage,
        sp.features
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    JOIN subscription_statuses ss ON us.status_id = ss.id
    WHERE us.user_id = user_uuid
      AND ss.is_active_status = true
      AND us.current_period_end > CURRENT_TIMESTAMP
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check subscription usage limits
CREATE OR REPLACE FUNCTION check_subscription_limits(
    user_uuid UUID,
    limit_type VARCHAR(50),
    requested_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    subscription_record RECORD;
    current_usage INTEGER;
    limit_value INTEGER;
BEGIN
    -- Get current subscription
    SELECT us.*, sp.max_bookings_per_month, sp.max_staff_members, sp.max_services
    INTO subscription_record
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    JOIN subscription_statuses ss ON us.status_id = ss.id
    WHERE us.user_id = user_uuid
      AND ss.is_active_status = true
      AND us.current_period_end > CURRENT_TIMESTAMP
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF subscription_record IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check specific limits
    CASE limit_type
        WHEN 'bookings' THEN
            current_usage := subscription_record.bookings_used_this_period;
            limit_value := subscription_record.max_bookings_per_month;
        WHEN 'staff' THEN
            current_usage := subscription_record.staff_members_count;
            limit_value := subscription_record.max_staff_members;
        WHEN 'services' THEN
            current_usage := subscription_record.services_count;
            limit_value := subscription_record.max_services;
        ELSE
            RETURN FALSE;
    END CASE;

    -- NULL limit means unlimited
    IF limit_value IS NULL THEN
        RETURN TRUE;
    END IF;

    RETURN (current_usage + requested_amount) <= limit_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment subscription usage
CREATE OR REPLACE FUNCTION increment_subscription_usage(
    user_uuid UUID,
    usage_type VARCHAR(50),
    amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    subscription_updated BOOLEAN := false;
BEGIN
    CASE usage_type
        WHEN 'bookings' THEN
            UPDATE user_subscriptions
            SET bookings_used_this_period = bookings_used_this_period + amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = user_uuid
              AND id = (
                  SELECT us.id
                  FROM user_subscriptions us
                  JOIN subscription_statuses ss ON us.status_id = ss.id
                  WHERE us.user_id = user_uuid
                    AND ss.is_active_status = true
                    AND us.current_period_end > CURRENT_TIMESTAMP
                  ORDER BY us.created_at DESC
                  LIMIT 1
              );
        WHEN 'staff' THEN
            UPDATE user_subscriptions
            SET staff_members_count = staff_members_count + amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = user_uuid
              AND id = (
                  SELECT us.id
                  FROM user_subscriptions us
                  JOIN subscription_statuses ss ON us.status_id = ss.id
                  WHERE us.user_id = user_uuid
                    AND ss.is_active_status = true
                    AND us.current_period_end > CURRENT_TIMESTAMP
                  ORDER BY us.created_at DESC
                  LIMIT 1
              );
        WHEN 'services' THEN
            UPDATE user_subscriptions
            SET services_count = services_count + amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = user_uuid
              AND id = (
                  SELECT us.id
                  FROM user_subscriptions us
                  JOIN subscription_statuses ss ON us.status_id = ss.id
                  WHERE us.user_id = user_uuid
                    AND ss.is_active_status = true
                    AND us.current_period_end > CURRENT_TIMESTAMP
                  ORDER BY us.created_at DESC
                  LIMIT 1
              );
        ELSE
            RETURN FALSE;
    END CASE;

    GET DIAGNOSTICS subscription_updated = ROW_COUNT;
    RETURN subscription_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate subscription pricing with discounts
CREATE OR REPLACE FUNCTION calculate_subscription_price(
    plan_uuid UUID,
    discount_code VARCHAR(50) DEFAULT NULL,
    promo_discount DECIMAL(5,2) DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    plan_record RECORD;
    base_price DECIMAL(10,2);
    setup_fee DECIMAL(10,2);
    discount_amount DECIMAL(10,2) := 0;
    final_price DECIMAL(10,2);
    result JSONB;
BEGIN
    SELECT * INTO plan_record
    FROM subscription_plans
    WHERE id = plan_uuid AND is_active = true;

    IF plan_record IS NULL THEN
        RAISE EXCEPTION 'Invalid or inactive subscription plan';
    END IF;

    base_price := plan_record.price;
    setup_fee := plan_record.setup_fee;

    -- Apply any promotional discount
    IF promo_discount > 0 THEN
        discount_amount := base_price * (promo_discount / 100);
    END IF;

    final_price := base_price - discount_amount;

    result := jsonb_build_object(
        'base_price', base_price,
        'setup_fee', setup_fee,
        'discount_amount', discount_amount,
        'final_price', final_price,
        'currency', plan_record.currency,
        'has_trial', plan_record.has_trial,
        'trial_days', plan_record.trial_period_days
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MOLLY PAYMENT WEBHOOK FUNCTIONS
-- =====================================================

-- Function to process Molly webhook events
CREATE OR REPLACE FUNCTION process_molly_webhook_event(
    event_type VARCHAR(100),
    event_data JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    subscription_id UUID;
    payment_intent_id VARCHAR(255);
    transaction_record RECORD;
BEGIN
    -- Extract common identifiers
    payment_intent_id := event_data->>'payment_intent_id';

    CASE event_type
        WHEN 'payment_intent.succeeded' THEN
            -- Update transaction status
            UPDATE payment_transactions
            SET status = 'succeeded',
                processed_at = CURRENT_TIMESTAMP,
                metadata = metadata || event_data
            WHERE molly_payment_intent_id = payment_intent_id;

        WHEN 'payment_intent.payment_failed' THEN
            -- Update transaction status
            UPDATE payment_transactions
            SET status = 'failed',
                failed_at = CURRENT_TIMESTAMP,
                failure_reason = event_data->>'failure_message',
                failure_code = event_data->>'failure_code',
                metadata = metadata || event_data
            WHERE molly_payment_intent_id = payment_intent_id;

        WHEN 'invoice.payment_succeeded' THEN
            -- Mark invoice as paid
            UPDATE subscription_invoices
            SET status = 'paid',
                paid_at = CURRENT_TIMESTAMP,
                metadata = metadata || event_data
            WHERE molly_invoice_id = event_data->>'invoice_id';

        WHEN 'customer.subscription.updated' THEN
            -- Update subscription details
            UPDATE user_subscriptions
            SET current_period_start = (event_data->>'current_period_start')::TIMESTAMPTZ,
                current_period_end = (event_data->>'current_period_end')::TIMESTAMPTZ,
                next_billing_date = (event_data->>'next_billing_date')::TIMESTAMPTZ,
                metadata = metadata || event_data
            WHERE molly_subscription_id = event_data->>'subscription_id';

        ELSE
            -- Log unknown event types
            INSERT INTO payment_transactions (
                user_id,
                transaction_type,
                amount,
                status,
                description,
                metadata
            ) VALUES (
                uuid_generate_v4(), -- Placeholder, should be extracted from event
                'credit',
                0,
                'pending',
                'Unknown webhook event: ' || event_type,
                event_data
            );
    END CASE;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the webhook
        INSERT INTO payment_transactions (
            user_id,
            transaction_type,
            amount,
            status,
            failure_reason,
            metadata
        ) VALUES (
            uuid_generate_v4(), -- Placeholder
            'credit',
            0,
            'failed',
            'Webhook processing error: ' || SQLERRM,
            event_data
        );
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON TABLE subscription_plans IS 'Enhanced subscription plans with Molly payment integration';
COMMENT ON TABLE subscription_plan_features IS 'Detailed feature breakdown for subscription plans';
COMMENT ON TABLE subscription_statuses IS 'Subscription status workflow with business rules';
COMMENT ON TABLE user_subscriptions IS 'User subscription records with comprehensive billing and usage tracking';
COMMENT ON TABLE subscription_change_requests IS 'Requests for subscription upgrades/downgrades';
COMMENT ON TABLE payment_transactions IS 'Payment transaction records with Molly gateway integration';
COMMENT ON TABLE customer_payment_methods IS 'Stored payment methods for repeat customers';
COMMENT ON TABLE subscription_history IS 'Complete audit trail of subscription changes';
COMMENT ON TABLE subscription_invoices IS 'Invoice generation and tracking system';

COMMENT ON FUNCTION user_has_active_subscription IS 'Checks if user has an active subscription including trial period';
COMMENT ON FUNCTION get_user_current_subscription IS 'Returns comprehensive current subscription details';
COMMENT ON FUNCTION check_subscription_limits IS 'Validates usage against subscription limits';
COMMENT ON FUNCTION increment_subscription_usage IS 'Tracks usage for billing and limit enforcement';
COMMENT ON FUNCTION calculate_subscription_price IS 'Calculates subscription pricing with discounts and promotions';
COMMENT ON FUNCTION process_molly_webhook_event IS 'Processes incoming Molly payment webhook events';