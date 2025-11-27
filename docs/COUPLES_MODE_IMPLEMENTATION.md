# Couples/Partner Mode - Implementation Plan

## Overview

This document provides a comprehensive implementation plan for adding Couples/Partner Mode to the Visionary SaaS platform. This feature enables couples to collaboratively plan their retirement, share vision boards, combine financial data, and align on shared goals.

## Business Value

- **Target Market Fit**: Primary audience is couples aged 45-60 planning retirement together
- **Competitive Advantage**: No competitor offers couples-first retirement visualization
- **Upsell Driver**: Premium feature that justifies Elite tier pricing ($49.99/month)
- **Engagement**: 2x user accounts per household, increased retention through accountability

---

## Phase 1: Database Schema

### 1.1 New Tables

```sql
-- =====================================================
-- COUPLES MODE SCHEMA
-- =====================================================

-- 1. User Profiles (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Personal Info
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,

    -- Retirement Planning Info
    birth_date DATE,
    target_retirement_year INT,
    dream_location TEXT,

    -- Household Association
    household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
    household_role TEXT DEFAULT 'owner', -- 'owner' | 'partner' | 'viewer'

    -- Preferences
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "partner_activity": true}'::jsonb,
    onboarding_completed BOOLEAN DEFAULT false
);

-- 2. Households (Couples Unit)
CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Household Info
    name TEXT DEFAULT 'Our Household', -- e.g., "The Overton Family"

    -- Combined Financial Goals
    combined_savings_goal NUMERIC(12, 2),
    combined_target_year INT,
    shared_dream_location TEXT,

    -- Subscription
    subscription_tier TEXT DEFAULT 'free', -- 'free' | 'pro' | 'elite'
    subscription_expires_at TIMESTAMP WITH TIME ZONE,

    -- Settings
    settings JSONB DEFAULT '{
        "share_financial_data": true,
        "share_vision_boards": true,
        "require_partner_approval": false
    }'::jsonb
);

-- 3. Partner Invitations
CREATE TABLE IF NOT EXISTS public.partner_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days') NOT NULL,

    -- Invitation Details
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invitee_email TEXT NOT NULL,

    -- Status
    status TEXT DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined' | 'expired'
    accepted_at TIMESTAMP WITH TIME ZONE,

    -- Security
    invitation_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

    -- Personalization
    personal_message TEXT
);

-- 4. Vision Alignment Scores (AI-Generated)
CREATE TABLE IF NOT EXISTS public.vision_alignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,

    -- Scores (0-100)
    overall_alignment_score INT,
    location_alignment INT,
    timeline_alignment INT,
    lifestyle_alignment INT,
    financial_alignment INT,

    -- AI Analysis
    ai_summary TEXT,
    shared_themes TEXT[],
    potential_conflicts TEXT[],
    recommendations TEXT[],

    -- Source Data
    analyzed_vision_ids UUID[]
);

-- 5. Activity Feed (Partner Notifications)
CREATE TABLE IF NOT EXISTS public.household_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Activity Details
    activity_type TEXT NOT NULL, -- 'vision_created' | 'vision_refined' | 'financial_updated' | 'goal_completed' | 'bank_connected'
    entity_type TEXT, -- 'vision_board' | 'document' | 'task'
    entity_id UUID,

    -- Display
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Read Status (per partner)
    read_by UUID[] DEFAULT '{}'::uuid[]
);
```

### 1.2 Schema Modifications to Existing Tables

```sql
-- =====================================================
-- MODIFY EXISTING TABLES
-- =====================================================

-- Add household_id and ownership to vision_boards
ALTER TABLE public.vision_boards
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id),
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'shared', -- 'private' | 'shared'
ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- Add household_id to documents
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id),
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'shared';

-- Add household_id to reference_images
ALTER TABLE public.reference_images
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id);

-- Add household_id to plaid_items
ALTER TABLE public.plaid_items
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id);

-- Add household_id to poster_orders
ALTER TABLE public.poster_orders
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id);

-- Add household_id to automation_rules
ALTER TABLE public.automation_rules
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id);
```

### 1.3 Row Level Security Policies

