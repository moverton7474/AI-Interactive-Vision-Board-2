-- MIGRATION: 20251206_martell_systems_upgrade.sql

-- ENABLE VECTOR EXTENSION (If not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. SYSTEM SOPS (Replacing "To-Do Lists" with "Calendar Systems")
-- Concept: "If it's not on the calendar, it's not real."
CREATE TABLE IF NOT EXISTS system_sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES action_tasks(id),
  name TEXT NOT NULL, -- e.g., "Weekly Finance Review"
  
  -- System Configuration
  trigger_type TEXT CHECK (trigger_type IN ('time', 'event', 'location')),
  cron_schedule TEXT, -- e.g., "0 9 * * 5" (Every Friday at 9am)
  google_calendar_event_id TEXT, -- Sync ID for recurrence
  system_prompt TEXT, -- Instructions for the user during this block
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ACTIVE RESOURCE FEED (The "Input Diet")
-- Concept: Active curation of content to reprogram user identity.
CREATE TABLE IF NOT EXISTS resource_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id UUID REFERENCES motivational_themes(id),
  
  -- Content Metadata
  source_platform TEXT DEFAULT 'youtube', 
  external_id TEXT, -- YouTube Video ID
  title TEXT,
  url TEXT,
  thumbnail_url TEXT,
  duration_iso TEXT,
  
  -- AI Curation Data
  ai_relevance_score FLOAT, -- 0.0 to 1.0
  ai_curation_reasoning TEXT, -- "Selected because it addresses your fear of..."
  
  is_consumed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PSYCHOLOGICAL FRAMEWORKS (The Mindset Engine / Internal RAG)
-- Concept: Vector store for coaching methodologies (Stoicism, CBT, Martell).
CREATE TABLE IF NOT EXISTS psychological_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author TEXT, -- e.g., "James Clear", "Dan Martell"
  concept_name TEXT, -- e.g., "The 2-Minute Rule"
  content_chunk TEXT, -- The raw text
  embedding vector(768), -- Match dimensions to your embedding model (Gecko or OpenAI)
  tags TEXT[]
);

-- RLS POLICIES
ALTER TABLE system_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychological_frameworks ENABLE ROW LEVEL SECURITY;

-- DO block to handle policy creation safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view own systems') THEN
        CREATE POLICY "Users view own systems" ON system_sops FOR ALL USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view own feed') THEN
        CREATE POLICY "Users view own feed" ON resource_feed FOR ALL USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read frameworks') THEN
        CREATE POLICY "Public read frameworks" ON psychological_frameworks FOR SELECT USING (true);
    END IF;
END $$;
