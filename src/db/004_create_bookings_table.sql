-- Migration 004: Enhanced Service Management & Booking System
-- PostgreSQL 17 Advanced Booking Platform
-- Created: 2025-09-26
-- Comprehensive service management with role-based booking

-- =====================================================
-- SERVICE CATEGORY SYSTEM (Hierarchical with ltree)
-- =====================================================

-- Service categories with hierarchical structure
CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL UNIQUE,

    -- Hierarchical structure using ltree
    path LTREE,
    parent_id UUID REFERENCES service_categories(id),

    -- Display and SEO
    display_order INTEGER DEFAULT 0,
    icon VARCHAR(50),
    color_code VARCHAR(7), -- Hex color
    image_url TEXT,

    -- SEO fields
    meta_title VARCHAR(200),
    meta_description TEXT,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ENHANCED SERVICE SYSTEM
-- =====================================================

-- Service types enum
CREATE TYPE service_type AS ENUM ('individual', 'group', 'package', 'addon', 'consultation');

-- Duration types for flexible scheduling
CREATE TYPE duration_type AS ENUM ('fixed', 'variable', 'open_ended');

-- Enhanced services table
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic information
    name VARCHAR(200) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    slug VARCHAR(200) NOT NULL UNIQUE,

    -- Category association
    category_id UUID REFERENCES service_categories(id),

    -- Service configuration
    service_type service_type NOT NULL DEFAULT 'individual',
    duration_type duration_type NOT NULL DEFAULT 'fixed',
    duration_minutes INTEGER, -- NULL for open_ended
    duration_min INTEGER, -- For variable duration
    duration_max INTEGER, -- For variable duration

    -- Pricing structure
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
    price_per_hour DECIMAL(10,2), -- For open_ended or variable pricing
    deposit_required DECIMAL(10,2) DEFAULT 0,
    cancellation_fee DECIMAL(10,2) DEFAULT 0,

    -- Booking constraints
    min_advance_hours INTEGER DEFAULT 24,
    max_advance_days INTEGER DEFAULT 90,
    max_participants INTEGER DEFAULT 1,
    buffer_before_minutes INTEGER DEFAULT 15,
    buffer_after_minutes INTEGER DEFAULT 15,

    -- Service requirements
    requires_consultation BOOLEAN DEFAULT false,
    requires_deposit BOOLEAN DEFAULT false,
    requires_subscription BOOLEAN DEFAULT false,
    age_restriction INTEGER, -- Minimum age

    -- Staff assignment
    assigned_staff UUID[], -- Array of user IDs who can provide this service
    auto_assign_staff BOOLEAN DEFAULT true,

    -- Availability
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_online_bookable BOOLEAN DEFAULT true,
    available_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7], -- 1=Monday, 7=Sunday

    -- Display
    display_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    image_url TEXT,
    gallery_images TEXT[],

    -- SEO
    meta_title VARCHAR(200),
    meta_description TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_duration_logic CHECK (
        (duration_type = 'fixed' AND duration_minutes IS NOT NULL) OR
        (duration_type = 'variable' AND duration_min IS NOT NULL AND duration_max IS NOT NULL AND duration_max > duration_min) OR
        (duration_type = 'open_ended')
    )
);

-- Service addon/package relationships
CREATE TABLE service_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    main_service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    addon_service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

    -- Pricing override
    addon_price DECIMAL(10,2), -- NULL uses addon's base price
    is_required BOOLEAN DEFAULT false,
    max_quantity INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(main_service_id, addon_service_id)
);

-- Service pricing tiers (for different customer types)
CREATE TABLE service_pricing_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

    -- Tier information
    tier_name VARCHAR(50) NOT NULL, -- 'standard', 'premium', 'student', etc.
    role_required VARCHAR(50), -- Required user role for this pricing
    subscription_required BOOLEAN DEFAULT false,

    -- Pricing
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    discount_percentage DECIMAL(5,2) DEFAULT 0,

    -- Validity
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(service_id, tier_name)
);

