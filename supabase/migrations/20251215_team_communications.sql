-- ============================================================================
-- TEAM COMMUNICATIONS MIGRATION
-- ============================================================================
-- Migration: 20251215_team_communications.sql
-- Version: 1.0
-- Description: Adds team communication capabilities for managers to send
--              announcements, recognition, and reminders to team members.
-- ============================================================================

-- ============================================================================
-- 1. TEAM COMMUNICATIONS TABLE
-- ============================================================================
-- Stores all team-wide communications sent by managers/admins

CREATE TABLE IF NOT EXISTS team_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Message Content
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,  -- Plain text fallback

    -- Message Type & Template
    template_type TEXT DEFAULT 'custom' CHECK (template_type IN (
        'announcement',      -- General team announcements
        'recognition',       -- Member achievement recognition
        'reminder',          -- Activity/engagement reminders
        'welcome',           -- New member welcome
        'milestone',         -- Team milestone celebrations
        'custom'             -- Freeform custom message
    )),

    -- Recipient Filtering
    recipient_filter JSONB DEFAULT '{}',
    -- Example filter: {"roles": ["member"], "status": ["active", "at_risk"], "min_streak": 0}

    -- Delivery Statistics
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,

    -- Status & Scheduling
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft',        -- Not yet sent, can be edited
        'scheduled',    -- Scheduled for future delivery
        'sending',      -- Currently being processed
        'sent',         -- All recipients processed
        'partial',      -- Some sent, some failed
        'failed',       -- Delivery failed
        'cancelled'     -- Cancelled before completion
    )),
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE team_communications IS 'Team-wide communications sent by managers to members';

-- ============================================================================
-- 2. TEAM COMMUNICATION RECIPIENTS TABLE
-- ============================================================================
-- Tracks delivery status for each recipient of a communication

CREATE TABLE IF NOT EXISTS team_communication_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID NOT NULL REFERENCES team_communications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,

    -- Delivery Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Not yet sent
        'queued',       -- In email queue
        'sent',         -- Sent to email provider
        'delivered',    -- Confirmed delivery
        'opened',       -- Email opened (tracking pixel)
        'clicked',      -- Link clicked
        'failed',       -- Send failed
        'bounced',      -- Email bounced
        'unsubscribed'  -- User opted out
    )),

    -- Tracking Timestamps
    queued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,

    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Email Provider Reference
    resend_id TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique recipient per communication
    UNIQUE(communication_id, user_id)
);

COMMENT ON TABLE team_communication_recipients IS 'Tracks delivery status for each team communication recipient';

-- ============================================================================
-- 3. UPDATE USER_COMM_PREFERENCES FOR TEAM ANNOUNCEMENTS
-- ============================================================================
-- Add team communication preference columns

ALTER TABLE user_comm_preferences
ADD COLUMN IF NOT EXISTS team_announcements_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS team_digest_frequency TEXT DEFAULT 'instant'
    CHECK (team_digest_frequency IN ('instant', 'daily', 'weekly', 'none'));

COMMENT ON COLUMN user_comm_preferences.team_announcements_enabled IS 'Whether user receives team announcements';
COMMENT ON COLUMN user_comm_preferences.team_digest_frequency IS 'Frequency of team communication digest';

-- Also add to email_preferences table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'email_preferences') THEN
        ALTER TABLE email_preferences
        ADD COLUMN IF NOT EXISTS team_announcement_emails BOOLEAN DEFAULT true;

        COMMENT ON COLUMN email_preferences.team_announcement_emails IS 'Whether user receives team announcement emails';
    END IF;
END $$;

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Team Communications Indexes
CREATE INDEX IF NOT EXISTS idx_team_comms_team_id
    ON team_communications(team_id);
CREATE INDEX IF NOT EXISTS idx_team_comms_sender_id
    ON team_communications(sender_id);
CREATE INDEX IF NOT EXISTS idx_team_comms_status
    ON team_communications(status);
CREATE INDEX IF NOT EXISTS idx_team_comms_scheduled
    ON team_communications(scheduled_for)
    WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_team_comms_created
    ON team_communications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_comms_template_type
    ON team_communications(template_type);

-- Team Communication Recipients Indexes
CREATE INDEX IF NOT EXISTS idx_team_comm_recipients_comm_id
    ON team_communication_recipients(communication_id);
CREATE INDEX IF NOT EXISTS idx_team_comm_recipients_user_id
    ON team_communication_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_team_comm_recipients_status
    ON team_communication_recipients(status);
CREATE INDEX IF NOT EXISTS idx_team_comm_recipients_pending
    ON team_communication_recipients(communication_id, status)
    WHERE status IN ('pending', 'queued');

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE team_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_communication_recipients ENABLE ROW LEVEL SECURITY;

-- Team Communications Policies

-- Platform admins can manage all communications
DROP POLICY IF EXISTS "Platform admins manage all team communications" ON team_communications;
CREATE POLICY "Platform admins manage all team communications"
    ON team_communications FOR ALL
    USING (is_platform_admin() OR auth.role() = 'service_role');

-- Team managers/admins can manage their team's communications
DROP POLICY IF EXISTS "Team managers can manage team communications" ON team_communications;
CREATE POLICY "Team managers can manage team communications"
    ON team_communications FOR ALL
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin', 'manager')
            AND is_active = TRUE
        )
    );

-- Team members can view communications sent to their team
DROP POLICY IF EXISTS "Team members can view team communications" ON team_communications;
CREATE POLICY "Team members can view team communications"
    ON team_communications FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND is_active = TRUE
        )
        AND status IN ('sent', 'partial')
    );

