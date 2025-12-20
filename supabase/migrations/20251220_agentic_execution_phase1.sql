-- =====================================================
-- AGENTIC EXECUTION PHASE 1 MIGRATION
-- Sprint 1: Core Infrastructure
-- =====================================================

-- =====================================================
-- 1. FEATURE FLAGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled_globally BOOLEAN DEFAULT false,
  enabled_for_teams UUID[] DEFAULT '{}',
  enabled_for_users UUID[] DEFAULT '{}',
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for flag lookup
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);

-- Insert default feature flags for agentic execution
INSERT INTO feature_flags (flag_name, description, enabled_globally, rollout_percentage) VALUES
  ('agent_confidence_routing', 'Enable confidence-based action routing', false, 0),
  ('agent_risk_categorization', 'Enable risk-based action categorization', false, 0),
  ('agent_text_chat_tools', 'Enable function calling in text chat', false, 0),
  ('agent_voice_call_tool', 'Enable voice call tool in conversations', false, 0),
  ('agent_confirmation_flow', 'Enable HITL confirmation flow', false, 0),
  ('agent_execution_tracing', 'Enable execution observability', false, 0),
  ('agent_feedback_collection', 'Enable feedback collection', false, 0),
  ('agent_calendar_integration', 'Enable Google Calendar integration', false, 0)
ON CONFLICT (flag_name) DO NOTHING;

-- =====================================================
-- 2. EXTEND USER_AGENT_SETTINGS TABLE
-- =====================================================

-- Add confidence and risk settings columns
ALTER TABLE user_agent_settings
  ADD COLUMN IF NOT EXISTS require_high_confidence BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_threshold DECIMAL(3,2) DEFAULT 0.70
    CHECK (confidence_threshold >= 0.50 AND confidence_threshold <= 0.95),
  ADD COLUMN IF NOT EXISTS auto_approve_low_risk BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_approve_medium_risk BOOLEAN DEFAULT false;

-- Add confidence score to action history
ALTER TABLE agent_action_history
  ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical'));

-- =====================================================
-- 3. EXTEND TEAM_AI_SETTINGS TABLE
-- =====================================================

-- Add team-wide confidence and risk policy columns
ALTER TABLE team_ai_settings
  ADD COLUMN IF NOT EXISTS min_confidence_threshold DECIMAL(3,2) DEFAULT 0.50
    CHECK (min_confidence_threshold >= 0.30 AND min_confidence_threshold <= 0.95),
  ADD COLUMN IF NOT EXISTS allow_user_auto_approve_low BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_user_auto_approve_medium BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_user_auto_approve_high BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_admin_approval_critical BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_send_sms BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_voice_calls BOOLEAN DEFAULT false;

-- =====================================================
-- 4. PENDING AGENT ACTIONS TABLE (Confirmation Flow)
-- =====================================================

CREATE TABLE IF NOT EXISTS pending_agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,

  -- Action details
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN ('pending_confirmation', 'confirmed', 'cancelled', 'expired', 'executed')),

  -- Confidence and risk
  confidence_score DECIMAL(3,2),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),

  -- Resolution timestamps
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,

  -- Results
  result_payload JSONB,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for pending actions
CREATE INDEX IF NOT EXISTS idx_pending_actions_user_id ON pending_agent_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_agent_actions(status);
CREATE INDEX IF NOT EXISTS idx_pending_actions_expires ON pending_agent_actions(expires_at)
  WHERE status = 'pending_confirmation';
CREATE INDEX IF NOT EXISTS idx_pending_actions_session ON pending_agent_actions(session_id);

-- RLS for pending actions
ALTER TABLE pending_agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pending actions" ON pending_agent_actions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own pending actions" ON pending_agent_actions
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can do anything (for edge functions)
CREATE POLICY "Service role full access to pending actions" ON pending_agent_actions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 5. AGENT EXECUTION TRACES TABLE (Observability)
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_execution_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID,

  -- Trace details
  trace_type TEXT NOT NULL
    CHECK (trace_type IN ('llm_call', 'tool_call', 'tool_result', 'decision_point', 'confirmation_request', 'user_response')),
  step_number INTEGER NOT NULL DEFAULT 1,

  -- Performance metrics
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,

  -- Model and tool info
  model_used TEXT,
  tool_name TEXT,

  -- Payloads
  input_payload JSONB,
  output_payload JSONB,

  -- Confidence
  confidence_score DECIMAL(3,2),

  -- Error tracking
  error TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for traces