```sql
-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vision_alignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_activity ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can only see/edit their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can view household members"
ON public.profiles FOR SELECT
USING (
    household_id IN (
        SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- HOUSEHOLDS: Members can view/edit their household
CREATE POLICY "Household members can view"
ON public.households FOR SELECT
USING (
    id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Household owner can update"
ON public.households FOR UPDATE
USING (
    id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid() AND household_role = 'owner')
);

-- VISION BOARDS: Household-based access
DROP POLICY IF EXISTS "Allow public read VB" ON public.vision_boards;
DROP POLICY IF EXISTS "Allow public insert VB" ON public.vision_boards;
DROP POLICY IF EXISTS "Allow public delete VB" ON public.vision_boards;

CREATE POLICY "Users can view own and household visions"
ON public.vision_boards FOR SELECT
USING (
    user_id = auth.uid()
    OR (
        visibility = 'shared'
        AND household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
    )
);

CREATE POLICY "Users can create visions"
ON public.vision_boards FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own visions"
ON public.vision_boards FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own visions"
ON public.vision_boards FOR DELETE
USING (user_id = auth.uid());

-- DOCUMENTS: Household-based access
DROP POLICY IF EXISTS "Allow public read Docs" ON public.documents;
DROP POLICY IF EXISTS "Allow public insert Docs" ON public.documents;
DROP POLICY IF EXISTS "Allow public delete Docs" ON public.documents;

CREATE POLICY "Users can view own and household docs"
ON public.documents FOR SELECT
USING (
    user_id = auth.uid()
    OR (
        visibility = 'shared'
        AND household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
    )
);

CREATE POLICY "Users can create docs"
ON public.documents FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own docs"
ON public.documents FOR DELETE
USING (user_id = auth.uid());

-- PARTNER INVITATIONS
CREATE POLICY "Users can view invitations they sent or received"
ON public.partner_invitations FOR SELECT
USING (
    inviter_id = auth.uid()
    OR invitee_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can create invitations"
ON public.partner_invitations FOR INSERT
WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "Invitees can update invitation status"
ON public.partner_invitations FOR UPDATE
USING (
    invitee_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- VISION ALIGNMENTS
CREATE POLICY "Household members can view alignments"
ON public.vision_alignments FOR SELECT
USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
);

-- ACTIVITY FEED
CREATE POLICY "Household members can view activity"
ON public.household_activity FOR SELECT
USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can create activity"
ON public.household_activity FOR INSERT
WITH CHECK (user_id = auth.uid());
```

### 1.4 Database Functions & Triggers

```sql
-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function: Create profile and household on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_household_id UUID;
BEGIN
    -- Create a new household for the user
    INSERT INTO public.households (name)
    VALUES ('My Household')
    RETURNING id INTO new_household_id;

    -- Create the user profile
    INSERT INTO public.profiles (id, email, household_id, household_role)
    VALUES (
        NEW.id,
        NEW.email,
        new_household_id,
        'owner'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Accept partner invitation
CREATE OR REPLACE FUNCTION public.accept_partner_invitation(invitation_token TEXT)
RETURNS JSONB AS $$
DECLARE
    inv RECORD;
    user_profile RECORD;
    old_household_id UUID;
BEGIN
    -- Get invitation
    SELECT * INTO inv
    FROM public.partner_invitations
    WHERE invitation_token = accept_partner_invitation.invitation_token
    AND status = 'pending'
    AND expires_at > now();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
    END IF;

    -- Get current user profile
    SELECT * INTO user_profile
    FROM public.profiles
    WHERE id = auth.uid();

    IF user_profile.email != inv.invitee_email THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitation is for a different email');
    END IF;

    -- Store old household for cleanup
    old_household_id := user_profile.household_id;

    -- Update user to join new household
    UPDATE public.profiles
    SET
        household_id = inv.household_id,
        household_role = 'partner',
        updated_at = now()
    WHERE id = auth.uid();

    -- Update invitation status
    UPDATE public.partner_invitations
    SET
        status = 'accepted',
        accepted_at = now()
    WHERE id = inv.id;

    -- Delete old household if empty
    DELETE FROM public.households
    WHERE id = old_household_id
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE household_id = old_household_id);

    -- Create activity entry
    INSERT INTO public.household_activity (
        household_id, user_id, activity_type, title, description
    ) VALUES (
        inv.household_id,
        auth.uid(),
        'partner_joined',
        user_profile.first_name || ' joined the household',
        'Your partner has accepted the invitation and can now collaborate on vision boards and financial planning.'
    );

    RETURN jsonb_build_object(
        'success', true,
        'household_id', inv.household_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Generate Vision Alignment Score (called by Edge Function)
CREATE OR REPLACE FUNCTION public.update_vision_alignment(
    p_household_id UUID,
    p_overall_score INT,
    p_location_score INT,
    p_timeline_score INT,
    p_lifestyle_score INT,
    p_financial_score INT,
    p_ai_summary TEXT,
    p_shared_themes TEXT[],
    p_potential_conflicts TEXT[],
    p_recommendations TEXT[],
    p_vision_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
    alignment_id UUID;
BEGIN
    INSERT INTO public.vision_alignments (
        household_id,
        overall_alignment_score,
        location_alignment,
        timeline_alignment,
        lifestyle_alignment,
        financial_alignment,
        ai_summary,
        shared_themes,
        potential_conflicts,
        recommendations,
        analyzed_vision_ids
    ) VALUES (
        p_household_id,
        p_overall_score,
        p_location_score,
        p_timeline_score,
        p_lifestyle_score,
        p_financial_score,
        p_ai_summary,
        p_shared_themes,
        p_potential_conflicts,
        p_recommendations,
        p_vision_ids
    )
    RETURNING id INTO alignment_id;

    RETURN alignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Phase 2: TypeScript Types

### 2.1 New Type Definitions

Add to `types.ts`:

```typescript
// =====================================================
// COUPLES MODE TYPES
// =====================================================

