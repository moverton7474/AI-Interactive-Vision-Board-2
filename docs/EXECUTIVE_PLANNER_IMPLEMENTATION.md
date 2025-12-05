# Visionary Executive Planner - Implementation Plan

**Version:** 1.0  
**Created:** December 3, 2025  
**Status:** In Progress  

---

## Executive Summary

Transform the Visionary Workbook from a vision-board-centric product into a comprehensive, AI-powered executive planner that combines the best elements of top-tier planning systems (Full Focus, Erin Condren, Passion Planner) with intelligent content generation and personalization.

---

## 1. Industry Research & Content Mapping

### Top Planner Analysis

#### Full Focus Planner
- **Annual Preview**: Year-at-a-glance planning
- **Quarterly Preview**: 90-day goal setting
- **Daily Pages**: Structured daily planning with priorities
- **Weekly Preview**: 7-day planning spread
- **Assessment Pages**: Regular reflection prompts

#### Erin Condren LifePlanner
- **Colorful Goal Tracking**: Visual habit and goal monitoring
- **Monthly Calendar**: Overview with decorative elements
- **Gratitude Sections**: Daily appreciation prompts
- **Budget Pages**: Financial tracking
- **Customizable Covers**: Personalization options

#### Clever Fox Planner
- **SMART Goals Framework**: Structured goal-setting methodology
- **Focus of the Month/Week/Day**: Cascading priorities
- **Habit Tracker Grids**: Monthly tracking matrix
- **Reflection Prompts**: End-of-period reviews
- **Productivity Templates**: Time-blocking layouts

#### Passion Planner
- **Passion Roadmap**: 3-month, 1-year, 3-year goal mapping
- **Monthly Reflection**: Review + preview structure
- **Space for Good**: Community/giving planning
- **Time Ladder**: Hourly scheduling
- **Mind Map Pages**: Creative brainstorming

#### BestSelf Journal
- **13-Week Framework**: Quarterly focus blocks
- **Daily Action Pages**: Prioritized task lists
- **Win Tracking**: Achievement logging
- **Weekly Review**: Structured reflection
- **Goal Progress Metrics**: Quantified tracking

---

## 2. Comprehensive Page Type Taxonomy

### New `WorkbookPageType` Enum

