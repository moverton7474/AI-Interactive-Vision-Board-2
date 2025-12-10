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
-- VERIFY: Check the habits table structure
-- ========================================
-- Run this to verify the column was added:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'habits';

-- ========================================
-- DONE!
-- ========================================