export interface Profile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  birthDate?: string;
  targetRetirementYear?: number;
  dreamLocation?: string;
  householdId?: string;
  householdRole: 'owner' | 'partner' | 'viewer';
  notificationPreferences: NotificationPreferences;
  onboardingCompleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  partnerActivity: boolean;
}

export interface Household {
  id: string;
  name: string;
  combinedSavingsGoal?: number;
  combinedTargetYear?: number;
  sharedDreamLocation?: string;
  subscriptionTier: 'free' | 'pro' | 'elite';
  subscriptionExpiresAt?: string;
  settings: HouseholdSettings;
  createdAt: number;
  updatedAt: number;

  // Populated on fetch
  members?: Profile[];
}

export interface HouseholdSettings {
  shareFinancialData: boolean;
  shareVisionBoards: boolean;
  requirePartnerApproval: boolean;
}

export interface PartnerInvitation {
  id: string;
  householdId: string;
  inviterId: string;
  inviteeEmail: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  personalMessage?: string;
  invitationToken: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: number;

  // Populated on fetch
  inviter?: Profile;
}

export interface VisionAlignment {
  id: string;
  householdId: string;
  overallAlignmentScore: number;
  locationAlignment: number;
  timelineAlignment: number;
  lifestyleAlignment: number;
  financialAlignment: number;
  aiSummary: string;
  sharedThemes: string[];
  potentialConflicts: string[];
  recommendations: string[];
  analyzedVisionIds: string[];
  createdAt: number;
}

export interface HouseholdActivity {
  id: string;
  householdId: string;
  userId: string;
  activityType: ActivityType;
  entityType?: 'vision_board' | 'document' | 'task';
  entityId?: string;
  title: string;
  description?: string;
  metadata: Record<string, any>;
  readBy: string[];
  createdAt: number;

  // Populated on fetch
  user?: Profile;
}

export type ActivityType =
  | 'vision_created'
  | 'vision_refined'
  | 'financial_updated'
  | 'goal_completed'
  | 'bank_connected'
  | 'partner_joined'
  | 'partner_left'
  | 'alignment_generated';

// Extended VisionImage with couples features
export interface VisionImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: number;
  tags?: string[];
  isFavorite?: boolean;

  // Couples Mode Extensions
  userId?: string;
  householdId?: string;
  visibility: 'private' | 'shared';
  createdByName?: string;
}

// Extended Document with couples features
export interface Document {
  id: string;
  name: string;
  url?: string;
  type: 'UPLOAD' | 'MANUAL' | 'AI_INTERVIEW' | 'VISION';
  createdAt: number;
  structuredData?: any;

  // Couples Mode Extensions
  userId?: string;
  householdId?: string;
  visibility: 'private' | 'shared';
}

// Context for React
export interface CouplesContext {
  profile: Profile | null;
  household: Household | null;
  partner: Profile | null;
  pendingInvitations: PartnerInvitation[];
  latestAlignment: VisionAlignment | null;
  activityFeed: HouseholdActivity[];

  // Actions
  invitePartner: (email: string, message?: string) => Promise<void>;
  acceptInvitation: (token: string) => Promise<void>;
  declineInvitation: (id: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  updateHouseholdSettings: (settings: Partial<HouseholdSettings>) => Promise<void>;
  refreshAlignment: () => Promise<void>;
}
```

---

## Phase 3: Service Layer

### 3.1 New Service: `householdService.ts`

```typescript
// services/householdService.ts

import { supabase } from '../lib/supabase';
import {
  Profile,
  Household,
  PartnerInvitation,
  VisionAlignment,
  HouseholdActivity,
  HouseholdSettings
} from '../types';

/**
 * Household & Couples Mode Service
 */

// ==================== PROFILE ====================

export const getProfile = async (): Promise<Profile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;

  return mapProfile(data);
};

