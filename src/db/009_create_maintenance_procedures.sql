-- Migration 009: Maintenance Procedures and Automation
-- PostgreSQL 17 Enhanced Authentication System
-- Created: 2025-09-26

-- Create maintenance configuration table
CREATE TABLE maintenance_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default maintenance configuration
INSERT INTO maintenance_config (config_key, config_value, description) VALUES
    ('session_cleanup_hours', '24', 'Hours after which inactive sessions are cleaned up'),
    ('password_reset_token_hours', '2', 'Hours after which password reset tokens expire'),
    ('failed_login_lockout_minutes', '15', 'Minutes to lock account after failed login attempts'),
    ('max_failed_login_attempts', '5', 'Maximum failed login attempts before lockout'),
    ('vacuum_analyze_schedule', '02:00', 'Daily time to run vacuum analyze'),
    ('backup_retention_days', '30', 'Days to retain automated backups'),
    ('audit_log_retention_months', '12', 'Months to retain audit log data'),
    ('daily_metrics_refresh_time', '03:00', 'Daily time to refresh materialized views');

-- Create comprehensive cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS TABLE(
    cleanup_type TEXT,
    records_affected INTEGER,
    execution_time INTERVAL
) AS $$
DECLARE
    start_time TIMESTAMPTZ;
    session_hours INTEGER;
    token_hours INTEGER;
    affected_count INTEGER;
BEGIN
    start_time := CURRENT_TIMESTAMP;

    -- Get configuration values
    SELECT config_value::INTEGER INTO session_hours
    FROM maintenance_config WHERE config_key = 'session_cleanup_hours';

    SELECT config_value::INTEGER INTO token_hours
    FROM maintenance_config WHERE config_key = 'password_reset_token_hours';

    -- Cleanup expired sessions
    DELETE FROM user_sessions
    WHERE expires_at < CURRENT_TIMESTAMP - (session_hours || ' hours')::INTERVAL
       OR (is_active = false AND created_at < CURRENT_TIMESTAMP - INTERVAL '7 days');

    GET DIAGNOSTICS affected_count = ROW_COUNT;

    RETURN QUERY SELECT
        'expired_sessions'::TEXT,
        affected_count,
        CURRENT_TIMESTAMP - start_time;

    start_time := CURRENT_TIMESTAMP;

    -- Cleanup expired password reset tokens
    UPDATE users
    SET password_reset_token = NULL,
        password_reset_expires = NULL
    WHERE password_reset_expires < CURRENT_TIMESTAMP - (token_hours || ' hours')::INTERVAL;

    GET DIAGNOSTICS affected_count = ROW_COUNT;

    RETURN QUERY SELECT
        'expired_reset_tokens'::TEXT,
        affected_count,
        CURRENT_TIMESTAMP - start_time;

    start_time := CURRENT_TIMESTAMP;

    -- Cleanup old email verification tokens (older than 7 days)
    UPDATE users
    SET email_verification_token = NULL
    WHERE email_verification_token IS NOT NULL
      AND created_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
      AND email_verified = false;

    GET DIAGNOSTICS affected_count = ROW_COUNT;

    RETURN QUERY SELECT
        'expired_verification_tokens'::TEXT,
        affected_count,
        CURRENT_TIMESTAMP - start_time;

    start_time := CURRENT_TIMESTAMP;

    -- Unlock accounts that have passed lockout period
    UPDATE users
    SET locked_until = NULL,
        failed_login_attempts = 0
    WHERE locked_until < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS affected_count = ROW_COUNT;

    RETURN QUERY SELECT
        'unlocked_accounts'::TEXT,
        affected_count,
        CURRENT_TIMESTAMP - start_time;

    start_time := CURRENT_TIMESTAMP;

    -- Archive old audit logs (move to archive table if needed)
    -- For now, just delete logs older than retention period
    DELETE FROM audit_logs
    WHERE created_at < CURRENT_TIMESTAMP -
          (SELECT (config_value || ' months')::INTERVAL FROM maintenance_config WHERE config_key = 'audit_log_retention_months');

    GET DIAGNOSTICS affected_count = ROW_COUNT;

    RETURN QUERY SELECT
        'archived_audit_logs'::TEXT,
        affected_count,
        CURRENT_TIMESTAMP - start_time;

    -- Log the cleanup operation
    INSERT INTO system_logs (log_type, message, metadata)
    VALUES ('maintenance', 'Cleanup expired data completed',
            json_build_object('execution_timestamp', CURRENT_TIMESTAMP));

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user account lockout function
CREATE OR REPLACE FUNCTION handle_failed_login(user_email VARCHAR(255), client_ip INET DEFAULT NULL)
RETURNS TABLE(
    is_locked BOOLEAN,
    locked_until TIMESTAMPTZ,
    attempts_remaining INTEGER
) AS $$
DECLARE
    max_attempts INTEGER;
    lockout_minutes INTEGER;
    current_attempts INTEGER;
    user_locked_until TIMESTAMPTZ;
