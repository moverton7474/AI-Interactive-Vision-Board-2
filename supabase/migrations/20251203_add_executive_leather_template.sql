
-- Migration: 20251203_add_executive_leather_template.sql
-- Description: Adds the Executive Leather Vision Planner template to the workbook_templates table.

INSERT INTO workbook_templates (name, description, sku, page_count, size, binding, base_price, shipping_estimate, features, sort_order, is_active)
VALUES (
  'Executive Vision Planner',
  'Premium leather-bound planner with gold foil debossing, 120gsm paper, and ribbon marker.',
  'EXEC-LEATHER-A4',
  200,
  'A4',
  'hardcover',
  79.99,
  12.99,
  '["Genuine Leather", "Gold Foil Debossing", "120gsm Paper", "Ribbon Marker", "Gift Box"]',
  1,
  TRUE
)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  page_count = EXCLUDED.page_count,
  base_price = EXCLUDED.base_price,
  shipping_estimate = EXCLUDED.shipping_estimate,
  features = EXCLUDED.features,
  is_active = TRUE;
