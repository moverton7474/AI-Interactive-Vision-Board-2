-- ============================================
-- EXTENDED PRINT PRODUCTS CATALOG
-- Migration: 20251201_print_products_schema.sql
-- Version: 1.6
-- Description: Creates extended print product catalog
--              for daily pads, habit cards, posters, etc.
-- ============================================

-- ============================================
-- 1. PRINT PRODUCTS CATALOG
-- ============================================

CREATE TABLE IF NOT EXISTS print_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  product_type TEXT NOT NULL CHECK (product_type IN (
    'workbook', 'pad', 'cards', 'poster', 'sticker', 'canvas', 'bundle'
  )),
  prodigi_sku TEXT NOT NULL,
  size TEXT NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  shipping_estimate DECIMAL(10,2),
  preview_image_url TEXT,

  -- Customization Options
  personalization_fields JSONB DEFAULT '[]',
  color_options JSONB DEFAULT '[]',

  -- Business Rules
  requires_content BOOLEAN DEFAULT TRUE,
  min_content_items INT DEFAULT 0,
  elite_exclusive BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active products
CREATE INDEX IF NOT EXISTS idx_print_products_active ON print_products(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_print_products_type ON print_products(product_type);

-- ============================================
-- SEED PRINT PRODUCTS
-- ============================================

INSERT INTO print_products (name, description, product_type, prodigi_sku, size, base_price, shipping_estimate, personalization_fields, min_content_items, sort_order) VALUES
(
  'Daily Focus Pad',
  'Tear-off A5 desk pad with your top 3 daily actions. 50 sheets per pad. Perfect for your morning routine.',
  'pad',
  'GLOBAL-PAD-A5-50',
  'A5 (5.8"x8.3")',
  14.99,
  4.99,
  '["title", "tagline"]',
  1,
  1
),
(
  'Habit Cue Cards',
  'Pocket-sized trigger cards for each of your habits. 25 cards per pack. Place them where you need reminders.',
  'cards',
  'GLOBAL-CRD-3x5-25',
  '3"x5" (25 cards)',
  9.99,
  2.99,
  '[]',
  3,
  2
),
(
  'Vision Poster 18x24',
  'Large format museum-quality print of your primary vision board. Makes a powerful daily reminder.',
  'poster',
  'GLOBAL-FAP-18x24',
  '18"x24"',
  24.99,
  6.99,
  '["title"]',
  1,
  3
),
(
  'Vision Poster 24x36',
  'Extra large gallery print of your vision board. Statement piece for your office or home.',
  'poster',
  'GLOBAL-FAP-24x36',
  '24"x36"',
  39.99,
  9.99,
  '["title"]',
  1,
  4
),
(
  'Achievement Stickers',
  'Reward stickers for habit streaks and milestones. A4 sheet with 30+ stickers. Celebrate your wins!',
  'sticker',
  'GLOBAL-STK-A4',
  'A4 Sheet',
  9.99,
  2.99,
  '[]',
  0,
  5
),
(
  'Vision Canvas 16x20',
  'Gallery-wrapped canvas print of your vision board. Premium display piece with 1.5" depth.',
  'canvas',
  'GLOBAL-CAN-16x20',
  '16"x20"',
  49.99,
  9.99,
  '["title"]',
  1,
  6
),
(
  'Vision Canvas 24x36',
  'Large gallery-wrapped canvas. Museum-quality print that makes a statement.',
  'canvas',
  'GLOBAL-CAN-24x36',
  '24"x36"',
  89.99,
  14.99,
  '["title"]',
  1,
  7
),
(
  'Quarterly Review Kit',
  'Bundled review booklet (32 pages), achievement stickers, and celebration cards. Perfect for Elite subscribers.',
  'bundle',
  'BUNDLE-QTR-KIT',
  'Mixed',
  34.99,
  6.99,
  '["quarter", "year"]',
  5,
  8
),
(
  'Goal Milestone Cards',
  'Premium cards to celebrate major goal achievements. 10 cards with envelopes. Share your wins!',
  'cards',
  'GLOBAL-CRD-5x7-10',
  '5"x7" (10 cards)',
  14.99,
  3.99,
  '["message"]',
  0,
  9
),
(
  'Weekly Reflection Pad',
  'A4 desk pad for weekly reviews. 52 sheets - one year of reflections. Track wins, blockers, and next steps.',
  'pad',
  'GLOBAL-PAD-A4-52',
  'A4 (8.3"x11.7")',
  19.99,
  5.99,
  '["title", "year"]',
  0,
  10
)
ON CONFLICT DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE print_products ENABLE ROW LEVEL SECURITY;

-- Products are publicly readable
DROP POLICY IF EXISTS "Print products are publicly readable" ON print_products;
CREATE POLICY "Print products are publicly readable" ON print_products
  FOR SELECT USING (true);

-- Only service role can modify products
DROP POLICY IF EXISTS "Service role can manage print products" ON print_products;
CREATE POLICY "Service role can manage print products" ON print_products
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 1
-- Indexes created: 2
-- Seed data: 10 products
