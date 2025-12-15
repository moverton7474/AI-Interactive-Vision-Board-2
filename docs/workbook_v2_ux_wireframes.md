# Workbook V2 UX Wireframes

This document describes the user experience flow for the Executive Vision Workbook wizard.

## Overview

The workbook creation wizard guides users through a 5-step process to create a personalized, printed vision workbook.

```
TYPE_SELECTION -> PERSONALIZE -> CONTENT -> PREVIEW -> PRINT
```

---

## Step 1: TYPE_SELECTION

**Purpose**: Select the workbook template/product type.

**Components Used**: `WorkbookWizard.tsx` (main), template cards

### Wireframe

```
+----------------------------------------------------------+
|  [X Close]                                               |
|                                                           |
|  +------------------------------------------------------+|
|  |               CREATE YOUR WORKBOOK                   ||
|  +------------------------------------------------------+|
|                                                           |
|  +----------------+  +----------------+  +----------------+|
|  |   [Book Icon] |  |   [Book Icon] |  |   [Book Icon] ||
|  |               |  |               |  |               ||
|  | Executive     |  | Digital Only  |  | Coming Soon   ||
|  | Leather       |  |               |  |               ||
|  |               |  |               |  |               ||
|  | $89.00        |  | $29.00        |  | ---           ||
|  | 6x9 Hardcover |  | PDF Download  |  |               ||
|  +----------------+  +----------------+  +----------------+|
|                                                           |
+----------------------------------------------------------+
```

### User Actions
- Click a template card to select
- Selected card gets highlighted border

### Primary CTA
- Implicit (clicking card advances to next step)

---

## Step 2: PERSONALIZE

**Purpose**: Customize the workbook cover appearance.

**Components Used**:
- `WorkbookWizard.tsx`
- `WorkbookCoverDesigner.tsx`
- `CoverThemeSelector.tsx`
- `WorkbookMockup.tsx`

### Wireframe

```
+----------------------------------------------------------+
|  [X Close]         Personalize                           |
|                                                           |
|  +---------------------------+  +------------------------+|
|  | CUSTOMIZE YOUR COVER      |  |                        ||
|  |                           |  |    +------------+      ||
|  | Workbook Title            |  |   /            /|      ||
|  | [My Vision Workbook    ]  |  |  /   TITLE    / |      ||
|  |                           |  | +------------+  |      ||
|  | Subtitle / Year           |  | |  2025      |  |      ||
|  | [2025                  ]  |  | |            | /       ||
|  |                           |  | +------------+/        ||
|  | Leather Color             |  |                        ||
|  | [O] [O] [O]               |  |  Live preview of your  ||
|  | blk brn nvy               |  |  workbook cover        ||
|  |                           |  |                        ||
|  | Embossing                 |  +------------------------+|
|  | [Gold] [Silver] [Blind]   |                           |
|  |                           |                           |
|  | Dedication   [AI Generate]|                           |
|  | [To my future self...  ]  |                           |
|  |                           |                           |
|  | Cover Theme               |                           |
|  | [o][o][o][o][o]           |                           |
|  |                           |                           |
|  | [    Continue to Content     ]                        |
|  +---------------------------+                           |
+----------------------------------------------------------+
```

### User Actions
- Edit title and subtitle text fields
- Select leather color (black, brown, navy)
- Select embossing style (gold, silver, blind)
- Click "AI Generate" to auto-write dedication
- Select cover theme from 5 options
- 3D mockup updates in real-time

### Primary CTA
- **"Continue to Content"** button

---

## Step 3: CONTENT

**Purpose**: Select vision boards and content sections to include.

**Components Used**: `WorkbookWizard.tsx`, vision board grid, section toggles

### Wireframe

```
+----------------------------------------------------------+
|  [X Close]         Content                               |
|                                                           |
|  +-------------------------------------------+  +--------+|
|  | SELECT VISION BOARDS (2/4 selected)       |  |SUMMARY ||
|  |                                           |  |        ||
|  | +------+ +------+ +------+ +------+       |  | Vision ||
|  | |[img] | |[img] | |[img] | |[img] |       |  | Boards ||
|  | | #1   | | #2   | |      | |      |       |  |   2    ||
|  | |[chk] | |[chk] | |      | |      |       |  |        ||
|  | +------+ +------+ +------+ +------+       |  | Habits ||
|  |                                           |  |   3    ||
|  | INCLUDED SECTIONS                         |  |        ||
|  |                                           |  | Sections|
|  | [X] Monthly Calendar                      |  |   5    ||
|  | [X] Habit Tracker                         |  |        ||
|  | [X] Weekly Journal                        |  +--------+|
|  | [X] Financial Overview                    |           |
|  | [X] AI Coach Foreword                     |           |
|  |                                           |           |
|  +-------------------------------------------+           |
|                                                           |
|  [        Preview Workbook        ]                      |
+----------------------------------------------------------+
```

