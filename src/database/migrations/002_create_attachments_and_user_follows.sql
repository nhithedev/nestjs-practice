-- Migration: 002_create_attachments_and_user_follows
-- Description: Add polymorphic attachments and user follow relationships

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachable_type  VARCHAR(100) NOT NULL,
  attachable_id    UUID NOT NULL,
  url              VARCHAR(2048) NOT NULL,
  file_name        VARCHAR(255) NOT NULL,
  file_type        VARCHAR(100) NOT NULL,
  file_size        INTEGER NOT NULL,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_attachable
  ON attachments (attachable_type, attachable_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_attachment_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_avatar_attachment_fk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_avatar_attachment_fk
      FOREIGN KEY (avatar_attachment_id)
      REFERENCES attachments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_follows (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_follows_unique UNIQUE (follower_id, following_id),
  CONSTRAINT user_follows_not_self CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON user_follows (following_id);