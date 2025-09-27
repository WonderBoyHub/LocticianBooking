-- =====================================================
-- PERFORMANCE OPTIMIZATION GUIDE
-- =====================================================
-- Comprehensive PostgreSQL optimization for the
-- loctician booking system targeting sub-50ms queries
-- =====================================================

-- =====================================================
-- POSTGRESQL CONFIGURATION RECOMMENDATIONS
-- =====================================================

/*
Add these settings to postgresql.conf for optimal performance:

# MEMORY SETTINGS (adjust based on available RAM)
shared_buffers = 256MB                    # 25% of system RAM
effective_cache_size = 1GB                # 75% of system RAM
work_mem = 4MB                           # Per-query memory
maintenance_work_mem = 64MB              # For maintenance operations
wal_buffers = 16MB                       # WAL buffer size

# QUERY PLANNER SETTINGS
random_page_cost = 1.1                   # For SSD storage
seq_page_cost = 1.0                      # Sequential read cost
cpu_tuple_cost = 0.01                    # CPU processing cost
cpu_index_tuple_cost = 0.005             # Index tuple cost
cpu_operator_cost = 0.0025               # Operator evaluation cost

# CONNECTION SETTINGS
max_connections = 100                     # Adjust based on load
superuser_reserved_connections = 3

# CHECKPOINT SETTINGS
checkpoint_completion_target = 0.9        # Spread checkpoints
checkpoint_timeout = 10min                # Checkpoint frequency
max_wal_size = 1GB                       # Maximum WAL size
min_wal_size = 80MB                      # Minimum WAL size

# LOGGING FOR MONITORING
log_min_duration_statement = 100          # Log queries > 100ms
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on

# STATISTICS
track_activity_query_size = 2048          # Query text size
track_functions = all                     # Track function calls
track_io_timing = on                      # Track I/O timing

# ENABLE EXTENSIONS
shared_preload_libraries = 'pg_stat_statements'
*/

-- =====================================================
-- QUERY OPTIMIZATION FUNCTIONS
-- =====================================================

-- Function to analyze query performance
CREATE OR REPLACE FUNCTION analyze_query_performance(
    query_text TEXT,
    execution_count INTEGER DEFAULT 1
)
RETURNS TABLE(
    execution_time_ms NUMERIC,
    plan_time_ms NUMERIC,
    execution_plan TEXT,
    buffer_usage TEXT,
    recommendations TEXT[]
) AS $$
DECLARE
    start_time TIMESTAMP WITH TIME ZONE;
    end_time TIMESTAMP WITH TIME ZONE;
    plan_start TIMESTAMP WITH TIME ZONE;
    plan_end TIMESTAMP WITH TIME ZONE;
    i INTEGER;
    total_time NUMERIC := 0;
    avg_time NUMERIC;
BEGIN
    -- Enable timing
    PERFORM set_config('track_io_timing', 'on', false);

    -- Run query multiple times to get average
    FOR i IN 1..execution_count LOOP
        plan_start := clock_timestamp();
        -- Get execution plan
        plan_end := clock_timestamp();

        start_time := clock_timestamp();
        -- Execute the query (this would need dynamic SQL in real implementation)
        end_time := clock_timestamp();

        total_time := total_time + EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    END LOOP;

    avg_time := total_time / execution_count;

    execution_time_ms := avg_time;
    plan_time_ms := EXTRACT(EPOCH FROM (plan_end - plan_start)) * 1000;
    execution_plan := 'Use EXPLAIN ANALYZE for detailed plan';
    buffer_usage := 'Use EXPLAIN (ANALYZE, BUFFERS) for buffer stats';

    -- Generate recommendations based on execution time
    recommendations := CASE
        WHEN avg_time > 1000 THEN ARRAY['Consider adding indexes', 'Check for full table scans', 'Analyze query structure']
        WHEN avg_time > 100 THEN ARRAY['Monitor for performance degradation', 'Consider query optimization']
        ELSE ARRAY['Performance within acceptable range']
    END;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SPECIALIZED INDEXES FOR BOOKING SYSTEM
