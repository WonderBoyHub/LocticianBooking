-- Migration 007: Seed Initial Data
-- PostgreSQL 17 Enhanced Authentication System
-- Created: 2025-09-26

-- Insert initial roles with proper hierarchy
INSERT INTO roles (name, description, priority) VALUES
    ('admin', 'System administrator with full access', 100),
    ('staff', 'Staff member with service management access', 50),
    ('customer', 'Regular customer with booking access', 10);

-- Insert comprehensive permissions
INSERT INTO permissions (name, resource, action, description) VALUES
    -- User management
    ('users.create', 'users', 'create', 'Create new user accounts'),
    ('users.read', 'users', 'read', 'View user information'),
    ('users.update', 'users', 'update', 'Update user information'),
    ('users.delete', 'users', 'delete', 'Delete user accounts'),
    ('users.manage_roles', 'users', 'manage_roles', 'Assign and revoke user roles'),

    -- Booking management
    ('bookings.create', 'bookings', 'create', 'Create new bookings'),
    ('bookings.read', 'bookings', 'read', 'View booking information'),
    ('bookings.update', 'bookings', 'update', 'Update booking details'),
    ('bookings.delete', 'bookings', 'delete', 'Cancel/delete bookings'),
    ('bookings.manage_all', 'bookings', 'manage_all', 'Manage all bookings system-wide'),

    -- Service management
    ('services.create', 'services', 'create', 'Create new services'),
    ('services.read', 'services', 'read', 'View service information'),
    ('services.update', 'services', 'update', 'Update service details'),
    ('services.delete', 'services', 'delete', 'Delete services'),

    -- Subscription management
    ('subscriptions.create', 'subscriptions', 'create', 'Create subscription plans'),
    ('subscriptions.read', 'subscriptions', 'read', 'View subscription information'),
    ('subscriptions.update', 'subscriptions', 'update', 'Update subscription details'),
    ('subscriptions.delete', 'subscriptions', 'delete', 'Delete subscription plans'),
    ('subscriptions.manage_user', 'subscriptions', 'manage_user', 'Manage user subscriptions'),

    -- Payment management
    ('payments.read', 'payments', 'read', 'View payment information'),
    ('payments.process', 'payments', 'process', 'Process payments'),
    ('payments.refund', 'payments', 'refund', 'Process refunds'),

    -- System administration
    ('system.admin', 'system', 'admin', 'Full system administration access'),
    ('reports.read', 'reports', 'read', 'View system reports'),
    ('reports.export', 'reports', 'export', 'Export system data');

-- Assign permissions to roles

-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin';

-- Staff gets service and booking management permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'staff' AND p.name IN (
    'users.read',
    'bookings.create', 'bookings.read', 'bookings.update', 'bookings.manage_all',
    'services.read',
    'subscriptions.read', 'subscriptions.manage_user',
    'payments.read',
    'reports.read'
);

-- Customer gets basic permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'customer' AND p.name IN (
    'bookings.create', 'bookings.read', 'bookings.update',
    'services.read',
    'subscriptions.read'
);

-- Insert booking statuses
INSERT INTO booking_statuses (name, description, sort_order) VALUES
    ('pending', 'Booking is pending confirmation', 1),
    ('confirmed', 'Booking is confirmed', 2),
    ('in_progress', 'Service is currently being provided', 3),
    ('completed', 'Service has been completed', 4),
    ('cancelled', 'Booking has been cancelled', 5),
    ('no_show', 'Customer did not show up for appointment', 6);

-- Insert subscription statuses
INSERT INTO subscription_statuses (name, description, is_active_status, sort_order) VALUES
    ('active', 'Subscription is active and current', true, 1),
    ('past_due', 'Payment is overdue but subscription still active', true, 2),
    ('cancelled', 'Subscription has been cancelled', false, 3),
    ('expired', 'Subscription has expired', false, 4),
    ('suspended', 'Subscription is temporarily suspended', false, 5);

-- Insert sample services
INSERT INTO services (name, description, duration_minutes, price, requires_subscription) VALUES
    ('Basic Consultation', 'Standard 30-minute consultation session', 30, 75.00, false),
    ('Extended Consultation', 'Comprehensive 60-minute consultation session', 60, 125.00, false),
    ('Premium Session', 'Premium 90-minute session with additional features', 90, 175.00, true),
    ('Group Session', 'Group consultation session (up to 4 people)', 60, 200.00, false),
    ('Express Service', 'Quick 15-minute express service', 15, 45.00, false);