export const updateProfile = async (
  updates: Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Profile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name: updates.firstName,
      last_name: updates.lastName,
      avatar_url: updates.avatarUrl,
      birth_date: updates.birthDate,
      target_retirement_year: updates.targetRetirementYear,
      dream_location: updates.dreamLocation,
      notification_preferences: updates.notificationPreferences,
      onboarding_completed: updates.onboardingCompleted,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error || !data) return null;
  return mapProfile(data);
};

// ==================== HOUSEHOLD ====================

export const getHousehold = async (): Promise<Household | null> => {
  const profile = await getProfile();
  if (!profile?.householdId) return null;

  const { data, error } = await supabase
    .from('households')
    .select(`
      *,
      members:profiles(*)
    `)
    .eq('id', profile.householdId)
    .single();

  if (error || !data) return null;
  return mapHousehold(data);
};

export const updateHouseholdSettings = async (
  settings: Partial<HouseholdSettings>
): Promise<Household | null> => {
  const profile = await getProfile();
  if (!profile?.householdId || profile.householdRole !== 'owner') return null;

  const { data: current } = await supabase
    .from('households')
    .select('settings')
    .eq('id', profile.householdId)
    .single();

  const { data, error } = await supabase
    .from('households')
    .update({
      settings: { ...current?.settings, ...settings },
      updated_at: new Date().toISOString()
    })
    .eq('id', profile.householdId)
    .select()
    .single();

  if (error || !data) return null;
  return mapHousehold(data);
};

export const updateHouseholdName = async (name: string): Promise<void> => {
  const profile = await getProfile();
  if (!profile?.householdId) return;

  await supabase
    .from('households')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', profile.householdId);
};

// ==================== PARTNER INVITATIONS ====================

export const invitePartner = async (
  email: string,
  personalMessage?: string
): Promise<PartnerInvitation | null> => {
  const profile = await getProfile();
  if (!profile?.householdId) return null;

  // Check if already has a partner
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', profile.householdId);

  if ((count || 0) >= 2) {
    throw new Error('Household already has maximum members');
  }

  // Check for existing pending invitation
  const { data: existing } = await supabase
    .from('partner_invitations')
    .select('*')
    .eq('household_id', profile.householdId)
    .eq('invitee_email', email)
    .eq('status', 'pending')
    .single();

  if (existing) {
    throw new Error('An invitation is already pending for this email');
  }

  const { data, error } = await supabase
    .from('partner_invitations')
    .insert({
      household_id: profile.householdId,
      inviter_id: profile.id,
      invitee_email: email,
      personal_message: personalMessage
    })
    .select()
    .single();

  if (error) throw error;

  // TODO: Send invitation email via Edge Function
  await sendInvitationEmail(data.id);

  return mapInvitation(data);
};

export const getPendingInvitations = async (): Promise<PartnerInvitation[]> => {
  const profile = await getProfile();
  if (!profile) return [];

  // Get invitations sent by user OR received by user
  const { data, error } = await supabase
    .from('partner_invitations')
    .select(`
      *,
      inviter:profiles!inviter_id(*)
    `)
    .or(`inviter_id.eq.${profile.id},invitee_email.eq.${profile.email}`)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(mapInvitation);
};

export const acceptInvitation = async (token: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('accept_partner_invitation', {
    invitation_token: token
  });

  if (error || !data?.success) {
    throw new Error(data?.error || 'Failed to accept invitation');
  }

  return true;
};

export const declineInvitation = async (id: string): Promise<void> => {
  await supabase
    .from('partner_invitations')
    .update({ status: 'declined' })
    .eq('id', id);
};

export const cancelInvitation = async (id: string): Promise<void> => {
  const profile = await getProfile();

  await supabase
    .from('partner_invitations')
    .delete()
    .eq('id', id)
    .eq('inviter_id', profile?.id);
};

// ==================== LEAVE HOUSEHOLD ====================

export const leaveHousehold = async (): Promise<void> => {
  const profile = await getProfile();
  if (!profile?.householdId) return;

  // Create new household for leaving user
  const { data: newHousehold } = await supabase
    .from('households')
    .insert({ name: 'My Household' })
    .select()
    .single();

  if (!newHousehold) throw new Error('Failed to create new household');

  // Update profile to new household
  await supabase
    .from('profiles')
    .update({
      household_id: newHousehold.id,
      household_role: 'owner',
      updated_at: new Date().toISOString()
    })
    .eq('id', profile.id);

  // Log activity in old household
  await logActivity(profile.householdId, 'partner_left', {
    title: `${profile.firstName || 'Partner'} left the household`,
    description: 'Your partner has left the household. You can invite a new partner anytime.'
  });
};

// ==================== VISION ALIGNMENT ====================

