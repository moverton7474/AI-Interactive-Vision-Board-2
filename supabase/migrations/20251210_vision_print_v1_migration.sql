-- ============================================
-- VISION + PRINT LAUNCH v1 MIGRATION
-- Migration: 20251210_vision_print_v1_migration.sql
-- Version: 1.0
-- Description: Adds product_type to poster_orders and
--              seeds missing print products for poster/canvas
-- ============================================

-- ============================================
-- 1. ADD PRODUCT_TYPE TO POSTER_ORDERS
-- ============================================

-- Add product_type column to track poster vs canvas orders
ALTER TABLE public.poster_orders
ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'poster'
CHECK (product_type IN ('poster', 'canvas'));

-- Add index for filtering by product type
CREATE INDEX IF NOT EXISTS idx_poster_orders_product_type
ON public.poster_orders(product_type);

-- ============================================
-- 2. ADD MISSING PRINT PRODUCTS
-- ============================================

-- Add poster products with GLOBAL-PHO- SKUs (matching printService.ts)
INSERT INTO print_products (
  name,
  description,
  product_type,
  prodigi_sku,
  size,
  base_price,
  shipping_estimate,
  personalization_fields,
  min_content_items,
  sort_order,
  is_active
) VALUES
-- Poster 12x18 (new)
(
  'Vision Poster 12x18',
  'Standard format poster print of your vision board. Perfect for desks and small spaces.',
  'poster',
  'GLOBAL-PHO-12X18',
  '12"x18"',
  24.00,
  5.99,
  '["title"]',
  1,
  1,
  true
),
-- Poster 18x24 (new SKU)
(
  'Vision Poster 18x24',
  'Large format museum-quality print of your primary vision board. Makes a powerful daily reminder.',
  'poster',
  'GLOBAL-PHO-18X24',
  '18"x24"',
  34.00,
  6.99,
  '["title"]',
  1,
  2,
  true
),
-- Poster 24x36 (new SKU)
(
  'Vision Poster 24x36',
  'Extra large gallery print of your vision board. Statement piece for your office or home.',
  'poster',
  'GLOBAL-PHO-24X36',
  '24"x36"',
  44.00,
  9.99,
  '["title"]',
  1,
  3,
  true
),
-- Canvas 12x18 (new)
(
  'Vision Canvas 12x18',
  'Compact gallery-wrapped canvas print. Perfect for smaller spaces with premium look.',
  'canvas',
  'GLOBAL-CAN-12X18',
  '12"x18"',
  49.00,
  7.99,
  '["title"]',
  1,
  4,
  true
),
-- Canvas 18x24 (new)
(
  'Vision Canvas 18x24',
  'Mid-size gallery-wrapped canvas print. Museum-quality with 1.5" gallery wrap depth.',
  'canvas',
  'GLOBAL-CAN-18X24',
  '18"x24"',
  69.00,
  9.99,
  '["title"]',
  1,
  5,
  true
),
-- Canvas 24x36 (updated to match SKU)
(
  'Vision Canvas 24x36',
  'Large gallery-wrapped canvas. Museum-quality print that makes a statement.',
  'canvas',
  'GLOBAL-CAN-24X36',
  '24"x36"',
  89.00,
  14.99,
  '["title"]',
  1,
  6,
  true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. UPDATE REFERENCE_IMAGES (IF NEEDED)
-- ============================================

-- Ensure identity_description column exists (for existing databases)
ALTER TABLE public.reference_images
ADD COLUMN IF NOT EXISTS identity_description TEXT;

-- Add index for faster lookups on identity_description
CREATE INDEX IF NOT EXISTS idx_reference_images_has_identity
ON public.reference_images((identity_description IS NOT NULL));

-- ============================================
-- 4. ADD POLICY FOR POSTER_ORDERS UPDATE
-- ============================================

-- Allow users to update their own orders (e.g., for status tracking)
DROP POLICY IF EXISTS "Users can update own orders" ON public.poster_orders;
CREATE POLICY "Users can update own orders"
ON public.poster_orders FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Changes:
-- 1. Added product_type column to poster_orders
-- 2. Added 6 print products (3 posters + 3 canvas) with matching SKUs
-- 3. Ensured identity_description column exists on reference_images
-- 4. Added update policy for poster_orders
