-- ============================================
-- WORKBOOK V2.1 EXECUTIVE PLANNER ENHANCEMENTS
-- Migration: 20251225_workbook_v21_enhancements.sql
-- Version: 2.1
-- Description: ADDITIVE enhancements for AI content, print specs, analytics
-- SAFETY: Does NOT modify existing columns or break existing flows
-- ============================================

-- ============================================
-- 1. EXTEND workbook_templates FOR NEW PRODUCTS
-- ============================================

-- Add product_type column (nullable for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbook_templates' AND column_name = 'product_type'
  ) THEN
    ALTER TABLE workbook_templates ADD COLUMN product_type TEXT DEFAULT 'SOFTCOVER_JOURNAL';
  END IF;
END $$;

-- Add check constraint separately to avoid issues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'workbook_templates_product_type_check'
  ) THEN
    ALTER TABLE workbook_templates ADD CONSTRAINT workbook_templates_product_type_check
      CHECK (product_type IN (
        'SOFTCOVER_JOURNAL', 'HARDCOVER_PLANNER', 'EXECUTIVE_VISION_BOOK',
        'LEGACY_EDITION', 'DAILY_PAD_A5', 'HABIT_CARDS'
      ));
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Add prodigi_sku for direct API integration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbook_templates' AND column_name = 'prodigi_sku'
  ) THEN
    ALTER TABLE workbook_templates ADD COLUMN prodigi_sku TEXT;
  END IF;
END $$;

-- Add print_specs JSONB for Prodigi specifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbook_templates' AND column_name = 'print_specs'
  ) THEN
    ALTER TABLE workbook_templates ADD COLUMN print_specs JSONB DEFAULT '{
      "dpi": 300,
      "color_mode": "RGB",
      "bleed_mm": 0,
      "safety_margin_mm": 10,
      "min_pages": 20,
      "max_pages": 300
    }';
  END IF;
END $$;

-- ============================================
-- 2. EXTEND workbook_orders FOR AI CONTENT
-- ============================================

-- Add ai_content JSONB column (uses existing pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbook_orders' AND column_name = 'ai_content'
  ) THEN
    ALTER TABLE workbook_orders ADD COLUMN ai_content JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add theme_pack column for content theming
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbook_orders' AND column_name = 'theme_pack'
  ) THEN
    ALTER TABLE workbook_orders ADD COLUMN theme_pack TEXT DEFAULT 'executive';
  END IF;
END $$;

-- Add check constraint for theme_pack
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'workbook_orders_theme_pack_check'
  ) THEN
    ALTER TABLE workbook_orders ADD CONSTRAINT workbook_orders_theme_pack_check
      CHECK (theme_pack IN ('faith', 'executive', 'retirement', 'health', 'entrepreneur', 'relationship'));
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Add edition_type column (matches existing pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbook_orders' AND column_name = 'edition_type'
  ) THEN
    ALTER TABLE workbook_orders ADD COLUMN edition_type TEXT DEFAULT 'SOFTCOVER_JOURNAL';
  END IF;
END $$;

-- Add content_snapshot for preserving generated pages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbook_orders' AND column_name = 'content_snapshot'
  ) THEN
    ALTER TABLE workbook_orders ADD COLUMN content_snapshot JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add print_validation for pre-flight checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbook_orders' AND column_name = 'print_validation'
  ) THEN
    ALTER TABLE workbook_orders ADD COLUMN print_validation JSONB DEFAULT '{
      "status": "pending",
      "errors": [],
      "warnings": [],
      "validated_at": null
    }';
  END IF;
END $$;

-- ============================================
-- 3. INSERT NEW PRODUCT TEMPLATES
-- ============================================

-- Daily Focus Pad (Execution Toolkit)
INSERT INTO workbook_templates (
  name, description, sku, page_count, size, binding,
  base_price, product_type, features, sort_order, print_specs, prodigi_sku
) VALUES (
  'Daily Focus Pad',
  'Tear-off A5 pad for daily intention setting and task prioritization. Perfect for executives.',
  'GLOBAL-PAD-A5-50',
  50,
  'A5 (5.8" x 8.3")',
  'softcover',
  19.99,
  'DAILY_PAD_A5',
  '["Daily top-3 priorities", "Morning intention prompt", "Evening reflection", "Habit check-in", "Tear-off pages"]',
  5,
  '{"dpi": 300, "color_mode": "RGB", "bleed_mm": 0, "safety_margin_mm": 10}',
  'GLOBAL-PAD-A5'
)
ON CONFLICT (sku) DO UPDATE SET
  product_type = EXCLUDED.product_type,
  print_specs = EXCLUDED.print_specs,
  prodigi_sku = EXCLUDED.prodigi_sku;