export const getLatestAlignment = async (): Promise<VisionAlignment | null> => {
  const profile = await getProfile();
  if (!profile?.householdId) return null;

  const { data, error } = await supabase
    .from('vision_alignments')
    .select('*')
    .eq('household_id', profile.householdId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return mapAlignment(data);
};

export const generateVisionAlignment = async (): Promise<VisionAlignment | null> => {
  // This calls an Edge Function that:
  // 1. Fetches all vision boards for household
  // 2. Sends to Gemini for analysis
  // 3. Stores result in vision_alignments table

  const profile = await getProfile();
  if (!profile?.householdId) return null;

  const { data, error } = await supabase.functions.invoke('generate-vision-alignment', {
    body: { householdId: profile.householdId }
  });

  if (error) throw error;
  return data?.alignment || null;
};

// ==================== ACTIVITY FEED ====================

export const getActivityFeed = async (limit = 20): Promise<HouseholdActivity[]> => {
  const profile = await getProfile();
  if (!profile?.householdId) return [];

  const { data, error } = await supabase
    .from('household_activity')
    .select(`
      *,
      user:profiles!user_id(*)
    `)
    .eq('household_id', profile.householdId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(mapActivity);
};

export const logActivity = async (
  householdId: string,
  activityType: string,
  details: { title: string; description?: string; entityType?: string; entityId?: string; metadata?: any }
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('household_activity').insert({
    household_id: householdId,
    user_id: user.id,
    activity_type: activityType,
    title: details.title,
    description: details.description,
    entity_type: details.entityType,
    entity_id: details.entityId,
    metadata: details.metadata || {}
  });
};

export const markActivityRead = async (activityIds: string[]): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  for (const id of activityIds) {
    await supabase.rpc('mark_activity_read', {
      activity_id: id,
      user_id: user.id
    });
  }
};

// ==================== HELPERS ====================

const sendInvitationEmail = async (invitationId: string): Promise<void> => {
  await supabase.functions.invoke('send-partner-invitation', {
    body: { invitationId }
  });
};

// Mappers
const mapProfile = (row: any): Profile => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  avatarUrl: row.avatar_url,
  birthDate: row.birth_date,
  targetRetirementYear: row.target_retirement_year,
  dreamLocation: row.dream_location,
  householdId: row.household_id,
  householdRole: row.household_role,
  notificationPreferences: row.notification_preferences,
  onboardingCompleted: row.onboarding_completed,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime()
});

const mapHousehold = (row: any): Household => ({
  id: row.id,
  name: row.name,
  combinedSavingsGoal: row.combined_savings_goal,
  combinedTargetYear: row.combined_target_year,
  sharedDreamLocation: row.shared_dream_location,
  subscriptionTier: row.subscription_tier,
  subscriptionExpiresAt: row.subscription_expires_at,
  settings: row.settings,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  members: row.members?.map(mapProfile)
});

const mapInvitation = (row: any): PartnerInvitation => ({
  id: row.id,
  householdId: row.household_id,
  inviterId: row.inviter_id,
  inviteeEmail: row.invitee_email,
  status: row.status,
  personalMessage: row.personal_message,
  invitationToken: row.invitation_token,
  expiresAt: row.expires_at,
  acceptedAt: row.accepted_at,
  createdAt: new Date(row.created_at).getTime(),
  inviter: row.inviter ? mapProfile(row.inviter) : undefined
});

const mapAlignment = (row: any): VisionAlignment => ({
  id: row.id,
  householdId: row.household_id,
  overallAlignmentScore: row.overall_alignment_score,
  locationAlignment: row.location_alignment,
  timelineAlignment: row.timeline_alignment,
  lifestyleAlignment: row.lifestyle_alignment,
  financialAlignment: row.financial_alignment,
  aiSummary: row.ai_summary,
  sharedThemes: row.shared_themes,
  potentialConflicts: row.potential_conflicts,
  recommendations: row.recommendations,
  analyzedVisionIds: row.analyzed_vision_ids,
  createdAt: new Date(row.created_at).getTime()
});

const mapActivity = (row: any): HouseholdActivity => ({
  id: row.id,
  householdId: row.household_id,
  userId: row.user_id,
  activityType: row.activity_type,
  entityType: row.entity_type,
  entityId: row.entity_id,
  title: row.title,
  description: row.description,
  metadata: row.metadata,
  readBy: row.read_by,
  createdAt: new Date(row.created_at).getTime(),
  user: row.user ? mapProfile(row.user) : undefined
});
```

### 3.2 Modifications to `storageService.ts`

Update all CRUD operations to include `user_id` and `household_id`:

```typescript
// Updated saveVisionImage
export const saveVisionImage = async (
  image: VisionImage,
  householdId?: string,
  visibility: 'private' | 'shared' = 'shared'
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user?.id)
    .single();

  // ... existing upload logic ...

  const { error: dbError } = await supabase
    .from('vision_boards')
    .insert([{
      id: image.id,
      prompt: image.prompt,
      image_url: publicUrl,
      created_at: new Date(image.createdAt).toISOString(),
      is_favorite: image.isFavorite || false,
      // NEW: Couples Mode fields
      user_id: user?.id,
      household_id: householdId,
      visibility: visibility,
      created_by_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null
    }]);

  // Log activity
  if (householdId && visibility === 'shared') {
    await logActivity(householdId, 'vision_created', {
      title: `New vision board created`,
      description: image.prompt.substring(0, 100) + '...',
      entityType: 'vision_board',
      entityId: image.id
    });
  }
};

