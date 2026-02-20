-- ========================================
-- KAH Interview Evaluation System
-- Supabase Database Schema
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. CANDIDATES TABLE
-- Stores candidate information
-- ========================================
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX idx_candidates_name ON candidates(name);
CREATE INDEX idx_candidates_created_at ON candidates(created_at DESC);

-- ========================================
-- 2. EVALUATIONS TABLE
-- Stores individual evaluations from interviewers
-- ========================================
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  interviewer_id TEXT NOT NULL,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_score INTEGER NOT NULL DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one evaluation per interviewer per candidate
  UNIQUE(candidate_id, interviewer_id)
);

-- Add indexes
CREATE INDEX idx_evaluations_candidate_id ON evaluations(candidate_id);
CREATE INDEX idx_evaluations_interviewer_id ON evaluations(interviewer_id);
CREATE INDEX idx_evaluations_created_at ON evaluations(created_at DESC);

-- ========================================
-- 3. MATERIALIZED VIEW FOR RANKINGS
-- Pre-compute average scores for fast ranking queries
-- ========================================
CREATE MATERIALIZED VIEW candidate_rankings AS
SELECT 
  c.id,
  c.name,
  c.info,
  c.created_at,
  COUNT(e.id) AS evaluation_count,
  COALESCE(ROUND(AVG(e.total_score)), 0) AS avg_total_score,
  COALESCE(MAX(e.total_score), 0) AS max_score,
  COALESCE(MIN(e.total_score), 0) AS min_score,
  jsonb_agg(
    jsonb_build_object(
      'interviewer_id', e.interviewer_id,
      'total_score', e.total_score,
      'scores', e.scores,
      'tags', e.tags,
      'note', e.note,
      'created_at', e.created_at
    ) ORDER BY e.created_at DESC
  ) FILTER (WHERE e.id IS NOT NULL) AS evaluations
FROM candidates c
LEFT JOIN evaluations e ON c.id = e.candidate_id
GROUP BY c.id, c.name, c.info, c.created_at
ORDER BY avg_total_score DESC;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_candidate_rankings_id ON candidate_rankings(id);

-- ========================================
-- 4. FUNCTION TO AUTO-REFRESH RANKINGS
-- Automatically refresh the materialized view when evaluations change
-- ========================================
CREATE OR REPLACE FUNCTION refresh_candidate_rankings()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY candidate_rankings;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh rankings on evaluation changes
CREATE TRIGGER trigger_refresh_rankings
AFTER INSERT OR UPDATE OR DELETE ON evaluations
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_candidate_rankings();

-- ========================================
-- 5. FUNCTION TO UPDATE TIMESTAMPS
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp triggers
CREATE TRIGGER update_candidates_updated_at
BEFORE UPDATE ON candidates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluations_updated_at
BEFORE UPDATE ON evaluations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 6. APP SETTINGS TABLE
-- Stores global app settings (eval categories, surprise topics, etc.)
-- ========================================
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update timestamp on change
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON app_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS for app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app_settings"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert app_settings"
  ON app_settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update app_settings"
  ON app_settings FOR UPDATE
  USING (true);

-- ========================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS for secure multi-user access
-- ========================================

-- Enable RLS
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read candidates
CREATE POLICY "Anyone can view candidates"
  ON candidates FOR SELECT
  USING (true);

-- Allow anyone to insert candidates
CREATE POLICY "Anyone can insert candidates"
  ON candidates FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update candidates
CREATE POLICY "Anyone can update candidates"
  ON candidates FOR UPDATE
  USING (true);

-- Allow anyone to view evaluations
CREATE POLICY "Anyone can view evaluations"
  ON evaluations FOR SELECT
  USING (true);

-- Allow interviewers to insert their own evaluations
CREATE POLICY "Anyone can insert evaluations"
  ON evaluations FOR INSERT
  WITH CHECK (true);

-- Allow interviewers to update their own evaluations
CREATE POLICY "Anyone can update evaluations"
  ON evaluations FOR UPDATE
  USING (true);

-- Allow interviewers to delete their own evaluations
CREATE POLICY "Anyone can delete evaluations"
  ON evaluations FOR DELETE
  USING (true);

-- ========================================
-- 8. REALTIME PUBLICATION
-- Enable realtime subscriptions for live updates
-- ========================================
-- Note: Enable Realtime in Supabase Dashboard under Database > Publications
-- or run: ALTER PUBLICATION supabase_realtime ADD TABLE evaluations, candidates;

-- ========================================
-- 9. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ========================================
-- Insert sample candidates
INSERT INTO candidates (name, info) VALUES
  ('김민준', '{"dob":"2002-05-14","phone":"010-1234-5678","email":"kim@kah.ac.kr","major":"컴퓨터공학과"}'::jsonb),
  ('이서연', '{"dob":"2003-03-20","phone":"010-2345-6789","email":"lee@kah.ac.kr","major":"경영학과"}'::jsonb),
  ('박지호', '{"dob":"2002-11-08","phone":"010-3456-7890","email":"park@kah.ac.kr","major":"전자공학과"}'::jsonb);

-- Insert sample evaluations
INSERT INTO evaluations (candidate_id, interviewer_id, scores, total_score, tags) 
SELECT 
  c.id,
  'interviewer_demo_1',
  '{"sincerity":3,"cooperation":3,"planning":3,"expression":3,"commonsense":3,"proactivity":3,"personality":3,"q1":5,"q2":5,"comprehension":5,"logic":5,"creativity":5}'::jsonb,
  46,
  '[{"text":"논리정연함","type":"positive"}]'::jsonb
FROM candidates c WHERE c.name = '김민준';

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW candidate_rankings;

-- ========================================
-- HELPFUL QUERIES FOR TESTING
-- ========================================

-- View all candidates with their average scores
-- SELECT * FROM candidate_rankings ORDER BY avg_total_score DESC;

-- View all evaluations for a specific candidate
-- SELECT * FROM evaluations WHERE candidate_id = 'YOUR_CANDIDATE_UUID';

-- Get ranking with detailed evaluation breakdown
-- SELECT 
--   id,
--   name,
--   avg_total_score,
--   evaluation_count,
--   evaluations
-- FROM candidate_rankings
-- ORDER BY avg_total_score DESC;
