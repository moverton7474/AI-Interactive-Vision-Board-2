-- ============================================
-- VISIONARY AI - ADMIN IMPERSONATION & CONTROL CENTER
-- ============================================
-- Run AFTER 04_audit_triggers.sql
-- Version: 1.0
-- Date: 2025-12-13
-- ============================================

-- ============================================
-- PART 1: IMPERSONATION SESSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS admin_impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  reason TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  ended_reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE admin_impersonation_sessions IS 'Tracks admin impersonation sessions for audit and security';

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON admin_impersonation_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_target ON admin_impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_token ON admin_impersonation_sessions(session_token) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_impersonation_active ON admin_impersonation_sessions(admin_user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_impersonation_expires ON admin_impersonation_sessions(expires_at) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;


-- ============================================
-- PART 2: IMPERSONATION POLICIES
-- ============================================

DROP POLICY IF EXISTS "Platform admins can view all impersonation sessions" ON admin_impersonation_sessions;
CREATE POLICY "Platform admins can view all impersonation sessions"
  ON admin_impersonation_sessions FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Service role can manage impersonation sessions" ON admin_impersonation_sessions;
CREATE POLICY "Service role can manage impersonation sessions"
  ON admin_impersonation_sessions FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================
-- PART 3: IMPERSONATION HELPER FUNCTIONS
-- ============================================

-- Create a new impersonation session
CREATE OR REPLACE FUNCTION create_impersonation_session(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 60,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  v_session_id UUID;
  v_session_token TEXT;
  v_expires_at TIMESTAMPTZ;
  v_is_admin BOOLEAN;
BEGIN
  -- Verify admin is platform_admin
  SELECT EXISTS (
    SELECT 1 FROM platform_roles
    WHERE user_id = p_admin_user_id
    AND role = 'platform_admin'
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'User is not a platform admin';
  END IF;

  -- Prevent self-impersonation
  IF p_admin_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot impersonate yourself';
  END IF;

  -- End any existing active sessions for this admin
  UPDATE admin_impersonation_sessions
  SET is_active = FALSE,
      ended_at = NOW(),
      ended_reason = 'Superseded by new session'
  WHERE admin_user_id = p_admin_user_id
  AND is_active = TRUE;

  -- Generate secure session token
  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Create new session
  INSERT INTO admin_impersonation_sessions (
    admin_user_id,
    target_user_id,
    session_token,
    reason,
    expires_at,
    ip_address,
    user_agent
  ) VALUES (
    p_admin_user_id,
    p_target_user_id,
    v_session_token,
    p_reason,
    v_expires_at,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_session_id;

  -- Log the impersonation start
  PERFORM log_audit(
    'admin.impersonation.start',
    'admin_impersonation_sessions',
    v_session_id::TEXT,
    NULL,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'reason', p_reason,
      'duration_minutes', p_duration_minutes
    ),
    format('Admin started impersonation of user %s', p_target_user_id),
    NULL
  );

  RETURN QUERY SELECT v_session_id, v_session_token, v_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- End an impersonation session
CREATE OR REPLACE FUNCTION end_impersonation_session(
  p_session_token TEXT,
  p_reason TEXT DEFAULT 'Manual stop'
) RETURNS BOOLEAN AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Find and update the session
  UPDATE admin_impersonation_sessions
  SET is_active = FALSE,
      ended_at = NOW(),
      ended_reason = p_reason
  WHERE session_token = p_session_token
  AND is_active = TRUE
  RETURNING * INTO v_session;

  IF v_session IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Log the impersonation stop
  PERFORM log_audit(
    'admin.impersonation.stop',
    'admin_impersonation_sessions',
    v_session.id::TEXT,
    jsonb_build_object('was_active', TRUE),
    jsonb_build_object('ended_reason', p_reason),
    format('Admin ended impersonation of user %s', v_session.target_user_id),
    NULL
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Validate an impersonation session
CREATE OR REPLACE FUNCTION validate_impersonation_session(
  p_session_token TEXT
) RETURNS TABLE (
  admin_user_id UUID,
  target_user_id UUID,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.admin_user_id,
    s.target_user_id,
    s.expires_at
  FROM admin_impersonation_sessions s
  WHERE s.session_token = p_session_token
  AND s.is_active = TRUE
  AND s.expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- Clean up expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_impersonation_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE admin_impersonation_sessions
  SET is_active = FALSE,
      ended_at = NOW(),
      ended_reason = 'Expired'
  WHERE is_active = TRUE
  AND expires_at <= NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- PART 4: ADMIN USER FLAGS TABLE EXTENSION
-- ============================================

-- Add admin flags to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_beta_user'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_beta_user BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_early_access'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_early_access BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_locked'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'locked_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN locked_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'locked_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN locked_reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE profiles ADD COLUMN admin_notes TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'credits'
  ) THEN
    ALTER TABLE profiles ADD COLUMN credits INTEGER DEFAULT 0;
  END IF;
END $$;


-- ============================================
-- PART 5: ADMIN AUDIT VIEW
-- ============================================

DROP VIEW IF EXISTS admin_audit_view;

CREATE VIEW admin_audit_view AS
SELECT
  al.id,
  al.user_id as actor_id,
  actor_profile.names as actor_name,
  actor_profile.email as actor_email,
  al.platform_role,
  al.action,
  al.target_table,
  al.target_id,
  al.team_id,
  t.name as team_name,
  al.old_values,
  al.new_values,
  al.description,
  al.ip_address,
  al.user_agent,
  al.session_id,
  al.created_at
FROM audit_logs al
LEFT JOIN profiles actor_profile ON al.user_id = actor_profile.id
LEFT JOIN teams t ON al.team_id = t.id
ORDER BY al.created_at DESC;

-- Grant access to the view for platform admins
GRANT SELECT ON admin_audit_view TO authenticated;


-- ============================================
-- PART 6: GRANT FUNCTION PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION create_impersonation_session(UUID, UUID, TEXT, INTEGER, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION end_impersonation_session(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_impersonation_session(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_impersonation_sessions() TO authenticated;


-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check that new table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'admin_impersonation_sessions';

-- Check that new functions exist
SELECT proname as function_name
FROM pg_proc
WHERE proname IN (
  'create_impersonation_session',
  'end_impersonation_session',
  'validate_impersonation_session',
  'cleanup_expired_impersonation_sessions'
);
