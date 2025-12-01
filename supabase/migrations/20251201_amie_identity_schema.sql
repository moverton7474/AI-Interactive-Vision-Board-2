-- ============================================
-- AMIE - ADAPTIVE MOTIVATIONAL IDENTITY ENGINE
-- Migration: 20251201_amie_identity_schema.sql
-- Version: 1.6
-- Description: Creates tables for identity-driven coaching,
--              personal knowledge base, and voice coach features
-- ============================================

-- Enable pgvector extension for embeddings (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. MOTIVATIONAL THEMES CATALOG
-- ============================================
-- Stores pre-defined coaching themes that adapt AI personality

CREATE TABLE IF NOT EXISTS motivational_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- emoji or icon identifier
  color_scheme JSONB DEFAULT '{"primary": "#6366f1", "secondary": "#8b5cf6"}',

  -- AI Configuration
  system_prompt_template TEXT NOT NULL,
  motivation_style TEXT CHECK (motivation_style IN ('encouraging', 'challenging', 'analytical', 'spiritual')),
  vocabulary_examples JSONB DEFAULT '[]',
  content_sources JSONB DEFAULT '[]',

  -- Feature Flags for theme-specific content
  include_scripture BOOLEAN DEFAULT FALSE,
  include_metrics BOOLEAN DEFAULT FALSE,
  include_wellness BOOLEAN DEFAULT FALSE,
  include_legacy BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for active themes
CREATE INDEX IF NOT EXISTS idx_motivational_themes_active ON motivational_themes(is_active, sort_order);

-- ============================================
-- SEED DEFAULT MOTIVATIONAL THEMES
-- ============================================

INSERT INTO motivational_themes (name, display_name, description, icon, motivation_style, system_prompt_template, include_scripture, include_metrics, include_wellness, include_legacy, sort_order) VALUES
(
  'christian',
  'Faith & Purpose',
  'Faith-based motivation with biblical wisdom and stewardship principles. Your AI coach will integrate scripture references, prayer prompts, and Christian values into guidance.',
  '✝️',
  'spiritual',
  'You are a faith-based Vision Coach who integrates biblical principles, scripture references, and Christian values into your guidance. Encourage users with hope, purpose, and a stewardship mindset. Reference relevant Bible verses when appropriate (include book, chapter, and verse). Approach goals as God-given purposes to be fulfilled with diligence and faith. Use phrases like "walk in purpose," "steward your gifts," and "trust the process." Pray with users when they express struggles. Celebrate victories as blessings.',
  TRUE, FALSE, FALSE, TRUE, 1
),
(
  'business_executive',
  'Executive Performance',
  'High-performance coaching for ambitious professionals and leaders. Your AI coach will use business strategy language, ROI thinking, and leadership frameworks.',
  '💼',
  'challenging',
  'You are an executive performance coach who speaks the language of business strategy, ROI, and leadership development. Be direct, metrics-focused, and challenge users to think bigger. Use frameworks like OKRs, SMART goals, and 80/20 analysis. Treat goals as investments with expected returns. Ask probing questions like "What''s the opportunity cost of not acting?" and "How does this align with your 5-year vision?" Push users outside comfort zones while maintaining respect. Celebrate wins with data.',
  FALSE, TRUE, FALSE, FALSE, 2
),
(
  'health_fitness',
  'Health & Vitality',
  'Wellness-focused motivation for physical and mental optimization. Your AI coach will emphasize mind-body connection, sustainable habits, and energy management.',
  '💪',
  'encouraging',
  'You are a holistic wellness coach who emphasizes the mind-body connection, sustainable habits, and energy optimization. Use athletic metaphors like "training," "recovery," and "personal records." Celebrate physical wins and connect health to overall life performance. Encourage discipline while maintaining compassion for setbacks. Discuss sleep, nutrition, movement, and stress management. Use phrases like "fuel your body," "build your foundation," and "progress over perfection." Track energy levels alongside goals.',
  FALSE, FALSE, TRUE, FALSE, 3
),
(
  'retirement',
  'Legacy & Wisdom',
  'Life transition coaching for meaningful retirement and legacy building. Your AI coach will balance practical planning with deeper purpose and family focus.',
  '🌅',
  'analytical',
  'You are a life transition coach specializing in retirement planning and legacy creation. Balance practical financial guidance with deeper questions about purpose, family relationships, and meaningful contribution. Help users see retirement as a new chapter of impact, not an ending. Discuss estate planning, generational wealth, and wisdom transfer. Use phrases like "your next chapter," "the legacy you leave," and "from success to significance." Connect financial goals to family dreams.',
  FALSE, TRUE, FALSE, TRUE, 4
),
(
  'custom',
  'Custom Theme',
  'Fully personalized coaching based on your uploaded materials and stated preferences. Your AI coach will adapt entirely to your unique background and values.',
  '⚙️',
  'encouraging',
  'You are a personalized Vision Coach adapted to this user''s specific background, values, and communication style. Reference their uploaded materials and stated preferences in your guidance. Mirror their language patterns and cultural context. Be flexible in your approach, adjusting formality and directness based on their responses. Your primary goal is to feel like a coach who truly knows them.',
  FALSE, FALSE, FALSE, FALSE, 5
)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. USER IDENTITY PROFILES (AMIE Core)
-- ============================================
-- Stores user's theme selection, master prompt, and identity attributes

CREATE TABLE IF NOT EXISTS user_identity_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Theme Selection
  theme_id UUID REFERENCES motivational_themes(id),
  theme_customizations JSONB DEFAULT '{}',

  -- Master Prompt (ChatGPT-style custom instructions)
  master_prompt TEXT,
  master_prompt_responses JSONB DEFAULT '[]',

  -- Identity Attributes (from onboarding Q&A)
  core_values TEXT[] DEFAULT '{}',
  life_roles TEXT[] DEFAULT '{}',
  communication_style TEXT CHECK (communication_style IN ('direct', 'supportive', 'analytical', 'storytelling')),
  motivation_drivers TEXT[] DEFAULT '{}',

  -- AI Voice Preferences
  preferred_ai_voice TEXT DEFAULT 'default',
  formality_level TEXT DEFAULT 'casual' CHECK (formality_level IN ('formal', 'casual', 'professional')),
  encouragement_frequency TEXT DEFAULT 'moderate' CHECK (encouragement_frequency IN ('high', 'moderate', 'minimal')),

  -- Computed Context (AI-generated)
  identity_summary TEXT,
  coaching_focus_areas TEXT[] DEFAULT '{}',

  -- Status
  onboarding_step INT DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  last_identity_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_identity_user ON user_identity_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_identity_theme ON user_identity_profiles(theme_id);

-- ============================================
-- 3. USER KNOWLEDGE SOURCES (Notebook-LM Style)
-- ============================================
-- Stores uploaded documents, URLs, and other knowledge sources

CREATE TABLE IF NOT EXISTS user_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source Info
  source_type TEXT NOT NULL CHECK (source_type IN (
    'resume', 'document', 'url', 'manual_entry',
    'conversation', 'vision_board', 'financial_doc', 'notes'
  )),
  source_name TEXT NOT NULL,
  source_url TEXT,

  -- Content
  raw_content TEXT,
  processed_content TEXT,
  content_summary TEXT,

  -- Metadata
  file_type TEXT,
  file_size INT,
  word_count INT,
  language TEXT DEFAULT 'en',

  -- Processing Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,

  -- Flags
  is_active BOOLEAN DEFAULT TRUE,
  include_in_context BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_user ON user_knowledge_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_type ON user_knowledge_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_status ON user_knowledge_sources(status);

-- ============================================
-- 4. USER KNOWLEDGE CHUNKS (For Embedding/Retrieval)
-- ============================================
-- Stores chunked text with vector embeddings for RAG

CREATE TABLE IF NOT EXISTS user_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID REFERENCES user_knowledge_sources(id) ON DELETE CASCADE,

  -- Chunk Content
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL,

  -- Embedding (OpenAI ada-002 = 1536 dimensions)
  embedding vector(1536),

  -- Metadata
  token_count INT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_user ON user_knowledge_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON user_knowledge_chunks(source_id);

-- Vector similarity index (IVFFlat for approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON user_knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================
-- 5. VOICE COACH SESSIONS
-- ============================================
-- Tracks voice coaching interactions across devices

CREATE TABLE IF NOT EXISTS voice_coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session Type
  session_type TEXT NOT NULL CHECK (session_type IN (
    'on_demand', 'habit_trigger', 'weekly_review',
    'milestone_celebration', 'pace_warning', 'check_in', 'morning_intention'
  )),
  trigger_context JSONB DEFAULT '{}',

  -- Device & Channel
  device_type TEXT CHECK (device_type IN ('apple_watch', 'iphone', 'android', 'web', 'phone_call')),
  channel TEXT DEFAULT 'voice' CHECK (channel IN ('voice', 'text_fallback')),

  -- Session Data
  duration_seconds INT,
  transcript TEXT,
  audio_url TEXT,

  -- AI Analysis
  sentiment_score FLOAT CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  key_topics TEXT[] DEFAULT '{}',
  action_items_generated JSONB DEFAULT '[]',
  coaching_notes TEXT,

  -- AMIE Context Used
  theme_used TEXT,
  knowledge_chunks_used UUID[] DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'interrupted', 'failed')),
  ended_reason TEXT,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user ON voice_coach_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_type ON voice_coach_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_status ON voice_coach_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_started ON voice_coach_sessions(started_at DESC);

