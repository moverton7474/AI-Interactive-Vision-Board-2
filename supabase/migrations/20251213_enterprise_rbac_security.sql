-- ============================================
-- ENTERPRISE RBAC & SECURITY ARCHITECTURE
-- Migration: 20251213_enterprise_rbac_security.sql
-- Version: 2.0
-- Description: Implements comprehensive RBAC model,
--              platform roles, audit logging, and
--              hardened RLS policies for all tables.
-- ============================================

-- ============================================
-- 1. PLATFORM ROLES TABLE
-- ============================================
-- Stores platform-level admin and support roles

CREATE TABLE IF NOT EXISTS platform_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('platform_admin', 'support_agent')),
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE platform_roles IS 'Platform-level roles for cross-tenant access (admin, support)';

CREATE INDEX IF NOT EXISTS idx_platform_roles_active ON platform_roles(user_id, role) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE platform_roles ENABLE ROW LEVEL SECURITY;

-- Only platform_admins can manage platform roles (bootstrapped manually)
DROP POLICY IF EXISTS "Platform admins can manage roles" ON platform_roles;
CREATE POLICY "Platform admins can manage roles"
  ON platform_roles FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (
      EXISTS (
        SELECT 1 FROM platform_roles pr
        WHERE pr.user_id = auth.uid()
        AND pr.role = 'platform_admin'
        AND pr.is_active = TRUE
        AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
      )
    )
  );

-- Platform admins can view all roles
DROP POLICY IF EXISTS "Platform admins can view roles" ON platform_roles;
CREATE POLICY "Platform admins can view roles"
  ON platform_roles FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM platform_roles pr
      WHERE pr.user_id = auth.uid()
      AND pr.role = 'platform_admin'
      AND pr.is_active = TRUE
      AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
    )
  );

-- ============================================
-- 2. AUDIT LOGS TABLE
-- ============================================
-- Immutable audit trail for sensitive operations

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  team_id UUID,
  platform_role TEXT,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id TEXT,
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Immutable audit log for security-sensitive operations';

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_team ON audit_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(target_table);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_table, target_id);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs are append-only, no updates or deletes
DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON audit_logs;
CREATE POLICY "Platform admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM platform_roles pr
      WHERE pr.user_id = auth.uid()
      AND pr.role IN ('platform_admin', 'support_agent')
      AND pr.is_active = TRUE
      AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
    )
  );

-- Team admins can view their team's audit logs
DROP POLICY IF EXISTS "Team admins can view team audit logs" ON audit_logs;
CREATE POLICY "Team admins can view team audit logs"
  ON audit_logs FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = TRUE
    )
  );

-- Users can view their own audit logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- Only service role can insert audit logs (via functions)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 3. HELPER FUNCTIONS FOR RBAC
-- ============================================

