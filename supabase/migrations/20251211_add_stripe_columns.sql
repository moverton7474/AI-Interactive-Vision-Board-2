-- Migration: Add Stripe columns to profiles table
-- Date: December 11, 2025
-- Purpose: Store Stripe customer and subscription IDs for subscription lifecycle management

-- Add Stripe columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Add paid_at column to poster_orders if not exists
ALTER TABLE poster_orders
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Create index for faster Stripe lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for subscription management';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Active Stripe subscription ID';
