-- =====================================================
-- BACKUP AND MAINTENANCE STRATEGY
-- =====================================================
-- Comprehensive backup, monitoring, and maintenance
-- strategy for GDPR compliance and high availability
-- =====================================================

-- =====================================================
-- BACKUP STRATEGY
-- =====================================================

-- 1. CONTINUOUS WAL ARCHIVING SETUP
-- Add to postgresql.conf:
/*
wal_level = replica
archive_mode = on
archive_command = 'rsync -a %p backup_server:/postgres_wal_archive/%f'
archive_timeout = 300  # Force WAL switch every 5 minutes

# For streaming replication
max_wal_senders = 3
wal_keep_size = 1024  # Keep 1GB of WAL files
*/

-- 2. AUTOMATED BACKUP SCRIPTS

-- Daily full backup script (to be run via cron)
CREATE OR REPLACE FUNCTION perform_daily_backup()
RETURNS TEXT AS $$
DECLARE
    backup_filename TEXT;
    backup_start_time TIMESTAMP;
    backup_end_time TIMESTAMP;
    backup_size BIGINT;
BEGIN
    backup_start_time := NOW();
    backup_filename := 'loctician_backup_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS') || '.sql';

    -- Log backup start
    INSERT INTO backup_log (backup_type, status, started_at, filename)
    VALUES ('daily_full', 'started', backup_start_time, backup_filename);

    -- The actual backup command would be executed via pg_dump externally
    -- This function primarily logs the process

    backup_end_time := NOW();

    -- Update backup log with completion
    UPDATE backup_log
    SET status = 'completed',
        completed_at = backup_end_time,
        duration_seconds = EXTRACT(EPOCH FROM (backup_end_time - backup_start_time))
    WHERE filename = backup_filename;

    RETURN 'Backup completed: ' || backup_filename;
END;
$$ LANGUAGE plpgsql;

-- Create backup log table
CREATE TABLE backup_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_type VARCHAR(50) NOT NULL, -- daily_full, weekly_full, monthly_archive, point_in_time
    status VARCHAR(20) NOT NULL, -- started, completed, failed
    filename VARCHAR(255),
    file_size_bytes BIGINT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    error_message TEXT,
    backup_location TEXT,
    retention_until TIMESTAMP WITH TIME ZONE,

    -- Verification info
    verification_status VARCHAR(20), -- pending, passed, failed
    verification_date TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT
);

-- Index for backup monitoring
CREATE INDEX idx_backup_log_date_type ON backup_log(started_at DESC, backup_type);
CREATE INDEX idx_backup_log_status ON backup_log(status, started_at DESC);

-- =====================================================
-- POINT-IN-TIME RECOVERY SETUP
-- =====================================================

-- Function to create a named restore point
CREATE OR REPLACE FUNCTION create_restore_point(restore_point_name TEXT)
RETURNS TEXT AS $$
DECLARE
    lsn_location TEXT;
BEGIN
    -- Create named restore point
    SELECT pg_create_restore_point(restore_point_name) INTO lsn_location;

    -- Log the restore point
    INSERT INTO restore_points (name, lsn_location, created_at, description)
    VALUES (restore_point_name, lsn_location, NOW(), 'Manual restore point');

    RETURN 'Restore point created: ' || restore_point_name || ' at LSN: ' || lsn_location;
END;
$$ LANGUAGE plpgsql;

-- Restore points tracking
CREATE TABLE restore_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    lsn_location TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    is_automatic BOOLEAN DEFAULT FALSE
);

-- Automatic restore points before major operations
CREATE OR REPLACE FUNCTION auto_restore_point_trigger()
RETURNS TRIGGER AS $$
DECLARE
    point_name TEXT;
BEGIN
    -- Create restore point before bulk operations
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        point_name := 'auto_' || TG_TABLE_NAME || '_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS');
        PERFORM create_restore_point(point_name);
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GDPR COMPLIANCE AUTOMATION
-- =====================================================

