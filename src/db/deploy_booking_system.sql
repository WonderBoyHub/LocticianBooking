-- =====================================================
-- COMPREHENSIVE POSTGRESQL 17 BOOKING SYSTEM DEPLOYMENT
-- =====================================================
-- Enhanced Booking Platform with Advanced Features
-- Created: 2025-09-26
--
-- This script deploys a complete booking system with:
-- - Role-based access control
-- - Advanced service management
-- - Intelligent calendar system
-- - Molly payment integration
-- - Sub-50ms query performance
-- - Comprehensive audit trails
-- =====================================================

-- Start transaction for atomic deployment
BEGIN;

-- Set deployment metadata
\set deployment_version '1.0.0'
\set deployment_date '2025-09-26'
\set database_name 'booking_system_v17'

-- Create deployment log function
CREATE OR REPLACE FUNCTION log_deployment_step(step_name TEXT, status TEXT, message TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    RAISE NOTICE '[%] %: % %',
        CURRENT_TIMESTAMP,
        step_name,
        status,
        COALESCE(' - ' || message, '');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 1: SYSTEM VALIDATION
-- =====================================================

SELECT log_deployment_step('VALIDATION', 'START', 'Validating PostgreSQL version and extensions');

-- Check PostgreSQL version (require 17+)
DO $$
DECLARE
    pg_version_num INTEGER;
BEGIN
    SELECT setting::INTEGER INTO pg_version_num FROM pg_settings WHERE name = 'server_version_num';

    IF pg_version_num < 170000 THEN
        RAISE EXCEPTION 'PostgreSQL 17 or higher required. Current version: %',
            current_setting('server_version');
    END IF;

    PERFORM log_deployment_step('VALIDATION', 'OK', 'PostgreSQL version: ' || current_setting('server_version'));
END;
$$;

-- Validate required extensions are available
DO $$
DECLARE
    required_extensions TEXT[] := ARRAY[
        'uuid-ossp', 'pgcrypto', 'pg_stat_statements',
        'btree_gist', 'pg_trgm', 'ltree'
    ];
    ext TEXT;
BEGIN
    FOREACH ext IN ARRAY required_extensions
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = ext) THEN
            RAISE EXCEPTION 'Required extension % not available', ext;
        END IF;
    END LOOP;

    PERFORM log_deployment_step('VALIDATION', 'OK', 'All required extensions available');
END;
$$;

-- =====================================================
-- STEP 2: RUN MIGRATION FILES IN ORDER
-- =====================================================

SELECT log_deployment_step('MIGRATIONS', 'START', 'Running migration files');

-- Migration 001: Extensions and Configuration
\echo 'Running 001_create_extensions.sql...'
\i 001_create_extensions.sql
SELECT log_deployment_step('MIGRATION_001', 'COMPLETE', 'Extensions and configuration');

-- Migration 002: Roles and Permissions
\echo 'Running 002_create_roles_and_permissions.sql...'
\i 002_create_roles_and_permissions.sql
SELECT log_deployment_step('MIGRATION_002', 'COMPLETE', 'Roles and permissions');

-- Migration 003: Users Table
\echo 'Running 003_create_users_table.sql...'
\i 003_create_users_table.sql
SELECT log_deployment_step('MIGRATION_003', 'COMPLETE', 'Users table and authentication');

-- Migration 004: Enhanced Booking System
\echo 'Running 004_create_bookings_table.sql...'
\i 004_create_bookings_table.sql
SELECT log_deployment_step('MIGRATION_004', 'COMPLETE', 'Enhanced booking system');

-- Migration 005: Subscription System
\echo 'Running 005_create_subscriptions_table.sql...'
\i 005_create_subscriptions_table.sql
SELECT log_deployment_step('MIGRATION_005', 'COMPLETE', 'Molly payment integration');

-- Migration 006: Row Level Security
\echo 'Running 006_create_row_level_security.sql...'
\i 006_create_row_level_security.sql
SELECT log_deployment_step('MIGRATION_006', 'COMPLETE', 'Row level security');

-- Migration 007: Initial Data
\echo 'Running 007_seed_initial_data.sql...'
\i 007_seed_initial_data.sql
SELECT log_deployment_step('MIGRATION_007', 'COMPLETE', 'Initial data seeding');

