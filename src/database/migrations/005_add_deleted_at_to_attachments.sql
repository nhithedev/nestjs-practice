-- Migration: 005_add_deleted_at_to_attachments
-- Description: Add soft delete support for attachments

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;