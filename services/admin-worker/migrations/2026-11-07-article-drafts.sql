-- Phase 2: article editorial drafts. Additive migration on guide-feedback D1.
-- Safe to run repeatedly; existing comments/ratings/users are not altered.
CREATE TABLE IF NOT EXISTS admin_article_drafts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  source_sha TEXT NOT NULL,
  original_text TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','review','changes_requested','staged','published','cancelled')),
  author_email TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  reviewed_by TEXT NOT NULL DEFAULT '',
  review_note TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  pr_number INTEGER NOT NULL DEFAULT 0,
  pr_head_sha TEXT NOT NULL DEFAULT '',
  pr_url TEXT NOT NULL DEFAULT '',
  published_commit TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_article_drafts_one_active
  ON admin_article_drafts(slug) WHERE status NOT IN ('published','cancelled');
CREATE INDEX IF NOT EXISTS idx_admin_article_drafts_status
  ON admin_article_drafts(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_article_drafts_author
  ON admin_article_drafts(author_email,updated_at DESC);
