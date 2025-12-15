-- ============================================
-- STRIPE WEBHOOK IDEMPOTENCY
-- Migration: 20251215_stripe_webhook_idempotency.sql
-- Description: Adds idempotency tracking for Stripe webhook events
--              to prevent duplicate processing when Stripe retries
-- ============================================

-- 1. Create stripe_webhook_events table
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}',
  error_message TEXT
);

COMMENT ON TABLE stripe_webhook_events IS 'Idempotency tracking for Stripe webhook events to prevent duplicate processing';

-- 2. Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status ON stripe_webhook_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created ON stripe_webhook_events(created_at DESC);

-- 3. Enable RLS
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- 4. Only service role can access webhook events (internal use only)
DROP POLICY IF EXISTS "Service role manages webhook events" ON stripe_webhook_events;
CREATE POLICY "Service role manages webhook events"
  ON stripe_webhook_events FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Platform admins can view webhook events for debugging
DROP POLICY IF EXISTS "Platform admins can view webhook events" ON stripe_webhook_events;
CREATE POLICY "Platform admins can view webhook events"
  ON stripe_webhook_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM platform_roles
      WHERE user_id = auth.uid()
      AND role = 'platform_admin'
      AND is_active = TRUE
    )
  );

-- 6. Cleanup function to remove old events (run weekly via cron)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete events older than 30 days
  DELETE FROM stripe_webhook_events
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION cleanup_old_webhook_events() TO service_role;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Table: stripe_webhook_events
-- Indexes: 3
-- Policies: 2
-- Functions: 1
-- ============================================
