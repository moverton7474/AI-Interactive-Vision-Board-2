-- ============================================
-- FIX TEAM MEMBER MANAGEMENT
-- Migration: 20251215_fix_team_member_management.sql
--
-- Fixes:
-- 1. Adds missing activity tracking columns to team_members
-- 2. Creates helper function to get user's team IDs (avoids recursion)
-- 3. Updates RLS policies to allow team members to see teammates
-- 4. Creates function to sync activity from habits table
-- ============================================

-- ============================================
-- 1. ADD MISSING COLUMNS TO team_members
-- ============================================

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS weekly_completions INT DEFAULT 0;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS total_habits INT DEFAULT 0;

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS completion_rate DECIMAL(5,2) DEFAULT 0;

-- Add index for activity queries
CREATE INDEX IF NOT EXISTS idx_team_members_last_active
ON team_members(last_active_at DESC)
WHERE is_active = TRUE;

-- ============================================
-- 2. CREATE HELPER FUNCTION FOR TEAM IDs
-- (Security Definer to avoid RLS recursion)
-- ============================================

CREATE OR REPLACE FUNCTION get_user_team_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
  SELECT team_id
  FROM team_members
  WHERE user_id = p_user_id
    AND is_active = TRUE;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_team_ids IS
'Returns team IDs for a user. Used by RLS policies to avoid recursion.';

-- ============================================
-- 3. FIX RLS POLICIES FOR team_members
-- Allow team members to view their teammates
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own team membership" ON team_members;
DROP POLICY IF EXISTS "Team members can view teammates" ON team_members;

-- Create new policy that allows viewing all teammates
CREATE POLICY "Team members can view teammates"
  ON team_members FOR SELECT
  USING (
    -- User can see their own membership
    user_id = auth.uid()
    -- OR user is in the same team (uses helper function to avoid recursion)
    OR team_id IN (SELECT get_user_team_ids(auth.uid()))
    -- OR user is platform admin
    OR is_platform_admin()
  );

-- ============================================
-- 4. CREATE ACTIVITY SYNC FUNCTION
-- Syncs habit data to team_members for dashboard
-- ============================================

CREATE OR REPLACE FUNCTION sync_team_member_activity(p_user_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_user_id UUID;
  v_team_member RECORD;
BEGIN
  -- If no user specified, sync all active team members
  FOR v_team_member IN
    SELECT tm.id, tm.user_id
    FROM team_members tm
    WHERE tm.is_active = TRUE
      AND (p_user_id IS NULL OR tm.user_id = p_user_id)
  LOOP
    -- Calculate stats from habits table
    UPDATE team_members tm
    SET
      current_streak = COALESCE((
        SELECT MAX(h.current_streak)
        FROM habits h
        WHERE h.user_id = tm.user_id AND h.is_active = TRUE
      ), 0),
      total_habits = COALESCE((
        SELECT COUNT(*)
        FROM habits h
        WHERE h.user_id = tm.user_id AND h.is_active = TRUE
      ), 0),
      weekly_completions = COALESCE((
        SELECT COUNT(*)
        FROM habit_completions hc
        JOIN habits h ON h.id = hc.habit_id
        WHERE h.user_id = tm.user_id
          AND hc.completed_at >= date_trunc('week', CURRENT_DATE)
      ), 0),
      completion_rate = COALESCE((
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((COUNT(CASE WHEN hc.id IS NOT NULL THEN 1 END)::DECIMAL /
                      (COUNT(*) * 7)) * 100, 2)
        END
        FROM habits h
        LEFT JOIN habit_completions hc ON hc.habit_id = h.id
          AND hc.completed_at >= date_trunc('week', CURRENT_DATE)
        WHERE h.user_id = tm.user_id AND h.is_active = TRUE
      ), 0),
      last_active_at = COALESCE((
        SELECT MAX(hc.completed_at)
        FROM habit_completions hc
        JOIN habits h ON h.id = hc.habit_id
        WHERE h.user_id = tm.user_id
      ), tm.joined_at)
    WHERE tm.id = v_team_member.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_team_member_activity IS
'Syncs habit statistics to team_members table for dashboard display.';

-- ============================================
-- 5. CREATE TRIGGER TO AUTO-UPDATE ON HABIT COMPLETION
-- ============================================

CREATE OR REPLACE FUNCTION trigger_sync_team_member_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the user_id from the habit
  SELECT user_id INTO v_user_id
  FROM habits
  WHERE id = NEW.habit_id;

  -- Update last_active_at immediately
  UPDATE team_members
  SET last_active_at = NOW()
  WHERE user_id = v_user_id AND is_active = TRUE;

  -- Schedule full stats sync (could be async in production)
  PERFORM sync_team_member_activity(v_user_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on habit_completions
DROP TRIGGER IF EXISTS sync_activity_on_completion ON habit_completions;
CREATE TRIGGER sync_activity_on_completion
  AFTER INSERT ON habit_completions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_team_member_on_completion();

-- ============================================
-- 6. INITIAL SYNC - Populate existing data
-- ============================================

-- Run initial sync for all team members
SELECT sync_team_member_activity();

-- ============================================
-- 7. SET OWNER last_active_at TO NOW IF NULL
-- ============================================

UPDATE team_members
SET last_active_at = COALESCE(last_active_at, joined_at, NOW())
WHERE last_active_at IS NULL;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Changes:
-- - Added 5 columns to team_members for activity tracking
-- - Created get_user_team_ids() helper function
-- - Updated RLS policy to allow viewing teammates
-- - Created sync_team_member_activity() function
-- - Created auto-sync trigger on habit completions
-- - Ran initial data sync
-- ============================================