-- =====================================================
-- ADVANCED CALENDAR & AVAILABILITY SYSTEM
-- =====================================================

-- Staff availability patterns (recurring)
CREATE TABLE staff_availability_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Day and time
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Services this availability applies to
    service_ids UUID[], -- NULL means all services

    -- Effective period
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_until DATE,

    -- Break configuration
    break_duration_minutes INTEGER DEFAULT 0,
    break_after_minutes INTEGER, -- Take break after X minutes of work

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(staff_id, day_of_week, start_time, effective_from),
    CHECK (start_time < end_time)
);

-- Staff availability exceptions (specific dates)
CREATE TABLE staff_availability_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Date and time
    exception_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,

    -- Exception type
    is_available BOOLEAN NOT NULL, -- false = unavailable, true = special availability
    reason VARCHAR(200),
    exception_type VARCHAR(50), -- 'vacation', 'sick', 'training', 'special_hours'

    -- Services affected
    service_ids UUID[], -- NULL means all services

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),

    UNIQUE(staff_id, exception_date),
    CHECK (
        (is_available = false) OR
        (is_available = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
    )
);

-- Time slot templates for services
CREATE TABLE service_time_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

    -- Slot configuration
    slot_duration_minutes INTEGER NOT NULL,
    buffer_minutes INTEGER DEFAULT 0,

    -- Availability
    available_days INTEGER[] NOT NULL, -- Array of weekdays
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Capacity
    max_concurrent_bookings INTEGER DEFAULT 1,

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ROLE-BASED BOOKING SYSTEM
-- =====================================================

-- Booking statuses with workflow
CREATE TABLE booking_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color_code VARCHAR(7), -- Hex color for UI

    -- Workflow
    is_initial BOOLEAN DEFAULT false,
    is_final BOOLEAN DEFAULT false,
    can_cancel BOOLEAN DEFAULT true,
    can_reschedule BOOLEAN DEFAULT true,

    -- Permissions
    customer_visible BOOLEAN DEFAULT true,
    staff_only BOOLEAN DEFAULT false,

    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced bookings table with role-based features
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_number VARCHAR(20) UNIQUE NOT NULL,

    -- Participants
    customer_id UUID NOT NULL REFERENCES users(id),
    staff_id UUID NOT NULL REFERENCES users(id),

    -- Service details
    service_id UUID NOT NULL REFERENCES services(id),

    -- Time range with PostgreSQL 17 range types for conflict prevention
    appointment_time TSTZRANGE NOT NULL,

    -- Legacy time fields for compatibility
    booking_date DATE GENERATED ALWAYS AS (DATE(lower(appointment_time))) STORED,
    booking_time TIME GENERATED ALWAYS AS (lower(appointment_time)::TIME) STORED,
    duration_minutes INTEGER NOT NULL,

    -- Status and workflow
    status_id INTEGER NOT NULL REFERENCES booking_statuses(id),
    previous_status_id INTEGER REFERENCES booking_statuses(id),

    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    addon_total DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL,
    deposit_paid DECIMAL(10,2) DEFAULT 0,

    -- Customer information
    customer_notes TEXT,
    special_requests TEXT,

    -- Staff information (internal)
    staff_notes TEXT,
    preparation_notes TEXT,

    -- Admin information
    admin_notes TEXT,
    internal_reference VARCHAR(100),

    -- Booking source
    booking_source VARCHAR(50) DEFAULT 'online', -- 'online', 'phone', 'walk_in', 'admin'
    booked_by UUID REFERENCES users(id), -- Who created the booking (may differ from customer)

    -- Notifications
    confirmation_sent_at TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,
    followup_sent_at TIMESTAMPTZ,

    -- Cancellation
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    cancellation_fee DECIMAL(10,2) DEFAULT 0,

    -- Check-in/completion
    checked_in_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CHECK (lower(appointment_time) < upper(appointment_time)),
    CHECK (duration_minutes > 0),
    CHECK (total_price >= 0),
    CHECK (deposit_paid >= 0 AND deposit_paid <= total_price)
);

