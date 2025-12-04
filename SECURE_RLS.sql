-- Enable Row Level Security (RLS) for Critical Tables
-- Run this in Supabase SQL Editor

-- 1. Profiles Table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

-- 2. Vision Boards Table
ALTER TABLE public.vision_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own visions" ON public.vision_boards;
CREATE POLICY "Users can view own visions" 
ON public.vision_boards FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own visions" ON public.vision_boards;
CREATE POLICY "Users can create own visions" 
ON public.vision_boards FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own visions" ON public.vision_boards;
CREATE POLICY "Users can delete own visions" 
ON public.vision_boards FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- 3. User Identity Profiles Table
ALTER TABLE public.user_identity_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own identity" ON public.user_identity_profiles;
CREATE POLICY "Users can manage own identity" 
ON public.user_identity_profiles 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id);

-- Verification Query
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'vision_boards', 'user_identity_profiles');