// Updated getVisionGallery - now returns both personal and shared
export const getVisionGallery = async (
  filter: 'all' | 'mine' | 'partner' = 'all'
): Promise<VisionImage[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  const profile = await getProfile();

  let query = supabase
    .from('vision_boards')
    .select('*')
    .order('created_at', { ascending: false });

  if (filter === 'mine') {
    query = query.eq('user_id', user?.id);
  } else if (filter === 'partner') {
    query = query
      .eq('household_id', profile?.householdId)
      .neq('user_id', user?.id)
      .eq('visibility', 'shared');
  } else {
    // All: my visions + shared household visions
    query = query.or(
      `user_id.eq.${user?.id},and(household_id.eq.${profile?.householdId},visibility.eq.shared)`
    );
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    url: row.image_url,
    prompt: row.prompt,
    createdAt: new Date(row.created_at).getTime(),
    isFavorite: row.is_favorite,
    userId: row.user_id,
    householdId: row.household_id,
    visibility: row.visibility,
    createdByName: row.created_by_name
  }));
};
```

---

## Phase 4: UI Components

### 4.1 New Components

#### `components/couples/HouseholdProvider.tsx`
React Context Provider for household state management.

#### `components/couples/PartnerInviteModal.tsx`
Modal for inviting a partner via email.

#### `components/couples/InvitationBanner.tsx`
Banner shown to users with pending invitations.

#### `components/couples/PartnerCard.tsx`
Displays partner profile with quick actions.

#### `components/couples/VisionAlignmentCard.tsx`
Shows alignment score with visual breakdown.

#### `components/couples/ActivityFeed.tsx`
Real-time feed of household activity.

#### `components/couples/HouseholdSettings.tsx`
Settings panel for household configuration.

#### `components/couples/VisionOwnerBadge.tsx`
Small badge showing who created a vision (You/Partner).

### 4.2 Component Specifications

#### PartnerInviteModal

```typescript
// components/couples/PartnerInviteModal.tsx

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onInviteSent: () => void;
}

/**
 * Features:
 * - Email input with validation
 * - Optional personal message textarea
 * - Preview of invitation email
 * - Loading state during send
 * - Success/error feedback
 */
```

#### VisionAlignmentCard

```typescript
// components/couples/VisionAlignmentCard.tsx

interface Props {
  alignment: VisionAlignment | null;
  onRefresh: () => Promise<void>;
}

/**
 * Features:
 * - Overall score as large circular progress
 * - Breakdown bars for each category:
 *   - Location (🌍)
 *   - Timeline (📅)
 *   - Lifestyle (🏠)
 *   - Financial (💰)
 * - Shared themes as tags
 * - Potential conflicts with resolution tips
 * - "Refresh Analysis" button
 * - Empty state when no partner
 */
```

#### ActivityFeed

```typescript
// components/couples/ActivityFeed.tsx

interface Props {
  activities: HouseholdActivity[];
  onActivityClick?: (activity: HouseholdActivity) => void;
}

/**
 * Features:
 * - Grouped by date
 * - Partner avatar and name
 * - Activity icon based on type
 * - Relative timestamps
 * - Unread indicator
 * - Click to navigate to entity
 */
```

### 4.3 Updated Gallery Component

```typescript
// Updated components/Gallery.tsx

/**
 * New Features:
 * - Filter tabs: "All" | "My Visions" | "Partner's Visions"
 * - Owner badge on each vision card
 * - Combined view with visual separation
 * - Alignment score widget in header
 */
```

### 4.4 Updated Navbar

```typescript
// Updated App.tsx Navbar

/**
 * New Features:
 * - Partner avatar next to user avatar (if connected)
 * - Household name display
 * - Notification bell with unread count
 * - Quick invite button (if no partner)
 */
