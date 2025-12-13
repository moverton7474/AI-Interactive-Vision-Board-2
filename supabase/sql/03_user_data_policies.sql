-- ============================================
-- VISIONARY AI - USER DATA & FINANCIAL POLICIES
-- ============================================
-- Run AFTER 02_rbac_policies.sql
-- ============================================

-- ============================================
-- PROFILES POLICIES (with platform admin access)
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

CREATE POLICY "Users can view profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR is_platform_admin()
    OR is_support_agent()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR auth.role() = 'service_role'
  );


-- ============================================
-- VISION_BOARDS POLICIES (SECURE - Replace public)
-- ============================================

-- Remove old public policies
DROP POLICY IF EXISTS "Allow public read VB" ON vision_boards;
DROP POLICY IF EXISTS "Allow public insert VB" ON vision_boards;
DROP POLICY IF EXISTS "Allow public delete VB" ON vision_boards;
DROP POLICY IF EXISTS "Allow public update VB" ON vision_boards;

-- Remove old user policies
DROP POLICY IF EXISTS "Users can view own vision boards" ON vision_boards;
DROP POLICY IF EXISTS "Users can insert own vision boards" ON vision_boards;
DROP POLICY IF EXISTS "Users can update own vision boards" ON vision_boards;
DROP POLICY IF EXISTS "Users can delete own vision boards" ON vision_boards;

-- Remove new policies (for re-creation)
DROP POLICY IF EXISTS "Users can view vision boards" ON vision_boards;

-- Create secure policies
CREATE POLICY "Users can view vision boards"
  ON vision_boards FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR is_support_agent()
  );

CREATE POLICY "Users can insert own vision boards"
  ON vision_boards FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own vision boards"
  ON vision_boards FOR UPDATE
  USING (user_id = auth.uid() OR is_platform_admin())
  WITH CHECK (user_id = auth.uid() OR is_platform_admin());

CREATE POLICY "Users can delete own vision boards"
  ON vision_boards FOR DELETE
  USING (user_id = auth.uid() OR is_platform_admin());


-- ============================================
-- REFERENCE_IMAGES POLICIES (SECURE)
-- ============================================

DROP POLICY IF EXISTS "Allow public read RI" ON reference_images;
DROP POLICY IF EXISTS "Allow public insert RI" ON reference_images;
DROP POLICY IF EXISTS "Allow public delete RI" ON reference_images;
DROP POLICY IF EXISTS "Users own their reference images" ON reference_images;

CREATE POLICY "Users own their reference images"
  ON reference_images FOR ALL
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );


-- ============================================
-- DOCUMENTS POLICIES (SECURE)
-- ============================================

DROP POLICY IF EXISTS "Allow public read Docs" ON documents;
DROP POLICY IF EXISTS "Allow public insert Docs" ON documents;
DROP POLICY IF EXISTS "Allow public delete Docs" ON documents;
DROP POLICY IF EXISTS "Users own their documents" ON documents;

CREATE POLICY "Users own their documents"
  ON documents FOR ALL
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );


-- ============================================
-- FINANCIAL TABLES - HARDENED POLICIES
-- ============================================

-- Fix the overly permissive automation_rules policy
DROP POLICY IF EXISTS "Allow public read Auto" ON automation_rules;
DROP POLICY IF EXISTS "Users can manage own automation rules" ON automation_rules;

CREATE POLICY "Users can manage own automation rules"
  ON automation_rules FOR ALL
  USING (
    source_account_id IN (
      SELECT id::TEXT FROM plaid_items WHERE user_id = auth.uid()
    )
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

-- Plaid items policies
DROP POLICY IF EXISTS "Users own their plaid items" ON plaid_items;

CREATE POLICY "Users own their plaid items"
  ON plaid_items FOR ALL
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

-- Transfer logs policies
DROP POLICY IF EXISTS "Users can view own transfer logs" ON transfer_logs;
DROP POLICY IF EXISTS "Service role can insert transfer logs" ON transfer_logs;

CREATE POLICY "Users can view own transfer logs"
  ON transfer_logs FOR SELECT
  USING (
    rule_id IN (
      SELECT ar.id FROM automation_rules ar
      JOIN plaid_items pi ON pi.id::TEXT = ar.source_account_id
      WHERE pi.user_id = auth.uid()
    )
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can insert transfer logs"
  ON transfer_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');


-- ============================================
-- AMIE TABLES POLICIES (with platform admin access)
-- ============================================

-- User Identity Profiles
DROP POLICY IF EXISTS "Users can manage own identity" ON user_identity_profiles;
DROP POLICY IF EXISTS "Users own their identity profiles" ON user_identity_profiles;

CREATE POLICY "Users own their identity profiles"
  ON user_identity_profiles FOR ALL
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR is_support_agent()
    OR auth.role() = 'service_role'
  );

-- User Knowledge Sources (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_knowledge_sources') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users own their knowledge sources" ON user_knowledge_sources';
    EXECUTE $policy$
      CREATE POLICY "Users own their knowledge sources"
        ON user_knowledge_sources FOR ALL
        USING (
          user_id = auth.uid()
          OR is_platform_admin()
          OR is_support_agent()
          OR auth.role() = 'service_role'
        )
    $policy$;
  END IF;
END $$;

-- User Knowledge Chunks (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_knowledge_chunks') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users own their knowledge chunks" ON user_knowledge_chunks';
    EXECUTE $policy$
      CREATE POLICY "Users own their knowledge chunks"
        ON user_knowledge_chunks FOR ALL
        USING (
          user_id = auth.uid()
          OR is_platform_admin()
          OR auth.role() = 'service_role'
        )
    $policy$;
  END IF;
END $$;

-- Voice Coach Sessions (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_coach_sessions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users own their voice sessions" ON voice_coach_sessions';
    EXECUTE $policy$
      CREATE POLICY "Users own their voice sessions"
        ON voice_coach_sessions FOR ALL
        USING (
          user_id = auth.uid()
          OR is_platform_admin()
          OR is_support_agent()
          OR auth.role() = 'service_role'
        )
    $policy$;
  END IF;
END $$;


-- ============================================
-- PRINT_ORDERS POLICIES (with team support)
-- ============================================

DROP POLICY IF EXISTS "Users own their print orders" ON print_orders;
DROP POLICY IF EXISTS "Users can view own print orders" ON print_orders;
DROP POLICY IF EXISTS "Users can create print orders" ON print_orders;
DROP POLICY IF EXISTS "Users can update own print orders" ON print_orders;

CREATE POLICY "Users can view own print orders"
  ON print_orders FOR SELECT
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND is_team_member(team_id))
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can create print orders"
  ON print_orders FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can update own print orders"
  ON print_orders FOR UPDATE
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR auth.role() = 'service_role'
  );