BEGIN
    -- Get configuration
    SELECT config_value::INTEGER INTO max_attempts
    FROM maintenance_config WHERE config_key = 'max_failed_login_attempts';

    SELECT config_value::INTEGER INTO lockout_minutes
    FROM maintenance_config WHERE config_key = 'failed_login_lockout_minutes';

    -- Update failed login attempts
    UPDATE users
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
            WHEN failed_login_attempts + 1 >= max_attempts THEN
                CURRENT_TIMESTAMP + (lockout_minutes || ' minutes')::INTERVAL
            ELSE locked_until
        END
    WHERE email = user_email
      AND is_active = true;

    -- Get current status
    SELECT failed_login_attempts, users.locked_until
    INTO current_attempts, user_locked_until
    FROM users
    WHERE email = user_email;

    -- Log the failed attempt
    INSERT INTO system_logs (log_type, message, metadata)
    VALUES ('security', 'Failed login attempt',
            json_build_object(
                'email', user_email,
                'ip_address', client_ip::TEXT,
                'attempts', current_attempts,
                'locked', user_locked_until IS NOT NULL
            ));

    RETURN QUERY SELECT
        user_locked_until IS NOT NULL AND user_locked_until > CURRENT_TIMESTAMP,
        user_locked_until,
        GREATEST(0, max_attempts - current_attempts);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create successful login function