-- Booking addon services
CREATE TABLE booking_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),

    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),

    notes TEXT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    added_by UUID REFERENCES users(id)
);

-- Booking state change history
CREATE TABLE booking_state_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

    from_status_id INTEGER REFERENCES booking_statuses(id),
    to_status_id INTEGER NOT NULL REFERENCES booking_statuses(id),

    reason TEXT,
    notes TEXT,

    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- System context
    ip_address INET,
    user_agent TEXT
);

-- =====================================================
-- PERFORMANCE INDEXES (Sub-50ms queries)
-- =====================================================

-- Service category indexes
CREATE INDEX idx_service_categories_active ON service_categories (is_active, display_order) WHERE is_active = true;
CREATE INDEX idx_service_categories_path ON service_categories USING GIST (path);
CREATE INDEX idx_service_categories_parent ON service_categories (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_service_categories_featured ON service_categories (is_featured, display_order) WHERE is_featured = true;

-- Service indexes with PostgreSQL 17 optimizations
CREATE INDEX idx_services_active ON services (is_active, is_online_bookable, display_order) WHERE is_active = true;
CREATE INDEX idx_services_category ON services (category_id, display_order) WHERE is_active = true;
CREATE INDEX idx_services_featured ON services (is_featured, display_order) WHERE is_featured = true;
CREATE INDEX idx_services_staff ON services USING GIN (assigned_staff) WHERE assigned_staff IS NOT NULL;
CREATE INDEX idx_services_type ON services (service_type, is_active) WHERE is_active = true;

-- Full-text search indexes
CREATE INDEX idx_services_search ON services USING GIN (
    to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(short_description, ''))
) WHERE is_active = true;

-- Availability indexes
CREATE INDEX idx_staff_patterns_active ON staff_availability_patterns (staff_id, day_of_week, is_active) WHERE is_active = true;
CREATE INDEX idx_staff_patterns_services ON staff_availability_patterns USING GIN (service_ids) WHERE service_ids IS NOT NULL;
CREATE INDEX idx_staff_exceptions_date ON staff_availability_exceptions (staff_id, exception_date);
CREATE INDEX idx_staff_exceptions_available ON staff_availability_exceptions (staff_id, is_available, exception_date);

-- CRITICAL: Booking conflict prevention index using btree_gist
CREATE UNIQUE INDEX idx_bookings_no_overlap ON bookings
USING GIST (staff_id, appointment_time)
WHERE status_id NOT IN (
    SELECT id FROM booking_statuses WHERE name IN ('cancelled', 'no_show')
);

-- Booking performance indexes
CREATE INDEX idx_bookings_customer_upcoming ON bookings (customer_id, lower(appointment_time))
    WHERE lower(appointment_time) > CURRENT_TIMESTAMP;
CREATE INDEX idx_bookings_staff_date ON bookings (staff_id, booking_date, booking_time);
CREATE INDEX idx_bookings_status_date ON bookings (status_id, booking_date);
CREATE INDEX idx_bookings_date_range ON bookings USING GIST (appointment_time);
CREATE INDEX idx_bookings_source ON bookings (booking_source, created_at);

-- Audit indexes
CREATE INDEX idx_booking_changes_booking ON booking_state_changes (booking_id, changed_at DESC);
CREATE INDEX idx_booking_changes_user ON booking_state_changes (changed_by, changed_at DESC);

-- =====================================================
-- ADVANCED FUNCTIONS FOR ROLE-BASED BOOKING
-- =====================================================

