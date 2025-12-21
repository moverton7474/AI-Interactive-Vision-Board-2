-- Feature Flags System (v1.8)
-- Enables gradual rollouts, role-based access, and phased feature releases

-- ============================================
-- FEATURE FLAGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  default_enabled BOOLEAN DEFAULT false,
  allowed_roles TEXT[] DEFAULT '{}',
  allowed_cohorts TEXT[] DEFAULT '{"all_users"}',
  is_active BOOLEAN DEFAULT true,
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast name lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON public.feature_flags(name);

-- ============================================
-- USER FEATURE FLAGS (overrides per user)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature_flag_id UUID REFERENCES public.feature_flags(id) ON DELETE CASCADE NOT NULL,
  feature_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  cohort TEXT DEFAULT 'all_users',
  enabled_at TIMESTAMP WITH TIME ZONE,
  disabled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, feature_flag_id)
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_feature_flags_user ON public.user_feature_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_flags_name ON public.user_feature_flags(feature_name);

-- ============================================
-- FEATURE FLAG OVERRIDES (for cohorts/roles)
-- ============================================

CREATE TABLE IF NOT EXISTS public.feature_flag_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_flag_id UUID REFERENCES public.feature_flags(id) ON DELETE CASCADE NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'cohort', 'role')),
  target_id TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(feature_flag_id, target_type, target_id)
);

-- Index for override lookups
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_target ON public.feature_flag_overrides(target_type, target_id);

-- ============================================
-- USER COHORTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cohort TEXT NOT NULL CHECK (cohort IN ('internal', 'beta_testers', 'early_adopters', 'premium', 'all_users')),
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(user_id, cohort)
);

-- Index for cohort lookups
CREATE INDEX IF NOT EXISTS idx_user_cohorts_user ON public.user_cohorts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cohorts_cohort ON public.user_cohorts(cohort);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cohorts ENABLE ROW LEVEL SECURITY;

-- Feature flags: Everyone can read, only admins can modify
DROP POLICY IF EXISTS "feature_flags_select" ON public.feature_flags;
CREATE POLICY "feature_flags_select" ON public.feature_flags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "feature_flags_admin_all" ON public.feature_flags;
CREATE POLICY "feature_flags_admin_all" ON public.feature_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.platform_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin' AND is_active = true
    )
  );

-- User feature flags: Users can read their own, admins can manage all
DROP POLICY IF EXISTS "user_feature_flags_own_read" ON public.user_feature_flags;
CREATE POLICY "user_feature_flags_own_read" ON public.user_feature_flags
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_feature_flags_admin_all" ON public.user_feature_flags;
CREATE POLICY "user_feature_flags_admin_all" ON public.user_feature_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.platform_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin' AND is_active = true
    )
  );

-- Feature flag overrides: Admins only
DROP POLICY IF EXISTS "feature_flag_overrides_admin" ON public.feature_flag_overrides;
CREATE POLICY "feature_flag_overrides_admin" ON public.feature_flag_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.platform_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin' AND is_active = true
    )
  );

-- User cohorts: Users can read their own, admins can manage all
DROP POLICY IF EXISTS "user_cohorts_own_read" ON public.user_cohorts;
CREATE POLICY "user_cohorts_own_read" ON public.user_cohorts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_cohorts_admin_all" ON public.user_cohorts;
CREATE POLICY "user_cohorts_admin_all" ON public.user_cohorts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.platform_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin' AND is_active = true
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if a feature is enabled for a user
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  p_user_id UUID,
  p_feature_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_flag RECORD;
  v_user_override RECORD;
  v_user_cohorts TEXT[];
  v_user_roles TEXT[];
  v_rollout_hash INTEGER;
BEGIN
  -- Get the feature flag
  SELECT * INTO v_flag FROM public.feature_flags
  WHERE name = p_feature_name AND is_active = true;

  -- If feature doesn't exist or is inactive, return default (false)
  IF v_flag IS NULL THEN
    RETURN false;
  END IF;

  -- Check for user-specific override first
  SELECT * INTO v_user_override FROM public.user_feature_flags
  WHERE user_id = p_user_id AND feature_name = p_feature_name;

  IF v_user_override IS NOT NULL THEN
    RETURN v_user_override.is_enabled;
  END IF;

  -- Get user's cohorts
  SELECT ARRAY_AGG(cohort) INTO v_user_cohorts
  FROM public.user_cohorts
  WHERE user_id = p_user_id AND (expires_at IS NULL OR expires_at > NOW());

  -- Default to 'all_users' if no cohorts assigned
  IF v_user_cohorts IS NULL THEN
    v_user_cohorts := ARRAY['all_users'];
  END IF;

  -- Get user's platform role
  SELECT ARRAY_AGG(role) INTO v_user_roles
  FROM public.platform_roles
  WHERE user_id = p_user_id AND is_active = true;

  IF v_user_roles IS NULL THEN
    v_user_roles := ARRAY[]::TEXT[];
  END IF;

  -- Check cohort override
  IF EXISTS (
    SELECT 1 FROM public.feature_flag_overrides ffo
    WHERE ffo.feature_flag_id = v_flag.id
      AND ffo.target_type = 'cohort'
      AND ffo.target_id = ANY(v_user_cohorts)
      AND (ffo.expires_at IS NULL OR ffo.expires_at > NOW())
  ) THEN
    SELECT is_enabled INTO v_user_override FROM public.feature_flag_overrides
    WHERE feature_flag_id = v_flag.id
      AND target_type = 'cohort'
      AND target_id = ANY(v_user_cohorts)
    LIMIT 1;
    RETURN COALESCE(v_user_override.is_enabled, false);
  END IF;

  -- Check role override
  IF EXISTS (
    SELECT 1 FROM public.feature_flag_overrides ffo
    WHERE ffo.feature_flag_id = v_flag.id
      AND ffo.target_type = 'role'
      AND ffo.target_id = ANY(v_user_roles)
      AND (ffo.expires_at IS NULL OR ffo.expires_at > NOW())
  ) THEN
    SELECT is_enabled INTO v_user_override FROM public.feature_flag_overrides
    WHERE feature_flag_id = v_flag.id
      AND target_type = 'role'
      AND target_id = ANY(v_user_roles)
    LIMIT 1;
    RETURN COALESCE(v_user_override.is_enabled, false);
  END IF;

  -- Check if user's cohort is in allowed cohorts
  IF NOT (v_user_cohorts && v_flag.allowed_cohorts) THEN
    RETURN false;
  END IF;

  -- Check if user's role is in allowed roles (empty means all roles allowed)
  IF ARRAY_LENGTH(v_flag.allowed_roles, 1) > 0 AND NOT (v_user_roles && v_flag.allowed_roles) THEN
    RETURN false;
  END IF;

  -- Apply rollout percentage using deterministic hash
  IF v_flag.rollout_percentage < 100 THEN
    v_rollout_hash := ABS(HASHTEXT(p_user_id::TEXT || p_feature_name)) % 100;
    IF v_rollout_hash >= v_flag.rollout_percentage THEN
      RETURN false;
    END IF;
  END IF;

  -- Return default enabled status
  RETURN v_flag.default_enabled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all enabled features for a user
