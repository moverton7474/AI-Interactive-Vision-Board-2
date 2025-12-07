-- ============================================
-- MDALS - MUSIC-DRIVEN ADAPTIVE LEARNING SYSTEMS
-- Migration: 20251207_mdals_engine_schema.sql
-- Version: 1.0
-- Description: Creates tables for music-based learning journeys,
--              song analysis, and personalized learning plans
-- ============================================

-- ============================================
-- 1. MDALS SONGS
-- ============================================
-- Stores songs added by users for learning journey creation

CREATE TABLE IF NOT EXISTS mdals_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Song Information
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,

  -- Source Information
  source_type TEXT NOT NULL CHECK (source_type IN (
    'spotify', 'apple', 'youtube', 'manual', 'other'
  )),
  source_id TEXT,              -- External track ID (e.g., Spotify track ID)
  source_url TEXT,             -- Link to the song on external platform

  -- User Context
  user_notes TEXT,             -- What this song means to the user
  language TEXT DEFAULT 'en',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for mdals_songs
CREATE INDEX IF NOT EXISTS idx_mdals_songs_user ON mdals_songs(user_id);
CREATE INDEX IF NOT EXISTS idx_mdals_songs_source ON mdals_songs(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_mdals_songs_created ON mdals_songs(created_at DESC);

-- Unique constraint to prevent duplicate songs per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_mdals_songs_unique
  ON mdals_songs(user_id, title, artist, source_type)
  WHERE artist IS NOT NULL;

-- ============================================
-- 2. MDALS SONG INSIGHTS
-- ============================================
-- Stores AI-derived insights from song analysis
-- NOTE: No lyrics are stored - only our own summaries and themes

CREATE TABLE IF NOT EXISTS mdals_song_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES mdals_songs(id) ON DELETE CASCADE,

  -- AI-Generated Insights (in our own words, no lyrics)
  summary TEXT NOT NULL,                    -- High-level message of the song
  themes JSONB DEFAULT '[]',                -- e.g., ["healing", "forgiveness", "perseverance"]
  emotions JSONB DEFAULT '[]',              -- e.g., ["grief", "hope", "joy"]
  domain_tags JSONB DEFAULT '[]',           -- e.g., ["spiritual", "leadership", "personal-growth"]

  -- References mapped to the song
  references JSONB DEFAULT '[]',            -- Array of { type, value, reason }
                                            -- e.g., [{ "type": "scripture", "value": "Psalm 30:5", "reason": "..." }]

  -- Model Metadata (sanitized, no lyrics)
  raw_model_output JSONB,                   -- Optional debug info, sanitized
  model_used TEXT,                          -- e.g., "gemini-1.5-flash"

  -- Analysis Preferences Used
  domain_preferences JSONB DEFAULT '[]',    -- Domain preferences at time of analysis

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for mdals_song_insights
CREATE INDEX IF NOT EXISTS idx_mdals_song_insights_song ON mdals_song_insights(song_id);
CREATE INDEX IF NOT EXISTS idx_mdals_song_insights_created ON mdals_song_insights(created_at DESC);

-- GIN index for theme/emotion searching
CREATE INDEX IF NOT EXISTS idx_mdals_song_insights_themes ON mdals_song_insights USING GIN (themes);
CREATE INDEX IF NOT EXISTS idx_mdals_song_insights_domains ON mdals_song_insights USING GIN (domain_tags);

-- ============================================
-- 3. MDALS LEARNING PLANS
-- ============================================
-- Stores generated multi-day learning journeys based on songs

CREATE TABLE IF NOT EXISTS mdals_learning_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES mdals_songs(id) ON DELETE CASCADE,

  -- Plan Overview
  title TEXT NOT NULL,
  goal_description TEXT,
  duration_days INT NOT NULL CHECK (duration_days >= 1 AND duration_days <= 90),

  -- Domain Focus
  domain_preferences JSONB DEFAULT '[]',    -- e.g., ["spiritual", "leadership"]

  -- Structured Plan Content
  plan_json JSONB NOT NULL,                 -- Array of day objects
  -- Each day: { day: 1, focus: "...", references: [...], activities: [...],
  --             reflection: "...", prayer_or_action: "..." }

  -- Status & Progress
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  current_day INT DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Model Metadata
  model_used TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for mdals_learning_plans
CREATE INDEX IF NOT EXISTS idx_mdals_learning_plans_user ON mdals_learning_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_mdals_learning_plans_song ON mdals_learning_plans(song_id);
CREATE INDEX IF NOT EXISTS idx_mdals_learning_plans_status ON mdals_learning_plans(status);
CREATE INDEX IF NOT EXISTS idx_mdals_learning_plans_created ON mdals_learning_plans(created_at DESC);

-- GIN index for domain searching
CREATE INDEX IF NOT EXISTS idx_mdals_learning_plans_domains ON mdals_learning_plans USING GIN (domain_preferences);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all MDALS tables
ALTER TABLE mdals_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdals_song_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdals_learning_plans ENABLE ROW LEVEL SECURITY;

-- mdals_songs: Users can only access their own songs
DROP POLICY IF EXISTS "Users own their songs" ON mdals_songs;
CREATE POLICY "Users own their songs" ON mdals_songs
  FOR ALL USING (auth.uid() = user_id);

-- mdals_song_insights: Access through the owning song's user_id
DROP POLICY IF EXISTS "Users access insights through song ownership" ON mdals_song_insights;
CREATE POLICY "Users access insights through song ownership" ON mdals_song_insights
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM mdals_songs
      WHERE mdals_songs.id = mdals_song_insights.song_id
      AND mdals_songs.user_id = auth.uid()
    )
  );

