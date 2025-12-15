-- ============================================================================
-- EMAIL SYSTEM MIGRATION
-- ============================================================================
-- This migration sets up the complete email infrastructure for:
-- Phase 1: Signup confirmations (Supabase Auth handles this)
-- Phase 2: Transactional emails (welcome, password reset, security alerts)
-- Phase 3: AI Coach emails (weekly reviews, milestones, habit reminders)
-- ============================================================================

-- ============================================================================
-- 1. EMAIL LOGS TABLE
-- ============================================================================
-- Track all sent emails for analytics, debugging, and compliance

CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    to_email TEXT NOT NULL,
    template TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced', 'delivered', 'opened', 'clicked')),
    resend_id TEXT, -- ID from Resend API for tracking
    error TEXT,
    metadata JSONB DEFAULT '{}', -- Additional context data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
-- Index for querying by template
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template);
-- Index for querying by status
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

-- RLS policies for email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own email logs
CREATE POLICY "Users can view own email logs"
ON email_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to email_logs"
ON email_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 2. EMAIL PREFERENCES TABLE
-- ============================================================================
-- User preferences for email communications

CREATE TABLE IF NOT EXISTS email_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Email categories opt-in/out
    marketing_emails BOOLEAN DEFAULT true,
    weekly_review_emails BOOLEAN DEFAULT true,
    milestone_emails BOOLEAN DEFAULT true,
    habit_reminder_emails BOOLEAN DEFAULT false, -- Off by default (push preferred)
    streak_emails BOOLEAN DEFAULT true,
    pace_warning_emails BOOLEAN DEFAULT true,
    security_emails BOOLEAN DEFAULT true, -- Cannot be disabled

    -- Digest preferences
    digest_frequency TEXT DEFAULT 'weekly' CHECK (digest_frequency IN ('daily', 'weekly', 'monthly', 'never')),
    digest_day TEXT DEFAULT 'sunday' CHECK (digest_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    digest_time TIME DEFAULT '09:00',

    -- Unsubscribe tracking
    unsubscribed_at TIMESTAMPTZ,
    unsubscribe_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id ON email_preferences(user_id);

-- RLS policies
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email preferences"
ON email_preferences FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access to email_preferences"
ON email_preferences FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 3. EMAIL QUEUE TABLE (for scheduled/batch emails)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_email TEXT NOT NULL,
    template TEXT NOT NULL,
    template_data JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = highest
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for processing queue
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled
ON email_queue(status, scheduled_for)
WHERE status = 'pending';

-- Index for user emails
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);

-- RLS policies
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to email_queue"
ON email_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 4. TRIGGER FUNCTION: Auto-create email preferences for new users
-- ============================================================================

CREATE OR REPLACE FUNCTION create_email_preferences_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO email_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created_email_prefs ON auth.users;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created_email_prefs
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_email_preferences_for_new_user();

