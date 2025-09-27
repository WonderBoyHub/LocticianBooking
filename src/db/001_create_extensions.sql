-- Migration 001: Create Extensions
-- PostgreSQL 17 Enhanced Booking System
-- Created: 2025-09-26
-- Enhanced with advanced PostgreSQL 17 features

-- Enable core extensions for booking system
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- PostgreSQL 17 advanced extensions for booking system
CREATE EXTENSION IF NOT EXISTS "btree_gist";     -- Required for time range exclusion constraints
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Full-text search optimization
CREATE EXTENSION IF NOT EXISTS "tablefunc";     -- Cross-tab queries for reporting
CREATE EXTENSION IF NOT EXISTS "unaccent";      -- Text search without accents
CREATE EXTENSION IF NOT EXISTS "pg_partman";    -- Advanced partitioning (if available)

-- Time zone support for international bookings
CREATE EXTENSION IF NOT EXISTS "timezonedb" CASCADE;

-- Advanced indexing for complex queries
CREATE EXTENSION IF NOT EXISTS "bloom";         -- Bloom filters for large datasets
CREATE EXTENSION IF NOT EXISTS "cube";          -- Multi-dimensional indexing
CREATE EXTENSION IF NOT EXISTS "ltree";         -- Hierarchical data (service categories)

-- Performance monitoring and optimization
CREATE EXTENSION IF NOT EXISTS "pg_buffercache"; -- Buffer cache inspection
CREATE EXTENSION IF NOT EXISTS "pg_prewarm";     -- Table prewarming

-- Enable row-level security globally
ALTER SYSTEM SET row_security = on;

-- PostgreSQL 17 performance settings for booking system
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements,pg_prewarm';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Time zone configuration for Danish business
ALTER SYSTEM SET timezone = 'Europe/Copenhagen';
ALTER SYSTEM SET log_timezone = 'Europe/Copenhagen';

-- Logging configuration for audit compliance
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';

-- Performance monitoring
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_functions = all;
ALTER SYSTEM SET track_io_timing = on;

COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions for booking system';
COMMENT ON EXTENSION "pgcrypto" IS 'Cryptographic functions for secure password hashing';
COMMENT ON EXTENSION "pg_stat_statements" IS 'Query performance monitoring and optimization';
COMMENT ON EXTENSION "btree_gist" IS 'Required for booking time range exclusion constraints';
COMMENT ON EXTENSION "pg_trgm" IS 'Full-text search optimization for services and content';
COMMENT ON EXTENSION "tablefunc" IS 'Cross-tab queries for business reporting';
COMMENT ON EXTENSION "unaccent" IS 'Text search without accent sensitivity';
COMMENT ON EXTENSION "bloom" IS 'Bloom filters for large dataset optimization';
COMMENT ON EXTENSION "ltree" IS 'Hierarchical data support for service categories';