```typescript
export enum WorkbookPageType {
  // Front Matter
  COVER = 'COVER',
  TITLE_PAGE = 'TITLE_PAGE',
  DEDICATION = 'DEDICATION',
  TABLE_OF_CONTENTS = 'TABLE_OF_CONTENTS',
  
  // Vision & Identity
  VISION_GALLERY = 'VISION_GALLERY',
  LIFE_VISION_OVERVIEW = 'LIFE_VISION_OVERVIEW',
  CORE_VALUES = 'CORE_VALUES',
  LETTER_FROM_COACH = 'LETTER_FROM_COACH',
  
  // Strategic Planning
  ANNUAL_VISION = 'ANNUAL_VISION',
  QUARTERLY_ROADMAP = 'QUARTERLY_ROADMAP',
  MONTHLY_OVERVIEW = 'MONTHLY_OVERVIEW',
  GOAL_PYRAMID = 'GOAL_PYRAMID',
  SMART_GOALS_WORKSHEET = 'SMART_GOALS_WORKSHEET',
  
  // Execution & Tracking
  WEEKLY_PLANNER = 'WEEKLY_PLANNER',
  DAILY_PLANNER = 'DAILY_PLANNER',
  HABIT_TRACKER = 'HABIT_TRACKER',
  PRODUCTIVITY_MATRIX = 'PRODUCTIVITY_MATRIX',
  TIME_BLOCKING_TEMPLATE = 'TIME_BLOCKING_TEMPLATE',
  PRIORITY_FOCUS = 'PRIORITY_FOCUS',
  
  // Wellness & Personal
  WELLNESS_TRACKER = 'WELLNESS_TRACKER',
  FITNESS_LOG = 'FITNESS_LOG',
  MEAL_PLANNER = 'MEAL_PLANNER',
  WATER_INTAKE = 'WATER_INTAKE',
  SLEEP_TRACKER = 'SLEEP_TRACKER',
  MOOD_JOURNAL = 'MOOD_JOURNAL',
  GRATITUDE_LOG = 'GRATITUDE_LOG',
  
  // Financial
  FINANCIAL_SNAPSHOT = 'FINANCIAL_SNAPSHOT',
  BUDGET_PLANNER = 'BUDGET_PLANNER',
  SAVINGS_TRACKER = 'SAVINGS_TRACKER',
  DEBT_PAYOFF = 'DEBT_PAYOFF',
  EXPENSE_LOG = 'EXPENSE_LOG',
  NET_WORTH_TRACKER = 'NET_WORTH_TRACKER',
  RETIREMENT_PROJECTION = 'RETIREMENT_PROJECTION',
  
  // Spiritual Growth
  SCRIPTURE_READING = 'SCRIPTURE_READING',
  PRAYER_JOURNAL = 'PRAYER_JOURNAL',
  FAITH_MILESTONES = 'FAITH_MILESTONES',
  SPIRITUAL_DISCIPLINES = 'SPIRITUAL_DISCIPLINES',
  
  // Leadership Development
  LEADERSHIP_GOALS = 'LEADERSHIP_GOALS',
  TEAM_VISION = 'TEAM_VISION',
  ONE_ON_ONE_NOTES = 'ONE_ON_ONE_NOTES',
  DECISION_LOG = 'DECISION_LOG',
  LEARNING_TRACKER = 'LEARNING_TRACKER',
  
  // Relationships
  RELATIONSHIP_GOALS = 'RELATIONSHIP_GOALS',
  FAMILY_CALENDAR = 'FAMILY_CALENDAR',
  QUALITY_TIME_LOG = 'QUALITY_TIME_LOG',
  
  // Reflection & Review
  WEEKLY_REFLECTION = 'WEEKLY_REFLECTION',
  MONTHLY_REVIEW = 'MONTHLY_REVIEW',
  QUARTERLY_ASSESSMENT = 'QUARTERLY_ASSESSMENT',
  YEAR_END_REFLECTION = 'YEAR_END_REFLECTION',
  WINS_TRACKER = 'WINS_TRACKER',
  LESSONS_LEARNED = 'LESSONS_LEARNED',
  
  // Resources
  NOTES_PAGES = 'NOTES_PAGES',
  BRAINSTORM_PAGES = 'BRAINSTORM_PAGES',
  MIND_MAP = 'MIND_MAP',
  RESOURCE_LIBRARY = 'RESOURCE_LIBRARY',
  QR_CODES = 'QR_CODES',
  
  // Back Matter
  ACHIEVEMENT_STICKERS = 'ACHIEVEMENT_STICKERS',
  APPENDIX = 'APPENDIX'
}
```

---

## 3. Theme-Based Content Packs

### Theme System Architecture

```typescript
export enum WorkbookTheme {
  WEIGHT_LOSS_FITNESS = 'WEIGHT_LOSS_FITNESS',
  FINANCIAL_FREEDOM = 'FINANCIAL_FREEDOM',
  LEADERSHIP_DEVELOPMENT = 'LEADERSHIP_DEVELOPMENT',
  SPIRITUAL_GROWTH = 'SPIRITUAL_GROWTH',
  CAREER_ACCELERATION = 'CAREER_ACCELERATION',
  RELATIONSHIPS_FAMILY = 'RELATIONSHIPS_FAMILY',
  CUSTOM = 'CUSTOM'
}

export interface ThemePack {
  id: string;
  theme: WorkbookTheme;
  name: string;
  description: string;
  icon: string;
  primary_color: string;
  secondary_color: string;
  
  // Recommended page types for this theme
  recommended_pages: WorkbookPageType[];
  
  // AI content templates
  ai_prompts: {
    vision_statement: string;
    goal_framework: string;
    habit_suggestions: string[];
    reflection_prompts: string[];
  };
  
  // Theme-specific metrics
  key_metrics: {
    name: string;
    unit: string;
    target?: number;
  }[];
}
```

### Theme Pack Definitions

#### Weight Loss & Fitness
**Recommended Pages:**
- Fitness Log
- Meal Planner
- Water Intake
- Sleep Tracker
- Body Measurements
- Workout Plans
- Habit Tracker (exercise, nutrition)
- Weekly Reflection
- Progress Photos

**AI Prompts:**
- Vision: "Describe your ideal physical self in 6 months"
- Goals: "Generate SMART fitness goals based on: [user stats]"
- Habits: ["Morning workout routine", "Meal prep Sunday", "Track macros daily"]

#### Financial Freedom
**Recommended Pages:**
- Financial Snapshot
- Budget Planner
- Savings Tracker
- Debt Payoff Plan
- Investment Goals
- Net Worth Tracker
- Expense Log
- Retirement Projection
- Monthly Review

