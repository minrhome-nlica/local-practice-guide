-- Article editing workflow phase 2.
-- BACK UP the existing guide-feedback D1 before running. Additive, repeatable.
-- Editors work in D1; only approved PRs merged into GitHub main are published.
CREATE TABLE IF NOT EXISTS article_drafts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  original_body TEXT NOT NULL,
  draft_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','submitted','changes_requested','pr_open','published','cancelled')),
  author_email TEXT NOT NULL,
  reviewer_email TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  pr_number INTEGER,
  pr_url TEXT,
  pr_head_sha TEXT,
  publish_sha TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  reviewed_at TEXT,
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_article_drafts_status
  ON article_drafts(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_drafts_author
  ON article_drafts(author_email, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_drafts_slug
  ON article_drafts(slug, updated_at DESC);
-- This intentionally does NOT change the public feedback/comment tables.
-- Existing admin_audit stores all draft-review and publish actions.