-- Insert sample subscription plans
INSERT INTO subscription_plans (
    name, description, price, billing_interval, billing_interval_count,
    features, max_bookings_per_month, discount_percentage
) VALUES
    (
        'Basic Plan',
        'Perfect for occasional users',
        29.99, 'monthly', 1,
        '{"priority_booking": false, "discount_on_services": 10, "premium_support": false}',
        3, 10.00
    ),
    (
        'Professional Plan',
        'Ideal for regular users',
        79.99, 'monthly', 1,
        '{"priority_booking": true, "discount_on_services": 15, "premium_support": true, "access_to_premium": true}',
        8, 15.00
    ),
    (
        'Enterprise Plan',
        'Unlimited access for power users',
        199.99, 'monthly', 1,
        '{"priority_booking": true, "discount_on_services": 20, "premium_support": true, "access_to_premium": true, "unlimited_bookings": true}',
        NULL, 20.00
    ),
    (
        'Annual Basic',
        'Basic plan with annual billing discount',
        299.99, 'yearly', 1,
        '{"priority_booking": false, "discount_on_services": 10, "premium_support": false}',
        3, 10.00
    );

-- Create initial admin user
-- Note: This creates a user with email 'admin@company.com' and password 'AdminPass123!'
-- IMPORTANT: Change this password immediately in production!
INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    email_verified,
    is_active
) VALUES (
    uuid_generate_v4(),
    'admin@company.com',
    hash_password('AdminPass123!'),
    'System',
    'Administrator',
    true,
    true
);

-- Assign admin role to the initial admin user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'admin@company.com' AND r.name = 'admin';

-- Create sample staff user
INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    email_verified,
    is_active
) VALUES (
    uuid_generate_v4(),
    'staff@company.com',
    hash_password('StaffPass123!'),
    'Staff',
    'Member',
    true,
    true
);

-- Assign staff role to the staff user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'staff@company.com' AND r.name = 'staff';

-- Create sample customer user
INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    phone,
    email_verified,
    is_active
) VALUES (
    uuid_generate_v4(),
    'customer@example.com',
    hash_password('CustomerPass123!'),
    'John',
    'Doe',
    '+1-555-0123',
    true,
    true
);

-- Assign customer role to the customer user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'customer@example.com' AND r.name = 'customer';

-- Create a sample active subscription for the customer
INSERT INTO user_subscriptions (
    id,
    user_id,
    plan_id,
    status_id,
    current_period_start,
    current_period_end,
    next_billing_date,
    plan_price,
    discount_applied
)
SELECT
    uuid_generate_v4(),
    u.id,
    sp.id,
    ss.id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '1 month',
    CURRENT_TIMESTAMP + INTERVAL '1 month',
    sp.price,
    sp.discount_percentage
FROM users u, subscription_plans sp, subscription_statuses ss
WHERE u.email = 'customer@example.com'
  AND sp.name = 'Professional Plan'
  AND ss.name = 'active';

-- Create a sample booking for the customer
INSERT INTO bookings (
    id,
    user_id,
    service_id,
    booking_date,
    booking_time,
    duration_minutes,
    status_id,
    total_price,
    notes
)
SELECT
    uuid_generate_v4(),
    u.id,
    s.id,
    CURRENT_DATE + INTERVAL '3 days',
    '14:00:00',
    s.duration_minutes,
    bs.id,
    s.price * 0.85, -- 15% subscription discount
    'Sample booking created during system setup'
FROM users u, services s, booking_statuses bs
WHERE u.email = 'customer@example.com'
  AND s.name = 'Extended Consultation'
  AND bs.name = 'confirmed';

-- Create a sample guest booking
INSERT INTO bookings (
    id,
    user_id,
    guest_email,
    guest_first_name,
    guest_last_name,
    guest_phone,
    service_id,
    booking_date,
    booking_time,
    duration_minutes,
    status_id,
    total_price,
    notes
)
SELECT
    uuid_generate_v4(),
    NULL,
    'guest@example.com',
    'Jane',
    'Smith',
    '+1-555-0456',
    s.id,
    CURRENT_DATE + INTERVAL '5 days',
    '10:00:00',
    s.duration_minutes,
    bs.id,
    s.price,
    'Sample guest booking'
FROM services s, booking_statuses bs
WHERE s.name = 'Basic Consultation'
  AND bs.name = 'pending';

-- Comments for documentation
COMMENT ON TABLE roles IS 'Initial roles: admin (priority 100), staff (priority 50), customer (priority 10)';
COMMENT ON TABLE permissions IS 'Comprehensive permission system with resource.action naming convention';

-- Display initial setup information
DO $$
DECLARE
    admin_count INTEGER;
    service_count INTEGER;
    plan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM users WHERE email = 'admin@company.com';
    SELECT COUNT(*) INTO service_count FROM services WHERE is_active = true;
    SELECT COUNT(*) INTO plan_count FROM subscription_plans WHERE is_active = true;

    RAISE NOTICE 'Database initialization completed successfully!';
    RAISE NOTICE 'Created % admin user(s), % services, % subscription plans', admin_count, service_count, plan_count;
    RAISE NOTICE 'Default admin credentials: admin@company.com / AdminPass123!';
    RAISE NOTICE 'SECURITY WARNING: Change default passwords immediately!';
END $$;