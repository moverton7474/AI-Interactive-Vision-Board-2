-- =================================================================
-- CLEANUP SCRIPT: RESET VISION BOARDS
-- =================================================================
-- This script deletes all entries from the vision_boards table.
-- Use this to fix issues with broken images from legacy data or
-- invalid storage URLs.
--
-- WARNING: THIS WILL DELETE ALL USER VISION BOARDS.
-- =================================================================

TRUNCATE TABLE vision_boards CASCADE;

-- Note: This removes the database records. The actual files in 
-- Supabase Storage will remain but will be orphaned. 
-- This is safe and solves the UI "broken image" issue.
