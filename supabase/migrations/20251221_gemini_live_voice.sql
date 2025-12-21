-- ============================================
-- GEMINI LIVE VOICE INFRASTRUCTURE
-- Migration: 20251221_gemini_live_voice
--
-- Implements Phase 1: Real-time bidirectional voice
-- with Google Gemini Live API
-- ============================================

-- ============================================
-- PART 1: LIVE VOICE SESSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS live_voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Session data
  transcript JSONB DEFAULT '[]',  -- Array of {role, content, timestamp}
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'failed', 'interrupted')),

  -- Session metadata
  session_type TEXT DEFAULT 'coaching' CHECK (session_type IN ('coaching', 'goal_review', 'habit_checkin', 'motivation', 'free_form')),
  model_used TEXT DEFAULT 'gemini-2.0-flash-exp',

  -- Error tracking
  error_message TEXT,
  error_code TEXT,

  -- Usage tracking for billing
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  audio_duration_ms INTEGER DEFAULT 0,

  -- Context
  related_goal_id UUID,
  related_habit_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE live_voice_sessions IS 'Real-time bidirectional voice sessions with Gemini Live API';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_live_voice_sessions_user ON live_voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_live_voice_sessions_status ON live_voice_sessions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_live_voice_sessions_started ON live_voice_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_voice_sessions_user_month ON live_voice_sessions(user_id, started_at);

-- Enable RLS
ALTER TABLE live_voice_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own live voice sessions"
  ON live_voice_sessions FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own sessions
CREATE POLICY "Users can create own live voice sessions"
  ON live_voice_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own sessions
CREATE POLICY "Users can update own live voice sessions"
  ON live_voice_sessions FOR UPDATE
  USING (user_id = auth.uid());

-- Service role has full access
CREATE POLICY "Service role manages live voice sessions"
  ON live_voice_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- Platform admins can view all sessions
CREATE POLICY "Platform admins can view all live voice sessions"
  ON live_voice_sessions FOR SELECT
  USING (is_platform_admin());

-- ============================================
-- PART 2: USAGE TRACKING VIEW
-- ============================================

-- View to track monthly usage per user
CREATE OR REPLACE VIEW live_voice_usage_monthly AS
SELECT
  user_id,
  DATE_TRUNC('month', started_at) as month,
  COUNT(*) as session_count,
  SUM(duration_seconds) as total_seconds,
  SUM(duration_seconds) / 60.0 as total_minutes,
  SUM(audio_duration_ms) / 1000.0 as audio_seconds,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens
FROM live_voice_sessions
WHERE status IN ('ended', 'interrupted')
GROUP BY user_id, DATE_TRUNC('month', started_at);

GRANT SELECT ON live_voice_usage_monthly TO authenticated;

-- ============================================
-- PART 3: USAGE LIMITS FUNCTION
-- ============================================

-- Function to check if user can start a live voice session
CREATE OR REPLACE FUNCTION can_start_live_voice_session(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tier TEXT;
  v_monthly_limit_minutes INTEGER;
  v_used_minutes DECIMAL;
  v_remaining_minutes DECIMAL;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO v_tier
  FROM profiles WHERE id = p_user_id;

  IF v_tier IS NULL THEN
    v_tier := 'FREE';
  END IF;

  -- Set limits based on tier
  -- PRO: 30 minutes/month, ELITE: 120 minutes/month, TEAM: 300 minutes/month
  CASE v_tier
    WHEN 'FREE' THEN
      RETURN jsonb_build_object(
        'allowed', FALSE,
        'reason', 'Live voice requires PRO subscription or higher',
        'tier', v_tier,
        'limit_minutes', 0,
        'used_minutes', 0,
        'remaining_minutes', 0
      );
    WHEN 'PRO' THEN
      v_monthly_limit_minutes := 30;
    WHEN 'ELITE' THEN
      v_monthly_limit_minutes := 120;
    WHEN 'TEAM' THEN
      v_monthly_limit_minutes := 300;
    ELSE
      v_monthly_limit_minutes := 0;
  END CASE;

  -- Get current month's usage
  SELECT COALESCE(SUM(duration_seconds) / 60.0, 0) INTO v_used_minutes
  FROM live_voice_sessions
  WHERE user_id = p_user_id
    AND status IN ('ended', 'interrupted')
    AND started_at >= DATE_TRUNC('month', NOW());

  v_remaining_minutes := GREATEST(0, v_monthly_limit_minutes - v_used_minutes);

  RETURN jsonb_build_object(
    'allowed', v_remaining_minutes > 0,
    'reason', CASE
      WHEN v_remaining_minutes > 0 THEN 'OK'
      ELSE 'Monthly limit reached. Resets on ' || TO_CHAR(DATE_TRUNC('month', NOW()) + INTERVAL '1 month', 'Mon DD')
    END,
    'tier', v_tier,
    'limit_minutes', v_monthly_limit_minutes,
    'used_minutes', ROUND(v_used_minutes::NUMERIC, 1),
    'remaining_minutes', ROUND(v_remaining_minutes::NUMERIC, 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION can_start_live_voice_session(UUID) IS 'Check if user can start a live voice session based on tier and usage';

GRANT EXECUTE ON FUNCTION can_start_live_voice_session(UUID) TO authenticated;

-- ============================================
-- PART 4: SESSION END FUNCTION
-- ============================================

-- Function to properly end a live voice session
CREATE OR REPLACE FUNCTION end_live_voice_session(
  p_session_id UUID,
  p_transcript JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL
)
RETURNS live_voice_sessions AS $$
DECLARE
  v_session live_voice_sessions;
  v_duration INTEGER;
BEGIN
  -- Calculate duration
  SELECT EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER INTO v_duration
  FROM live_voice_sessions
  WHERE id = p_session_id AND user_id = auth.uid();

  -- Update the session
  UPDATE live_voice_sessions
  SET
    ended_at = NOW(),
    duration_seconds = v_duration,
    status = CASE
      WHEN p_error_message IS NOT NULL THEN 'failed'
      ELSE 'ended'
    END,
    transcript = COALESCE(p_transcript, transcript),
    error_message = p_error_message,
    error_code = p_error_code,
    updated_at = NOW()
  WHERE id = p_session_id AND user_id = auth.uid()
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION end_live_voice_session(UUID, JSONB, TEXT, TEXT) IS 'End a live voice session and calculate duration';

GRANT EXECUTE ON FUNCTION end_live_voice_session(UUID, JSONB, TEXT, TEXT) TO authenticated;

-- ============================================
-- PART 5: ADD GEMINI LIVE FEATURE FLAG
-- ============================================

INSERT INTO feature_flags (name, display_name, description, is_enabled, tier_required, rollout_percentage)
VALUES (
  'gemini_live_voice',
  'Gemini Live Voice',
  'Real-time bidirectional voice conversation with Gemini',
  FALSE,  -- Disabled by default until API key is configured
  'PRO',
  0
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  tier_required = EXCLUDED.tier_required;

-- ============================================
-- PART 6: UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_live_voice_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_live_voice_sessions_updated_at ON live_voice_sessions;
CREATE TRIGGER trigger_live_voice_sessions_updated_at
  BEFORE UPDATE ON live_voice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_live_voice_sessions_updated_at();

-- ============================================
-- VERIFICATION
-- ============================================

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'live_voice_sessions';

-- Show the feature flag
SELECT name, is_enabled, tier_required, rollout_percentage
FROM feature_flags
WHERE name = 'gemini_live_voice';
