# Vision Workbook - Physical Print Product Plan

**Created:** November 29, 2024
**Status:** Planning Phase

## 1. Product Overview

The **Vision Workbook** is a premium physical printed notebook that transforms the user's digital vision boards, financial plans, and action roadmaps into a tangible workbook they can hold, write in, and reference daily.

### Product Philosophy
> "Your dreams deserve to be held, not just scrolled."

Unlike a simple poster print, the Vision Workbook is an **interactive journal** that combines AI-generated content with structured workbook pages for ongoing engagement.

---

## 2. Workbook Contents

### Front Matter
- **Personalized Cover**: User's name + primary vision statement + AI-generated cover image
- **Title Page**: "The [Family Name] Vision Workbook - [Target Year]"
- **Letter from Vision Coach**: AI-generated personal message based on user's goals

### Section 1: Vision Gallery (8-12 pages)
- Full-page prints of user's top vision board images
- Each image has a facing page with:
  - The original prompt/description
  - "Why This Matters" reflection space
  - Action triggers tied to this vision

### Section 2: Financial Reality Check (6-8 pages)
- Current Financial Snapshot (from Plaid or manual entry)
- Retirement Goal Calculator results
- Cost of Living comparison (if international retirement)
- Monthly savings target breakdown
- Net worth tracking template (blank for user updates)

### Section 3: 3-Year Action Roadmap (12-16 pages)
- Year-by-year milestone breakdown
- Quarter-by-quarter task lists
- Deep links rendered as QR codes (Gmail, Calendar, Maps)
- Progress checkboxes for each action item

### Section 4: Habit Tracker (12 pages)
- Monthly habit grid templates (12 months)
- Streak tracking visualization
- Daily micro-actions tied to vision goals
- Weekly reflection prompts

### Section 5: Weekly Review Journal (52 pages)
- One page per week for the year
- Structured prompts:
  - "3 Wins This Week"
  - "Biggest Blocker"
  - "Next Week's Focus"
  - "Mood Check (1-5)"

### Back Matter
- Resource appendix (links as QR codes)
- Notes pages (10 blank pages)
- Achievement badge sticker page (printed)

---

## 3. Prodigi Integration

### Product SKUs (Notebooks)