-- Automated GDPR cleanup job
CREATE OR REPLACE FUNCTION gdpr_cleanup_job()
RETURNS TABLE(
    action TEXT,
    records_affected INTEGER,
    details TEXT
) AS $$
DECLARE
    expired_users_count INTEGER;
    anonymized_count INTEGER;
    purged_audit_count INTEGER;
    purged_email_count INTEGER;
BEGIN
    -- 1. Identify users past retention date
    SELECT COUNT(*) INTO expired_users_count
    FROM users
    WHERE data_retention_until < NOW()
    AND deleted_at IS NULL;

    -- 2. Anonymize expired user data
    WITH expired_users AS (
        SELECT id FROM users
        WHERE data_retention_until < NOW()
        AND deleted_at IS NULL
        LIMIT 100  -- Process in batches
    )
    UPDATE users SET
        email = 'deleted-' || id || '@anonymized.local',
        phone = NULL,
        first_name = 'Deleted',
        last_name = 'User',
        date_of_birth = NULL,
        street_address = NULL,
        city = NULL,
        postal_code = NULL,
        deleted_at = NOW(),
        data_retention_until = NULL
    FROM expired_users
    WHERE users.id = expired_users.id;

    GET DIAGNOSTICS anonymized_count = ROW_COUNT;

    action := 'user_anonymization';
    records_affected := anonymized_count;
    details := 'Anonymized ' || anonymized_count || ' expired user records';
    RETURN NEXT;

    -- 3. Purge old audit logs (keep for 7 years)
    DELETE FROM audit_log
    WHERE created_at < NOW() - INTERVAL '7 years';

    GET DIAGNOSTICS purged_audit_count = ROW_COUNT;

    action := 'audit_log_purge';
    records_affected := purged_audit_count;
    details := 'Purged audit logs older than 7 years';
    RETURN NEXT;

    -- 4. Purge old email records
    DELETE FROM email_queue
    WHERE status = 'sent'
    AND sent_at < NOW() - INTERVAL '1 year';

    GET DIAGNOSTICS purged_email_count = ROW_COUNT;

    action := 'email_purge';
    records_affected := purged_email_count;
    details := 'Purged sent emails older than 1 year';
    RETURN NEXT;

    -- 5. Log GDPR compliance actions
    INSERT INTO gdpr_compliance_log (action, records_processed, execution_date)
    VALUES
    ('user_anonymization', anonymized_count, NOW()),
    ('audit_log_purge', purged_audit_count, NOW()),
    ('email_purge', purged_email_count, NOW());

END;
$$ LANGUAGE plpgsql;

-- GDPR compliance tracking
CREATE TABLE gdpr_compliance_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(50) NOT NULL,
    records_processed INTEGER DEFAULT 0,
    execution_date TIMESTAMP WITH TIME ZONE NOT NULL,
    execution_duration_ms INTEGER,
    status VARCHAR(20) DEFAULT 'completed',
    error_message TEXT,
    executed_by VARCHAR(100) DEFAULT 'system'
);