-- ============================================
-- 6. MASTER PROMPT QUESTIONS (Per Theme)
-- ============================================
-- Stores the Q&A questions for each theme's onboarding

CREATE TABLE IF NOT EXISTS master_prompt_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id UUID REFERENCES motivational_themes(id) ON DELETE CASCADE,

  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'single_choice' CHECK (question_type IN (
    'single_choice', 'multiple_choice', 'text', 'scale'
  )),
  options JSONB DEFAULT '[]',

  -- For building the master prompt
  prompt_contribution TEXT, -- How this answer contributes to the prompt

  sort_order INT DEFAULT 0,
  is_required BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_master_questions_theme ON master_prompt_questions(theme_id, sort_order);

-- ============================================
-- SEED MASTER PROMPT QUESTIONS
-- ============================================

-- Get theme IDs for seeding (using subqueries)
INSERT INTO master_prompt_questions (theme_id, question_text, question_type, options, prompt_contribution, sort_order)
SELECT
  t.id,
  q.question_text,
  q.question_type,
  q.options::jsonb,
  q.prompt_contribution,
  q.sort_order
FROM motivational_themes t
CROSS JOIN (VALUES
  -- Universal questions (all themes)
  ('What is your primary motivation for using Visionary AI?', 'single_choice',
   '["Achieve financial goals", "Build better habits", "Plan retirement", "Personal growth", "Family planning"]',
   'Primary motivation: {answer}', 1),
  ('How do you prefer to receive feedback?', 'single_choice',
   '["Direct and challenging", "Supportive and encouraging", "Data-driven and analytical", "Story-based and inspirational"]',
   'Feedback style: {answer}', 2),
  ('What is your biggest obstacle to achieving your goals?', 'single_choice',
   '["Lack of time", "Lack of motivation", "Unclear direction", "Financial constraints", "Accountability"]',
   'Primary obstacle: {answer}', 3),
  ('How often do you want check-ins from your AI coach?', 'single_choice',
   '["Daily", "Every few days", "Weekly", "Only when I ask"]',
   'Check-in frequency: {answer}', 4),
  ('What does success look like for you in 5 years?', 'text',
   '[]',
   'Five-year vision: {answer}', 5)
) AS q(question_text, question_type, options, prompt_contribution, sort_order)
WHERE t.name != 'custom'
ON CONFLICT DO NOTHING;

