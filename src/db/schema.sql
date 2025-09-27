-- =====================================================
-- LOCTICIAN BOOKING SYSTEM - POSTGRESQL SCHEMA
-- =====================================================
-- Comprehensive schema with ACID compliance, GDPR support,
-- and anti-double-booking constraints
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- CORE USER MANAGEMENT
-- =====================================================

-- User roles enum
CREATE TYPE user_role AS ENUM ('customer', 'loctician', 'admin', 'staff');

-- User status enum
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');

-- Main users table with GDPR compliance
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    status user_status NOT NULL DEFAULT 'active',

    -- Personal information (GDPR sensitive)
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,

    -- Address information
    street_address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2) DEFAULT 'DK',

    -- Preferences
    preferred_language VARCHAR(5) DEFAULT 'da',
    timezone VARCHAR(50) DEFAULT 'Europe/Copenhagen',
    marketing_consent BOOLEAN DEFAULT FALSE,

    -- GDPR compliance fields
    data_retention_until TIMESTAMP WITH TIME ZONE,
    gdpr_consent_date TIMESTAMP WITH TIME ZONE,
    gdpr_consent_version VARCHAR(10),

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- User profiles for additional information
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    profile_image_url TEXT,
    instagram_handle VARCHAR(50),
    website_url TEXT,
    specializations TEXT[],
    years_experience INTEGER,
    certifications TEXT[],

    -- Business hours for locticians
    business_hours JSONB,

    -- Customer specific
    hair_type VARCHAR(50),
    hair_length VARCHAR(20),
    allergies TEXT[],
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SERVICES AND PRODUCTS
-- =====================================================

-- Service categories
CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Services offered
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES service_categories(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),

    -- Booking constraints
    min_advance_hours INTEGER DEFAULT 24,
    max_advance_days INTEGER DEFAULT 90,
    buffer_before_minutes INTEGER DEFAULT 15,
    buffer_after_minutes INTEGER DEFAULT 15,

    -- Service attributes
    requires_consultation BOOLEAN DEFAULT FALSE,
    is_addon_service BOOLEAN DEFAULT FALSE,
    max_participants INTEGER DEFAULT 1,

    -- Visibility and availability
    is_active BOOLEAN DEFAULT TRUE,
    is_online_bookable BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,

    -- SEO and content
    slug VARCHAR(200) UNIQUE,
    meta_title VARCHAR(200),
    meta_description TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product categories
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES product_categories(id),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products for sale
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES product_categories(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    cost_price DECIMAL(10,2) CHECK (cost_price >= 0),

    -- Inventory
    stock_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    track_inventory BOOLEAN DEFAULT TRUE,

    -- Product attributes
    brand VARCHAR(100),
    size VARCHAR(50),
    color VARCHAR(50),
    weight_grams INTEGER,
    ingredients TEXT[],

    -- Visibility
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,

    -- SEO
    slug VARCHAR(200) UNIQUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- AVAILABILITY AND SCHEDULING
-- =====================================================

-- Recurring availability patterns
CREATE TABLE availability_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loctician_id UUID NOT NULL REFERENCES users(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,

    -- Effective date range
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_until DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(loctician_id, day_of_week, start_time, effective_from),
    CHECK (start_time < end_time)
);

-- Specific availability overrides
CREATE TABLE availability_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loctician_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    reason VARCHAR(200),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    UNIQUE(loctician_id, date),
    CHECK (
        (is_available = FALSE) OR
        (is_available = TRUE AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
    )
);

-- Calendar events (breaks, meetings, etc.)
CREATE TYPE calendar_event_type AS ENUM ('break', 'meeting', 'vacation', 'sick_leave', 'training', 'personal');

CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loctician_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_type calendar_event_type NOT NULL,

    -- Time range (using tstzrange for overlapping constraints)
    time_range TSTZRANGE NOT NULL,

    -- Recurrence (if applicable)
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT, -- RRULE format

    -- Visibility
    is_public BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- BOOKING SYSTEM WITH ANTI-DOUBLE-BOOKING
-- =====================================================

-- Booking status enum
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

-- Payment status enum
CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid', 'refunded', 'failed');

-- Main bookings table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_number VARCHAR(20) UNIQUE NOT NULL,

    -- Participants
    customer_id UUID NOT NULL REFERENCES users(id),
    loctician_id UUID NOT NULL REFERENCES users(id),

    -- Service details
    service_id UUID NOT NULL REFERENCES services(id),

    -- Timing (critical for double-booking prevention)
    appointment_start TIMESTAMP WITH TIME ZONE NOT NULL,
    appointment_end TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL,

    -- Status tracking
    status booking_status NOT NULL DEFAULT 'pending',
    payment_status payment_status NOT NULL DEFAULT 'pending',

    -- Pricing
    service_price DECIMAL(10,2) NOT NULL,
    additional_charges DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,

    -- Customer information
    customer_notes TEXT,
    special_requests TEXT,

    -- Internal notes
    loctician_notes TEXT,
    admin_notes TEXT,

    -- Confirmation and reminders
    confirmation_sent_at TIMESTAMP WITH TIME ZONE,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,

    -- Cancellation handling
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    cancellation_fee DECIMAL(10,2) DEFAULT 0,

    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    -- Constraints
    CHECK (appointment_start < appointment_end),
    CHECK (duration_minutes > 0),
    CHECK (total_amount >= 0)
);