CREATE INDEX IF NOT EXISTS idx_traces_user_id ON agent_execution_traces(user_id);
CREATE INDEX IF NOT EXISTS idx_traces_session_id ON agent_execution_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_traces_team_id ON agent_execution_traces(team_id);
CREATE INDEX IF NOT EXISTS idx_traces_created_at ON agent_execution_traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_type ON agent_execution_traces(trace_type);

-- RLS for traces
ALTER TABLE agent_execution_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own traces" ON agent_execution_traces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view team traces" ON agent_execution_traces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
      AND team_members.team_id = agent_execution_traces.team_id
      AND team_members.role IN ('admin', 'owner', 'manager')
    )
  );

CREATE POLICY "Service role full access to traces" ON agent_execution_traces
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 6. AGENT ACTION FEEDBACK TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_action_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_history_id UUID REFERENCES agent_action_history(id) ON DELETE CASCADE,
  pending_action_id UUID REFERENCES pending_agent_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID,

  -- Feedback details
  feedback_type TEXT NOT NULL
    CHECK (feedback_type IN ('approved', 'rejected', 'edited', 'reported', 'thumbs_up', 'thumbs_down')),

  -- Payloads for learning
  original_payload JSONB,
  edited_payload JSONB,

  -- Reason and text
  rejection_reason TEXT,
  feedback_text TEXT,

  -- Timing metrics
  time_to_decision_ms INTEGER,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for feedback
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON agent_action_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_team_id ON agent_action_feedback(team_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON agent_action_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON agent_action_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_action_id ON agent_action_feedback(action_history_id);

-- RLS for feedback
ALTER TABLE agent_action_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feedback" ON agent_action_feedback
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view team feedback" ON agent_action_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
      AND team_members.team_id = agent_action_feedback.team_id
      AND team_members.role IN ('admin', 'owner', 'manager')
    )
  );

CREATE POLICY "Service role full access to feedback" ON agent_action_feedback
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 7. USER CALENDAR CONNECTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS user_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Provider info
  provider TEXT NOT NULL DEFAULT 'google'
    CHECK (provider IN ('google', 'microsoft', 'apple')),

  -- OAuth tokens (encrypted)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Calendar info
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  calendar_name TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per user per provider
  UNIQUE(user_id, provider)
);