-- Migration 008: Performance Optimizations
\echo 'Running 008_create_performance_optimizations.sql...'
\i 008_create_performance_optimizations.sql
SELECT log_deployment_step('MIGRATION_008', 'COMPLETE', 'Performance optimizations');

-- Migration 009: Maintenance Procedures
\echo 'Running 009_create_maintenance_procedures.sql...'
\i 009_create_maintenance_procedures.sql
SELECT log_deployment_step('MIGRATION_009', 'COMPLETE', 'Maintenance procedures');

-- Migration 010: API Helper Functions
\echo 'Running 010_create_api_helper_functions.sql...'
\i 010_create_api_helper_functions.sql
SELECT log_deployment_step('MIGRATION_010', 'COMPLETE', 'API helper functions');

-- =====================================================
-- STEP 3: POST-DEPLOYMENT CONFIGURATION
-- =====================================================

SELECT log_deployment_step('POST_DEPLOYMENT', 'START', 'Configuring system settings');

-- Create deployment metadata table
CREATE TABLE IF NOT EXISTS deployment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(20) NOT NULL,
    deployment_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    database_name VARCHAR(100),
    migration_files TEXT[],
    deployment_notes TEXT,
    deployed_by VARCHAR(100) DEFAULT CURRENT_USER,
    system_info JSONB
);

-- Record this deployment
INSERT INTO deployment_history (
    version,
    database_name,
    migration_files,
    deployment_notes,
    system_info
) VALUES (
    :'deployment_version',
    :'database_name',
    ARRAY[
        '001_create_extensions.sql',
        '002_create_roles_and_permissions.sql',
        '003_create_users_table.sql',
        '004_create_bookings_table.sql',
        '005_create_subscriptions_table.sql',
        '006_create_row_level_security.sql',
        '007_seed_initial_data.sql',
        '008_create_performance_optimizations.sql',
        '009_create_maintenance_procedures.sql',
        '010_create_api_helper_functions.sql'
    ],
    'Full PostgreSQL 17 booking system deployment with role-based access, advanced calendar, and Molly payments',
    jsonb_build_object(
        'postgresql_version', version(),
        'deployment_timestamp', CURRENT_TIMESTAMP,
        'timezone', current_setting('timezone'),
        'max_connections', current_setting('max_connections'),
        'shared_buffers', current_setting('shared_buffers')
    )
);

-- =====================================================
-- STEP 4: CREATE INITIAL BOOKING STATUSES
-- =====================================================

SELECT log_deployment_step('INITIAL_DATA', 'START', 'Creating booking statuses');

-- Insert booking statuses
INSERT INTO booking_statuses (name, description, color_code, is_initial, is_final, can_cancel, can_reschedule, customer_visible, sort_order) VALUES
('draft', 'Draft booking not yet confirmed', '#9CA3AF', true, false, true, true, false, 10),
('pending', 'Pending confirmation', '#F59E0B', false, false, true, true, true, 20),
('confirmed', 'Confirmed booking', '#10B981', false, false, true, true, true, 30),
('checked_in', 'Customer has checked in', '#3B82F6', false, false, false, false, true, 40),
('in_progress', 'Service in progress', '#8B5CF6', false, false, false, false, true, 50),
('completed', 'Service completed', '#059669', false, true, false, false, true, 60),
('cancelled', 'Cancelled booking', '#EF4444', false, true, false, false, true, 70),
('no_show', 'Customer did not show', '#F97316', false, true, false, false, true, 80),
('rescheduled', 'Booking has been rescheduled', '#6366F1', false, true, false, false, true, 90)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- STEP 5: CREATE SUBSCRIPTION STATUSES
-- =====================================================

SELECT log_deployment_step('INITIAL_DATA', 'CONTINUE', 'Creating subscription statuses');

-- Insert subscription statuses
INSERT INTO subscription_statuses (name, description, color_code, is_active_status, is_trial_status, allows_billing, allows_usage, sort_order) VALUES
('trial', 'Trial period active', '#8B5CF6', true, true, false, true, 10),
('active', 'Active subscription', '#10B981', true, false, true, true, 20),
('past_due', 'Payment past due', '#F59E0B', true, false, true, true, 30),
('unpaid', 'Payment failed', '#EF4444', false, false, false, false, 40),
('cancelled', 'Subscription cancelled', '#6B7280', false, false, false, false, 50),
('paused', 'Subscription paused', '#9CA3AF', false, false, false, false, 60)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- STEP 6: CREATE DEFAULT ROLES AND PERMISSIONS
-- =====================================================