-- Booking add-on services
CREATE TABLE booking_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Booking products (sold during appointment)
CREATE TABLE booking_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- AUDIT TRAIL SYSTEM
-- =====================================================

-- Audit log for all critical operations
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],

    -- User context
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,

    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Booking state changes tracking
CREATE TABLE booking_state_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    previous_status booking_status,
    new_status booking_status NOT NULL,
    reason TEXT,

    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CMS AND CONTENT MANAGEMENT
-- =====================================================

-- Page types
CREATE TYPE page_type AS ENUM ('page', 'blog_post', 'service_page', 'product_page', 'landing_page');

-- CMS pages
CREATE TABLE cms_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    content TEXT,
    excerpt TEXT,
    page_type page_type NOT NULL DEFAULT 'page',

    -- SEO
    meta_title VARCHAR(200),
    meta_description TEXT,
    meta_keywords TEXT[],

    -- Visibility
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,

    -- Scheduling
    publish_at TIMESTAMP WITH TIME ZONE,
    unpublish_at TIMESTAMP WITH TIME ZONE,

    -- Authoring
    author_id UUID REFERENCES users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Media library
CREATE TABLE media_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    alt_text TEXT,
    caption TEXT,

    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INSTAGRAM INTEGRATION
-- =====================================================

-- Instagram posts cache
CREATE TABLE instagram_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instagram_id VARCHAR(100) UNIQUE NOT NULL,
    post_type VARCHAR(20) NOT NULL, -- image, video, carousel
    caption TEXT,
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    permalink TEXT NOT NULL,

    -- Engagement metrics
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,

    -- Display settings
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,

    -- Sync metadata
    posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_error TEXT
);

-- =====================================================
-- EMAIL SYSTEM
-- =====================================================

-- Email templates
CREATE TYPE template_type AS ENUM ('booking_confirmation', 'reminder', 'cancellation', 'welcome', 'marketing', 'invoice');

CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    template_type template_type NOT NULL,
    subject VARCHAR(200) NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT,

    -- Template variables documentation
    available_variables JSONB,

    -- Versioning
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Email queue
CREATE TYPE email_status AS ENUM ('queued', 'sending', 'sent', 'failed', 'bounced');

CREATE TABLE email_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES email_templates(id),

    -- Recipients
    to_email VARCHAR(255) NOT NULL,
    to_name VARCHAR(200),
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(200),

    -- Content
    subject VARCHAR(500) NOT NULL,
    html_content TEXT,
    text_content TEXT,

    -- Context
    template_variables JSONB,
    user_id UUID REFERENCES users(id),
    booking_id UUID REFERENCES bookings(id),

    -- Status tracking
    status email_status DEFAULT 'queued',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,

    -- External provider info
    provider_message_id VARCHAR(200),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS AND REPORTING
-- =====================================================

-- Daily business metrics aggregation
CREATE TABLE daily_metrics (
    date DATE PRIMARY KEY,
    loctician_id UUID REFERENCES users(id),

    -- Booking metrics
    total_bookings INTEGER DEFAULT 0,
    confirmed_bookings INTEGER DEFAULT 0,
    cancelled_bookings INTEGER DEFAULT 0,
    no_show_bookings INTEGER DEFAULT 0,

    -- Revenue metrics
    total_revenue DECIMAL(12,2) DEFAULT 0,
    service_revenue DECIMAL(12,2) DEFAULT 0,
    product_revenue DECIMAL(12,2) DEFAULT 0,

    -- Customer metrics
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,

    -- Efficiency metrics
    utilization_percentage DECIMAL(5,2) DEFAULT 0,
    average_service_duration INTEGER DEFAULT 0,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(date, loctician_id)
);

