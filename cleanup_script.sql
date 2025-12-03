-- Cleanup Script for Vision Gallery
-- This script identifies and removes vision_boards entries with malformed URLs
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Step 1: Check how many corrupted entries exist
SELECT 
  COUNT(*) as total_corrupted_entries,
  COUNT(DISTINCT user_id) as affected_users
FROM vision_boards
WHERE 
  image_url NOT LIKE 'https://%' 
  OR image_url NOT LIKE '%supabase%';

-- Step 2: Preview the corrupted entries (limit 20 for review)
SELECT 
  id,
  user_id,
  image_url,
  prompt,
  created_at
FROM vision_boards
WHERE 
  image_url NOT LIKE 'https://%' 
  OR image_url NOT LIKE '%supabase%'
ORDER BY created_at DESC
LIMIT 20;

-- Step 3: BACKUP before deletion (optional but recommended)
-- Create a backup table with the corrupted data
CREATE TABLE IF NOT EXISTS vision_boards_corrupted_backup AS
SELECT 
  id,
  user_id,
  image_url,
  prompt,
  created_at,
  NOW() as backed_up_at
FROM vision_boards
WHERE 
  image_url NOT LIKE 'https://%' 
  OR image_url NOT LIKE '%supabase%';

-- Verify backup
SELECT COUNT(*) as backed_up_count FROM vision_boards_corrupted_backup;

-- Step 4: DELETE corrupted entries
-- UNCOMMENT THE FOLLOWING AFTER REVIEWING THE PREVIEW ABOVE
/*
DELETE FROM vision_boards
WHERE 
  image_url NOT LIKE 'https://%' 
  OR image_url NOT LIKE '%supabase%';
*/

-- Step 5: Verify cleanup
-- Run this after deletion to confirm
SELECT 
  COUNT(*) as total_entries,
  COUNT(CASE WHEN image_url LIKE 'https://%' AND image_url LIKE '%supabase%' THEN 1 END) as valid_entries,
  COUNT(CASE WHEN image_url NOT LIKE 'https://%' OR image_url NOT LIKE '%supabase%' THEN 1 END) as corrupted_entries
FROM vision_boards;

-- Optional: Drop the backup table if you no longer need it
-- DROP TABLE IF EXISTS vision_boards_corrupted_backup;
