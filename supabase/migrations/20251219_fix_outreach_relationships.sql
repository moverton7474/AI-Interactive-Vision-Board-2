-- ============================================
-- FIX: Voice Outreach Queue and Engagement Alerts
-- Migration: 20251219_fix_outreach_relationships
-- Description: Adds missing team_id column and foreign keys for PostgREST joins
-- ============================================

-- 1. Add team_id column to voice_outreach_queue (missing from original schema)
ALTER TABLE voice_outreach_queue
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- Create index for team-based queries
CREATE INDEX IF NOT EXISTS idx_voice_outreach_queue_team_id
ON voice_outreach_queue(team_id, scheduled_for) WHERE status = 'pending';

-- 2. Add foreign keys to profiles table for PostgREST joins
-- These allow the frontend to do joins like: profiles:user_id (email)

-- For voice_outreach_queue
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'voice_outreach_queue_user_id_profiles_fkey'
        AND table_name = 'voice_outreach_queue'
    ) THEN
        -- First verify profiles table has matching IDs
        ALTER TABLE voice_outreach_queue
        ADD CONSTRAINT voice_outreach_queue_user_id_profiles_fkey
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add voice_outreach_queue FK to profiles: %', SQLERRM;
END $$;

-- For engagement_alerts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'engagement_alerts_user_id_profiles_fkey'
        AND table_name = 'engagement_alerts'
    ) THEN
        ALTER TABLE engagement_alerts
        ADD CONSTRAINT engagement_alerts_user_id_profiles_fkey
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add engagement_alerts FK to profiles: %', SQLERRM;
END $$;

-- For team_members (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'team_members_user_id_profiles_fkey'
        AND table_name = 'team_members'
    ) THEN
        ALTER TABLE team_members
        ADD CONSTRAINT team_members_user_id_profiles_fkey
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add team_members FK to profiles: %', SQLERRM;
END $$;

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

-- Verify the constraints exist
DO $$
DECLARE
    constraint_count INT;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('voice_outreach_queue', 'engagement_alerts', 'team_members')
    AND tc.constraint_name LIKE '%profiles_fkey';

    RAISE NOTICE 'Created % foreign key constraints to profiles table', constraint_count;
END $$;

COMMENT ON COLUMN voice_outreach_queue.team_id IS 'Team this outreach belongs to, for manager access control';
