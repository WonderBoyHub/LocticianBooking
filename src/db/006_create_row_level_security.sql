-- Migration 006: Implement Row-Level Security (RLS)
-- PostgreSQL 17 Enhanced Authentication System
-- Created: 2025-09-26

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Create application roles for different access levels
CREATE ROLE app_admin;
CREATE ROLE app_staff;
CREATE ROLE app_customer;
CREATE ROLE app_anonymous;

-- Grant basic table access to application roles
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_admin;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO app_admin;

GRANT SELECT, INSERT, UPDATE ON users, bookings, user_subscriptions TO app_staff;
GRANT SELECT ON roles, permissions, services, subscription_plans, booking_statuses, subscription_statuses TO app_staff;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO app_staff;

GRANT SELECT, INSERT, UPDATE ON bookings, user_subscriptions, payment_transactions TO app_customer;
GRANT SELECT ON services, subscription_plans, booking_statuses TO app_customer;
GRANT SELECT, UPDATE ON users TO app_customer;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO app_customer;

GRANT SELECT, INSERT ON bookings TO app_anonymous; -- Guest bookings only
GRANT SELECT ON services, booking_statuses TO app_anonymous;

-- Users table RLS policies
CREATE POLICY users_admin_access ON users
    FOR ALL TO app_admin
    USING (true);

CREATE POLICY users_staff_access ON users
    FOR SELECT TO app_staff
    USING (true);

CREATE POLICY users_self_access ON users
    FOR ALL TO app_customer
    USING (id = current_setting('app.current_user_id')::UUID);

-- User roles RLS policies
CREATE POLICY user_roles_admin_access ON user_roles
    FOR ALL TO app_admin
    USING (true);

CREATE POLICY user_roles_staff_read ON user_roles
    FOR SELECT TO app_staff
    USING (true);

CREATE POLICY user_roles_self_read ON user_roles
    FOR SELECT TO app_customer
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- User sessions RLS policies
CREATE POLICY user_sessions_admin_access ON user_sessions
    FOR ALL TO app_admin
    USING (true);

CREATE POLICY user_sessions_self_access ON user_sessions
    FOR ALL TO app_customer
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Bookings RLS policies
CREATE POLICY bookings_admin_access ON bookings
    FOR ALL TO app_admin
    USING (true);

CREATE POLICY bookings_staff_access ON bookings
    FOR SELECT TO app_staff
    USING (true);

CREATE POLICY bookings_staff_update ON bookings
    FOR UPDATE TO app_staff
    USING (true)
    WITH CHECK (true);

-- Customers can only access their own bookings or create guest bookings
CREATE POLICY bookings_customer_own ON bookings
    FOR ALL TO app_customer
    USING (
        user_id = current_setting('app.current_user_id')::UUID OR
        (user_id IS NULL AND guest_email = current_setting('app.current_user_email'))
    );

-- Anonymous users can only create guest bookings
CREATE POLICY bookings_anonymous_insert ON bookings
    FOR INSERT TO app_anonymous
    WITH CHECK (user_id IS NULL AND guest_email IS NOT NULL);

-- User subscriptions RLS policies
CREATE POLICY user_subscriptions_admin_access ON user_subscriptions
    FOR ALL TO app_admin
    USING (true);

CREATE POLICY user_subscriptions_staff_read ON user_subscriptions
    FOR SELECT TO app_staff
    USING (true);

CREATE POLICY user_subscriptions_self_access ON user_subscriptions
    FOR ALL TO app_customer
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Payment transactions RLS policies
CREATE POLICY payment_transactions_admin_access ON payment_transactions
    FOR ALL TO app_admin
    USING (true);

CREATE POLICY payment_transactions_staff_read ON payment_transactions
    FOR SELECT TO app_staff
    USING (true);

CREATE POLICY payment_transactions_self_access ON payment_transactions
    FOR SELECT TO app_customer
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Security functions for setting context
CREATE OR REPLACE FUNCTION set_user_context(user_uuid UUID, user_email VARCHAR(255))
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_uuid::TEXT, false);
    PERFORM set_config('app.current_user_email', user_email, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION clear_user_context()
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', '', false);
    PERFORM set_config('app.current_user_email', '', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's role level
CREATE OR REPLACE FUNCTION get_current_user_role_priority()
RETURNS INTEGER AS $$
DECLARE
    user_uuid UUID;
    max_priority INTEGER := 0;
BEGIN
    BEGIN
        user_uuid := current_setting('app.current_user_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN 0;
    END;

    SELECT COALESCE(MAX(r.priority), 0)
    INTO max_priority
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid
      AND ur.is_active = true
      AND r.is_active = true;

    RETURN max_priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced booking access policy based on role hierarchy
CREATE OR REPLACE POLICY bookings_role_based_access ON bookings
    FOR SELECT TO app_customer
    USING (
        CASE
            WHEN get_current_user_role_priority() >= 100 THEN true  -- Admin can see all
            WHEN get_current_user_role_priority() >= 50 THEN true   -- Staff can see all
            ELSE user_id = current_setting('app.current_user_id')::UUID OR
                 (user_id IS NULL AND guest_email = current_setting('app.current_user_email'))
        END
    );

-- Grant execute permissions on security functions
GRANT EXECUTE ON FUNCTION set_user_context(UUID, VARCHAR) TO app_admin, app_staff, app_customer;
GRANT EXECUTE ON FUNCTION clear_user_context() TO app_admin, app_staff, app_customer;
GRANT EXECUTE ON FUNCTION get_current_user_role_priority() TO app_admin, app_staff, app_customer;

-- Create database users for different connection types
-- Note: In production, use proper password management
CREATE USER app_admin_user WITH PASSWORD 'admin_secure_password';
CREATE USER app_staff_user WITH PASSWORD 'staff_secure_password';
CREATE USER app_customer_user WITH PASSWORD 'customer_secure_password';
CREATE USER app_anonymous_user WITH PASSWORD 'anonymous_secure_password';

-- Grant roles to database users
GRANT app_admin TO app_admin_user;
GRANT app_staff TO app_staff_user;
GRANT app_customer TO app_customer_user;
GRANT app_anonymous TO app_anonymous_user;

-- Comments for documentation
COMMENT ON POLICY users_admin_access ON users IS 'Admin users have full access to all user records';
COMMENT ON POLICY users_self_access ON users IS 'Regular users can only access their own record';
COMMENT ON POLICY bookings_customer_own ON bookings IS 'Customers can access their authenticated bookings or guest bookings with their email';
COMMENT ON FUNCTION set_user_context IS 'Sets the current user context for RLS policies';
COMMENT ON FUNCTION get_current_user_role_priority IS 'Returns the highest role priority for the current user';