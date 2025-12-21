-- ============================================
-- FEATURE FLAGS SCHEMA UPDATE
-- Migration: 20251220_feature_flags
--
-- Adds missing columns to existing feature_flags table
-- for gradual rollout and A/B testing of new features.
-- ============================================

-- ============================================
-- PART 1: ADD MISSING COLUMNS TO FEATURE FLAGS
-- ============================================

DO $$
BEGIN
  -- Add is_enabled column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_flags' AND column_name = 'is_enabled'
  ) THEN
    ALTER TABLE feature_flags ADD COLUMN is_enabled BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add rollout_percentage column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_flags' AND column_name = 'rollout_percentage'
  ) THEN
    ALTER TABLE feature_flags ADD COLUMN rollout_percentage INTEGER DEFAULT 0
      CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100);
  END IF;

  -- Add tier_required column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_flags' AND column_name = 'tier_required'
  ) THEN
    ALTER TABLE feature_flags ADD COLUMN tier_required TEXT DEFAULT 'FREE'
      CHECK (tier_required IN ('FREE', 'PRO', 'ELITE', 'TEAM'));
  END IF;

  -- Add allowed_user_ids column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_flags' AND column_name = 'allowed_user_ids'
  ) THEN
    ALTER TABLE feature_flags ADD COLUMN allowed_user_ids UUID[] DEFAULT '{}';
  END IF;

  -- Add metadata column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_flags' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE feature_flags ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;

  -- Add updated_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_flags' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE feature_flags ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

COMMENT ON TABLE feature_flags IS 'Feature flags for gradual feature rollout and A/B testing';

-- Create indexes (after columns exist)
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(is_enabled) WHERE is_enabled = TRUE;

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Anyone can read feature flags (needed for client-side checks)
DROP POLICY IF EXISTS "Anyone can read feature flags" ON feature_flags;
CREATE POLICY "Anyone can read feature flags"
  ON feature_flags FOR SELECT
  USING (TRUE);

-- Only platform admins can manage feature flags
DROP POLICY IF EXISTS "Platform admins can manage feature flags" ON feature_flags;
CREATE POLICY "Platform admins can manage feature flags"
  ON feature_flags FOR ALL
  USING (
    auth.role() = 'service_role'
    OR is_platform_admin()
  );

-- Update existing rows to have is_enabled = TRUE if they should be active
UPDATE feature_flags SET is_enabled = TRUE WHERE is_enabled IS NULL;

-- ============================================
-- PART 2: USER FEATURE FLAGS TABLE
-- ============================================
-- Tracks which features are enabled for specific users

CREATE TABLE IF NOT EXISTS user_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT TRUE,               -- Override for this user
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  notes TEXT,                                    -- Why this user has access
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature_flag_id)
);

COMMENT ON TABLE user_feature_flags IS 'Per-user feature flag overrides';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_feature_flags_user ON user_feature_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_flags_feature ON user_feature_flags(feature_flag_id);

-- Enable RLS
ALTER TABLE user_feature_flags ENABLE ROW LEVEL SECURITY;

-- Users can see their own feature flags
CREATE POLICY "Users can view own feature flags"
  ON user_feature_flags FOR SELECT
  USING (user_id = auth.uid());

-- Platform admins can manage user feature flags
CREATE POLICY "Platform admins can manage user feature flags"
  ON user_feature_flags FOR ALL
  USING (
    auth.role() = 'service_role'
    OR is_platform_admin()
  );

-- ============================================
-- PART 3: HELPER FUNCTIONS
-- ============================================

