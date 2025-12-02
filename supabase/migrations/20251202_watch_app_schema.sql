-- ============================================
-- Apple Watch App Schema
-- Version: 1.0
-- Created: December 2, 2025
-- ============================================
-- This migration adds tables required for Apple Watch companion app:
-- - Device token storage for APNs push notifications
-- - Notification logging for debugging and analytics
-- - Watch-specific session tracking
-- ============================================

-- ===========================================
-- TABLE: user_device_tokens
-- Purpose: Store APNs device tokens for push notifications
-- ===========================================
CREATE TABLE IF NOT EXISTS user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Device identification
  device_token TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('watch', 'phone', 'ipad', 'mac')),
  device_name TEXT, -- "Milton's Apple Watch"
  device_model TEXT, -- "Apple Watch Series 9"

  -- Platform info
  platform TEXT NOT NULL CHECK (platform IN ('apns', 'fcm', 'web')),
  os_version TEXT, -- "watchOS 10.2"
  app_version TEXT, -- "1.0.0"

  -- Token status
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique tokens per user
  UNIQUE(user_id, device_token)
);

-- Index for efficient token lookup
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
  ON user_device_tokens(user_id, is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_device_tokens_platform
  ON user_device_tokens(platform, device_type);

-- ===========================================
-- TABLE: notification_log
-- Purpose: Log all push notifications for debugging and analytics
-- ===========================================
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification details
  device_token TEXT,
  notification_type TEXT NOT NULL, -- HABIT_REMINDER, STREAK_ALERT, COACH_MESSAGE, etc.
  title TEXT,
  body TEXT,
  category TEXT,

  -- Delivery status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'delivered', 'failed', 'clicked', 'dismissed'
  )),

  -- APNs response
  apns_response JSONB DEFAULT '{}',
  apns_id TEXT, -- APNs message ID

  -- Related entities
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient log queries
CREATE INDEX IF NOT EXISTS idx_notification_log_user
  ON notification_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_log_status
  ON notification_log(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_log_type
  ON notification_log(notification_type, created_at DESC);

-- ===========================================
-- TABLE: watch_sessions
-- Purpose: Track Watch app usage sessions for analytics
-- ===========================================
CREATE TABLE IF NOT EXISTS watch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES user_device_tokens(id) ON DELETE SET NULL,

  -- Session timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INT
      ELSE NULL
    END
  ) STORED,

  -- Session actions
  habits_viewed INT DEFAULT 0,
  habits_completed INT DEFAULT 0,
  coach_prompts_viewed INT DEFAULT 0,
  complications_tapped INT DEFAULT 0,

  -- Context
  app_version TEXT,
  watch_os_version TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session analytics
CREATE INDEX IF NOT EXISTS idx_watch_sessions_user
  ON watch_sessions(user_id, started_at DESC);

-- ===========================================
-- TABLE: watch_complications_config
-- Purpose: Store user's Watch complication preferences
-- ===========================================
CREATE TABLE IF NOT EXISTS watch_complications_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Complication settings
  complication_family TEXT NOT NULL, -- circular, rectangular, inline, etc.
  display_mode TEXT NOT NULL DEFAULT 'streak' CHECK (display_mode IN (
    'streak', 'habits_remaining', 'next_habit', 'coach_tip', 'progress_ring'
  )),

  -- Featured habit (optional)
  featured_habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,

  -- Refresh settings
  refresh_interval_minutes INT DEFAULT 30,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, complication_family)
);

-- ===========================================
-- Add 'source' column to habit_completions if not exists
-- Purpose: Track where habit was completed (watch, phone, web)
-- ===========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'habit_completions' AND column_name = 'source'
  ) THEN
    ALTER TABLE habit_completions
    ADD COLUMN source TEXT DEFAULT 'web' CHECK (source IN ('web', 'phone', 'watch', 'api', 'voice'));
  END IF;
END $$;

-- ===========================================
-- RLS Policies
-- ===========================================

-- Enable RLS
ALTER TABLE user_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_complications_config ENABLE ROW LEVEL SECURITY;

-- user_device_tokens policies
DROP POLICY IF EXISTS "Users can view their own device tokens" ON user_device_tokens;
CREATE POLICY "Users can view their own device tokens" ON user_device_tokens
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own device tokens" ON user_device_tokens;
CREATE POLICY "Users can insert their own device tokens" ON user_device_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own device tokens" ON user_device_tokens;
CREATE POLICY "Users can update their own device tokens" ON user_device_tokens
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own device tokens" ON user_device_tokens;
CREATE POLICY "Users can delete their own device tokens" ON user_device_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- notification_log policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notification_log;
CREATE POLICY "Users can view their own notifications" ON notification_log
  FOR SELECT USING (auth.uid() = user_id);

-- watch_sessions policies
DROP POLICY IF EXISTS "Users can view their own watch sessions" ON watch_sessions;
CREATE POLICY "Users can view their own watch sessions" ON watch_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own watch sessions" ON watch_sessions;
CREATE POLICY "Users can insert their own watch sessions" ON watch_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own watch sessions" ON watch_sessions;
CREATE POLICY "Users can update their own watch sessions" ON watch_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- watch_complications_config policies
DROP POLICY IF EXISTS "Users can manage their complication config" ON watch_complications_config;
CREATE POLICY "Users can manage their complication config" ON watch_complications_config
  FOR ALL USING (auth.uid() = user_id);

-- ===========================================
-- Service role policies for Edge Functions
-- ===========================================

-- Allow service role to insert notifications (for Edge Functions)
DROP POLICY IF EXISTS "Service role can insert notifications" ON notification_log;
CREATE POLICY "Service role can insert notifications" ON notification_log
  FOR INSERT WITH CHECK (true);

-- Allow service role to manage device tokens (for Edge Functions)
DROP POLICY IF EXISTS "Service role can manage device tokens" ON user_device_tokens;
CREATE POLICY "Service role can manage device tokens" ON user_device_tokens
  FOR ALL USING (true);

-- ===========================================
-- Functions
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_device_tokens_updated_at ON user_device_tokens;
CREATE TRIGGER update_device_tokens_updated_at
  BEFORE UPDATE ON user_device_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_complications_config_updated_at ON watch_complications_config;
CREATE TRIGGER update_complications_config_updated_at
  BEFORE UPDATE ON watch_complications_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Comments for documentation
-- ===========================================
COMMENT ON TABLE user_device_tokens IS 'Stores APNs/FCM device tokens for push notifications to Watch and iOS apps';
COMMENT ON TABLE notification_log IS 'Audit log of all push notifications sent, for debugging and analytics';
COMMENT ON TABLE watch_sessions IS 'Tracks Watch app usage sessions for engagement analytics';
COMMENT ON TABLE watch_complications_config IS 'User preferences for Watch face complications';
