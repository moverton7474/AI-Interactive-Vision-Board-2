-- ============================================
-- VISIONARY AI - SEED PLATFORM ADMIN
-- ============================================
-- This script seeds the first platform administrator.
--
-- INSTRUCTIONS:
-- 1. Replace 'ADMIN_EMAIL_PLACEHOLDER' with the actual admin email
-- 2. Run this script ONCE after the user has created their account
-- 3. The user must already exist in auth.users
--
-- IMPORTANT: Do NOT commit this file with the actual email.
-- ============================================

-- Option 1: Using email lookup (recommended)
-- Replace 'ADMIN_EMAIL_PLACEHOLDER' with the actual admin email
DO $$
DECLARE
  v_admin_email TEXT := 'ADMIN_EMAIL_PLACEHOLDER'; -- CHANGE THIS
  v_user_id UUID;
BEGIN
  -- Skip if placeholder not replaced
  IF v_admin_email = 'ADMIN_EMAIL_PLACEHOLDER' THEN
    RAISE NOTICE 'Skipping: Please replace ADMIN_EMAIL_PLACEHOLDER with actual admin email';
    RETURN;
  END IF;

  -- Look up user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_admin_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found. Make sure they have created an account first.', v_admin_email;
  END IF;

  -- Insert or update platform_admin role
  INSERT INTO platform_roles (user_id, role, notes, is_active)
  VALUES (
    v_user_id,
    'platform_admin',
    format('Initial platform administrator - seeded on %s', NOW()::DATE),
    TRUE
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'platform_admin',
    is_active = TRUE,
    notes = EXCLUDED.notes;

  -- Log the admin creation
  PERFORM log_audit(
    'admin.role.grant',
    'platform_roles',
    v_user_id::TEXT,
    NULL,
    jsonb_build_object('role', 'platform_admin'),
    format('Platform admin role granted to %s', v_admin_email),
    NULL
  );

  RAISE NOTICE 'Successfully granted platform_admin role to % (user_id: %)', v_admin_email, v_user_id;
END $$;


-- Option 2: Using user ID directly (if you know the UUID)
-- Uncomment and replace 'YOUR-USER-UUID-HERE' with the actual UUID
/*
INSERT INTO platform_roles (user_id, role, notes, is_active)
VALUES (
  'YOUR-USER-UUID-HERE'::UUID,
  'platform_admin',
  'Initial platform administrator',
  TRUE
)
ON CONFLICT (user_id) DO UPDATE SET
  role = 'platform_admin',
  is_active = TRUE;
*/


-- ============================================
-- VERIFICATION
-- ============================================

-- List all platform admins
SELECT
  pr.user_id,
  u.email,
  pr.role,
  pr.is_active,
  pr.granted_at,
  pr.notes
FROM platform_roles pr
JOIN auth.users u ON pr.user_id = u.id
WHERE pr.role = 'platform_admin';
