-- ============================================
-- STRIPE WEBHOOK IDEMPOTENCY TABLE
-- Migration: 20251214_stripe_webhook_idempotency
-- Description: Adds table for tracking processed Stripe webhook events
--              to ensure idempotent handling of duplicate deliveries
-- ============================================

-- 1. Create Stripe Webhook Events Table
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    processed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- 2. Index for fast lookups by type and date
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created_at ON stripe_webhook_events(created_at);

-- 3. No RLS needed - this table is only accessed by service role (Edge Functions)
-- But we enable it and add service role policy for consistency
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role can access all events (for webhook processing)
CREATE POLICY "Service role can manage webhook events"
    ON stripe_webhook_events FOR ALL
    USING (auth.role() = 'service_role');

-- Platform admins can view for debugging
CREATE POLICY "Platform admins can view webhook events"
    ON stripe_webhook_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM platform_roles
            WHERE user_id = auth.uid()
            AND role = 'platform_admin'
        )
    );

-- 4. Function to check if event was already processed
CREATE OR REPLACE FUNCTION check_webhook_idempotency(p_event_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    already_processed BOOLEAN;
BEGIN
    SELECT processed_at IS NOT NULL INTO already_processed
    FROM stripe_webhook_events
    WHERE event_id = p_event_id;

    -- If no row exists, return false (not processed)
    IF already_processed IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN already_processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Add comments for documentation
COMMENT ON TABLE stripe_webhook_events IS 'Tracks Stripe webhook events for idempotency - prevents duplicate processing';
COMMENT ON COLUMN stripe_webhook_events.event_id IS 'Stripe event ID (evt_xxx)';
COMMENT ON COLUMN stripe_webhook_events.type IS 'Stripe event type (e.g., checkout.session.completed)';
COMMENT ON COLUMN stripe_webhook_events.processed_at IS 'When the event was fully processed (null = in progress or failed)';
COMMENT ON COLUMN stripe_webhook_events.metadata IS 'Additional context (userId, orderId, errors, etc.)';

-- 6. Cleanup old events (older than 90 days) - scheduled job can call this
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM stripe_webhook_events
    WHERE created_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
