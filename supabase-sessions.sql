-- ============================================
-- Sessions table for express-session persistence
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess JSONB NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires);

-- RLS: Allow service role full access (sessions are managed server-side)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (the server uses the service key)
CREATE POLICY "Service role full access" ON sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);
