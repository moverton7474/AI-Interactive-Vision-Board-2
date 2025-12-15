-- ============================================
-- DRAFT PLAN REVIEW FEATURE - DATABASE SCHEMA
-- Migration: 20251215_goal_plans_schema.sql
-- Version: 1.0
-- Description: Adds goal_plans table and extends action_tasks
--              for draft/active plan management with versioning
-- ============================================

-- ============================================
-- 1. GOAL PLANS TABLE
-- ============================================
-- Stores plan metadata with status (draft/active/archived)
-- Users can have multiple plans but only ONE active plan at a time

CREATE TABLE IF NOT EXISTS goal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan Status & Versioning
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  version INT NOT NULL DEFAULT 1,
  source TEXT DEFAULT 'onboarding' CHECK (source IN ('onboarding', 'manual', 'revision', 'ai_regenerate')),

  -- AI Context
  ai_insights JSONB DEFAULT '{}',

  -- Reference Data (from onboarding)
  vision_text TEXT,
  financial_target NUMERIC,
  theme_id UUID REFERENCES motivational_themes(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

-- Ensure only ONE active plan per user
CREATE UNIQUE INDEX IF NOT EXISTS goal_plans_one_active_per_user
ON goal_plans (user_id)
WHERE status = 'active';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_goal_plans_user ON goal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_plans_user_status ON goal_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_goal_plans_created ON goal_plans(created_at DESC);

-- ============================================
-- 2. EXTEND ACTION_TASKS TABLE
-- ============================================
-- Add columns for plan association, ordering, and priority
-- These are ADDITIVE changes - no existing data is modified

-- Add plan_id foreign key (nullable for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_tasks' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE action_tasks ADD COLUMN plan_id UUID REFERENCES goal_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add plan_version for tracking which version a task belongs to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_tasks' AND column_name = 'plan_version'
  ) THEN
    ALTER TABLE action_tasks ADD COLUMN plan_version INT DEFAULT 1;
  END IF;
END $$;

-- Add display_order for drag-drop reordering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_tasks' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE action_tasks ADD COLUMN display_order INT DEFAULT 0;
  END IF;
END $$;

-- Add priority column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_tasks' AND column_name = 'priority'
  ) THEN
    ALTER TABLE action_tasks ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'));
  END IF;
END $$;

-- Add source column to track where task came from
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_tasks' AND column_name = 'source'
  ) THEN
    ALTER TABLE action_tasks ADD COLUMN source TEXT DEFAULT 'manual' CHECK (source IN ('onboarding', 'manual', 'ai_regenerate', 'import'));
  END IF;
END $$;

-- Add migrated_to_plan_id for tracking backfill
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_tasks' AND column_name = 'migrated_to_plan_id'
  ) THEN
    ALTER TABLE action_tasks ADD COLUMN migrated_to_plan_id UUID;
  END IF;
END $$;

-- Index for plan lookups
CREATE INDEX IF NOT EXISTS idx_action_tasks_plan ON action_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_action_tasks_plan_order ON action_tasks(plan_id, display_order);

-- ============================================
-- 3. EXTEND USER_KNOWLEDGE_SOURCES FOR SOFT DELETE
-- ============================================

-- Add archived flag for soft delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_knowledge_sources' AND column_name = 'archived'
  ) THEN
    ALTER TABLE user_knowledge_sources ADD COLUMN archived BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add archived_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_knowledge_sources' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE user_knowledge_sources ADD COLUMN archived_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add goal_plan_id to link KB entries to plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_knowledge_sources' AND column_name = 'goal_plan_id'
  ) THEN
    ALTER TABLE user_knowledge_sources ADD COLUMN goal_plan_id UUID REFERENCES goal_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for archived filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_archived ON user_knowledge_sources(user_id, archived);

-- ============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on goal_plans
ALTER TABLE goal_plans ENABLE ROW LEVEL SECURITY;

