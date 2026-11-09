-- PRIVATE Cloudflare R2 draft attachment metadata.
-- Applied idempotently by the admin Worker on first use. No existing data altered.
CREATE TABLE IF NOT EXISTS admin_draft_assets (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  original_name TEXT NOT NULL,
  ext TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256_hex TEXT NOT NULL,
  object_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_draft_assets_draft
  ON admin_draft_assets(draft_id,created_at);
-- Files are stored privately in R2 binding GUIDE_MEDIA and are not made public
-- until a reviewed GitHub Pull Request is merged to main.
