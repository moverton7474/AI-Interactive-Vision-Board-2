-- ============================================
-- VISIONARY AI - AUDIT TRIGGERS & VIEW
-- ============================================
-- Run AFTER 03_user_data_policies.sql
-- ============================================

-- ============================================
-- TRIGGER: AUDIT TEAM MEMBER CHANGES
-- ============================================

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
    IF OLD.role IS DISTINCT FROM NEW.role THEN
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


-- ============================================
-- TRIGGER: AUDIT TEAM CREATION/DELETION
-- ============================================

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
-- VIEW: USER_PERMISSIONS
-- ============================================

DROP VIEW IF EXISTS user_permissions;

CREATE VIEW user_permissions AS
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
-- BOOTSTRAP: ADD YOUR FIRST PLATFORM ADMIN
-- ============================================
-- Uncomment and run with your user ID after creating your account:

-- INSERT INTO platform_roles (user_id, role, notes)
-- VALUES (
--   'YOUR-USER-UUID-HERE',
--   'platform_admin',
--   'Initial platform administrator'
-- )
-- ON CONFLICT (user_id) DO UPDATE SET
--   role = 'platform_admin',
--   is_active = TRUE;


-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check that all functions exist:
SELECT
  proname as function_name,
  CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security
FROM pg_proc
WHERE proname IN (
  'is_platform_admin',
  'is_support_agent',
  'has_platform_role',
  'get_team_role',
  'has_team_role',
  'is_team_member',
  'log_audit'
);

-- Check that new tables exist:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('platform_roles', 'audit_logs', 'team_goals', 'team_integrations');

-- Check RLS is enabled on key tables:
SELECT
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class
WHERE relname IN (
  'platform_roles',
  'audit_logs',
  'teams',
  'team_members',
  'team_goals',
  'team_integrations',
  'profiles',
  'vision_boards'
);
