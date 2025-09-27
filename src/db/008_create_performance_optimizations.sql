-- Migration 008: Advanced Performance Optimizations
-- PostgreSQL 17 High-Performance Booking Platform
-- Created: 2025-09-26
-- Sub-50ms query performance optimizations and monitoring

-- =====================================================
-- ADVANCED INDEXING STRATEGIES
-- =====================================================

-- Covering indexes for hot queries (PostgreSQL 17 optimized)
CREATE INDEX CONCURRENTLY idx_users_active_covering ON users (id, email)
INCLUDE (first_name, last_name, role, is_active, last_login_at)
WHERE is_active = true;

CREATE INDEX CONCURRENTLY idx_bookings_upcoming_covering ON bookings (staff_id, lower(appointment_time))
INCLUDE (customer_id, service_id, status_id, total_price, booking_number)
WHERE lower(appointment_time) > CURRENT_TIMESTAMP;

CREATE INDEX CONCURRENTLY idx_services_active_search ON services (is_active, is_online_bookable)
INCLUDE (name, slug, base_price, duration_minutes, category_id)
WHERE is_active = true AND is_online_bookable = true;

-- Partial indexes for common business queries
CREATE INDEX CONCURRENTLY idx_subscriptions_active_billing ON user_subscriptions (user_id, next_billing_date)
WHERE status_id IN (SELECT id FROM subscription_statuses WHERE is_active_status = true)
AND next_billing_date IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_bookings_today_staff ON bookings (staff_id, status_id)
WHERE booking_date = CURRENT_DATE;

CREATE INDEX CONCURRENTLY idx_payment_failed_retry ON payment_transactions (created_at, molly_payment_intent_id)
WHERE status = 'failed' AND created_at > CURRENT_DATE - INTERVAL '7 days';

-- Composite indexes for complex availability queries
CREATE INDEX CONCURRENTLY idx_staff_availability_lookup ON staff_availability_patterns (staff_id, day_of_week, is_active)
INCLUDE (start_time, end_time, service_ids)
WHERE is_active = true;

CREATE INDEX CONCURRENTLY idx_booking_conflicts ON bookings USING GIST (staff_id, appointment_time)
WHERE status_id NOT IN (SELECT id FROM booking_statuses WHERE name IN ('cancelled', 'no_show'));

-- Hash indexes for exact match lookups (PostgreSQL 17 improvement)
CREATE INDEX CONCURRENTLY idx_booking_number_hash ON bookings USING HASH (booking_number);
CREATE INDEX CONCURRENTLY idx_molly_subscription_hash ON user_subscriptions USING HASH (molly_subscription_id)
WHERE molly_subscription_id IS NOT NULL;

-- =====================================================
-- PERFORMANCE MONITORING VIEWS
-- =====================================================

-- Real-time booking dashboard view
CREATE VIEW v_booking_dashboard AS
SELECT
    DATE(lower(b.appointment_time)) as booking_date,
    s.name as service_name,
    sc.name as category_name,
    staff.first_name || ' ' || staff.last_name as staff_name,
    customer.first_name || ' ' || customer.last_name as customer_name,
    b.booking_number,
    b.total_price,
    bs.name as status,
    bs.color_code as status_color,
    EXTRACT(EPOCH FROM (lower(b.appointment_time) - CURRENT_TIMESTAMP))/3600 as hours_until_appointment,
    b.appointment_time,
    b.created_at
FROM bookings b
JOIN services s ON b.service_id = s.id
LEFT JOIN service_categories sc ON s.category_id = sc.id
JOIN users staff ON b.staff_id = staff.id
JOIN users customer ON b.customer_id = customer.id
JOIN booking_statuses bs ON b.status_id = bs.id
WHERE lower(b.appointment_time) >= CURRENT_DATE
AND lower(b.appointment_time) <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY b.appointment_time;

