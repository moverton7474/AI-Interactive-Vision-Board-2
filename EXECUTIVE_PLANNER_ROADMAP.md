# Executive Planner Enhancement Roadmap

**Goal:** Transform the Visionary Workbook into a high-end, AI-powered Executive Vision Planner.

## Phase 1: Foundation & Data Models 🏗️
- [ ] **Update `workbookTypes.ts`**: Implement the comprehensive TypeScript models defined in the Master Prompt.
    - [ ] `WorkbookEdition`, `WorkbookTrimSize`, `WorkbookPageType`
    - [ ] `PageLayoutMeta`, `TextBlock`, `ImageBlock`
    - [ ] Structured data models (`MonthlyCalendarData`, `WeeklyPlannerData`, `HabitTrackerData`, `RoadmapData`)
    - [ ] `WorkbookPage` core model
- [ ] **Database Schema Updates (if needed)**: Ensure Supabase `workbook_orders` and `workbook_pages` tables can store the new structured JSON data.

## Phase 2: AI Content Generation Engine 🧠
- [ ] **Update `geminiService.ts`**:
    - [ ] Implement `generateWorkbookPage` function using the "Master Page Layout + Content Prompt".
    - [ ] Implement `generatePageImagePrompt` using the "AI Image Prompt".
    - [ ] Create specialized prompts for different page types (Roadmap, Financial, Reflection).
- [ ] **Context Injection**: Ensure the AI receives correct user context (Vision Boards, Habits, Goals) when generating pages.

## Phase 3: UI/UX - The Workbook Wizard 🧙‍♂️
- [ ] **Enhance `WorkbookWizard.tsx`**:
    - [ ] **Step 1: Edition Selection**: Add visual cards for Softcover, Hardcover, Executive, Legacy.
    - [ ] **Step 2: Personalization**: Add fields for Cover Text, Leather Color, Emboss Style (for Executive).
    - [ ] **Step 3: AI Context**: Allow users to select *specific* vision boards/goals to influence specific sections.
    - [ ] **Step 4: Preview**: Integrate the new `WorkbookPreview` component.
- [ ] **Update `WorkbookPreview.tsx`**:
    - [ ] Add a "Flipbook" style or side-by-side spread view.
    - [ ] Show real-time updates as AI generates content.

## Phase 4: Page Rendering & Layout 🎨
- [ ] **Update `WorkbookPageRenderer.tsx`**:
    - [ ] Implement a flexible grid system for `TextBlock` and `ImageBlock` positioning.
    - [ ] Create specialized renderers for:
        - [ ] `MonthlyPlanner` (Calendar grid)
        - [ ] `WeeklyPlanner` (Day slots)
        - [ ] `HabitTracker` (Checkboxes)
        - [ ] `Roadmap` (Timeline view)
        - [ ] `FinancialOverview` (Tables/Charts)
    - [ ] Apply "Executive" styling (Serif fonts, Gold accents, Navy headers).

## Phase 5: PDF Generation (The Output) 🖨️
- [ ] **Update `generate-workbook-pdf` Edge Function**:
    - [ ] Ensure it can parse the new `WorkbookPage` JSON structure.
    - [ ] Implement `puppeteer` or `pdf-lib` logic to render the complex layouts to PDF.
    - [ ] Handle full-bleed images and print margins (`safeMarginPx`, `bleedPx`).

## Phase 6: Testing & Polish ✨
- [ ] **End-to-End Test**: Create a full Executive Workbook from Wizard to PDF.
- [ ] **Visual QA**: Verify typography, margins, and image resolution.
- [ ] **Mobile Responsiveness**: Ensure the Wizard works on mobile devices.

---

**Current Status:** Starting Phase 1.
