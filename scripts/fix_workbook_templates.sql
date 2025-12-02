-- ============================================
-- FIX: Create workbook_templates table and seed data
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================

-- 1. Create the workbook_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS workbook_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT NOT NULL UNIQUE,
  page_count INT NOT NULL,
  size TEXT NOT NULL,
  binding TEXT CHECK (binding IN ('softcover', 'hardcover')),
  base_price DECIMAL(10,2) NOT NULL,
  shipping_estimate DECIMAL(10,2) DEFAULT 9.99,
  preview_image_url TEXT,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE workbook_templates ENABLE ROW LEVEL SECURITY;

-- 3. Create public read policy (drop first if exists)
DROP POLICY IF EXISTS "Anyone can view active templates" ON workbook_templates;
CREATE POLICY "Anyone can view active templates" ON workbook_templates
  FOR SELECT USING (is_active = TRUE);

-- 4. Insert seed data (4 default templates)
INSERT INTO workbook_templates (name, description, sku, page_count, size, binding, base_price, features, sort_order) VALUES
(
  'Vision Journal - Softcover',
  'Perfect starter workbook with your vision boards, action plan, and 12-month habit tracker.',
  'GLOBAL-NTB-A5-SC-100',
  100,
  'A5 (5.8" x 8.3")',
  'softcover',
  29.99,
  '["Full color interior", "12-month habit tracker", "Weekly reflection pages", "Custom cover"]',
  1
),
(
  'Vision Planner - Hardcover',
  'Premium hardcover workbook with lay-flat binding for daily use.',
  'GLOBAL-NTB-A5-HC-100',
  100,
  'A5 (5.8" x 8.3")',
  'hardcover',
  44.99,
  '["Hardcover protection", "Lay-flat binding", "Full color interior", "52-week journal", "Custom cover"]',
  2
),
(
  'Executive Vision Book',
  'Large format premium workbook with expanded content and professional presentation.',
  'GLOBAL-NTB-A4-HC-120',
  120,
  'A4 (8.3" x 11.7")',
  'hardcover',
  64.99,
  '["Large format", "Expanded action plan", "Full financial section", "QR code deep links", "Ribbon bookmark"]',
  3
),
(
  'Legacy Edition',
  'Our finest workbook - Letter size with premium materials and complete content.',
  'GLOBAL-NTB-LTR-HC-150',
  150,
  'Letter (8.5" x 11")',
  'hardcover',
  79.99,
  '["Premium materials", "150 pages", "Complete content", "Gift box packaging", "Certificate of authenticity"]',
  4
)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  page_count = EXCLUDED.page_count,
  size = EXCLUDED.size,
  binding = EXCLUDED.binding,
  base_price = EXCLUDED.base_price,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

-- 5. Verify the data
SELECT id, name, base_price, is_active FROM workbook_templates ORDER BY sort_order;