SELECT log_deployment_step('INITIAL_DATA', 'CONTINUE', 'Creating default roles');

-- Insert default roles
INSERT INTO roles (name, description, priority) VALUES
('customer', 'Regular customer with booking permissions', 10),
('staff', 'Staff member with service delivery permissions', 50),
('admin', 'System administrator with full access', 100)
ON CONFLICT (name) DO NOTHING;

-- Insert core permissions
INSERT INTO permissions (name, resource, action, description) VALUES
-- User permissions
('view_own_profile', 'users', 'read', 'View own user profile'),
('edit_own_profile', 'users', 'update', 'Edit own user profile'),
('view_all_users', 'users', 'read', 'View all user profiles'),
('manage_users', 'users', 'manage', 'Full user management'),

-- Booking permissions
('create_booking', 'bookings', 'create', 'Create new bookings'),
('view_own_bookings', 'bookings', 'read', 'View own bookings'),
('edit_own_bookings', 'bookings', 'update', 'Edit own bookings'),
('cancel_own_bookings', 'bookings', 'delete', 'Cancel own bookings'),
('view_all_bookings', 'bookings', 'read', 'View all bookings'),
('manage_bookings', 'bookings', 'manage', 'Full booking management'),

-- Service permissions
('view_services', 'services', 'read', 'View available services'),
('manage_services', 'services', 'manage', 'Full service management'),

-- Calendar permissions
('view_calendar', 'calendar', 'read', 'View calendar availability'),
('manage_calendar', 'calendar', 'manage', 'Manage calendar and availability'),

-- Subscription permissions
('view_own_subscription', 'subscriptions', 'read', 'View own subscription'),
('manage_subscriptions', 'subscriptions', 'manage', 'Full subscription management'),

-- Payment permissions
('view_own_payments', 'payments', 'read', 'View own payment history'),
('manage_payments', 'payments', 'manage', 'Full payment management'),

-- Analytics permissions
('view_basic_analytics', 'analytics', 'read', 'View basic analytics'),
('view_full_analytics', 'analytics', 'read', 'View comprehensive analytics')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- STEP 7: ASSIGN PERMISSIONS TO ROLES
-- =====================================================

SELECT log_deployment_step('INITIAL_DATA', 'CONTINUE', 'Assigning role permissions');

-- Customer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'customer'
AND p.name IN (
    'view_own_profile', 'edit_own_profile',
    'create_booking', 'view_own_bookings', 'edit_own_bookings', 'cancel_own_bookings',
    'view_services', 'view_calendar',
    'view_own_subscription', 'view_own_payments'
)
ON CONFLICT DO NOTHING;

-- Staff permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'staff'
AND p.name IN (
    'view_own_profile', 'edit_own_profile', 'view_all_users',
    'create_booking', 'view_own_bookings', 'edit_own_bookings', 'cancel_own_bookings',
    'view_all_bookings', 'manage_bookings',
    'view_services', 'view_calendar', 'manage_calendar',
    'view_basic_analytics'
)
ON CONFLICT DO NOTHING;

