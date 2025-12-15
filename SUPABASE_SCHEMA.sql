-- Complete Supabase Database Schema for Visionary App
-- Run this in: Supabase Dashboard → SQL Editor → New Query

-- ========================================
-- 1. CREATE STORAGE BUCKETS
-- ========================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('visions', 'visions', true) 
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true) 
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 2. STORAGE POLICIES
-- ========================================

-- Visions Bucket
DROP POLICY IF EXISTS "Public Access Visions" ON storage.objects;
CREATE POLICY "Public Access Visions" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'visions' );

DROP POLICY IF EXISTS "Public Upload Visions" ON storage.objects;
CREATE POLICY "Public Upload Visions" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'visions' );

DROP POLICY IF EXISTS "Public Delete Visions" ON storage.objects;
CREATE POLICY "Public Delete Visions" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'visions' );

-- Documents Bucket
DROP POLICY IF EXISTS "Public Access Docs" ON storage.objects;
CREATE POLICY "Public Access Docs" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'documents' );

DROP POLICY IF EXISTS "Public Upload Docs" ON storage.objects;
CREATE POLICY "Public Upload Docs" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'documents' );

DROP POLICY IF EXISTS "Public Delete Docs" ON storage.objects;
CREATE POLICY "Public Delete Docs" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'documents' );

-- ========================================
-- 3. CREATE TABLES
-- ========================================

-- Profiles (Credits & Subscriptions) - MUST BE FIRST
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  credits INT DEFAULT 3,
  subscription_tier TEXT DEFAULT 'FREE', -- 'FREE', 'PRO', 'ELITE'
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'inactive', -- 'inactive', 'active', 'cancelled'
  onboarding_completed BOOLEAN DEFAULT false,
  financial_target INT,
  primary_vision_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- User Identity Profiles (Theme Selection)
CREATE TABLE IF NOT EXISTS public.user_identity_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  theme_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- User Vision Profiles (Onboarding summary for scene prompt generation)
CREATE TABLE IF NOT EXISTS public.user_vision_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  vision_text TEXT,
  financial_target NUMERIC,
  financial_target_label TEXT,
  primary_vision_url TEXT,
  primary_vision_id UUID,
  domain TEXT  -- e.g. 'RETIREMENT', 'CAREER', 'TRAVEL', 'HEALTH'
);

-- Migration for existing databases:
-- ALTER TABLE public.user_vision_profiles ADD COLUMN IF NOT EXISTS domain TEXT;

-- Vision Boards
CREATE TABLE IF NOT EXISTS public.vision_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    prompt TEXT NOT NULL,
    image_url TEXT NOT NULL,
   is_favorite BOOLEAN DEFAULT false
);

-- Reference Images
CREATE TABLE IF NOT EXISTS public.reference_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    image_url TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    identity_description TEXT  -- Neutral physical description for identity preservation
);

-- Migration for existing databases:
-- ALTER TABLE public.reference_images ADD COLUMN IF NOT EXISTS identity_description TEXT;

-- Financial Documents (Knowledge Base)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL, -- 'UPLOAD', 'MANUAL', 'AI_INTERVIEW', 'VISION'
    structured_data JSONB, -- The parsed financial data
    tags TEXT[] DEFAULT '{}',
    user_id UUID REFERENCES auth.users ON DELETE CASCADE
);

-- Action Tasks
CREATE TABLE IF NOT EXISTS public.action_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    type TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    milestone_year INT,
    ai_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habits
CREATE TABLE IF NOT EXISTS public.habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    task_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    frequency TEXT NOT NULL,
    custom_days INT[],
    reminder_time TEXT,
    is_active BOOLEAN DEFAULT true,
    current_streak INT DEFAULT 0,
    last_completed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habit Completions
CREATE TABLE IF NOT EXISTS public.habit_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id UUID REFERENCES public.habits ON DELETE CASCADE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    notes TEXT,
    mood_rating INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Poster Orders
CREATE TABLE IF NOT EXISTS public.poster_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    vision_board_id UUID,
    vendor_order_id TEXT,
    status TEXT DEFAULT 'pending', -- pending, submitted, shipped
    total_price NUMERIC(10, 2),
    discount_applied BOOLEAN DEFAULT false,
    shipping_address JSONB, -- Stores name, address, city, etc.
    print_config JSONB -- Stores size, finish, sku
);

-- Workbook Templates
CREATE TABLE IF NOT EXISTS public.workbook_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    page_count INT,
    size TEXT,
    binding TEXT,
    base_price NUMERIC(10, 2) NOT NULL,
    shipping_estimate NUMERIC(10, 2),
    preview_image_url TEXT,
    features TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Workbook Orders