| Product | SKU | Pages | Size | Price Point |
|---------|-----|-------|------|-------------|
| Softcover Journal | GLOBAL-NTB-A5-SC | 100 | A5 (5.8x8.3") | $24.99 |
| Hardcover Notebook | GLOBAL-NTB-A5-HC | 100 | A5 (5.8x8.3") | $34.99 |
| Premium Hardcover | GLOBAL-NTB-A4-HC | 120 | A4 (8.3x11.7") | $49.99 |
| Executive Edition | GLOBAL-NTB-LTR-HC | 150 | Letter (8.5x11") | $59.99 |

### Cover Options
- Full-wrap custom cover (front, spine, back)
- User's primary vision image as background
- Foil stamping option for premium tier

### Interior Printing
- Full color interior pages
- PDF upload (single merged PDF)
- Page templates designed for print margins

---

## 4. Database Schema

### Table: `workbook_templates`
```sql
CREATE TABLE workbook_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT NOT NULL,
  page_count INT NOT NULL,
  size TEXT NOT NULL,
  binding TEXT CHECK (binding IN ('softcover', 'hardcover')),
  base_price DECIMAL(10,2) NOT NULL,
  preview_image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `workbook_orders`
```sql
CREATE TABLE workbook_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES workbook_templates(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'paid', 'submitted', 'printing', 'shipped', 'delivered')),

  -- Content References
  vision_board_ids UUID[] DEFAULT '{}',
  action_plan_id UUID,
  financial_snapshot JSONB DEFAULT '{}',

  -- Generated Assets
  cover_pdf_url TEXT,
  interior_pdf_url TEXT,
  merged_pdf_url TEXT,

  -- Order Details
  title TEXT,
  subtitle TEXT,
  dedication_text TEXT,

  -- Shipping
  shipping_address JSONB,

  -- Pricing
  total_price DECIMAL(10,2),
  discount_applied BOOLEAN DEFAULT FALSE,

  -- Prodigi
  prodigi_order_id TEXT,
  tracking_number TEXT,
  tracking_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ
);
```

### Table: `workbook_sections`
```sql
CREATE TABLE workbook_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_order_id UUID REFERENCES workbook_orders(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK (section_type IN (
    'cover', 'title_page', 'letter', 'vision_gallery',
    'financial', 'action_plan', 'habit_tracker',
    'weekly_journal', 'appendix', 'notes'
  )),
  page_start INT,
  page_end INT,
  content JSONB DEFAULT '{}',
  pdf_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'complete', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `user_knowledge_base`
```sql
CREATE TABLE user_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Aggregated Data from All Sources
  financial_summary JSONB DEFAULT '{}',
  vision_statements TEXT[] DEFAULT '{}',
  goals_summary JSONB DEFAULT '{}',
  habits_summary JSONB DEFAULT '{}',
  action_plan_summary JSONB DEFAULT '{}',

  -- AI Agent Context
  conversation_insights TEXT,
  recommended_focus_areas TEXT[] DEFAULT '{}',

  -- Metadata
  last_compiled_at TIMESTAMPTZ,
  data_sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Edge Functions

### `generate-workbook-pdf`
**Purpose:** Compile user data and generate printable PDF

**Flow:**
1. Receive workbook_order_id
2. Fetch all relevant user data (visions, plans, finances, habits)
3. Generate HTML templates for each section
4. Use Puppeteer/Playwright to render PDF pages
5. Merge all sections into single interior PDF
6. Generate cover PDF separately
7. Upload to Supabase Storage
8. Update workbook_order with URLs

**Tech Stack:**
- Deno + Puppeteer (for PDF generation)
- Or: External service like DocRaptor/PDFShift

### `compile-knowledge-base`
**Purpose:** Aggregate all user data into structured knowledge base

**Triggers:**
- After new vision board created
- After action plan generated
- After financial data updated
- Before workbook generation

---

## 6. Frontend Components

### `WorkbookOrderModal.tsx`
Similar to PrintOrderModal but with:
- Template selection (Softcover/Hardcover/Premium)
- Content selection (which vision boards to include)
- Customization (title, dedication text)
- Preview thumbnails
- Progress indicator during generation
- **Smart Empty States**: Direct creation of Vision Boards/Habits from within the modal

### `WorkbookBuilder.tsx`
Interactive workbook configurator:
- Drag-and-drop section ordering
- Vision board selector
- Cover customization tool
- Real-time page count estimate

### `WorkbookPreview.tsx`
PDF preview component:
- Page-by-page flipbook view
- Download draft PDF option
- Approval before final order

---

## 7. User Flow

```
┌─────────────────┐
│  Gallery View   │
│  "Print Book"   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Template Select │
│ (Size/Binding)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Content Select  │
│ (Visions/Plans) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Customize Cover │
│ (Title/Subtitle)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Preview & Edit  │ ◄─── (Optional editing loop)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Shipping Entry  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stripe Checkout │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PDF Generated  │
│  Sent to Prodigi│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Order Tracking  │
└─────────────────┘
```

---

## 8. Pricing Strategy

| Tier | Product | Our Price | Prodigi Cost* | Margin |
|------|---------|-----------|---------------|--------|
| Starter | Softcover A5 | $29.99 | ~$12 | $17.99 |
| Standard | Hardcover A5 | $44.99 | ~$18 | $26.99 |
| Premium | Hardcover A4 | $64.99 | ~$25 | $39.99 |
| Executive | Letter HC | $79.99 | ~$30 | $49.99 |

*Estimated Prodigi costs - verify with actual API

### Discounts
- **First Workbook**: 20% off
- **Subscriber Perk**: Free softcover with Elite tier
- **Bundle**: Poster + Workbook = 15% off

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create database tables
- [ ] Add TypeScript types
- [ ] Research Prodigi notebook SKUs
- [ ] Design basic page templates

### Phase 2: PDF Generation (Week 2-3)
- [ ] Build `generate-workbook-pdf` Edge Function
- [ ] Create HTML templates for each section
- [ ] Test PDF output quality
- [ ] Set up Supabase Storage buckets

### Phase 3: Frontend (Week 3-4)
- [ ] Build WorkbookOrderModal component
- [ ] Add template selection UI
- [ ] Implement content picker
- [ ] Create cover customization tool

### Phase 4: Integration (Week 4-5)
- [ ] Update submit-to-prodigi for notebooks
- [ ] Add Stripe checkout for workbooks
- [ ] Build order tracking view
- [ ] Test end-to-end flow

### Phase 5: Polish (Week 5-6)
- [ ] Add preview functionality
- [ ] Optimize PDF generation time
- [ ] Add email notifications
- [ ] QA and bug fixes

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Conversion (Gallery → Workbook Order) | 5% |
| Average Order Value | $50+ |
| Customer Satisfaction (Post-delivery) | 4.5/5 |
| Repeat Orders (within 6 months) | 20% |

---

## 11. Technical Considerations

### PDF Generation Options

**Option A: Puppeteer in Edge Function**
- Pros: Full control, no external dependency
- Cons: Cold start time, memory limits

**Option B: DocRaptor API**
- Pros: Professional quality, fast
- Cons: Per-page cost (~$0.02/page)

**Option C: PDFShift**
- Pros: Simple API, reasonable pricing
- Cons: Less customization

**Recommendation:** Start with Option B (DocRaptor) for quality, migrate to self-hosted if volume justifies.

### Storage Requirements
- Cover PDFs: ~2-5MB each
- Interior PDFs: ~20-50MB each
- Supabase Storage bucket: `workbook-assets`

### QR Code Generation
- Use `qrcode` npm package
- Embed in PDF templates
- Deep links to Gmail, Calendar, Maps actions

---

## 12. Competitive Advantage

This feature creates significant differentiation:

1. **No Competitor Offers This**: Most vision board apps are purely digital
2. **Physical Artifact**: Creates emotional attachment and daily engagement
3. **AI-Personalized**: Every workbook is unique to the user's journey
4. **Premium Revenue**: High-margin physical product ($40-80 per unit)
5. **Gift Potential**: Couples can order for each other, family gifts

---

## 13. Future Enhancements

- **Annual Edition**: Yearly updated workbook with progress photos
- **Couple's Edition**: Dual-cover workbook with both partners' visions
- **Family Vision Book**: Multi-contributor workbook
- **Corporate Version**: Team goal-setting workbooks for B2B market
