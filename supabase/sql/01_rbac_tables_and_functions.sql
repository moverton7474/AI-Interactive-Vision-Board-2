-- ============================================
-- VISIONARY AI - ENTERPRISE RBAC MIGRATION
-- ============================================
-- Run these SQL blocks IN ORDER in the Supabase SQL Editor
-- Version: 2.0.1
-- Date: 2025-12-13
-- ============================================

-- ============================================
-- PART 1: ALTER TEAM_MEMBERS TO ADD VIEWER ROLE
-- Run this first to update the constraint
-- ============================================

-- First drop the old constraint and add the new one with 'viewer'
DO $$
BEGIN
  -- Check if team_members table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
    -- Try to drop the old constraint
    BEGIN
      ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignore if constraint doesn't exist
    END;

    -- Add new constraint with viewer role
    ALTER TABLE team_members
      ADD CONSTRAINT team_members_role_check
      CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer'));

    RAISE NOTICE 'team_members role constraint updated to include viewer';
  ELSE
    RAISE NOTICE 'team_members table does not exist yet';
  END IF;
END $$;


-- ============================================
-- PART 2: CREATE PLATFORM_ROLES TABLE
-- ============================================

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


-- ============================================
-- PART 3: CREATE AUDIT_LOGS TABLE
-- ============================================

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


-- ============================================
-- PART 4: CREATE HELPER FUNCTIONS
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

-- Create audit log entry (called by triggers and Edge Functions)
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
-- PART 5: CREATE TEAM_GOALS TABLE
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

ALTER TABLE team_goals ENABLE ROW LEVEL SECURITY;


-- ============================================
-- PART 6: CREATE TEAM_INTEGRATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS team_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('slack', 'teams', 'webhook', 'calendar')),
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  credentials JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, integration_type, name)
);

COMMENT ON TABLE team_integrations IS 'Team-level integration configurations';

CREATE INDEX IF NOT EXISTS idx_team_integrations_team ON team_integrations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_integrations_type ON team_integrations(integration_type);

ALTER TABLE team_integrations ENABLE ROW LEVEL SECURITY;


-- ============================================
-- PART 7: ADD TEAM_ID TO PRINT_ORDERS (if missing)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_orders' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE print_orders ADD COLUMN team_id UUID REFERENCES teams(id);
    CREATE INDEX idx_print_orders_team ON print_orders(team_id) WHERE team_id IS NOT NULL;
    RAISE NOTICE 'Added team_id column to print_orders';
  ELSE
    RAISE NOTICE 'print_orders already has team_id column';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'print_orders table may not exist yet';
END $$;
