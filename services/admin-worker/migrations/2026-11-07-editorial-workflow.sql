-- Phase 2: article drafting/review, additive to the EXISTING guide-feedback D1.
-- IMPORTANT: Back up D1 before running. Apply only once DRAFTS_ENABLED is still false.
-- Repeatable. Does not mutate public feedback, ratings or existing admin users.
CREATE TABLE IF NOT EXISTS admin_article_drafts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','submitted','changes_requested','approved','pr_ready','published')),
  original_blob_sha TEXT NOT NULL,
  original_content TEXT NOT NULL,
  draft_content TEXT NOT NULL,
  original_seo_sha TEXT NOT NULL,
  original_seo_title TEXT NOT NULL,
  original_seo_description TEXT NOT NULL,
  seo_title TEXT NOT NULL,
  seo_description TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_by TEXT NOT NULL COLLATE NOCASE,
  updated_by TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  reviewed_by TEXT COLLATE NOCASE,
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT,
  github_branch TEXT,
  github_pr_number INTEGER,
  github_pr_url TEXT,
  prepared_md_blob_sha TEXT,
  prepared_seo_blob_sha TEXT,
  github_merge_sha TEXT,
  published_at TEXT
);
-- One active editorial workflow per article. Published rows remain as history.
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_drafts_active_slug
ON admin_article_drafts(slug)
WHERE status IN ('draft','submitted','changes_requested','approved','pr_ready');
CREATE INDEX IF NOT EXISTS idx_article_drafts_status
ON admin_article_drafts(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_drafts_author
ON admin_article_drafts(created_by, updated_at DESC);

-- No new credentials or private user emails are seeded in a public migration.
-- After verifying this migration, set Worker variable DRAFTS_ENABLED=true.
-- To enable GitHub publication, add GITHUB_EDITOR_TOKEN as a private Worker Secret.
