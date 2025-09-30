-- Migration 012: Ensure email_templates.id has default UUID generation
-- This migration addresses cases where the id column lacks a default,
-- causing inserts that omit the id value to fail.

ALTER TABLE email_templates
    ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Backfill any rows that still have NULL ids (should not normally occur),
-- assigning new UUIDs just in case.
UPDATE email_templates
SET id = uuid_generate_v4()
WHERE id IS NULL;
