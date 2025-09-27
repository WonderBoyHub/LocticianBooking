-- Migration 002: Create Roles and Permissions Tables
-- PostgreSQL 17 Enhanced Authentication System
-- Created: 2025-09-26

-- Create roles table with PostgreSQL 17 optimizations
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 0, -- Higher number = higher priority
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create permissions table for granular access control
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    resource VARCHAR(50) NOT NULL, -- users, bookings, subscriptions, etc.
    action VARCHAR(20) NOT NULL,   -- create, read, update, delete
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create role_permissions junction table
CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER, -- Will reference users.id after users table is created
    PRIMARY KEY (role_id, permission_id)
);

-- Performance indexes using PostgreSQL 17 improvements
CREATE INDEX idx_roles_name_active ON roles (name) WHERE is_active = true;
CREATE INDEX idx_roles_priority ON roles (priority DESC) WHERE is_active = true;
CREATE INDEX idx_permissions_resource_action ON permissions (resource, action) WHERE is_active = true;
CREATE INDEX idx_role_permissions_lookup ON role_permissions (role_id, permission_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to roles table
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE roles IS 'System roles for RBAC implementation';
COMMENT ON TABLE permissions IS 'Granular permissions for resources and actions';
COMMENT ON TABLE role_permissions IS 'Junction table mapping roles to permissions';
COMMENT ON COLUMN roles.priority IS 'Role hierarchy - higher numbers have more privileges';