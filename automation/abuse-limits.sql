-- Apply to the existing aimpact-visibility-leads D1 database before deployment.
-- Additive only: existing processed_requests and leads are preserved.
CREATE TABLE IF NOT EXISTS abuse_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK(count >= 1),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS abuse_limits_expiry ON abuse_limits(expires_at);
