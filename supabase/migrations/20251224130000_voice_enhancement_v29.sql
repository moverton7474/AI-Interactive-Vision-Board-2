-- ============================================
-- VOICE ENHANCEMENT v2.9 - DATABASE SCHEMA
-- Migration: 20251224_voice_enhancement_v29.sql
-- Version: 1.0
-- Description: Premium voice integration with hybrid provider stack
--              Browser TTS (Free) → OpenAI TTS (Pro) → ElevenLabs (Elite)
-- ============================================

-- ============================================
-- 1. USER VOICE SETTINGS
-- ============================================
-- Stores user preferences for voice output

CREATE TABLE IF NOT EXISTS public.user_voice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Provider & Persona Selection
  preferred_provider TEXT DEFAULT 'browser'
    CHECK (preferred_provider IN ('browser', 'openai', 'elevenlabs')),
  preferred_persona TEXT DEFAULT 'maya'
    CHECK (preferred_persona IN ('maya', 'james', 'custom', 'system')),

  -- ElevenLabs Custom Voice (Elite only)
  custom_voice_id TEXT, -- ElevenLabs voice ID for cloned voice
  custom_voice_name TEXT,
  custom_voice_status TEXT DEFAULT 'none'
    CHECK (custom_voice_status IN ('none', 'pending', 'processing', 'ready', 'failed')),

  -- Voice Parameters
  language TEXT DEFAULT 'en',
  voice_speed FLOAT DEFAULT 1.0 CHECK (voice_speed >= 0.5 AND voice_speed <= 2.0),
  voice_pitch FLOAT DEFAULT 1.0 CHECK (voice_pitch >= 0.5 AND voice_pitch <= 2.0),

  -- Preferences
  auto_play_affirmations BOOLEAN DEFAULT TRUE,
  use_cloned_voice_for_affirmations BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. VOICE USAGE TRACKING
-- ============================================
-- Tracks character usage for quota management and cost monitoring

CREATE TABLE IF NOT EXISTS public.voice_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Usage Details
  provider TEXT NOT NULL CHECK (provider IN ('browser', 'openai', 'elevenlabs', 'google')),
  characters_used INT NOT NULL CHECK (characters_used > 0),

  -- Context
  session_id UUID,
  usage_type TEXT DEFAULT 'coaching'
    CHECK (usage_type IN ('coaching', 'affirmation', 'greeting', 'preview', 'other')),

  -- Cost Tracking
  estimated_cost_usd DECIMAL(10, 6),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. VOICE CLONES (Elite tier)
-- ============================================
-- Stores user voice clones created via ElevenLabs

CREATE TABLE IF NOT EXISTS public.voice_clones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ElevenLabs Data
  elevenlabs_voice_id TEXT NOT NULL,
  voice_name TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'processing'
    CHECK (status IN ('processing', 'ready', 'failed', 'deleted')),
  error_message TEXT,

  -- Samples (references to uploaded audio files)
  sample_urls TEXT[] DEFAULT '{}',
  total_sample_duration_seconds INT,

  -- Quality Metrics
  quality_score FLOAT, -- 0-1, from ElevenLabs

  created_at TIMESTAMPTZ DEFAULT NOW(),
  ready_at TIMESTAMPTZ
);

-- ============================================
-- 4. VOICE PERSONAS (system-defined)
-- ============================================
-- Predefined voice personas for Pro/Elite users

CREATE TABLE IF NOT EXISTS public.voice_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,

  -- Provider Configuration
  openai_voice TEXT, -- OpenAI voice name (alloy, echo, fable, onyx, nova, shimmer)
  elevenlabs_voice_id TEXT, -- ElevenLabs voice ID
  google_voice TEXT, -- Google Cloud TTS voice name

  -- Characteristics
  gender TEXT CHECK (gender IN ('female', 'male', 'neutral')),
  style TEXT, -- 'warm', 'professional', 'energetic', 'calm'

  -- Sample audio URL for preview
  preview_url TEXT,

  -- Availability
  available_tiers TEXT[] DEFAULT '{pro, elite}',
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. SEED DEFAULT PERSONAS
-- ============================================

INSERT INTO voice_personas (name, display_name, description, openai_voice, elevenlabs_voice_id, gender, style, available_tiers)
VALUES
  ('maya', 'Coach Maya', 'Warm, encouraging female coach with a supportive tone. Perfect for daily motivation and gentle accountability.',
   'nova', 'Bn9xWp6PwkrqKRbq8cX2', 'female', 'warm', '{pro, elite}'),
  ('james', 'Coach James', 'Confident, professional male coach with motivational energy. Ideal for goal-focused sessions and performance coaching.',
   'onyx', 'ePn9OncKq8KyJvrTRqTi', 'male', 'professional', '{pro, elite}'),
  ('tonya', 'Coach Tonya', 'Warm, compassionate female coach with a nurturing tone. Great for emotional support and reflection sessions.',
   'shimmer', 'zwbQ2XUiIlOKD6b3JWXd', 'female', 'warm', '{pro, elite}'),
  ('system', 'System Voice', 'Default browser text-to-speech voice. Basic but functional.',
   NULL, NULL, 'neutral', 'neutral', '{free, pro, elite}')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  openai_voice = EXCLUDED.openai_voice,
  elevenlabs_voice_id = EXCLUDED.elevenlabs_voice_id,
  gender = EXCLUDED.gender,
  style = EXCLUDED.style,
  available_tiers = EXCLUDED.available_tiers;

