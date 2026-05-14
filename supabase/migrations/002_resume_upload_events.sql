-- Track resume uploads for per-user hourly rate limiting (API route uses service role).

CREATE TABLE resume_upload_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resume_upload_events_clerk_created
  ON resume_upload_events (clerk_id, created_at DESC);

ALTER TABLE resume_upload_events ENABLE ROW LEVEL SECURITY;