-- Customer visit history aggregation
CREATE TABLE customer_visit_summary (
    customer_id UUID PRIMARY KEY REFERENCES users(id),
    first_visit_date DATE,
    last_visit_date DATE,
    total_visits INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    average_visit_value DECIMAL(10,2) DEFAULT 0,
    favorite_service_id UUID REFERENCES services(id),
    preferred_loctician_id UUID REFERENCES users(id),

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CRITICAL INDEXES FOR PERFORMANCE
-- =====================================================

-- User indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role_status ON users(role, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_gdpr_retention ON users(data_retention_until) WHERE data_retention_until IS NOT NULL;

-- Booking system indexes (critical for performance)
CREATE INDEX idx_bookings_loctician_date ON bookings(loctician_id, appointment_start) WHERE status NOT IN ('cancelled');
CREATE INDEX idx_bookings_customer ON bookings(customer_id, appointment_start DESC);
CREATE INDEX idx_bookings_status ON bookings(status, appointment_start);
CREATE INDEX idx_bookings_date_range ON bookings USING gist(loctician_id, tstzrange(appointment_start, appointment_end));

-- Service and product indexes
CREATE INDEX idx_services_active ON services(is_active, display_order) WHERE is_active = TRUE;
CREATE INDEX idx_services_category ON services(category_id, display_order);
CREATE INDEX idx_products_active ON products(is_active, is_featured);
CREATE INDEX idx_products_inventory ON products(stock_quantity) WHERE track_inventory = TRUE;

-- Availability indexes
CREATE INDEX idx_availability_patterns_loctician ON availability_patterns(loctician_id, day_of_week) WHERE is_active = TRUE;
CREATE INDEX idx_availability_overrides_date ON availability_overrides(loctician_id, date);
CREATE INDEX idx_calendar_events_time ON calendar_events USING gist(loctician_id, time_range);

-- Audit and analytics indexes
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id, created_at DESC);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date DESC, loctician_id);
CREATE INDEX idx_email_queue_status ON email_queue(status, scheduled_at) WHERE status IN ('queued', 'failed');

