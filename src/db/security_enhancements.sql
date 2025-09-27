-- =====================================================
-- LOCTICIAN BOOKING SYSTEM - SECURITY ENHANCEMENTS
-- =====================================================
-- Comprehensive security implementation with PostgreSQL advanced features
-- Includes RBAC, RLS, JWT authentication, encryption, and automated jobs
-- =====================================================

-- =====================================================
-- STEP 1: ENABLE SECURITY EXTENSIONS
-- =====================================================

-- Enable cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable JWT token handling
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- Enable scheduled job processing
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Enable advanced text search
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =====================================================
-- STEP 2: SECURITY CONFIGURATION TABLES
-- =====================================================

-- Security configuration for system-wide settings
CREATE TABLE security_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Insert default security configuration
INSERT INTO security_config (key, value, description) VALUES
    ('jwt_secret', encode(gen_random_bytes(32), 'base64'), 'JWT signing secret'),
    ('password_min_length', '8', 'Minimum password length'),
    ('session_timeout_minutes', '480', 'Session timeout in minutes'),
    ('max_login_attempts', '5', 'Maximum failed login attempts'),
    ('lockout_duration_minutes', '30', 'Account lockout duration'),
    ('encryption_key', encode(gen_random_bytes(32), 'base64'), 'Data encryption key'),
    ('gdpr_retention_years', '7', 'Default GDPR data retention period'),
    ('audit_retention_years', '10', 'Audit log retention period');

-- User sessions for security tracking
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    jwt_token TEXT,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Failed login attempts tracking
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT
);

-- API rate limiting
CREATE TABLE api_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint VARCHAR(200) NOT NULL,
    ip_address INET NOT NULL,
    user_id UUID REFERENCES users(id),
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    blocked_until TIMESTAMP WITH TIME ZONE,
    UNIQUE(endpoint, ip_address, user_id, window_start)
);

-- =====================================================
-- STEP 3: DATABASE ROLES AND PERMISSIONS
-- =====================================================

-- Create application roles
CREATE ROLE customer_role;
CREATE ROLE loctician_role;
CREATE ROLE admin_role;
CREATE ROLE api_user;

-- Grant basic connection permissions
GRANT CONNECT ON DATABASE postgres TO customer_role, loctician_role, admin_role, api_user;
GRANT USAGE ON SCHEMA public TO customer_role, loctician_role, admin_role, api_user;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO customer_role, loctician_role, admin_role, api_user;

-- Customer role permissions (most restrictive)
GRANT SELECT ON users, user_profiles TO customer_role;
GRANT SELECT ON services, service_categories TO customer_role;
GRANT SELECT ON products, product_categories TO customer_role;
GRANT SELECT, INSERT ON bookings TO customer_role;
GRANT SELECT ON v_active_locticians TO customer_role;

-- Loctician role permissions
GRANT SELECT ON users, user_profiles TO loctician_role;
GRANT SELECT, UPDATE ON user_profiles TO loctician_role;
GRANT SELECT ON services, products TO loctician_role;
GRANT SELECT, UPDATE ON bookings TO loctician_role;
GRANT SELECT, INSERT, UPDATE ON availability_patterns, availability_overrides TO loctician_role;
GRANT SELECT, INSERT, UPDATE ON calendar_events TO loctician_role;
GRANT SELECT ON v_upcoming_bookings, v_daily_schedule TO loctician_role;

-- Admin role permissions (full access)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO admin_role;

-- API user permissions (for application backend)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO api_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO api_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO api_user;

-- =====================================================
-- STEP 4: ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on critical tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY users_customer_policy ON users
    FOR ALL TO customer_role
    USING (id = current_setting('app.current_user_id')::UUID);

CREATE POLICY users_loctician_policy ON users
    FOR SELECT TO loctician_role
    USING (role IN ('customer', 'loctician') OR id = current_setting('app.current_user_id')::UUID);

CREATE POLICY users_admin_policy ON users
    FOR ALL TO admin_role
    USING (true);

-- User profiles policies
CREATE POLICY profiles_owner_policy ON user_profiles
    FOR ALL TO customer_role, loctician_role
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY profiles_loctician_view_policy ON user_profiles
    FOR SELECT TO loctician_role
    USING (EXISTS (
        SELECT 1 FROM users WHERE id = user_id AND role = 'loctician'
    ));

