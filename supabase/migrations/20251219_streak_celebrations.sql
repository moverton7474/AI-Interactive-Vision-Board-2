-- ============================================
-- STREAK CELEBRATIONS INFRASTRUCTURE
-- Migration: 20251219_streak_celebrations
--
-- Implements Phase 3 - Streak Celebration Notifications
-- Sends celebratory notifications when users hit milestone streaks
-- ============================================

-- ============================================
-- PART 1: STREAK CELEBRATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS streak_celebrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL,
  streak_count INT NOT NULL,
  message TEXT NOT NULL,
  celebrated_at TIMESTAMPTZ DEFAULT NOW(),
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_channel TEXT DEFAULT 'sms',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE streak_celebrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own celebrations
CREATE POLICY "Users can view own streak celebrations"
ON streak_celebrations FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert celebrations
CREATE POLICY "Service role can insert celebrations"
ON streak_celebrations FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Service role can update celebrations
CREATE POLICY "Service role can update celebrations"
ON streak_celebrations FOR UPDATE
USING (auth.role() = 'service_role');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_streak_celebrations_user ON streak_celebrations(user_id);
CREATE INDEX IF NOT EXISTS idx_streak_celebrations_habit ON streak_celebrations(habit_id);
CREATE INDEX IF NOT EXISTS idx_streak_celebrations_streak ON streak_celebrations(streak_count);

-- ============================================
-- PART 2: ADD CELEBRATION PREFERENCES TO USER_AGENT_SETTINGS
-- ============================================

-- Add streak celebration columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_agent_settings'
    AND column_name = 'streak_celebrations_enabled'
  ) THEN
    ALTER TABLE user_agent_settings
    ADD COLUMN streak_celebrations_enabled BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_agent_settings'
    AND column_name = 'celebration_channel'
  ) THEN
    ALTER TABLE user_agent_settings
    ADD COLUMN celebration_channel TEXT DEFAULT 'sms';
  END IF;
END $$;

-- ============================================
-- PART 3: SCHEDULED REMINDERS TABLE (Enhanced)
-- ============================================

CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID,
  reminder_type TEXT NOT NULL, -- 'habit', 'streak', 'motivation', 'check_in'
  scheduled_for TIMESTAMPTZ NOT NULL,
  message TEXT,
  channel TEXT DEFAULT 'sms', -- 'sms', 'push', 'email'
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;

-- Users can view their own reminders
CREATE POLICY "Users can view own scheduled reminders"
ON scheduled_reminders FOR SELECT
USING (auth.uid() = user_id);

-- Users can manage their own reminders
CREATE POLICY "Users can manage own scheduled reminders"
ON scheduled_reminders FOR ALL
USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role manages scheduled reminders"
ON scheduled_reminders FOR ALL
USING (auth.role() = 'service_role');

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_user ON scheduled_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_scheduled ON scheduled_reminders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_status ON scheduled_reminders(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_pending ON scheduled_reminders(scheduled_for, status) WHERE status = 'pending';

-- ============================================
-- PART 4: AUTOMATION RULES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'streak_milestone', 'missed_habit', 'goal_progress', 'inactivity'
  trigger_config JSONB DEFAULT '{}', -- Configuration for the trigger
  action_type TEXT NOT NULL, -- 'send_sms', 'send_email', 'schedule_call', 'create_task'
  action_config JSONB DEFAULT '{}', -- Configuration for the action
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

-- Users can manage their own automation rules
CREATE POLICY "Users can manage own automation rules"
ON automation_rules FOR ALL
USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role manages automation rules"
ON automation_rules FOR ALL
USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_automation_rules_user ON automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(is_active) WHERE is_active = TRUE;

-- ============================================
-- PART 5: AUTOMATION EXECUTION LOG
-- ============================================

CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_data JSONB, -- Data that triggered the automation
  action_result JSONB, -- Result of the action
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

-- Users can view their own automation executions
CREATE POLICY "Users can view own automation executions"
ON automation_executions FOR SELECT
USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role manages automation executions"
ON automation_executions FOR ALL
USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule ON automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_user ON automation_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_status ON automation_executions(status);

-- ============================================
-- PART 6: INSERT DEFAULT AUTOMATION RULES
-- ============================================

-- Create function to set up default automation rules for new users
CREATE OR REPLACE FUNCTION setup_default_automation_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Streak milestone celebration rule
  INSERT INTO automation_rules (user_id, name, description, trigger_type, trigger_config, action_type, action_config)
  VALUES (
    NEW.id,
    'Streak Celebrations',
    'Celebrate when you hit streak milestones',
    'streak_milestone',
    '{"milestones": [7, 14, 21, 30, 60, 90, 100, 180, 365]}',
    'send_sms',
    '{"template": "celebration"}'
  );

  -- Missed habit reminder rule
  INSERT INTO automation_rules (user_id, name, description, trigger_type, trigger_config, action_type, action_config)
  VALUES (
    NEW.id,
    'Missed Habit Reminder',
    'Get reminded if you miss a habit for 2 days',
    'missed_habit',
    '{"days_missed": 2}',
    'send_sms',
    '{"template": "encouragement"}'
  );

  -- Inactivity check-in rule
  INSERT INTO automation_rules (user_id, name, description, trigger_type, trigger_config, action_type, action_config, is_active)
  VALUES (
    NEW.id,
    'Inactivity Check-in',
    'Check in if no activity for 3 days',
    'inactivity',
    '{"days_inactive": 3}',
    'schedule_call',
    '{"call_type": "check_in"}',
    FALSE -- Disabled by default
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users (only if profiles table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    DROP TRIGGER IF EXISTS trigger_setup_automation_rules ON profiles;
    CREATE TRIGGER trigger_setup_automation_rules
      AFTER INSERT ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION setup_default_automation_rules();
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('streak_celebrations', 'scheduled_reminders', 'automation_rules', 'automation_executions');
