-- ============================================
-- STORAGE BUCKET POLICIES
-- Migration: 20251203_storage_policy
-- Description: Ensures 'visions' bucket exists and is public
-- ============================================

-- 1. Create 'visions' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('visions', 'visions', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- 2. Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Public Read Access (Images are public)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'visions' );

-- 4. Policy: Authenticated Upload Access
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'visions' );

-- 5. Policy: Users can delete their own images (Optional but good practice)
-- Note: This assumes the file name or metadata might link to user, 
-- but for now we'll just allow authenticated users to delete if they uploaded it (owner)
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'visions' AND auth.uid() = owner );