**AI Prompts:**
- Vision: "Describe your ideal financial position in 3 years"
- Goals: "Create wealth-building milestones based on current income: [amount]"
- Habits: ["Track daily expenses", "Weekly net worth update", "Monthly investment contribution"]

#### Leadership Development
**Recommended Pages:**
- Leadership Vision
- Team Goals
- One-on-One Notes
- Decision Log
- Learning Tracker
- Feedback Dashboard
- Quarterly Strategy
- Weekly Review
- Delegation Matrix

**AI Prompts:**
- Vision: "What kind of leader do you aspire to become?"
- Goals: "Generate leadership development objectives for: [role]"
- Habits: ["Daily leadership reading", "Weekly team check-ins", "Monthly skill practice"]

#### Spiritual Growth
**Recommended Pages:**
- Scripture Reading Plan
- Prayer Journal
- Faith Milestones
- Spiritual Disciplines
- Gratitude Log
- Sermon Notes
- Bible Study Plans
- Service Opportunities
- Monthly Reflection

**AI Prompts:**
- Vision: "Describe your spiritual goals and faith journey"
- Goals: "Create spiritual growth plan based on: [denomination/tradition]"
- Habits: ["Daily devotional", "Weekly scripture memory", "Monthly service project"]

#### Career Acceleration
**Recommended Pages:**
- Career Vision
- Skill Development Plan
- Network Tracker
- Project Portfolio
- Achievement Log
- Interview Prep
- Salary Negotiation
- Weekly Progress
- Quarterly Review

**AI Prompts:**
- Vision: "Where do you see your career in 2 years?"
- Goals: "Generate career milestones for: [current role] → [target role]"
- Habits: ["Daily skill practice", "Weekly networking", "Monthly portfolio update"]

#### Relationships & Family
**Recommended Pages:**
- Relationship Goals
- Family Calendar
- Quality Time Log
- Conversation Starters
- Date Ideas
- Family Traditions
- Gratitude for Partner
- Conflict Resolution
- Monthly Check-In

**AI Prompts:**
- Vision: "Describe your ideal relationship/family dynamic"
- Goals: "Create relationship-building goals for: [context]"
- Habits: ["Daily appreciation note", "Weekly date night", "Monthly family meeting"]

---

## 4. AI Content Generation System

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  AI Content Generation Pipeline              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Input                                                  │
│  ├─ Theme Selection                                          │
│  ├─ Onboarding Data (goals, habits, financial targets)       │
│  ├─ Vision Board Prompts                                     │
│  └─ Manual Customization                                     │
│                                                              │
│                        ↓                                     │
│                                                              │
│  Context Builder                                             │
│  ├─ Compile user knowledge base                              │
│  ├─ Apply AMIE identity profile                              │
│  ├─ Merge theme-specific templates                           │
│  └─ Generate structured prompt                               │
│                                                              │
│                        ↓                                     │
│                                                              │
│  LLM Router                                                  │
│  ├─ Gemini: Vision content, creative prompts                 │
│  ├─ Claude: Strategic plans, reflection questions            │
│  └─ GPT-4: Financial calculations, SMART goals               │
│                                                              │
│                        ↓                                     │
│                                                              │
│  Content Validator                                           │
│  ├─ Schema validation                                        │
│  ├─ Character limits check                                   │
│  ├─ Completeness verification                                │
│  └─ Retry on failures                                        │
│                                                              │
│                        ↓                                     │
│                                                              │
│  Page Renderer                                               │
│  ├─ Apply layout template                                    │
│  ├─ Insert generated content                                 │
│  ├─ Add images/charts                                        │
│  └─ Generate PDF section                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### AI Content Services

#### 1. `aiContentService.ts`

```typescript
export interface AIContentRequest {
  pageType: WorkbookPageType;
  theme?: WorkbookTheme;
  userContext: {
    goals?: string[];
    habits?: Habit[];
    financial_data?: FinancialSnapshot;
    vision_boards?: VisionBoard[];
    amie_profile?: UserIdentityProfile;
  };
  customInstructions?: string;
  tone?: 'professional' | 'casual' | 'inspirational' | 'analytical';
}

export interface AIContentResponse {
  success: boolean;
  content: Record<string, any>;
  images?: string[];
  error?: string;
  metadata: {
    llm_used: 'gemini' | 'claude' | 'gpt4';
    generation_time_ms: number;
    tokens_used: number;
  };
}

export async function generatePageContent(
  request: AIContentRequest
): Promise<AIContentResponse> {
  // Implementation in services/aiContentService.ts
}
```

