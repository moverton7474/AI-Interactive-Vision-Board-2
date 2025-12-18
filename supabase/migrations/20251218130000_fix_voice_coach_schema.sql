-- ============================================
-- FIX VOICE COACH SESSIONS SCHEMA MISMATCHES
-- Migration: 20251218130000_fix_voice_coach_schema
-- Description: Updates voice_coach_sessions table to match
--              the voice-coach-session Edge Function requirements
-- ============================================

-- ============================================
-- 1. FIX SESSION_TYPE CHECK CONSTRAINT
-- ============================================
-- The original constraint is too restrictive. Add new session types.

-- Drop the old constraint
ALTER TABLE voice_coach_sessions DROP CONSTRAINT IF EXISTS voice_coach_sessions_session_type_check;

-- Add updated constraint with all valid session types
ALTER TABLE voice_coach_sessions ADD CONSTRAINT voice_coach_sessions_session_type_check
CHECK (session_type IN (
  -- Original types
  'on_demand', 'habit_trigger', 'weekly_review',
  'milestone_celebration', 'pace_warning', 'check_in', 'morning_intention',
  -- New types from Edge Function
  'morning_routine', 'reflection', 'goal_setting', 'celebration',
  'accountability', 'crisis_support'
));

-- ============================================
-- 2. FIX TRANSCRIPT COLUMN TYPE
-- ============================================
-- Change from TEXT to JSONB to support array of transcript objects

-- First, convert existing text data to JSONB array format
ALTER TABLE voice_coach_sessions
ALTER COLUMN transcript TYPE JSONB
USING CASE
  WHEN transcript IS NULL THEN '[]'::jsonb
  WHEN transcript = '' THEN '[]'::jsonb
  ELSE jsonb_build_array(jsonb_build_object('role', 'user', 'content', transcript))
END;

-- Set default to empty array
ALTER TABLE voice_coach_sessions ALTER COLUMN transcript SET DEFAULT '[]'::jsonb;

-- ============================================
-- 3. ADD DURATION_MINUTES COLUMN
-- ============================================
-- The Edge Function uses duration_minutes, not duration_seconds

ALTER TABLE voice_coach_sessions ADD COLUMN IF NOT EXISTS duration_minutes INT;

-- Migrate existing data from seconds to minutes
UPDATE voice_coach_sessions
SET duration_minutes = ROUND(duration_seconds / 60.0)
WHERE duration_seconds IS NOT NULL AND duration_minutes IS NULL;

-- ============================================
-- 4. FIX STATUS CHECK CONSTRAINT
-- ============================================
-- Ensure 'completed' status is allowed (it should already be)

-- Drop and recreate to ensure correct values
ALTER TABLE voice_coach_sessions DROP CONSTRAINT IF EXISTS voice_coach_sessions_status_check;

ALTER TABLE voice_coach_sessions ADD CONSTRAINT voice_coach_sessions_status_check
CHECK (status IN ('active', 'completed', 'interrupted', 'failed', 'pending'));

-- ============================================
-- 5. ENSURE REQUIRED COLUMNS EXIST
-- ============================================

-- sentiment_score should allow 0-1 range (not just -1 to 1)
ALTER TABLE voice_coach_sessions DROP CONSTRAINT IF EXISTS voice_coach_sessions_sentiment_score_check;
ALTER TABLE voice_coach_sessions ADD CONSTRAINT voice_coach_sessions_sentiment_score_check
CHECK (sentiment_score IS NULL OR (sentiment_score >= 0 AND sentiment_score <= 1));

-- ============================================
-- 6. ADD SERVICE ROLE POLICY
-- ============================================
-- Service role should be able to manage all sessions

DROP POLICY IF EXISTS "Service role manages voice sessions" ON voice_coach_sessions;
CREATE POLICY "Service role manages voice sessions"
ON voice_coach_sessions FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- 7. APPLY VOICE COACH ADMIN MIGRATION
-- ============================================
-- Ensure the team_ai_settings, communication_templates, and engagement_alerts tables exist

-- Team AI Settings (if not exists from previous migration)
CREATE TABLE IF NOT EXISTS team_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  coach_name TEXT DEFAULT 'AMIE',
  coach_tone TEXT DEFAULT 'warm_encouraging',
  blocked_topics TEXT[] DEFAULT '{}',
  required_disclaimers TEXT[] DEFAULT '{}',
  custom_instructions TEXT,
  enable_sentiment_alerts BOOLEAN DEFAULT true,
  sentiment_alert_threshold FLOAT DEFAULT 0.3,
  enable_crisis_detection BOOLEAN DEFAULT true,
  crisis_escalation_email TEXT,
  crisis_keywords TEXT[] DEFAULT ARRAY['suicide', 'self-harm', 'hurt myself', 'end it all'],
  max_session_duration_minutes INT DEFAULT 30,
  max_sessions_per_day INT DEFAULT 5,
  cooldown_between_sessions_minutes INT DEFAULT 0,
  allow_send_email BOOLEAN DEFAULT true,
  allow_create_tasks BOOLEAN DEFAULT true,
  allow_schedule_reminders BOOLEAN DEFAULT true,
  allow_access_user_data BOOLEAN DEFAULT true,
  require_confirmation BOOLEAN DEFAULT true,
  default_voice TEXT DEFAULT 'default',
  default_voice_speed DECIMAL(2,1) DEFAULT 1.0,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id)
);