### User Actions
- Click vision boards to select/deselect (max 4)
- Toggle content sections on/off
- Summary panel shows current selections

### Primary CTA
- **"Preview Workbook"** button (disabled if no vision boards selected)

---

## Step 4: PREVIEW

**Purpose**: Review the generated workbook pages before printing.

**Components Used**:
- `WorkbookWizard.tsx`
- `WorkbookPreview.tsx`
- `WorkbookPageRenderer.tsx`
- Various page renderers in `/renderers/`

### Wireframe

```
+----------------------------------------------------------+
|  Digital Preview                [Back] [Approve & Print] |
|                                                           |
|  +------------------------------------------------------+|
|  |                                                      ||
|  |     +--------+  +--------+  +--------+               ||
|  |     | COVER  |  | TITLE  |  | VISION |               ||
|  |     |        |  | PAGE   |  | BOARD  |               ||
|  |     |        |  |        |  |  #1    |               ||
|  |     +--------+  +--------+  +--------+               ||
|  |                                                      ||
|  |  << [Page navigation] >>                             ||
|  |                                                      ||
|  +------------------------------------------------------+|
|                                                           |
+----------------------------------------------------------+
```

### User Actions
- Scroll/navigate through page previews
- Click "Back to Content" to make changes
- Click "Approve & Print" to proceed to checkout

### Primary CTA
- **"Approve & Print"** button

---

## Step 5: PRINT

**Purpose**: Final confirmation and checkout.

**Components Used**:
- `WorkbookWizard.tsx`
- `WorkbookMockup.tsx`

### Wireframe

```
+----------------------------------------------------------+
|                                                           |
|  +------------------------+  +---------------------------+|
|  |                        |  |                           ||
|  |    +------------+      |  |  [Checkmark Icon]         ||
|  |   /            /|      |  |                           ||
|  |  /   TITLE    / |      |  |  Ready to Print           ||
|  | +------------+  |      |  |                           ||
|  | |  2025      |  |      |  |  Your personalized        ||
|  | |            | /       |  |  12-page workbook is      ||
|  | +------------+/        |  |  ready.                   ||
|  |                        |  |                           ||
|  |  Your finished         |  |  +----------------------+ ||
|  |  workbook              |  |  | Product    Executive | ||
|  |                        |  |  | Pages           12   | ||
|  +------------------------+  |  | Vision Boards    2   | ||
|                              |  | Total         $89.00 | ||
|                              |  | Delivery    7-10 days| ||
|                              |  +----------------------+ ||
|                              |                           ||
|                              |  [ Proceed to Checkout ]  ||
|                              +---------------------------+|
+----------------------------------------------------------+
```

### User Actions
- Review final mockup and order details
- Click "Proceed to Checkout" to open Stripe payment

### Primary CTA
- **"Proceed to Checkout"** button

---

## Loading States

### Generation State (CONTENT -> PREVIEW)
```
+---------------------------+
|                           |
|     [Spinner]             |
|                           |
|   Generating Blueprint... |
|                           |
+---------------------------+
```

### Checkout State (PRINT -> Stripe)
```
+---------------------------+
|                           |
|     [Spinner]             |
|                           |
|     Processing...         |
|                           |
+---------------------------+
```

---

## Error States

If vision board loading fails:
- Show empty state with "No vision boards found"
- Prompt user to create vision boards first

If generation fails:
- Show error toast
- Keep user on current step
- Log error to console

---

## Component Mapping

| Step | Primary Component | Supporting Components |
|------|------------------|----------------------|
| TYPE_SELECTION | WorkbookWizard | Template cards |
| PERSONALIZE | WorkbookWizard | CoverThemeSelector, WorkbookMockup, WorkbookCoverDesigner |
| CONTENT | WorkbookWizard | Vision board grid, Section toggles |
| PREVIEW | WorkbookWizard | WorkbookPreview, WorkbookPageRenderer |
| PRINT | WorkbookWizard | WorkbookMockup |

---

## Data Flow Summary

1. **TYPE_SELECTION**: User selects template → stored in `selectedTemplate`
2. **PERSONALIZE**: User customizes cover → stored in `title`, `subtitle`, `coverTheme`, etc.
3. **CONTENT**: User selects boards/habits → stored in `selectedVisionBoards[]`, `selectedHabits[]`
4. **PREVIEW**: System generates `WorkbookPage[]` via `buildInitialWorkbookPages()`
5. **PRINT**: User confirms → `createWorkbookOrder()` stores pages → Stripe checkout

The same `WorkbookPage[]` structure is used for:
- Frontend preview (WorkbookPreview)
- Backend PDF generation (pdfGenerator.ts)
- Prodigi printing