CREATE OR REPLACE FUNCTION handle_successful_login(user_email VARCHAR(255), client_ip INET DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    -- Reset failed login attempts and update last login
    UPDATE users
    SET failed_login_attempts = 0,
        locked_until = NULL,
        last_login_at = CURRENT_TIMESTAMP,
        last_login_ip = client_ip
    WHERE email = user_email;

    -- Log the successful login
    INSERT INTO system_logs (log_type, message, metadata)
    VALUES ('auth', 'Successful login',
            json_build_object(
                'email', user_email,
                'ip_address', client_ip::TEXT,
                'timestamp', CURRENT_TIMESTAMP
            ));

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create database statistics collection function
CREATE OR REPLACE FUNCTION collect_database_stats()
RETURNS TABLE(
    stat_name TEXT,
    stat_value BIGINT,
    collection_time TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'total_users'::TEXT, COUNT(*)::BIGINT, CURRENT_TIMESTAMP
    FROM users WHERE is_active = true

    UNION ALL

    SELECT 'active_sessions'::TEXT, COUNT(*)::BIGINT, CURRENT_TIMESTAMP
    FROM user_sessions WHERE is_active = true AND expires_at > CURRENT_TIMESTAMP

    UNION ALL

    SELECT 'total_bookings'::TEXT, COUNT(*)::BIGINT, CURRENT_TIMESTAMP
    FROM bookings

    UNION ALL

    SELECT 'active_subscriptions'::TEXT, COUNT(*)::BIGINT, CURRENT_TIMESTAMP
    FROM user_subscriptions us
    JOIN subscription_statuses ss ON us.status_id = ss.id
    WHERE ss.is_active_status = true

    UNION ALL

    SELECT 'database_size_mb'::TEXT, (pg_database_size(current_database()) / 1024 / 1024)::BIGINT, CURRENT_TIMESTAMP;

    -- Store stats in system_logs for historical tracking
    INSERT INTO system_logs (log_type, message, metadata)
    SELECT 'statistics', 'Database stats collected',
           json_build_object(
               'total_users', (SELECT COUNT(*) FROM users WHERE is_active = true),
               'active_sessions', (SELECT COUNT(*) FROM user_sessions WHERE is_active = true AND expires_at > CURRENT_TIMESTAMP),
               'total_bookings', (SELECT COUNT(*) FROM bookings),
               'active_subscriptions', (SELECT COUNT(*) FROM user_subscriptions us JOIN subscription_statuses ss ON us.status_id = ss.id WHERE ss.is_active_status = true),
               'database_size_mb', pg_database_size(current_database()) / 1024 / 1024
           );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create backup verification function
CREATE OR REPLACE FUNCTION verify_backup_integrity()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check critical tables have data
    RETURN QUERY
    SELECT 'users_table'::TEXT,
           CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'FAIL' END,
           'Users count: ' || COUNT(*)::TEXT
    FROM users;

    RETURN QUERY
    SELECT 'roles_table'::TEXT,
           CASE WHEN COUNT(*) >= 3 THEN 'OK' ELSE 'FAIL' END,
           'Roles count: ' || COUNT(*)::TEXT
    FROM roles;

    RETURN QUERY
    SELECT 'permissions_table'::TEXT,
           CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'FAIL' END,
           'Permissions count: ' || COUNT(*)::TEXT
    FROM permissions;

    -- Check foreign key constraints
    RETURN QUERY
    SELECT 'foreign_keys'::TEXT,
           CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'FAIL' END,
           'Active FK constraints: ' || COUNT(*)::TEXT
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public';

    -- Check indexes
    RETURN QUERY
    SELECT 'indexes'::TEXT,
           CASE WHEN COUNT(*) > 10 THEN 'OK' ELSE 'FAIL' END,
           'Total indexes: ' || COUNT(*)::TEXT
    FROM pg_indexes
    WHERE schemaname = 'public';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create automated maintenance schedule
CREATE OR REPLACE FUNCTION run_daily_maintenance()
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    cleanup_results RECORD;
    stats_collected BOOLEAN := false;
BEGIN
    result := 'Daily maintenance started at ' || CURRENT_TIMESTAMP || E'\n';

    -- Run cleanup
    result := result || E'\nCleanup Results:\n';
    FOR cleanup_results IN SELECT * FROM cleanup_expired_data() LOOP
        result := result || cleanup_results.cleanup_type || ': ' ||
                  cleanup_results.records_affected || ' records (' ||
                  cleanup_results.execution_time || ')' || E'\n';
    END LOOP;

    -- Refresh materialized views
    BEGIN
        PERFORM refresh_daily_metrics();
        result := result || E'\nMaterialized views refreshed successfully\n';
    EXCEPTION WHEN OTHERS THEN
        result := result || E'\nERROR refreshing materialized views: ' || SQLERRM || E'\n';
    END;

    -- Create monthly partitions
    BEGIN
        PERFORM create_monthly_partition();
        result := result || E'\nMonthly partitions checked/created\n';
    EXCEPTION WHEN OTHERS THEN
        result := result || E'\nERROR managing partitions: ' || SQLERRM || E'\n';
    END;

    -- Collect statistics
    BEGIN
        PERFORM collect_database_stats();
        stats_collected := true;
        result := result || E'\nDatabase statistics collected\n';
    EXCEPTION WHEN OTHERS THEN
        result := result || E'\nERROR collecting statistics: ' || SQLERRM || E'\n';
    END;

    -- Run VACUUM ANALYZE on critical tables
    BEGIN
        VACUUM ANALYZE users;
        VACUUM ANALYZE bookings;
        VACUUM ANALYZE user_subscriptions;
        result := result || E'\nVACUUM ANALYZE completed on critical tables\n';
    EXCEPTION WHEN OTHERS THEN
        result := result || E'\nERROR during VACUUM ANALYZE: ' || SQLERRM || E'\n';
    END;

    result := result || E'\nDaily maintenance completed at ' || CURRENT_TIMESTAMP;

    -- Log the maintenance run
    INSERT INTO system_logs (log_type, message, metadata)
    VALUES ('maintenance', 'Daily maintenance completed',
            json_build_object('completion_time', CURRENT_TIMESTAMP, 'stats_collected', stats_collected));

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create health check function
CREATE OR REPLACE FUNCTION system_health_check()
RETURNS TABLE(
    component TEXT,
    status TEXT,
    message TEXT,
    last_check TIMESTAMPTZ
) AS $$
BEGIN
    -- Check database connectivity
    RETURN QUERY SELECT 'database'::TEXT, 'healthy'::TEXT, 'Database connection OK'::TEXT, CURRENT_TIMESTAMP;

    -- Check table integrity
    RETURN QUERY
    SELECT 'table_integrity'::TEXT,
           CASE WHEN COUNT(*) = 0 THEN 'healthy' ELSE 'warning' END,
           'Missing tables: ' || COALESCE(STRING_AGG(table_name, ', '), 'none'),
           CURRENT_TIMESTAMP
    FROM (
        SELECT unnest(ARRAY['users', 'roles', 'permissions', 'bookings', 'services']) as table_name
        EXCEPT
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ) missing_tables;

    -- Check for locked accounts
    RETURN QUERY
    SELECT 'locked_accounts'::TEXT,
           CASE WHEN COUNT(*) = 0 THEN 'healthy'
                WHEN COUNT(*) < 10 THEN 'warning'
                ELSE 'critical'
           END,
           'Locked accounts: ' || COUNT(*)::TEXT,
           CURRENT_TIMESTAMP
    FROM users
    WHERE locked_until > CURRENT_TIMESTAMP;

    -- Check for failed payments (if any exist)
    RETURN QUERY
    SELECT 'payment_failures'::TEXT,
           CASE WHEN COUNT(*) = 0 THEN 'healthy'
                WHEN COUNT(*) < 5 THEN 'warning'
                ELSE 'critical'
           END,
           'Failed payments today: ' || COUNT(*)::TEXT,
           CURRENT_TIMESTAMP
    FROM payment_transactions
    WHERE status = 'failed'
      AND created_at >= CURRENT_DATE;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for maintenance functions
GRANT EXECUTE ON FUNCTION cleanup_expired_data() TO app_admin;
GRANT EXECUTE ON FUNCTION handle_failed_login(VARCHAR, INET) TO app_admin, app_staff, app_customer, app_anonymous;
GRANT EXECUTE ON FUNCTION handle_successful_login(VARCHAR, INET) TO app_admin, app_staff, app_customer, app_anonymous;
GRANT EXECUTE ON FUNCTION collect_database_stats() TO app_admin;
GRANT EXECUTE ON FUNCTION verify_backup_integrity() TO app_admin;
GRANT EXECUTE ON FUNCTION run_daily_maintenance() TO app_admin;
GRANT EXECUTE ON FUNCTION system_health_check() TO app_admin, app_staff;

-- Comments for documentation
COMMENT ON TABLE maintenance_config IS 'Configuration settings for automated maintenance procedures';
COMMENT ON FUNCTION cleanup_expired_data() IS 'Comprehensive cleanup of expired sessions, tokens, and old data';
COMMENT ON FUNCTION handle_failed_login IS 'Handles failed login attempts with automatic account locking';
COMMENT ON FUNCTION handle_successful_login IS 'Resets failed login counters and updates login tracking';
COMMENT ON FUNCTION run_daily_maintenance() IS 'Complete daily maintenance routine - schedule to run at 2 AM';
COMMENT ON FUNCTION system_health_check() IS 'Comprehensive system health monitoring';

-- Display maintenance setup completion
DO $$
BEGIN
    RAISE NOTICE 'Maintenance procedures configured successfully!';
    RAISE NOTICE 'Recommended cron schedule:';
    RAISE NOTICE '  Daily maintenance: 0 2 * * * (2 AM daily)';
    RAISE NOTICE '  Health checks: */15 * * * * (every 15 minutes)';
    RAISE NOTICE 'Use: SELECT run_daily_maintenance() to test maintenance routine';
END $$;