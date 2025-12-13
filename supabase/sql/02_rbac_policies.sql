-- ============================================
-- VISIONARY AI - ENTERPRISE RBAC POLICIES
-- ============================================
-- Run AFTER 01_rbac_tables_and_functions.sql
-- ============================================

-- ============================================
-- PLATFORM_ROLES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Platform admins can manage roles" ON platform_roles;
CREATE POLICY "Platform admins can manage roles"
  ON platform_roles FOR ALL
  USING (
    auth.role() = 'service_role'
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Users can view own platform role" ON platform_roles;
CREATE POLICY "Users can view own platform role"
  ON platform_roles FOR SELECT
  USING (user_id = auth.uid());


-- ============================================
-- AUDIT_LOGS POLICIES (Append-Only)
-- ============================================

DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON audit_logs;
CREATE POLICY "Platform admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR is_platform_admin()
    OR is_support_agent()
  );

DROP POLICY IF EXISTS "Team admins can view team audit logs" ON audit_logs;
CREATE POLICY "Team admins can view team audit logs"
  ON audit_logs FOR SELECT
  USING (
    team_id IS NOT NULL AND
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (TRUE); -- log_audit function is SECURITY DEFINER


-- ============================================
-- TEAMS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Team owners and admins can manage teams" ON teams;
DROP POLICY IF EXISTS "Team members can view their team" ON teams;
DROP POLICY IF EXISTS "Platform admins can manage all teams" ON teams;
DROP POLICY IF EXISTS "Team members can view their teams" ON teams;
DROP POLICY IF EXISTS "Users can create teams as owner" ON teams;
DROP POLICY IF EXISTS "Team owners can update their teams" ON teams;
DROP POLICY IF EXISTS "Team owners can delete their teams" ON teams;

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
-- TEAM_MEMBERS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Team admins can manage members" ON team_members;
DROP POLICY IF EXISTS "Members can view their team members" ON team_members;
DROP POLICY IF EXISTS "Platform admins can manage all team members" ON team_members;
DROP POLICY IF EXISTS "Team members can view all members in their team" ON team_members;
DROP POLICY IF EXISTS "Team owners/admins can add members" ON team_members;
DROP POLICY IF EXISTS "Team owners/admins can update members" ON team_members;
DROP POLICY IF EXISTS "Team owners/admins can remove members" ON team_members;

CREATE POLICY "Platform admins can manage all team members"
  ON team_members FOR ALL
  USING (is_platform_admin() OR auth.role() = 'service_role');

CREATE POLICY "Team members can view all members in their team"
  ON team_members FOR SELECT
  USING (
    team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.is_active = TRUE)
  );

CREATE POLICY "Team owners/admins can add members"
  ON team_members FOR INSERT
  WITH CHECK (
    has_team_role(team_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "Team owners/admins can update members"
  ON team_members FOR UPDATE
  USING (
    has_team_role(team_id, ARRAY['owner', 'admin'])
    OR (user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Team owners/admins can remove members"
  ON team_members FOR DELETE
  USING (
    has_team_role(team_id, ARRAY['owner', 'admin'])
    OR user_id = auth.uid()
  );


-- ============================================
-- TEAM_GOALS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Team members can view team goals" ON team_goals;
DROP POLICY IF EXISTS "Team members can create goals" ON team_goals;
DROP POLICY IF EXISTS "Platform admins can manage all team goals" ON team_goals;
DROP POLICY IF EXISTS "Team non-viewers can create goals" ON team_goals;
DROP POLICY IF EXISTS "Goal creators and admins can update goals" ON team_goals;
DROP POLICY IF EXISTS "Team admins can delete goals" ON team_goals;

CREATE POLICY "Platform admins can manage all team goals"
  ON team_goals FOR ALL
  USING (is_platform_admin() OR auth.role() = 'service_role');

CREATE POLICY "Team members can view team goals"
  ON team_goals FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Team non-viewers can create goals"
  ON team_goals FOR INSERT
  WITH CHECK (
    has_team_role(team_id, ARRAY['owner', 'admin', 'manager', 'member'])
    AND created_by = auth.uid()
  );

CREATE POLICY "Goal creators and admins can update goals"
  ON team_goals FOR UPDATE
  USING (
    created_by = auth.uid()
    OR has_team_role(team_id, ARRAY['owner', 'admin'])
    OR auth.uid() = ANY(assigned_to)
  );

CREATE POLICY "Team admins can delete goals"
  ON team_goals FOR DELETE
  USING (
    has_team_role(team_id, ARRAY['owner', 'admin'])
    OR created_by = auth.uid()
  );


-- ============================================
-- TEAM_INTEGRATIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Team admins can manage integrations" ON team_integrations;
DROP POLICY IF EXISTS "Platform admins can manage all integrations" ON team_integrations;
DROP POLICY IF EXISTS "Team admins can view integrations" ON team_integrations;
DROP POLICY IF EXISTS "Team admins can create integrations" ON team_integrations;
DROP POLICY IF EXISTS "Team admins can update integrations" ON team_integrations;
DROP POLICY IF EXISTS "Team admins can delete integrations" ON team_integrations;

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
-- TEAM_LEADERBOARDS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Team members can view leaderboards" ON team_leaderboards;
DROP POLICY IF EXISTS "Service role manages leaderboards" ON team_leaderboards;
DROP POLICY IF EXISTS "Platform admins can manage all leaderboards" ON team_leaderboards;
DROP POLICY IF EXISTS "Team members can view their leaderboards" ON team_leaderboards;

CREATE POLICY "Platform admins can manage all leaderboards"
  ON team_leaderboards FOR ALL
  USING (is_platform_admin() OR auth.role() = 'service_role');

CREATE POLICY "Team members can view their leaderboards"
  ON team_leaderboards FOR SELECT
  USING (is_team_member(team_id));