```

---

## Phase 5: User Flows

### 5.1 Partner Invitation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    INVITATION FLOW                          │
└─────────────────────────────────────────────────────────────┘

USER A (Inviter):
1. Click "Invite Partner" button in navbar/settings
2. Enter partner's email address
3. (Optional) Add personal message
4. Click "Send Invitation"
5. See confirmation: "Invitation sent to lisa@email.com"
6. Invitation appears in "Pending Invitations" list

USER B (Invitee):
1. Receives email with invitation link
2. Clicks link → Opens app
   - If logged in with matching email: Show acceptance modal
   - If not logged in: Redirect to signup with invitation context
   - If logged in with different email: Show error
3. Sees invitation details:
   - Inviter's name and avatar
   - Household name
   - Personal message
4. Click "Accept" or "Decline"
5. If accepted:
   - Profile updated with new household
   - Redirected to combined dashboard
   - Welcome modal shown
6. If declined:
   - Invitation marked declined
   - Inviter notified
```

### 5.2 Combined Dashboard Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 COMBINED DASHBOARD                          │
└─────────────────────────────────────────────────────────────┘

LANDING PAGE (After Login):
┌────────────────────────────────────────────────────────────┐
│  The Overton Family Vision          [Milton 👤] [Lisa 👤]  │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ ALIGNMENT SCORE  │  │ RECENT ACTIVITY              │   │
│  │      87%         │  │ • Lisa refined beach vision  │   │
│  │ ████████░░       │  │ • Milton updated finances    │   │
│  │ Location: 92%    │  │ • Alignment score improved   │   │
│  │ Timeline: 85%    │  │                              │   │
│  │ Lifestyle: 90%   │  │ [View All →]                 │   │
│  │ Financial: 81%   │  └──────────────────────────────┘   │
│  │ [Refresh]        │                                      │
│  └──────────────────┘                                      │
├────────────────────────────────────────────────────────────┤
│  SHARED VISIONS                                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│  │ Beach  │ │ Garden │ │ Travel │ │ Family │             │
│  │ 🏖️     │ │ 🌻     │ │ ✈️     │ │ 👨‍👩‍👧    │             │
│  │ Milton │ │ Lisa   │ │ Shared │ │ Lisa   │             │
│  └────────┘ └────────┘ └────────┘ └────────┘             │
│                                                            │
│  [+ Create New Vision]                                     │
└────────────────────────────────────────────────────────────┘
```

### 5.3 Vision Board Filter Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   GALLERY FILTERS                           │
└─────────────────────────────────────────────────────────────┘

TABS:
[All Visions] [My Visions (12)] [Partner's Visions (8)]

CARD DISPLAY:
┌──────────────────┐
│                  │
│   [IMAGE]        │
│                  │
├──────────────────┤
│ Beach Retirement │
│ Created by Lisa  │  ← Owner badge
│ Dec 15, 2025     │
│ [♡] [📤] [🖨️]   │  ← Actions
└──────────────────┘

VISIBILITY TOGGLE (on create/edit):
○ Shared with Partner (visible in household)
○ Private (only visible to me)
```

---

## Phase 6: Edge Functions

### 6.1 Send Partner Invitation Email

```typescript
// supabase/functions/send-partner-invitation/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { invitationId } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Fetch invitation with inviter details
  const { data: invitation } = await supabase
    .from('partner_invitations')
    .select(`
      *,
      inviter:profiles!inviter_id(*),
      household:households(*)
    `)
    .eq('id', invitationId)
    .single();

  if (!invitation) {
    return new Response(JSON.stringify({ error: 'Invitation not found' }), { status: 404 });
  }

  // Generate invitation URL
  const inviteUrl = `${Deno.env.get('APP_URL')}/invite/${invitation.invitation_token}`;

  // Send email via Resend/SendGrid
  // ...email sending logic...

  return new Response(JSON.stringify({ success: true }));
});
```

### 6.2 Generate Vision Alignment

