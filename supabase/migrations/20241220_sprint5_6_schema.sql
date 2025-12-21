-- Sprint 5 & 6: Calendar Integration, Feedback, and Feature Flags Schema
-- This migration adds tables for calendar connections, feedback, and feature flags

-- ============================================
-- Feature Flags Table
-- ============================================
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  target_users TEXT[] DEFAULT '{}',
  excluded_users TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);

-- Insert default agent feature flags
INSERT INTO feature_flags (name, description, enabled, rollout_percentage) VALUES
  ('agent_actions_enabled', 'Enable AI agent action suggestions', true, 100),
  ('auto_execute_low_risk', 'Auto-execute low-risk actions without approval', false, 0),
  ('calendar_integration', 'Enable Google Calendar integration', true, 100),
  ('parallel_execution', 'Allow parallel action execution', false, 25),
  ('batch_actions', 'Enable batch action processing', false, 50),
  ('smart_scheduling', 'AI-powered optimal scheduling', false, 10),
  ('predictive_suggestions', 'Predictive action suggestions', false, 5),
  ('team_collaboration', 'Team-based action sharing', false, 0),
  ('voice_commands', 'Voice command input (experimental)', false, 0),
  ('natural_language_input', 'Natural language action input', false, 0)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- User Calendar Connections Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  calendar_id TEXT,
  calendar_name TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT[],
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON user_calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON user_calendar_connections(provider);

-- ============================================
-- Agent Action Feedback Table
-- ============================================
CREATE TABLE IF NOT EXISTS agent_action_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES pending_agent_actions(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'edited')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_action_feedback_user ON agent_action_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_action_feedback_action ON agent_action_feedback(action_id);
CREATE INDEX IF NOT EXISTS idx_action_feedback_type ON agent_action_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_action_feedback_created ON agent_action_feedback(created_at);

-- ============================================
-- User Preferences Updates
-- ============================================
-- Add onboarding flag to user preferences if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'agent_onboarding_completed'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN agent_onboarding_completed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Feature Flags: Read-only for authenticated users, write for service role
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags" ON feature_flags
  FOR SELECT USING (true);

-- Calendar Connections: Users can only access their own connections
ALTER TABLE user_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar connections" ON user_calendar_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar connections" ON user_calendar_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar connections" ON user_calendar_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar connections" ON user_calendar_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Action Feedback: Users can only access their own feedback
ALTER TABLE agent_action_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback" ON agent_action_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" ON agent_action_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Updated Timestamp Triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to feature_flags
DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to user_calendar_connections
DROP TRIGGER IF EXISTS update_calendar_connections_updated_at ON user_calendar_connections;
CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON user_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
