-- ============================================
-- PHASE 3: VOICE INTEGRATION ENHANCEMENT
-- Migration: 20251217_phase3_voice_integration
-- Description: Adds voice-specific columns and optimizes voice coaching
-- ============================================

-- Add voice-related columns to agent_messages
ALTER TABLE agent_messages
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS duration_seconds INT;

COMMENT ON COLUMN agent_messages.message_type IS 'Type of message: text, voice, call';
COMMENT ON COLUMN agent_messages.audio_url IS 'URL to stored audio file if voice message';
COMMENT ON COLUMN agent_messages.duration_seconds IS 'Duration of audio in seconds';

-- Add preferred_voice to user_comm_preferences
ALTER TABLE user_comm_preferences
ADD COLUMN IF NOT EXISTS preferred_voice TEXT DEFAULT 'default',
ADD COLUMN IF NOT EXISTS voice_speed DECIMAL(2,1) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS auto_listen BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN user_comm_preferences.preferred_voice IS 'Preferred TTS voice (e.g., Polly.Joanna, Polly.Matthew)';
COMMENT ON COLUMN user_comm_preferences.voice_speed IS 'Voice playback speed (0.5 to 2.0)';
COMMENT ON COLUMN user_comm_preferences.auto_listen IS 'Automatically start listening after AI speaks';

-- Add columns to voice_coach_sessions for enhanced tracking
ALTER TABLE voice_coach_sessions
ADD COLUMN IF NOT EXISTS total_turns INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS user_word_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_word_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_response_time_ms INT;

COMMENT ON COLUMN voice_coach_sessions.total_turns IS 'Number of conversation turns (user + AI)';
COMMENT ON COLUMN voice_coach_sessions.user_word_count IS 'Total words spoken by user';
COMMENT ON COLUMN voice_coach_sessions.ai_word_count IS 'Total words spoken by AI';
COMMENT ON COLUMN voice_coach_sessions.avg_response_time_ms IS 'Average AI response latency in milliseconds';

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_created
ON voice_coach_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_status
ON voice_coach_sessions(status) WHERE status = 'active';

-- Create function to get user's voice session stats
CREATE OR REPLACE FUNCTION get_voice_session_stats(p_user_id UUID)
RETURNS TABLE (
  total_sessions BIGINT,
  total_minutes NUMERIC,
  avg_sentiment NUMERIC,
  sessions_this_week BIGINT,
  longest_streak INT,
  favorite_session_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_sessions,
    COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - created_at)) / 60), 0)::NUMERIC AS total_minutes,
    COALESCE(AVG(sentiment_score), 0.5)::NUMERIC AS avg_sentiment,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::BIGINT AS sessions_this_week,
    0::INT AS longest_streak, -- Placeholder, can be calculated with more complex logic
    (
      SELECT session_type
      FROM voice_coach_sessions
      WHERE user_id = p_user_id
      GROUP BY session_type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS favorite_session_type
  FROM voice_coach_sessions
  WHERE user_id = p_user_id AND status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for recent voice sessions with summary
CREATE OR REPLACE VIEW user_voice_session_summary AS
SELECT
  vcs.id,
  vcs.user_id,
  vcs.session_type,
  vcs.status,
  vcs.created_at,
  vcs.ended_at,
  vcs.sentiment_score,
  vcs.key_topics,
  vcs.action_items_generated,
  EXTRACT(EPOCH FROM (COALESCE(vcs.ended_at, NOW()) - vcs.created_at)) / 60 AS duration_minutes,
  jsonb_array_length(COALESCE(vcs.transcript, '[]'::jsonb)) AS message_count
FROM voice_coach_sessions vcs
ORDER BY vcs.created_at DESC;

-- Grant access to the view
GRANT SELECT ON user_voice_session_summary TO authenticated;

-- Add proactive voice outreach scheduling table
CREATE TABLE IF NOT EXISTS voice_outreach_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outreach_type TEXT NOT NULL, -- 'morning_motivation', 'habit_reminder', 'celebration', 'check_in'
  scheduled_for TIMESTAMPTZ NOT NULL,
  priority INT DEFAULT 5, -- 1-10, higher = more important
  context JSONB DEFAULT '{}', -- Additional context for the call
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'skipped'
  attempt_count INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_voice_outreach_pending
ON voice_outreach_queue(scheduled_for, priority DESC)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_voice_outreach_user
ON voice_outreach_queue(user_id, created_at DESC);

-- RLS for voice_outreach_queue
ALTER TABLE voice_outreach_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own outreach queue"
ON voice_outreach_queue FOR SELECT
USING (user_id = auth.uid());

-- Only service role can insert/update
CREATE POLICY "Service role manages outreach queue"
ON voice_outreach_queue FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE voice_outreach_queue IS 'Queue for proactive voice outreach calls';
