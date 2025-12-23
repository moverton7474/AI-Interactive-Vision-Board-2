-- ============================================================================
-- CRITICAL FIX: Signup Trigger Migration
-- Date: 2025-12-23
-- Issue: handle_new_user() references 'created_at' column that doesn't exist
-- in the profiles table, causing all new user signups to fail.
-- ============================================================================

-- 1. Add created_at column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added created_at column to profiles table';
  END IF;
END $$;

-- 2. Add names column to profiles if it doesn't exist (used by queue_welcome_email)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'names'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN names TEXT;
    RAISE NOTICE 'Added names column to profiles table';
  END IF;
END $$;

-- 3. Fix the handle_new_user function to be robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile with only columns that definitely exist
  INSERT INTO public.profiles (
    id,
    credits,
    subscription_tier,
    onboarding_completed,
    created_at
  ) VALUES (
    NEW.id,
    10,  -- Free starting credits
    'FREE',
    false,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN undefined_column THEN
    -- Fallback: If created_at doesn't exist, try without it
    INSERT INTO public.profiles (
      id,
      credits,
      subscription_tier,
      onboarding_completed
    ) VALUES (
      NEW.id,
      10,
      'FREE',
      false
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Fix the email preferences trigger to be more robust
CREATE OR REPLACE FUNCTION create_email_preferences_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO email_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Error creating email preferences for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fix the welcome email queue trigger to be more robust
CREATE OR REPLACE FUNCTION queue_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
BEGIN
  -- Safely get user's name from profiles if exists
  BEGIN
    SELECT names INTO user_name FROM profiles WHERE id = NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      user_name := NULL;
  END;

  -- Queue welcome email (will be sent by edge function)
  INSERT INTO email_queue (
    user_id,
    to_email,
    template,
    template_data,
    priority,
    scheduled_for
  ) VALUES (
    NEW.id,
    NEW.email,
    'welcome',
    jsonb_build_object(
      'name', COALESCE(user_name, split_part(NEW.email, '@', 1)),
      'email', NEW.email
    ),
    1, -- High priority
    NOW() + INTERVAL '1 minute' -- Slight delay to ensure profile is created
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Error queueing welcome email for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Fix the sync_profile_email trigger to handle missing profile gracefully
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if profile exists
  UPDATE profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    RAISE WARNING 'Error syncing email for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Backfill created_at for existing profiles that don't have it
UPDATE public.profiles
SET created_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL;

-- 9. Verification: Check that all triggers exist
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND t.tgname IN ('on_auth_user_created', 'on_auth_user_created_email_prefs', 'on_auth_user_created_welcome_email');

  RAISE NOTICE 'Found % user creation triggers on auth.users', trigger_count;
END $$;

-- 10. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates a profile row when a new user signs up. Fixed 2025-12-23 to handle missing columns gracefully.';
