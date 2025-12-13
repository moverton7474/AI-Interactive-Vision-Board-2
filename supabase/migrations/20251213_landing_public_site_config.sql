-- ============================================
-- PUBLIC SITE CONFIG FOR LANDING PAGE ASSETS
-- Migration: 20251213_landing_public_site_config.sql
-- Version: 1.0
-- Description: Backend-configurable landing page assets
--              (hero videos, journey content) without redeploy.
-- ============================================

-- ============================================
-- 1. PUBLIC SITE CONFIG TABLE
-- ============================================
-- Small key-value store for landing page configuration
-- This is a Launch Control Panel, not a full CMS

CREATE TABLE IF NOT EXISTS public_site_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public_site_config IS 'Public site configuration for landing page assets (videos, images, copy)';

-- Enable RLS
ALTER TABLE public_site_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. RLS POLICIES
-- ============================================

-- Anyone (including anon) can read landing config
DROP POLICY IF EXISTS "public_read_site_config" ON public_site_config;
CREATE POLICY "public_read_site_config"
  ON public_site_config
  FOR SELECT
  USING (true);

-- Only platform_admin can insert landing config
-- Uses existing platform_roles table from enterprise RBAC migration
DROP POLICY IF EXISTS "platform_admin_insert_site_config" ON public_site_config;
CREATE POLICY "platform_admin_insert_site_config"
  ON public_site_config
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role = 'platform_admin'
        AND pr.is_active = TRUE
        AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
    )
  );

-- Only platform_admin can update landing config
DROP POLICY IF EXISTS "platform_admin_update_site_config" ON public_site_config;
CREATE POLICY "platform_admin_update_site_config"
  ON public_site_config
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role = 'platform_admin'
        AND pr.is_active = TRUE
        AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
    )
  );

-- Only platform_admin can delete config entries
DROP POLICY IF EXISTS "platform_admin_delete_site_config" ON public_site_config;
CREATE POLICY "platform_admin_delete_site_config"
  ON public_site_config
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role = 'platform_admin'
        AND pr.is_active = TRUE
        AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
    )
  );

-- ============================================
-- 3. SEED DEFAULT HERO VIDEOS CONFIG
-- ============================================
-- Multi-format video sources per journey type
-- URLs are placeholders - replace with actual Supabase storage or CDN URLs

INSERT INTO public_site_config (key, value)
VALUES (
  'landing.hero_videos',
  '{
    "default": [
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/default.mp4", "type": "video/mp4"},
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/default.webm", "type": "video/webm"}
    ],
    "retirement": [
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/retirement.mp4", "type": "video/mp4"},
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/retirement.webm", "type": "video/webm"}
    ],
    "faith": [
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/faith.mp4", "type": "video/mp4"},
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/faith.webm", "type": "video/webm"}
    ],
    "executive": [
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/executive.mp4", "type": "video/mp4"},
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/executive.webm", "type": "video/webm"}
    ],
    "entrepreneur": [
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/entrepreneur.mp4", "type": "video/mp4"},
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/entrepreneur.webm", "type": "video/webm"}
    ],
    "relationship": [
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/relationship.mp4", "type": "video/mp4"},
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/relationship.webm", "type": "video/webm"}
    ],
    "health": [
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/health.mp4", "type": "video/mp4"},
      {"url": "https://edaigbnnofyxcfbpcvct.supabase.co/storage/v1/object/public/public-videos/landing/health.webm", "type": "video/webm"}
    ]
  }'::JSONB
)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 4. UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_site_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_public_site_config_timestamp ON public_site_config;
CREATE TRIGGER update_public_site_config_timestamp
  BEFORE UPDATE ON public_site_config
  FOR EACH ROW
  EXECUTE FUNCTION update_site_config_timestamp();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Table: public_site_config
-- Policies: 4 (public read, admin insert/update/delete)
-- Seed: landing.hero_videos config
-- Trigger: auto-update timestamp
-- ============================================
