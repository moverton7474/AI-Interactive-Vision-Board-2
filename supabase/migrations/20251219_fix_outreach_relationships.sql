-- ============================================
-- FIX: Voice Outreach Queue and Engagement Alerts
-- Migration: 20251219_fix_outreach_relationships
-- Description: Adds missing team_id column for team-based access control
-- Note: Profiles are queried separately in code to avoid FK ambiguity issues
-- ============================================

-- 1. Add team_id column to voice_outreach_queue (missing from original schema)
ALTER TABLE voice_outreach_queue
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- Create index for team-based queries
CREATE INDEX IF NOT EXISTS idx_voice_outreach_queue_team_id
ON voice_outreach_queue(team_id, scheduled_for) WHERE status = 'pending';

-- 2. Remove any profiles FKs that cause PostgREST ambiguity
-- (Tables already have FK to auth.users, adding profiles FK creates "multiple relationships" error)
ALTER TABLE team_members
DROP CONSTRAINT IF EXISTS team_members_user_id_profiles_fkey;

ALTER TABLE voice_outreach_queue
DROP CONSTRAINT IF EXISTS voice_outreach_queue_user_id_profiles_fkey;

ALTER TABLE engagement_alerts
DROP CONSTRAINT IF EXISTS engagement_alerts_user_id_profiles_fkey;

-- 3. Update RLS policies for voice_outreach_queue to include team_id checks
DROP POLICY IF EXISTS "Team managers can view outreach queue" ON voice_outreach_queue;

CREATE POLICY "Team managers can view outreach queue"
ON voice_outreach_queue FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = voice_outreach_queue.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'manager')
        AND tm.is_active = true
    )
    OR EXISTS (
        SELECT 1 FROM platform_roles pr
        WHERE pr.user_id = auth.uid()
        AND pr.role = 'platform_admin'
        AND pr.is_active = true
    )
);

DROP POLICY IF EXISTS "Team managers can insert outreach" ON voice_outreach_queue;

CREATE POLICY "Team managers can insert outreach"
ON voice_outreach_queue FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = voice_outreach_queue.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'manager')
        AND tm.is_active = true
    )
    OR EXISTS (
        SELECT 1 FROM platform_roles pr
        WHERE pr.user_id = auth.uid()
        AND pr.role = 'platform_admin'
        AND pr.is_active = true
    )
);

DROP POLICY IF EXISTS "Team managers can update outreach" ON voice_outreach_queue;

CREATE POLICY "Team managers can update outreach"
ON voice_outreach_queue FOR UPDATE
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = voice_outreach_queue.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin', 'manager')
        AND tm.is_active = true
    )
    OR EXISTS (
        SELECT 1 FROM platform_roles pr
        WHERE pr.user_id = auth.uid()
        AND pr.role = 'platform_admin'
        AND pr.is_active = true
    )
);

COMMENT ON COLUMN voice_outreach_queue.team_id IS 'Team this outreach belongs to, for manager access control';
