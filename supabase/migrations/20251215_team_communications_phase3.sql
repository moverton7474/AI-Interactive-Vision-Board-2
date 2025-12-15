-- ============================================================================
-- TEAM COMMUNICATIONS PHASE 3 - DELIVERY & PROCESSING
-- ============================================================================
-- Migration: 20251215_team_communications_phase3.sql
-- Version: 1.0
-- Description: Adds queue processing support, webhook tracking columns,
--              and pg_cron job for automated communication processing.
-- Dependencies: 20251215_team_communications.sql
-- ============================================================================

-- ============================================================================
-- 1. ADD MISSING STATUS VALUES
-- ============================================================================
-- Update the status check constraint to include new values

ALTER TABLE team_communication_recipients
DROP CONSTRAINT IF EXISTS team_communication_recipients_status_check;

ALTER TABLE team_communication_recipients
ADD CONSTRAINT team_communication_recipients_status_check
CHECK (status IN (
    'pending',      -- Not yet sent
    'queued',       -- In email queue
    'sent',         -- Sent to email provider
    'delivered',    -- Confirmed delivery
    'opened',       -- Email opened (tracking pixel)
    'clicked',      -- Link clicked
    'failed',       -- Send failed
    'bounced',      -- Email bounced
    'skipped',      -- Skipped (user opted out)
    'complained',   -- Marked as spam
    'unsubscribed'  -- User opted out
));

-- ============================================================================
-- 2. ADD ADDITIONAL TRACKING COLUMNS
-- ============================================================================

-- Add attempts column for retry tracking (different from retry_count semantic)
ALTER TABLE team_communication_recipients
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

COMMENT ON COLUMN team_communication_recipients.attempts IS 'Number of send attempts made';

-- Add clicked_link for tracking which link was clicked
ALTER TABLE team_communication_recipients
ADD COLUMN IF NOT EXISTS clicked_link TEXT;

COMMENT ON COLUMN team_communication_recipients.clicked_link IS 'URL of the clicked link (for click events)';

-- Add bounce_type for distinguishing hard/soft bounces
ALTER TABLE team_communication_recipients
ADD COLUMN IF NOT EXISTS bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft'));

COMMENT ON COLUMN team_communication_recipients.bounce_type IS 'Type of bounce (hard or soft)';

-- Add next_retry_at for scheduled retries
ALTER TABLE team_communication_recipients
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

COMMENT ON COLUMN team_communication_recipients.next_retry_at IS 'Scheduled time for next retry attempt';

-- ============================================================================
-- 3. ADD INDEX FOR RETRY PROCESSING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_team_comm_recipients_retry
    ON team_communication_recipients(communication_id, next_retry_at)
    WHERE status IN ('pending', 'failed') AND next_retry_at IS NOT NULL;

-- Index for webhook lookups by email
CREATE INDEX IF NOT EXISTS idx_team_comm_recipients_email_status
    ON team_communication_recipients(email, status)
    WHERE status = 'sent';

