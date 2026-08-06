-- Migration: 003_create_articles_tables
-- Description: Add articles, tags, article_tags, article_favorites

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Articles core table
CREATE TABLE IF NOT EXISTS articles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                VARCHAR(255) NOT NULL UNIQUE,
  title               VARCHAR(255) NOT NULL,
  description         TEXT NOT NULL,
  body                TEXT NOT NULL,
  author_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Chuẩn bị sẵn cho cover image (xem PULL4_PLAN.md mục 3).
  -- Chưa có endpoint upload ở pull 4, cột này để NULL cho tới khi làm.
  cover_attachment_id UUID REFERENCES attachments(id) ON DELETE SET NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles (author_id);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles (slug);

-- Tái dùng function update_updated_at_column() đã tạo ở migration 001
DROP TRIGGER IF EXISTS articles_updated_at ON articles;
CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE
);

-- Many-to-many article <-> tag (join table thuần, không cần id riêng)
CREATE TABLE IF NOT EXISTS article_tags (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_article_tags_tag_id ON article_tags (tag_id);

-- Favorites — theo đúng pattern user_follows (id riêng + unique composite index)
CREATE TABLE IF NOT EXISTS article_favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT article_favorites_unique UNIQUE (user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_article_favorites_user_id ON article_favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_article_favorites_article_id ON article_favorites (article_id);