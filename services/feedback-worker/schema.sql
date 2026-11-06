-- Cloudflare D1: execute ONCE in the D1 dashboard SQL console.
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  entry_title TEXT NOT NULL,
  section_id TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',
  context_before TEXT NOT NULL DEFAULT '',
  context_after TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '讀者',
  kind TEXT NOT NULL CHECK(kind IN ('question', 'correction', 'supplement')),
  body TEXT NOT NULL,
  admin_reply TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'resolved')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_public ON feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_entry ON feedback(entry_id, status, created_at DESC);
CREATE TABLE IF NOT EXISTS feedback_rate (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_rate_expiry ON feedback_rate(expires_at);

-- 2026-11-06: Independent anonymous article usefulness feedback.
-- Run in the existing Cloudflare D1 database BEFORE deploying the updated Worker.
-- Idempotent: it does not alter or delete existing moderated reader comments.
CREATE TABLE IF NOT EXISTS article_ratings (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  entry_title TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  vote TEXT NOT NULL CHECK(vote IN ('helpful','unresolved')),
  reason TEXT NOT NULL DEFAULT '' CHECK(reason IN ('','missing_answer','unclear','needs_examples','possibly_outdated','layout_issue','other')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entry_id, voter_hash)
);
CREATE INDEX IF NOT EXISTS idx_article_ratings_updated ON article_ratings(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_ratings_entry ON article_ratings(entry_id, updated_at DESC);

-- Separate anonymous rate-limiting table so the old comment limit is unaffected.
CREATE TABLE IF NOT EXISTS article_rating_rate (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_article_rating_rate_expiry ON article_rating_rate(expires_at);
