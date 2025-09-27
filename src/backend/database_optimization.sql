-- Database Optimization Script for JLI Loctician Booking System
-- This script contains optimizations for performance and security

-- Performance Indexes
-- User table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active ON users (role, is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users (created_at);

-- Booking table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_loctician_id ON bookings (loctician_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_customer_id ON bookings (customer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_service_id ON bookings (service_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_appointment_date ON bookings (appointment_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_created_at ON bookings (created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_loctician_date ON bookings (loctician_id, appointment_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_customer_status ON bookings (customer_id, status);

-- Service table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_loctician_id ON services (loctician_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_is_active ON services (is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_category ON services (category);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_price ON services (price);

-- Availability table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_availability_loctician_id ON availability (loctician_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_availability_date ON availability (date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_availability_loctician_date ON availability (loctician_id, date);

-- Calendar events indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_events_user_id ON calendar_events (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_events_start_time ON calendar_events (start_time);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_events_user_start ON calendar_events (user_id, start_time);

-- Payment/Transaction indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_booking_id ON payments (booking_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status ON payments (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_created_at ON payments (created_at);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_search ON services
USING gin(to_tsvector('danish', name || ' ' || description));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_search ON users
USING gin(to_tsvector('danish', first_name || ' ' || last_name || ' ' || COALESCE(business_name, '')));

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_pending ON bookings (appointment_date, loctician_id)
WHERE status = 'pending';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_confirmed_future ON bookings (appointment_date, loctician_id)
WHERE status = 'confirmed' AND appointment_date >= CURRENT_DATE;

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_analytics ON bookings
(loctician_id, created_at, status, total_price)
WHERE status IN ('completed', 'confirmed');

-- Performance Views
-- Analytics views for better performance
CREATE OR REPLACE VIEW booking_analytics AS
SELECT
    loctician_id,
    DATE_TRUNC('month', appointment_date) as month,
    COUNT(*) as total_bookings,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
    SUM(total_price) FILTER (WHERE status = 'completed') as revenue,
    AVG(total_price) FILTER (WHERE status = 'completed') as avg_booking_value
FROM bookings
WHERE appointment_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY loctician_id, DATE_TRUNC('month', appointment_date);

-- Popular services view
CREATE OR REPLACE VIEW popular_services AS
SELECT
    s.id,
    s.name,
    s.loctician_id,
    COUNT(b.id) as booking_count,
    AVG(b.total_price) as avg_price,
    s.price as current_price
FROM services s
LEFT JOIN bookings b ON s.id = b.service_id
WHERE s.is_active = true
GROUP BY s.id, s.name, s.loctician_id, s.price
ORDER BY booking_count DESC;

-- Customer retention view
CREATE OR REPLACE VIEW customer_retention AS
SELECT
    customer_id,
    loctician_id,
    COUNT(*) as total_bookings,
    MIN(appointment_date) as first_booking,
    MAX(appointment_date) as last_booking,
    CASE
        WHEN COUNT(*) = 1 THEN 'new'
        WHEN MAX(appointment_date) >= CURRENT_DATE - INTERVAL '3 months' THEN 'active'
        WHEN MAX(appointment_date) >= CURRENT_DATE - INTERVAL '6 months' THEN 'at_risk'
        ELSE 'churned'
    END as status
FROM bookings
WHERE status IN ('completed', 'confirmed')
GROUP BY customer_id, loctician_id;

-- Database Maintenance Functions
-- Function to update table statistics
CREATE OR REPLACE FUNCTION update_table_stats()
RETURNS void AS $$
BEGIN
    ANALYZE users;
    ANALYZE bookings;
    ANALYZE services;
    ANALYZE availability;
    ANALYZE calendar_events;
    ANALYZE payments;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old audit logs (keep last 6 months)
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs
    WHERE created_at < CURRENT_DATE - INTERVAL '6 months';

    -- Update statistics after cleanup
    ANALYZE audit_logs;
END;
$$ LANGUAGE plpgsql;

-- Function to optimize database performance
CREATE OR REPLACE FUNCTION optimize_database()
RETURNS void AS $$
BEGIN
    -- Update statistics
    PERFORM update_table_stats();

    -- Clean up old data
    PERFORM cleanup_audit_logs();

    -- Reindex heavily used tables
    REINDEX TABLE CONCURRENTLY bookings;
    REINDEX TABLE CONCURRENTLY users;

    RAISE NOTICE 'Database optimization completed';
END;
$$ LANGUAGE plpgsql;

-- Scheduled maintenance (run weekly)
-- This should be added to a cron job or scheduled task
-- SELECT optimize_database();

-- Performance monitoring queries
-- Use these to monitor database performance

-- Find slow queries
CREATE OR REPLACE VIEW slow_queries AS
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE calls > 100
ORDER BY mean_time DESC
LIMIT 20;

-- Table size information
CREATE OR REPLACE VIEW table_sizes AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- Index usage statistics
CREATE OR REPLACE VIEW index_usage AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;

-- Security enhancements
-- Row Level Security policies (if not already implemented)

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Policies for user data access
CREATE POLICY user_own_data ON users
FOR ALL TO authenticated_users
USING (id = current_user_id());

CREATE POLICY loctician_bookings ON bookings
FOR ALL TO locticians
USING (loctician_id = current_user_id());

CREATE POLICY customer_bookings ON bookings
FOR SELECT TO customers
USING (customer_id = current_user_id());

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON bookings TO locticians;
GRANT SELECT ON bookings TO customers;
GRANT ALL ON services TO locticians;
GRANT SELECT ON services TO customers;

-- Performance settings recommendations
-- Add these to postgresql.conf for production

-- Memory settings
-- shared_buffers = 256MB
-- effective_cache_size = 1GB
-- work_mem = 64MB
-- maintenance_work_mem = 256MB

-- Checkpoint settings
-- checkpoint_completion_target = 0.9
-- wal_buffers = 16MB
-- default_statistics_target = 100

-- Connection settings
-- max_connections = 100
-- shared_preload_libraries = 'pg_stat_statements'

-- Logging settings for monitoring
-- log_statement = 'none'
-- log_min_duration_statement = 1000
-- log_checkpoints = on
-- log_connections = on
-- log_disconnections = on
-- log_lock_waits = on

COMMIT;