#### 2. `themeContentLibrary.ts`

```typescript
export interface ThemeContentTemplate {
  theme: WorkbookTheme;
  pageType: WorkbookPageType;
  prompts: {
    system: string;
    user_template: string;
    examples?: string[];
  };
  layoutPreferences: {
    template_id: string;
    color_scheme: string;
    typography: string;
  };
}

export const THEME_CONTENT_LIBRARY: Record<string, ThemeContentTemplate> = {
  // Comprehensive library of 100+ templates
};
```

---

## 5. Onboarding Data Integration

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Onboarding Data → Workbook Pipeline             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Guided Onboarding                                           │
│  ├─ Life Goals Wizard → Annual Vision, Goal Pyramid         │
│  ├─ Financial Planning → Budget, Savings, Retirement        │
│  ├─ Habit Tracker → 12-Month Habit Tracker                  │
│  ├─ Vision Boards → Vision Gallery (4 max)                  │
│  └─ AMIE Identity → Theme selection, tone, coaching style   │
│                                                              │
│                        ↓                                     │
│                                                              │
│  Knowledge Base Compiler                                     │
│  └─ Aggregates all user data into structured context        │
│                                                              │
│                        ↓                                     │
│                                                              │
│  Auto-Population Engine                                      │
│  ├─ Generate roadmaps from goals                             │
│  ├─ Calculate financial projections                          │
│  ├─ Create habit tracker grids                               │
│  ├─ Build monthly/weekly milestones                          │
│  └─ Populate budget tables                                   │
│                                                              │
│                        ↓                                     │
│                                                              │
│  Workbook Assembly                                           │
│  └─ Each section pre-filled with personalized content        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Auto-Population Examples

#### From Goals Wizard → Annual Vision Page
```typescript
const goals = await fetchUserGoals(userId);
const annualVisionContent = {
  year: new Date().getFullYear() + 1,
  primary_vision: goals[0].title,
  key_focus_areas: goals.map(g => g.category),
  success_metrics: goals.map(g => ({
    goal: g.title,
    metric: g.target_metric,
    current: g.current_value,
    target: g.target_value
  }))
};
```

#### From Financial Data → Retirement Projection
```typescript
const financialData = await fetchFinancialSnapshot(userId);
const retirementContent = await generateRetirementProjection({
  current_age: financialData.age,
  retirement_age: financialData.retirement_target_age,
  current_savings: financialData.total_assets,
  monthly_contribution: financialData.monthly_savings,
  expected_return: 0.07, // 7% average
  desired_income: financialData.retirement_income_goal
});
```

#### From Habits → 12-Month Tracker Grid
```typescript
const habits = await fetchActiveHabits(userId);
const habitTrackerContent = {
  habits: habits.slice(0, 3).map(h => ({
    name: h.name,
    icon: h.icon,
    frequency: h.frequency,
    grid: generateMonthlyGrid(12, 31) // 12 months x 31 days
  }))
};
```

---

## 6. New UX Flows

### A. Enhanced Section Selection

**Component:** `WorkbookSectionSelector.tsx`

