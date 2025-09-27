-- Migration 003: Create Users Table
-- PostgreSQL 17 Enhanced Authentication System
-- Created: 2025-09-26

-- Create users table with enhanced security
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),

    -- Authentication fields
    email_verified BOOLEAN NOT NULL DEFAULT false,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,

    -- Security fields
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,

    -- Account status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create user_roles junction table
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (user_id, role_id)
);

-- Create user sessions table for session management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes with PostgreSQL 17 optimizations
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email)) WHERE is_active = true;
CREATE INDEX idx_users_email_verified ON users (email_verified) WHERE is_active = true;
CREATE INDEX idx_users_password_reset ON users (password_reset_token) WHERE password_reset_token IS NOT NULL;
CREATE INDEX idx_users_locked ON users (locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX idx_users_last_login ON users (last_login_at DESC) WHERE is_active = true;

CREATE INDEX idx_user_roles_user_active ON user_roles (user_id) WHERE is_active = true;
CREATE INDEX idx_user_roles_role_active ON user_roles (role_id) WHERE is_active = true;

CREATE INDEX idx_user_sessions_token ON user_sessions (session_token) WHERE is_active = true;
CREATE INDEX idx_user_sessions_user_active ON user_sessions (user_id) WHERE is_active = true;
CREATE INDEX idx_user_sessions_expires ON user_sessions (expires_at) WHERE is_active = true;

-- Add foreign key constraint for role_permissions.granted_by
ALTER TABLE role_permissions
ADD CONSTRAINT fk_role_permissions_granted_by
FOREIGN KEY (granted_by) REFERENCES users(id);

-- Apply updated_at trigger to users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to get user's highest priority role
CREATE OR REPLACE FUNCTION get_user_highest_role(user_uuid UUID)
RETURNS TABLE(role_id INTEGER, role_name VARCHAR(50), priority INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.name, r.priority
    FROM roles r
    JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = user_uuid
      AND ur.is_active = true
      AND r.is_active = true
    ORDER BY r.priority DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check user permission
CREATE OR REPLACE FUNCTION user_has_permission(user_uuid UUID, resource_name VARCHAR(50), action_name VARCHAR(20))
RETURNS BOOLEAN AS $$
DECLARE
    has_perm BOOLEAN := false;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = user_uuid
          AND u.is_active = true
          AND ur.is_active = true
          AND r.is_active = true
          AND p.is_active = true
          AND p.resource = resource_name
          AND p.action = action_name
    ) INTO has_perm;

    RETURN has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Password hashing function using PostgreSQL's built-in crypto
CREATE OR REPLACE FUNCTION hash_password(plain_password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(plain_password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Password verification function
CREATE OR REPLACE FUNCTION verify_password(plain_password TEXT, hashed_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN hashed_password = crypt(plain_password, hashed_password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE users IS 'Main users table with authentication and security fields';
COMMENT ON TABLE user_roles IS 'Junction table mapping users to their assigned roles';
COMMENT ON TABLE user_sessions IS 'Active user sessions for session management';
COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for failed login attempts - resets on successful login';
COMMENT ON COLUMN users.locked_until IS 'Account lock expiration timestamp';
COMMENT ON FUNCTION get_user_highest_role(UUID) IS 'Returns the highest priority role for a user';
COMMENT ON FUNCTION user_has_permission(UUID, VARCHAR, VARCHAR) IS 'Checks if user has specific permission';