-- Staff utilization analytics
CREATE VIEW v_staff_utilization AS
WITH staff_hours AS (
    SELECT
        sap.staff_id,
        sap.day_of_week,
        EXTRACT(EPOCH FROM (sap.end_time - sap.start_time))/3600 as available_hours_per_day
    FROM staff_availability_patterns sap
    WHERE sap.is_active = true
),
booking_hours AS (
    SELECT
        b.staff_id,
        EXTRACT(DOW FROM lower(b.appointment_time)) as day_of_week,
        DATE(lower(b.appointment_time)) as booking_date,
        SUM(b.duration_minutes)/60.0 as booked_hours
    FROM bookings b
    WHERE lower(b.appointment_time) >= CURRENT_DATE - INTERVAL '30 days'
    AND b.status_id NOT IN (SELECT id FROM booking_statuses WHERE name IN ('cancelled', 'no_show'))
    GROUP BY b.staff_id, EXTRACT(DOW FROM lower(b.appointment_time)), DATE(lower(b.appointment_time))
)
SELECT
    u.id as staff_id,
    u.first_name || ' ' || u.last_name as staff_name,
    ROUND(AVG(sh.available_hours_per_day), 2) as avg_available_hours_per_day,
    ROUND(AVG(COALESCE(bh.booked_hours, 0)), 2) as avg_booked_hours_per_day,
    ROUND((AVG(COALESCE(bh.booked_hours, 0)) / NULLIF(AVG(sh.available_hours_per_day), 0)) * 100, 2) as utilization_percentage,
    COUNT(DISTINCT bh.booking_date) as days_with_bookings,
    SUM(COALESCE(bh.booked_hours, 0)) as total_booked_hours_30_days
FROM users u
JOIN staff_hours sh ON u.id = sh.staff_id
LEFT JOIN booking_hours bh ON u.id = bh.staff_id AND sh.day_of_week = bh.day_of_week
WHERE u.role IN ('admin', 'staff') AND u.is_active = true
GROUP BY u.id, u.first_name, u.last_name
ORDER BY utilization_percentage DESC;

-- Revenue analytics view
CREATE VIEW v_revenue_analytics AS
WITH daily_revenue AS (
    SELECT
        DATE(b.created_at) as revenue_date,
        COUNT(*) as bookings_count,
        SUM(b.total_price) as total_revenue,
        SUM(b.base_price) as service_revenue,
        SUM(b.addon_total) as addon_revenue,
        AVG(b.total_price) as avg_booking_value,
        COUNT(DISTINCT b.customer_id) as unique_customers
    FROM bookings b
    WHERE b.status_id NOT IN (SELECT id FROM booking_statuses WHERE name IN ('cancelled', 'no_show'))
    AND b.created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(b.created_at)
),
subscription_revenue AS (
    SELECT
        DATE(pt.created_at) as revenue_date,
        COUNT(*) as subscription_transactions,
        SUM(pt.amount) as subscription_revenue
    FROM payment_transactions pt
    WHERE pt.transaction_type = 'subscription_charge'
    AND pt.status = 'succeeded'
    AND pt.created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(pt.created_at)
)
SELECT
    COALESCE(dr.revenue_date, sr.revenue_date) as revenue_date,
    COALESCE(dr.bookings_count, 0) as bookings_count,
    COALESCE(dr.total_revenue, 0) as booking_revenue,
    COALESCE(sr.subscription_revenue, 0) as subscription_revenue,
    COALESCE(dr.total_revenue, 0) + COALESCE(sr.subscription_revenue, 0) as total_revenue,
    COALESCE(dr.avg_booking_value, 0) as avg_booking_value,
    COALESCE(dr.unique_customers, 0) as unique_customers,
    COALESCE(sr.subscription_transactions, 0) as subscription_transactions
FROM daily_revenue dr
FULL OUTER JOIN subscription_revenue sr ON dr.revenue_date = sr.revenue_date
ORDER BY COALESCE(dr.revenue_date, sr.revenue_date) DESC;

-- Service popularity analytics
CREATE VIEW v_service_popularity AS
WITH service_stats AS (
    SELECT
        s.id,
        s.name,
        s.base_price,
        sc.name as category_name,
        COUNT(b.id) as total_bookings,
        COUNT(b.id) FILTER (WHERE b.created_at >= CURRENT_DATE - INTERVAL '30 days') as bookings_last_30_days,
        COUNT(b.id) FILTER (WHERE b.created_at >= CURRENT_DATE - INTERVAL '7 days') as bookings_last_7_days,
        SUM(b.total_price) as total_revenue,
        AVG(b.total_price) as avg_revenue_per_booking,
        COUNT(DISTINCT b.customer_id) as unique_customers,
        AVG(b.duration_minutes) as avg_duration_minutes
    FROM services s
    LEFT JOIN service_categories sc ON s.category_id = sc.id
    LEFT JOIN bookings b ON s.id = b.service_id
        AND b.status_id NOT IN (SELECT id FROM booking_statuses WHERE name IN ('cancelled', 'no_show'))
    WHERE s.is_active = true
    GROUP BY s.id, s.name, s.base_price, sc.name
)
SELECT
    *,
    RANK() OVER (ORDER BY total_bookings DESC) as popularity_rank,
    RANK() OVER (ORDER BY total_revenue DESC) as revenue_rank,
    CASE
        WHEN bookings_last_7_days > 0 THEN 'Hot'
        WHEN bookings_last_30_days > 0 THEN 'Active'
        WHEN total_bookings > 0 THEN 'Cold'
        ELSE 'Unused'
    END as service_temperature
