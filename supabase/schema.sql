-- ReelNotes Database Schema
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS reels (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Processing Reel',
  content_type TEXT DEFAULT 'Recipe',
  structured_text TEXT DEFAULT '',
  raw_transcript TEXT DEFAULT '',
  raw_ocr TEXT DEFAULT '',
  source_transcript TEXT DEFAULT '',
  recipe_json JSONB,
  processing_error TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'ready', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE reels ADD COLUMN IF NOT EXISTS source_transcript TEXT DEFAULT '';
ALTER TABLE reels ADD COLUMN IF NOT EXISTS recipe_json JSONB;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE reels DROP CONSTRAINT IF EXISTS reels_status_check;
ALTER TABLE reels ADD CONSTRAINT reels_status_check CHECK (status IN ('queued', 'processing', 'ready', 'failed'));

CREATE TABLE IF NOT EXISTS reel_jobs (
  id BIGSERIAL PRIMARY KEY,
  reel_id BIGINT NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reels_created_at ON reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_content_type ON reels(content_type);
CREATE INDEX IF NOT EXISTS idx_reels_status_created ON reels(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_owner_created ON reels(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reel_jobs_status_created ON reel_jobs(status, created_at);

ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON reels;
DROP POLICY IF EXISTS "Enable insert for all users" ON reels;
DROP POLICY IF EXISTS "Enable update for all users" ON reels;
DROP POLICY IF EXISTS "Enable delete for all users" ON reels;
DROP POLICY IF EXISTS "Enable read access for all users" ON reel_jobs;
DROP POLICY IF EXISTS "Enable insert for all users" ON reel_jobs;
DROP POLICY IF EXISTS "Enable update for all users" ON reel_jobs;
DROP POLICY IF EXISTS "Enable delete for all users" ON reel_jobs;
DROP POLICY IF EXISTS "Users can read own reels" ON reels;
DROP POLICY IF EXISTS "Users can insert own reels" ON reels;
DROP POLICY IF EXISTS "Users can update own reels" ON reels;
DROP POLICY IF EXISTS "Users can delete own reels" ON reels;
DROP POLICY IF EXISTS "Users can read own reel jobs" ON reel_jobs;
DROP POLICY IF EXISTS "Users can insert own reel jobs" ON reel_jobs;
DROP POLICY IF EXISTS "Users can update own reel jobs" ON reel_jobs;
DROP POLICY IF EXISTS "Users can delete own reel jobs" ON reel_jobs;

CREATE POLICY "Users can read own reels" ON reels
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own reels" ON reels
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own reels" ON reels
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own reels" ON reels
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can read own reel jobs" ON reel_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reels r
      WHERE r.id = reel_jobs.reel_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own reel jobs" ON reel_jobs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM reels r
      WHERE r.id = reel_jobs.reel_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own reel jobs" ON reel_jobs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM reels r
      WHERE r.id = reel_jobs.reel_id
        AND r.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM reels r
      WHERE r.id = reel_jobs.reel_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own reel jobs" ON reel_jobs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM reels r
      WHERE r.id = reel_jobs.reel_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_reels_updated_at ON reels;
CREATE TRIGGER update_reels_updated_at
  BEFORE UPDATE ON reels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reel_jobs_updated_at ON reel_jobs;
CREATE TRIGGER update_reel_jobs_updated_at
  BEFORE UPDATE ON reel_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION claim_reel_job()
RETURNS TABLE (
  job_id BIGINT,
  reel_id BIGINT,
  reel_url TEXT,
  attempt_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH next_job AS (
    SELECT rj.id, rj.reel_id, r.url, rj.attempt_count
    FROM reel_jobs rj
    JOIN reels r ON r.id = rj.reel_id
    WHERE rj.status = 'queued'
    ORDER BY rj.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  ),
  updated_job AS (
    UPDATE reel_jobs rj
    SET
      status = 'processing',
      attempt_count = rj.attempt_count + 1,
      updated_at = NOW()
    FROM next_job nj
    WHERE rj.id = nj.id
    RETURNING rj.id, rj.reel_id, nj.url, rj.attempt_count
  )
  UPDATE reels r
  SET status = 'processing', processing_error = NULL, updated_at = NOW()
  FROM updated_job uj
  WHERE r.id = uj.reel_id
  RETURNING uj.id, uj.reel_id, uj.url, uj.attempt_count;
END;
$$;