-- ============================================================================
-- 5. TRIGGER FUNCTION: Queue welcome email on new user signup
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
BEGIN
    -- Get user's name from profiles if exists
    SELECT names INTO user_name FROM profiles WHERE id = NEW.id;

    -- Queue welcome email (will be sent by edge function)
    INSERT INTO email_queue (
        user_id,
        to_email,
        template,
        template_data,
        priority,
        scheduled_for
    ) VALUES (
        NEW.id,
        NEW.email,
        'welcome',
        jsonb_build_object(
            'name', COALESCE(user_name, split_part(NEW.email, '@', 1)),
            'email', NEW.email
        ),
        1, -- High priority
        NOW() + INTERVAL '1 minute' -- Slight delay to ensure profile is created
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created_welcome_email ON auth.users;

-- Create trigger for welcome emails
CREATE TRIGGER on_auth_user_created_welcome_email
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION queue_welcome_email();

-- ============================================================================
-- 6. FUNCTION: Queue weekly review emails
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_weekly_review_emails()
RETURNS void AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Find users who should receive weekly review emails today
    FOR user_record IN
        SELECT
            p.id as user_id,
            p.email,
            p.names,
            ep.digest_time
        FROM profiles p
        JOIN email_preferences ep ON ep.user_id = p.id
        WHERE ep.weekly_review_emails = true
        AND ep.digest_day = LOWER(to_char(NOW(), 'day'))
        AND ep.unsubscribed_at IS NULL
    LOOP
        -- Queue the weekly review email
        INSERT INTO email_queue (
            user_id,
            to_email,
            template,
            template_data,
            priority,
            scheduled_for
        ) VALUES (
            user_record.user_id,
            user_record.email,
            'weekly_review',
            jsonb_build_object('name', COALESCE(user_record.names, 'Visionary')),
            3, -- Medium-high priority
            (CURRENT_DATE + user_record.digest_time)::timestamptz
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. FUNCTION: Queue milestone celebration email
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_milestone_email()
RETURNS TRIGGER AS $$
DECLARE
    user_email TEXT;
    user_name TEXT;
    goal_title TEXT;
    prefs_ok BOOLEAN;
BEGIN
    -- Only trigger when milestone is completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Get user info
        SELECT email, names INTO user_email, user_name
        FROM profiles WHERE id = NEW.user_id;

        -- Check email preferences
        SELECT milestone_emails INTO prefs_ok
        FROM email_preferences
        WHERE user_id = NEW.user_id;

        IF prefs_ok = true OR prefs_ok IS NULL THEN
            -- Get goal title
            SELECT title INTO goal_title FROM goals WHERE id = NEW.goal_id;

            -- Queue the celebration email
            INSERT INTO email_queue (
                user_id,
                to_email,
                template,
                template_data,
                priority
            ) VALUES (
                NEW.user_id,
                user_email,
                'milestone_celebration',
                jsonb_build_object(
                    'name', COALESCE(user_name, 'Visionary'),
                    'milestoneTitle', NEW.title,
                    'goalTitle', goal_title
                ),
                2 -- High priority
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_milestone_completed_email ON milestones;

-- Create trigger (only if milestones table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'milestones') THEN
        CREATE TRIGGER on_milestone_completed_email
            AFTER UPDATE ON milestones
            FOR EACH ROW
            EXECUTE FUNCTION queue_milestone_email();
    END IF;
END $$;

-- ============================================================================
-- 8. FUNCTION: Queue streak milestone email
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_streak_milestone_email()
RETURNS TRIGGER AS $$
DECLARE
    user_email TEXT;
    user_name TEXT;
    habit_title TEXT;
    prefs_ok BOOLEAN;
BEGIN
    -- Only trigger for significant streak milestones: 7, 30, 100 days
    IF NEW.current_streak IN (7, 30, 100) AND
       (OLD.current_streak IS NULL OR OLD.current_streak != NEW.current_streak) THEN

        -- Get user info
        SELECT email, names INTO user_email, user_name
        FROM profiles WHERE id = NEW.user_id;

        -- Check email preferences
        SELECT streak_emails INTO prefs_ok
        FROM email_preferences
        WHERE user_id = NEW.user_id;

        IF prefs_ok = true OR prefs_ok IS NULL THEN
            -- Get habit title
            SELECT title INTO habit_title FROM habits WHERE id = NEW.habit_id;

            -- Queue the streak email
            INSERT INTO email_queue (
                user_id,
                to_email,
                template,
                template_data,
                priority
            ) VALUES (
                NEW.user_id,
                user_email,
                'streak_milestone',
                jsonb_build_object(
                    'name', COALESCE(user_name, 'Visionary'),
                    'streak', NEW.current_streak,
                    'habitTitle', habit_title
                ),
                2 -- High priority
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_streak_milestone_email ON user_achievements;

-- Create trigger (only if user_achievements table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_achievements') THEN
        CREATE TRIGGER on_streak_milestone_email
            AFTER UPDATE ON user_achievements
            FOR EACH ROW
            EXECUTE FUNCTION queue_streak_milestone_email();
    END IF;
END $$;

-- ============================================================================
-- 9. FUNCTION: Process email queue (called by cron)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_email_queue_batch(batch_size INTEGER DEFAULT 50)
RETURNS TABLE(processed_count INTEGER, failed_count INTEGER) AS $$
DECLARE
    processed INTEGER := 0;
    failed INTEGER := 0;
BEGIN
    -- Mark batch as processing
    UPDATE email_queue
    SET status = 'processing'
    WHERE id IN (
        SELECT id FROM email_queue
        WHERE status = 'pending'
        AND scheduled_for <= NOW()
        AND attempts < max_attempts
        ORDER BY priority ASC, scheduled_for ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    );

    -- Count processed (actual sending happens in edge function)
    SELECT COUNT(*) INTO processed
    FROM email_queue
    WHERE status = 'processing';

    RETURN QUERY SELECT processed, failed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. UPDATE PROFILES TABLE TO ENSURE EMAIL COLUMN EXISTS
-- ============================================================================

-- Add email column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'email'
    ) THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- Create function to sync email from auth.users to profiles
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles SET email = NEW.email WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;

CREATE TRIGGER on_auth_user_email_change
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_profile_email();

-- Backfill existing users' emails
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND (p.email IS NULL OR p.email != u.email);

-- ============================================================================
-- 11. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON email_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_preferences TO authenticated;
GRANT ALL ON email_logs TO service_role;
GRANT ALL ON email_preferences TO service_role;
GRANT ALL ON email_queue TO service_role;

-- ============================================================================
-- 12. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE email_logs IS 'Tracks all sent emails for analytics and debugging';
COMMENT ON TABLE email_preferences IS 'User preferences for email communications';
COMMENT ON TABLE email_queue IS 'Queue for scheduled and batch emails';
COMMENT ON FUNCTION queue_welcome_email() IS 'Automatically queues welcome email for new users';
COMMENT ON FUNCTION queue_milestone_email() IS 'Queues celebration email when milestone completed';
COMMENT ON FUNCTION queue_streak_milestone_email() IS 'Queues email for 7/30/100 day streak achievements';