FROM service_stats
ORDER BY total_bookings DESC;

-- =====================================================
-- MATERIALIZED VIEWS FOR HEAVY ANALYTICS
-- =====================================================

-- Daily business metrics (refreshed hourly)
CREATE MATERIALIZED VIEW mv_daily_business_metrics AS
WITH daily_data AS (
    SELECT
        d.date_value as metric_date,
        COALESCE(booking_stats.bookings_count, 0) as bookings_count,
        COALESCE(booking_stats.booking_revenue, 0) as booking_revenue,
        COALESCE(subscription_stats.new_subscriptions, 0) as new_subscriptions,
        COALESCE(subscription_stats.subscription_revenue, 0) as subscription_revenue,
        COALESCE(user_stats.new_users, 0) as new_users,
        COALESCE(user_stats.active_users, 0) as active_users
    FROM (
        SELECT generate_series(
            CURRENT_DATE - INTERVAL '365 days',
            CURRENT_DATE,
            INTERVAL '1 day'
        )::DATE as date_value
    ) d
    LEFT JOIN (
        SELECT
            DATE(created_at) as date_value,
            COUNT(*) as bookings_count,
            SUM(total_price) as booking_revenue
        FROM bookings
        WHERE status_id NOT IN (SELECT id FROM booking_statuses WHERE name IN ('cancelled', 'no_show'))
        AND created_at >= CURRENT_DATE - INTERVAL '365 days'
        GROUP BY DATE(created_at)
    ) booking_stats ON d.date_value = booking_stats.date_value
    LEFT JOIN (
        SELECT
            DATE(created_at) as date_value,
            COUNT(*) as new_subscriptions,
            SUM(plan_price) as subscription_revenue
        FROM user_subscriptions
        WHERE created_at >= CURRENT_DATE - INTERVAL '365 days'
        GROUP BY DATE(created_at)
    ) subscription_stats ON d.date_value = subscription_stats.date_value
    LEFT JOIN (
        SELECT
            DATE(created_at) as date_value,
            COUNT(*) as new_users,
            COUNT(*) FILTER (WHERE last_login_at >= CURRENT_DATE - INTERVAL '30 days') as active_users
        FROM users
        WHERE created_at >= CURRENT_DATE - INTERVAL '365 days'
        GROUP BY DATE(created_at)
    ) user_stats ON d.date_value = user_stats.date_value
)
SELECT
    metric_date,
    bookings_count,
    booking_revenue,
    new_subscriptions,
    subscription_revenue,
    booking_revenue + subscription_revenue as total_revenue,
    new_users,
    active_users,
    -- 7-day moving averages
    AVG(bookings_count) OVER (ORDER BY metric_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as avg_7d_bookings,
    AVG(booking_revenue) OVER (ORDER BY metric_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as avg_7d_revenue,
    AVG(new_users) OVER (ORDER BY metric_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as avg_7d_new_users,
    -- Month-over-month growth
    LAG(booking_revenue, 30) OVER (ORDER BY metric_date) as revenue_30d_ago,
    CASE
        WHEN LAG(booking_revenue, 30) OVER (ORDER BY metric_date) > 0 THEN
            ROUND(((booking_revenue - LAG(booking_revenue, 30) OVER (ORDER BY metric_date)) /
                   LAG(booking_revenue, 30) OVER (ORDER BY metric_date)) * 100, 2)
        ELSE NULL
    END as revenue_growth_30d_pct
FROM daily_data
ORDER BY metric_date DESC;

-- Unique index for faster lookups
CREATE UNIQUE INDEX idx_mv_daily_business_metrics_date ON mv_daily_business_metrics (metric_date);

-- Customer lifetime value materialized view
CREATE MATERIALIZED VIEW mv_customer_lifetime_value AS
WITH customer_metrics AS (
    SELECT
        c.id as customer_id,
        c.first_name || ' ' || c.last_name as customer_name,
        c.email,
        c.created_at as registration_date,
        COUNT(b.id) as total_bookings,
        SUM(b.total_price) as total_spent,
        AVG(b.total_price) as avg_booking_value,
        MIN(b.created_at) as first_booking_date,
        MAX(b.created_at) as last_booking_date,
        COUNT(DISTINCT DATE(b.created_at)) as booking_days,
        COUNT(DISTINCT s.id) as unique_services_used,
        EXTRACT(DAYS FROM (MAX(b.created_at) - MIN(b.created_at))) as customer_lifespan_days,
        COUNT(b.id) FILTER (WHERE b.created_at >= CURRENT_DATE - INTERVAL '90 days') as bookings_last_90_days,
        SUM(b.total_price) FILTER (WHERE b.created_at >= CURRENT_DATE - INTERVAL '90 days') as spent_last_90_days
    FROM users c
    LEFT JOIN bookings b ON c.id = b.customer_id
        AND b.status_id NOT IN (SELECT id FROM booking_statuses WHERE name IN ('cancelled', 'no_show'))
    LEFT JOIN services s ON b.service_id = s.id
    WHERE c.role = 'customer'
    GROUP BY c.id, c.first_name, c.last_name, c.email, c.created_at
)
SELECT
    *,
    CASE
        WHEN customer_lifespan_days > 0 THEN total_spent / NULLIF(customer_lifespan_days, 0) * 365
        ELSE total_spent
    END as estimated_annual_value,
    CASE
        WHEN total_bookings = 0 THEN 'No Bookings'
        WHEN bookings_last_90_days > 0 THEN 'Active'
        WHEN last_booking_date >= CURRENT_DATE - INTERVAL '180 days' THEN 'At Risk'
        ELSE 'Churned'
    END as customer_segment,
    NTILE(5) OVER (ORDER BY total_spent DESC) as value_quintile
FROM customer_metrics
ORDER BY total_spent DESC;

-- Unique index for customer CLV lookups
CREATE UNIQUE INDEX idx_mv_customer_ltv_id ON mv_customer_lifetime_value (customer_id);

-- =====================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- =====================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS TABLE(view_name TEXT, refresh_duration INTERVAL, rows_affected BIGINT) AS $$
DECLARE
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    rows_count BIGINT;
BEGIN
    -- Refresh daily business metrics
    start_time := CURRENT_TIMESTAMP;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_business_metrics;
    end_time := CURRENT_TIMESTAMP;
    GET DIAGNOSTICS rows_count = ROW_COUNT;

    view_name := 'mv_daily_business_metrics';
    refresh_duration := end_time - start_time;
    rows_affected := rows_count;
    RETURN NEXT;

    -- Refresh customer lifetime value
    start_time := CURRENT_TIMESTAMP;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_lifetime_value;
    end_time := CURRENT_TIMESTAMP;
    GET DIAGNOSTICS rows_count = ROW_COUNT;

    view_name := 'mv_customer_lifetime_value';
    refresh_duration := end_time - start_time;
    rows_affected := rows_count;
    RETURN NEXT;

    -- Log refresh completion
    INSERT INTO system_logs (log_type, message, metadata)
    VALUES ('analytics', 'Materialized views refreshed', jsonb_build_object(
        'refresh_time', CURRENT_TIMESTAMP,
        'views_refreshed', ARRAY['mv_daily_business_metrics', 'mv_customer_lifetime_value']
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Advanced query performance analysis
CREATE OR REPLACE FUNCTION analyze_query_performance()
RETURNS TABLE(
    query_hash TEXT,
    normalized_query TEXT,
    calls BIGINT,
    total_time_ms NUMERIC,
    mean_time_ms NUMERIC,
    max_time_ms NUMERIC,
    stddev_time_ms NUMERIC,
    rows_per_call NUMERIC,
    cache_hit_ratio NUMERIC,
    performance_grade CHAR(1)
) AS $$
BEGIN
    RETURN QUERY
    WITH query_stats AS (
        SELECT
            encode(sha256(query::bytea), 'hex') as query_hash,
            LEFT(query, 100) || CASE WHEN LENGTH(query) > 100 THEN '...' ELSE '' END as normalized_query,
            calls,
            total_exec_time as total_time_ms,
            mean_exec_time as mean_time_ms,
            max_exec_time as max_time_ms,
            stddev_exec_time as stddev_time_ms,
            CASE WHEN calls > 0 THEN rows::NUMERIC / calls ELSE 0 END as rows_per_call,
            CASE
                WHEN shared_blks_hit + shared_blks_read > 0
                THEN shared_blks_hit::NUMERIC / (shared_blks_hit + shared_blks_read) * 100
                ELSE 0
            END as cache_hit_ratio
        FROM pg_stat_statements
        WHERE calls > 10  -- Only analyze queries called multiple times
    )
    SELECT
        qs.*,
        CASE
            WHEN qs.mean_time_ms < 10 THEN 'A'
            WHEN qs.mean_time_ms < 50 THEN 'B'
            WHEN qs.mean_time_ms < 200 THEN 'C'
            WHEN qs.mean_time_ms < 1000 THEN 'D'
            ELSE 'F'
        END as performance_grade
    FROM query_stats qs
    ORDER BY qs.total_time_ms DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Database health check function
CREATE OR REPLACE FUNCTION database_health_check()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    value NUMERIC,
    threshold NUMERIC,
    message TEXT
) AS $$
DECLARE
    active_connections INTEGER;
    cache_hit_ratio NUMERIC;
    avg_query_time NUMERIC;
    table_bloat NUMERIC;
BEGIN
    -- Connection count check
    SELECT COUNT(*) INTO active_connections FROM pg_stat_activity WHERE state = 'active';
    check_name := 'Active Connections';
    status := CASE WHEN active_connections < 50 THEN 'OK' WHEN active_connections < 100 THEN 'WARNING' ELSE 'CRITICAL' END;
    value := active_connections;
    threshold := 50;
    message := format('Currently %s active connections', active_connections);
    RETURN NEXT;

    -- Cache hit ratio check
    SELECT
        CASE WHEN sum(heap_blks_hit + heap_blks_read) = 0 THEN 0
        ELSE sum(heap_blks_hit) / sum(heap_blks_hit + heap_blks_read) * 100 END
    INTO cache_hit_ratio
    FROM pg_statio_user_tables;

    check_name := 'Buffer Cache Hit Ratio';
    status := CASE WHEN cache_hit_ratio > 95 THEN 'OK' WHEN cache_hit_ratio > 90 THEN 'WARNING' ELSE 'CRITICAL' END;
    value := cache_hit_ratio;
    threshold := 95;
    message := format('Cache hit ratio is %.2f%%', cache_hit_ratio);
    RETURN NEXT;

    -- Average query time check
    SELECT COALESCE(AVG(mean_exec_time), 0) INTO avg_query_time FROM pg_stat_statements;
    check_name := 'Average Query Time';
    status := CASE WHEN avg_query_time < 50 THEN 'OK' WHEN avg_query_time < 200 THEN 'WARNING' ELSE 'CRITICAL' END;
    value := avg_query_time;
    threshold := 50;
    message := format('Average query execution time is %.2f ms', avg_query_time);
    RETURN NEXT;

    -- Table bloat estimation (simplified)
    SELECT AVG(pg_total_relation_size(schemaname||'.'||tablename) / GREATEST(n_tup, 1))
    INTO table_bloat
    FROM pg_stat_user_tables
    JOIN pg_tables ON pg_stat_user_tables.relname = pg_tables.tablename;

    check_name := 'Table Bloat';
    status := CASE WHEN table_bloat < 1000000 THEN 'OK' WHEN table_bloat < 5000000 THEN 'WARNING' ELSE 'CRITICAL' END;
    value := table_bloat;
    threshold := 1000000;
    message := format('Average bytes per tuple: %.0f', table_bloat);
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- AUTOMATED MAINTENANCE PROCEDURES
-- =====================================================

-- Comprehensive table maintenance
CREATE OR REPLACE FUNCTION perform_table_maintenance()
RETURNS TABLE(table_name TEXT, maintenance_action TEXT, duration INTERVAL, improvement_pct NUMERIC) AS $$
DECLARE
    tbl RECORD;
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    before_size BIGINT;
    after_size BIGINT;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000 OR n_tup_upd + n_tup_del > 1000
        ORDER BY n_dead_tup DESC
        LIMIT 10
    LOOP
        -- Get table size before maintenance
        SELECT pg_total_relation_size(tbl.schemaname||'.'||tbl.tablename) INTO before_size;
        start_time := CURRENT_TIMESTAMP;

        -- Decide between VACUUM or VACUUM FULL based on dead tuple ratio
        IF (SELECT n_dead_tup::NUMERIC / GREATEST(n_live_tup + n_dead_tup, 1)
            FROM pg_stat_user_tables
            WHERE schemaname = tbl.schemaname AND tablename = tbl.tablename) > 0.3 THEN

            EXECUTE format('VACUUM (ANALYZE, VERBOSE) %I.%I', tbl.schemaname, tbl.tablename);
            maintenance_action := 'VACUUM ANALYZE';
        ELSE
            EXECUTE format('ANALYZE %I.%I', tbl.schemaname, tbl.tablename);
            maintenance_action := 'ANALYZE';
        END IF;

        end_time := CURRENT_TIMESTAMP;
        SELECT pg_total_relation_size(tbl.schemaname||'.'||tbl.tablename) INTO after_size;

        table_name := tbl.schemaname||'.'||tbl.tablename;
        duration := end_time - start_time;
        improvement_pct := CASE WHEN before_size > 0 THEN (before_size - after_size)::NUMERIC / before_size * 100 ELSE 0 END;

        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index maintenance and recommendations
CREATE OR REPLACE FUNCTION analyze_index_usage()
RETURNS TABLE(
    schema_name TEXT,
    table_name TEXT,
    index_name TEXT,
    index_size_mb NUMERIC,
    index_scans BIGINT,
    tuples_read BIGINT,
    tuples_fetched BIGINT,
    usage_ratio NUMERIC,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH index_stats AS (
        SELECT
            schemaname,
            tablename,
            indexname,
            ROUND(pg_relation_size(indexrelid) / 1024.0 / 1024.0, 2) as size_mb,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch,
            CASE WHEN idx_scan > 0 THEN idx_tup_fetch::NUMERIC / idx_scan ELSE 0 END as usage_ratio
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
    )
    SELECT
        is.*,
        CASE
            WHEN is.idx_scan = 0 AND is.size_mb > 10 THEN 'DROP - Unused large index'
            WHEN is.usage_ratio < 0.1 AND is.size_mb > 5 THEN 'CONSIDER DROPPING - Low usage'
            WHEN is.usage_ratio > 10 THEN 'OPTIMIZE - High selectivity'
            WHEN is.idx_scan > 10000 THEN 'MONITOR - High usage'
            ELSE 'OK'
        END as recommendation
    FROM index_stats is
    ORDER BY is.size_mb DESC, is.idx_scan DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SYSTEM LOG TABLES
-- =====================================================

-- Enhanced system logs with partitioning
CREATE TABLE system_logs (
    id BIGSERIAL,
    log_level VARCHAR(10) NOT NULL DEFAULT 'INFO',
    log_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    user_id UUID,
    session_id VARCHAR(100),
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create initial partitions
CREATE TABLE system_logs_current PARTITION OF system_logs
FOR VALUES FROM (DATE_TRUNC('month', CURRENT_DATE))
TO (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month');

CREATE TABLE system_logs_next PARTITION OF system_logs
FOR VALUES FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')
TO (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '2 months');

-- Indexes on system logs
CREATE INDEX idx_system_logs_current_type_level ON system_logs_current (log_type, log_level, created_at DESC);
CREATE INDEX idx_system_logs_current_user ON system_logs_current (user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Performance metrics tracking table
CREATE TABLE performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit VARCHAR(20),
    tags JSONB,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for time-series queries
CREATE INDEX idx_performance_metrics_name_time ON performance_metrics (metric_name, measured_at DESC);

-- =====================================================
-- AUTOMATED STATISTICS COLLECTION
-- =====================================================

-- Function to collect and store performance metrics
CREATE OR REPLACE FUNCTION collect_performance_metrics()
RETURNS VOID AS $$
DECLARE
    current_time TIMESTAMPTZ := CURRENT_TIMESTAMP;
BEGIN
    -- Database size metrics
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, measured_at)
    SELECT
        'database_size_mb',
        pg_database_size(current_database()) / 1024.0 / 1024.0,
        'megabytes',
        current_time;

    -- Active connections
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, measured_at)
    SELECT
        'active_connections',
        COUNT(*),
        'count',
        current_time
    FROM pg_stat_activity WHERE state = 'active';

    -- Cache hit ratio
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, measured_at)
    SELECT
        'cache_hit_ratio',
        CASE WHEN sum(heap_blks_hit + heap_blks_read) = 0 THEN 0
        ELSE sum(heap_blks_hit) / sum(heap_blks_hit + heap_blks_read) * 100 END,
        'percentage',
        current_time
    FROM pg_statio_user_tables;

    -- Average query time
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, measured_at)
    SELECT
        'avg_query_time_ms',
        COALESCE(AVG(mean_exec_time), 0),
        'milliseconds',
        current_time
    FROM pg_stat_statements;

    -- Business metrics
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, measured_at)
    SELECT
        'daily_bookings',
        COUNT(*),
        'count',
        current_time
    FROM bookings
    WHERE DATE(created_at) = CURRENT_DATE;

    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, measured_at)
    SELECT
        'daily_revenue',
        COALESCE(SUM(total_price), 0),
        'currency',
        current_time
    FROM bookings
    WHERE DATE(created_at) = CURRENT_DATE
    AND status_id NOT IN (SELECT id FROM booking_statuses WHERE name IN ('cancelled', 'no_show'));

    -- Log metric collection
    INSERT INTO system_logs (log_type, message, metadata)
    VALUES ('metrics', 'Performance metrics collected', jsonb_build_object(
        'collection_time', current_time,
        'metrics_collected', 6
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RBAC FOR PERFORMANCE MONITORING
-- =====================================================

-- Grant appropriate permissions
GRANT SELECT ON v_booking_dashboard TO app_admin, app_staff;
GRANT SELECT ON v_staff_utilization TO app_admin, app_staff;
GRANT SELECT ON v_revenue_analytics TO app_admin;
GRANT SELECT ON v_service_popularity TO app_admin, app_staff;

GRANT SELECT ON mv_daily_business_metrics TO app_admin, app_staff;
GRANT SELECT ON mv_customer_lifetime_value TO app_admin;

GRANT EXECUTE ON FUNCTION refresh_analytics_views() TO app_admin;
GRANT EXECUTE ON FUNCTION analyze_query_performance() TO app_admin;
GRANT EXECUTE ON FUNCTION database_health_check() TO app_admin;
GRANT EXECUTE ON FUNCTION perform_table_maintenance() TO app_admin;
GRANT EXECUTE ON FUNCTION analyze_index_usage() TO app_admin;
GRANT EXECUTE ON FUNCTION collect_performance_metrics() TO app_admin;

GRANT SELECT ON system_logs TO app_admin;
GRANT SELECT ON performance_metrics TO app_admin, app_staff;

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON VIEW v_booking_dashboard IS 'Real-time booking dashboard with upcoming appointments';
COMMENT ON VIEW v_staff_utilization IS 'Staff utilization analytics and capacity planning';
COMMENT ON VIEW v_revenue_analytics IS 'Daily revenue analytics with growth trends';
COMMENT ON VIEW v_service_popularity IS 'Service popularity and performance metrics';

COMMENT ON MATERIALIZED VIEW mv_daily_business_metrics IS 'Daily business metrics with moving averages and growth calculations';
COMMENT ON MATERIALIZED VIEW mv_customer_lifetime_value IS 'Customer lifetime value analysis and segmentation';

COMMENT ON FUNCTION refresh_analytics_views() IS 'Refreshes all materialized views and tracks performance';
COMMENT ON FUNCTION analyze_query_performance() IS 'Analyzes query performance and assigns grades';
COMMENT ON FUNCTION database_health_check() IS 'Comprehensive database health check with recommendations';
COMMENT ON FUNCTION perform_table_maintenance() IS 'Automated table maintenance with vacuum and analyze';
COMMENT ON FUNCTION analyze_index_usage() IS 'Index usage analysis with optimization recommendations';
COMMENT ON FUNCTION collect_performance_metrics() IS 'Collects and stores performance metrics for monitoring';

COMMENT ON TABLE system_logs IS 'Partitioned system logs for application monitoring';
COMMENT ON TABLE performance_metrics IS 'Time-series performance metrics storage';