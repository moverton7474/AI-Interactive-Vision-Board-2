-- ============================================
-- RATE LIMITING INFRASTRUCTURE
-- Migration: 20251219_rate_limiting
--
-- Implements L2 - Rate Limiting on Sensitive Endpoints
-- Prevents enumeration attacks, brute-force, and API abuse.
-- ============================================

-- ============================================
-- PART 1: RATE LIMITS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,           -- Rate limit key (e.g., "user:uuid" or "ip:1.2.3.4")
  key_type TEXT NOT NULL,      -- Type of key: 'user', 'ip', 'endpoint'
  endpoint TEXT,               -- Endpoint that was called
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can manage rate limits (edge functions)
CREATE POLICY "Service role manages rate limits"
ON rate_limits FOR ALL
USING (auth.role() = 'service_role');

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at ON rate_limits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created ON rate_limits(key, created_at DESC);

-- ============================================
-- PART 2: AUTOMATIC CLEANUP
-- ============================================

-- Function to clean up old rate limit records
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  -- Delete records older than 10 minutes (covers most rate limit windows)
  DELETE FROM rate_limits
  WHERE created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup every 5 minutes (requires pg_cron extension)
-- Uncomment if pg_cron is enabled:
-- SELECT cron.schedule('cleanup-rate-limits', '*/5 * * * *', 'SELECT cleanup_rate_limits()');

-- ============================================
-- PART 3: RATE LIMIT CONFIGURATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS rate_limit_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_pattern TEXT NOT NULL UNIQUE, -- Endpoint pattern (e.g., '/api/auth/*')
  max_requests INT NOT NULL DEFAULT 100,
  window_seconds INT NOT NULL DEFAULT 60,
  key_type TEXT NOT NULL DEFAULT 'user', -- 'user', 'ip', 'endpoint'
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rate_limit_configs ENABLE ROW LEVEL SECURITY;

-- Only platform admins can manage rate limit configs
CREATE POLICY "Platform admins can manage rate limit configs"
ON rate_limit_configs FOR ALL
USING (
  auth.role() = 'service_role'
  OR is_platform_admin()
);

-- Insert default rate limit configurations
INSERT INTO rate_limit_configs (endpoint_pattern, max_requests, window_seconds, key_type, description)
VALUES
  ('auth/*', 5, 300, 'ip', 'Authentication endpoints - strict limits'),
  ('api/ai/*', 20, 60, 'user', 'AI/Generation endpoints - expensive operations'),
  ('api/admin/*', 30, 60, 'user', 'Admin endpoints - moderate limits'),
  ('api/*', 100, 60, 'user', 'General API endpoints'),
  ('public/*', 200, 60, 'ip', 'Public endpoints - lenient limits')
ON CONFLICT (endpoint_pattern) DO NOTHING;

-- ============================================
-- PART 4: BLOCKED IPS TABLE (for persistent bans)
-- ============================================

CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL,
  reason TEXT NOT NULL,
  blocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  blocked_until TIMESTAMPTZ, -- NULL means permanent
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage blocked IPs"
ON blocked_ips FOR ALL
USING (
  auth.role() = 'service_role'
  OR is_platform_admin()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active ON blocked_ips(is_active) WHERE is_active = TRUE;

-- Function to check if IP is blocked
CREATE OR REPLACE FUNCTION is_ip_blocked(check_ip INET)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_ips
    WHERE ip_address = check_ip
    AND is_active = TRUE
    AND (blocked_until IS NULL OR blocked_until > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 5: RATE LIMIT VIOLATIONS LOG
-- ============================================

CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  key_type TEXT NOT NULL,
  endpoint TEXT,
  ip_address INET,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  violation_count INT DEFAULT 1,
  first_violation_at TIMESTAMPTZ DEFAULT NOW(),
  last_violation_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rate_limit_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view rate limit violations"
ON rate_limit_violations FOR SELECT
USING (
  auth.role() = 'service_role'
  OR is_platform_admin()
);

CREATE POLICY "Service role can insert violations"
ON rate_limit_violations FOR INSERT
WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_key ON rate_limit_violations(key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_user ON rate_limit_violations(user_id);

-- Function to log rate limit violation
CREATE OR REPLACE FUNCTION log_rate_limit_violation(
  p_key TEXT,
  p_key_type TEXT,
  p_endpoint TEXT,
  p_ip_address INET,
  p_user_id UUID
) RETURNS void AS $$
BEGIN
  INSERT INTO rate_limit_violations (key, key_type, endpoint, ip_address, user_id)
  VALUES (p_key, p_key_type, p_endpoint, p_ip_address, p_user_id)
  ON CONFLICT (key) DO UPDATE SET
    violation_count = rate_limit_violations.violation_count + 1,
    last_violation_at = NOW();
EXCEPTION WHEN unique_violation THEN
  -- Handle race condition
  UPDATE rate_limit_violations
  SET violation_count = violation_count + 1, last_violation_at = NOW()
  WHERE key = p_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint for upsert
ALTER TABLE rate_limit_violations
ADD CONSTRAINT rate_limit_violations_key_unique UNIQUE (key);

-- ============================================
-- VERIFICATION
-- ============================================

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('rate_limits', 'rate_limit_configs', 'blocked_ips', 'rate_limit_violations');
