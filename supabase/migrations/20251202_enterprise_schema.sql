-- ============================================
-- ENTERPRISE & INTEGRATION SCHEMA
-- Migration: 20251202_enterprise_schema.sql
-- Version: 2.0
-- Description: Creates tables for Partner Collaboration,
--              Slack/Teams integrations, and Print Orders.
--              Also adds missing RLS policies for AMIE tables.
-- ============================================

-- ============================================
-- 1. PARTNER COLLABORATION TABLES
-- ============================================

-- Partner Invitations
CREATE TABLE IF NOT EXISTS partner_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  declined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE partner_invitations IS 'Partner/couple invitation requests for shared accountability';

-- Partner Connections (Active Partnerships)
CREATE TABLE IF NOT EXISTS partner_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  connected_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  ended_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, partner_id)
);

COMMENT ON TABLE partner_connections IS 'Active partner/couple connections for shared goals';

-- Shared Goals between Partners
CREATE TABLE IF NOT EXISTS shared_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES partner_connections(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  category TEXT DEFAULT 'general' CHECK (category IN (
    'general', 'health', 'financial', 'relationship', 'career', 'spiritual', 'family', 'travel'
  )),
  target_value DECIMAL(12,2),
  current_value DECIMAL(12,2) DEFAULT 0,
  unit TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE shared_goals IS 'Goals shared between partners for mutual accountability';

-- ============================================
-- 2. SLACK INTEGRATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS slack_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  bot_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL, -- TODO: Encrypt in production using Vault
  scope TEXT,
  authed_user_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{
    "morning_reminder": true,
    "evening_summary": true,
    "goal_reminders": false,
    "reminder_time": "08:00"
  }'::jsonb,
  installed_at TIMESTAMPTZ NOT NULL,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

COMMENT ON TABLE slack_installations IS 'Slack workspace connections for habit reminders';

-- ============================================
-- 3. MICROSOFT TEAMS INTEGRATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS teams_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  tenant_name TEXT,
  service_url TEXT NOT NULL,
  bot_id TEXT,
  conversation_id TEXT,
  access_token TEXT, -- TODO: Encrypt in production using Vault
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{
    "morning_reminder": true,
    "evening_summary": true,
    "goal_reminders": false,
    "reminder_time": "08:00"
  }'::jsonb,
  installed_at TIMESTAMPTZ NOT NULL,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

COMMENT ON TABLE teams_installations IS 'Microsoft Teams connections for habit reminders';

-- ============================================
-- 4. PRINT ORDERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS print_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES print_products(id),
  prodigi_order_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'submitted', 'production', 'shipped', 'delivered', 'cancelled', 'failed'
  )),

  -- Order Details
  quantity INT DEFAULT 1,
  customization JSONB DEFAULT '{}',
  content_snapshot JSONB, -- Vision board or habits at time of order

  -- Shipping
  shipping_address JSONB NOT NULL,
  shipping_method TEXT DEFAULT 'standard',

  -- Pricing
  subtotal DECIMAL(10,2) NOT NULL,
  shipping DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Fulfillment
  tracking_number TEXT,
  tracking_url TEXT,
  carrier TEXT,
  estimated_delivery DATE,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE print_orders IS 'Orders for physical print products (pads, cards, posters, etc.)';

-- ============================================
-- 5. TEAM/ENTERPRISE TABLES (v2.0)
-- ============================================

-- Teams for Enterprise tier
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  subscription_tier TEXT DEFAULT 'team' CHECK (subscription_tier IN ('team', 'enterprise')),
  max_members INT DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE teams IS 'Enterprise teams for group accountability';

-- Team Memberships
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(team_id, user_id)
);

COMMENT ON TABLE team_members IS 'Team membership with role-based access';

-- Team Leaderboard Snapshots
CREATE TABLE IF NOT EXISTS team_leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rankings JSONB NOT NULL DEFAULT '[]',
  -- Rankings format: [{"user_id": "...", "name": "...", "score": 100, "streak": 7, "rank": 1}, ...]
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, period_type, period_start)
);

COMMENT ON TABLE team_leaderboards IS 'Cached leaderboard rankings for team gamification';

-- ============================================
-- 6. INDEXES
-- ============================================