-- Function to check if user can book a service
CREATE OR REPLACE FUNCTION can_user_book_service(
    p_user_id UUID,
    p_service_id UUID,
    p_appointment_time TSTZRANGE
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    service_record RECORD;
    conflict_count INTEGER;
BEGIN
    -- Get user role
    SELECT role FROM users WHERE id = p_user_id AND is_active = true INTO user_role;

    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Get service details
    SELECT * FROM services WHERE id = p_service_id AND is_active = true INTO service_record;

    IF service_record IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admin and staff can book anytime (if slot is available)
    IF user_role IN ('admin', 'staff') THEN
        -- Just check for conflicts
        SELECT COUNT(*) INTO conflict_count
        FROM bookings
        WHERE staff_id IN (
            SELECT id FROM users WHERE role IN ('admin', 'staff') AND is_active = true
        )
        AND appointment_time && p_appointment_time
        AND status_id NOT IN (
            SELECT id FROM booking_statuses WHERE name IN ('cancelled', 'no_show')
        );

        RETURN conflict_count = 0;
    END IF;

    -- Customers must follow booking rules
    IF user_role = 'customer' THEN
        -- Check if service is online bookable
        IF NOT service_record.is_online_bookable THEN
            RETURN FALSE;
        END IF;

        -- Check advance booking constraints
        IF service_record.min_advance_hours IS NOT NULL THEN
            IF lower(p_appointment_time) < CURRENT_TIMESTAMP + (service_record.min_advance_hours || ' hours')::INTERVAL THEN
                RETURN FALSE;
            END IF;
        END IF;

        IF service_record.max_advance_days IS NOT NULL THEN
            IF lower(p_appointment_time) > CURRENT_TIMESTAMP + (service_record.max_advance_days || ' days')::INTERVAL THEN
                RETURN FALSE;
            END IF;
        END IF;

        -- Check staff availability and conflicts
        RETURN check_staff_availability(p_service_id, p_appointment_time);
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check staff availability for a time slot
CREATE OR REPLACE FUNCTION check_staff_availability(
    p_service_id UUID,
    p_appointment_time TSTZRANGE
)
RETURNS BOOLEAN AS $$
DECLARE
    available_staff_count INTEGER;
    appointment_date DATE;
    appointment_dow INTEGER;
    appointment_start_time TIME;
    appointment_end_time TIME;
BEGIN
    appointment_date := DATE(lower(p_appointment_time));
    appointment_dow := EXTRACT(DOW FROM appointment_date);
    appointment_start_time := lower(p_appointment_time)::TIME;
    appointment_end_time := upper(p_appointment_time)::TIME;

    -- Check for available staff
    SELECT COUNT(*) INTO available_staff_count
    FROM users u
    WHERE u.role IN ('admin', 'staff')
    AND u.is_active = true
    AND (
        -- Check if staff is assigned to this service (or auto-assign is enabled)
        EXISTS (
            SELECT 1 FROM services s
            WHERE s.id = p_service_id
            AND (s.auto_assign_staff = true OR u.id = ANY(s.assigned_staff))
        )
    )
    AND (
        -- Check regular availability pattern
        EXISTS (
            SELECT 1 FROM staff_availability_patterns sap
            WHERE sap.staff_id = u.id
            AND sap.day_of_week = appointment_dow
            AND sap.start_time <= appointment_start_time
            AND sap.end_time >= appointment_end_time
            AND sap.is_active = true
            AND (sap.effective_until IS NULL OR sap.effective_until >= appointment_date)
            AND sap.effective_from <= appointment_date
            AND (sap.service_ids IS NULL OR p_service_id = ANY(sap.service_ids))
        )
    )
    AND (
        -- Check no availability exceptions
        NOT EXISTS (
            SELECT 1 FROM staff_availability_exceptions sae
            WHERE sae.staff_id = u.id
            AND sae.exception_date = appointment_date
            AND sae.is_available = false
        )
    )
    AND (
        -- Check no booking conflicts
        NOT EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.staff_id = u.id
            AND b.appointment_time && p_appointment_time
            AND b.status_id NOT IN (
                SELECT id FROM booking_statuses WHERE name IN ('cancelled', 'no_show')
            )
        )
    );

    RETURN available_staff_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available time slots for a service
CREATE OR REPLACE FUNCTION get_available_time_slots(
    p_service_id UUID,
    p_date DATE,
    p_duration_minutes INTEGER DEFAULT NULL
)
RETURNS TABLE(
    slot_start TIMESTAMPTZ,
    slot_end TIMESTAMPTZ,
    available_staff_id UUID,
    staff_name TEXT
) AS $$
DECLARE
    service_duration INTEGER;
    slot_interval INTEGER := 30; -- 30-minute intervals
    day_start TIME := '09:00'::TIME;
    day_end TIME := '17:00'::TIME;
    current_slot_start TIMESTAMPTZ;
    current_slot_end TIMESTAMPTZ;
    staff_record RECORD;
