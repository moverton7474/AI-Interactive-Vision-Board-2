-- ============================================
-- MANAGER DASHBOARD: VOICE COACH & AI ADMIN CONTROLS
-- Migration: 20251218_voice_coach_admin
-- Description: Adds tables and functions for AI coach analytics,
--              guardrails, templates, alerts, and outreach management
-- ============================================

-- ============================================
-- 1. TEAM AI SETTINGS (Guardrails & Configuration)
-- ============================================

CREATE TABLE IF NOT EXISTS team_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Coach Personality
  coach_name TEXT DEFAULT 'AMIE',
  coach_tone TEXT DEFAULT 'warm_encouraging', -- 'professional', 'casual', 'motivational', 'direct'

  -- Topic Guardrails
  blocked_topics TEXT[] DEFAULT '{}', -- Topics AI should avoid
  required_disclaimers TEXT[] DEFAULT '{}', -- Disclaimers to include
  custom_instructions TEXT, -- Additional instructions for the AI

  -- Safety Controls
  enable_sentiment_alerts BOOLEAN DEFAULT true,
  sentiment_alert_threshold FLOAT DEFAULT 0.3, -- Alert if sentiment drops below
  enable_crisis_detection BOOLEAN DEFAULT true,
  crisis_escalation_email TEXT, -- Email to notify on crisis detection
  crisis_keywords TEXT[] DEFAULT ARRAY['suicide', 'self-harm', 'hurt myself', 'end it all'],

  -- Session Limits
  max_session_duration_minutes INT DEFAULT 30,
  max_sessions_per_day INT DEFAULT 5,
  cooldown_between_sessions_minutes INT DEFAULT 0,

  -- Agentic Capabilities
  allow_send_email BOOLEAN DEFAULT true,
  allow_create_tasks BOOLEAN DEFAULT true,
  allow_schedule_reminders BOOLEAN DEFAULT true,
  allow_access_user_data BOOLEAN DEFAULT true,
  require_confirmation BOOLEAN DEFAULT true, -- Require user confirm before actions

  -- Voice Settings
  default_voice TEXT DEFAULT 'default',
  default_voice_speed DECIMAL(2,1) DEFAULT 1.0,

  -- Audit
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id)
);

-- Enable RLS
ALTER TABLE team_ai_settings ENABLE ROW LEVEL SECURITY;

-- Managers can view their team's settings
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

-- Admins can update their team's settings
CREATE POLICY "Team admins can update AI settings"
ON team_ai_settings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = team_ai_settings.team_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
    AND tm.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM platform_roles pr
    WHERE pr.user_id = auth.uid()
    AND pr.role = 'platform_admin'
    AND pr.is_active = true
  )
);

-- Admins can insert settings for their team
CREATE POLICY "Team admins can insert AI settings"
ON team_ai_settings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = team_ai_settings.team_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
    AND tm.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM platform_roles pr
    WHERE pr.user_id = auth.uid()
    AND pr.role = 'platform_admin'
    AND pr.is_active = true
  )
);

-- Service role can manage all settings
CREATE POLICY "Service role manages AI settings"
ON team_ai_settings FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE team_ai_settings IS 'Per-team AI coach configuration and guardrails';

-- ============================================
-- 2. COMMUNICATION TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE, -- NULL = system template
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'recognition', 'reminder', 'milestone', 'motivation', 'welcome', 'custom'
  subject_template TEXT NOT NULL,
  body_html_template TEXT NOT NULL,
  body_text_template TEXT,
  variables TEXT[] DEFAULT '{}', -- Available merge fields: {{name}}, {{streak}}, {{goal}}, etc.
  preview_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- System templates can't be edited/deleted
  usage_count INT DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can view system templates, managers can view their team's templates
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

