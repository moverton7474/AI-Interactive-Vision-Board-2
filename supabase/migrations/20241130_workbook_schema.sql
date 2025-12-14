-- ============================================
-- VISION WORKBOOK DATABASE SCHEMA
-- Migration: 20241129_workbook_schema
-- Description: Adds tables for physical printed workbook
--              products via Prodigi integration
-- ============================================

-- 1. Workbook Templates (Product Catalog)
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

-- 2. Workbook Orders
CREATE TABLE IF NOT EXISTS workbook_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES workbook_templates(id),
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'generating', 'ready', 'pending_payment',
    'paid', 'submitted', 'printing', 'shipped', 'delivered', 'cancelled'
  )),

  -- Content References
  vision_board_ids UUID[] DEFAULT '{}',
  action_plan_id UUID,
  financial_snapshot JSONB DEFAULT '{}',
  included_habits UUID[] DEFAULT '{}',

  -- Generated Assets
  cover_pdf_url TEXT,
  interior_pdf_url TEXT,
  merged_pdf_url TEXT,
  preview_images JSONB DEFAULT '[]',

  -- Customization
  title TEXT,
  subtitle TEXT,
  dedication_text TEXT,
  cover_style TEXT DEFAULT 'classic',
  include_weekly_journal BOOLEAN DEFAULT TRUE,
  include_habit_tracker BOOLEAN DEFAULT TRUE,

  -- Shipping
  shipping_address JSONB,

  -- Pricing
  subtotal DECIMAL(10,2),
  discount_amount DECIMAL(10,2) DEFAULT 0,
  shipping_cost DECIMAL(10,2),
  total_price DECIMAL(10,2),
  discount_code TEXT,
  discount_applied BOOLEAN DEFAULT FALSE,

  -- Prodigi Integration
  prodigi_order_id TEXT,
  prodigi_status TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  estimated_delivery DATE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  generation_started_at TIMESTAMPTZ,
  generation_completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- 3. Workbook Sections (Generated Content)
CREATE TABLE IF NOT EXISTS workbook_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_order_id UUID REFERENCES workbook_orders(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK (section_type IN (
    'cover', 'title_page', 'dedication', 'coach_letter',
    'vision_gallery', 'financial_snapshot', 'action_plan',
    'habit_tracker', 'weekly_journal', 'appendix', 'notes', 'back_cover'
  )),
  section_order INT NOT NULL,
  page_start INT,
  page_end INT,
  title TEXT,
  content JSONB DEFAULT '{}',
  html_template TEXT,
  pdf_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'complete', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Knowledge Base (Aggregated Data for Workbook/AI)
CREATE TABLE IF NOT EXISTS user_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Profile Summary
  names TEXT,
  retirement_year INT,
  dream_locations TEXT[] DEFAULT '{}',

  -- Financial Summary
  financial_summary JSONB DEFAULT '{}',
  plaid_accounts_summary JSONB DEFAULT '{}',
  monthly_budget DECIMAL(10,2),
  retirement_goal DECIMAL(10,2),

  -- Vision Summary
  vision_statements TEXT[] DEFAULT '{}',
  top_priorities TEXT[] DEFAULT '{}',
  vision_board_count INT DEFAULT 0,

  -- Goals & Actions
  goals_summary JSONB DEFAULT '{}',
  milestones JSONB DEFAULT '[]',
  active_tasks_count INT DEFAULT 0,
  completed_tasks_count INT DEFAULT 0,

  -- Habits
  habits_summary JSONB DEFAULT '{}',
  active_habits_count INT DEFAULT 0,
  total_streak_days INT DEFAULT 0,

  -- AI Context
  conversation_insights TEXT,
  recommended_focus_areas TEXT[] DEFAULT '{}',
  agent_notes TEXT,
  sentiment_trend TEXT,

  -- Data Provenance
  data_sources JSONB DEFAULT '[]',
  last_plaid_sync TIMESTAMPTZ,
  last_compiled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SEED DATA: Default Workbook Templates
-- ============================================

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
ON CONFLICT (sku) DO NOTHING;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_workbook_orders_user ON workbook_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_workbook_orders_status ON workbook_orders(status);
CREATE INDEX IF NOT EXISTS idx_workbook_sections_order ON workbook_sections(workbook_order_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_user ON user_knowledge_base(user_id);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE workbook_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workbook_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE workbook_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Templates are public read
CREATE POLICY "Anyone can view active templates" ON workbook_templates
  FOR SELECT USING (is_active = TRUE);

-- Users own their orders
CREATE POLICY "Users own their workbook orders" ON workbook_orders
  FOR ALL USING (auth.uid() = user_id);

-- Users access their order sections
CREATE POLICY "Users access their workbook sections" ON workbook_sections
  FOR ALL USING (workbook_order_id IN (SELECT id FROM workbook_orders WHERE user_id = auth.uid()));

-- Users own their knowledge base
CREATE POLICY "Users own their knowledge base" ON user_knowledge_base
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to compile user knowledge base
CREATE OR REPLACE FUNCTION compile_user_knowledge_base(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO user_knowledge_base (user_id, last_compiled_at)
  VALUES (p_user_id, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    vision_board_count = (
      SELECT COUNT(*) FROM vision_boards WHERE user_id = p_user_id
    ),
    active_habits_count = (
      SELECT COUNT(*) FROM habits WHERE user_id = p_user_id AND is_active = TRUE
    ),
    last_compiled_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update order timestamps
CREATE OR REPLACE FUNCTION update_workbook_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Set specific timestamps based on status changes
  IF NEW.status = 'generating' AND OLD.status = 'draft' THEN
    NEW.generation_started_at = NOW();
  ELSIF NEW.status = 'ready' AND OLD.status = 'generating' THEN
    NEW.generation_completed_at = NOW();
  ELSIF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    NEW.paid_at = NOW();
  ELSIF NEW.status = 'submitted' AND OLD.status != 'submitted' THEN
    NEW.submitted_at = NOW();
  ELSIF NEW.status = 'shipped' AND OLD.status != 'shipped' THEN
    NEW.shipped_at = NOW();
  ELSIF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    NEW.delivered_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workbook_order_timestamp_trigger
  BEFORE UPDATE ON workbook_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_workbook_order_timestamp();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE workbook_templates IS 'Product catalog for printable Vision Workbooks via Prodigi';
COMMENT ON TABLE workbook_orders IS 'User orders for physical printed workbooks';
COMMENT ON TABLE workbook_sections IS 'Generated sections/pages within a workbook order';
COMMENT ON TABLE user_knowledge_base IS 'Aggregated user data for AI agent context and workbook generation';
