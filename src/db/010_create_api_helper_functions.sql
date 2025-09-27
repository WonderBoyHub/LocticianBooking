-- Migration 010: API Helper Functions and Business Logic
-- PostgreSQL 17 Enhanced Authentication System
-- Created: 2025-09-26

-- Create comprehensive user registration function
CREATE OR REPLACE FUNCTION register_user(
    p_email VARCHAR(255),
    p_password TEXT,
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100),
    p_phone VARCHAR(20) DEFAULT NULL,
    p_role_name VARCHAR(50) DEFAULT 'customer'
)
RETURNS TABLE(
    user_id UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    new_user_id UUID;
    role_id INTEGER;
    verification_token VARCHAR(255);
BEGIN
    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER(p_email)) THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Email address already registered';
        RETURN;
    END IF;

    -- Get role ID
    SELECT id INTO role_id FROM roles WHERE name = p_role_name AND is_active = true;
    IF role_id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Invalid role specified';
        RETURN;
    END IF;

    -- Generate verification token
    verification_token := encode(gen_random_bytes(32), 'hex');

    -- Create user
    INSERT INTO users (
        email, password_hash, first_name, last_name, phone,
        email_verification_token, is_active
    ) VALUES (
        LOWER(p_email), hash_password(p_password), p_first_name, p_last_name, p_phone,
        verification_token, true
    ) RETURNING id INTO new_user_id;

    -- Assign role
    INSERT INTO user_roles (user_id, role_id) VALUES (new_user_id, role_id);

    -- Log registration
    INSERT INTO system_logs (log_type, message, metadata)
    VALUES ('auth', 'User registered',
            json_build_object('user_id', new_user_id, 'email', p_email, 'role', p_role_name));

    RETURN QUERY SELECT new_user_id, true, 'User registered successfully';

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::UUID, false, 'Registration failed: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user authentication function
CREATE OR REPLACE FUNCTION authenticate_user(
    p_email VARCHAR(255),
    p_password TEXT,
    p_ip_address INET DEFAULT NULL
)
RETURNS TABLE(
    user_id UUID,
    success BOOLEAN,
    message TEXT,
    session_token VARCHAR(255),
    user_data JSONB
) AS $$
DECLARE
    user_record users%ROWTYPE;
    new_session_token VARCHAR(255);
    user_roles_data JSONB;
    user_permissions_data JSONB;
BEGIN
    -- Get user record
    SELECT * INTO user_record
    FROM users
    WHERE LOWER(email) = LOWER(p_email) AND is_active = true;

    -- Check if user exists
    IF user_record.id IS NULL THEN
        PERFORM handle_failed_login(p_email, p_ip_address);
        RETURN QUERY SELECT NULL::UUID, false, 'Invalid credentials', NULL::VARCHAR(255), NULL::JSONB;
        RETURN;
    END IF;

    -- Check if account is locked
    IF user_record.locked_until IS NOT NULL AND user_record.locked_until > CURRENT_TIMESTAMP THEN
        RETURN QUERY SELECT user_record.id, false, 'Account is locked until ' || user_record.locked_until,
                            NULL::VARCHAR(255), NULL::JSONB;
        RETURN;
    END IF;

    -- Verify password
    IF NOT verify_password(p_password, user_record.password_hash) THEN
        PERFORM handle_failed_login(p_email, p_ip_address);
        RETURN QUERY SELECT user_record.id, false, 'Invalid credentials', NULL::VARCHAR(255), NULL::JSONB;
        RETURN;
    END IF;

    -- Generate session token
    new_session_token := encode(gen_random_bytes(32), 'hex');

    -- Create session
    INSERT INTO user_sessions (user_id, session_token, expires_at, ip_address)
    VALUES (user_record.id, new_session_token,
            CURRENT_TIMESTAMP + INTERVAL '30 days', p_ip_address);

    -- Handle successful login
    PERFORM handle_successful_login(p_email, p_ip_address);

    -- Get user roles
    SELECT json_agg(json_build_object('name', r.name, 'priority', r.priority))
    INTO user_roles_data
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_record.id AND ur.is_active = true AND r.is_active = true;

    -- Get user permissions
    SELECT json_agg(DISTINCT p.name)
    INTO user_permissions_data
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_record.id AND ur.is_active = true AND r.is_active = true AND p.is_active = true;

    RETURN QUERY SELECT
        user_record.id,
        true,
        'Authentication successful',
        new_session_token,
        json_build_object(
            'id', user_record.id,
            'email', user_record.email,
            'first_name', user_record.first_name,
            'last_name', user_record.last_name,
            'phone', user_record.phone,
            'email_verified', user_record.email_verified,
            'last_login_at', user_record.last_login_at,
            'roles', user_roles_data,
            'permissions', user_permissions_data
        );

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::UUID, false, 'Authentication failed: ' || SQLERRM,
                        NULL::VARCHAR(255), NULL::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create booking creation function with conflict checking
