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
