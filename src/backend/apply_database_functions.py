#!/usr/bin/env python
"""Script to apply missing database functions to the PostgreSQL database."""

import asyncio
from sqlalchemy import text
from app.core.database import engine

async def apply_database_functions():
    """Apply missing database functions to the database."""
    print("Applying missing database functions...")

    # SQL statements to execute one by one
    sql_statements = [
        # Create rate limits table
        """
        CREATE TABLE IF NOT EXISTS rate_limits (
            id SERIAL PRIMARY KEY,
            endpoint VARCHAR(255) NOT NULL,
            ip_address INET NOT NULL,
            user_id INTEGER,
            request_count INTEGER DEFAULT 1,
            window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,

        # Create indexes for rate limits
        "CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint_ip ON rate_limits (endpoint, ip_address)",
        "CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits (window_start)",

        # Create rate limit function
        """
        CREATE OR REPLACE FUNCTION check_rate_limit(
            p_endpoint VARCHAR(255),
            p_ip_address VARCHAR(45),
            p_user_id INTEGER,
            p_limit INTEGER DEFAULT 100,
            p_window_minutes INTEGER DEFAULT 60
        ) RETURNS BOOLEAN AS $$
        DECLARE
            current_count INTEGER;
            window_start_time TIMESTAMP;
        BEGIN
            window_start_time := CURRENT_TIMESTAMP - (p_window_minutes || ' minutes')::INTERVAL;

            DELETE FROM rate_limits
            WHERE window_start < window_start_time;

            SELECT COALESCE(SUM(request_count), 0) INTO current_count
            FROM rate_limits
            WHERE endpoint = p_endpoint
              AND ip_address = p_ip_address::INET
              AND window_start >= window_start_time;

            IF current_count < p_limit THEN
                INSERT INTO rate_limits (endpoint, ip_address, user_id, request_count, window_start)
                VALUES (p_endpoint, p_ip_address::INET, p_user_id, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (endpoint, ip_address, window_start)
                DO UPDATE SET
                    request_count = rate_limits.request_count + 1,
                    user_id = COALESCE(p_user_id, rate_limits.user_id);
                RETURN TRUE;
            ELSE
                RETURN FALSE;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN TRUE;
        END;
        $$ LANGUAGE plpgsql
        """,

        # Create audit logs table
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            action VARCHAR(100) NOT NULL,
            ip_address INET,
            user_agent TEXT,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,

        # Create indexes for audit logs
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at)",
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)",

        # Create authenticate user function
        """
        CREATE OR REPLACE FUNCTION authenticate_user(
            p_email VARCHAR(255),
            p_password VARCHAR(255),
            p_ip_address VARCHAR(45),
            p_user_agent TEXT
        ) RETURNS JSON AS $$
        DECLARE
            user_record RECORD;
        BEGIN
            SELECT id, email, password_hash, is_active, is_verified, role, first_name, last_name
            INTO user_record
            FROM users
            WHERE LOWER(email) = LOWER(p_email)
              AND is_active = true;

            IF NOT FOUND THEN
                RETURN json_build_object(
                    'success', false,
                    'error', 'Invalid credentials',
                    'user_id', null
                );
            END IF;

            INSERT INTO audit_logs (user_id, action, ip_address, user_agent, created_at)
            VALUES (user_record.id, 'login_attempt', p_ip_address::INET, p_user_agent, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING;

            RETURN json_build_object(
                'success', true,
                'user_id', user_record.id,
                'email', user_record.email,
                'role', user_record.role,
                'first_name', user_record.first_name,
                'last_name', user_record.last_name,
                'is_verified', user_record.is_verified
            );
        EXCEPTION
            WHEN OTHERS THEN
                RETURN json_build_object(
                    'success', false,
                    'error', 'Authentication system error',
                    'user_id', null
                );
        END;
        $$ LANGUAGE plpgsql
        """,

        # Create current user ID function
        """
        CREATE OR REPLACE FUNCTION current_user_id() RETURNS INTEGER AS $$
        BEGIN
            RETURN NULLIF(current_setting('app.current_user_id', true), '')::INTEGER;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql
        """,

        # Create cleanup function
        """
        CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS void AS $$
        BEGIN
            DELETE FROM rate_limits
            WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '1 day';
        END;
        $$ LANGUAGE plpgsql
        """
    ]

    async with engine.begin() as conn:
        for i, sql in enumerate(sql_statements, 1):
            try:
                print(f"Executing statement {i}/{len(sql_statements)}...")
                await conn.execute(text(sql))
                print(f"✓ Statement {i} executed successfully")
            except Exception as e:
                print(f"✗ Error executing statement {i}: {e}")
                raise

    print("✓ All database functions applied successfully!")

if __name__ == "__main__":
    asyncio.run(apply_database_functions())