-- Users can view their own plans
DROP POLICY IF EXISTS "Users can view own plans" ON goal_plans;
CREATE POLICY "Users can view own plans" ON goal_plans
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own plans
DROP POLICY IF EXISTS "Users can insert own plans" ON goal_plans;
CREATE POLICY "Users can insert own plans" ON goal_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own plans
DROP POLICY IF EXISTS "Users can update own plans" ON goal_plans;
CREATE POLICY "Users can update own plans" ON goal_plans
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own DRAFT plans only
DROP POLICY IF EXISTS "Users can delete own draft plans" ON goal_plans;
CREATE POLICY "Users can delete own draft plans" ON goal_plans
  FOR DELETE USING (auth.uid() = user_id AND status = 'draft');

-- ============================================
-- 5. TRIGGER FOR UPDATED_AT
-- ============================================

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_goal_plans_updated_at ON goal_plans;
CREATE TRIGGER update_goal_plans_updated_at
  BEFORE UPDATE ON goal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Function to get user's active plan with tasks
CREATE OR REPLACE FUNCTION get_active_plan_with_tasks(p_user_id UUID)
RETURNS TABLE (
  plan_id UUID,
  plan_status TEXT,
  plan_version INT,
  plan_approved_at TIMESTAMPTZ,
  vision_text TEXT,
  financial_target NUMERIC,
  tasks JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gp.id,
    gp.status,
    gp.version,
    gp.approved_at,
    gp.vision_text,
    gp.financial_target,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', at.id,
          'title', at.title,
          'description', at.description,
          'due_date', at.due_date,
          'type', at.type,
          'priority', at.priority,
          'is_completed', at.is_completed,
          'display_order', at.display_order
        ) ORDER BY at.display_order
      ) FILTER (WHERE at.id IS NOT NULL),
      '[]'::jsonb
    ) as tasks
  FROM goal_plans gp
  LEFT JOIN action_tasks at ON at.plan_id = gp.id
  WHERE gp.user_id = p_user_id
    AND gp.status = 'active'
  GROUP BY gp.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve a draft plan (atomic operation)
CREATE OR REPLACE FUNCTION approve_goal_plan(p_plan_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan_exists BOOLEAN;
BEGIN
  -- Verify plan exists and is a draft owned by user
  SELECT EXISTS(
    SELECT 1 FROM goal_plans
    WHERE id = p_plan_id
      AND user_id = p_user_id
      AND status = 'draft'
  ) INTO v_plan_exists;

  IF NOT v_plan_exists THEN
    RAISE EXCEPTION 'Plan not found, not a draft, or not owned by user';
  END IF;

  -- Archive any existing active plan
  UPDATE goal_plans
  SET status = 'archived', archived_at = NOW()
  WHERE user_id = p_user_id AND status = 'active';

  -- Approve the draft plan
  UPDATE goal_plans
  SET status = 'active', approved_at = NOW(), updated_at = NOW()
  WHERE id = p_plan_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_active_plan_with_tasks(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_goal_plan(UUID, UUID) TO authenticated;

-- ============================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE goal_plans IS 'Stores goal plan metadata with draft/active/archived status and versioning';
COMMENT ON COLUMN goal_plans.status IS 'Plan status: draft (editing), active (approved), archived (superseded)';
COMMENT ON COLUMN goal_plans.version IS 'Incrementing version number per user';
COMMENT ON COLUMN goal_plans.ai_insights IS 'AI-generated insights about the plan';
COMMENT ON COLUMN goal_plans.approved_at IS 'When user approved the plan (null for drafts)';

COMMENT ON COLUMN action_tasks.plan_id IS 'FK to goal_plans - groups tasks into plans';
COMMENT ON COLUMN action_tasks.priority IS 'Task priority: high, medium, low';
COMMENT ON COLUMN action_tasks.display_order IS 'Order for display/drag-drop sorting';
COMMENT ON COLUMN action_tasks.source IS 'Where task originated: onboarding, manual, ai_regenerate';

COMMENT ON COLUMN user_knowledge_sources.archived IS 'Soft delete flag - true means archived';
COMMENT ON COLUMN user_knowledge_sources.goal_plan_id IS 'Link to goal plan if this source represents a plan';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 1 (goal_plans)
-- Columns added: 6 to action_tasks, 3 to user_knowledge_sources
-- Indexes created: 6
-- RLS policies: 4
-- Functions: 2
-- ============================================