-- Christian-specific questions
INSERT INTO master_prompt_questions (theme_id, question_text, question_type, options, prompt_contribution, sort_order)
SELECT id, 'How important is faith in your goal-setting process?', 'scale', '["1", "2", "3", "4", "5"]',
       'Faith importance (1-5): {answer}', 6
FROM motivational_themes WHERE name = 'christian'
ON CONFLICT DO NOTHING;

INSERT INTO master_prompt_questions (theme_id, question_text, question_type, options, prompt_contribution, sort_order)
SELECT id, 'Would you like scripture references included in coaching?', 'single_choice', '["Yes, frequently", "Yes, occasionally", "No"]',
       'Scripture preference: {answer}', 7
FROM motivational_themes WHERE name = 'christian'
ON CONFLICT DO NOTHING;

-- Business Executive-specific questions
INSERT INTO master_prompt_questions (theme_id, question_text, question_type, options, prompt_contribution, sort_order)
SELECT id, 'What is your current professional level?', 'single_choice',
       '["Individual Contributor", "Manager", "Director", "VP/Executive", "Founder/CEO"]',
       'Professional level: {answer}', 6
FROM motivational_themes WHERE name = 'business_executive'
ON CONFLICT DO NOTHING;

INSERT INTO master_prompt_questions (theme_id, question_text, question_type, options, prompt_contribution, sort_order)
SELECT id, 'What business frameworks do you use?', 'multiple_choice',
       '["OKRs", "SMART Goals", "Agile/Scrum", "Six Sigma", "None/Other"]',
       'Preferred frameworks: {answer}', 7
