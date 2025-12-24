-- ============================================
-- LAST MILE UI INTEGRATION - DATABASE SCHEMA
-- Migration: 20251224_last_mile_ui_integration.sql
-- Version: 1.0
-- Description: Ensures all tables and functions exist for:
--              - GoalEditorPage (action_tasks)
--              - ProgressPredictionWidget (progress_predictions)
--              - AchievementGallery (user_achievements)
-- ============================================

-- ============================================
-- 1. ENSURE ACTION_TASKS TABLE EXISTS
-- ============================================
-- This table may already exist from SUPABASE_SCHEMA.sql, but ensure it exists

CREATE TABLE IF NOT EXISTS public.action_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  type TEXT NOT NULL DEFAULT 'ADMIN' CHECK (type IN ('FINANCE', 'LIFESTYLE', 'ADMIN')),
  is_completed BOOLEAN DEFAULT FALSE,
  milestone_year INT,
  ai_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns from goal_plans_schema if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_tasks' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE public.action_tasks ADD COLUMN plan_id UUID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_tasks' AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.action_tasks ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_tasks' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE public.action_tasks ADD COLUMN display_order INT DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_tasks' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.action_tasks ADD COLUMN source TEXT DEFAULT 'manual';
  END IF;
END $$;

-- ============================================
-- 2. ENSURE PROGRESS_PREDICTIONS TABLE EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.progress_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,
  target_date DATE,
  current_pace FLOAT DEFAULT 0, -- 0 to 1+ (above 1 = ahead of schedule)
  predicted_completion_date DATE,
  confidence_score FLOAT DEFAULT 0.5,
  recommendations JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for user lookups
CREATE INDEX IF NOT EXISTS idx_progress_predictions_user ON progress_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_predictions_calculated ON progress_predictions(user_id, calculated_at DESC);

-- ============================================
-- 3. ENSURE USER_ACHIEVEMENTS TABLE EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL CHECK (achievement_type IN ('streak', 'badge', 'level')),
  achievement_key TEXT NOT NULL,
  value INT DEFAULT 1,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, achievement_key)
);

-- Add index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_key ON user_achievements(user_id, achievement_key);

-- ============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.action_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Action Tasks RLS
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.action_tasks;
CREATE POLICY "Users can manage own tasks"
ON public.action_tasks
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Progress Predictions RLS
DROP POLICY IF EXISTS "Users can view own predictions" ON public.progress_predictions;
CREATE POLICY "Users can view own predictions"
ON public.progress_predictions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage predictions" ON public.progress_predictions;
CREATE POLICY "Service role can manage predictions"
ON public.progress_predictions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- User Achievements RLS
DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;
CREATE POLICY "Users can view own achievements"
ON public.user_achievements
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage achievements" ON public.user_achievements;
CREATE POLICY "Service role can manage achievements"
ON public.user_achievements
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 5. FUNCTION: Generate/Update Progress Predictions
-- ============================================
-- This function calculates progress predictions based on user activity

CREATE OR REPLACE FUNCTION calculate_user_progress_prediction(
  p_user_id UUID,
  p_goal_type TEXT DEFAULT 'general'
)
RETURNS UUID AS $$
DECLARE
  v_prediction_id UUID;
  v_total_tasks INT;
  v_completed_tasks INT;
  v_task_completion_rate FLOAT;
  v_habit_completion_rate FLOAT;
  v_total_habits INT;
  v_completed_habits_today INT;
  v_current_pace FLOAT;
  v_confidence FLOAT;
  v_target_date DATE;
  v_predicted_date DATE;
  v_recommendations JSONB := '[]';