CREATE OR REPLACE FUNCTION create_booking(
    p_user_id UUID DEFAULT NULL,
    p_guest_email VARCHAR(255) DEFAULT NULL,
    p_guest_first_name VARCHAR(100) DEFAULT NULL,
    p_guest_last_name VARCHAR(100) DEFAULT NULL,
    p_guest_phone VARCHAR(20) DEFAULT NULL,
    p_service_id INTEGER,
    p_booking_date DATE,
    p_booking_time TIME,
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    booking_id UUID,
    success BOOLEAN,
    message TEXT,
    total_price DECIMAL(10,2)
) AS $$
DECLARE
    new_booking_id UUID;
    service_record services%ROWTYPE;
    calculated_price DECIMAL(10,2);
    user_discount DECIMAL(5,2) := 0;
    has_conflict BOOLEAN;
BEGIN
    -- Validate input
    IF (p_user_id IS NULL AND (p_guest_email IS NULL OR p_guest_first_name IS NULL)) THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Either user_id or guest information is required', NULL::DECIMAL;
        RETURN;
    END IF;

    -- Get service information
    SELECT * INTO service_record FROM services WHERE id = p_service_id AND is_active = true;
    IF service_record.id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Service not found or inactive', NULL::DECIMAL;
        RETURN;
    END IF;

    -- Check if service requires subscription
    IF service_record.requires_subscription AND p_user_id IS NOT NULL THEN
        IF NOT user_has_active_subscription(p_user_id) THEN
            RETURN QUERY SELECT NULL::UUID, false, 'Active subscription required for this service', NULL::DECIMAL;
            RETURN;
        END IF;
    END IF;

    -- Check for booking conflicts
    SELECT check_booking_conflict(p_service_id, p_booking_date, p_booking_time, service_record.duration_minutes)
    INTO has_conflict;

    IF has_conflict THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Time slot is not available', NULL::DECIMAL;
        RETURN;
    END IF;

    -- Calculate price with potential subscription discount
    calculated_price := service_record.price;
    IF p_user_id IS NOT NULL THEN
        SELECT COALESCE(sp.discount_percentage, 0)
        INTO user_discount
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        JOIN subscription_statuses ss ON us.status_id = ss.id
        WHERE us.user_id = p_user_id
          AND ss.is_active_status = true
          AND us.current_period_end > CURRENT_TIMESTAMP
        ORDER BY sp.discount_percentage DESC
        LIMIT 1;

        calculated_price := calculated_price * (1 - (user_discount / 100));
    END IF;

    -- Create booking
    INSERT INTO bookings (
        user_id, guest_email, guest_first_name, guest_last_name, guest_phone,
        service_id, booking_date, booking_time, duration_minutes,
        status_id, total_price, notes
    ) VALUES (
        p_user_id, p_guest_email, p_guest_first_name, p_guest_last_name, p_guest_phone,
        p_service_id, p_booking_date, p_booking_time, service_record.duration_minutes,
        (SELECT id FROM booking_statuses WHERE name = 'pending' LIMIT 1),
        calculated_price, p_notes
    ) RETURNING id INTO new_booking_id;

    -- Increment subscription usage if applicable
    IF p_user_id IS NOT NULL THEN
        PERFORM increment_subscription_usage(p_user_id);
    END IF;

    -- Log booking creation
    INSERT INTO system_logs (log_type, message, metadata)
    VALUES ('booking', 'Booking created',
            json_build_object(
                'booking_id', new_booking_id,
                'user_id', p_user_id,
                'service_id', p_service_id,
                'is_guest', p_user_id IS NULL
            ));

    RETURN QUERY SELECT new_booking_id, true, 'Booking created successfully', calculated_price;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::UUID, false, 'Booking creation failed: ' || SQLERRM, NULL::DECIMAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create subscription management function