-- =====================================================

-- Additional performance indexes beyond the core schema

-- Composite index for availability queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_loctician_date_status
ON bookings(loctician_id, DATE(appointment_start), status)
WHERE status NOT IN ('cancelled');

-- Index for customer booking history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_customer_date_desc
ON bookings(customer_id, appointment_start DESC)
WHERE status IN ('confirmed', 'completed');

-- Partial index for upcoming appointments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_upcoming
ON bookings(appointment_start, loctician_id)
WHERE appointment_start > NOW() AND status NOT IN ('cancelled');

-- Index for finding available time slots
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_availability_patterns_lookup
ON availability_patterns(loctician_id, day_of_week, start_time, end_time)
WHERE is_active = TRUE;

-- Index for email queue processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_queue_processing
ON email_queue(status, scheduled_at, attempts)
WHERE status IN ('queued', 'failed') AND attempts < max_attempts;

-- Index for audit log queries by date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_date_user
ON audit_log(created_at DESC, user_id)
WHERE created_at > NOW() - INTERVAL '1 year';

-- Covering index for service lookup with pricing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_lookup_covering
ON services(is_active, category_id)
INCLUDE (id, name, duration_minutes, base_price)
WHERE is_active = TRUE;

-- =====================================================
-- OPTIMIZED QUERIES FOR COMMON OPERATIONS
-- =====================================================

