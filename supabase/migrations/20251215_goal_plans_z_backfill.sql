-- ============================================
-- DRAFT PLAN REVIEW FEATURE - BACKFILL SCRIPT
-- Migration: 20251215_goal_plans_backfill.sql
-- Version: 1.0
-- Description: Backfills goal_plans for existing users who have
--              action_tasks but no goal_plan record
--
-- IMPORTANT: Run this AFTER 20251215_goal_plans_schema.sql
-- ============================================

-- ============================================
-- 1. BACKFILL GOAL_PLANS FOR EXISTING USERS
-- ============================================
-- For each user with action_tasks but no goal_plan:
-- - Create an 'active' goal_plan (grandfather existing tasks)
-- - Set approved_at to the earliest task creation date
-- - Set source to 'onboarding' (most likely origin)

INSERT INTO goal_plans (
  user_id,
  status,
  version,
  source,
  ai_insights,
  created_at,
  approved_at
)
SELECT DISTINCT ON (at.user_id)
  at.user_id,
  'active'::TEXT,
  1,
  'onboarding'::TEXT,
  jsonb_build_object(
    'backfilled', true,
    'backfill_date', NOW()::TEXT,
    'original_task_count', (
      SELECT COUNT(*) FROM action_tasks at2 WHERE at2.user_id = at.user_id
    )
  ),
  MIN(at.created_at) OVER (PARTITION BY at.user_id),
  MIN(at.created_at) OVER (PARTITION BY at.user_id)
FROM action_tasks at
WHERE at.user_id IS NOT NULL
  AND at.plan_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM goal_plans gp WHERE gp.user_id = at.user_id
  )
GROUP BY at.user_id, at.created_at
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. LINK EXISTING TASKS TO THEIR NEW PLANS
-- ============================================
-- Update action_tasks to reference their new goal_plan

UPDATE action_tasks at
SET
  plan_id = gp.id,
  plan_version = 1,
  source = 'onboarding',
  migrated_to_plan_id = gp.id
FROM goal_plans gp
WHERE at.user_id = gp.user_id
  AND gp.status = 'active'
  AND at.plan_id IS NULL;

-- ============================================
-- 3. SET DEFAULT PRIORITIES BASED ON TYPE
-- ============================================
-- Update tasks that don't have a priority set

UPDATE action_tasks
SET priority = CASE
  WHEN type = 'FINANCE' THEN 'high'
  WHEN type = 'LIFESTYLE' THEN 'medium'
  ELSE 'medium'
END
WHERE priority IS NULL OR priority = '';

-- ============================================
-- 4. SET DISPLAY ORDER
-- ============================================
-- Set display_order based on due_date for consistent ordering

WITH ordered_tasks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY plan_id
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    ) - 1 as new_order
  FROM action_tasks
  WHERE plan_id IS NOT NULL
)
UPDATE action_tasks at
SET display_order = ot.new_order
FROM ordered_tasks ot
WHERE at.id = ot.id
  AND (at.display_order IS NULL OR at.display_order = 0);

-- ============================================
-- 5. VERIFICATION QUERIES (FOR MANUAL CHECK)
-- ============================================
-- Uncomment these to verify the backfill results:

-- Check how many plans were created
-- SELECT 'Plans created' as metric, COUNT(*) as count FROM goal_plans WHERE ai_insights->>'backfilled' = 'true';

-- Check how many tasks were linked
-- SELECT 'Tasks linked' as metric, COUNT(*) as count FROM action_tasks WHERE migrated_to_plan_id IS NOT NULL;

-- Check for any orphaned tasks (should be 0 after backfill)
-- SELECT 'Orphaned tasks' as metric, COUNT(*) as count FROM action_tasks WHERE user_id IS NOT NULL AND plan_id IS NULL;

-- List users with their plan counts
-- SELECT
--   u.id,
--   u.email,
--   (SELECT COUNT(*) FROM goal_plans WHERE user_id = u.id) as plan_count,
--   (SELECT COUNT(*) FROM action_tasks WHERE user_id = u.id) as task_count
-- FROM auth.users u
-- WHERE EXISTS (SELECT 1 FROM action_tasks WHERE user_id = u.id)
-- ORDER BY task_count DESC
-- LIMIT 20;

-- ============================================
-- BACKFILL COMPLETE
-- ============================================
-- This script is IDEMPOTENT - safe to run multiple times
-- Uses ON CONFLICT DO NOTHING and WHERE NOT EXISTS checks
-- ============================================
