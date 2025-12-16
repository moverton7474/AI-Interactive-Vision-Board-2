-- ============================================
-- ADMIN CREDIT MANAGEMENT RLS POLICIES
-- Migration: 20251216_admin_credit_management.sql
-- Description: Enables platform admins to view and manage
--              all user profiles and credit transactions
--              for the Credit Management feature.
-- ============================================

-- ============================================
-- 1. PROFILES TABLE - ADMIN READ ACCESS
-- ============================================
-- Allow platform admins to read all profiles for credit management

DROP POLICY IF EXISTS "Platform admins can view all profiles" ON profiles;
CREATE POLICY "Platform admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id  -- Users can always see their own profile
    OR EXISTS (
      SELECT 1 FROM platform_roles pr
      WHERE pr.user_id = auth.uid()
      AND pr.role = 'platform_admin'
      AND pr.is_active = TRUE
      AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
    )
  );

-- Allow platform admins to update profiles (for credit adjustments)
DROP POLICY IF EXISTS "Platform admins can update profiles" ON profiles;
CREATE POLICY "Platform admins can update profiles"
  ON profiles FOR UPDATE
  USING (
    auth.uid() = id  -- Users can update their own profile
    OR EXISTS (
      SELECT 1 FROM platform_roles pr
      WHERE pr.user_id = auth.uid()
      AND pr.role = 'platform_admin'
      AND pr.is_active = TRUE
      AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
    )
  )
  WITH CHECK (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM platform_roles pr
      WHERE pr.user_id = auth.uid()
      AND pr.role = 'platform_admin'
      AND pr.is_active = TRUE
      AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
    )
  );

-- ============================================
-- 2. CREDIT_TRANSACTIONS TABLE - ADMIN ACCESS
-- ============================================
-- Ensure credit_transactions table exists and has proper RLS

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE credit_transactions IS 'Audit log of all credit adjustments';

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
DROP POLICY IF EXISTS "Users can view own credit transactions" ON credit_transactions;
CREATE POLICY "Users can view own credit transactions"
  ON credit_transactions FOR SELECT
  USING (user_id = auth.uid());

-- Platform admins can view all transactions
DROP POLICY IF EXISTS "Platform admins can view all credit transactions" ON credit_transactions;
CREATE POLICY "Platform admins can view all credit transactions"
  ON credit_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM platform_roles pr
      WHERE pr.user_id = auth.uid()
      AND pr.role = 'platform_admin'
      AND pr.is_active = TRUE
      AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
    )
  );

-- Platform admins can insert transactions (for logging adjustments)
DROP POLICY IF EXISTS "Platform admins can insert credit transactions" ON credit_transactions;
CREATE POLICY "Platform admins can insert credit transactions"
  ON credit_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM platform_roles pr
      WHERE pr.user_id = auth.uid()
      AND pr.role = 'platform_admin'
      AND pr.is_active = TRUE
      AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
    )
  );

-- ============================================
-- 3. ENSURE CREDITS COLUMN EXISTS ON PROFILES
-- ============================================
-- Add credits column if it doesn't exist

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'credits'
  ) THEN
    ALTER TABLE profiles ADD COLUMN credits INTEGER DEFAULT 10;
  END IF;
END $$;

-- ============================================
-- 4. CREATE HELPER FUNCTION FOR ADMIN CHECK
-- ============================================
-- Reusable function to check if current user is platform admin

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_platform_admin() IS 'Returns true if current user is an active platform admin';