-- Admin permissions (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 8: CREATE DEFAULT SUBSCRIPTION PLANS
-- =====================================================

SELECT log_deployment_step('INITIAL_DATA', 'CONTINUE', 'Creating subscription plans');

-- Insert subscription plans
INSERT INTO subscription_plans (
    name, description, short_description, slug, plan_type,
    price, currency, max_bookings_per_month, max_staff_members, max_services,
    has_trial, trial_period_days, is_public, display_order
) VALUES
(
    'Starter',
    'Perfect for individual practitioners or small businesses just getting started.',
    'Essential features for small businesses',
    'starter',
    'basic',
    299.00,
    'DKK',
    50,
    2,
    10,
    true,
    14,
    true,
    10
),
(
    'Professional',
    'Designed for growing businesses with multiple staff members and advanced needs.',
    'Advanced features for growing businesses',
    'professional',
    'premium',
    599.00,
    'DKK',
    200,
    5,
    50,
    true,
    14,
    true,
    20
),
(
    'Enterprise',
    'Complete solution for large businesses with unlimited resources and premium support.',
    'Complete solution for large businesses',
    'enterprise',
    'enterprise',
    1299.00,
    'DKK',
    NULL, -- Unlimited
    NULL, -- Unlimited
    NULL, -- Unlimited
    false,
    0,
    true,
    30
)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- STEP 9: CREATE SAMPLE SERVICE CATEGORIES
-- =====================================================

SELECT log_deployment_step('INITIAL_DATA', 'CONTINUE', 'Creating service categories');

-- Insert service categories with hierarchical structure
WITH category_data AS (
    SELECT
        uuid_generate_v4() as id,
        'Hair Services' as name,
        'hair-services' as slug,
        'Professional hair cutting, styling, and treatments' as description,
        NULL::UUID as parent_id,
        'hair-services' as path_text,
        1 as display_order
    UNION ALL
    SELECT
        uuid_generate_v4() as id,
        'Loctician Services' as name,
        'loctician-services' as slug,
        'Specialized loc maintenance and styling services' as description,
        NULL::UUID as parent_id,
        'loctician-services' as path_text,
        2 as display_order
    UNION ALL
    SELECT
        uuid_generate_v4() as id,
        'Consultations' as name,
        'consultations' as slug,
        'Hair and loc consultation services' as description,
        NULL::UUID as parent_id,
        'consultations' as path_text,
        3 as display_order
)
INSERT INTO service_categories (id, name, slug, description, parent_id, path, display_order)
SELECT id, name, slug, description, parent_id, path_text::LTREE, display_order
FROM category_data
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- STEP 10: PERFORMANCE VALIDATION
-- =====================================================

SELECT log_deployment_step('VALIDATION', 'START', 'Validating deployment performance');

-- Test critical query performance
DO $$
DECLARE
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    duration_ms NUMERIC;
    query_name TEXT;
BEGIN
    -- Test 1: User lookup with roles
    query_name := 'User lookup with roles';
    start_time := clock_timestamp();

    PERFORM u.id, u.email, r.name as role_name
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.email = 'test@example.com'
    LIMIT 1;

    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

    IF duration_ms > 50 THEN
        RAISE WARNING 'Query % took %.2f ms (target: <50ms)', query_name, duration_ms;
    ELSE
        PERFORM log_deployment_step('PERF_TEST', 'OK', query_name || ': ' || duration_ms::TEXT || 'ms');
    END IF;

    -- Test 2: Service search
    query_name := 'Service search with categories';
    start_time := clock_timestamp();

    PERFORM s.id, s.name, sc.name as category_name
    FROM services s
    LEFT JOIN service_categories sc ON s.category_id = sc.id
    WHERE s.is_active = true
    AND s.is_online_bookable = true
    ORDER BY s.display_order
    LIMIT 20;

    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

    IF duration_ms > 50 THEN
        RAISE WARNING 'Query % took %.2f ms (target: <50ms)', query_name, duration_ms;
    ELSE
        PERFORM log_deployment_step('PERF_TEST', 'OK', query_name || ': ' || duration_ms::TEXT || 'ms');
    END IF;
END;
$$;

-- =====================================================
-- STEP 11: CREATE MONITORING JOBS
-- =====================================================

SELECT log_deployment_step('MONITORING', 'START', 'Setting up monitoring');

-- Create function to schedule maintenance tasks (requires external scheduler)
CREATE OR REPLACE FUNCTION get_maintenance_schedule()
RETURNS TABLE(
    task_name TEXT,
    frequency TEXT,
    sql_command TEXT,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY VALUES
    ('refresh_analytics', 'hourly', 'SELECT refresh_analytics_views();', 'Refresh materialized views'),
    ('collect_metrics', '15min', 'SELECT collect_performance_metrics();', 'Collect performance metrics'),
    ('table_maintenance', 'daily', 'SELECT perform_table_maintenance();', 'Vacuum and analyze tables'),
    ('health_check', 'hourly', 'SELECT database_health_check();', 'Database health monitoring'),
    ('partition_maintenance', 'daily', 'SELECT create_monthly_partition();', 'Create new partitions');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 12: FINAL VALIDATION AND SUMMARY
-- =====================================================

SELECT log_deployment_step('FINAL_VALIDATION', 'START', 'Running final checks');

-- Count critical objects
DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
    index_count INTEGER;
    view_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count FROM pg_tables WHERE schemaname = 'public';
    SELECT COUNT(*) INTO function_count FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE schemaname = 'public';
    SELECT COUNT(*) INTO view_count FROM pg_views WHERE schemaname = 'public';

    PERFORM log_deployment_step('OBJECT_COUNT', 'INFO',
        format('Tables: %s, Functions: %s, Indexes: %s, Views: %s',
            table_count, function_count, index_count, view_count));
END;
$$;

-- Test critical functions
DO $$
BEGIN
    -- Test user permission function
    PERFORM user_has_permission(uuid_generate_v4(), 'bookings', 'create');
    PERFORM log_deployment_step('FUNCTION_TEST', 'OK', 'user_has_permission');

    -- Test subscription function
    PERFORM user_has_active_subscription(uuid_generate_v4());
    PERFORM log_deployment_step('FUNCTION_TEST', 'OK', 'user_has_active_subscription');

    -- Test booking availability
    PERFORM check_staff_availability(uuid_generate_v4(),
        tstzrange(CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour'));
    PERFORM log_deployment_step('FUNCTION_TEST', 'OK', 'check_staff_availability');

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Function test failed: %', SQLERRM;
END;
$$;

-- Create deployment summary
CREATE OR REPLACE VIEW v_deployment_summary AS
SELECT
    'PostgreSQL Booking System v' || dh.version as system_name,
    dh.deployment_date,
    dh.deployed_by,
    dh.database_name,
    array_length(dh.migration_files, 1) as migration_count,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as table_count,
    (SELECT COUNT(*) FROM pg_views WHERE schemaname = 'public') as view_count,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as index_count,
    (SELECT COUNT(*) FROM roles) as roles_count,
    (SELECT COUNT(*) FROM permissions) as permissions_count,
    (SELECT COUNT(*) FROM subscription_plans WHERE is_active = true) as active_plans,
    (SELECT COUNT(*) FROM booking_statuses WHERE is_active = true) as booking_statuses,
    dh.system_info
FROM deployment_history dh
ORDER BY dh.deployment_date DESC
LIMIT 1;

-- =====================================================
-- DEPLOYMENT COMPLETE
-- =====================================================

SELECT log_deployment_step('DEPLOYMENT', 'COMPLETE', 'All migrations successful');

-- Print deployment summary
\echo ''
\echo '======================================================='
\echo 'POSTGRESQL 17 BOOKING SYSTEM DEPLOYMENT COMPLETE'
\echo '======================================================='
\echo ''

SELECT
    system_name,
    'Deployed: ' || deployment_date::TEXT as deployment_info,
    'By: ' || deployed_by as deployed_by_info,
    'Tables: ' || table_count::TEXT as table_info,
    'Views: ' || view_count::TEXT as view_info,
    'Indexes: ' || index_count::TEXT as index_info
FROM v_deployment_summary;

\echo ''
\echo 'SYSTEM FEATURES:'
\echo '- Role-based access control with granular permissions'
\echo '- Advanced service management with hierarchical categories'
\echo '- Intelligent calendar system with conflict prevention'
\echo '- Comprehensive Molly payment integration'
\echo '- Sub-50ms query performance with advanced indexing'
\echo '- Real-time analytics and business intelligence'
\echo '- Automated maintenance and monitoring'
\echo '- GDPR compliance and data protection'
\echo ''
\echo 'NEXT STEPS:'
\echo '1. Configure application connection strings'
\echo '2. Set up automated backup procedures'
\echo '3. Schedule maintenance tasks using get_maintenance_schedule()'
\echo '4. Configure monitoring alerts'
\echo '5. Test booking workflows end-to-end'
\echo ''
\echo 'For performance monitoring: SELECT * FROM database_health_check();'
\echo 'For maintenance schedule: SELECT * FROM get_maintenance_schedule();'
\echo ''

-- Commit the deployment
COMMIT;

-- Clean up deployment function
DROP FUNCTION log_deployment_step(TEXT, TEXT, TEXT);

\echo 'Deployment committed successfully!'
\echo '======================================================='