CREATE OR REPLACE FUNCTION public.get_user_features(p_user_id UUID)
RETURNS TABLE (
  feature_name TEXT,
  is_enabled BOOLEAN,
  source TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ff.name AS feature_name,
    public.is_feature_enabled(p_user_id, ff.name) AS is_enabled,
    CASE
      WHEN uff.id IS NOT NULL THEN 'user_override'
      WHEN ffo_cohort.id IS NOT NULL THEN 'cohort_override'
      WHEN ffo_role.id IS NOT NULL THEN 'role_override'
      ELSE 'default'
    END AS source
  FROM public.feature_flags ff
  LEFT JOIN public.user_feature_flags uff
    ON ff.id = uff.feature_flag_id AND uff.user_id = p_user_id
  LEFT JOIN public.feature_flag_overrides ffo_cohort
    ON ff.id = ffo_cohort.feature_flag_id
    AND ffo_cohort.target_type = 'cohort'
    AND ffo_cohort.target_id IN (SELECT cohort FROM public.user_cohorts WHERE user_id = p_user_id)
  LEFT JOIN public.feature_flag_overrides ffo_role
    ON ff.id = ffo_role.feature_flag_id
    AND ffo_role.target_type = 'role'
    AND ffo_role.target_id IN (SELECT role FROM public.platform_roles WHERE user_id = p_user_id AND is_active = true)
  WHERE ff.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SEED DEFAULT FEATURE FLAGS
-- ============================================

INSERT INTO public.feature_flags (name, display_name, description, default_enabled, allowed_roles, allowed_cohorts, rollout_percentage)
VALUES
  ('goals_page', 'Goals Page', 'Access to the new Goals management page', true, '{}', '{"all_users"}', 100),
  ('ai_coach', 'AI Coach', 'AI coaching suggestions and guidance', true, '{}', '{"all_users"}', 100),
  ('financial_dashboard', 'Financial Dashboard', 'Advanced financial tracking and analytics', true, '{}', '{"premium", "early_adopters"}', 100),
  ('team_collaboration', 'Team Collaboration', 'Team features and shared workspaces', true, '{}', '{"premium"}', 100),
  ('voice_coach', 'Voice Coach', 'Voice-based AI coaching sessions', true, '{}', '{"all_users"}', 100),
  ('print_products', 'Print Products', 'Vision board printing and merchandise', true, '{}', '{"all_users"}', 100),
  ('partner_workspace', 'Partner Workspace', 'Collaborative partner workspace', true, '{}', '{"premium", "early_adopters"}', 100),
  ('integrations', 'Integrations', 'Third-party app integrations (Slack, Teams)', true, '{}', '{"premium"}', 100),
  ('team_leaderboards', 'Team Leaderboards', 'Team competition and rankings', true, '{}', '{"premium"}', 100),
  ('manager_dashboard', 'Manager Dashboard', 'Team management and analytics', true, '{"platform_admin"}', '{"internal"}', 100),
  ('mdals_lab', 'MDALS Lab', 'MDALS Engine test panel (development)', false, '{"platform_admin"}', '{"internal"}', 100),
  ('advanced_analytics', 'Advanced Analytics', 'Detailed usage and performance analytics', false, '{"platform_admin"}', '{"internal", "beta_testers"}', 50),
  ('beta_features', 'Beta Features', 'Access to experimental features', false, '{}', '{"internal", "beta_testers"}', 100)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feature_flags_updated ON public.feature_flags;
CREATE TRIGGER feature_flags_updated
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

DROP TRIGGER IF EXISTS user_feature_flags_updated ON public.user_feature_flags;
CREATE TRIGGER user_feature_flags_updated
  BEFORE UPDATE ON public.user_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_features(UUID) TO authenticated;