BEGIN
  -- Calculate task completion rate (last 30 days)
  SELECT
    COUNT(*),
    COALESCE(SUM(CASE WHEN is_completed THEN 1 ELSE 0 END), 0)
  INTO v_total_tasks, v_completed_tasks
  FROM action_tasks
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '30 days';

  IF v_total_tasks > 0 THEN
    v_task_completion_rate := v_completed_tasks::FLOAT / v_total_tasks;
  ELSE
    v_task_completion_rate := 0.5; -- Default
  END IF;

  -- Calculate habit completion rate (last 7 days)
  SELECT COUNT(*) INTO v_total_habits
  FROM habits
  WHERE user_id = p_user_id AND is_active = TRUE;

  SELECT COUNT(*) INTO v_completed_habits_today
  FROM habit_completions hc
  JOIN habits h ON h.id = hc.habit_id
  WHERE h.user_id = p_user_id
    AND hc.completed_at > NOW() - INTERVAL '7 days';

  IF v_total_habits > 0 THEN
    v_habit_completion_rate := LEAST(v_completed_habits_today::FLOAT / (v_total_habits * 7), 1.0);
  ELSE
    v_habit_completion_rate := 0.5; -- Default
  END IF;

  -- Calculate overall pace (weighted average)
  v_current_pace := (v_task_completion_rate * 0.6) + (v_habit_completion_rate * 0.4);

  -- Calculate confidence based on data availability
  v_confidence := LEAST(0.9, 0.3 + (v_total_tasks * 0.05) + (v_completed_habits_today * 0.03));

  -- Set target and predicted dates
  v_target_date := (NOW() + INTERVAL '1 year')::DATE;

  IF v_current_pace >= 1.0 THEN
    v_predicted_date := (NOW() + INTERVAL '10 months')::DATE;
  ELSIF v_current_pace >= 0.7 THEN
    v_predicted_date := (NOW() + INTERVAL '14 months')::DATE;
  ELSE
    v_predicted_date := (NOW() + INTERVAL '18 months')::DATE;
  END IF;

  -- Generate recommendations
  IF v_current_pace < 0.7 THEN
    v_recommendations := jsonb_build_array(
      'Consider breaking down tasks into smaller, more manageable pieces',
      'Try to complete at least one habit daily to build momentum',
      'Review your goals weekly to stay aligned with your vision'
    );
  ELSIF v_current_pace < 1.0 THEN
    v_recommendations := jsonb_build_array(
      'You''re making progress! Stay consistent with your habits',
      'Consider adding one more high-priority task this week',
      'Celebrate small wins to maintain motivation'
    );
  ELSE
    v_recommendations := jsonb_build_array(
      'Excellent progress! You''re ahead of schedule',
      'Consider setting more ambitious goals',
      'Share your success with your accountability partner'
    );
  END IF;

  -- Upsert the prediction
  INSERT INTO progress_predictions (
    user_id,
    goal_type,
    target_date,
    current_pace,
    predicted_completion_date,
    confidence_score,
    recommendations,
    calculated_at
  )
  VALUES (
    p_user_id,
    p_goal_type,
    v_target_date,
    v_current_pace,
    v_predicted_date,
    v_confidence,
    v_recommendations,
    NOW()
  )
  ON CONFLICT (user_id, goal_type)
  DO UPDATE SET
    target_date = EXCLUDED.target_date,
    current_pace = EXCLUDED.current_pace,
    predicted_completion_date = EXCLUDED.predicted_completion_date,
    confidence_score = EXCLUDED.confidence_score,
    recommendations = EXCLUDED.recommendations,
    calculated_at = NOW()
  RETURNING id INTO v_prediction_id;

  RETURN v_prediction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'progress_predictions_user_goal_unique'
  ) THEN
    ALTER TABLE progress_predictions
    ADD CONSTRAINT progress_predictions_user_goal_unique
    UNIQUE (user_id, goal_type);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- ============================================
-- 6. FUNCTION: Award Achievement
-- ============================================