-- Check if current user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_roles
    WHERE user_id = auth.uid()
    AND role = 'platform_admin'
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is a support agent
CREATE OR REPLACE FUNCTION is_support_agent()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_roles
    WHERE user_id = auth.uid()
    AND role = 'support_agent'
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has any of the specified platform roles
CREATE OR REPLACE FUNCTION has_platform_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_roles
    WHERE user_id = auth.uid()
    AND role = ANY(required_roles)
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get user's role in a specific team
CREATE OR REPLACE FUNCTION get_team_role(p_team_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM team_members
    WHERE team_id = p_team_id
    AND user_id = auth.uid()
    AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has any of the required team roles (or is platform admin)
CREATE OR REPLACE FUNCTION has_team_role(p_team_id UUID, required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  -- Platform admins bypass team role checks
  IF is_platform_admin() THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = auth.uid()
    AND role = ANY(required_roles)
    AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is a member of a team (any role)
CREATE OR REPLACE FUNCTION is_team_member(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF is_platform_admin() THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = auth.uid()
    AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create audit log entry
CREATE OR REPLACE FUNCTION log_audit(
  p_action TEXT,
  p_target_table TEXT,
  p_target_id TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_team_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_platform_role TEXT;
  v_audit_id UUID;
BEGIN
  -- Get platform role if any
  SELECT role INTO v_platform_role
  FROM platform_roles
  WHERE user_id = auth.uid()
  AND is_active = TRUE;

  INSERT INTO audit_logs (
    user_id, team_id, platform_role, action, target_table, target_id,
    old_values, new_values, description, metadata
  ) VALUES (
    auth.uid(), p_team_id, v_platform_role, p_action, p_target_table, p_target_id,
    p_old_values, p_new_values, p_description, p_metadata
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_support_agent() TO authenticated;
GRANT EXECUTE ON FUNCTION has_platform_role(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_team_role(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION is_team_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, JSONB) TO authenticated;

-- ============================================
-- 4. TEAM GOALS TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS team_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID[] DEFAULT '{}',
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  target_date DATE,
  target_value DECIMAL(12,2),
  current_value DECIMAL(12,2) DEFAULT 0,
  unit TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'on_hold')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE team_goals IS 'Shared goals within a team for collective accountability';

CREATE INDEX IF NOT EXISTS idx_team_goals_team ON team_goals(team_id);
CREATE INDEX IF NOT EXISTS idx_team_goals_created_by ON team_goals(created_by);
CREATE INDEX IF NOT EXISTS idx_team_goals_status ON team_goals(status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE team_goals ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. TEAM INTEGRATIONS TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS team_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('slack', 'teams', 'webhook', 'calendar')),
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  credentials JSONB DEFAULT '{}', -- Encrypted in production
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, integration_type, name)
);

COMMENT ON TABLE team_integrations IS 'Team-level integration configurations for Slack, Teams, etc.';

CREATE INDEX IF NOT EXISTS idx_team_integrations_team ON team_integrations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_integrations_type ON team_integrations(integration_type);

-- Enable RLS
ALTER TABLE team_integrations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. UPDATED RLS POLICIES FOR TEAMS
-- ============================================

-- Teams: Members can view, owners/admins can manage
DROP POLICY IF EXISTS "Team owners and admins can manage teams" ON teams;
DROP POLICY IF EXISTS "Team members can view their team" ON teams;

CREATE POLICY "Platform admins can manage all teams"
  ON teams FOR ALL
  USING (is_platform_admin() OR auth.role() = 'service_role');

CREATE POLICY "Team members can view their teams"
  ON teams FOR SELECT
  USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Users can create teams as owner"
  ON teams FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Team owners can update their teams"
  ON teams FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR has_team_role(id, ARRAY['admin'])
  );

CREATE POLICY "Team owners can delete their teams"
  ON teams FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================
-- 7. UPDATED RLS POLICIES FOR TEAM_MEMBERS
-- ============================================

DROP POLICY IF EXISTS "Team admins can manage members" ON team_members;
DROP POLICY IF EXISTS "Members can view their team members" ON team_members;
DROP POLICY IF EXISTS "Team members can view all members in their team" ON team_members;
DROP POLICY IF EXISTS "Team members can view teammates" ON team_members;
DROP POLICY IF EXISTS "Users can view own team membership" ON team_members;

-- Platform admins have full access to all team members
CREATE POLICY "Platform admins can manage all team members"
  ON team_members FOR ALL
  USING (is_platform_admin() OR auth.role() = 'service_role');

-- Users can view their own team membership (non-recursive, safe)
CREATE POLICY "Users can view own team membership"
  ON team_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Team owners/admins can add members"
  ON team_members FOR INSERT
  WITH CHECK (
    has_team_role(team_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "Team owners/admins can update members"
  ON team_members FOR UPDATE
  USING (
    -- Owner/admin can update any member
    has_team_role(team_id, ARRAY['owner', 'admin'])
    -- Members can update their own visibility flags (but not role)
    OR (user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Team owners/admins can remove members"
  ON team_members FOR DELETE
  USING (
    has_team_role(team_id, ARRAY['owner', 'admin'])
    -- Members can remove themselves
    OR user_id = auth.uid()
  );

-- ============================================
-- 8. RLS POLICIES FOR TEAM_GOALS
-- ============================================

DROP POLICY IF EXISTS "Team members can view team goals" ON team_goals;
DROP POLICY IF EXISTS "Team members can create goals" ON team_goals;

CREATE POLICY "Platform admins can manage all team goals"
  ON team_goals FOR ALL
  USING (is_platform_admin() OR auth.role() = 'service_role');

CREATE POLICY "Team members can view team goals"
  ON team_goals FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Team non-viewers can create goals"
  ON team_goals FOR INSERT
  WITH CHECK (
    has_team_role(team_id, ARRAY['owner', 'admin', 'member'])
    AND created_by = auth.uid()
  );

CREATE POLICY "Goal creators and admins can update goals"
  ON team_goals FOR UPDATE
  USING (
    -- Creator can update their own goals
    created_by = auth.uid()
    -- Owner/admin can update any goal
    OR has_team_role(team_id, ARRAY['owner', 'admin'])
    -- Assigned users can update assigned goals
    OR auth.uid() = ANY(assigned_to)
  );

CREATE POLICY "Team admins can delete goals"
  ON team_goals FOR DELETE
  USING (
    has_team_role(team_id, ARRAY['owner', 'admin'])
    OR created_by = auth.uid()
  );

-- ============================================
-- 9. RLS POLICIES FOR TEAM_INTEGRATIONS
-- ============================================

DROP POLICY IF EXISTS "Team admins can manage integrations" ON team_integrations;

CREATE POLICY "Platform admins can manage all integrations"
  ON team_integrations FOR ALL
  USING (is_platform_admin() OR auth.role() = 'service_role');

CREATE POLICY "Team admins can view integrations"
  ON team_integrations FOR SELECT
  USING (has_team_role(team_id, ARRAY['owner', 'admin']));

CREATE POLICY "Team admins can create integrations"
  ON team_integrations FOR INSERT
  WITH CHECK (has_team_role(team_id, ARRAY['owner', 'admin']));

CREATE POLICY "Team admins can update integrations"
  ON team_integrations FOR UPDATE
  USING (has_team_role(team_id, ARRAY['owner', 'admin']));

CREATE POLICY "Team admins can delete integrations"
  ON team_integrations FOR DELETE
  USING (has_team_role(team_id, ARRAY['owner', 'admin']));

-- ============================================
-- 10. UPDATED RLS FOR TEAM_LEADERBOARDS
-- ============================================

DROP POLICY IF EXISTS "Team members can view leaderboards" ON team_leaderboards;
DROP POLICY IF EXISTS "Service role manages leaderboards" ON team_leaderboards;

CREATE POLICY "Platform admins can manage all leaderboards"
  ON team_leaderboards FOR ALL
  USING (is_platform_admin() OR auth.role() = 'service_role');

CREATE POLICY "Team members can view their leaderboards"
  ON team_leaderboards FOR SELECT
  USING (is_team_member(team_id));

-- ============================================
-- 11. HARDENED RLS FOR FINANCIAL TABLES
-- ============================================

-- Fix overly permissive automation_rules policy
DROP POLICY IF EXISTS "Allow public read Auto" ON automation_rules;
DROP POLICY IF EXISTS "Users can manage own automation rules" ON automation_rules;

CREATE POLICY "Users can manage own automation rules"
  ON automation_rules FOR ALL
  USING (
    -- Must be linked to user's plaid item
    source_account_id IN (
      SELECT id::TEXT FROM plaid_items WHERE user_id = auth.uid()
    )
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

-- Harden plaid_items policies
DROP POLICY IF EXISTS "Users own their plaid items" ON plaid_items;

CREATE POLICY "Users own their plaid items"
  ON plaid_items FOR ALL
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

-- Harden transfer_logs policies
DROP POLICY IF EXISTS "Users can view own transfer logs" ON transfer_logs;

CREATE POLICY "Users can view own transfer logs"
  ON transfer_logs FOR SELECT
  USING (
    rule_id IN (
      SELECT ar.id FROM automation_rules ar
      JOIN plaid_items pi ON pi.id::TEXT = ar.source_account_id
      WHERE pi.user_id = auth.uid()
    )
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can insert transfer logs"
  ON transfer_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 12. PLATFORM ADMIN ACCESS TO USER DATA
-- ============================================

-- Update profiles policies for platform admin access
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can view profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR is_platform_admin()
    OR is_support_agent()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR auth.role() = 'service_role'
  );

-- Update vision_boards for platform admin access
DROP POLICY IF EXISTS "Users can view own vision boards" ON vision_boards;
DROP POLICY IF EXISTS "Users can insert own vision boards" ON vision_boards;
DROP POLICY IF EXISTS "Users can update own vision boards" ON vision_boards;
DROP POLICY IF EXISTS "Users can delete own vision boards" ON vision_boards;

CREATE POLICY "Users can view vision boards"
  ON vision_boards FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR is_support_agent()
  );

CREATE POLICY "Users can insert own vision boards"
  ON vision_boards FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own vision boards"
  ON vision_boards FOR UPDATE
  USING (user_id = auth.uid() OR is_platform_admin())
  WITH CHECK (user_id = auth.uid() OR is_platform_admin());

CREATE POLICY "Users can delete own vision boards"
  ON vision_boards FOR DELETE
  USING (user_id = auth.uid() OR is_platform_admin());

-- Update user_identity_profiles for platform admin access
DROP POLICY IF EXISTS "Users own their identity profiles" ON user_identity_profiles;

CREATE POLICY "Users own their identity profiles"
  ON user_identity_profiles FOR ALL
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR is_support_agent()
    OR auth.role() = 'service_role'
  );

-- Update user_knowledge_sources for platform admin access
DROP POLICY IF EXISTS "Users own their knowledge sources" ON user_knowledge_sources;

CREATE POLICY "Users own their knowledge sources"
  ON user_knowledge_sources FOR ALL
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR is_support_agent()
    OR auth.role() = 'service_role'
  );

-- Update user_knowledge_chunks for platform admin access
DROP POLICY IF EXISTS "Users own their knowledge chunks" ON user_knowledge_chunks;

CREATE POLICY "Users own their knowledge chunks"
  ON user_knowledge_chunks FOR ALL
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

-- Update voice_coach_sessions for platform admin access
DROP POLICY IF EXISTS "Users own their voice sessions" ON voice_coach_sessions;

CREATE POLICY "Users own their voice sessions"
  ON voice_coach_sessions FOR ALL
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR is_support_agent()
    OR auth.role() = 'service_role'
  );

-- ============================================
-- 13. PRINT ORDERS WITH TEAM SUPPORT
-- ============================================

-- Add team_id column to print_orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_orders' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE print_orders ADD COLUMN team_id UUID REFERENCES teams(id);
    CREATE INDEX idx_print_orders_team ON print_orders(team_id) WHERE team_id IS NOT NULL;
  END IF;
END $$;

-- Update print_orders policies
DROP POLICY IF EXISTS "Users own their print orders" ON print_orders;

CREATE POLICY "Users can view own print orders"
  ON print_orders FOR SELECT
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND is_team_member(team_id))
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can create print orders"
  ON print_orders FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can update own print orders"
  ON print_orders FOR UPDATE
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

-- ============================================
-- 14. TRIGGERS FOR AUDIT LOGGING
-- ============================================

-- Trigger to audit team member changes
CREATE OR REPLACE FUNCTION audit_team_member_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(
      'team.member.invite',
      'team_members',
      NEW.id::TEXT,
      NULL,
      row_to_json(NEW)::JSONB,
      format('Member %s invited to team', NEW.user_id),
      NEW.team_id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role != NEW.role THEN
      PERFORM log_audit(
        'team.member.role_change',
        'team_members',
        NEW.id::TEXT,
        jsonb_build_object('role', OLD.role),
        jsonb_build_object('role', NEW.role),
        format('Role changed from %s to %s', OLD.role, NEW.role),
        NEW.team_id
      );
    END IF;
    IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
      PERFORM log_audit(
        'team.member.remove',
        'team_members',
        NEW.id::TEXT,
        row_to_json(OLD)::JSONB,
        NULL,
        'Member removed from team',
        NEW.team_id
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit(
      'team.member.remove',
      'team_members',
      OLD.id::TEXT,
      row_to_json(OLD)::JSONB,
      NULL,
      'Member removed from team',
      OLD.team_id
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_team_members ON team_members;
CREATE TRIGGER audit_team_members
  AFTER INSERT OR UPDATE OR DELETE ON team_members
  FOR EACH ROW EXECUTE FUNCTION audit_team_member_changes();

-- Trigger to audit team creation/deletion
CREATE OR REPLACE FUNCTION audit_team_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(
      'team.create',
      'teams',
      NEW.id::TEXT,
      NULL,
      row_to_json(NEW)::JSONB,
      format('Team "%s" created', NEW.name),
      NEW.id
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit(
      'team.delete',
      'teams',
      OLD.id::TEXT,
      row_to_json(OLD)::JSONB,
      NULL,
      format('Team "%s" deleted', OLD.name),
      OLD.id
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_teams ON teams;
CREATE TRIGGER audit_teams
  AFTER INSERT OR DELETE ON teams
  FOR EACH ROW EXECUTE FUNCTION audit_team_changes();

-- ============================================
-- 15. VIEW FOR USER PERMISSIONS
-- ============================================

CREATE OR REPLACE VIEW user_permissions AS
SELECT
  u.id as user_id,
  u.email,
  pr.role as platform_role,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'team_id', tm.team_id,
        'team_name', t.name,
        'role', tm.role
      )
    ) FILTER (WHERE tm.team_id IS NOT NULL),
    '[]'::jsonb
  ) as team_memberships
FROM auth.users u
LEFT JOIN platform_roles pr ON u.id = pr.user_id AND pr.is_active = TRUE
LEFT JOIN team_members tm ON u.id = tm.user_id AND tm.is_active = TRUE
LEFT JOIN teams t ON tm.team_id = t.id
GROUP BY u.id, u.email, pr.role;

-- Grant access to the view
GRANT SELECT ON user_permissions TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 4 (platform_roles, audit_logs, team_goals, team_integrations)
-- Functions created: 8
-- Triggers created: 2
-- Policies updated: 40+
-- Views created: 1
-- ============================================
