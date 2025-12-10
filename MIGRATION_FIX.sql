-- ========================================
-- MIGRATION FIX: Add missing columns
-- Run this in Supabase Dashboard → SQL Editor
-- ========================================

-- Fix 1: Add current_streak column to habits table
ALTER TABLE public.habits
ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;

-- Fix 2: Add last_completed column to habits table (if missing)
ALTER TABLE public.habits
ADD COLUMN IF NOT EXISTS last_completed TIMESTAMP WITH TIME ZONE;

-- Fix 3: Add domain column to user_vision_profiles (if missing)
ALTER TABLE public.user_vision_profiles
ADD COLUMN IF NOT EXISTS domain TEXT;

-- Fix 4: Add identity_description to reference_images (if missing)
ALTER TABLE public.reference_images
ADD COLUMN IF NOT EXISTS identity_description TEXT;

-- ========================================
-- Fix 5: Create voice_coach_sessions table (for live Voice Coach)
-- ========================================
CREATE TABLE IF NOT EXISTS public.voice_coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_type TEXT NOT NULL,
  trigger_context JSONB DEFAULT '{}',
  device_type TEXT DEFAULT 'web',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INT,
  transcript JSONB DEFAULT '[]',
  sentiment_score FLOAT,
  key_topics TEXT[] DEFAULT '{}',
  action_items_generated JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.voice_coach_sessions ENABLE ROW LEVEL SECURITY;

-- Policy for voice coach sessions
DROP POLICY IF EXISTS "Users can manage own voice sessions" ON public.voice_coach_sessions;
CREATE POLICY "Users can manage own voice sessions"
ON public.voice_coach_sessions
FOR ALL USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user ON public.voice_coach_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_started ON public.voice_coach_sessions(started_at DESC);

-- ========================================
-- Fix 6: Create user_identity_profiles if missing (for AMIE themes)
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_identity_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  theme_id UUID,
  master_prompt TEXT,
  identity_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_identity_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own identity profiles" ON public.user_identity_profiles;
CREATE POLICY "Users can manage own identity profiles"
ON public.user_identity_profiles
FOR ALL USING (auth.uid() = user_id);

-- ========================================
-- Fix 7: Create motivational_themes if missing (for AMIE coach personalities)
-- ========================================
CREATE TABLE IF NOT EXISTS public.motivational_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  motivation_style TEXT,
  vocabulary_examples TEXT[],
  system_prompt_template TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default theme
INSERT INTO public.motivational_themes (name, display_name, motivation_style, vocabulary_examples)
VALUES (
  'amie_default',
  'AMIE Coach',
  'warm and encouraging',
  ARRAY['You''ve got this!', 'I believe in you.', 'Progress over perfection.', 'One step at a time.']
)
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- VERIFY: Check tables were created
-- ========================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%voice%';

-- ========================================
-- DONE!
-- ========================================