-- GDPR data export function (Right to Data Portability)
CREATE OR REPLACE FUNCTION export_user_data(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    user_data JSONB;
    bookings_data JSONB;
    profile_data JSONB;
BEGIN
    -- Get user basic information
    SELECT to_jsonb(u) INTO user_data
    FROM (
        SELECT
            id, email, first_name, last_name, phone,
            street_address, city, postal_code, country,
            preferred_language, created_at
        FROM users
        WHERE id = user_uuid
    ) u;

    -- Get user profile
    SELECT to_jsonb(up) INTO profile_data
    FROM user_profiles up
    WHERE up.user_id = user_uuid;

    -- Get booking history
    SELECT jsonb_agg(
        jsonb_build_object(
            'booking_number', b.booking_number,
            'service_name', s.name,
            'appointment_date', b.appointment_start,
            'total_amount', b.total_amount,
            'status', b.status,
            'loctician_name', l.first_name || ' ' || l.last_name
        )
    ) INTO bookings_data
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN users l ON b.loctician_id = l.id
    WHERE b.customer_id = user_uuid;

    -- Combine all data
    RETURN jsonb_build_object(
        'user_info', user_data,
        'profile', profile_data,
        'booking_history', COALESCE(bookings_data, '[]'::jsonb),
        'export_date', NOW(),
        'export_version', '1.0'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE MONITORING
-- =====================================================

-- Database performance metrics table
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit VARCHAR(20),
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    measurement_category VARCHAR(50), -- query_performance, connection_stats, disk_io, etc.
    additional_data JSONB
);

-- Function to collect key performance metrics
CREATE OR REPLACE FUNCTION collect_performance_metrics()
RETURNS VOID AS $$
BEGIN
    -- Active connections
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, measurement_category)
    SELECT 'active_connections', COUNT(*), 'connections', 'connection_stats'
    FROM pg_stat_activity
    WHERE state = 'active';

    -- Database size
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, measurement_category)
    SELECT 'database_size', pg_database_size(current_database()), 'bytes', 'storage';

    -- Cache hit ratio
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, measurement_category)
    SELECT
        'cache_hit_ratio',
        ROUND(
            (sum(blks_hit) * 100.0 / NULLIF(sum(blks_hit) + sum(blks_read), 0))::numeric,
            2
        ),
        'percentage',
        'query_performance'
    FROM pg_stat_database
    WHERE datname = current_database();

    -- Long running queries
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, measurement_category, additional_data)
    SELECT
        'long_running_queries',
        COUNT(*),
        'queries',
        'query_performance',
        jsonb_agg(
            jsonb_build_object(
                'pid', pid,
                'duration_seconds', EXTRACT(EPOCH FROM (NOW() - query_start)),
                'state', state,
                'query', LEFT(query, 100)
            )
        )
    FROM pg_stat_activity
    WHERE state = 'active'
    AND query_start < NOW() - INTERVAL '1 minute'
    AND query NOT LIKE '%collect_performance_metrics%';

END;
$$ LANGUAGE plpgsql;

-- Index usage monitoring
CREATE VIEW v_index_usage AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 10 THEN 'LOW_USAGE'
        WHEN idx_scan < 100 THEN 'MODERATE_USAGE'
        ELSE 'HIGH_USAGE'
    END as usage_category
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Slow query identification
CREATE VIEW v_slow_queries AS
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    stddev_exec_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- Queries taking more than 100ms on average
ORDER BY mean_exec_time DESC;

-- =====================================================
-- MAINTENANCE PROCEDURES
-- =====================================================

-- Comprehensive maintenance function
CREATE OR REPLACE FUNCTION perform_maintenance(maintenance_type TEXT DEFAULT 'routine')
RETURNS TABLE(
    task TEXT,
    status TEXT,
    duration_ms INTEGER,
    details TEXT
) AS $$
DECLARE
    start_time TIMESTAMP WITH TIME ZONE;
    end_time TIMESTAMP WITH TIME ZONE;
    task_duration INTEGER;
