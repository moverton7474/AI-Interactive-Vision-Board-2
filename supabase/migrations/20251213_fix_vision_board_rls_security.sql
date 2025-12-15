-- ============================================
-- CRITICAL SECURITY FIX: Vision Board RLS Policies
-- Date: 2025-12-13
-- Issue: Lisa seeing Milton's vision boards
-- Root Cause: Permissive USING (true) policies
-- ============================================

-- Step 1: Drop ALL existing permissive policies on vision_boards
DROP POLICY IF EXISTS "Allow public read VB" ON public.vision_boards;
DROP POLICY IF EXISTS "Allow public insert VB" ON public.vision_boards;
DROP POLICY IF EXISTS "Allow public delete VB" ON public.vision_boards;
DROP POLICY IF EXISTS "Allow public update VB" ON public.vision_boards;
DROP POLICY IF EXISTS "Users can manage own visions" ON public.vision_boards;
DROP POLICY IF EXISTS "Users can view own vision boards" ON public.vision_boards;
DROP POLICY IF EXISTS "Users can insert own vision boards" ON public.vision_boards;
DROP POLICY IF EXISTS "Users can update own vision boards" ON public.vision_boards;
DROP POLICY IF EXISTS "Users can delete own vision boards" ON public.vision_boards;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.vision_boards ENABLE ROW LEVEL SECURITY;

-- Step 3: Create STRICT user-scoped policies
CREATE POLICY "Users can view own vision boards"
ON public.vision_boards
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vision boards"
ON public.vision_boards
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vision boards"
ON public.vision_boards
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vision boards"
ON public.vision_boards
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Step 4: Add default for user_id if not exists (ensures new inserts get correct user_id)
ALTER TABLE public.vision_boards
ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Step 5: Fix reference_images table (same issue)
DROP POLICY IF EXISTS "Allow public read RI" ON public.reference_images;
DROP POLICY IF EXISTS "Allow public insert RI" ON public.reference_images;
DROP POLICY IF EXISTS "Allow public delete RI" ON public.reference_images;
DROP POLICY IF EXISTS "Users can manage own references" ON public.reference_images;

ALTER TABLE public.reference_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own references"
ON public.reference_images
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own references"
ON public.reference_images
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own references"
ON public.reference_images
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add default for user_id
ALTER TABLE public.reference_images
ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Step 6: Fix documents table (same issue)
DROP POLICY IF EXISTS "Allow public read Docs" ON public.documents;
DROP POLICY IF EXISTS "Allow public insert Docs" ON public.documents;
DROP POLICY IF EXISTS "Allow public delete Docs" ON public.documents;
DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
ON public.documents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
ON public.documents
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add default for user_id
ALTER TABLE public.documents
ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Step 7: Verify the fix
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('vision_boards', 'reference_images', 'documents')
ORDER BY tablename, policyname;

-- Step 8: Check for any vision_boards with NULL user_id (orphaned data)
SELECT id, prompt, created_at, user_id
FROM public.vision_boards
WHERE user_id IS NULL
LIMIT 10;