-- ============================================================================
-- 4. FUNCTION TO QUEUE RECIPIENTS FOR A COMMUNICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_team_communication_recipients(
    p_communication_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_team_id UUID;
    v_filter JSONB;
    v_count INTEGER := 0;
BEGIN
    -- Get communication details
    SELECT team_id, recipient_filter
    INTO v_team_id, v_filter
    FROM team_communications
    WHERE id = p_communication_id;

    IF v_team_id IS NULL THEN
        RAISE EXCEPTION 'Communication not found: %', p_communication_id;
    END IF;

    -- Insert eligible recipients
    INSERT INTO team_communication_recipients (communication_id, user_id, email, status)
    SELECT
        p_communication_id,
        r.user_id,
        r.email,
        'pending'
    FROM get_team_communication_recipients(v_team_id, COALESCE(v_filter, '{}'::jsonb)) r
    ON CONFLICT (communication_id, user_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Update total_recipients count
    UPDATE team_communications
    SET total_recipients = (
        SELECT COUNT(*) FROM team_communication_recipients
        WHERE communication_id = p_communication_id
    )
    WHERE id = p_communication_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION queue_team_communication_recipients(UUID) IS 'Queues eligible recipients for a team communication';

-- ============================================================================
-- 5. FUNCTION TO SCHEDULE A COMMUNICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION schedule_team_communication(
    p_communication_id UUID,
    p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_status TEXT;
    v_recipient_count INTEGER;
BEGIN
    -- Get current status
    SELECT status INTO v_current_status
    FROM team_communications
    WHERE id = p_communication_id;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Communication not found: %', p_communication_id;
    END IF;

    IF v_current_status NOT IN ('draft', 'scheduled') THEN
        RAISE EXCEPTION 'Cannot schedule communication with status: %', v_current_status;
    END IF;

    -- Queue recipients if not already done
    SELECT COUNT(*) INTO v_recipient_count
    FROM team_communication_recipients
    WHERE communication_id = p_communication_id;

    IF v_recipient_count = 0 THEN
        PERFORM queue_team_communication_recipients(p_communication_id);
    END IF;

    -- Update status to scheduled
    UPDATE team_communications
    SET
        status = 'scheduled',
        scheduled_for = p_scheduled_for,
        updated_at = NOW()
    WHERE id = p_communication_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION schedule_team_communication(UUID, TIMESTAMPTZ) IS 'Schedules a team communication for delivery';

-- ============================================================================
-- 6. FUNCTION TO CANCEL A COMMUNICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_team_communication(
    p_communication_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_status TEXT;
BEGIN
    -- Get current status
    SELECT status INTO v_current_status
    FROM team_communications
    WHERE id = p_communication_id;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Communication not found: %', p_communication_id;
    END IF;

    IF v_current_status NOT IN ('draft', 'scheduled', 'sending') THEN
        RAISE EXCEPTION 'Cannot cancel communication with status: %', v_current_status;
    END IF;

    -- Cancel pending recipients
    UPDATE team_communication_recipients
    SET status = 'skipped', error_message = 'Communication cancelled'
    WHERE communication_id = p_communication_id
    AND status IN ('pending', 'queued');

    -- Update communication status
    UPDATE team_communications
    SET
        status = 'cancelled',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_communication_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cancel_team_communication(UUID) IS 'Cancels a scheduled or in-progress team communication';

-- ============================================================================
-- 7. PG_CRON JOB FOR AUTOMATED PROCESSING
-- ============================================================================
-- Note: This requires pg_cron and pg_net extensions to be enabled.
-- The service role key must be configured separately for security.
--
-- To set up the cron job manually in Supabase Dashboard SQL Editor:
--
-- SELECT cron.schedule(
--     'process-team-communications',
--     '*/5 * * * *',  -- Every 5 minutes
--     $$
--     SELECT net.http_post(
--         url := 'https://YOUR_PROJECT.supabase.co/functions/v1/process-team-communications',
--         headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--         body := '{"maxCommunications": 10}'::jsonb
--     ) AS request_id;
--     $$
-- );
--
-- To check scheduled jobs:
-- SELECT * FROM cron.job;
--
-- To unschedule:
-- SELECT cron.unschedule('process-team-communications');

-- ============================================================================
-- 8. VIEW FOR COMMUNICATION QUEUE STATUS
-- ============================================================================

CREATE OR REPLACE VIEW team_communication_queue_status AS
SELECT
    tc.id,
    tc.team_id,
    t.name AS team_name,
    tc.subject,
    tc.status,
    tc.scheduled_for,
    tc.total_recipients,
    tc.sent_count,
    tc.failed_count,
    (tc.total_recipients - tc.sent_count - tc.failed_count) AS pending_count,
    CASE
        WHEN tc.total_recipients > 0
        THEN ROUND((tc.sent_count::numeric / tc.total_recipients) * 100, 1)
        ELSE 0
    END AS completion_pct,
    tc.created_at,
    tc.updated_at
FROM team_communications tc
LEFT JOIN teams t ON t.id = tc.team_id
WHERE tc.status IN ('scheduled', 'sending', 'partial')
ORDER BY tc.scheduled_for ASC NULLS LAST;

COMMENT ON VIEW team_communication_queue_status IS 'Shows communications pending processing';

-- Grant access to the view
GRANT SELECT ON team_communication_queue_status TO authenticated;
GRANT SELECT ON team_communication_queue_status TO service_role;

-- ============================================================================
-- 9. TRIGGER TO UPDATE STATS ON RECIPIENT STATUS CHANGE
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_communication_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update stats if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM update_team_communication_stats(NEW.communication_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_comm_stats_on_recipient_change ON team_communication_recipients;
CREATE TRIGGER update_comm_stats_on_recipient_change
    AFTER UPDATE OF status ON team_communication_recipients
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_communication_stats();

-- ============================================================================
-- 10. GRANTS FOR NEW FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION queue_team_communication_recipients(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_team_communication(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_team_communication(UUID) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Added:
--   - Additional status values: skipped, complained
--   - New columns: attempts, clicked_link, bounce_type, next_retry_at
--   - New indexes: retry processing, webhook lookups
--   - New functions: queue_team_communication_recipients,
--                    schedule_team_communication, cancel_team_communication
--   - New view: team_communication_queue_status
--   - New trigger: update stats on recipient status change
--   - Documentation for pg_cron setup
-- ============================================================================
