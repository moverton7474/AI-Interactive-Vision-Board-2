-- ============================================
-- AI AGENT ASSISTANT DATABASE SCHEMA
-- Migration: 20241130_ai_agent_schema
-- Description: Adds tables for AI Agent features including
--              habits, streaks, check-ins, and agent conversations
-- ============================================

-- 1. Agent Sessions (Conversation Context)
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type TEXT CHECK (session_type IN ('voice', 'text', 'scheduled_call', 'push')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  context JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  summary TEXT,
  sentiment_score FLOAT,
  action_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Agent Messages (Conversation History)
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'agent', 'system')),
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'audio', 'action')),
  audio_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Communication Preferences
CREATE TABLE IF NOT EXISTS user_comm_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  phone_number TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  preferred_channel TEXT DEFAULT 'push' CHECK (preferred_channel IN ('voice', 'sms', 'email', 'push', 'in_app')),
  preferred_times JSONB DEFAULT '{"morning": true, "afternoon": false, "evening": true}',
  timezone TEXT DEFAULT 'America/New_York',
  weekly_review_day TEXT DEFAULT 'sunday',
  weekly_review_time TIME DEFAULT '09:00',
  voice_enabled BOOLEAN DEFAULT TRUE,
  call_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours JSONB DEFAULT '{"start": "22:00", "end": "07:00"}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habits (Micro Actions tied to Goals)
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID, -- References action_tasks if exists
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'weekdays', 'custom')),
  custom_days JSONB DEFAULT '[]',
  reminder_time TIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Habit Completions (For Streak Tracking)
CREATE TABLE IF NOT EXISTS habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  completed_at DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  mood_rating INT CHECK (mood_rating >= 1 AND mood_rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, completed_at)
);

-- 6. Streaks & Badges
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  value INT DEFAULT 1,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, achievement_key)
);

