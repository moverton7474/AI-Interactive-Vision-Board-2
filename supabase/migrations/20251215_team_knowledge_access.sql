-- ============================================
-- TEAM KNOWLEDGE BASE ACCESS
-- Migration: 20251215_team_knowledge_access.sql
--
-- Allows managers to view team members' knowledge sources
-- ============================================

-- ============================================
-- 1. ADD TEAM VISIBILITY FLAG TO KNOWLEDGE SOURCES
-- ============================================

ALTER TABLE user_knowledge_sources
ADD COLUMN IF NOT EXISTS team_visible BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_knowledge_sources.team_visible IS
'When true, team managers can view this knowledge source';

-- ============================================
-- 2. CREATE FUNCTION TO CHECK TEAM MANAGER STATUS
-- ============================================

CREATE OR REPLACE FUNCTION is_team_manager_of(p_target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
      AND tm1.role IN ('owner', 'admin', 'manager')
      AND tm1.is_active = TRUE
      AND tm2.user_id = p_target_user_id
      AND tm2.is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_team_manager_of IS
'Returns true if current user is a manager of the target user in any team';

-- ============================================
-- 3. ADD RLS POLICY FOR TEAM MANAGERS
-- ============================================

-- Allow team managers to view team-visible knowledge sources
DROP POLICY IF EXISTS "Team managers can view team knowledge" ON user_knowledge_sources;
CREATE POLICY "Team managers can view team knowledge"
  ON user_knowledge_sources FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      team_visible = TRUE
      AND is_team_manager_of(user_id)
    )
    OR is_platform_admin()
  );

-- Allow team managers to view team-visible knowledge chunks
DROP POLICY IF EXISTS "Team managers can view team chunks" ON user_knowledge_chunks;
CREATE POLICY "Team managers can view team chunks"
  ON user_knowledge_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_knowledge_sources uks
      WHERE uks.id = user_knowledge_chunks.source_id
      AND (
        uks.user_id = auth.uid()
        OR (uks.team_visible = TRUE AND is_team_manager_of(uks.user_id))
        OR is_platform_admin()
      )
    )
  );

-- ============================================
-- 4. CREATE VIEW FOR TEAM KNOWLEDGE SUMMARY
-- ============================================

CREATE OR REPLACE VIEW team_knowledge_summary AS
SELECT
  tm.team_id,
  tm.user_id,
  p.email,
  COUNT(DISTINCT uks.id) as source_count,
  COALESCE(SUM(uks.word_count), 0) as total_words,
  COUNT(DISTINCT ukc.id) as chunk_count,
  COUNT(DISTINCT CASE WHEN uks.include_in_context THEN uks.id END) as active_sources,
  MAX(uks.created_at) as last_updated
FROM team_members tm
JOIN profiles p ON p.id = tm.user_id
LEFT JOIN user_knowledge_sources uks ON uks.user_id = tm.user_id
  AND uks.is_active = TRUE
  AND uks.team_visible = TRUE
LEFT JOIN user_knowledge_chunks ukc ON ukc.source_id = uks.id
WHERE tm.is_active = TRUE
GROUP BY tm.team_id, tm.user_id, p.email;

COMMENT ON VIEW team_knowledge_summary IS
'Aggregated knowledge statistics per team member for manager dashboard';

-- ============================================
-- 5. SET EXISTING SOURCES AS TEAM VISIBLE
-- ============================================

UPDATE user_knowledge_sources
SET team_visible = TRUE
WHERE team_visible IS NULL;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