-- Full-text search indexes
CREATE INDEX idx_services_search ON services USING gin(to_tsvector('danish', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('danish', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_cms_pages_search ON cms_pages USING gin(to_tsvector('danish', title || ' ' || COALESCE(content, '')));

-- =====================================================
-- CRITICAL CONSTRAINTS FOR ANTI-DOUBLE-BOOKING
-- =====================================================

-- Prevent overlapping bookings for same loctician
-- This is the CRITICAL constraint that prevents double bookings
CREATE UNIQUE INDEX idx_bookings_no_overlap ON bookings
USING gist(
    loctician_id,
    tstzrange(appointment_start, appointment_end)
)
WHERE status NOT IN ('cancelled');

-- Prevent overlapping calendar events for same loctician
CREATE UNIQUE INDEX idx_calendar_events_no_overlap ON calendar_events
USING gist(
    loctician_id,
    time_range
);

-- Ensure booking times align with service duration
ALTER TABLE bookings ADD CONSTRAINT chk_booking_duration_matches_service
CHECK (
    EXTRACT(EPOCH FROM (appointment_end - appointment_start))/60 >= duration_minutes
);

-- =====================================================
-- GDPR COMPLIANCE FUNCTIONS
-- =====================================================

-- Function to anonymize user data (GDPR Right to be Forgotten)
CREATE OR REPLACE FUNCTION anonymize_user_data(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    -- Update user record with anonymized data
    UPDATE users SET
        email = 'deleted-' || user_uuid || '@anonymized.local',
        phone = NULL,
        first_name = 'Deleted',
        last_name = 'User',
        date_of_birth = NULL,
        street_address = NULL,
        city = NULL,
        postal_code = NULL,
        deleted_at = NOW(),
        data_retention_until = NULL
    WHERE id = user_uuid;

    -- Anonymize profile data
    UPDATE user_profiles SET
        bio = 'Profile deleted',
        profile_image_url = NULL,
        instagram_handle = NULL,
        website_url = NULL,
        allergies = NULL,
        notes = 'Customer data anonymized for GDPR compliance'
    WHERE user_id = user_uuid;

    -- Keep booking records but anonymize customer notes
    UPDATE bookings SET
        customer_notes = 'Customer data anonymized',
        special_requests = NULL
    WHERE customer_id = user_uuid;

    RAISE NOTICE 'User % data has been anonymized', user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to purge expired data based on retention policies
CREATE OR REPLACE FUNCTION purge_expired_data()
RETURNS TABLE(
    table_name TEXT,
    records_deleted INTEGER
) AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Purge users with expired retention periods
    DELETE FROM users WHERE data_retention_until < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    table_name := 'users';
    records_deleted := deleted_count;
    RETURN NEXT;

    -- Purge old audit logs (keep for 7 years)
    DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '7 years';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    table_name := 'audit_log';
    records_deleted := deleted_count;
    RETURN NEXT;

    -- Purge old email queue entries (keep sent emails for 1 year)
    DELETE FROM email_queue
    WHERE status = 'sent' AND sent_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    table_name := 'email_queue';
    records_deleted := deleted_count;
    RETURN NEXT;

    -- Purge failed email attempts older than 30 days
    DELETE FROM email_queue
    WHERE status = 'failed' AND failed_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    table_name := 'email_queue_failed';
    records_deleted := deleted_count;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- BOOKING LOGIC FUNCTIONS
-- =====================================================

-- Function to check availability for a time slot
CREATE OR REPLACE FUNCTION check_availability(
    p_loctician_id UUID,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    -- Check for existing bookings (excluding cancelled ones and optionally a specific booking)
    SELECT COUNT(*) INTO conflict_count
    FROM bookings
    WHERE loctician_id = p_loctician_id
    AND status NOT IN ('cancelled')
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
    AND tstzrange(appointment_start, appointment_end) && tstzrange(p_start_time, p_end_time);

    IF conflict_count > 0 THEN
        RETURN FALSE;
    END IF;

    -- Check for calendar events that block this time
    SELECT COUNT(*) INTO conflict_count
    FROM calendar_events
    WHERE loctician_id = p_loctician_id
    AND time_range && tstzrange(p_start_time, p_end_time);

    IF conflict_count > 0 THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get available time slots for a specific date
CREATE OR REPLACE FUNCTION get_available_slots(
    p_loctician_id UUID,
    p_date DATE,
    p_service_duration INTEGER,
    p_slot_interval INTEGER DEFAULT 30
)
RETURNS TABLE(
    slot_start TIMESTAMP WITH TIME ZONE,
    slot_end TIMESTAMP WITH TIME ZONE,
    is_available BOOLEAN
) AS $$
DECLARE
    day_of_week INTEGER;
    pattern_record RECORD;
    current_time TIMESTAMP WITH TIME ZONE;
    end_time TIMESTAMP WITH TIME ZONE;
    slot_duration INTERVAL;
BEGIN
    day_of_week := EXTRACT(DOW FROM p_date);
    slot_duration := INTERVAL '1 minute' * p_service_duration;

    -- Get availability pattern for this day
    FOR pattern_record IN
        SELECT start_time, end_time
        FROM availability_patterns
        WHERE loctician_id = p_loctician_id
        AND day_of_week = day_of_week
        AND is_active = TRUE
        AND (effective_until IS NULL OR effective_until >= p_date)
        AND effective_from <= p_date
    LOOP
        current_time := p_date + pattern_record.start_time;
        end_time := p_date + pattern_record.end_time;

        -- Generate time slots
        WHILE current_time + slot_duration <= end_time LOOP
            slot_start := current_time;
            slot_end := current_time + slot_duration;
            is_available := check_availability(p_loctician_id, slot_start, slot_end);

            RETURN NEXT;

            current_time := current_time + INTERVAL '1 minute' * p_slot_interval;
        END LOOP;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to create a booking with full validation
CREATE OR REPLACE FUNCTION create_booking(
    p_customer_id UUID,
    p_loctician_id UUID,
    p_service_id UUID,
    p_appointment_start TIMESTAMP WITH TIME ZONE,
    p_customer_notes TEXT DEFAULT NULL,
    p_special_requests TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_booking_id UUID;
    v_service_duration INTEGER;
    v_service_price DECIMAL(10,2);
    v_appointment_end TIMESTAMP WITH TIME ZONE;
    v_booking_number VARCHAR(20);
BEGIN
    -- Get service details
    SELECT duration_minutes, base_price
    INTO v_service_duration, v_service_price
    FROM services
    WHERE id = p_service_id AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service not found or inactive';
    END IF;

    -- Calculate appointment end time
    v_appointment_end := p_appointment_start + INTERVAL '1 minute' * v_service_duration;

    -- Check availability (this will be enforced by the unique constraint as well)
    IF NOT check_availability(p_loctician_id, p_appointment_start, v_appointment_end) THEN
        RAISE EXCEPTION 'Time slot not available';
    END IF;

    -- Generate booking number
    v_booking_number := 'BK' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(EXTRACT(EPOCH FROM NOW())::INTEGER % 10000, 4, '0');

    -- Create the booking
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
        status
    ) VALUES (
        v_booking_number,
        p_customer_id,
        p_loctician_id,
        p_service_id,
        p_appointment_start,
        v_appointment_end,
        v_service_duration,
        v_service_price,
        v_service_price,
        p_customer_notes,
        p_special_requests,
        'confirmed'
    ) RETURNING id INTO v_booking_id;

    -- Log the booking creation
    INSERT INTO booking_state_changes (booking_id, new_status, changed_by)
    VALUES (v_booking_id, 'confirmed', p_customer_id);

    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- AUTOMATED TRIGGERS
-- =====================================================

-- Trigger function for updating the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_cms_pages_updated_at BEFORE UPDATE ON cms_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger function for audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to critical tables
CREATE TRIGGER tr_users_audit AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER tr_bookings_audit AFTER INSERT OR UPDATE OR DELETE ON bookings FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Trigger for booking state changes
CREATE OR REPLACE FUNCTION log_booking_state_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO booking_state_changes (booking_id, previous_status, new_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_booking_state_changes AFTER UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION log_booking_state_change();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Active locticians with their availability
CREATE VIEW v_active_locticians AS
SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    up.bio,
    up.profile_image_url,
    up.specializations,
    up.years_experience,
    array_agg(
        json_build_object(
            'day', ap.day_of_week,
            'start_time', ap.start_time,
            'end_time', ap.end_time
        ) ORDER BY ap.day_of_week
    ) as availability_pattern
FROM users u
JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN availability_patterns ap ON u.id = ap.loctician_id AND ap.is_active = TRUE
WHERE u.role = 'loctician'
AND u.status = 'active'
GROUP BY u.id, u.first_name, u.last_name, u.email, up.bio, up.profile_image_url, up.specializations, up.years_experience;

-- Upcoming bookings with full details
CREATE VIEW v_upcoming_bookings AS
SELECT
    b.id,
    b.booking_number,
    b.appointment_start,
    b.appointment_end,
    b.status,
    b.total_amount,

    -- Customer info
    c.first_name as customer_first_name,
    c.last_name as customer_last_name,
    c.email as customer_email,
    c.phone as customer_phone,

    -- Loctician info
    l.first_name as loctician_first_name,
    l.last_name as loctician_last_name,

    -- Service info
    s.name as service_name,
    s.duration_minutes,

    b.customer_notes,
    b.special_requests
FROM bookings b
JOIN users c ON b.customer_id = c.id
JOIN users l ON b.loctician_id = l.id
JOIN services s ON b.service_id = s.id
WHERE b.appointment_start > NOW()
AND b.status NOT IN ('cancelled')
ORDER BY b.appointment_start;

-- Daily schedule view
CREATE VIEW v_daily_schedule AS
SELECT
    b.loctician_id,
    DATE(b.appointment_start) as schedule_date,
    b.appointment_start,
    b.appointment_end,
    b.status,
    s.name as service_name,
    c.first_name || ' ' || c.last_name as customer_name,
    c.phone as customer_phone,
    b.customer_notes
FROM bookings b
JOIN services s ON b.service_id = s.id
JOIN users c ON b.customer_id = c.id
WHERE b.status NOT IN ('cancelled')
ORDER BY b.loctician_id, b.appointment_start;

-- GDPR compliance view - users requiring action
CREATE VIEW v_gdpr_compliance AS
SELECT
    id,
    email,
    first_name,
    last_name,
    data_retention_until,
    CASE
        WHEN data_retention_until < NOW() THEN 'OVERDUE'
        WHEN data_retention_until < NOW() + INTERVAL '30 days' THEN 'DUE_SOON'
        ELSE 'COMPLIANT'
    END as compliance_status,
    created_at,
    last_login_at
FROM users
WHERE deleted_at IS NULL
AND data_retention_until IS NOT NULL
ORDER BY data_retention_until;

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- This section would contain INSERT statements for sample data
-- I'll create this in a separate file to keep the schema clean