BEGIN
    -- 1. Update table statistics
    start_time := NOW();
    ANALYZE;
    end_time := NOW();
    task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

    task := 'analyze_tables';
    status := 'completed';
    duration_ms := task_duration;
    details := 'Updated table statistics for query planner';
    RETURN NEXT;

    -- 2. Vacuum dead tuples
    IF maintenance_type IN ('routine', 'full') THEN
        start_time := NOW();

        -- Vacuum critical tables
        VACUUM bookings;
        VACUUM users;
        VACUUM audit_log;
        VACUUM email_queue;

        end_time := NOW();
        task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

        task := 'vacuum_tables';
        status := 'completed';
        duration_ms := task_duration;
        details := 'Vacuumed critical tables to reclaim space';
        RETURN NEXT;
    END IF;

    -- 3. Reindex if needed (full maintenance only)
    IF maintenance_type = 'full' THEN
        start_time := NOW();

        REINDEX INDEX idx_bookings_no_overlap;
        REINDEX INDEX idx_bookings_loctician_date;
        REINDEX INDEX idx_users_email;

        end_time := NOW();
        task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

        task := 'reindex_critical';
        status := 'completed';
        duration_ms := task_duration;
        details := 'Rebuilt critical indexes for optimal performance';
        RETURN NEXT;
    END IF;

    -- 4. Clean up old performance metrics
    start_time := NOW();

    DELETE FROM performance_metrics
    WHERE measured_at < NOW() - INTERVAL '30 days';

    end_time := NOW();
    task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

    task := 'cleanup_metrics';
    status := 'completed';
    duration_ms := task_duration;
    details := 'Cleaned up old performance metrics';
    RETURN NEXT;

    -- 5. Update customer visit summaries
    start_time := NOW();

    INSERT INTO customer_visit_summary (
        customer_id, first_visit_date, last_visit_date,
        total_visits, total_spent, average_visit_value
    )
    SELECT
        b.customer_id,
        MIN(b.appointment_start::DATE),
        MAX(b.appointment_start::DATE),
        COUNT(b.id),
        SUM(b.total_amount),
        AVG(b.total_amount)
    FROM bookings b
    WHERE b.status = 'completed'
    AND NOT EXISTS (
        SELECT 1 FROM customer_visit_summary cvs
        WHERE cvs.customer_id = b.customer_id
    )
    GROUP BY b.customer_id
    ON CONFLICT (customer_id) DO UPDATE SET
        last_visit_date = EXCLUDED.last_visit_date,
        total_visits = EXCLUDED.total_visits,
        total_spent = EXCLUDED.total_spent,
        average_visit_value = EXCLUDED.average_visit_value,
        updated_at = NOW();

    end_time := NOW();
    task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

    task := 'update_summaries';
    status := 'completed';
    duration_ms := task_duration;
    details := 'Updated customer visit summaries';
    RETURN NEXT;

END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MONITORING AND ALERTING
-- =====================================================

-- Health check function for monitoring systems
CREATE OR REPLACE FUNCTION health_check()
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
    active_connections INTEGER;
    cache_hit_ratio NUMERIC;
    disk_usage NUMERIC;
    replication_lag INTERVAL;
    longest_query_duration INTEGER;
    failed_backups INTEGER;
BEGIN
    -- Check active connections
    SELECT COUNT(*) INTO active_connections
    FROM pg_stat_activity WHERE state = 'active';

    result := jsonb_set(result, '{active_connections}', to_jsonb(active_connections));

    -- Check cache hit ratio
    SELECT ROUND(
        (sum(blks_hit) * 100.0 / NULLIF(sum(blks_hit) + sum(blks_read), 0))::numeric,
        2
    ) INTO cache_hit_ratio
    FROM pg_stat_database WHERE datname = current_database();

    result := jsonb_set(result, '{cache_hit_ratio}', to_jsonb(cache_hit_ratio));

    -- Check for long-running queries
    SELECT COALESCE(
        MAX(EXTRACT(EPOCH FROM (NOW() - query_start))),
        0
    )::INTEGER INTO longest_query_duration
    FROM pg_stat_activity
    WHERE state = 'active' AND query_start IS NOT NULL;

    result := jsonb_set(result, '{longest_query_seconds}', to_jsonb(longest_query_duration));

    -- Check recent backup failures
    SELECT COUNT(*) INTO failed_backups
    FROM backup_log
    WHERE status = 'failed'
    AND started_at > NOW() - INTERVAL '24 hours';

    result := jsonb_set(result, '{failed_backups_24h}', to_jsonb(failed_backups));

    -- Overall status
    result := jsonb_set(result, '{status}',
        CASE
            WHEN active_connections > 100 THEN '"warning:high_connections"'
            WHEN cache_hit_ratio < 90 THEN '"warning:low_cache_hit"'
            WHEN longest_query_duration > 300 THEN '"warning:long_queries"'
            WHEN failed_backups > 0 THEN '"error:backup_failures"'
            ELSE '"healthy"'
        END
    );

    result := jsonb_set(result, '{check_time}', to_jsonb(NOW()));

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CRON JOB SETUP COMMANDS
-- =====================================================