-- ============================================
-- 6. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_voice_settings_user ON user_voice_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_usage_user_date ON voice_usage(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_voice_usage_monthly ON voice_usage(user_id, DATE_TRUNC('month', created_at));
CREATE INDEX IF NOT EXISTS idx_voice_usage_provider ON voice_usage(provider, created_at);
CREATE INDEX IF NOT EXISTS idx_voice_clones_user ON voice_clones(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_clones_status ON voice_clones(user_id, status);

-- ============================================
-- 7. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_clones ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_personas ENABLE ROW LEVEL SECURITY;

-- Users can manage their own voice settings
DROP POLICY IF EXISTS "Users manage own voice settings" ON user_voice_settings;
CREATE POLICY "Users manage own voice settings" ON user_voice_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own usage
DROP POLICY IF EXISTS "Users view own voice usage" ON voice_usage;
CREATE POLICY "Users view own voice usage" ON voice_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can manage voice usage (for Edge Functions)
DROP POLICY IF EXISTS "Service role manages voice usage" ON voice_usage;
CREATE POLICY "Service role manages voice usage" ON voice_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can manage their own clones
DROP POLICY IF EXISTS "Users manage own voice clones" ON voice_clones;
CREATE POLICY "Users manage own voice clones" ON voice_clones
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Voice personas are publicly readable
DROP POLICY IF EXISTS "Voice personas are public" ON voice_personas;
CREATE POLICY "Voice personas are public" ON voice_personas
  FOR SELECT
  USING (true);

-- ============================================
-- 8. FUNCTION: Check monthly quota
-- ============================================
-- Returns quota status before making API calls

CREATE OR REPLACE FUNCTION check_voice_quota(
  p_user_id UUID,
  p_tier TEXT,
  p_characters_requested INT DEFAULT 0
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining_chars INT,
  quota_limit INT,
  used_this_month INT,
  resets_at TIMESTAMPTZ
) AS $$
DECLARE
  v_quota_limit INT;
  v_used_chars INT;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
BEGIN
  -- Set quota based on tier
  v_quota_limit := CASE LOWER(p_tier)
    WHEN 'free' THEN 0 -- Free uses browser TTS, no API quota
    WHEN 'pro' THEN 50000
    WHEN 'elite' THEN 150000
    WHEN 'enterprise' THEN 500000
    ELSE 0
  END;

  -- Calculate month boundaries
  v_month_start := DATE_TRUNC('month', NOW());
  v_month_end := DATE_TRUNC('month', NOW()) + INTERVAL '1 month';

  -- Calculate usage this month (OpenAI + ElevenLabs only, not browser)
  SELECT COALESCE(SUM(characters_used), 0) INTO v_used_chars
  FROM voice_usage
  WHERE user_id = p_user_id
    AND provider IN ('openai', 'elevenlabs', 'google')
    AND created_at >= v_month_start
    AND created_at < v_month_end;

  RETURN QUERY SELECT
    (v_used_chars + p_characters_requested <= v_quota_limit) AS allowed,
    GREATEST(0, v_quota_limit - v_used_chars)::INT AS remaining_chars,
    v_quota_limit AS quota_limit,
    v_used_chars::INT AS used_this_month,
    v_month_end AS resets_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. FUNCTION: Record voice usage
-- ============================================
-- Called after successful TTS to track usage

CREATE OR REPLACE FUNCTION record_voice_usage(
  p_user_id UUID,
  p_provider TEXT,
  p_characters INT,
  p_session_id UUID DEFAULT NULL,
  p_usage_type TEXT DEFAULT 'coaching'
)
RETURNS UUID AS $$
DECLARE
  v_usage_id UUID;
  v_cost DECIMAL(10, 6);
BEGIN
  -- Calculate estimated cost based on provider pricing
  v_cost := CASE p_provider
    WHEN 'openai' THEN p_characters * 0.000015 -- $15/1M chars (tts-1)
    WHEN 'elevenlabs' THEN p_characters * 0.00018 -- ~$180/1M chars (Scale plan)
    WHEN 'google' THEN p_characters * 0.000004 -- $4/1M chars (Standard)
    ELSE 0
  END;

  INSERT INTO voice_usage (user_id, provider, characters_used, session_id, usage_type, estimated_cost_usd)
  VALUES (p_user_id, p_provider, p_characters, p_session_id, p_usage_type, v_cost)
  RETURNING id INTO v_usage_id;

  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. FUNCTION: Get user voice settings with defaults
-- ============================================

CREATE OR REPLACE FUNCTION get_user_voice_settings(p_user_id UUID)
RETURNS TABLE (
  preferred_provider TEXT,
  preferred_persona TEXT,
  custom_voice_id TEXT,
  custom_voice_name TEXT,
  custom_voice_status TEXT,
  language TEXT,
  voice_speed FLOAT,
  voice_pitch FLOAT,
  auto_play_affirmations BOOLEAN,
  use_cloned_voice_for_affirmations BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(s.preferred_provider, 'browser'),
    COALESCE(s.preferred_persona, 'maya'),
    s.custom_voice_id,
    s.custom_voice_name,
    COALESCE(s.custom_voice_status, 'none'),
    COALESCE(s.language, 'en'),
    COALESCE(s.voice_speed, 1.0),
    COALESCE(s.voice_pitch, 1.0),
    COALESCE(s.auto_play_affirmations, TRUE),
    COALESCE(s.use_cloned_voice_for_affirmations, FALSE)
  FROM user_voice_settings s
  WHERE s.user_id = p_user_id;

  -- If no settings exist, return defaults
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'browser'::TEXT,
      'maya'::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      'none'::TEXT,
      'en'::TEXT,
      1.0::FLOAT,
      1.0::FLOAT,
      TRUE::BOOLEAN,
      FALSE::BOOLEAN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. FUNCTION: Upsert user voice settings
-- ============================================

CREATE OR REPLACE FUNCTION upsert_user_voice_settings(
  p_user_id UUID,
  p_preferred_provider TEXT DEFAULT NULL,
  p_preferred_persona TEXT DEFAULT NULL,
  p_language TEXT DEFAULT NULL,
  p_voice_speed FLOAT DEFAULT NULL,
  p_voice_pitch FLOAT DEFAULT NULL,
  p_auto_play_affirmations BOOLEAN DEFAULT NULL,
  p_use_cloned_voice_for_affirmations BOOLEAN DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_settings_id UUID;
BEGIN
  INSERT INTO user_voice_settings (
    user_id,
    preferred_provider,
    preferred_persona,
    language,
    voice_speed,
    voice_pitch,
    auto_play_affirmations,
    use_cloned_voice_for_affirmations,
    updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(p_preferred_provider, 'browser'),
    COALESCE(p_preferred_persona, 'maya'),
    COALESCE(p_language, 'en'),
    COALESCE(p_voice_speed, 1.0),
    COALESCE(p_voice_pitch, 1.0),
    COALESCE(p_auto_play_affirmations, TRUE),
    COALESCE(p_use_cloned_voice_for_affirmations, FALSE),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    preferred_provider = COALESCE(p_preferred_provider, user_voice_settings.preferred_provider),
    preferred_persona = COALESCE(p_preferred_persona, user_voice_settings.preferred_persona),
    language = COALESCE(p_language, user_voice_settings.language),
    voice_speed = COALESCE(p_voice_speed, user_voice_settings.voice_speed),
    voice_pitch = COALESCE(p_voice_pitch, user_voice_settings.voice_pitch),
    auto_play_affirmations = COALESCE(p_auto_play_affirmations, user_voice_settings.auto_play_affirmations),
    use_cloned_voice_for_affirmations = COALESCE(p_use_cloned_voice_for_affirmations, user_voice_settings.use_cloned_voice_for_affirmations),
    updated_at = NOW()
  RETURNING id INTO v_settings_id;

  RETURN v_settings_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. FUNCTION: Get monthly usage summary
-- ============================================

CREATE OR REPLACE FUNCTION get_voice_usage_summary(p_user_id UUID)
RETURNS TABLE (
  provider TEXT,
  total_characters BIGINT,
  total_requests BIGINT,
  estimated_cost DECIMAL(10, 4),
  month_start TIMESTAMPTZ,
  month_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vu.provider,
    SUM(vu.characters_used)::BIGINT AS total_characters,
    COUNT(*)::BIGINT AS total_requests,
    SUM(vu.estimated_cost_usd)::DECIMAL(10, 4) AS estimated_cost,
    DATE_TRUNC('month', NOW()) AS month_start,
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month' AS month_end
  FROM voice_usage vu
  WHERE vu.user_id = p_user_id
    AND vu.created_at >= DATE_TRUNC('month', NOW())
    AND vu.created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  GROUP BY vu.provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION check_voice_quota(UUID, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_voice_quota(UUID, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION record_voice_usage(UUID, TEXT, INT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_voice_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_voice_settings(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION upsert_user_voice_settings(UUID, TEXT, TEXT, TEXT, FLOAT, FLOAT, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_user_voice_settings(UUID, TEXT, TEXT, TEXT, FLOAT, FLOAT, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION get_voice_usage_summary(UUID) TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 4 (user_voice_settings, voice_usage, voice_clones, voice_personas)
-- Personas seeded: 3 (maya, james, system)
-- Functions created: 5
-- Indexes created: 6
-- RLS policies: 6
-- ============================================