BEGIN
    -- Get service duration
    SELECT COALESCE(duration_minutes, COALESCE(p_duration_minutes, 60))
    FROM services WHERE id = p_service_id INTO service_duration;

    -- Generate time slots for the day
    current_slot_start := p_date + day_start;

    WHILE (current_slot_start + (service_duration || ' minutes')::INTERVAL)::TIME <= day_end LOOP
        current_slot_end := current_slot_start + (service_duration || ' minutes')::INTERVAL;

        -- Check each staff member for availability
        FOR staff_record IN
            SELECT u.id, u.first_name || ' ' || u.last_name as name
            FROM users u
            WHERE u.role IN ('admin', 'staff')
            AND u.is_active = true
            AND (
                EXISTS (
                    SELECT 1 FROM services s
                    WHERE s.id = p_service_id
                    AND (s.auto_assign_staff = true OR u.id = ANY(s.assigned_staff))
                )
            )
        LOOP
            -- Check if this staff member is available for this slot
            IF check_staff_availability(p_service_id, tstzrange(current_slot_start, current_slot_end)) THEN
                slot_start := current_slot_start;
                slot_end := current_slot_end;
                available_staff_id := staff_record.id;
                staff_name := staff_record.name;
                RETURN NEXT;
            END IF;
        END LOOP;

        current_slot_start := current_slot_start + (slot_interval || ' minutes')::INTERVAL;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate booking number
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS VARCHAR(20) AS $$
BEGIN
    RETURN 'BK' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
           LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS AND AUTOMATION
-- =====================================================

-- Updated_at triggers
CREATE TRIGGER update_service_categories_updated_at
    BEFORE UPDATE ON service_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Booking state change trigger
CREATE OR REPLACE FUNCTION log_booking_state_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status_id != NEW.status_id THEN
        INSERT INTO booking_state_changes (
            booking_id,
            from_status_id,
            to_status_id,
            changed_by
        ) VALUES (
            NEW.id,
            OLD.status_id,
            NEW.status_id,
            NEW.updated_by
        );

        -- Update previous status
        NEW.previous_status_id := OLD.status_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_status_change_trigger
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION log_booking_state_change();

-- Auto-generate booking numbers
CREATE OR REPLACE FUNCTION set_booking_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.booking_number IS NULL OR NEW.booking_number = '' THEN
        NEW.booking_number := generate_booking_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_booking_number_trigger
    BEFORE INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION set_booking_number();

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON TABLE service_categories IS 'Hierarchical service categories with ltree support';
COMMENT ON TABLE services IS 'Enhanced services with role-based booking rules and flexible pricing';
COMMENT ON TABLE service_addons IS 'Service addon/package relationships';
COMMENT ON TABLE service_pricing_tiers IS 'Role-based pricing tiers for services';
COMMENT ON TABLE staff_availability_patterns IS 'Recurring availability patterns for staff members';
COMMENT ON TABLE staff_availability_exceptions IS 'Specific date availability exceptions';
COMMENT ON TABLE service_time_slots IS 'Predefined time slot templates for services';
COMMENT ON TABLE booking_statuses IS 'Booking workflow statuses with permissions';
COMMENT ON TABLE bookings IS 'Enhanced bookings with role-based features and conflict prevention';
COMMENT ON TABLE booking_addons IS 'Additional services added to bookings';
COMMENT ON TABLE booking_state_changes IS 'Audit trail of booking status changes';

COMMENT ON FUNCTION can_user_book_service IS 'Checks if user has permission to book a service at specified time';
COMMENT ON FUNCTION check_staff_availability IS 'Verifies staff availability for a time slot';
COMMENT ON FUNCTION get_available_time_slots IS 'Returns available booking slots for a service on a specific date';