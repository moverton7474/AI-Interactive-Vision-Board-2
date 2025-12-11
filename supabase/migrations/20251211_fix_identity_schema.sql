-- ============================================
-- Migration: Fix user_identity_profiles schema
-- Date: 2025-12-11
-- Purpose: Ensure theme_id is nullable and RLS policies are correct
-- ============================================

-- 1. Make theme_id nullable if it has a NOT NULL constraint
-- (The migration file 20251201 has it nullable, but the base schema might not)
DO $$
BEGIN
  -- Check if the constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_identity_profiles'
    AND column_name = 'theme_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.user_identity_profiles
    ALTER COLUMN theme_id DROP NOT NULL;
    RAISE NOTICE 'Made theme_id nullable';
  END IF;
END $$;

-- 2. Ensure RLS is enabled on critical tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vision_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_identity_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poster_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_orders ENABLE ROW LEVEL SECURITY;

-- 3. Create or replace RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 4. RLS policies for user_identity_profiles
DROP POLICY IF EXISTS "Users can manage own identity" ON public.user_identity_profiles;
CREATE POLICY "Users can manage own identity"
ON public.user_identity_profiles
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. RLS policies for vision_boards
DROP POLICY IF EXISTS "Users can manage own visions" ON public.vision_boards;
CREATE POLICY "Users can manage own visions"
ON public.vision_boards
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. RLS policies for habits
DROP POLICY IF EXISTS "Users can manage own habits" ON public.habits;
CREATE POLICY "Users can manage own habits"
ON public.habits
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 7. RLS policies for habit_completions (via habit ownership)
DROP POLICY IF EXISTS "Users can manage own completions" ON public.habit_completions;
CREATE POLICY "Users can manage own completions"
ON public.habit_completions
FOR ALL
TO authenticated
USING (
  habit_id IN (SELECT id FROM public.habits WHERE user_id = auth.uid())
)
WITH CHECK (
  habit_id IN (SELECT id FROM public.habits WHERE user_id = auth.uid())
);

-- 8. RLS policies for action_tasks
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.action_tasks;
CREATE POLICY "Users can manage own tasks"
ON public.action_tasks
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 9. RLS policies for poster_orders
DROP POLICY IF EXISTS "Users can manage own poster orders" ON public.poster_orders;
CREATE POLICY "Users can manage own poster orders"
ON public.poster_orders
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 10. RLS policies for workbook_orders
DROP POLICY IF EXISTS "Users can manage own workbook orders" ON public.workbook_orders;
CREATE POLICY "Users can manage own workbook orders"
ON public.workbook_orders
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 11. Public read access for motivational_themes (reference data)
DROP POLICY IF EXISTS "Anyone can view themes" ON public.motivational_themes;
CREATE POLICY "Anyone can view themes"
ON public.motivational_themes
FOR SELECT
TO authenticated
USING (is_active = true);

-- 12. Create profile trigger if not exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. Add updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Verification
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'vision_boards', 'user_identity_profiles', 'habits', 'action_tasks')
ORDER BY tablename, policyname;