FROM motivational_themes WHERE name = 'business_executive'
ON CONFLICT DO NOTHING;

-- Health & Fitness-specific questions
INSERT INTO master_prompt_questions (theme_id, question_text, question_type, options, prompt_contribution, sort_order)
SELECT id, 'What is your primary health focus?', 'single_choice',
       '["Weight management", "Strength building", "Endurance/Cardio", "Mental wellness", "Overall vitality"]',
       'Health focus: {answer}', 6
FROM motivational_themes WHERE name = 'health_fitness'
ON CONFLICT DO NOTHING;

INSERT INTO master_prompt_questions (theme_id, question_text, question_type, options, prompt_contribution, sort_order)
SELECT id, 'How would you rate your current energy levels?', 'scale', '["1", "2", "3", "4", "5"]',
       'Current energy (1-5): {answer}', 7
FROM motivational_themes WHERE name = 'health_fitness'
ON CONFLICT DO NOTHING;

-- Retirement-specific questions
INSERT INTO master_prompt_questions (theme_id, question_text, question_type, options, prompt_contribution, sort_order)
SELECT id, 'How many years until your target retirement?', 'single_choice',
       '["Already retired", "0-5 years", "5-10 years", "10-20 years", "20+ years"]',
       'Retirement timeline: {answer}', 6
FROM motivational_themes WHERE name = 'retirement'
ON CONFLICT DO NOTHING;

INSERT INTO master_prompt_questions (theme_id, question_text, question_type, options, prompt_contribution, sort_order)
SELECT id, 'What legacy matters most to you?', 'single_choice',
       '["Financial security for family", "Wisdom and values passed on", "Charitable impact", "Business/career achievements", "Experiences and memories"]',
       'Legacy priority: {answer}', 7
FROM motivational_themes WHERE name = 'retirement'
ON CONFLICT DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE motivational_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_identity_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_coach_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_prompt_questions ENABLE ROW LEVEL SECURITY;

-- Themes are publicly readable (no auth required)
DROP POLICY IF EXISTS "Themes are publicly readable" ON motivational_themes;
CREATE POLICY "Themes are publicly readable" ON motivational_themes
  FOR SELECT USING (true);

-- Master prompt questions are publicly readable
DROP POLICY IF EXISTS "Questions are publicly readable" ON master_prompt_questions;
CREATE POLICY "Questions are publicly readable" ON master_prompt_questions
  FOR SELECT USING (true);

