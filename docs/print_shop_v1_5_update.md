# Print Shop v1.5 Update

**Date:** December 11, 2025
**Status:** Complete

## Summary

This update makes Vision Board Prints the primary product on the Print Shop page, with the Executive Vision Workbook as the secondary hero. All product cards now show realistic mockups with the user's actual vision board images.

## New Print Shop Layout

### Dual Hero Section
The Print Shop now features a two-column hero layout:

| Position | Product | CTA Button |
|----------|---------|------------|
| **Left (Primary)** | Vision Board Prints | "Print My Vision Board" |
| **Right (Secondary)** | Executive Vision Workbook | "Create Your Workbook" |

On mobile devices, these stack vertically with Vision Board Prints on top.

### Hero Button Behavior

**"Print My Vision Board" button:**
1. Opens the `VisionBoardSelector` modal
2. User selects from their existing vision boards (thumbnails shown)
3. On selection, opens the existing `PrintOrderModal` with poster/canvas configuration
4. If user has no vision boards, shows a prompt to create one first

**"Create Your Workbook" button:**
- Opens the existing `WorkbookWizard` (unchanged)

## Mockup System

### How Mockups Pick User Content

1. **On component mount:** `loadUserVisions()` fetches all user's vision boards
2. **Primary vision selection:** Uses the first favorited vision, or the most recent one
3. **Mockup rendering:** `ProductMockup` component overlays the user's vision image onto product templates

### Mockup Helper Module

**File:** `lib/print/mockups.ts`

```typescript
type MockupContext = {
  imageUrl?: string;        // User's vision board image
  goalStatement?: string;   // Optional goal text
};

function getProductMockup(productType: string, ctx: MockupContext): MockupConfig;
```

Supported product types:
- `poster` - Framed poster on wall
- `canvas` - Gallery canvas on wall
- `workbook` - Flat hardcover book
- `pad` - Notepad on desk
- `cards` - Card spread
- `sticker` - Sticker sheet
- `bundle` - Gift box
- `calendar` - Wall calendar
- `mug` - Mug on desk

### Fallback Behavior

When user has no vision boards:
- Mockups show gradient backgrounds with product icons
- Hero section shows placeholder icon instead of preview
- VisionBoardSelector prompts user to create a vision board

## Prodigi Capability Assumptions

### Supported Products (Verified)

| Product | Prodigi SKU Pattern | Sizes |
|---------|---------------------|-------|
| Poster | `GLOBAL-PHO-*` | 12x18, 18x24, 24x36 |
| Canvas | `GLOBAL-CAN-*` | 12x18, 18x24, 24x36 |
| Workbook | Custom notebook SKU | A5/Letter |

### Assumptions Made

1. **Vision board images only** - For v1, products display the vision board image. No text personalization is sent to Prodigi.

2. **Goal statement is UI-only** - The `goalStatement` in mockups is for preview purposes. Actual printed products use the vision image only.

3. **Aspect ratios** - Poster/canvas use landscape orientation by default. Users can choose different sizes but orientation is determined by the vision board's aspect ratio.

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `lib/print/mockups.ts` | Mockup configuration helper |
| `components/print/VisionBoardSelector.tsx` | Vision board selection modal |
| `components/print/ProductMockup.tsx` | Realistic product mockup component |
| `docs/print_shop_v1_5_update.md` | This documentation |

### Modified Files

| File | Changes |
|------|---------|
| `components/PrintProducts.tsx` | Dual hero layout, mockup integration, new modals |

## Component Integration

```
PrintProducts.tsx
├── Dual Hero Section
│   ├── Vision Board Prints (Primary)
│   │   └── "Print My Vision Board" → VisionBoardSelector
│   └── Executive Workbook (Secondary)
│       └── "Create Your Workbook" → WorkbookWizard
├── Product Grid
│   └── ProductMockup (replaces emoji icons)
├── VisionBoardSelector Modal
│   └── onSelect → PrintOrderModal
├── PrintOrderModal (existing)
└── WorkbookWizard (existing)
```

## Testing Checklist

- [ ] From Print Shop, click "Print My Vision Board"
  - [ ] Vision selector shows user's boards with thumbnails
  - [ ] Selecting a board opens print configuration modal
  - [ ] Print modal shows correct vision image
- [ ] User with no vision boards sees "Create Vision Board" prompt
- [ ] "Create Your Workbook" opens workbook wizard
- [ ] Product cards show mockups with user's vision image
- [ ] Mockups gracefully fall back when image fails to load
- [ ] Mobile layout stacks heroes vertically
- [ ] All print flows complete successfully (poster, canvas, workbook)

## Future Enhancements

1. **Real mockup images** - Add actual PNG/JPG mockup templates in `/public/print-mockups/`
2. **Text personalization** - If Prodigi supports it, add goal text to printed products
3. **Multiple vision preview** - Let users preview different visions in mockups before selecting
4. **Size-specific mockups** - Show different mockup treatments for different sizes