-- Team Communication Recipients Policies

-- Platform admins can manage all recipients
DROP POLICY IF EXISTS "Platform admins manage all recipients" ON team_communication_recipients;
CREATE POLICY "Platform admins manage all recipients"
    ON team_communication_recipients FOR ALL
    USING (is_platform_admin() OR auth.role() = 'service_role');

-- Users can view their own recipient records
DROP POLICY IF EXISTS "Users can view own recipient records" ON team_communication_recipients;
CREATE POLICY "Users can view own recipient records"
    ON team_communication_recipients FOR SELECT
    USING (user_id = auth.uid());

-- Team managers can view recipients for their team's communications
DROP POLICY IF EXISTS "Team managers can view recipients" ON team_communication_recipients;
CREATE POLICY "Team managers can view recipients"
    ON team_communication_recipients FOR SELECT
    USING (
        communication_id IN (
            SELECT tc.id FROM team_communications tc
            JOIN team_members tm ON tm.team_id = tc.team_id
            WHERE tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin', 'manager')
            AND tm.is_active = TRUE
        )
    );

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Update timestamps trigger for team_communications
DROP TRIGGER IF EXISTS update_team_communications_updated_at ON team_communications;
CREATE TRIGGER update_team_communications_updated_at
    BEFORE UPDATE ON team_communications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to update communication statistics
CREATE OR REPLACE FUNCTION update_team_communication_stats(p_communication_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE team_communications tc
    SET
        total_recipients = (
            SELECT COUNT(*) FROM team_communication_recipients
            WHERE communication_id = p_communication_id
        ),
        sent_count = (
            SELECT COUNT(*) FROM team_communication_recipients
            WHERE communication_id = p_communication_id
            AND status IN ('sent', 'delivered', 'opened', 'clicked')
        ),
        delivered_count = (
            SELECT COUNT(*) FROM team_communication_recipients
            WHERE communication_id = p_communication_id
            AND status IN ('delivered', 'opened', 'clicked')
        ),
        opened_count = (
            SELECT COUNT(*) FROM team_communication_recipients
            WHERE communication_id = p_communication_id
            AND status IN ('opened', 'clicked')
        ),
        clicked_count = (
            SELECT COUNT(*) FROM team_communication_recipients
            WHERE communication_id = p_communication_id
            AND status = 'clicked'
        ),
        failed_count = (
            SELECT COUNT(*) FROM team_communication_recipients
            WHERE communication_id = p_communication_id
            AND status = 'failed'
        ),
        bounced_count = (
            SELECT COUNT(*) FROM team_communication_recipients
            WHERE communication_id = p_communication_id
            AND status = 'bounced'
        ),
        updated_at = NOW()
    WHERE id = p_communication_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_team_communication_stats(UUID) IS 'Updates aggregate statistics for a team communication';

-- Function to get eligible recipients for a team communication
CREATE OR REPLACE FUNCTION get_team_communication_recipients(
    p_team_id UUID,
    p_filter JSONB DEFAULT '{}'
)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role TEXT,
    status TEXT
) AS $$
DECLARE
    v_roles TEXT[];
    v_statuses TEXT[];
BEGIN
    -- Parse filter options
    v_roles := CASE
        WHEN p_filter->'roles' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(p_filter->'roles'))
        ELSE ARRAY['owner', 'admin', 'manager', 'member']
    END;

    v_statuses := CASE
        WHEN p_filter->'status' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(p_filter->'status'))
        ELSE ARRAY['active', 'at_risk', 'inactive']
    END;

    RETURN QUERY
    SELECT
        tm.user_id,
        p.email,
        tm.role,
        CASE
            WHEN tm.is_active = FALSE THEN 'inactive'
            ELSE 'active'
        END as status
    FROM team_members tm
    JOIN profiles p ON p.id = tm.user_id
    LEFT JOIN user_comm_preferences ucp ON ucp.user_id = tm.user_id
    LEFT JOIN email_preferences ep ON ep.user_id = tm.user_id
    WHERE tm.team_id = p_team_id
    AND tm.is_active = TRUE
    AND tm.role = ANY(v_roles)
    AND p.email IS NOT NULL
    -- Respect opt-out preferences
    AND COALESCE(ucp.team_announcements_enabled, TRUE) = TRUE
    AND COALESCE(ep.team_announcement_emails, TRUE) = TRUE
    AND ep.unsubscribed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_team_communication_recipients(UUID, JSONB) IS 'Returns eligible recipients for a team communication based on filters and preferences';

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON team_communications TO authenticated;
GRANT SELECT ON team_communication_recipients TO authenticated;
GRANT ALL ON team_communications TO service_role;
GRANT ALL ON team_communication_recipients TO service_role;

-- ============================================================================
-- 9. AUDIT LOGGING SUPPORT
-- ============================================================================
-- Add team communication actions to audit_logs if the action types don't conflict

DO $$
BEGIN
    -- Add comment about expected audit log actions for team communications
    COMMENT ON TABLE team_communications IS
        'Team-wide communications. Audit actions: admin.team.communication.create, admin.team.communication.send, admin.team.communication.cancel';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created: 2
--   - team_communications
--   - team_communication_recipients
--
-- Columns added: 2
--   - user_comm_preferences.team_announcements_enabled
--   - user_comm_preferences.team_digest_frequency
--   - email_preferences.team_announcement_emails (if table exists)
--
-- Indexes created: 10
-- RLS policies created: 6
-- Functions created: 2
-- Triggers created: 1
-- ============================================================================