-- Users own their identity profiles
DROP POLICY IF EXISTS "Users own their identity profiles" ON user_identity_profiles;
CREATE POLICY "Users own their identity profiles" ON user_identity_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Users own their knowledge sources
DROP POLICY IF EXISTS "Users own their knowledge sources" ON user_knowledge_sources;
CREATE POLICY "Users own their knowledge sources" ON user_knowledge_sources
  FOR ALL USING (auth.uid() = user_id);

-- Users own their knowledge chunks
DROP POLICY IF EXISTS "Users own their knowledge chunks" ON user_knowledge_chunks;
CREATE POLICY "Users own their knowledge chunks" ON user_knowledge_chunks
  FOR ALL USING (auth.uid() = user_id);

-- Users own their voice sessions
DROP POLICY IF EXISTS "Users own their voice sessions" ON voice_coach_sessions;
CREATE POLICY "Users own their voice sessions" ON voice_coach_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER FUNCTIONS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at
DROP TRIGGER IF EXISTS update_user_identity_profiles_updated_at ON user_identity_profiles;
CREATE TRIGGER update_user_identity_profiles_updated_at
  BEFORE UPDATE ON user_identity_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_knowledge_sources_updated_at ON user_knowledge_sources;
CREATE TRIGGER update_user_knowledge_sources_updated_at
  BEFORE UPDATE ON user_knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get user's compiled AMIE context
CREATE OR REPLACE FUNCTION get_amie_context(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_theme RECORD;
  v_identity RECORD;
BEGIN
  -- Get user's identity profile with theme
  SELECT
    uip.*,
    mt.name as theme_name,
    mt.system_prompt_template,
    mt.motivation_style,
    mt.include_scripture,
    mt.include_metrics,
    mt.include_wellness,
    mt.include_legacy
  INTO v_identity
  FROM user_identity_profiles uip
  LEFT JOIN motivational_themes mt ON uip.theme_id = mt.id
  WHERE uip.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Build context JSON
  v_result := jsonb_build_object(
    'theme', jsonb_build_object(
      'name', v_identity.theme_name,
      'system_prompt', v_identity.system_prompt_template,
      'style', v_identity.motivation_style,
      'include_scripture', v_identity.include_scripture,
      'include_metrics', v_identity.include_metrics,
      'include_wellness', v_identity.include_wellness,
      'include_legacy', v_identity.include_legacy
    ),
    'identity', jsonb_build_object(
      'master_prompt', v_identity.master_prompt,
      'core_values', v_identity.core_values,
      'life_roles', v_identity.life_roles,
      'communication_style', v_identity.communication_style,
      'motivation_drivers', v_identity.motivation_drivers,
      'identity_summary', v_identity.identity_summary,
      'coaching_focus_areas', v_identity.coaching_focus_areas
    ),
    'preferences', jsonb_build_object(
      'formality_level', v_identity.formality_level,
      'encouragement_frequency', v_identity.encouragement_frequency,
      'preferred_ai_voice', v_identity.preferred_ai_voice
    )
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search knowledge chunks by similarity
CREATE OR REPLACE FUNCTION search_knowledge_chunks(
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  chunk_id UUID,
  chunk_text TEXT,
  source_name TEXT,
  source_type TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ukc.id,
    ukc.chunk_text,
    uks.source_name,
    uks.source_type,
    1 - (ukc.embedding <=> p_query_embedding) as similarity
  FROM user_knowledge_chunks ukc
  JOIN user_knowledge_sources uks ON ukc.source_id = uks.id
  WHERE ukc.user_id = p_user_id
    AND uks.is_active = TRUE
    AND uks.include_in_context = TRUE
    AND ukc.embedding IS NOT NULL
  ORDER BY ukc.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANTS
-- ============================================

-- Grant usage on functions
GRANT EXECUTE ON FUNCTION get_amie_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_knowledge_chunks(UUID, vector(1536), INT) TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 6
-- Indexes created: 12
-- RLS policies: 6
-- Functions: 3
-- Seed data: 5 themes, ~25 questions