```typescript
// supabase/functions/generate-vision-alignment/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai';

serve(async (req) => {
  const { householdId } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Fetch all shared visions for household
  const { data: visions } = await supabase
    .from('vision_boards')
    .select('id, prompt, user_id, created_by_name')
    .eq('household_id', householdId)
    .eq('visibility', 'shared');

  if (!visions || visions.length < 2) {
    return new Response(JSON.stringify({
      error: 'Need at least 2 shared visions for alignment analysis'
    }), { status: 400 });
  }

  // Group by user
  const userVisions = visions.reduce((acc, v) => {
    if (!acc[v.user_id]) acc[v.user_id] = [];
    acc[v.user_id].push(v);
    return acc;
  }, {} as Record<string, typeof visions>);

  // Initialize Gemini
  const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
    Analyze these retirement vision statements from two partners and score their alignment.

    Partner 1 Visions:
    ${Object.values(userVisions)[0]?.map(v => `- ${v.prompt}`).join('\n')}

    Partner 2 Visions:
    ${Object.values(userVisions)[1]?.map(v => `- ${v.prompt}`).join('\n')}

    Provide a JSON response with:
    {
      "overallScore": 0-100,
      "locationAlignment": 0-100,
      "timelineAlignment": 0-100,
      "lifestyleAlignment": 0-100,
      "financialAlignment": 0-100,
      "summary": "Brief paragraph about their alignment",
      "sharedThemes": ["theme1", "theme2"],
      "potentialConflicts": ["conflict1 with resolution hint"],
      "recommendations": ["recommendation1", "recommendation2"]
    }
  `;

  const result = await model.generateContent(prompt);
  const analysis = JSON.parse(result.response.text());

  // Store in database
  const { data: alignment } = await supabase.rpc('update_vision_alignment', {
    p_household_id: householdId,
    p_overall_score: analysis.overallScore,
    p_location_score: analysis.locationAlignment,
    p_timeline_score: analysis.timelineAlignment,
    p_lifestyle_score: analysis.lifestyleAlignment,
    p_financial_score: analysis.financialAlignment,
    p_ai_summary: analysis.summary,
    p_shared_themes: analysis.sharedThemes,
    p_potential_conflicts: analysis.potentialConflicts,
    p_recommendations: analysis.recommendations,
    p_vision_ids: visions.map(v => v.id)
  });

  // Log activity
  await supabase.from('household_activity').insert({
    household_id: householdId,
    user_id: (await supabase.auth.getUser()).data.user?.id,
    activity_type: 'alignment_generated',
    title: 'Vision alignment updated',
    description: `New alignment score: ${analysis.overallScore}%`,
    metadata: { score: analysis.overallScore }
  });

  return new Response(JSON.stringify({ alignment }));
});
```

---

## Phase 7: Implementation Timeline

### Week 1: Database & Backend
- [ ] Create and test all new database tables
- [ ] Implement RLS policies
- [ ] Create database functions and triggers
- [ ] Test profile auto-creation on signup

### Week 2: Service Layer
- [ ] Implement `householdService.ts`
- [ ] Update `storageService.ts` with household support
- [ ] Create Edge Functions (invitation email, alignment)
- [ ] Test all service functions

### Week 3: Core UI Components
- [ ] Create `HouseholdProvider` context
- [ ] Build `PartnerInviteModal`
- [ ] Build `InvitationBanner`
- [ ] Build `PartnerCard`
- [ ] Update navbar with partner display

### Week 4: Feature Components
- [ ] Build `VisionAlignmentCard`
- [ ] Build `ActivityFeed`
- [ ] Build `HouseholdSettings`
- [ ] Update Gallery with filters
- [ ] Add owner badges to vision cards

### Week 5: Integration & Testing
- [ ] Full invitation flow testing
- [ ] Combined dashboard testing
- [ ] Vision sharing and visibility testing
- [ ] Alignment generation testing
- [ ] Mobile responsiveness

### Week 6: Polish & Launch
- [ ] Error handling and edge cases
- [ ] Loading states and animations
- [ ] Onboarding flow for couples
- [ ] Documentation
- [ ] Production deployment

---

## Phase 8: Testing Checklist

### Functional Tests
- [ ] User can invite partner via email
- [ ] Partner receives invitation email with correct link
- [ ] Partner can accept invitation and join household
- [ ] Partner can decline invitation
- [ ] Inviter can cancel pending invitation
- [ ] User can see partner's shared vision boards
- [ ] User cannot see partner's private vision boards
- [ ] User can toggle vision visibility
- [ ] Alignment score generates correctly
- [ ] Activity feed updates in real-time
- [ ] User can leave household
- [ ] Leaving user gets new household
- [ ] Household settings save correctly

### Security Tests
- [ ] RLS prevents access to other households
- [ ] Cannot accept invitation for different email
- [ ] Cannot modify partner's vision boards
- [ ] Invitation tokens are single-use
- [ ] Expired invitations cannot be accepted

### Edge Cases
- [ ] User with existing visions invites partner
- [ ] Partner with existing visions accepts invitation
- [ ] Both partners delete their accounts
- [ ] Network failure during invitation accept
- [ ] Concurrent invitation updates

---

## Summary

This implementation plan provides a complete roadmap for adding Couples/Partner Mode to Visionary. The feature touches every layer of the application:

1. **Database**: New tables for profiles, households, invitations, alignments, and activity
2. **Backend**: New service layer and Edge Functions
3. **Frontend**: New components and updated existing views
4. **AI Integration**: Vision alignment analysis via Gemini

The phased approach allows for incremental development and testing, with a target completion of 6 weeks for full feature implementation.