CREATE TABLE IF NOT EXISTS public.workbook_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES public.workbook_templates ON DELETE SET NULL,
    status TEXT DEFAULT 'pending',
    pdf_url TEXT,
    prodigi_order_id TEXT,
    total_price NUMERIC(10, 2),
    shipping_address JSONB,
    customization_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Financial Automation Tables (Optional)
CREATE TABLE IF NOT EXISTS public.plaid_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    access_token TEXT NOT NULL, -- In production, this must be encrypted
    institution_id TEXT,
    status TEXT DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS public.automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    goal_id TEXT, 
    source_account_id TEXT NOT NULL,
    destination_account_id TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    frequency TEXT DEFAULT 'MONTHLY',
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.transfer_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    rule_id UUID REFERENCES public.automation_rules(id),
    amount NUMERIC(12, 2) NOT NULL,
    status TEXT, -- PENDING, SETTLED, FAILED
    ai_rationale TEXT
);

-- ========================================
-- 4. CREATE TRIGGERS
-- ========================================

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, credits, subscription_tier)
  VALUES (new.id, 3, 'FREE')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ========================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE public.vision_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poster_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_identity_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vision_profiles ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 6. CREATE POLICIES
-- ========================================

-- Vision Boards
DROP POLICY IF EXISTS "Allow public read VB" ON public.vision_boards;
CREATE POLICY "Allow public read VB" ON public.vision_boards FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert VB" ON public.vision_boards;
CREATE POLICY "Allow public insert VB" ON public.vision_boards FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public delete VB" ON public.vision_boards;
CREATE POLICY "Allow public delete VB" ON public.vision_boards FOR DELETE USING (true);
DROP POLICY IF EXISTS "Allow public update VB" ON public.vision_boards;
CREATE POLICY "Allow public update VB" ON public.vision_boards FOR UPDATE USING (true);

-- Reference Images
DROP POLICY IF EXISTS "Allow public read RI" ON public.reference_images;
CREATE POLICY "Allow public read RI" ON public.reference_images FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert RI" ON public.reference_images;
CREATE POLICY "Allow public insert RI" ON public.reference_images FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public delete RI" ON public.reference_images;
CREATE POLICY "Allow public delete RI" ON public.reference_images FOR DELETE USING (true);

-- Documents
DROP POLICY IF EXISTS "Allow public read Docs" ON public.documents;
CREATE POLICY "Allow public read Docs" ON public.documents FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert Docs" ON public.documents;
CREATE POLICY "Allow public insert Docs" ON public.documents FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public delete Docs" ON public.documents;
CREATE POLICY "Allow public delete Docs" ON public.documents FOR DELETE USING (true);

-- Action Tasks  
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.action_tasks;
CREATE POLICY "Users can manage own tasks" 
ON public.action_tasks 
FOR ALL USING (auth.uid() = user_id);

-- Habits
DROP POLICY IF EXISTS "Users can manage own habits" ON public.habits;
CREATE POLICY "Users can manage own habits" 
ON public.habits 
FOR ALL USING (auth.uid() = user_id);

-- Habit Completions
DROP POLICY IF EXISTS "Users can manage completions" ON public.habit_completions;
CREATE POLICY "Users can manage completions" 
ON public.habit_completions 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.habits 
    WHERE habits.id = habit_completions.habit_id 
    AND habits.user_id = auth.uid()
  )
);

-- Financial Automation
DROP POLICY IF EXISTS "Allow public read Auto" ON public.automation_rules;
CREATE POLICY "Allow public read Auto" ON public.automation_rules FOR SELECT USING (true);

-- Print Orders
DROP POLICY IF EXISTS "Users can view own orders" ON public.poster_orders;
CREATE POLICY "Users can view own orders" 
ON public.poster_orders FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create orders" ON public.poster_orders;
CREATE POLICY "Users can create orders" 
ON public.poster_orders FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Workbook Templates (Public Read)
DROP POLICY IF EXISTS "Public can read templates" ON public.workbook_templates;
CREATE POLICY "Public can read templates" 
ON public.workbook_templates FOR SELECT 
USING (is_active = true);

-- Workbook Orders
DROP POLICY IF EXISTS "Users can manage own workbook orders" ON public.workbook_orders;
CREATE POLICY "Users can manage own workbook orders" 
ON public.workbook_orders 
FOR ALL USING (auth.uid() = user_id);

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- User Identity Profiles
DROP POLICY IF EXISTS "Users can manage own identity" ON public.user_identity_profiles;
CREATE POLICY "Users can manage own identity"
ON public.user_identity_profiles
FOR ALL USING (auth.uid() = user_id);

-- User Vision Profiles
DROP POLICY IF EXISTS "Users can manage own vision profile" ON public.user_vision_profiles;
CREATE POLICY "Users can manage own vision profile"
ON public.user_vision_profiles
FOR ALL USING (auth.uid() = user_id);

-- ========================================
-- SETUP COMPLETE!
-- ========================================
-- You can now use your Visionary app with a fully configured database.