-- Managers can create templates for their team
CREATE POLICY "Create communication templates"
ON communication_templates FOR INSERT
WITH CHECK (
  is_system = false
  AND (
    EXISTS (
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
  )
);

-- Managers can update their team's templates (not system templates)
CREATE POLICY "Update communication templates"
ON communication_templates FOR UPDATE
USING (
  is_system = false
  AND (
    EXISTS (
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
  )
);

-- Service role can manage all templates
CREATE POLICY "Service role manages templates"
ON communication_templates FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE communication_templates IS 'Reusable email templates for team communications';

-- Seed system templates
INSERT INTO communication_templates (name, category, subject_template, body_html_template, body_text_template, variables, is_system) VALUES
(
  'Weekly Motivation',
  'motivation',
  'Keep Going, {{name}}! 🚀',
  '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #4F46E5;">Keep the momentum going!</h1>
    <p>Hi {{name}},</p>
    <p>Your dedication to your goals is inspiring. With a streak of <strong>{{streak}} days</strong>, you''re building habits that will transform your life.</p>
    <p>Remember: every small step counts. Keep showing up for yourself!</p>
    <p style="margin-top: 20px;">Best,<br>Your {{team_name}} Team</p>
  </div>',
  'Hi {{name}},

Your dedication to your goals is inspiring. With a streak of {{streak}} days, you''re building habits that will transform your life.

Remember: every small step counts. Keep showing up for yourself!

Best,
Your {{team_name}} Team',
  ARRAY['name', 'streak', 'team_name'],
  true
),
(
  'Streak Celebration',
  'milestone',
  '🎉 Congratulations on {{streak}} Days, {{name}}!',
  '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #059669;">Amazing Achievement! 🎉</h1>
    <p>Hi {{name}},</p>
    <p>You''ve hit a major milestone: <strong>{{streak}} consecutive days</strong> of showing up for your goals!</p>
    <p>This isn''t just a number—it''s proof of your commitment to becoming your best self. Your consistency is truly remarkable.</p>
    <p>Keep going! Your next milestone is just around the corner.</p>
    <p style="margin-top: 20px;">Celebrating with you,<br>Your {{team_name}} Team</p>
  </div>',
  'Hi {{name}},

You''ve hit a major milestone: {{streak}} consecutive days of showing up for your goals!

This isn''t just a number—it''s proof of your commitment to becoming your best self. Your consistency is truly remarkable.

Keep going! Your next milestone is just around the corner.

Celebrating with you,
Your {{team_name}} Team',
  ARRAY['name', 'streak', 'team_name'],
  true
),
(
  'Gentle Nudge',
  'reminder',
  'We Miss You, {{name}} 💙',
  '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #6366F1;">We noticed you''ve been away</h1>
    <p>Hi {{name}},</p>
    <p>It''s been a few days since we''ve seen you, and we just wanted to check in.</p>
    <p>Life gets busy—we get it. But your goals are still waiting for you, and so is your progress.</p>
    <p>Even 5 minutes today can make a difference. Ready to get back on track?</p>
    <p style="margin-top: 20px;">We''re rooting for you,<br>Your {{team_name}} Team</p>
  </div>',
  'Hi {{name}},

It''s been a few days since we''ve seen you, and we just wanted to check in.

Life gets busy—we get it. But your goals are still waiting for you, and so is your progress.

Even 5 minutes today can make a difference. Ready to get back on track?

We''re rooting for you,
Your {{team_name}} Team',
  ARRAY['name', 'team_name'],
  true
),
(
  'Goal Progress Update',
  'milestone',
  '{{name}}, You''re {{progress}}% Closer to Your Goal!',
  '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #8B5CF6;">Progress Report 📈</h1>
    <p>Hi {{name}},</p>
    <p>Great news! You''re now <strong>{{progress}}%</strong> of the way to achieving <em>{{goal}}</em>.</p>
    <p>Your consistent effort is paying off. Here''s what you''ve accomplished:</p>
    <ul>
      <li>Current streak: {{streak}} days</li>
      <li>Habits completed this week: {{weekly_completions}}</li>
    </ul>
    <p>Keep pushing forward—you''re closer than you think!</p>
    <p style="margin-top: 20px;">Cheering you on,<br>Your {{team_name}} Team</p>
  </div>',
  'Hi {{name}},

Great news! You''re now {{progress}}% of the way to achieving {{goal}}.

Your consistent effort is paying off. Here''s what you''ve accomplished:
- Current streak: {{streak}} days
- Habits completed this week: {{weekly_completions}}

Keep pushing forward—you''re closer than you think!

Cheering you on,
Your {{team_name}} Team',
  ARRAY['name', 'progress', 'goal', 'streak', 'weekly_completions', 'team_name'],
  true
),
(
  'Welcome to Team',
  'welcome',
  'Welcome to {{team_name}}, {{name}}! 🌟',
  '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #4F46E5;">Welcome to the Team! 🌟</h1>
    <p>Hi {{name}},</p>
    <p>We''re thrilled to have you join <strong>{{team_name}}</strong>!</p>
    <p>Here''s what you can look forward to:</p>
    <ul>
      <li>Personalized AI coaching with AMIE</li>
      <li>Habit tracking and streak building</li>
      <li>Team support and accountability</li>
      <li>Progress insights and celebrations</li>
    </ul>
    <p>Ready to start your journey? Log in and set your first goal!</p>
    <p style="margin-top: 20px;">Welcome aboard,<br>The {{team_name}} Team</p>
  </div>',
  'Hi {{name}},

We''re thrilled to have you join {{team_name}}!

Here''s what you can look forward to:
- Personalized AI coaching with AMIE
- Habit tracking and streak building
- Team support and accountability
- Progress insights and celebrations

Ready to start your journey? Log in and set your first goal!

Welcome aboard,
The {{team_name}} Team',
  ARRAY['name', 'team_name'],
  true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. ENGAGEMENT ALERTS
-- ============================================

CREATE TABLE IF NOT EXISTS engagement_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'inactive', 'low_sentiment', 'broken_streak', 'crisis_detected', 'milestone'
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}', -- Additional context (sentiment score, streak length, etc.)
  status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'dismissed'
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  action_taken TEXT, -- Notes on what action was taken
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_engagement_alerts_team_status
ON engagement_alerts(team_id, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_engagement_alerts_user
ON engagement_alerts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagement_alerts_severity
ON engagement_alerts(severity, created_at DESC) WHERE status = 'active';

-- Enable RLS
ALTER TABLE engagement_alerts ENABLE ROW LEVEL SECURITY;

-- Managers can view alerts for their team
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

-- Managers can update alert status
CREATE POLICY "Team managers can update alerts"
ON engagement_alerts FOR UPDATE
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

-- Service role can manage all alerts
CREATE POLICY "Service role manages alerts"
ON engagement_alerts FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE engagement_alerts IS 'Proactive alerts for managers about team member engagement';

-- ============================================
-- 4. VOICE COACH ANALYTICS FUNCTIONS
-- ============================================

-- Function to get team voice coach statistics
CREATE OR REPLACE FUNCTION get_team_voice_stats(
  p_team_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_sessions BIGINT,
  unique_users BIGINT,
  avg_duration_minutes NUMERIC,
  avg_sentiment NUMERIC,
  sessions_this_week BIGINT,
  total_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(vcs.id)::BIGINT AS total_sessions,
    COUNT(DISTINCT vcs.user_id)::BIGINT AS unique_users,
    COALESCE(AVG(EXTRACT(EPOCH FROM (vcs.ended_at - vcs.created_at)) / 60), 0)::NUMERIC AS avg_duration_minutes,
    COALESCE(AVG(vcs.sentiment_score), 0.5)::NUMERIC AS avg_sentiment,
    COUNT(*) FILTER (WHERE vcs.created_at > NOW() - INTERVAL '7 days')::BIGINT AS sessions_this_week,
    COALESCE(SUM(EXTRACT(EPOCH FROM (vcs.ended_at - vcs.created_at)) / 60), 0)::NUMERIC AS total_minutes
  FROM voice_coach_sessions vcs
  INNER JOIN team_members tm ON tm.user_id = vcs.user_id AND tm.team_id = p_team_id
  WHERE vcs.created_at >= p_start_date
    AND vcs.created_at <= p_end_date + INTERVAL '1 day'
    AND vcs.status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get per-member voice statistics
CREATE OR REPLACE FUNCTION get_team_member_voice_stats(
  p_team_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  session_count BIGINT,
  total_minutes NUMERIC,
  avg_sentiment NUMERIC,
  last_session TIMESTAMPTZ,
  favorite_session_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tm.user_id,
    p.email,
    COALESCE(SPLIT_PART(p.email, '@', 1), 'User') AS display_name,
    COUNT(vcs.id)::BIGINT AS session_count,
    COALESCE(SUM(EXTRACT(EPOCH FROM (vcs.ended_at - vcs.created_at)) / 60), 0)::NUMERIC AS total_minutes,
    COALESCE(AVG(vcs.sentiment_score), 0.5)::NUMERIC AS avg_sentiment,
    MAX(vcs.created_at) AS last_session,
    (
      SELECT vcs2.session_type
      FROM voice_coach_sessions vcs2
      WHERE vcs2.user_id = tm.user_id
      GROUP BY vcs2.session_type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS favorite_session_type
  FROM team_members tm
  INNER JOIN profiles p ON p.id = tm.user_id
  LEFT JOIN voice_coach_sessions vcs ON vcs.user_id = tm.user_id
    AND vcs.created_at >= p_start_date
    AND vcs.created_at <= p_end_date + INTERVAL '1 day'
    AND vcs.status = 'completed'
  WHERE tm.team_id = p_team_id
    AND tm.is_active = true
  GROUP BY tm.user_id, p.email
  ORDER BY session_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get session type distribution
CREATE OR REPLACE FUNCTION get_team_session_type_distribution(
  p_team_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  session_type TEXT,
  count BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  total_count BIGINT;
BEGIN
  -- Get total count first
  SELECT COUNT(*)::BIGINT INTO total_count
  FROM voice_coach_sessions vcs
  INNER JOIN team_members tm ON tm.user_id = vcs.user_id AND tm.team_id = p_team_id
  WHERE vcs.created_at >= p_start_date
    AND vcs.created_at <= p_end_date + INTERVAL '1 day'
    AND vcs.status = 'completed';

  RETURN QUERY
  SELECT
    COALESCE(vcs.session_type, 'unknown') AS session_type,
    COUNT(*)::BIGINT AS count,
    CASE WHEN total_count > 0
      THEN ROUND((COUNT(*)::NUMERIC / total_count) * 100, 1)
      ELSE 0
    END AS percentage
  FROM voice_coach_sessions vcs
  INNER JOIN team_members tm ON tm.user_id = vcs.user_id AND tm.team_id = p_team_id
  WHERE vcs.created_at >= p_start_date
    AND vcs.created_at <= p_end_date + INTERVAL '1 day'
    AND vcs.status = 'completed'
  GROUP BY vcs.session_type
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get daily session trend data
CREATE OR REPLACE FUNCTION get_team_voice_trend(
  p_team_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date DATE,
  sessions BIGINT,
  avg_sentiment NUMERIC,
  unique_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vcs.created_at::DATE AS date,
    COUNT(*)::BIGINT AS sessions,
    COALESCE(AVG(vcs.sentiment_score), 0.5)::NUMERIC AS avg_sentiment,
    COUNT(DISTINCT vcs.user_id)::BIGINT AS unique_users
  FROM voice_coach_sessions vcs
  INNER JOIN team_members tm ON tm.user_id = vcs.user_id AND tm.team_id = p_team_id
  WHERE vcs.created_at >= p_start_date
    AND vcs.created_at <= p_end_date + INTERVAL '1 day'
    AND vcs.status = 'completed'
  GROUP BY vcs.created_at::DATE
  ORDER BY date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. ALERT GENERATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION generate_engagement_alerts()
RETURNS TABLE (
  alerts_created INT,
  alert_types TEXT[]
) AS $$
DECLARE
  inactive_count INT := 0;
  low_sentiment_count INT := 0;
  broken_streak_count INT := 0;
BEGIN
  -- 1. Inactive members (no activity in 7+ days)
  INSERT INTO engagement_alerts (team_id, user_id, alert_type, severity, title, description, metadata)
  SELECT
    tm.team_id,
    tm.user_id,
    'inactive',
    CASE
      WHEN tm.last_active_at < NOW() - INTERVAL '14 days' THEN 'high'
      ELSE 'medium'
    END,
    'Member inactive for ' || EXTRACT(DAY FROM (NOW() - tm.last_active_at))::INT || ' days',
    'This team member hasn''t logged in or completed any activities recently.',
    jsonb_build_object(
      'last_active', tm.last_active_at,
      'days_inactive', EXTRACT(DAY FROM (NOW() - tm.last_active_at))::INT
    )
  FROM team_members tm
  WHERE tm.is_active = true
    AND tm.last_active_at < NOW() - INTERVAL '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM engagement_alerts ea
      WHERE ea.user_id = tm.user_id
        AND ea.alert_type = 'inactive'
        AND ea.status = 'active'
    );
  GET DIAGNOSTICS inactive_count = ROW_COUNT;

  -- 2. Low sentiment sessions (within last 24 hours)
  INSERT INTO engagement_alerts (team_id, user_id, alert_type, severity, title, description, metadata)
  SELECT DISTINCT ON (vcs.user_id)
    tm.team_id,
    vcs.user_id,
    'low_sentiment',
    'high',
    'Recent session showed low sentiment',
    'This team member''s recent coaching session indicated they may be struggling.',
    jsonb_build_object(
      'sentiment_score', vcs.sentiment_score,
      'session_type', vcs.session_type,
      'session_date', vcs.created_at
    )
  FROM voice_coach_sessions vcs
  INNER JOIN team_members tm ON tm.user_id = vcs.user_id
  WHERE vcs.sentiment_score < 0.3
    AND vcs.created_at > NOW() - INTERVAL '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM engagement_alerts ea
      WHERE ea.user_id = vcs.user_id
        AND ea.alert_type = 'low_sentiment'
        AND ea.status = 'active'
        AND ea.created_at > NOW() - INTERVAL '7 days'
    )
  ORDER BY vcs.user_id, vcs.created_at DESC;
  GET DIAGNOSTICS low_sentiment_count = ROW_COUNT;

  -- 3. Broken streaks (streak went from 7+ to 0 in last 48 hours)
  -- Note: This requires habit_logs or similar tracking - simplified version
  INSERT INTO engagement_alerts (team_id, user_id, alert_type, severity, title, description, metadata)
  SELECT
    tm.team_id,
    tm.user_id,
    'broken_streak',
    'medium',
    'Streak broken after ' || 7 || '+ days',
    'This team member''s habit streak has been broken. They may need encouragement.',
    jsonb_build_object(
      'previous_streak', tm.current_streak,
      'current_streak', 0
    )
  FROM team_members tm
  WHERE tm.is_active = true
    AND tm.current_streak = 0
    AND tm.last_active_at > NOW() - INTERVAL '48 hours'
    AND NOT EXISTS (
      SELECT 1 FROM engagement_alerts ea
      WHERE ea.user_id = tm.user_id
        AND ea.alert_type = 'broken_streak'
        AND ea.status = 'active'
        AND ea.created_at > NOW() - INTERVAL '7 days'
    );
  GET DIAGNOSTICS broken_streak_count = ROW_COUNT;

  RETURN QUERY SELECT
    (inactive_count + low_sentiment_count + broken_streak_count)::INT AS alerts_created,
    ARRAY['inactive', 'low_sentiment', 'broken_streak']::TEXT[] AS alert_types;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================

-- Voice coach session indexes for analytics
CREATE INDEX IF NOT EXISTS idx_voice_sessions_team_analytics
ON voice_coach_sessions(user_id, created_at, status)
WHERE status = 'completed';

-- Template usage tracking index
CREATE INDEX IF NOT EXISTS idx_templates_team_category
ON communication_templates(team_id, category, is_active)
WHERE is_active = true;

-- ============================================
-- 7. TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_team_ai_settings_updated_at ON team_ai_settings;
CREATE TRIGGER update_team_ai_settings_updated_at
  BEFORE UPDATE ON team_ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_communication_templates_updated_at ON communication_templates;
CREATE TRIGGER update_communication_templates_updated_at
  BEFORE UPDATE ON communication_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION get_team_voice_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_member_voice_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_session_type_distribution TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_voice_trend TO authenticated;
-- generate_engagement_alerts is for service role only (called by cron)

COMMENT ON FUNCTION get_team_voice_stats IS 'Get aggregate voice coach statistics for a team';
COMMENT ON FUNCTION get_team_member_voice_stats IS 'Get per-member voice coach statistics';
COMMENT ON FUNCTION get_team_session_type_distribution IS 'Get distribution of session types for a team';
COMMENT ON FUNCTION get_team_voice_trend IS 'Get daily session trend data for charting';
COMMENT ON FUNCTION generate_engagement_alerts IS 'Generate alerts for inactive/at-risk members (called by cron)';
