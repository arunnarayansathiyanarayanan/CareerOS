-- E6 Resume Optimizer: async variant generation job tracking
CREATE TABLE IF NOT EXISTS resume_jobs (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_jobs_version_id ON resume_jobs (version_id);
