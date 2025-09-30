-- Migration 013: Extend templatetype enum with contact and internal notifications
-- Ensures email workflows cover marketing, contact, admin, and staff use cases
DO $$
BEGIN
    -- Add new values if they do not already exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'templatetype' AND e.enumlabel = 'CONTACT'
    ) THEN
        ALTER TYPE templatetype ADD VALUE 'CONTACT';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'templatetype' AND e.enumlabel = 'ADMIN_NOTIFICATION'
    ) THEN
        ALTER TYPE templatetype ADD VALUE 'ADMIN_NOTIFICATION';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'templatetype' AND e.enumlabel = 'STAFF_NOTIFICATION'
    ) THEN
        ALTER TYPE templatetype ADD VALUE 'STAFF_NOTIFICATION';
    END IF;
END
$$;
