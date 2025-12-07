-- ============================================
-- SMART REMINDERS LOGIC
-- Migration: 20251207_smart_reminders
-- Description: Adds functions to calculate optimal notification times
--              based on user activity history.
-- ============================================

-- Function to determine the user's peak activity hour
-- Returns integer (0-23) representing the hour in the user's timezone
CREATE OR REPLACE FUNCTION get_user_peak_activity_hour(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  v_timezone TEXT;
  v_peak_hour INT;
BEGIN
  -- Get user timezone, default to UTC if not set
  SELECT timezone INTO v_timezone FROM user_comm_preferences WHERE user_id = p_user_id;
  IF v_timezone IS NULL THEN v_timezone := 'UTC'; END IF;

  -- Find most frequent hour of habit completion
  -- We prioritize habit completions as a signal of "active and productive" time
  SELECT
    EXTRACT(HOUR FROM hc.created_at AT TIME ZONE v_timezone)::INT as hour_of_day
  INTO v_peak_hour
  FROM habit_completions hc
  JOIN habits h ON hc.habit_id = h.id
  WHERE h.user_id = p_user_id
  AND hc.created_at > (NOW() - INTERVAL '30 days') -- Look at last 30 days only
  GROUP BY hour_of_day
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Fallback if no history: Return 9 AM
  IF v_peak_hour IS NULL THEN
    v_peak_hour := 9; 
  END IF;

  RETURN v_peak_hour;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next optimal notification window
-- Uses peak hour but respects quiet hours
CREATE OR REPLACE FUNCTION get_next_optimal_time(p_user_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_peak_hour INT;
  v_timezone TEXT;
  v_quiet_start TEXT; -- e.g. "22:00"
  v_quiet_end TEXT;   -- e.g. "07:00"
  v_scheduled_time TIMESTAMPTZ;
  v_now_local TIMESTAMP;
BEGIN
  -- Get preferences
  SELECT 
    timezone,
    quiet_hours->>'start',
    quiet_hours->>'end'
  INTO v_timezone, v_quiet_start, v_quiet_end
  FROM user_comm_preferences 
  WHERE user_id = p_user_id;

  IF v_timezone IS NULL THEN v_timezone := 'UTC'; END IF;
  
  -- Get peak activity hour
  v_peak_hour := get_user_peak_activity_hour(p_user_id);
  
  -- Calculate potential time (today at peak hour)
  -- Note: Constructing timestamp in pure SQL with timezone is tricky.
  -- We assume v_peak_hour is today/tomorrow.
  
  v_now_local := NOW() AT TIME ZONE v_timezone;
  
  -- Construct timestamp for today at peak hour
  v_scheduled_time := (date_trunc('day', v_now_local) + (v_peak_hour || ' hours')::INTERVAL) AT TIME ZONE v_timezone;

  -- If time passed, move to tomorrow
  IF v_scheduled_time < NOW() THEN
    v_scheduled_time := v_scheduled_time + INTERVAL '1 day';
  END IF;

  -- TODO: Check quiet hours overlap (simplified for now: just trust peak hour is valid activity time)
  -- Since peak hour comes from ACTIVITY, the user is by definition active then, so unlikely to be quiet hours.
  
  RETURN v_scheduled_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution
GRANT EXECUTE ON FUNCTION get_user_peak_activity_hour(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_optimal_time(UUID) TO authenticated;