CREATE OR REPLACE FUNCTION create_subscription(
    p_user_id UUID,
    p_plan_id INTEGER,
    p_molly_subscription_id VARCHAR(255) DEFAULT NULL,
    p_molly_customer_id VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE(
    subscription_id UUID,
    success BOOLEAN,
    message TEXT,
    next_billing_date TIMESTAMPTZ
) AS $$
DECLARE
    new_subscription_id UUID;
    plan_record subscription_plans%ROWTYPE;
    period_start TIMESTAMPTZ;
    period_end TIMESTAMPTZ;
BEGIN
    -- Get plan information
    SELECT * INTO plan_record FROM subscription_plans WHERE id = p_plan_id AND is_active = true;
    IF plan_record.id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, false, 'Subscription plan not found or inactive', NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- Check if user already has an active subscription
    IF user_has_active_subscription(p_user_id) THEN
        RETURN QUERY SELECT NULL::UUID, false, 'User already has an active subscription', NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- Calculate billing periods
    period_start := CURRENT_TIMESTAMP;
    period_end := CASE
        WHEN plan_record.billing_interval = 'monthly' THEN
            period_start + (plan_record.billing_interval_count || ' months')::INTERVAL
        WHEN plan_record.billing_interval = 'yearly' THEN
            period_start + (plan_record.billing_interval_count || ' years')::INTERVAL
        ELSE period_start + INTERVAL '1 month'
    END;

    -- Create subscription
    INSERT INTO user_subscriptions (
        user_id, plan_id, status_id,
        current_period_start, current_period_end, next_billing_date,
        molly_subscription_id, molly_customer_id,
        plan_price, discount_applied
    ) VALUES (
        p_user_id, p_plan_id,
        (SELECT id FROM subscription_statuses WHERE name = 'active' LIMIT 1),
        period_start, period_end, period_end,
        p_molly_subscription_id, p_molly_customer_id,
        plan_record.price, plan_record.discount_percentage
    ) RETURNING id INTO new_subscription_id;

    -- Log subscription creation
    INSERT INTO system_logs (log_type, message, metadata)
    VALUES ('subscription', 'Subscription created',
            json_build_object(
                'subscription_id', new_subscription_id,
                'user_id', p_user_id,
                'plan_id', p_plan_id,
                'plan_name', plan_record.name
            ));

    RETURN QUERY SELECT new_subscription_id, true, 'Subscription created successfully', period_end;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::UUID, false, 'Subscription creation failed: ' || SQLERRM, NULL::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user role management function (admin only)
CREATE OR REPLACE FUNCTION manage_user_role(
    p_admin_user_id UUID,
    p_target_user_id UUID,
    p_role_name VARCHAR(50),
    p_action VARCHAR(10) -- 'add' or 'remove'
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    admin_priority INTEGER;
    target_max_priority INTEGER;
    role_id INTEGER;
    role_priority INTEGER;
BEGIN
    -- Check if admin has permission
    SELECT get_current_user_role_priority() INTO admin_priority;
    IF admin_priority < 100 THEN -- Admin role priority
        RETURN QUERY SELECT false, 'Insufficient permissions to manage user roles';
        RETURN;
    END IF;

    -- Get target user's highest role priority
    SELECT COALESCE(MAX(r.priority), 0)
    INTO target_max_priority
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_target_user_id AND ur.is_active = true AND r.is_active = true;

    -- Get role information
    SELECT id, priority INTO role_id, role_priority
    FROM roles WHERE name = p_role_name AND is_active = true;

    IF role_id IS NULL THEN
        RETURN QUERY SELECT false, 'Role not found or inactive';
        RETURN;
    END IF;

    -- Prevent non-admin from managing equal or higher priority roles
    IF admin_priority <= GREATEST(target_max_priority, role_priority) AND admin_priority < 100 THEN
        RETURN QUERY SELECT false, 'Cannot manage users with equal or higher privileges';
        RETURN;
    END IF;

    IF p_action = 'add' THEN
        -- Add role
        INSERT INTO user_roles (user_id, role_id, assigned_by)
        VALUES (p_target_user_id, role_id, p_admin_user_id)
        ON CONFLICT (user_id, role_id) DO UPDATE SET
            is_active = true,
            assigned_at = CURRENT_TIMESTAMP,
            assigned_by = p_admin_user_id;

        RETURN QUERY SELECT true, 'Role added successfully';

    ELSIF p_action = 'remove' THEN
        -- Remove role
        UPDATE user_roles
        SET is_active = false
        WHERE user_id = p_target_user_id AND role_id = role_id;

        RETURN QUERY SELECT true, 'Role removed successfully';

    ELSE
        RETURN QUERY SELECT false, 'Invalid action. Use "add" or "remove"';
    END IF;

    -- Log role management action
    INSERT INTO system_logs (log_type, message, metadata)
    VALUES ('admin', 'User role managed',
            json_build_object(
                'admin_user_id', p_admin_user_id,
                'target_user_id', p_target_user_id,
                'role_name', p_role_name,
                'action', p_action
            ));

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, 'Role management failed: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create session validation function
CREATE OR REPLACE FUNCTION validate_session(p_session_token VARCHAR(255))
RETURNS TABLE(
    user_id UUID,
    is_valid BOOLEAN,
    user_data JSONB
) AS $$
DECLARE
    session_record user_sessions%ROWTYPE;
    user_record users%ROWTYPE;
    user_roles_data JSONB;
    user_permissions_data JSONB;
BEGIN
    -- Get session
    SELECT * INTO session_record
    FROM user_sessions
    WHERE session_token = p_session_token
      AND is_active = true
      AND expires_at > CURRENT_TIMESTAMP;

    IF session_record.id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, false, NULL::JSONB;
        RETURN;
    END IF;

    -- Get user
    SELECT * INTO user_record
    FROM users
    WHERE id = session_record.user_id AND is_active = true;

    IF user_record.id IS NULL THEN
        RETURN QUERY SELECT session_record.user_id, false, NULL::JSONB;
        RETURN;
    END IF;

    -- Get user roles and permissions
    SELECT json_agg(json_build_object('name', r.name, 'priority', r.priority))
    INTO user_roles_data
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_record.id AND ur.is_active = true AND r.is_active = true;

    SELECT json_agg(DISTINCT p.name)
    INTO user_permissions_data
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_record.id AND ur.is_active = true AND r.is_active = true AND p.is_active = true;

    RETURN QUERY SELECT
        user_record.id,
        true,
        json_build_object(
            'id', user_record.id,
            'email', user_record.email,
            'first_name', user_record.first_name,
            'last_name', user_record.last_name,
            'phone', user_record.phone,
            'email_verified', user_record.email_verified,
            'last_login_at', user_record.last_login_at,
            'roles', user_roles_data,
            'permissions', user_permissions_data
        );

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::UUID, false, NULL::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on API functions
GRANT EXECUTE ON FUNCTION register_user TO app_admin, app_staff, app_anonymous;
GRANT EXECUTE ON FUNCTION authenticate_user TO app_admin, app_staff, app_customer, app_anonymous;
GRANT EXECUTE ON FUNCTION create_booking TO app_admin, app_staff, app_customer, app_anonymous;
GRANT EXECUTE ON FUNCTION create_subscription TO app_admin, app_staff, app_customer;
GRANT EXECUTE ON FUNCTION manage_user_role TO app_admin;
GRANT EXECUTE ON FUNCTION validate_session TO app_admin, app_staff, app_customer;

-- Comments for documentation
COMMENT ON FUNCTION register_user IS 'Complete user registration with role assignment and email verification';
COMMENT ON FUNCTION authenticate_user IS 'User authentication with session creation and security checks';
COMMENT ON FUNCTION create_booking IS 'Create booking with conflict checking and subscription validation';
COMMENT ON FUNCTION create_subscription IS 'Create user subscription with billing period calculation';
COMMENT ON FUNCTION manage_user_role IS 'Admin function to add/remove user roles with permission checks';
COMMENT ON FUNCTION validate_session IS 'Validate session token and return user data with permissions';

-- Display API functions setup completion
DO $$
BEGIN
    RAISE NOTICE 'API helper functions created successfully!';
    RAISE NOTICE 'Available functions:';
    RAISE NOTICE '  - register_user(): User registration';
    RAISE NOTICE '  - authenticate_user(): User login';
    RAISE NOTICE '  - create_booking(): Booking creation';
    RAISE NOTICE '  - create_subscription(): Subscription management';
    RAISE NOTICE '  - manage_user_role(): Role management (admin only)';
    RAISE NOTICE '  - validate_session(): Session validation';
END $$;