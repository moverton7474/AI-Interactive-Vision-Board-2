-- ============================================
-- VISIONARY AI - ADMIN USER MANAGEMENT
-- ============================================
-- Run this script in Supabase SQL Editor to enable:
-- 1. Platform admins to delete user profiles
-- 2. Seed your account as platform_admin (REQUIRED!)
-- ============================================

-- ============================================
-- STEP 1: ADD DELETE POLICY FOR PROFILES
-- ============================================
-- This allows platform admins to delete user profiles

DROP POLICY IF EXISTS "Platform admins can delete profiles" ON profiles;

CREATE POLICY "Platform admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    is_platform_admin()
    OR auth.role() = 'service_role'
  );

-- Verify the policy was created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'DELETE';


-- ============================================
-- STEP 2: SEED YOUR ACCOUNT AS PLATFORM ADMIN
-- ============================================
-- IMPORTANT: Replace the email with your actual admin email!

DO $$
DECLARE
  v_admin_email TEXT := 'moverton7474@gmail.com'; -- CHANGE THIS TO YOUR EMAIL
  v_user_id UUID;
BEGIN
  -- Look up user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(v_admin_email);

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found. Make sure they have created an account first.', v_admin_email;
    RETURN;
  END IF;

  -- Check if platform_roles table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_roles') THEN
    RAISE EXCEPTION 'platform_roles table does not exist. Run the RBAC migration first.';
  END IF;

  -- Insert or update platform_admin role
  INSERT INTO platform_roles (user_id, role, notes, is_active)
  VALUES (
    v_user_id,
    'platform_admin',
    format('Platform administrator - seeded on %s', NOW()::DATE),
    TRUE
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'platform_admin',
    is_active = TRUE,
    notes = format('Platform administrator - updated on %s', NOW()::DATE);

  RAISE NOTICE 'Successfully granted platform_admin role to % (user_id: %)', v_admin_email, v_user_id;
END $$;


-- ============================================
-- STEP 3: VERIFY PLATFORM ADMIN SETUP
-- ============================================

-- List all platform admins
SELECT
  pr.user_id,
  u.email,
  pr.role,
  pr.is_active,
  pr.granted_at
FROM platform_roles pr
JOIN auth.users u ON pr.user_id = u.id
WHERE pr.role = 'platform_admin'
  AND pr.is_active = true;

-- Verify profiles policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd;


-- ============================================
-- STEP 4: TEST - List all user profiles
-- ============================================
-- This should return all profiles if you're a platform admin

SELECT id, names, email, subscription_tier, created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 20;