-- Indexes for calendar connections
CREATE INDEX IF NOT EXISTS idx_calendar_user_id ON user_calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_provider ON user_calendar_connections(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_active ON user_calendar_connections(is_active) WHERE is_active = true;

-- RLS for calendar connections
ALTER TABLE user_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own calendar connections" ON user_calendar_connections
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to calendar" ON user_calendar_connections
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 8. ENABLE REALTIME FOR NEW TABLES
-- =====================================================

-- Enable realtime for pending actions (users need live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE pending_agent_actions;

-- Enable realtime for action history (live action status updates)
DO $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'agent_action_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_action_history;
  END IF;
END $$;

-- =====================================================
-- 9. HELPER FUNCTIONS
-- =====================================================

-- Function to get effective agent settings (merging user + team)
CREATE OR REPLACE FUNCTION get_effective_agent_settings(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_settings RECORD;
  v_team_settings RECORD;
  v_team_id UUID;
  v_result JSONB;
BEGIN
  -- Get user settings
  SELECT * INTO v_user_settings
  FROM user_agent_settings
  WHERE user_id = p_user_id;

  -- Get user's team
  SELECT team_id INTO v_team_id
  FROM team_members
  WHERE user_id = p_user_id
  AND status = 'active'
  LIMIT 1;

  -- Get team settings if user has a team
  IF v_team_id IS NOT NULL THEN
    SELECT * INTO v_team_settings
    FROM team_ai_settings
    WHERE team_id = v_team_id;
  END IF;

  -- Build effective settings (team restrictions apply)
  v_result := jsonb_build_object(
    'agent_actions_enabled', COALESCE(v_user_settings.agent_actions_enabled, false),

    -- Actions: must be enabled at both user AND team level
    'allow_send_email', COALESCE(v_user_settings.allow_send_email, true) AND COALESCE(v_team_settings.allow_send_email, true),
    'allow_send_sms', COALESCE(v_user_settings.allow_send_sms, false) AND COALESCE(v_team_settings.allow_send_sms, false),
    'allow_voice_calls', COALESCE(v_user_settings.allow_voice_calls, false) AND COALESCE(v_team_settings.allow_voice_calls, false),
    'allow_create_tasks', COALESCE(v_user_settings.allow_create_tasks, true) AND COALESCE(v_team_settings.allow_create_tasks, true),
    'allow_schedule_reminders', COALESCE(v_user_settings.allow_schedule_reminders, true) AND COALESCE(v_team_settings.allow_schedule_reminders, true),

    -- Confidence: user threshold but not below team minimum
    'confidence_threshold', GREATEST(
      COALESCE(v_user_settings.confidence_threshold, 0.70),
      COALESCE(v_team_settings.min_confidence_threshold, 0.50)
    ),
    'require_high_confidence', COALESCE(v_user_settings.require_high_confidence, false),

    -- Auto-approve: only if BOTH team and user allow
    'auto_approve_low_risk',
      COALESCE(v_team_settings.allow_user_auto_approve_low, true) AND
      COALESCE(v_user_settings.auto_approve_low_risk, true),
    'auto_approve_medium_risk',
      COALESCE(v_team_settings.allow_user_auto_approve_medium, false) AND
      COALESCE(v_user_settings.auto_approve_medium_risk, false),

    -- Confirmation requirements (OR - either user or team can require)
    'require_confirmation_email',
      COALESCE(v_user_settings.require_confirmation_email, true) OR
      COALESCE(v_team_settings.require_confirmation, true),
    'require_confirmation_sms',
      COALESCE(v_user_settings.require_confirmation_sms, true) OR
      COALESCE(v_team_settings.require_confirmation, true),
    'require_confirmation_voice',
      COALESCE(v_user_settings.require_confirmation_voice, true) OR
      COALESCE(v_team_settings.require_confirmation, true),

    -- Team info
    'team_id', v_team_id,
    'has_team_settings', v_team_settings IS NOT NULL
  );

  RETURN v_result;
END;
$$;

-- Function to expire pending actions
CREATE OR REPLACE FUNCTION expire_pending_actions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE pending_agent_actions
  SET
    status = 'expired',
    updated_at = NOW()
  WHERE status = 'pending_confirmation'
  AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to check if feature flag is enabled for user
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_flag_name TEXT,
  p_user_id UUID DEFAULT NULL,
  p_team_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_flag RECORD;
  v_hash INTEGER;
BEGIN
  SELECT * INTO v_flag
  FROM feature_flags
  WHERE flag_name = p_flag_name;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check hierarchy: global → team → user → percentage
  IF v_flag.enabled_globally THEN
    RETURN true;
  END IF;

  IF p_team_id IS NOT NULL AND v_flag.enabled_for_teams @> ARRAY[p_team_id] THEN
    RETURN true;
  END IF;

  IF p_user_id IS NOT NULL AND v_flag.enabled_for_users @> ARRAY[p_user_id] THEN
    RETURN true;
  END IF;

  -- Rollout percentage (deterministic based on user ID)
  IF v_flag.rollout_percentage > 0 AND p_user_id IS NOT NULL THEN
    -- Simple hash of user ID for deterministic percentage
    v_hash := abs(hashtext(p_user_id::TEXT)) % 100;
    RETURN v_hash < v_flag.rollout_percentage;
  END IF;

  RETURN false;
END;
$$;

-- =====================================================
-- 10. UPDATED_AT TRIGGERS
-- =====================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to new tables
DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pending_actions_updated_at ON pending_agent_actions;
CREATE TRIGGER update_pending_actions_updated_at
  BEFORE UPDATE ON pending_agent_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_connections_updated_at ON user_calendar_connections;
CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON user_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 11. GRANT PERMISSIONS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON feature_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pending_agent_actions TO authenticated;
GRANT SELECT, INSERT ON agent_execution_traces TO authenticated;
GRANT SELECT, INSERT, UPDATE ON agent_action_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_calendar_connections TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_effective_agent_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_feature_enabled(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION expire_pending_actions() TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