-- Check if a feature is enabled for the current user
CREATE OR REPLACE FUNCTION is_feature_enabled(p_feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_flag RECORD;
  v_user_tier TEXT;
  v_user_override BOOLEAN;
BEGIN
  -- Get the feature flag
  SELECT * INTO v_flag FROM feature_flags WHERE name = p_feature_name;

  -- If feature doesn't exist, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- If globally disabled, return false
  IF NOT v_flag.is_enabled THEN
    RETURN FALSE;
  END IF;

  -- Check for user-specific override
  SELECT is_enabled INTO v_user_override
  FROM user_feature_flags
  WHERE user_id = auth.uid() AND feature_flag_id = v_flag.id;

  IF FOUND THEN
    RETURN v_user_override;
  END IF;

  -- Check if user is in allowed_user_ids
  IF auth.uid() = ANY(v_flag.allowed_user_ids) THEN
    RETURN TRUE;
  END IF;

  -- Check tier requirement
  SELECT subscription_tier INTO v_user_tier
  FROM profiles WHERE id = auth.uid();

  IF v_user_tier IS NULL THEN
    v_user_tier := 'FREE';
  END IF;

  -- Tier hierarchy: TEAM > ELITE > PRO > FREE
  CASE v_flag.tier_required
    WHEN 'FREE' THEN
      -- All tiers pass
      NULL;
    WHEN 'PRO' THEN
      IF v_user_tier = 'FREE' THEN RETURN FALSE; END IF;
    WHEN 'ELITE' THEN
      IF v_user_tier IN ('FREE', 'PRO') THEN RETURN FALSE; END IF;
    WHEN 'TEAM' THEN
      IF v_user_tier != 'TEAM' THEN RETURN FALSE; END IF;
  END CASE;

  -- Check rollout percentage (deterministic based on user ID)
  IF v_flag.rollout_percentage < 100 THEN
    -- Use user ID hash for consistent rollout
    RETURN (abs(hashtext(auth.uid()::TEXT)) % 100) < v_flag.rollout_percentage;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_feature_enabled(TEXT) IS 'Check if a feature flag is enabled for the current user';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_feature_enabled(TEXT) TO authenticated;

-- ============================================
-- PART 4: AUDIT TRIGGER FOR FEATURE FLAGS
-- ============================================

CREATE OR REPLACE FUNCTION audit_feature_flag_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(
      'feature_flag.create',
      'feature_flags',
      NEW.id::TEXT,
      NULL,
      row_to_json(NEW)::JSONB,
      format('Feature flag "%s" created', NEW.name),
      NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(
      'feature_flag.update',
      'feature_flags',
      NEW.id::TEXT,
      row_to_json(OLD)::JSONB,
      row_to_json(NEW)::JSONB,
      format('Feature flag "%s" updated', NEW.name),
      NULL
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit(
      'feature_flag.delete',
      'feature_flags',
      OLD.id::TEXT,
      row_to_json(OLD)::JSONB,
      NULL,
      format('Feature flag "%s" deleted', OLD.name),
      NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_feature_flags ON feature_flags;
CREATE TRIGGER audit_feature_flags
  AFTER INSERT OR UPDATE OR DELETE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION audit_feature_flag_changes();

-- ============================================
-- PART 5: SEED DEFAULT FEATURE FLAGS
-- ============================================

INSERT INTO feature_flags (name, description, is_enabled, tier_required, rollout_percentage) VALUES
  -- Voice Features (Phase 1-2)
  ('elevenlabs_tts', 'ElevenLabs text-to-speech voices', FALSE, 'PRO', 0),
  ('voice_cloning', 'Custom voice cloning capability', FALSE, 'ELITE', 0),
  ('gemini_live_voice', 'Real-time bidirectional voice with Gemini', FALSE, 'PRO', 0),
  ('multi_language_voice', 'Multi-language voice support', FALSE, 'PRO', 0),

  -- Video Features (Phase 3)
  ('veo_video_generation', 'Video generation with Google Veo', FALSE, 'ELITE', 0),

  -- Marketplace Features (Phase 4)
  ('template_marketplace', 'Browse and install community templates', FALSE, 'FREE', 0),
  ('coach_ecosystem', 'Certified coach marketplace', FALSE, 'PRO', 0),

  -- Existing Features (already live)
  ('voice_coach', 'AI Voice Coach sessions', TRUE, 'PRO', 100),
  ('plaid_integration', 'Bank account linking via Plaid', TRUE, 'PRO', 100),
  ('team_features', 'Team collaboration features', TRUE, 'TEAM', 100)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- PART 6: UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER trigger_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

DROP TRIGGER IF EXISTS trigger_user_feature_flags_updated_at ON user_feature_flags;
CREATE TRIGGER trigger_user_feature_flags_updated_at
  BEFORE UPDATE ON user_feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- ============================================
-- VERIFICATION
-- ============================================

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('feature_flags', 'user_feature_flags');

-- Show seeded feature flags
SELECT name, description, is_enabled, tier_required, rollout_percentage
FROM feature_flags
ORDER BY name;