-- mdals_learning_plans: Users can only access their own plans
DROP POLICY IF EXISTS "Users own their learning plans" ON mdals_learning_plans;
CREATE POLICY "Users own their learning plans" ON mdals_learning_plans
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER FUNCTIONS
-- ============================================

-- Update timestamp trigger (reuse existing if available)
CREATE OR REPLACE FUNCTION update_mdals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_mdals_songs_updated_at ON mdals_songs;
CREATE TRIGGER update_mdals_songs_updated_at
  BEFORE UPDATE ON mdals_songs
  FOR EACH ROW EXECUTE FUNCTION update_mdals_updated_at();

DROP TRIGGER IF EXISTS update_mdals_learning_plans_updated_at ON mdals_learning_plans;
CREATE TRIGGER update_mdals_learning_plans_updated_at
  BEFORE UPDATE ON mdals_learning_plans
  FOR EACH ROW EXECUTE FUNCTION update_mdals_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get song with its latest insight
CREATE OR REPLACE FUNCTION get_song_with_insight(p_song_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'song', jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'artist', s.artist,
      'album', s.album,
      'source_type', s.source_type,
      'source_url', s.source_url,
      'user_notes', s.user_notes,
      'created_at', s.created_at
    ),
    'insight', CASE WHEN i.id IS NOT NULL THEN jsonb_build_object(
      'id', i.id,
      'summary', i.summary,
      'themes', i.themes,
      'emotions', i.emotions,
      'domain_tags', i.domain_tags,
      'references', i.references,
      'created_at', i.created_at
    ) ELSE NULL END
  ) INTO v_result
  FROM mdals_songs s
  LEFT JOIN LATERAL (
    SELECT * FROM mdals_song_insights
    WHERE song_id = s.id
    ORDER BY created_at DESC
    LIMIT 1
  ) i ON true
  WHERE s.id = p_song_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's songs with insights
CREATE OR REPLACE FUNCTION get_user_songs_with_insights(p_user_id UUID, p_limit INT DEFAULT 20)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'song', jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'artist', s.artist,
        'source_type', s.source_type,
        'source_url', s.source_url,
        'created_at', s.created_at
      ),
      'insight_summary', i.summary,
      'themes', i.themes,
      'plans_count', (SELECT COUNT(*) FROM mdals_learning_plans WHERE song_id = s.id)
    )
    ORDER BY s.created_at DESC
  ) INTO v_result
  FROM mdals_songs s
  LEFT JOIN LATERAL (
    SELECT summary, themes FROM mdals_song_insights
    WHERE song_id = s.id
    ORDER BY created_at DESC
    LIMIT 1
  ) i ON true
  WHERE s.user_id = p_user_id
  LIMIT p_limit;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANTS
-- ============================================

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_song_with_insight(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_songs_with_insights(UUID, INT) TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 3 (mdals_songs, mdals_song_insights, mdals_learning_plans)
-- Indexes created: 11
-- RLS policies: 3
-- Functions: 2
-- Triggers: 2