-- 7. Scheduled Check-ins
CREATE TABLE IF NOT EXISTS scheduled_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_type TEXT CHECK (checkin_type IN ('weekly_review', 'daily_habit', 'milestone_reminder', 'custom')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  channel TEXT DEFAULT 'push' CHECK (channel IN ('voice', 'sms', 'email', 'push', 'call')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed', 'skipped')),
  content JSONB DEFAULT '{}',
  response JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Agent Actions Log (Agentic Operations)
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_status TEXT DEFAULT 'pending' CHECK (action_status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  input_params JSONB DEFAULT '{}',
  output_result JSONB DEFAULT '{}',
  requires_approval BOOLEAN DEFAULT TRUE,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Weekly Review Summaries
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  wins JSONB DEFAULT '[]',
  blockers JSONB DEFAULT '[]',
  next_steps JSONB DEFAULT '[]',
  habit_completion_rate FLOAT,
  tasks_completed INT DEFAULT 0,
  tasks_total INT DEFAULT 0,
  mood_average FLOAT,
  ai_insights TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- 10. Predictive Analytics Cache
CREATE TABLE IF NOT EXISTS progress_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type TEXT,
  target_date DATE,
  current_pace FLOAT,
  predicted_completion_date DATE,
  confidence_score FLOAT,
  recommendations JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit ON habit_completions(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON habit_completions(completed_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_checkins_user_time ON scheduled_checkins(user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_checkins_status ON scheduled_checkins(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_agent_actions_user ON agent_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_week ON weekly_reviews(user_id, week_start);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_comm_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_predictions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users own their agent sessions" ON agent_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access their session messages" ON agent_messages
  FOR ALL USING (session_id IN (SELECT id FROM agent_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users own their preferences" ON user_comm_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their habits" ON habits
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access their habit completions" ON habit_completions
  FOR ALL USING (habit_id IN (SELECT id FROM habits WHERE user_id = auth.uid()));

CREATE POLICY "Users own their achievements" ON user_achievements
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their checkins" ON scheduled_checkins
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their agent actions" ON agent_actions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their reviews" ON weekly_reviews
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their predictions" ON progress_predictions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS FOR STREAK CALCULATION
-- ============================================

CREATE OR REPLACE FUNCTION calculate_streak(p_habit_id UUID)
RETURNS INT AS $$
DECLARE
  streak_count INT := 0;
  check_date DATE := CURRENT_DATE;
  has_completion BOOLEAN;
BEGIN
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM habit_completions
      WHERE habit_id = p_habit_id AND completed_at = check_date
    ) INTO has_completion;

    IF has_completion THEN
      streak_count := streak_count + 1;
      check_date := check_date - INTERVAL '1 day';
    ELSE
      -- Allow one day grace period (check yesterday if today not complete yet)
      IF check_date = CURRENT_DATE THEN
        check_date := check_date - INTERVAL '1 day';
      ELSE
        EXIT;
      END IF;
    END IF;
  END LOOP;

  RETURN streak_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update streak achievement when habit is completed
CREATE OR REPLACE FUNCTION update_streak_achievement()
RETURNS TRIGGER AS $$
DECLARE
  current_streak INT;
  habit_user_id UUID;
BEGIN
  -- Get habit owner and current streak
  SELECT user_id INTO habit_user_id FROM habits WHERE id = NEW.habit_id;
  SELECT calculate_streak(NEW.habit_id) INTO current_streak;

  -- Update or insert streak achievement
  INSERT INTO user_achievements (user_id, achievement_type, achievement_key, value)
  VALUES (habit_user_id, 'streak', 'habit_streak_' || NEW.habit_id::TEXT, current_streak)
  ON CONFLICT (user_id, achievement_key)
  DO UPDATE SET value = current_streak, earned_at = NOW();

  -- Check for milestone badges (7, 30, 100 days)
  IF current_streak = 7 THEN
    INSERT INTO user_achievements (user_id, achievement_type, achievement_key, value, metadata)
    VALUES (habit_user_id, 'badge', '7_day_streak', 1, jsonb_build_object('habit_id', NEW.habit_id))
    ON CONFLICT (user_id, achievement_key) DO NOTHING;
  ELSIF current_streak = 30 THEN
    INSERT INTO user_achievements (user_id, achievement_type, achievement_key, value, metadata)
    VALUES (habit_user_id, 'badge', '30_day_streak', 1, jsonb_build_object('habit_id', NEW.habit_id))
    ON CONFLICT (user_id, achievement_key) DO NOTHING;
  ELSIF current_streak = 100 THEN
    INSERT INTO user_achievements (user_id, achievement_type, achievement_key, value, metadata)
    VALUES (habit_user_id, 'badge', '100_day_streak', 1, jsonb_build_object('habit_id', NEW.habit_id))
    ON CONFLICT (user_id, achievement_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update streaks on habit completion
CREATE TRIGGER on_habit_completion
  AFTER INSERT ON habit_completions
  FOR EACH ROW
  EXECUTE FUNCTION update_streak_achievement();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE agent_sessions IS 'Stores conversation sessions between user and AI agent';
COMMENT ON TABLE agent_messages IS 'Individual messages within agent conversations';
COMMENT ON TABLE user_comm_preferences IS 'User preferences for how agent should communicate with them';
COMMENT ON TABLE habits IS 'Micro-habits tied to vision goals for daily tracking';
COMMENT ON TABLE habit_completions IS 'Log of habit completions for streak calculation';
COMMENT ON TABLE user_achievements IS 'Badges, streaks, and level achievements';
COMMENT ON TABLE scheduled_checkins IS 'Proactive check-ins scheduled by the agent';
COMMENT ON TABLE agent_actions IS 'Actions the agent takes on behalf of the user';
COMMENT ON TABLE weekly_reviews IS 'AI-generated weekly progress summaries';
COMMENT ON TABLE progress_predictions IS 'Predictive analytics for goal completion';