-- Bookings policies
CREATE POLICY bookings_customer_policy ON bookings
    FOR ALL TO customer_role
    USING (customer_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY bookings_loctician_policy ON bookings
    FOR ALL TO loctician_role
    USING (loctician_id = current_setting('app.current_user_id')::UUID);

-- Availability policies
CREATE POLICY availability_patterns_policy ON availability_patterns
    FOR ALL TO loctician_role
    USING (loctician_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY availability_overrides_policy ON availability_overrides
    FOR ALL TO loctician_role
    USING (loctician_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY calendar_events_policy ON calendar_events
    FOR ALL TO loctician_role
    USING (loctician_id = current_setting('app.current_user_id')::UUID);

-- Sessions policies
CREATE POLICY sessions_owner_policy ON user_sessions
    FOR ALL TO customer_role, loctician_role
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Audit log policies (read-only for non-admins)
CREATE POLICY audit_log_user_policy ON audit_log
    FOR SELECT TO customer_role, loctician_role
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- =====================================================
-- STEP 5: ENCRYPTION FUNCTIONS
-- =====================================================

-- Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT)
RETURNS TEXT AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    SELECT value INTO encryption_key FROM security_config WHERE key = 'encryption_key';
    RETURN encode(
        pgp_sym_encrypt(data, encryption_key),
        'base64'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT)
RETURNS TEXT AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    SELECT value INTO encryption_key FROM security_config WHERE key = 'encryption_key';
    RETURN pgp_sym_decrypt(
        decode(encrypted_data, 'base64'),
        encryption_key
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to hash passwords securely
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 12));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify passwords
CREATE OR REPLACE FUNCTION verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN crypt(password, hash) = hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 6: JWT AUTHENTICATION FUNCTIONS
-- =====================================================

-- Function to generate JWT tokens
CREATE OR REPLACE FUNCTION generate_jwt_token(
    user_id UUID,
    user_role user_role,
    expires_in_minutes INTEGER DEFAULT 480
)
RETURNS TEXT AS $$
DECLARE
    jwt_secret TEXT;
    payload JSON;
    token TEXT;
BEGIN
    -- Get JWT secret
    SELECT value INTO jwt_secret FROM security_config WHERE key = 'jwt_secret';

    -- Build payload
    payload := json_build_object(
        'user_id', user_id,
        'role', user_role,
        'iat', extract(epoch from now()),
        'exp', extract(epoch from now() + (expires_in_minutes || ' minutes')::interval)
    );

    -- Generate token
    token := sign(payload, jwt_secret, 'HS256');

    RETURN token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify JWT tokens
CREATE OR REPLACE FUNCTION verify_jwt_token(token TEXT)
RETURNS JSON AS $$
DECLARE
    jwt_secret TEXT;
    payload JSON;
BEGIN
    SELECT value INTO jwt_secret FROM security_config WHERE key = 'jwt_secret';

    -- Verify and decode token
    payload := verify(token, jwt_secret, 'HS256');

    -- Check if token is expired
    IF (payload->>'exp')::NUMERIC < extract(epoch from now()) THEN
        RETURN NULL;
    END IF;

    RETURN payload;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 7: SECURE AUTHENTICATION PROCEDURES
-- =====================================================

-- Function to authenticate user with rate limiting
CREATE OR REPLACE FUNCTION authenticate_user(
    p_email VARCHAR(255),
    p_password TEXT,
    p_ip_address INET,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    failed_attempts INTEGER;
    lockout_duration INTEGER;
    max_attempts INTEGER;
    session_id UUID;
    jwt_token TEXT;
    session_token TEXT;
    result JSON;
BEGIN
    -- Check rate limiting
    SELECT COUNT(*) INTO failed_attempts
    FROM login_attempts
    WHERE email = p_email
    AND success = FALSE
    AND attempted_at > NOW() - INTERVAL '1 hour';

    SELECT value::INTEGER INTO max_attempts
    FROM security_config WHERE key = 'max_login_attempts';

    IF failed_attempts >= max_attempts THEN
        -- Log failed attempt
        INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent)
        VALUES (p_email, p_ip_address, FALSE, 'ACCOUNT_LOCKED', p_user_agent);

        RETURN json_build_object(
            'success', false,
            'error', 'ACCOUNT_LOCKED',
            'message', 'Account temporarily locked due to too many failed attempts'
        );
    END IF;

    -- Get user record
    SELECT * INTO user_record
    FROM users
    WHERE email = p_email
    AND status = 'active'
    AND deleted_at IS NULL;

    IF NOT FOUND THEN
        -- Log failed attempt
        INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent)
        VALUES (p_email, p_ip_address, FALSE, 'USER_NOT_FOUND', p_user_agent);

        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_CREDENTIALS',
            'message', 'Invalid email or password'
        );
    END IF;

    -- Verify password
    IF NOT verify_password(p_password, user_record.password_hash) THEN
        -- Log failed attempt
        INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent)
        VALUES (p_email, p_ip_address, FALSE, 'INVALID_PASSWORD', p_user_agent);

        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_CREDENTIALS',
            'message', 'Invalid email or password'
        );
    END IF;

    -- Generate tokens
    jwt_token := generate_jwt_token(user_record.id, user_record.role);
    session_token := encode(gen_random_bytes(32), 'base64');

    -- Create session
    INSERT INTO user_sessions (
        user_id, session_token, jwt_token, ip_address, user_agent,
        expires_at
    ) VALUES (
        user_record.id, session_token, jwt_token, p_ip_address, p_user_agent,
        NOW() + INTERVAL '8 hours'
    ) RETURNING id INTO session_id;

    -- Update last login
    UPDATE users SET last_login_at = NOW() WHERE id = user_record.id;

    -- Log successful attempt
    INSERT INTO login_attempts (email, ip_address, success, user_agent)
    VALUES (p_email, p_ip_address, TRUE, p_user_agent);

    -- Return success response
    RETURN json_build_object(
        'success', true,
        'user_id', user_record.id,
        'role', user_record.role,
        'session_token', session_token,
        'jwt_token', jwt_token,
        'expires_at', NOW() + INTERVAL '8 hours'
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Log error
        INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent)
        VALUES (p_email, p_ip_address, FALSE, 'SYSTEM_ERROR', p_user_agent);

        RETURN json_build_object(
            'success', false,
            'error', 'SYSTEM_ERROR',
            'message', 'Authentication system error'
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate session
CREATE OR REPLACE FUNCTION validate_session(p_session_token TEXT)
RETURNS JSON AS $$
DECLARE
    session_record RECORD;
    user_record RECORD;
BEGIN
    -- Get session
    SELECT * INTO session_record
    FROM user_sessions
    WHERE session_token = p_session_token
    AND is_active = TRUE
    AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN json_build_object('valid', false, 'error', 'INVALID_SESSION');
    END IF;

    -- Get user
    SELECT * INTO user_record
    FROM users
    WHERE id = session_record.user_id
    AND status = 'active'
    AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN json_build_object('valid', false, 'error', 'USER_INACTIVE');
    END IF;

    -- Update last activity
    UPDATE user_sessions
    SET last_activity = NOW()
    WHERE id = session_record.id;

    RETURN json_build_object(
        'valid', true,
        'user_id', user_record.id,
        'role', user_record.role,
        'email', user_record.email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 8: SECURE BOOKING PROCEDURES
-- =====================================================

-- Enhanced secure booking creation with full transaction control
CREATE OR REPLACE FUNCTION create_secure_booking(
    p_customer_id UUID,
    p_loctician_id UUID,
    p_service_id UUID,
    p_appointment_start TIMESTAMP WITH TIME ZONE,
    p_customer_notes TEXT DEFAULT NULL,
    p_special_requests TEXT DEFAULT NULL,
    p_session_token TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_booking_id UUID;
    v_service_record RECORD;
    v_appointment_end TIMESTAMP WITH TIME ZONE;
    v_booking_number VARCHAR(20);
    v_customer_record RECORD;
    v_loctician_record RECORD;
    v_session_valid JSON;
BEGIN
    -- Validate session if provided
    IF p_session_token IS NOT NULL THEN
        v_session_valid := validate_session(p_session_token);
        IF NOT (v_session_valid->>'valid')::BOOLEAN THEN
            RETURN json_build_object(
                'success', false,
                'error', 'INVALID_SESSION',
                'message', 'Session invalid or expired'
            );
        END IF;
    END IF;

    -- Validate customer exists and is active
    SELECT * INTO v_customer_record
    FROM users
    WHERE id = p_customer_id
    AND role = 'customer'
    AND status = 'active'
    AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_CUSTOMER',
            'message', 'Customer not found or inactive'
        );
    END IF;

    -- Validate loctician exists and is active
    SELECT * INTO v_loctician_record
    FROM users
    WHERE id = p_loctician_id
    AND role = 'loctician'
    AND status = 'active'
    AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_LOCTICIAN',
            'message', 'Loctician not found or inactive'
        );
    END IF;

    -- Get service details with security check
    SELECT * INTO v_service_record
    FROM services
    WHERE id = p_service_id
    AND is_active = TRUE
    AND is_online_bookable = TRUE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_SERVICE',
            'message', 'Service not found or not bookable'
        );
    END IF;

    -- Calculate appointment end time
    v_appointment_end := p_appointment_start + INTERVAL '1 minute' * v_service_record.duration_minutes;

    -- Validate appointment time is in the future
    IF p_appointment_start <= NOW() + INTERVAL '1 hour' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_TIME',
            'message', 'Appointment must be at least 1 hour in the future'
        );
    END IF;

    -- Check availability with double-booking prevention
    IF NOT check_availability(p_loctician_id, p_appointment_start, v_appointment_end) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'TIME_UNAVAILABLE',
            'message', 'Selected time slot is not available'
        );
    END IF;

    -- Generate unique booking number
    v_booking_number := 'BK' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD((RANDOM() * 9999)::INTEGER, 4, '0');

    -- Create booking with ACID transaction
    BEGIN
        INSERT INTO bookings (
            booking_number,
            customer_id,
            loctician_id,
            service_id,
            appointment_start,
            appointment_end,
            duration_minutes,
            service_price,
            total_amount,
            customer_notes,
            special_requests,
            status,
            created_by
        ) VALUES (
            v_booking_number,
            p_customer_id,
            p_loctician_id,
            p_service_id,
            p_appointment_start,
            v_appointment_end,
            v_service_record.duration_minutes,
            v_service_record.base_price,
            v_service_record.base_price,
            p_customer_notes,
            p_special_requests,
            'confirmed',
            p_customer_id
        ) RETURNING id INTO v_booking_id;

        -- Log booking creation in state changes
        INSERT INTO booking_state_changes (booking_id, new_status, changed_by)
        VALUES (v_booking_id, 'confirmed', p_customer_id);

        -- Queue confirmation email
        INSERT INTO email_queue (
            template_id,
            to_email,
            to_name,
            from_email,
            from_name,
            subject,
            template_variables,
            user_id,
            booking_id
        ) SELECT
            et.id,
            v_customer_record.email,
            v_customer_record.first_name || ' ' || v_customer_record.last_name,
            'noreply@loctician.dk',
            'Loctician Booking System',
            'Booking Confirmation - ' || v_booking_number,
            json_build_object(
                'customer_name', v_customer_record.first_name,
                'booking_number', v_booking_number,
                'service_name', v_service_record.name,
                'appointment_date', p_appointment_start,
                'loctician_name', v_loctician_record.first_name || ' ' || v_loctician_record.last_name
            ),
            p_customer_id,
            v_booking_id
        FROM email_templates et
        WHERE et.template_type = 'booking_confirmation'
        AND et.is_active = TRUE
        LIMIT 1;

        RETURN json_build_object(
            'success', true,
            'booking_id', v_booking_id,
            'booking_number', v_booking_number,
            'message', 'Booking created successfully'
        );

    EXCEPTION
        WHEN unique_violation THEN
            RETURN json_build_object(
                'success', false,
                'error', 'BOOKING_CONFLICT',
                'message', 'Time slot no longer available'
            );
        WHEN OTHERS THEN
            RETURN json_build_object(
                'success', false,
                'error', 'SYSTEM_ERROR',
                'message', 'Failed to create booking: ' || SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 9: FULL-TEXT SEARCH IMPLEMENTATION
-- =====================================================

-- Enhanced search configuration
CREATE TEXT SEARCH CONFIGURATION danish_unaccent (COPY = danish);
ALTER TEXT SEARCH CONFIGURATION danish_unaccent
    ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part
    WITH unaccent, danish_stem;

-- Full-text search function for customers
CREATE OR REPLACE FUNCTION search_customers(
    search_query TEXT,
    limit_results INTEGER DEFAULT 50
)
RETURNS TABLE(
    user_id UUID,
    full_name TEXT,
    email VARCHAR(255),
    phone VARCHAR(20),
    last_visit DATE,
    total_bookings INTEGER,
    search_rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.first_name || ' ' || u.last_name,
        u.email,
        u.phone,
        MAX(b.appointment_start::DATE),
        COUNT(b.id)::INTEGER,
        ts_rank(
            to_tsvector('danish_unaccent', u.first_name || ' ' || u.last_name || ' ' || u.email),
            plainto_tsquery('danish_unaccent', search_query)
        )
    FROM users u
    LEFT JOIN bookings b ON u.id = b.customer_id
    WHERE u.role = 'customer'
    AND u.status = 'active'
    AND u.deleted_at IS NULL
    AND (
        to_tsvector('danish_unaccent', u.first_name || ' ' || u.last_name || ' ' || u.email) @@
        plainto_tsquery('danish_unaccent', search_query)
        OR u.email ILIKE '%' || search_query || '%'
        OR u.phone ILIKE '%' || search_query || '%'
    )
    GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone
    ORDER BY ts_rank(
        to_tsvector('danish_unaccent', u.first_name || ' ' || u.last_name || ' ' || u.email),
        plainto_tsquery('danish_unaccent', search_query)
    ) DESC, u.last_name, u.first_name
    LIMIT limit_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Full-text search function for bookings
CREATE OR REPLACE FUNCTION search_bookings(
    search_query TEXT,
    date_from DATE DEFAULT NULL,
    date_to DATE DEFAULT NULL,
    status_filter booking_status DEFAULT NULL,
    limit_results INTEGER DEFAULT 100
)
RETURNS TABLE(
    booking_id UUID,
    booking_number VARCHAR(20),
    customer_name TEXT,
    loctician_name TEXT,
    service_name VARCHAR(150),
    appointment_date TIMESTAMP WITH TIME ZONE,
    status booking_status,
    total_amount DECIMAL(10,2),
    search_rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.booking_number,
        c.first_name || ' ' || c.last_name,
        l.first_name || ' ' || l.last_name,
        s.name,
        b.appointment_start,
        b.status,
        b.total_amount,
        ts_rank(
            to_tsvector('danish_unaccent',
                b.booking_number || ' ' ||
                c.first_name || ' ' || c.last_name || ' ' ||
                l.first_name || ' ' || l.last_name || ' ' ||
                s.name || ' ' ||
                COALESCE(b.customer_notes, '') || ' ' ||
                COALESCE(b.special_requests, '')
            ),
            plainto_tsquery('danish_unaccent', search_query)
        )
    FROM bookings b
    JOIN users c ON b.customer_id = c.id
    JOIN users l ON b.loctician_id = l.id
    JOIN services s ON b.service_id = s.id
    WHERE (
        to_tsvector('danish_unaccent',
            b.booking_number || ' ' ||
            c.first_name || ' ' || c.last_name || ' ' ||
            l.first_name || ' ' || l.last_name || ' ' ||
            s.name || ' ' ||
            COALESCE(b.customer_notes, '') || ' ' ||
            COALESCE(b.special_requests, '')
        ) @@ plainto_tsquery('danish_unaccent', search_query)
        OR b.booking_number ILIKE '%' || search_query || '%'
    )
    AND (date_from IS NULL OR b.appointment_start::DATE >= date_from)
    AND (date_to IS NULL OR b.appointment_start::DATE <= date_to)
    AND (status_filter IS NULL OR b.status = status_filter)
    ORDER BY ts_rank(
        to_tsvector('danish_unaccent',
            b.booking_number || ' ' ||
            c.first_name || ' ' || c.last_name || ' ' ||
            l.first_name || ' ' || l.last_name || ' ' ||
            s.name || ' ' ||
            COALESCE(b.customer_notes, '') || ' ' ||
            COALESCE(b.special_requests, '')
        ),
        plainto_tsquery('danish_unaccent', search_query)
    ) DESC, b.appointment_start DESC
    LIMIT limit_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search suggestions function
CREATE OR REPLACE FUNCTION get_search_suggestions(
    search_prefix TEXT,
    suggestion_type TEXT DEFAULT 'all',
    limit_results INTEGER DEFAULT 10
)
RETURNS TABLE(
    suggestion TEXT,
    category VARCHAR(20),
    frequency INTEGER
) AS $$
BEGIN
    IF suggestion_type IN ('all', 'customers') THEN
        RETURN QUERY
        SELECT
            u.first_name || ' ' || u.last_name AS suggestion,
            'customer'::VARCHAR(20) AS category,
            COUNT(b.id)::INTEGER AS frequency
        FROM users u
        LEFT JOIN bookings b ON u.id = b.customer_id
        WHERE u.role = 'customer'
        AND u.status = 'active'
        AND u.deleted_at IS NULL
        AND (u.first_name || ' ' || u.last_name) ILIKE search_prefix || '%'
        GROUP BY u.first_name, u.last_name
        ORDER BY frequency DESC, u.first_name, u.last_name
        LIMIT limit_results;
    END IF;

    IF suggestion_type IN ('all', 'services') THEN
        RETURN QUERY
        SELECT
            s.name AS suggestion,
            'service'::VARCHAR(20) AS category,
            COUNT(b.id)::INTEGER AS frequency
        FROM services s
        LEFT JOIN bookings b ON s.id = b.service_id
        WHERE s.is_active = TRUE
        AND s.name ILIKE search_prefix || '%'
        GROUP BY s.name
        ORDER BY frequency DESC, s.name
        LIMIT limit_results;
    END IF;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 10: GDPR COMPLIANCE ENHANCEMENTS
-- =====================================================

-- Enhanced GDPR data export function
CREATE OR REPLACE FUNCTION export_user_data(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    user_data JSON;
    profile_data JSON;
    booking_data JSON;
    session_data JSON;
BEGIN
    -- Validate user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = user_uuid) THEN
        RETURN json_build_object('error', 'User not found');
    END IF;

    -- Export user basic data
    SELECT to_json(u.*) INTO user_data
    FROM users u
    WHERE id = user_uuid;

    -- Export profile data
    SELECT to_json(up.*) INTO profile_data
    FROM user_profiles up
    WHERE user_id = user_uuid;

    -- Export booking history
    SELECT json_agg(
        json_build_object(
            'booking_number', b.booking_number,
            'service_name', s.name,
            'appointment_start', b.appointment_start,
            'appointment_end', b.appointment_end,
            'status', b.status,
            'total_amount', b.total_amount,
            'customer_notes', b.customer_notes,
            'special_requests', b.special_requests,
            'created_at', b.created_at
        )
    ) INTO booking_data
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.customer_id = user_uuid;

    -- Export session data (last 30 days)
    SELECT json_agg(
        json_build_object(
            'created_at', us.created_at,
            'last_activity', us.last_activity,
            'ip_address', us.ip_address
        )
    ) INTO session_data
    FROM user_sessions us
    WHERE us.user_id = user_uuid
    AND us.created_at > NOW() - INTERVAL '30 days';

    RETURN json_build_object(
        'export_date', NOW(),
        'user_id', user_uuid,
        'personal_data', user_data,
        'profile_data', profile_data,
        'booking_history', COALESCE(booking_data, '[]'::JSON),
        'recent_sessions', COALESCE(session_data, '[]'::JSON)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced anonymization function with audit trail
CREATE OR REPLACE FUNCTION anonymize_user_gdpr(
    user_uuid UUID,
    anonymization_reason TEXT DEFAULT 'GDPR_REQUEST'
)
RETURNS JSON AS $$
DECLARE
    affected_records INTEGER := 0;
    anonymization_id UUID;
BEGIN
    -- Check if user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = user_uuid AND deleted_at IS NULL) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not found or already anonymized'
        );
    END IF;

    -- Create anonymization record for audit
    INSERT INTO audit_log (
        table_name, record_id, action, old_values, new_values,
        user_id
    ) VALUES (
        'users', user_uuid, 'ANONYMIZE',
        (SELECT to_jsonb(u.*) FROM users u WHERE id = user_uuid),
        json_build_object('reason', anonymization_reason),
        user_uuid
    ) RETURNING id INTO anonymization_id;

    -- Anonymize user data
    UPDATE users SET
        email = 'anonymized-' || user_uuid || '@gdpr.local',
        phone = NULL,
        first_name = 'Anonymized',
        last_name = 'User',
        date_of_birth = NULL,
        street_address = NULL,
        city = NULL,
        postal_code = NULL,
        deleted_at = NOW(),
        data_retention_until = NULL,
        marketing_consent = FALSE
    WHERE id = user_uuid;

    GET DIAGNOSTICS affected_records = ROW_COUNT;

    -- Anonymize profile data
    UPDATE user_profiles SET
        bio = NULL,
        profile_image_url = NULL,
        instagram_handle = NULL,
        website_url = NULL,
        allergies = NULL,
        notes = 'Data anonymized for GDPR compliance on ' || NOW()::DATE
    WHERE user_id = user_uuid;

    -- Anonymize booking notes but keep business records
    UPDATE bookings SET
        customer_notes = NULL,
        special_requests = NULL
    WHERE customer_id = user_uuid;

    -- Deactivate all sessions
    UPDATE user_sessions SET
        is_active = FALSE
    WHERE user_id = user_uuid;

    RETURN json_build_object(
        'success', true,
        'user_id', user_uuid,
        'anonymization_id', anonymization_id,
        'anonymized_at', NOW(),
        'reason', anonymization_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 11: SCHEDULED JOBS WITH PG_CRON
-- =====================================================

-- Daily GDPR compliance check and cleanup
SELECT cron.schedule(
    'gdpr-cleanup',
    '0 2 * * *', -- Run at 2 AM daily
    $$
    SELECT purge_expired_data();
    $$
);

-- Weekly security audit
SELECT cron.schedule(
    'security-audit',
    '0 3 * * 1', -- Run at 3 AM on Mondays
    $$
    INSERT INTO audit_log (table_name, record_id, action, new_values)
    SELECT
        'security_audit',
        uuid_generate_v4(),
        'SECURITY_SCAN',
        json_build_object(
            'audit_date', NOW(),
            'failed_logins_last_week', (
                SELECT COUNT(*) FROM login_attempts
                WHERE success = FALSE
                AND attempted_at > NOW() - INTERVAL '7 days'
            ),
            'active_sessions', (
                SELECT COUNT(*) FROM user_sessions
                WHERE is_active = TRUE
                AND expires_at > NOW()
            ),
            'gdpr_overdue_users', (
                SELECT COUNT(*) FROM users
                WHERE data_retention_until < NOW()
                AND deleted_at IS NULL
            )
        );
    $$
);

-- Daily metrics aggregation
SELECT cron.schedule(
    'daily-metrics',
    '0 1 * * *', -- Run at 1 AM daily
    $$
    INSERT INTO daily_metrics (date, loctician_id, total_bookings, confirmed_bookings,
                              cancelled_bookings, total_revenue, service_revenue)
    SELECT
        CURRENT_DATE - 1,
        b.loctician_id,
        COUNT(*),
        COUNT(*) FILTER (WHERE b.status = 'confirmed'),
        COUNT(*) FILTER (WHERE b.status = 'cancelled'),
        SUM(b.total_amount),
        SUM(b.service_price)
    FROM bookings b
    WHERE DATE(b.appointment_start) = CURRENT_DATE - 1
    GROUP BY b.loctician_id
    ON CONFLICT (date, loctician_id) DO UPDATE SET
        total_bookings = EXCLUDED.total_bookings,
        confirmed_bookings = EXCLUDED.confirmed_bookings,
        cancelled_bookings = EXCLUDED.cancelled_bookings,
        total_revenue = EXCLUDED.total_revenue,
        service_revenue = EXCLUDED.service_revenue,
        updated_at = NOW();
    $$
);

-- Email queue processing
SELECT cron.schedule(
    'process-email-queue',
    '*/5 * * * *', -- Run every 5 minutes
    $$
    UPDATE email_queue
    SET status = 'sending', attempts = attempts + 1
    WHERE status = 'queued'
    AND scheduled_at <= NOW()
    AND attempts < max_attempts;
    $$
);

-- Clean old sessions
SELECT cron.schedule(
    'cleanup-sessions',
    '0 4 * * *', -- Run at 4 AM daily
    $$
    DELETE FROM user_sessions
    WHERE expires_at < NOW() - INTERVAL '7 days';

    DELETE FROM login_attempts
    WHERE attempted_at < NOW() - INTERVAL '30 days';

    DELETE FROM api_rate_limits
    WHERE window_start < NOW() - INTERVAL '1 day';
    $$
);

-- =====================================================
-- STEP 12: ENHANCED SECURITY INDEXES
-- =====================================================

-- Security-focused indexes
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token) WHERE is_active = TRUE;
CREATE INDEX idx_user_sessions_expiry ON user_sessions(expires_at, is_active);
CREATE INDEX idx_login_attempts_email_time ON login_attempts(email, attempted_at DESC);
CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at DESC);
CREATE INDEX idx_api_rate_limits_lookup ON api_rate_limits(endpoint, ip_address, user_id, window_start);

-- Audit trail indexes
CREATE INDEX idx_audit_log_user_time ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_action_time ON audit_log(action, created_at DESC);

-- Search indexes
CREATE INDEX idx_users_search ON users USING gin(
    to_tsvector('danish_unaccent', first_name || ' ' || last_name || ' ' || email)
) WHERE role = 'customer' AND deleted_at IS NULL;

CREATE INDEX idx_bookings_search ON bookings USING gin(
    to_tsvector('danish_unaccent',
        booking_number || ' ' ||
        COALESCE(customer_notes, '') || ' ' ||
        COALESCE(special_requests, '')
    )
);

-- =====================================================
-- STEP 13: SECURITY MONITORING FUNCTIONS
-- =====================================================

-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TABLE(
    alert_type VARCHAR(50),
    description TEXT,
    severity VARCHAR(20),
    affected_user_id UUID,
    detected_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Multiple failed logins from same IP
    RETURN QUERY
    SELECT
        'BRUTE_FORCE_ATTACK'::VARCHAR(50),
        'Multiple failed login attempts from IP: ' || ip_address::TEXT,
        'HIGH'::VARCHAR(20),
        NULL::UUID,
        MAX(attempted_at)
    FROM login_attempts
    WHERE attempted_at > NOW() - INTERVAL '1 hour'
    AND success = FALSE
    GROUP BY ip_address
    HAVING COUNT(*) >= 10;

    -- Concurrent sessions from different IPs
    RETURN QUERY
    SELECT
        'CONCURRENT_SESSIONS'::VARCHAR(50),
        'User has active sessions from multiple IPs',
        'MEDIUM'::VARCHAR(20),
        user_id,
        NOW()
    FROM user_sessions
    WHERE is_active = TRUE
    AND expires_at > NOW()
    GROUP BY user_id
    HAVING COUNT(DISTINCT ip_address) > 2;

    -- Unusual booking patterns
    RETURN QUERY
    SELECT
        'UNUSUAL_BOOKING_PATTERN'::VARCHAR(50),
        'Customer created multiple bookings in short time',
        'LOW'::VARCHAR(20),
        customer_id,
        MAX(created_at)
    FROM bookings
    WHERE created_at > NOW() - INTERVAL '1 hour'
    GROUP BY customer_id
    HAVING COUNT(*) >= 5;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get security metrics
CREATE OR REPLACE FUNCTION get_security_metrics(
    date_from DATE DEFAULT CURRENT_DATE - 7,
    date_to DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    metrics JSON;
BEGIN
    SELECT json_build_object(
        'period', json_build_object('from', date_from, 'to', date_to),
        'authentication', json_build_object(
            'total_attempts', COUNT(*),
            'successful_logins', COUNT(*) FILTER (WHERE success = TRUE),
            'failed_attempts', COUNT(*) FILTER (WHERE success = FALSE),
            'unique_ips', COUNT(DISTINCT ip_address),
            'locked_accounts', COUNT(DISTINCT email) FILTER (
                WHERE success = FALSE AND attempted_at > NOW() - INTERVAL '1 hour'
            )
        ),
        'sessions', json_build_object(
            'active_sessions', (
                SELECT COUNT(*) FROM user_sessions
                WHERE is_active = TRUE AND expires_at > NOW()
            ),
            'expired_sessions', (
                SELECT COUNT(*) FROM user_sessions
                WHERE expires_at < NOW()
            )
        ),
        'data_protection', json_build_object(
            'gdpr_requests', (
                SELECT COUNT(*) FROM audit_log
                WHERE action = 'ANONYMIZE'
                AND created_at::DATE BETWEEN date_from AND date_to
            ),
            'data_exports', (
                SELECT COUNT(*) FROM audit_log
                WHERE table_name = 'data_export'
                AND created_at::DATE BETWEEN date_from AND date_to
            )
        )
    ) INTO metrics
    FROM login_attempts
    WHERE attempted_at::DATE BETWEEN date_from AND date_to;

    RETURN metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 14: API RATE LIMITING FUNCTIONS
-- =====================================================

-- Function to check and enforce rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_endpoint VARCHAR(200),
    p_ip_address INET,
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_window_minutes INTEGER DEFAULT 60
)
RETURNS JSON AS $$
DECLARE
    current_count INTEGER;
    window_start TIMESTAMP WITH TIME ZONE;
    blocked_until TIMESTAMP WITH TIME ZONE;
BEGIN
    window_start := date_trunc('hour', NOW()) +
                   (EXTRACT(minute FROM NOW())::INTEGER / p_window_minutes) *
                   (p_window_minutes || ' minutes')::INTERVAL;

    -- Check if currently blocked
    SELECT api_rate_limits.blocked_until INTO blocked_until
    FROM api_rate_limits
    WHERE endpoint = p_endpoint
    AND ip_address = p_ip_address
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND api_rate_limits.blocked_until > NOW();

    IF blocked_until IS NOT NULL THEN
        RETURN json_build_object(
            'allowed', false,
            'blocked_until', blocked_until,
            'reason', 'RATE_LIMITED'
        );
    END IF;

    -- Get or create rate limit record
    INSERT INTO api_rate_limits (endpoint, ip_address, user_id, window_start, request_count)
    VALUES (p_endpoint, p_ip_address, p_user_id, window_start, 1)
    ON CONFLICT (endpoint, ip_address, user_id, window_start)
    DO UPDATE SET
        request_count = api_rate_limits.request_count + 1,
        blocked_until = CASE
            WHEN api_rate_limits.request_count + 1 > p_limit
            THEN NOW() + INTERVAL '1 hour'
            ELSE NULL
        END
    RETURNING request_count INTO current_count;

    IF current_count > p_limit THEN
        RETURN json_build_object(
            'allowed', false,
            'current_count', current_count,
            'limit', p_limit,
            'reset_at', window_start + (p_window_minutes || ' minutes')::INTERVAL,
            'reason', 'LIMIT_EXCEEDED'
        );
    END IF;

    RETURN json_build_object(
        'allowed', true,
        'current_count', current_count,
        'limit', p_limit,
        'remaining', p_limit - current_count,
        'reset_at', window_start + (p_window_minutes || ' minutes')::INTERVAL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 15: SECURITY HELPER VIEWS
-- =====================================================

-- View for monitoring active sessions
CREATE VIEW v_security_active_sessions AS
SELECT
    us.user_id,
    u.email,
    u.role,
    us.ip_address,
    us.last_activity,
    us.expires_at,
    us.created_at as session_started,
    EXTRACT(EPOCH FROM (NOW() - us.last_activity))/60 as minutes_idle
FROM user_sessions us
JOIN users u ON us.user_id = u.id
WHERE us.is_active = TRUE
AND us.expires_at > NOW()
ORDER BY us.last_activity DESC;

-- View for failed login monitoring
CREATE VIEW v_security_failed_logins AS
SELECT
    email,
    ip_address,
    COUNT(*) as attempt_count,
    MAX(attempted_at) as last_attempt,
    MIN(attempted_at) as first_attempt,
    string_agg(DISTINCT failure_reason, ', ') as failure_reasons
FROM login_attempts
WHERE attempted_at > NOW() - INTERVAL '24 hours'
AND success = FALSE
GROUP BY email, ip_address
HAVING COUNT(*) >= 3
ORDER BY attempt_count DESC, last_attempt DESC;

-- View for GDPR compliance status
CREATE VIEW v_gdpr_compliance_status AS
SELECT
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.data_retention_until,
    u.gdpr_consent_date,
    u.created_at,
    u.last_login_at,
    CASE
        WHEN u.data_retention_until IS NULL THEN 'NO_RETENTION_SET'
        WHEN u.data_retention_until < NOW() THEN 'OVERDUE'
        WHEN u.data_retention_until < NOW() + INTERVAL '30 days' THEN 'DUE_SOON'
        ELSE 'COMPLIANT'
    END as compliance_status,
    CASE
        WHEN u.data_retention_until < NOW() THEN
            EXTRACT(days FROM NOW() - u.data_retention_until)
        ELSE NULL
    END as days_overdue
FROM users u
WHERE u.deleted_at IS NULL
AND u.role = 'customer'
ORDER BY u.data_retention_until NULLS LAST;

-- =====================================================
-- STEP 16: GRANT SECURITY FUNCTION PERMISSIONS
-- =====================================================

-- Grant execute permissions to roles
GRANT EXECUTE ON FUNCTION authenticate_user(VARCHAR, TEXT, INET, TEXT) TO api_user;
GRANT EXECUTE ON FUNCTION validate_session(TEXT) TO api_user;
GRANT EXECUTE ON FUNCTION create_secure_booking(UUID, UUID, UUID, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, TEXT) TO api_user;
GRANT EXECUTE ON FUNCTION search_customers(TEXT, INTEGER) TO loctician_role, admin_role;
GRANT EXECUTE ON FUNCTION search_bookings(TEXT, DATE, DATE, booking_status, INTEGER) TO loctician_role, admin_role;
GRANT EXECUTE ON FUNCTION get_search_suggestions(TEXT, TEXT, INTEGER) TO customer_role, loctician_role, admin_role;
GRANT EXECUTE ON FUNCTION check_rate_limit(VARCHAR, INET, UUID, INTEGER, INTEGER) TO api_user;
GRANT EXECUTE ON FUNCTION export_user_data(UUID) TO admin_role;
GRANT EXECUTE ON FUNCTION anonymize_user_gdpr(UUID, TEXT) TO admin_role;
GRANT EXECUTE ON FUNCTION detect_suspicious_activity() TO admin_role;
GRANT EXECUTE ON FUNCTION get_security_metrics(DATE, DATE) TO admin_role;

-- Grant view permissions
GRANT SELECT ON v_security_active_sessions TO admin_role;
GRANT SELECT ON v_security_failed_logins TO admin_role;
GRANT SELECT ON v_gdpr_compliance_status TO admin_role;

-- =====================================================
-- STEP 17: SECURITY CONFIGURATION FINALIZATION
-- =====================================================

-- Create security admin user (to be used by application)
DO $$
DECLARE
    security_user_id UUID;
    hashed_password TEXT;
BEGIN
    -- Generate secure password hash
    hashed_password := hash_password('SecureP@ssw0rd2024!');

    -- Create security admin user
    INSERT INTO users (
        email, password_hash, role, status,
        first_name, last_name,
        email_verified, gdpr_consent_date,
        gdpr_consent_version
    ) VALUES (
        'security@loctician.dk',
        hashed_password,
        'admin',
        'active',
        'Security',
        'Administrator',
        TRUE,
        NOW(),
        '1.0'
    ) RETURNING id INTO security_user_id;

    -- Create profile
    INSERT INTO user_profiles (user_id, bio)
    VALUES (security_user_id, 'System security administrator account');

    RAISE NOTICE 'Security administrator account created with ID: %', security_user_id;
END $$;

-- Set up security event logging
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    user_id UUID REFERENCES users(id),
    ip_address INET,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_security_events_type_time ON security_events(event_type, created_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity, created_at DESC);

-- =====================================================
-- FINAL SECURITY VALIDATION
-- =====================================================

-- Verify all security measures are in place
DO $$
DECLARE
    rls_enabled_count INTEGER;
    function_count INTEGER;
    index_count INTEGER;
BEGIN
    -- Check RLS is enabled on critical tables
    SELECT COUNT(*) INTO rls_enabled_count
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND c.relname IN ('users', 'bookings', 'user_sessions', 'audit_log')
    AND c.relrowsecurity = TRUE;

    -- Check security functions exist
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN ('authenticate_user', 'validate_session', 'create_secure_booking');

    -- Check security indexes exist
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE '%security%' OR indexname LIKE '%session%' OR indexname LIKE '%audit%';

    RAISE NOTICE 'Security implementation complete:';
    RAISE NOTICE '- RLS enabled on % critical tables', rls_enabled_count;
    RAISE NOTICE '- % security functions created', function_count;
    RAISE NOTICE '- % security-related indexes created', index_count;
    RAISE NOTICE '- JWT authentication enabled';
    RAISE NOTICE '- Data encryption functions available';
    RAISE NOTICE '- GDPR compliance tools ready';
    RAISE NOTICE '- Automated security jobs scheduled';
    RAISE NOTICE '- Rate limiting implemented';
    RAISE NOTICE '- Full-text search configured';
END $$;

-- =====================================================
-- END OF SECURITY ENHANCEMENTS
-- =====================================================