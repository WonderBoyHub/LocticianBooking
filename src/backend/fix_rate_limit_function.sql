-- Fix rate limit function to return JSON instead of boolean

DROP FUNCTION IF EXISTS check_rate_limit(VARCHAR(255), VARCHAR(45), INTEGER, INTEGER, INTEGER);

-- Function to check rate limits (returns JSON)
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_endpoint VARCHAR(255),
    p_ip_address VARCHAR(45),  -- IPv4 or IPv6 address as string
    p_user_id INTEGER,
    p_limit INTEGER DEFAULT 100,
    p_window_minutes INTEGER DEFAULT 60
) RETURNS JSON AS $$
DECLARE
    current_count INTEGER;
    window_start_time TIMESTAMP;
    remaining_requests INTEGER;
BEGIN
    -- Calculate window start time
    window_start_time := CURRENT_TIMESTAMP - (p_window_minutes || ' minutes')::INTERVAL;

    -- Clean up old entries
    DELETE FROM rate_limits
    WHERE window_start < window_start_time;

    -- Count current requests in the time window
    SELECT COALESCE(SUM(request_count), 0) INTO current_count
    FROM rate_limits
    WHERE endpoint = p_endpoint
      AND ip_address = p_ip_address::INET
      AND window_start >= window_start_time;

    -- Calculate remaining requests
    remaining_requests := GREATEST(0, p_limit - current_count);

    -- If under limit, record this request
    IF current_count < p_limit THEN
        -- Try to update existing record or insert new one
        INSERT INTO rate_limits (endpoint, ip_address, user_id, request_count, window_start)
        VALUES (p_endpoint, p_ip_address::INET, p_user_id, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (endpoint, ip_address, window_start)
        DO UPDATE SET
            request_count = rate_limits.request_count + 1,
            user_id = COALESCE(p_user_id, rate_limits.user_id);

        -- Return success with rate limit info
        RETURN json_build_object(
            'allowed', true,
            'limit', p_limit,
            'remaining', GREATEST(0, remaining_requests - 1),
            'reset_at', extract(epoch from (CURRENT_TIMESTAMP + (p_window_minutes || ' minutes')::INTERVAL)),
            'window_minutes', p_window_minutes
        );
    ELSE
        -- Return rate limit exceeded
        RETURN json_build_object(
            'allowed', false,
            'limit', p_limit,
            'remaining', 0,
            'reset_at', extract(epoch from (CURRENT_TIMESTAMP + (p_window_minutes || ' minutes')::INTERVAL)),
            'window_minutes', p_window_minutes,
            'reason', 'LIMIT_EXCEEDED'
        );
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        -- If there's any error, allow the request (fail open)
        RETURN json_build_object(
            'allowed', true,
            'limit', p_limit,
            'remaining', p_limit,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;