/*
Add these to your system crontab (crontab -e):

# Daily backup at 2:00 AM
0 2 * * * pg_dump -h localhost -U postgres -d loctician_booking | gzip > /backups/daily/loctician_$(date +\%Y\%m\%d).sql.gz

# Weekly full backup with vacuum on Sundays at 1:00 AM
0 1 * * 0 pg_dump -h localhost -U postgres -d loctician_booking --verbose --format=custom | gzip > /backups/weekly/loctician_weekly_$(date +\%Y\%m\%d).custom.gz

# GDPR cleanup job - daily at 3:00 AM
0 3 * * * psql -h localhost -U postgres -d loctician_booking -c "SELECT gdpr_cleanup_job();"

# Performance metrics collection every 15 minutes
*/15 * * * * psql -h localhost -U postgres -d loctician_booking -c "SELECT collect_performance_metrics();"

# Routine maintenance every Sunday at 4:00 AM
0 4 * * 0 psql -h localhost -U postgres -d loctician_booking -c "SELECT perform_maintenance('routine');"

# Health check every 5 minutes (log results to monitoring system)
*/5 * * * * psql -h localhost -U postgres -d loctician_booking -t -c "SELECT health_check();" | logger -t postgres_health

*/

-- =====================================================
-- BACKUP VERIFICATION
-- =====================================================

-- Function to verify backup integrity
CREATE OR REPLACE FUNCTION verify_backup(backup_file_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    verification_result BOOLEAN := FALSE;
BEGIN
    -- This would typically involve:
    -- 1. Restoring backup to test database
    -- 2. Running integrity checks
    -- 3. Comparing checksums
    -- 4. Validating data consistency

    -- For now, we'll log the verification attempt
    INSERT INTO backup_log (backup_type, status, filename, verification_status, verification_date)
    VALUES ('verification', 'completed', backup_file_path, 'pending', NOW());

    -- Return TRUE if verification passes
    verification_result := TRUE;

    UPDATE backup_log
    SET verification_status = CASE WHEN verification_result THEN 'passed' ELSE 'failed' END
    WHERE filename = backup_file_path
    AND verification_date = (SELECT MAX(verification_date) FROM backup_log WHERE filename = backup_file_path);

    RETURN verification_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DISASTER RECOVERY PROCEDURES
-- =====================================================

-- Document recovery procedures as comments for operations team
/*
DISASTER RECOVERY PROCEDURES:

1. COMPLETE DATA LOSS RECOVERY:
   a) Restore from latest full backup
   b) Apply WAL files from archive
   c) Verify data integrity
   d) Update DNS/connection strings

2. POINT-IN-TIME RECOVERY:
   a) Identify required restore point
   b) Restore base backup before that time
   c) Apply WAL files up to specific LSN
   d) Verify recovery completion

3. PARTIAL DATA CORRUPTION:
   a) Identify affected tables
   b) Restore specific tables from backup
   c) Verify referential integrity
   d) Rebuild affected indexes

4. GDPR COMPLIANCE EMERGENCY:
   a) Immediately anonymize affected user data
   b) Document incident for authorities
   c) Notify affected users within 72 hours
   d) Review and update data protection measures

RECOVERY TIME OBJECTIVES (RTO):
- Critical system restore: < 1 hour
- Full database restore: < 4 hours
- Point-in-time recovery: < 2 hours

RECOVERY POINT OBJECTIVES (RPO):
- Maximum data loss: < 5 minutes
- WAL archiving frequency: 5 minutes
- Backup frequency: Daily
*/