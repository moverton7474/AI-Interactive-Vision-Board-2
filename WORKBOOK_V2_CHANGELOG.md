# Workbook V2 Changelog

## Overview

The Workbook V2 release introduces a completely redesigned workbook creation experience with real PDF generation, proper data flow, and a polished UI. The key improvement is ensuring the preview matches the final printed product.

## What Changed

### 1. Wizard UI (`components/workbook/WorkbookWizard.tsx`)

**Before:** The wizard passed vision board IDs (strings) to the service, which could lead to mismatched images.

**After:**
- Passes full `VisionImage[]` objects with URLs directly to `buildInitialWorkbookPages`
- Passes full `Habit[]` objects for accurate habit tracker generation
- Enforces 4-board maximum limit in the UI with visual feedback
- Shows selection order numbers on chosen boards
- Includes `coverTheme` in build options for styling
- Stores `generatedPages` in order for PDF consistency

**Button Labels:**
- "Next: Select Content" → "Continue to Content"
- "Generate Preview" → "Preview Workbook"
- "Proceed to Checkout" (unchanged)

### 2. Preview & PDF Now Share the Same Data

**Before:** Preview used one data source, PDF generation used another (re-fetched from DB).

**After:**
- `WorkbookPage[]` is the **single source of truth**
- Preview renders `WorkbookPage[]` returned from `buildInitialWorkbookPages`
- Order creation stores `workbook_pages` in `customization_data`
- Edge function reads stored pages and passes directly to PDF generator
- Same structure, same images, same layout = identical output

### 3. Cover Themes (`services/workbook/coverThemes.ts`)

Five new cover themes available:

| Theme ID | Name | Description |
|----------|------|-------------|
| `executive_dark` | Executive Dark | Black/gold, premium look |
| `faith_purpose` | Faith & Purpose | Ivory/burgundy, warm tones |
| `tropical_retirement` | Tropical Retirement | Ocean blue/coral highlights |
| `minimal_white_gold` | Minimal White & Gold | Clean white with gold accents |
| `use_vision_board_cover` | Vision Board Cover | First selected board as background |

Each theme includes:
- Color palette (background, title, subtitle, accent)
- Font families (serif/sans-serif)
- Layout hints (title position, overlay settings)

### 4. New Components

#### `CoverThemeSelector.tsx`
- Visual theme picker with live previews
- Shows 5 theme options as mini book covers
- Highlights selected theme with gold border
- Includes vision board preview for the "use_vision_board_cover" option

#### `WorkbookMockup.tsx`
- CSS-based 3D book mockup
- Realistic spine and page edges
- Dynamic spine width based on page count
- Theme-aware colors and styling
- Used in PERSONALIZE and PRINT steps
- Also includes `WorkbookMockupSimple` for smaller displays

### 5. PDF Generator (`supabase/functions/generate-workbook-pdf/pdfGenerator.ts`)

**Before:** Mock PDF with placeholder content.

**After:** Real PDF generation using pdf-lib with:
- `COVER_FRONT`: Background image support, title/subtitle overlay
- `TITLE_PAGE`: Centered title with decorative elements
- `VISION_BOARD_SPREAD`: Embedded vision board images with captions
- `MONTHLY_PLANNER`: Calendar grid with day headers
- `HABIT_TRACKER`: Habit names with 31-day tracking grid
- `GOAL_OVERVIEW`: Numbered goal lines
- `WEEKLY_PLANNER`: Day-by-day layout
- `REFLECTION_MONTH`: Guided prompts with writing lines
- `NOTES_LINED`: Blank lined pages
- `DEDICATION`: Styled dedication text

Image embedding via `fetchImageBytes()` helper function.

### 6. Edge Function Updates (`supabase/functions/generate-workbook-pdf/index.ts`)

- `createOrder`: Now accepts `workbook_pages` from wizard
- `generateWorkbook`: Uses stored pages when available, falls back to generation
- Better logging with `[GenerateWorkbook]` and `[CreateOrder]` prefixes

### 7. Marketing Hero (`components/PrintProducts.tsx`)

New hero section at top of print shop:
- Premium gradient background
- Feature highlights with checkmarks
- 3D mockup preview
- Direct "Create Your Workbook" CTA
- Price display ($89)

## Where to Adjust Layouts

| Layout Change | File Location |
|---------------|---------------|
| Cover styling | `services/workbook/coverThemes.ts` |
| Page structure | `services/workbook/workbookService.ts` (buildInitialWorkbookPages) |
| PDF rendering | `supabase/functions/generate-workbook-pdf/pdfGenerator.ts` |
| Preview display | `components/workbook/WorkbookPageRenderer.tsx` |
| 3D mockup | `components/workbook/WorkbookMockup.tsx` |

## Files Touched

### Components
- `components/workbook/WorkbookWizard.tsx` - Main wizard flow
- `components/workbook/CoverThemeSelector.tsx` - NEW: Theme picker
- `components/workbook/WorkbookMockup.tsx` - NEW: 3D mockup
- `components/PrintProducts.tsx` - Marketing hero added

### Services
- `services/workbook/workbookService.ts` - Data flow, page building
- `services/workbook/coverThemes.ts` - NEW: Theme definitions

### Edge Functions
- `supabase/functions/generate-workbook-pdf/index.ts` - Order handling
- `supabase/functions/generate-workbook-pdf/pdfGenerator.ts` - Real PDF generation

### Documentation
- `docs/workbook_v2_ux_wireframes.md` - NEW: UX documentation
- `docs/workbook_v2_QA_checklist.md` - NEW: QA checklist

### Tests
- `src/test/workbookService.test.ts` - NEW: Unit tests

## Verification

To confirm the implementation works:

1. **Create vision boards**: Add 5-6 vision boards to a test user
2. **Open wizard**: Navigate to Print Shop → Create Your Workbook
3. **Select boards**: Choose 2-3 specific boards in CONTENT step
4. **Generate preview**: Click "Preview Workbook"
5. **Verify preview**: Only selected boards should appear
6. **Complete order**: Proceed through PRINT step
7. **Check PDF**: Vision boards in PDF should match preview

See `docs/workbook_v2_QA_checklist.md` for complete testing procedure.

## Known Limitations

- PDF image embedding requires images to be publicly accessible URLs
- Font options limited to standard PDF fonts (TimesRoman, Helvetica)
- No real-time PDF preview (user sees rendered preview, not actual PDF)
- Cover texture effects are CSS-only (not in PDF)

## Future Improvements

- Custom font embedding in PDF
- More page types (yearly overview, gratitude journal)
- PDF preview download before purchase
- Cover image upload (instead of vision board selection)