**Features:**
- Visual cards for each section type
- Preview thumbnails
- Page count estimates
- "Recommended for [Theme]" badges
- Drag-to-reorder sections
- Expansion packs (e.g., "Add Spiritual Growth Pack")

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────────┐
│  Step 2 of 6: Build Your Workbook                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Choose Your Theme(s)                                        │
│  [ ] Weight Loss & Fitness                                   │
│  [x] Financial Freedom                                       │
│  [x] Leadership Development                                  │
│  [ ] Spiritual Growth                                        │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Recommended Sections (Based on Themes)                      │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Vision   │  │ Annual   │  │ Budget   │                  │
│  │ Gallery  │  │ Goals    │  │ Planner  │                  │
│  │ 8 pages  │  │ 4 pages  │  │ 12 pages │                  │
│  │ [x]      │  │ [x]      │  │ [x]      │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                              │
│  Additional Sections (Optional)                              │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Habit    │  │ Weekly   │  │ Notes    │                  │
│  │ Tracker  │  │ Planner  │  │ Pages    │                  │
│  │ 12 pages │  │ 52 pages │  │ 10 pages │                  │
│  │ [x]      │  │ [ ]      │  │ [x]      │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                              │
│  Total: 46 pages                                             │
│                                                              │
│  [Use AI to Suggest Sections]  [Continue →]                 │
└─────────────────────────────────────────────────────────────┘
```

### B. AI Content Generator Interface

**Component:** `WorkbookAIContentGenerator.tsx`

**Features:**
- Page-by-page content generation
- "Generate," "Regenerate," "Edit Manually" options
- Template selection per section
- Preview before accepting
- Tone adjustment (inspirational, analytical, casual)

**UI Flow:**
```
┌─────────────────────────────────────────────────────────────┐
│  Step 3 of 6: Generate Content                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Section: Annual Vision (Page 3)                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ AI Draft (Gemini)                                       │ │
│  │                                                          │ │
│  │ YOUR 2026 VISION                                         │ │
│  │                                                          │ │
│  │ This year, you're committed to achieving financial      │ │
│  │ freedom through disciplined saving and strategic         │ │
│  │ investing. Your primary goal is to increase your net     │ │
│  │ worth by $50,000 while developing leadership skills      │ │
│  │ that position you for executive roles.                   │ │
│  │                                                          │ │
│  │ Key Focus Areas:                                         │ │
│  │ • Build $20K emergency fund                              │ │
│  │ • Earn leadership certification                          │ │
│  │ • Launch side business generating $2K/month              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [Regenerate] [Edit Text] [Change Template] [✓ Accept]      │
│                                                              │
│  Progress: 3 of 12 sections completed                        │
└─────────────────────────────────────────────────────────────┘
```

### C. Preview Flipbook

**Component:** `WorkbookPreviewFlipbook.tsx`

**Features:**
- Page-by-page preview
- Swipe/arrow navigation
- Click any page to edit
- Export PDF preview
- "Send to Print" button

**Technology:**
- react-pdf for rendering
- Swiper.js for flipbook effect
- Canvas API for inline editing

---

## 7. Implementation Deliverables

### Phase 1: Core Infrastructure (Week 1)
- [ ] Update `workbookTypes.ts` with new enums
- [ ] Create theme pack definitions
- [ ] Build `aiContentService.ts` foundation
- [ ] Implement knowledge base compiler
- [ ] Update database schema for themes/sections

### Phase 2: AI Content Generation (Week 2)
- [ ] Build prompt templates library
- [ ] Implement LLM routing logic
- [ ] Create content validators
- [ ] Add retry/error handling
- [ ] Build logging system

### Phase 3: UI Components (Week 3)
- [ ] `WorkbookThemeSelector.tsx`
- [ ] `WorkbookSectionSelector.tsx`
- [ ] `WorkbookAIContentGenerator.tsx`
- [ ] `WorkbookStructuredPageRenderer.tsx`
- [ ] Update existing `WorkbookOrderModal.tsx`

### Phase 4: Preview & Export (Week 4)
- [ ] `WorkbookPreviewFlipbook.tsx`
- [ ] PDF generation service updates
- [ ] Amazon KDP export format
- [ ] Prodigi integration updates
- [ ] User library storage

### Phase 5: Onboarding Integration (Week 5)
- [ ] Auto-population engine
- [ ] Data mapping layer
- [ ] Pre-fill logic for all section types
- [ ] Smart defaults based on user data

### Phase 6: Testing & Polish (Week 6)
- [ ] End-to-end testing
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] UI/UX refinements
- [ ] Documentation

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Avg. Pages per Workbook | 80-120 pages |
| AI Content Acceptance Rate | >75% |
| Section Diversity | >5 section types per workbook |
| Time to Generate | <3 minutes |
| User Satisfaction | 4.5/5 stars |
| Repeat Orders | 30% within 6 months |

---

## 9. Technical Considerations

### Performance
- Batch AI requests to reduce latency
- Cache generated content for regeneration
- Lazy-load preview pages
- Optimize PDF generation

### Error Handling
- Graceful degradation when AI fails
- Pre-built fallback templates
- User-friendly error messages
- Auto-retry with exponential backoff

### Data Privacy
- Encrypt user content in transit/rest
- Allow users to opt-out of AI generation
- Provide manual editing for all sections
- Clear data retention policies

---

## 10. Future Enhancements

- **Voice-to-Content**: Speak your goals, AI transcribes and formats
- **Photo Integration**: Add progress photos to fitness sections
- **Calendar Sync**: Pull actual events into weekly planners
- **Habit Data Visualization**: Auto-generate charts from habit completion
- **Collaborative Workbooks**: Couples/teams can co-create
- **Workbook Templates Marketplace**: Share successful structures

---

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1 implementation
3. Weekly progress reviews
4. Iterate based on user feedback