CREATE OR REPLACE FUNCTION award_achievement(
  p_user_id UUID,
  p_achievement_key TEXT,
  p_achievement_type TEXT DEFAULT 'badge',
  p_value INT DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_achievement_id UUID;
BEGIN
  INSERT INTO user_achievements (
    user_id,
    achievement_type,
    achievement_key,
    value,
    metadata,
    earned_at
  )
  VALUES (
    p_user_id,
    p_achievement_type,
    p_achievement_key,
    p_value,
    p_metadata,
    NOW()
  )
  ON CONFLICT (user_id, achievement_key)
  DO UPDATE SET
    value = GREATEST(user_achievements.value, EXCLUDED.value),
    metadata = user_achievements.metadata || EXCLUDED.metadata
  RETURNING id INTO v_achievement_id;

  RETURN v_achievement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. FUNCTION: Check and Award Streak Achievements
-- ============================================

CREATE OR REPLACE FUNCTION check_streak_achievements(p_user_id UUID, p_current_streak INT)
RETURNS VOID AS $$
BEGIN
  -- 7-day streak
  IF p_current_streak >= 7 THEN
    PERFORM award_achievement(
      p_user_id,
      '7_day_streak',
      'streak',
      p_current_streak,
      jsonb_build_object('streak_days', p_current_streak, 'achieved_at', NOW())
    );
  END IF;

  -- 30-day streak
  IF p_current_streak >= 30 THEN
    PERFORM award_achievement(
      p_user_id,
      '30_day_streak',
      'streak',
      p_current_streak,
      jsonb_build_object('streak_days', p_current_streak, 'achieved_at', NOW())
    );
  END IF;

  -- 100-day streak
  IF p_current_streak >= 100 THEN
    PERFORM award_achievement(
      p_user_id,
      '100_day_streak',
      'streak',
      p_current_streak,
      jsonb_build_object('streak_days', p_current_streak, 'achieved_at', NOW())
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. TRIGGER: Auto-generate predictions on task completion
-- ============================================

CREATE OR REPLACE FUNCTION trigger_update_predictions_on_task()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate predictions when a task is completed
  IF NEW.is_completed = TRUE AND (OLD.is_completed IS NULL OR OLD.is_completed = FALSE) THEN
    PERFORM calculate_user_progress_prediction(NEW.user_id, 'general');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_predictions_on_task_complete ON action_tasks;
CREATE TRIGGER update_predictions_on_task_complete
  AFTER UPDATE ON action_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_predictions_on_task();

-- ============================================
-- 9. TRIGGER: Award first vision achievement
-- ============================================

CREATE OR REPLACE FUNCTION trigger_award_first_vision()
RETURNS TRIGGER AS $$
BEGIN
  -- Award "first_vision" badge when user creates their first vision board
  PERFORM award_achievement(
    NEW.user_id,
    'first_vision',
    'badge',
    1,
    jsonb_build_object('vision_id', NEW.id, 'created_at', NOW())
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS award_first_vision_badge ON vision_boards;
CREATE TRIGGER award_first_vision_badge
  AFTER INSERT ON vision_boards
  FOR EACH ROW
  EXECUTE FUNCTION trigger_award_first_vision();

-- ============================================
-- 10. TRIGGER: Award first goal achievement
-- ============================================

CREATE OR REPLACE FUNCTION trigger_award_first_goal()
RETURNS TRIGGER AS $$
BEGIN
  -- Award "first_goal" badge when user creates their first task
  PERFORM award_achievement(
    NEW.user_id,
    'first_goal',
    'badge',
    1,
    jsonb_build_object('task_id', NEW.id, 'created_at', NOW())
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS award_first_goal_badge ON action_tasks;
CREATE TRIGGER award_first_goal_badge
  AFTER INSERT ON action_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_award_first_goal();

-- ============================================
-- 11. TRIGGER: Award action plan achievement
-- ============================================

CREATE OR REPLACE FUNCTION trigger_award_action_plan()
RETURNS TRIGGER AS $$
DECLARE
  v_task_count INT;
BEGIN
  -- Check if user now has 3+ tasks (action plan generated)
  SELECT COUNT(*) INTO v_task_count
  FROM action_tasks
  WHERE user_id = NEW.user_id;

  IF v_task_count >= 3 THEN
    PERFORM award_achievement(
      NEW.user_id,
      'action_plan',
      'badge',
      v_task_count,
      jsonb_build_object('task_count', v_task_count, 'created_at', NOW())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS award_action_plan_badge ON action_tasks;
CREATE TRIGGER award_action_plan_badge
  AFTER INSERT ON action_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_award_action_plan();

-- ============================================
-- 12. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION calculate_user_progress_prediction(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION award_achievement(UUID, TEXT, TEXT, INT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION check_streak_achievements(UUID, INT) TO service_role;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables ensured: 3 (action_tasks, progress_predictions, user_achievements)
-- Columns added: 4 to action_tasks (if missing)
-- Indexes created: 4
-- RLS policies: 6
-- Functions: 4
-- Triggers: 4
-- ============================================