-- Habit Cue Cards (Execution Toolkit)
INSERT INTO workbook_templates (
  name, description, sku, page_count, size, binding,
  base_price, product_type, features, sort_order, print_specs, prodigi_sku
) VALUES (
  'Habit Cue Cards',
  '3x5 cue cards for habit stacking and visual reminders. Based on the Atomic Habits framework.',
  'GLOBAL-CRD-3x5-25',
  25,
  '3" x 5"',
  'softcover',
  14.99,
  'HABIT_CARDS',
  '["25 double-sided cards", "Cue/Routine/Reward format", "Premium cardstock", "Rounded corners", "Storage box"]',
  6,
  '{"dpi": 300, "color_mode": "RGB", "bleed_mm": 3}',
  'GLOBAL-CRD-3x5'
)
ON CONFLICT (sku) DO UPDATE SET
  product_type = EXCLUDED.product_type,
  print_specs = EXCLUDED.print_specs,
  prodigi_sku = EXCLUDED.prodigi_sku;

-- Update existing templates with product_type and print specs
UPDATE workbook_templates
SET product_type = 'SOFTCOVER_JOURNAL',
    prodigi_sku = sku,
    print_specs = '{"dpi": 300, "color_mode": "RGB", "bleed_mm": 0, "safety_margin_mm": 10, "min_pages": 20, "max_pages": 300}'
WHERE sku = 'GLOBAL-NTB-A5-SC-100' AND (product_type IS NULL OR product_type = 'SOFTCOVER_JOURNAL');

UPDATE workbook_templates
SET product_type = 'HARDCOVER_PLANNER',
    prodigi_sku = sku,
    print_specs = '{"dpi": 300, "color_mode": "RGB", "bleed_mm": 0, "safety_margin_mm": 10, "min_pages": 24, "max_pages": 300}'
WHERE sku = 'GLOBAL-NTB-A5-HC-100' AND (product_type IS NULL OR product_type = 'SOFTCOVER_JOURNAL');

UPDATE workbook_templates
SET product_type = 'EXECUTIVE_VISION_BOOK',
    prodigi_sku = sku,
    print_specs = '{"dpi": 300, "color_mode": "RGB", "bleed_mm": 0, "safety_margin_mm": 10, "min_pages": 24, "max_pages": 300}'
WHERE sku = 'GLOBAL-NTB-A4-HC-120' AND (product_type IS NULL OR product_type = 'SOFTCOVER_JOURNAL');

UPDATE workbook_templates
SET product_type = 'LEGACY_EDITION',
    prodigi_sku = sku,
    print_specs = '{"dpi": 300, "color_mode": "RGB", "bleed_mm": 0, "safety_margin_mm": 10, "min_pages": 24, "max_pages": 300}'
WHERE sku = 'GLOBAL-NTB-LTR-HC-150' AND (product_type IS NULL OR product_type = 'SOFTCOVER_JOURNAL');

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_workbook_orders_edition ON workbook_orders(edition_type);
CREATE INDEX IF NOT EXISTS idx_workbook_orders_theme ON workbook_orders(theme_pack);
CREATE INDEX IF NOT EXISTS idx_workbook_templates_product_type ON workbook_templates(product_type);

-- ============================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN workbook_templates.product_type IS 'Product category: SOFTCOVER_JOURNAL, HARDCOVER_PLANNER, EXECUTIVE_VISION_BOOK, LEGACY_EDITION, DAILY_PAD_A5, HABIT_CARDS';
COMMENT ON COLUMN workbook_templates.prodigi_sku IS 'Exact Prodigi API SKU for order submission';
COMMENT ON COLUMN workbook_templates.print_specs IS 'Prodigi print specifications: DPI, color mode, bleed, margins';
COMMENT ON COLUMN workbook_orders.theme_pack IS 'Content theme: faith, executive, retirement, health, entrepreneur, relationship';
COMMENT ON COLUMN workbook_orders.ai_content IS 'AI-generated content: foreword, theme prompts, reflection text';
COMMENT ON COLUMN workbook_orders.content_snapshot IS 'Snapshot of all page data at generation time';
COMMENT ON COLUMN workbook_orders.print_validation IS 'Pre-flight validation results: status, errors, warnings';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Added columns: 3 to workbook_templates (product_type, prodigi_sku, print_specs)
-- Added columns: 5 to workbook_orders (ai_content, theme_pack, edition_type, content_snapshot, print_validation)
-- Inserted templates: 2 (Daily Focus Pad, Habit Cue Cards)
-- Updated templates: 4 (existing templates with product_type)
-- Indexes: 3
-- NO BREAKING CHANGES - All existing flows preserved
-- ============================================