-- High-performance availability check
CREATE OR REPLACE FUNCTION check_availability_optimized(
    p_loctician_id UUID,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    has_conflict BOOLEAN := FALSE;
BEGIN
    -- Use EXISTS for faster execution on large datasets
    SELECT EXISTS(
        SELECT 1
        FROM bookings
        WHERE loctician_id = p_loctician_id
        AND status NOT IN ('cancelled')
        AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
        AND appointment_start < p_end_time
        AND appointment_end > p_start_time
        LIMIT 1
    ) INTO has_conflict;

    IF has_conflict THEN
        RETURN FALSE;
    END IF;

    -- Check calendar events
    SELECT EXISTS(
        SELECT 1
        FROM calendar_events
        WHERE loctician_id = p_loctician_id
        AND time_range && tstzrange(p_start_time, p_end_time)
        LIMIT 1
    ) INTO has_conflict;

    RETURN NOT has_conflict;
END;
$$ LANGUAGE plpgsql;

-- Optimized function to get daily schedule
CREATE OR REPLACE FUNCTION get_daily_schedule_optimized(
    p_loctician_id UUID,
    p_date DATE
)
RETURNS TABLE(
    appointment_start TIMESTAMP WITH TIME ZONE,
    appointment_end TIMESTAMP WITH TIME ZONE,
    service_name VARCHAR(150),
    customer_name TEXT,
    customer_phone VARCHAR(20),
    booking_id UUID,
    status booking_status
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.appointment_start,
        b.appointment_end,
        s.name as service_name,
        (c.first_name || ' ' || c.last_name) as customer_name,
        c.phone as customer_phone,
        b.id as booking_id,
        b.status
    FROM bookings b
    INNER JOIN services s ON b.service_id = s.id
    INNER JOIN users c ON b.customer_id = c.id
    WHERE b.loctician_id = p_loctician_id
    AND DATE(b.appointment_start) = p_date
    AND b.status NOT IN ('cancelled')
    ORDER BY b.appointment_start;
END;
$$ LANGUAGE plpgsql;

-- Fast customer search with ranking
CREATE OR REPLACE FUNCTION search_customers(
    search_term TEXT,
    limit_results INTEGER DEFAULT 20
)
RETURNS TABLE(
    customer_id UUID,
    full_name TEXT,
    email VARCHAR(255),
    phone VARCHAR(20),
    last_appointment DATE,
    total_visits INTEGER,
    search_rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id as customer_id,
        (u.first_name || ' ' || u.last_name) as full_name,
        u.email,
        u.phone,
        cvs.last_visit_date as last_appointment,
        cvs.total_visits,
        (
            CASE WHEN u.first_name ILIKE search_term || '%' THEN 1.0 ELSE 0.0 END +
            CASE WHEN u.last_name ILIKE search_term || '%' THEN 1.0 ELSE 0.0 END +
            CASE WHEN u.email ILIKE '%' || search_term || '%' THEN 0.5 ELSE 0.0 END +
            CASE WHEN u.phone LIKE '%' || search_term || '%' THEN 0.7 ELSE 0.0 END
        ) as search_rank
    FROM users u
    LEFT JOIN customer_visit_summary cvs ON u.id = cvs.customer_id
    WHERE u.role = 'customer'
    AND u.status = 'active'
    AND (
        u.first_name ILIKE '%' || search_term || '%' OR
        u.last_name ILIKE '%' || search_term || '%' OR
        u.email ILIKE '%' || search_term || '%' OR
        u.phone LIKE '%' || search_term || '%'
    )
    ORDER BY search_rank DESC, cvs.last_visit_date DESC NULLS LAST
    LIMIT limit_results;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- =====================================================

-- Materialized view for business analytics
CREATE MATERIALIZED VIEW mv_business_analytics AS
SELECT
    DATE_TRUNC('week', b.appointment_start) as week_start,
    l.id as loctician_id,
    l.first_name || ' ' || l.last_name as loctician_name,
    COUNT(b.id) as total_bookings,
    COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
    COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
    COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show_bookings,
    SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END) as revenue,
    AVG(CASE WHEN b.status = 'completed' THEN b.total_amount END) as avg_transaction_value,
    COUNT(DISTINCT b.customer_id) as unique_customers
FROM bookings b
INNER JOIN users l ON b.loctician_id = l.id
WHERE b.appointment_start >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY DATE_TRUNC('week', b.appointment_start), l.id, l.first_name, l.last_name;

CREATE UNIQUE INDEX idx_mv_business_analytics_week_loctician
ON mv_business_analytics(week_start, loctician_id);

-- Materialized view for service popularity
CREATE MATERIALIZED VIEW mv_service_analytics AS
SELECT
    s.id as service_id,
    s.name as service_name,
    sc.name as category_name,
    COUNT(b.id) as total_bookings,
    COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
    AVG(CASE WHEN b.status = 'completed' THEN b.total_amount END) as avg_revenue_per_booking,
    SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END) as total_revenue,
    AVG(s.duration_minutes) as avg_duration_minutes,
    COUNT(CASE WHEN b.appointment_start >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as bookings_last_30_days
FROM services s
LEFT JOIN service_categories sc ON s.category_id = sc.id
LEFT JOIN bookings b ON s.id = b.service_id
    AND b.appointment_start >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY s.id, s.name, sc.name, s.duration_minutes;

CREATE UNIQUE INDEX idx_mv_service_analytics_service ON mv_service_analytics(service_id);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS TABLE(
    view_name TEXT,
    refresh_time_ms INTEGER,
    row_count BIGINT
) AS $$
DECLARE
    start_time TIMESTAMP WITH TIME ZONE;
    end_time TIMESTAMP WITH TIME ZONE;
    row_cnt BIGINT;
BEGIN
    -- Refresh business analytics
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_business_analytics;
    end_time := clock_timestamp();

    SELECT COUNT(*) INTO row_cnt FROM mv_business_analytics;

    view_name := 'mv_business_analytics';
    refresh_time_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    row_count := row_cnt;
    RETURN NEXT;

    -- Refresh service analytics
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_analytics;
    end_time := clock_timestamp();

    SELECT COUNT(*) INTO row_cnt FROM mv_service_analytics;

    view_name := 'mv_service_analytics';
    refresh_time_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    row_count := row_cnt;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CONNECTION POOLING RECOMMENDATIONS
-- =====================================================

/*
PGBOUNCER CONFIGURATION:

[databases]
loctician_booking = host=localhost port=5432 dbname=loctician_booking

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = trust
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
reserve_pool_size = 5
reserve_pool_timeout = 5

# Timeouts
server_connect_timeout = 15
server_login_retry = 15
query_timeout = 0
query_wait_timeout = 120
client_idle_timeout = 0
client_login_timeout = 60
autodb_idle_timeout = 3600

# Safety limits
max_db_connections = 50
max_user_connections = 50

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
*/

-- =====================================================
-- QUERY MONITORING AND OPTIMIZATION
-- =====================================================

-- Function to identify slow queries
CREATE OR REPLACE FUNCTION identify_slow_queries(
    min_duration_ms INTEGER DEFAULT 100,
    min_calls INTEGER DEFAULT 10
)
RETURNS TABLE(
    query_hash TEXT,
    avg_time_ms NUMERIC,
    total_time_ms NUMERIC,
    calls BIGINT,
    rows_per_call NUMERIC,
    cache_hit_percent NUMERIC,
    query_text TEXT,
    optimization_suggestions TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        LEFT(MD5(pss.query), 8) as query_hash,
        ROUND(pss.mean_exec_time::numeric, 2) as avg_time_ms,
        ROUND(pss.total_exec_time::numeric, 2) as total_time_ms,
        pss.calls,
        ROUND((pss.rows::numeric / GREATEST(pss.calls, 1)), 2) as rows_per_call,
        ROUND(
            (100.0 * pss.shared_blks_hit / GREATEST(pss.shared_blks_hit + pss.shared_blks_read, 1))::numeric,
            1
        ) as cache_hit_percent,
        LEFT(pss.query, 200) as query_text,
        CASE
            WHEN pss.mean_exec_time > 1000 THEN ARRAY['CRITICAL: Consider major optimization', 'Check for missing indexes', 'Review query logic']
            WHEN pss.mean_exec_time > 500 THEN ARRAY['HIGH: Add appropriate indexes', 'Consider query rewrite']
            WHEN pss.shared_blks_hit * 100.0 / GREATEST(pss.shared_blks_hit + pss.shared_blks_read, 1) < 90 THEN ARRAY['LOW cache hit ratio - check indexes']
            ELSE ARRAY['Monitor for performance changes']
        END as optimization_suggestions
    FROM pg_stat_statements pss
    WHERE pss.mean_exec_time >= min_duration_ms
    AND pss.calls >= min_calls
    ORDER BY pss.mean_exec_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze table bloat
CREATE OR REPLACE FUNCTION analyze_table_bloat()
RETURNS TABLE(
    schema_name TEXT,
    table_name TEXT,
    size_mb NUMERIC,
    bloat_percent NUMERIC,
    wasted_mb NUMERIC,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname::TEXT,
        tablename::TEXT,
        ROUND((pg_total_relation_size(schemaname||'.'||tablename))::numeric / 1024 / 1024, 1) as size_mb,
        ROUND(
            CASE
                WHEN pg_stat_user_tables.n_dead_tup > 0 THEN
                    (pg_stat_user_tables.n_dead_tup * 100.0 / GREATEST(pg_stat_user_tables.n_live_tup + pg_stat_user_tables.n_dead_tup, 1))
                ELSE 0
            END::numeric,
            1
        ) as bloat_percent,
        ROUND(
            (pg_stat_user_tables.n_dead_tup *
             pg_total_relation_size(schemaname||'.'||tablename) /
             GREATEST(pg_stat_user_tables.n_live_tup + pg_stat_user_tables.n_dead_tup, 1))::numeric / 1024 / 1024,
            1
        ) as wasted_mb,
        CASE
            WHEN pg_stat_user_tables.n_dead_tup * 100.0 / GREATEST(pg_stat_user_tables.n_live_tup + pg_stat_user_tables.n_dead_tup, 1) > 20 THEN 'VACUUM RECOMMENDED'
            WHEN pg_stat_user_tables.n_dead_tup * 100.0 / GREATEST(pg_stat_user_tables.n_live_tup + pg_stat_user_tables.n_dead_tup, 1) > 10 THEN 'Monitor bloat levels'
            ELSE 'Bloat within acceptable range'
        END as recommendation
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY
        pg_stat_user_tables.n_dead_tup * 100.0 / GREATEST(pg_stat_user_tables.n_live_tup + pg_stat_user_tables.n_dead_tup, 1) DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- AUTOMATIC OPTIMIZATION PROCEDURES
-- =====================================================

-- Auto-vacuum configuration per table
ALTER TABLE bookings SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05,
    autovacuum_vacuum_cost_delay = 10
);

ALTER TABLE audit_log SET (
    autovacuum_vacuum_scale_factor = 0.2,
    autovacuum_analyze_scale_factor = 0.1
);

ALTER TABLE email_queue SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- Function for automated maintenance
CREATE OR REPLACE FUNCTION auto_optimize_database()
RETURNS TABLE(
    optimization_type TEXT,
    table_affected TEXT,
    action_taken TEXT,
    performance_impact TEXT
) AS $$
DECLARE
    bloat_record RECORD;
    slow_query_record RECORD;
BEGIN
    -- Auto-vacuum tables with high bloat
    FOR bloat_record IN
        SELECT schema_name, table_name, bloat_percent
        FROM analyze_table_bloat()
        WHERE bloat_percent > 20
    LOOP
        EXECUTE format('VACUUM ANALYZE %I.%I', bloat_record.schema_name, bloat_record.table_name);

        optimization_type := 'vacuum';
        table_affected := bloat_record.table_name;
        action_taken := 'VACUUM ANALYZE executed';
        performance_impact := 'Reduced bloat from ' || bloat_record.bloat_percent || '%';
        RETURN NEXT;
    END LOOP;

    -- Update statistics for tables with outdated stats
    optimization_type := 'statistics';
    table_affected := 'all_tables';
    action_taken := 'Updated table statistics';
    performance_impact := 'Improved query planning';
    RETURN NEXT;

    ANALYZE;

    -- Refresh materialized views if they're stale
    IF (SELECT MAX(last_refresh) FROM pg_matviews WHERE matviewname LIKE 'mv_%') < NOW() - INTERVAL '1 hour' THEN
        PERFORM refresh_analytics_views();

        optimization_type := 'materialized_views';
        table_affected := 'analytics_views';
        action_taken := 'Refreshed materialized views';
        performance_impact := 'Updated analytics data';
        RETURN NEXT;
    END IF;

END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE TESTING PROCEDURES
-- =====================================================

-- Load testing function for booking system
CREATE OR REPLACE FUNCTION performance_test_bookings(
    test_duration_seconds INTEGER DEFAULT 60,
    concurrent_users INTEGER DEFAULT 10
)
RETURNS TABLE(
    test_name TEXT,
    total_operations INTEGER,
    operations_per_second NUMERIC,
    avg_response_time_ms NUMERIC,
    max_response_time_ms NUMERIC,
    error_count INTEGER
) AS $$
DECLARE
    start_time TIMESTAMP WITH TIME ZONE;
    end_time TIMESTAMP WITH TIME ZONE;
    operation_count INTEGER := 0;
    error_count_val INTEGER := 0;
    min_time NUMERIC := 999999;
    max_time NUMERIC := 0;
    total_time NUMERIC := 0;
    current_time NUMERIC;
    test_start TIMESTAMP WITH TIME ZONE;
    test_end TIMESTAMP WITH TIME ZONE;
BEGIN
    test_start := clock_timestamp();

    -- Simulate booking operations
    WHILE clock_timestamp() < test_start + (test_duration_seconds || ' seconds')::INTERVAL LOOP
        start_time := clock_timestamp();

        BEGIN
            -- Simulate availability check
            PERFORM check_availability_optimized(
                '550e8400-e29b-41d4-a716-446655440001',
                NOW() + INTERVAL '1 day',
                NOW() + INTERVAL '1 day' + INTERVAL '90 minutes'
            );

            operation_count := operation_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count_val := error_count_val + 1;
        END;

        end_time := clock_timestamp();
        current_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

        total_time := total_time + current_time;
        min_time := LEAST(min_time, current_time);
        max_time := GREATEST(max_time, current_time);

        -- Small delay to simulate real usage
        PERFORM pg_sleep(0.01);
    END LOOP;

    test_end := clock_timestamp();

    test_name := 'availability_check_load_test';
    total_operations := operation_count;
    operations_per_second := operation_count / EXTRACT(EPOCH FROM (test_end - test_start));
    avg_response_time_ms := CASE WHEN operation_count > 0 THEN total_time / operation_count ELSE 0 END;
    max_response_time_ms := max_time;
    error_count := error_count_val;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MONITORING DASHBOARD QUERIES
-- =====================================================

-- Real-time system metrics view
CREATE VIEW v_system_metrics AS
SELECT
    'active_connections' as metric,
    COUNT(*)::TEXT as value,
    'connections' as unit
FROM pg_stat_activity
WHERE state = 'active'

UNION ALL

SELECT
    'cache_hit_ratio' as metric,
    ROUND(
        (sum(blks_hit) * 100.0 / NULLIF(sum(blks_hit) + sum(blks_read), 0))::numeric,
        2
    )::TEXT as value,
    'percent' as unit
FROM pg_stat_database
WHERE datname = current_database()

UNION ALL

SELECT
    'database_size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value,
    'bytes' as unit

UNION ALL

SELECT
    'longest_query_duration' as metric,
    COALESCE(
        MAX(EXTRACT(EPOCH FROM (NOW() - query_start)))::INTEGER,
        0
    )::TEXT as value,
    'seconds' as unit
FROM pg_stat_activity
WHERE state = 'active' AND query_start IS NOT NULL;

-- =====================================================
-- PERFORMANCE BENCHMARKING
-- =====================================================

-- Benchmark critical queries
CREATE OR REPLACE FUNCTION benchmark_critical_queries()
RETURNS TABLE(
    query_name TEXT,
    execution_time_ms NUMERIC,
    meets_target BOOLEAN,
    recommendation TEXT
) AS $$
DECLARE
    start_time TIMESTAMP WITH TIME ZONE;
    end_time TIMESTAMP WITH TIME ZONE;
    duration_ms NUMERIC;
    target_ms NUMERIC := 50; -- Target sub-50ms performance
BEGIN
    -- Test 1: Availability check
    start_time := clock_timestamp();
    PERFORM check_availability_optimized(
        '550e8400-e29b-41d4-a716-446655440001',
        NOW() + INTERVAL '1 day',
        NOW() + INTERVAL '1 day' + INTERVAL '90 minutes'
    );
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

    query_name := 'availability_check';
    execution_time_ms := ROUND(duration_ms, 2);
    meets_target := duration_ms <= target_ms;
    recommendation := CASE WHEN duration_ms > target_ms THEN 'Optimize indexes or query logic' ELSE 'Performance acceptable' END;
    RETURN NEXT;

    -- Test 2: Daily schedule
    start_time := clock_timestamp();
    PERFORM get_daily_schedule_optimized(
        '550e8400-e29b-41d4-a716-446655440001',
        CURRENT_DATE
    );
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

    query_name := 'daily_schedule';
    execution_time_ms := ROUND(duration_ms, 2);
    meets_target := duration_ms <= target_ms;
    recommendation := CASE WHEN duration_ms > target_ms THEN 'Consider materialized view or caching' ELSE 'Performance acceptable' END;
    RETURN NEXT;

    -- Test 3: Customer search
    start_time := clock_timestamp();
    PERFORM search_customers('Anna', 10);
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

    query_name := 'customer_search';
    execution_time_ms := ROUND(duration_ms, 2);
    meets_target := duration_ms <= target_ms;
    recommendation := CASE WHEN duration_ms > target_ms THEN 'Add full-text search indexes' ELSE 'Performance acceptable' END;
    RETURN NEXT;

END;
$$ LANGUAGE plpgsql;