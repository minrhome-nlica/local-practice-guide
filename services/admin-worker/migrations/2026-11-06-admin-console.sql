-- Admin console phase 1. Run in the EXISTING guide-feedback D1 database after a backup.
-- Additive and repeatable. Does not change public comments or article ratings.
CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK(role IN ('owner','editor','moderator')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(active, role);

CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit(actor_email, created_at DESC);

-- Bootstrap the first owner MANUALLY in the private D1 console, not in this public file.
-- Replace with your OWN verified Email. Never share an Access token/password here.
-- INSERT INTO admin_users (email, display_name, role, active, created_at, updated_at)
-- VALUES (lower('YOUR_EMAIL@example.com'), '網站負責人', 'owner', 1, datetime('now'), datetime('now'));
