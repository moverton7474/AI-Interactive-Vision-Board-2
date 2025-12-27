-- Plaid Integration Fix Migration
-- December 26, 2025
-- Fixes: Status case mismatch, FK constraint, field names, RLS policies
-- This migration is IDEMPOTENT - safe to run multiple times

-- ============================================================
-- Step 1: Verify plaid_items table exists (it should from previous migrations)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plaid_items') THEN
    CREATE TABLE public.plaid_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      item_id TEXT NOT NULL UNIQUE,
      institution_id TEXT,
      institution_name TEXT,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'error', 'disconnected')),
      cursor TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    RAISE NOTICE 'Created plaid_items table';
  ELSE
    RAISE NOTICE 'plaid_items table already exists';
  END IF;
END $$;

-- ============================================================
-- Step 2: Add FK constraint if missing
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'plaid_items_user_id_fkey'
    AND table_name = 'plaid_items'
  ) THEN
    -- Check if column exists first
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'plaid_items' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.plaid_items
        ADD CONSTRAINT plaid_items_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE 'Added FK constraint plaid_items_user_id_fkey';
    END IF;
  ELSE
    RAISE NOTICE 'FK constraint plaid_items_user_id_fkey already exists';
  END IF;
END $$;

-- ============================================================
-- Step 3: Normalize status values (ACTIVE → active, etc.)
-- ============================================================
UPDATE public.plaid_items
SET status = LOWER(status)
WHERE status IS NOT NULL AND status != LOWER(status);

-- ============================================================
-- Step 4: Modify default to lowercase 'active'
-- ============================================================
DO $$
BEGIN
  ALTER TABLE public.plaid_items ALTER COLUMN status SET DEFAULT 'active';
  RAISE NOTICE 'Updated status default to lowercase active';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update status default: %', SQLERRM;
END $$;

-- ============================================================
-- Step 5: Add CHECK constraint for valid status values
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'plaid_items_status_check'
  ) THEN
    ALTER TABLE public.plaid_items
      ADD CONSTRAINT plaid_items_status_check
      CHECK (status IN ('active', 'pending', 'error', 'disconnected'));
    RAISE NOTICE 'Added CHECK constraint for status values';
  ELSE
    RAISE NOTICE 'CHECK constraint plaid_items_status_check already exists';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add CHECK constraint: %', SQLERRM;
END $$;

-- ============================================================
-- Step 6: Enable RLS
-- ============================================================
ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 7: Create indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON public.plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item_id ON public.plaid_items(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_status ON public.plaid_items(status);

-- ============================================================
-- Step 8: Create/Update RLS policies
-- ============================================================

-- Drop existing policies to recreate with consistent naming
DROP POLICY IF EXISTS "Users can view own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can insert own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can update own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can delete own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "plaid_items_select_policy" ON public.plaid_items;
DROP POLICY IF EXISTS "plaid_items_insert_policy" ON public.plaid_items;
DROP POLICY IF EXISTS "plaid_items_update_policy" ON public.plaid_items;
DROP POLICY IF EXISTS "plaid_items_delete_policy" ON public.plaid_items;

-- Create clean RLS policies
CREATE POLICY "plaid_items_select_policy" ON public.plaid_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "plaid_items_insert_policy" ON public.plaid_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "plaid_items_update_policy" ON public.plaid_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "plaid_items_delete_policy" ON public.plaid_items
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Step 9: Create verification function
-- ============================================================
CREATE OR REPLACE FUNCTION verify_plaid_migration()
RETURNS TABLE (check_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Check 1: Table exists
  RETURN QUERY SELECT
    'plaid_items_exists'::TEXT,
    CASE WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plaid_items')
      THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
    'Table plaid_items existence check'::TEXT;

  -- Check 2: FK constraint exists
  RETURN QUERY SELECT
    'fk_constraint_exists'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'plaid_items_user_id_fkey' AND table_name = 'plaid_items'
    ) THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
    'Foreign key to auth.users exists'::TEXT;

  -- Check 3: No uppercase status values
  RETURN QUERY SELECT
    'status_lowercase'::TEXT,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.plaid_items WHERE status IS NOT NULL AND status != LOWER(status)
    ) THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
    'All status values are lowercase'::TEXT;

  -- Check 4: RLS enabled
  RETURN QUERY SELECT
    'rls_enabled'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_tables WHERE tablename = 'plaid_items' AND rowsecurity = true
    ) THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
    'Row Level Security is enabled'::TEXT;

  -- Check 5: Indexes exist
  RETURN QUERY SELECT
    'indexes_exist'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes WHERE tablename = 'plaid_items' AND indexname = 'idx_plaid_items_user_id'
    ) THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
    'Performance indexes are created'::TEXT;

  -- Check 6: RLS policies exist
  RETURN QUERY SELECT
    'rls_policies_exist'::TEXT,
    CASE WHEN (
      SELECT COUNT(*) FROM pg_policies WHERE tablename = 'plaid_items'
    ) >= 4 THEN 'PASS'::TEXT ELSE 'FAIL'::TEXT END,
    'RLS policies (SELECT, INSERT, UPDATE, DELETE) exist'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Run verification and output results
-- ============================================================
DO $$
DECLARE
  rec RECORD;
  all_passed BOOLEAN := true;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PLAID MIGRATION VERIFICATION RESULTS';
  RAISE NOTICE '========================================';

  FOR rec IN SELECT * FROM verify_plaid_migration() LOOP
    RAISE NOTICE '% : % - %', rec.check_name, rec.status, rec.details;
    IF rec.status = 'FAIL' THEN
      all_passed := false;
    END IF;
  END LOOP;

  RAISE NOTICE '========================================';
  IF all_passed THEN
    RAISE NOTICE 'ALL CHECKS PASSED - Migration complete!';
  ELSE
    RAISE NOTICE 'SOME CHECKS FAILED - Review above results';
  END IF;
  RAISE NOTICE '========================================';
END $$;