-- Enable RLS if not already
ALTER TABLE team_ai_settings ENABLE ROW LEVEL SECURITY;

-- Service role policy for team_ai_settings
DROP POLICY IF EXISTS "Service role manages AI settings" ON team_ai_settings;
CREATE POLICY "Service role manages AI settings"
ON team_ai_settings FOR ALL
USING (auth.role() = 'service_role');

-- Managers can view
DROP POLICY IF EXISTS "Team managers can view AI settings" ON team_ai_settings;
CREATE POLICY "Team managers can view AI settings"
ON team_ai_settings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = team_ai_settings.team_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin', 'manager')
    AND tm.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM platform_roles pr
    WHERE pr.user_id = auth.uid()
    AND pr.role = 'platform_admin'
    AND pr.is_active = true
  )
);

-- Communication Templates (if not exists)
CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_html_template TEXT NOT NULL,
  body_text_template TEXT,
  variables TEXT[] DEFAULT '{}',
  preview_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  usage_count INT DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages templates" ON communication_templates;
CREATE POLICY "Service role manages templates"
ON communication_templates FOR ALL
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "View communication templates" ON communication_templates;
CREATE POLICY "View communication templates"
ON communication_templates FOR SELECT
USING (
  is_system = true
  OR team_id IS NULL
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = communication_templates.team_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin', 'manager')
    AND tm.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM platform_roles pr
    WHERE pr.user_id = auth.uid()
    AND pr.role = 'platform_admin'
    AND pr.is_active = true
  )
);

-- Engagement Alerts (if not exists)
CREATE TABLE IF NOT EXISTS engagement_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE engagement_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages alerts" ON engagement_alerts;
CREATE POLICY "Service role manages alerts"
ON engagement_alerts FOR ALL
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Team managers can view alerts" ON engagement_alerts;
CREATE POLICY "Team managers can view alerts"
ON engagement_alerts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = engagement_alerts.team_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin', 'manager')
    AND tm.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM platform_roles pr
    WHERE pr.user_id = auth.uid()
    AND pr.role = 'platform_admin'
    AND pr.is_active = true
  )
);

-- Voice Outreach Queue team_id column
ALTER TABLE voice_outreach_queue ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- ============================================
-- 8. SEED SYSTEM TEMPLATES (if not exist)
-- ============================================

INSERT INTO communication_templates (name, category, subject_template, body_html_template, body_text_template, variables, is_system) VALUES
(
  'Weekly Motivation',
  'motivation',
  'Keep Going, {{name}}!',
  '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #4F46E5;">Keep the momentum going!</h1>
    <p>Hi {{name}},</p>
    <p>Your dedication to your goals is inspiring. With a streak of <strong>{{streak}} days</strong>, you''re building habits that will transform your life.</p>
    <p>Remember: every small step counts. Keep showing up for yourself!</p>
    <p style="margin-top: 20px;">Best,<br>Your {{team_name}} Team</p>
  </div>',
  'Hi {{name}}, Your dedication to your goals is inspiring. With a streak of {{streak}} days, you''re building habits that will transform your life. Remember: every small step counts. Keep showing up for yourself! Best, Your {{team_name}} Team',
  ARRAY['name', 'streak', 'team_name'],
  true
),
(
  'Gentle Nudge',
  'reminder',
  'We Miss You, {{name}}',
  '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #6366F1;">We noticed you''ve been away</h1>
    <p>Hi {{name}},</p>
    <p>It''s been a few days since we''ve seen you, and we just wanted to check in.</p>
    <p>Life gets busy—we get it. But your goals are still waiting for you.</p>
    <p>Even 5 minutes today can make a difference. Ready to get back on track?</p>
    <p style="margin-top: 20px;">We''re rooting for you,<br>Your {{team_name}} Team</p>
  </div>',
  'Hi {{name}}, It''s been a few days since we''ve seen you, and we just wanted to check in. Life gets busy—we get it. But your goals are still waiting for you. Even 5 minutes today can make a difference. We''re rooting for you, Your {{team_name}} Team',
  ARRAY['name', 'team_name'],
  true
),
(
  'Streak Celebration',
  'milestone',
  'Congratulations on {{streak}} Days, {{name}}!',
  '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #059669;">Amazing Achievement!</h1>
    <p>Hi {{name}},</p>
    <p>You''ve hit a major milestone: <strong>{{streak}} consecutive days</strong> of showing up for your goals!</p>
    <p>This isn''t just a number—it''s proof of your commitment to becoming your best self.</p>
    <p>Keep going! Your next milestone is just around the corner.</p>
    <p style="margin-top: 20px;">Celebrating with you,<br>Your {{team_name}} Team</p>
  </div>',
  'Hi {{name}}, You''ve hit a major milestone: {{streak}} consecutive days of showing up for your goals! This isn''t just a number—it''s proof of your commitment. Keep going! Celebrating with you, Your {{team_name}} Team',
  ARRAY['name', 'streak', 'team_name'],
  true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
