-- =====================================================
-- Phase 7: Elite AI Agent Capabilities Schema
-- User-level agent settings, action history, and scheduled reminders
-- =====================================================

-- User Agent Settings Table
-- Allows users to control what actions the AI agent can perform on their behalf
CREATE TABLE IF NOT EXISTS user_agent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Master toggle for all agent actions
  agent_actions_enabled BOOLEAN DEFAULT false,

  -- Granular action permissions
  allow_send_email BOOLEAN DEFAULT true,
  allow_send_sms BOOLEAN DEFAULT false,
  allow_voice_calls BOOLEAN DEFAULT false,
  allow_create_tasks BOOLEAN DEFAULT true,
  allow_schedule_reminders BOOLEAN DEFAULT true,

  -- Habit reminder settings
  habit_reminders_enabled BOOLEAN DEFAULT true,
  habit_reminder_channel TEXT DEFAULT 'push' CHECK (habit_reminder_channel IN ('push', 'sms', 'email', 'voice')),
  habit_reminder_timing TEXT DEFAULT 'before' CHECK (habit_reminder_timing IN ('before', 'at_time', 'after')),
  habit_reminder_minutes_before INTEGER DEFAULT 30,

  -- Goal check-in settings
  goal_checkins_enabled BOOLEAN DEFAULT true,
  goal_checkin_frequency TEXT DEFAULT 'weekly' CHECK (goal_checkin_frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  goal_checkin_channel TEXT DEFAULT 'email' CHECK (goal_checkin_channel IN ('push', 'sms', 'email', 'voice')),
  goal_checkin_day_of_week INTEGER DEFAULT 1, -- 0=Sunday, 1=Monday, etc.
  goal_checkin_time TIME DEFAULT '09:00:00',

  -- Proactive outreach settings
  allow_proactive_outreach BOOLEAN DEFAULT false,
  proactive_outreach_frequency TEXT DEFAULT 'weekly' CHECK (proactive_outreach_frequency IN ('daily', 'weekly', 'biweekly')),
  proactive_topics TEXT[] DEFAULT ARRAY['habits', 'goals', 'motivation'],

  -- Confirmation requirements
  require_confirmation_email BOOLEAN DEFAULT true,
  require_confirmation_sms BOOLEAN DEFAULT true,
  require_confirmation_voice BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Action History Table
-- Full audit trail of all actions the AI agent has taken on behalf of users
CREATE TABLE IF NOT EXISTS agent_action_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID, -- Reference to voice_coach_sessions if applicable

  -- Action details
  action_type TEXT NOT NULL CHECK (action_type IN ('send_email', 'send_sms', 'voice_call', 'create_task', 'schedule_reminder', 'mark_habit_complete', 'update_goal_progress')),
  action_status TEXT NOT NULL DEFAULT 'pending' CHECK (action_status IN ('pending', 'confirmed', 'executed', 'failed', 'cancelled')),

  -- Action payload (what was sent/created)
  action_payload JSONB NOT NULL DEFAULT '{}',

  -- Results
  result_payload JSONB, -- Response from external service
  error_message TEXT,

  -- Confirmation tracking
  requires_confirmation BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  confirmed_via TEXT CHECK (confirmed_via IN ('voice', 'ui', 'auto')),

  -- Context
  trigger_context TEXT, -- 'conversation', 'scheduled', 'proactive'
  related_habit_id UUID,
  related_goal_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

-- Scheduled Habit Reminders Table
-- Pre-computed reminders for habits based on user preferences
CREATE TABLE IF NOT EXISTS scheduled_habit_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL,

  -- Schedule info
  scheduled_for TIMESTAMPTZ NOT NULL,
  reminder_channel TEXT NOT NULL CHECK (reminder_channel IN ('push', 'sms', 'email', 'voice')),

  -- Content
  habit_name TEXT NOT NULL,
  reminder_message TEXT,

  -- Status tracking
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'skipped', 'snoozed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  -- Snooze tracking
  snoozed_until TIMESTAMPTZ,
  snooze_count INTEGER DEFAULT 0,

  -- Link to action history for audit
  action_history_id UUID REFERENCES agent_action_history(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled Goal Check-ins Table
-- Pre-computed check-in reminders for goals
CREATE TABLE IF NOT EXISTS scheduled_goal_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL,

  -- Schedule info
  scheduled_for TIMESTAMPTZ NOT NULL,
  checkin_channel TEXT NOT NULL CHECK (checkin_channel IN ('push', 'sms', 'email', 'voice')),

  -- Content
  goal_title TEXT NOT NULL,
  checkin_message TEXT,
  current_progress INTEGER, -- Progress at time of scheduling

  -- Status tracking
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'completed', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  user_response TEXT, -- User's check-in response
  error_message TEXT,

  -- Link to action history for audit
  action_history_id UUID REFERENCES agent_action_history(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_agent_settings_user_id ON user_agent_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_action_history_user_id ON agent_action_history(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_action_history_session_id ON agent_action_history(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_action_history_action_type ON agent_action_history(action_type);
CREATE INDEX IF NOT EXISTS idx_agent_action_history_created_at ON agent_action_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_habit_reminders_user_id ON scheduled_habit_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_habit_reminders_scheduled_for ON scheduled_habit_reminders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_habit_reminders_status ON scheduled_habit_reminders(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_goal_checkins_user_id ON scheduled_goal_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_goal_checkins_scheduled_for ON scheduled_goal_checkins(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_goal_checkins_status ON scheduled_goal_checkins(status);

-- Row Level Security Policies
ALTER TABLE user_agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_action_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_habit_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_goal_checkins ENABLE ROW LEVEL SECURITY;

-- User Agent Settings: Users can only manage their own settings
CREATE POLICY "Users can view own agent settings" ON user_agent_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agent settings" ON user_agent_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agent settings" ON user_agent_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Agent Action History: Users can view their own action history
CREATE POLICY "Users can view own action history" ON agent_action_history
  FOR SELECT USING (auth.uid() = user_id);

-- Allow service role to insert action history (from edge functions)
CREATE POLICY "Service role can insert action history" ON agent_action_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update action history" ON agent_action_history
  FOR UPDATE USING (true);

-- Scheduled Habit Reminders: Users can view their own
CREATE POLICY "Users can view own habit reminders" ON scheduled_habit_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage habit reminders" ON scheduled_habit_reminders
  FOR ALL USING (true);

-- Scheduled Goal Check-ins: Users can view their own
CREATE POLICY "Users can view own goal checkins" ON scheduled_goal_checkins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage goal checkins" ON scheduled_goal_checkins
  FOR ALL USING (true);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_agent_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_agent_settings_updated_at
  BEFORE UPDATE ON user_agent_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_settings_updated_at();

-- Function to auto-create default agent settings for new users
CREATE OR REPLACE FUNCTION create_default_agent_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_agent_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger should be added to auth.users if not already handled elsewhere
-- CREATE TRIGGER on_auth_user_created_agent_settings
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION create_default_agent_settings();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_agent_settings TO authenticated;
GRANT SELECT ON agent_action_history TO authenticated;
GRANT SELECT ON scheduled_habit_reminders TO authenticated;
GRANT SELECT ON scheduled_goal_checkins TO authenticated;

-- Service role needs full access for edge functions
GRANT ALL ON user_agent_settings TO service_role;
GRANT ALL ON agent_action_history TO service_role;
GRANT ALL ON scheduled_habit_reminders TO service_role;
GRANT ALL ON scheduled_goal_checkins TO service_role;

-- Add comment documentation
COMMENT ON TABLE user_agent_settings IS 'User-level controls for AI agent capabilities including email, SMS, voice, and reminder settings';
COMMENT ON TABLE agent_action_history IS 'Full audit trail of all AI agent actions taken on behalf of users';
COMMENT ON TABLE scheduled_habit_reminders IS 'Pre-computed habit reminders scheduled based on user preferences';
COMMENT ON TABLE scheduled_goal_checkins IS 'Pre-computed goal check-in reminders scheduled based on user preferences';