-- Partner Collaboration Indexes
CREATE INDEX IF NOT EXISTS idx_partner_invitations_inviter ON partner_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_partner_invitations_email ON partner_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_partner_invitations_code ON partner_invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_partner_invitations_status ON partner_invitations(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_partner_connections_user ON partner_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_connections_partner ON partner_connections(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_connections_active ON partner_connections(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_shared_goals_connection ON shared_goals(connection_id);
CREATE INDEX IF NOT EXISTS idx_shared_goals_status ON shared_goals(status) WHERE status = 'active';

-- Integration Indexes
CREATE INDEX IF NOT EXISTS idx_slack_installations_user ON slack_installations(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_installations_team ON slack_installations(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_installations_active ON slack_installations(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_teams_installations_user ON teams_installations(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_installations_tenant ON teams_installations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teams_installations_active ON teams_installations(is_active) WHERE is_active = TRUE;

-- Print Orders Indexes
CREATE INDEX IF NOT EXISTS idx_print_orders_user ON print_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_print_orders_status ON print_orders(status);
CREATE INDEX IF NOT EXISTS idx_print_orders_created ON print_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_orders_prodigi ON print_orders(prodigi_order_id) WHERE prodigi_order_id IS NOT NULL;

-- Team Indexes
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_leaderboards_team_period ON team_leaderboards(team_id, period_type, period_start);

-- ============================================
-- 7. ROW LEVEL SECURITY - NEW TABLES
-- ============================================

ALTER TABLE partner_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_leaderboards ENABLE ROW LEVEL SECURITY;

-- Partner Invitations Policies
DROP POLICY IF EXISTS "Users can view their invitations" ON partner_invitations;
CREATE POLICY "Users can view their invitations"
  ON partner_invitations FOR SELECT
  USING (
    inviter_id = auth.uid()
    OR invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create invitations" ON partner_invitations;
CREATE POLICY "Users can create invitations"
  ON partner_invitations FOR INSERT
  WITH CHECK (inviter_id = auth.uid());

DROP POLICY IF EXISTS "Users can update invitations" ON partner_invitations;
CREATE POLICY "Users can update invitations"
  ON partner_invitations FOR UPDATE
  USING (
    inviter_id = auth.uid()
    OR invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Partner Connections Policies
DROP POLICY IF EXISTS "Users can view their connections" ON partner_connections;
CREATE POLICY "Users can view their connections"
  ON partner_connections FOR SELECT
  USING (user_id = auth.uid() OR partner_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages connections" ON partner_connections;
CREATE POLICY "Service role manages connections"
  ON partner_connections FOR ALL
  USING (auth.role() = 'service_role');

-- Shared Goals Policies
DROP POLICY IF EXISTS "Partners can view shared goals" ON shared_goals;
CREATE POLICY "Partners can view shared goals"
  ON shared_goals FOR SELECT
  USING (
    connection_id IN (
      SELECT id FROM partner_connections
      WHERE (user_id = auth.uid() OR partner_id = auth.uid()) AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Partners can create shared goals" ON shared_goals;
CREATE POLICY "Partners can create shared goals"
  ON shared_goals FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    connection_id IN (
      SELECT id FROM partner_connections
      WHERE (user_id = auth.uid() OR partner_id = auth.uid()) AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Partners can update shared goals" ON shared_goals;
CREATE POLICY "Partners can update shared goals"
  ON shared_goals FOR UPDATE
  USING (
    connection_id IN (
      SELECT id FROM partner_connections
      WHERE (user_id = auth.uid() OR partner_id = auth.uid()) AND status = 'active'
    )
  );

-- Slack Installations Policies
DROP POLICY IF EXISTS "Users own their Slack installations" ON slack_installations;
CREATE POLICY "Users own their Slack installations"
  ON slack_installations FOR ALL
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- Teams Installations Policies
DROP POLICY IF EXISTS "Users own their Teams installations" ON teams_installations;
CREATE POLICY "Users own their Teams installations"
  ON teams_installations FOR ALL
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- Print Orders Policies
DROP POLICY IF EXISTS "Users own their print orders" ON print_orders;
CREATE POLICY "Users own their print orders"
  ON print_orders FOR ALL
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- Teams Policies
DROP POLICY IF EXISTS "Team owners and admins can manage teams" ON teams;
CREATE POLICY "Team owners and admins can manage teams"
  ON teams FOR ALL
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Team members can view their team" ON teams;
CREATE POLICY "Team members can view their team"
  ON teams FOR SELECT
  USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND is_active = TRUE)
  );

-- Team Members Policies
DROP POLICY IF EXISTS "Team admins can manage members" ON team_members;
CREATE POLICY "Team admins can manage members"
  ON team_members FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Members can view their team members" ON team_members;
CREATE POLICY "Members can view their team members"
  ON team_members FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND is_active = TRUE)
  );

-- Team Leaderboards Policies
DROP POLICY IF EXISTS "Team members can view leaderboards" ON team_leaderboards;
CREATE POLICY "Team members can view leaderboards"
  ON team_leaderboards FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND is_active = TRUE)
  );

DROP POLICY IF EXISTS "Service role manages leaderboards" ON team_leaderboards;
CREATE POLICY "Service role manages leaderboards"
  ON team_leaderboards FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 8. ROW LEVEL SECURITY - EXISTING AMIE TABLES
-- (These were missing from the original migration)
-- ============================================

-- Enable RLS on AMIE tables if not already enabled
DO $$
BEGIN
  -- user_identity_profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'user_identity_profiles'
    AND rowsecurity = TRUE
  ) THEN
    ALTER TABLE user_identity_profiles ENABLE ROW LEVEL SECURITY;
  END IF;

  -- user_knowledge_sources
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'user_knowledge_sources'
    AND rowsecurity = TRUE
  ) THEN
    ALTER TABLE user_knowledge_sources ENABLE ROW LEVEL SECURITY;
  END IF;

  -- user_knowledge_chunks
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'user_knowledge_chunks'
    AND rowsecurity = TRUE
  ) THEN
    ALTER TABLE user_knowledge_chunks ENABLE ROW LEVEL SECURITY;
  END IF;

  -- voice_coach_sessions
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'voice_coach_sessions'
    AND rowsecurity = TRUE
  ) THEN
    ALTER TABLE voice_coach_sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- AMIE Policies
DROP POLICY IF EXISTS "Users own their identity profiles" ON user_identity_profiles;
CREATE POLICY "Users own their identity profiles"
  ON user_identity_profiles FOR ALL
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users own their knowledge sources" ON user_knowledge_sources;
CREATE POLICY "Users own their knowledge sources"
  ON user_knowledge_sources FOR ALL
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users own their knowledge chunks" ON user_knowledge_chunks;
CREATE POLICY "Users own their knowledge chunks"
  ON user_knowledge_chunks FOR ALL
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users own their voice sessions" ON voice_coach_sessions;
CREATE POLICY "Users own their voice sessions"
  ON voice_coach_sessions FOR ALL
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Function to get user's active partner
CREATE OR REPLACE FUNCTION get_partner_connection(p_user_id UUID)
RETURNS TABLE (
  connection_id UUID,
  partner_id UUID,
  partner_email TEXT,
  connected_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id as connection_id,
    CASE
      WHEN pc.user_id = p_user_id THEN pc.partner_id
      ELSE pc.user_id
    END as partner_id,
    u.email as partner_email,
    pc.connected_at
  FROM partner_connections pc
  JOIN auth.users u ON u.id = CASE
    WHEN pc.user_id = p_user_id THEN pc.partner_id
    ELSE pc.user_id
  END
  WHERE (pc.user_id = p_user_id OR pc.partner_id = p_user_id)
    AND pc.status = 'active'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate team leaderboard
CREATE OR REPLACE FUNCTION calculate_team_leaderboard(
  p_team_id UUID,
  p_period_type TEXT DEFAULT 'weekly'
)
RETURNS JSONB AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_rankings JSONB;
BEGIN
  -- Calculate period dates
  CASE p_period_type
    WHEN 'daily' THEN
      v_period_start := CURRENT_DATE;
      v_period_end := CURRENT_DATE;
    WHEN 'weekly' THEN
      v_period_start := date_trunc('week', CURRENT_DATE)::DATE;
      v_period_end := (date_trunc('week', CURRENT_DATE) + interval '6 days')::DATE;
    WHEN 'monthly' THEN
      v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
      v_period_end := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::DATE;
  END CASE;

  -- Calculate rankings
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', tm.user_id,
      'rank', row_number() OVER (ORDER BY COALESCE(stats.completion_count, 0) DESC),
      'completions', COALESCE(stats.completion_count, 0),
      'streak', COALESCE(stats.max_streak, 0)
    )
    ORDER BY COALESCE(stats.completion_count, 0) DESC
  )
  INTO v_rankings
  FROM team_members tm
  LEFT JOIN (
    SELECT
      h.user_id,
      COUNT(hc.id) as completion_count,
      MAX(h.current_streak) as max_streak
    FROM habits h
    LEFT JOIN habit_completions hc ON hc.habit_id = h.id
      AND hc.completed_at >= v_period_start
      AND hc.completed_at <= v_period_end + interval '1 day'
    WHERE h.is_active = TRUE
    GROUP BY h.user_id
  ) stats ON stats.user_id = tm.user_id
  WHERE tm.team_id = p_team_id AND tm.is_active = TRUE;

  -- Upsert leaderboard snapshot
  INSERT INTO team_leaderboards (team_id, period_type, period_start, period_end, rankings)
  VALUES (p_team_id, p_period_type, v_period_start, v_period_end, COALESCE(v_rankings, '[]'::jsonb))
  ON CONFLICT (team_id, period_type, period_start)
  DO UPDATE SET rankings = COALESCE(v_rankings, '[]'::jsonb), generated_at = NOW();

  RETURN COALESCE(v_rankings, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. TRIGGERS
-- ============================================

-- Update timestamps trigger for shared_goals
DROP TRIGGER IF EXISTS update_shared_goals_updated_at ON shared_goals;
CREATE TRIGGER update_shared_goals_updated_at
  BEFORE UPDATE ON shared_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update timestamps trigger for print_orders
DROP TRIGGER IF EXISTS update_print_orders_updated_at ON print_orders;
CREATE TRIGGER update_print_orders_updated_at
  BEFORE UPDATE ON print_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update timestamps trigger for teams
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 9
--   - partner_invitations
--   - partner_connections
--   - shared_goals
--   - slack_installations
--   - teams_installations
--   - print_orders
--   - teams
--   - team_members
--   - team_leaderboards
--
-- Indexes created: 20+
-- RLS policies created: 20+
-- Functions created: 2
-- Triggers created: 3
-- ============================================
