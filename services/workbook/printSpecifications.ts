/**
 * PRODIGI PRINT SPECIFICATIONS
 *
 * Official specifications for Prodigi print-on-demand products.
 * Sources:
 * - https://www.prodigi.com/blog/photo-books-technical-guide/
 * - https://www.prodigi.com/faq/images/
 *
 * Key requirements:
 * - 300 DPI minimum for all images
 * - RGB color mode (Prodigi converts to CMYK via HP Indigo workflow)
 * - NO bleed - system adds automatically
 * - 10mm safety margin on all sides
 */

export const PRODIGI_SPECS = {
  // Resolution - 300 DPI mandatory for print quality
  DPI: 300,

  // Color Mode - Use RGB, NOT CMYK
  // Prodigi's HP Indigo workflow converts RGB to CMYK automatically
  // Their conversion produces better results than pre-converted files
  COLOR_MODE: 'RGB' as const,

  // Safety Margins - Keep text/important content inside these zones
  // 10mm on all sides = ~118px at 300 DPI
  SAFETY_MARGIN_MM: 10,
  SAFETY_MARGIN_PX: Math.round((10 / 25.4) * 300), // ~118px

  // Spiral notebook margins - 12mm on spiral edge for binding clearance
  SPIRAL_EDGE_MARGIN_MM: 12,
  SPIRAL_EDGE_MARGIN_PX: Math.round((12 / 25.4) * 300), // ~142px

  // Bleed - DO NOT ADD manually
  // Prodigi's system generates bleed automatically
  // Adding bleed causes content to be cut incorrectly
  BLEED_MM: 0,
  BLEED_PX: 0,

  // Binding gutter loss - content hidden at spine
  // Do not design spreads that cross the binding
  BINDING_GUTTER_LOSS_MM: 6,

  // Page count limits by binding type
  SOFTCOVER_MIN_PAGES: 20,
  SOFTCOVER_MAX_PAGES: 300,
  HARDCOVER_MIN_PAGES: 24,
  HARDCOVER_MAX_PAGES: 300,

  // PDF Export Settings
  PDF_PROFILE: 'PDF/X-4' as const,
  PDF_COLOR_PROFILE: 'coated FOGRA 39',
  EMBED_FONTS: true,
  FLATTEN_TRANSPARENCIES: true,

  // Image quality thresholds
  MIN_DPI_ERROR: 150,    // Below this = error, reject
  MIN_DPI_WARNING: 300,  // Below this = warning, allow
} as const;

/**
 * Trim sizes with exact dimensions in mm and pixels at 300 DPI
 * These are the FINAL print sizes (after trim)
 */
export const TRIM_SIZES = {
  // US Letter - 8.5" x 11"
  LETTER_8_5x11: {
    name: 'US Letter',
    widthMm: 215.9,
    heightMm: 279.4,
    widthPx: 2550,
    heightPx: 3300,
    widthIn: 8.5,
    heightIn: 11,
  },

  // A4 - International standard
  A4_8_27x11_69: {
    name: 'A4',
    widthMm: 210,
    heightMm: 297,
    widthPx: 2480,
    heightPx: 3508,
    widthIn: 8.27,
    heightIn: 11.69,
  },

  // A5 - Half A4, popular for journals
  A5_5_83x8_27: {
    name: 'A5',
    widthMm: 148,
    heightMm: 210,
    widthPx: 1748,
    heightPx: 2480,
    widthIn: 5.83,
    heightIn: 8.27,
  },

  // Trade paperback - 6" x 9"
  TRADE_6x9: {
    name: 'Trade (6x9)',
    widthMm: 152.4,
    heightMm: 228.6,
    widthPx: 1800,
    heightPx: 2700,
    widthIn: 6,
    heightIn: 9,
  },

  // Index cards - 3" x 5"
  CARD_3x5: {
    name: 'Index Card (3x5)',
    widthMm: 76.2,
    heightMm: 127,
    widthPx: 900,
    heightPx: 1500,
    widthIn: 3,
    heightIn: 5,
  },

  // Executive - 7" x 9"
  EXECUTIVE_7x9: {
    name: 'Executive (7x9)',
    widthMm: 177.8,
    heightMm: 228.6,
    widthPx: 2100,
    heightPx: 2700,
    widthIn: 7,
    heightIn: 9,
  },
} as const;

/**
 * Prodigi SKUs for API integration
 * These are the exact product codes used when submitting orders
 */
export const PRODIGI_SKUS = {
  // Notebooks & Journals
  SOFTCOVER_A5_80: 'GLOBAL-NTB-A5-SC-80',
  SOFTCOVER_A5_100: 'GLOBAL-NTB-A5-SC-100',
  HARDCOVER_A5_100: 'GLOBAL-NTB-A5-HC-100',
  HARDCOVER_A4_120: 'GLOBAL-NTB-A4-HC-120',
  HARDCOVER_LETTER_150: 'GLOBAL-NTB-LTR-HC-150',

  // Execution Toolkit
  DAILY_PAD_A5: 'GLOBAL-PAD-A5',
  HABIT_CARDS: 'GLOBAL-CRD-3x5',

  // Photo Books
  SOFTCOVER_PHOTOBOOK_A4: 'GLOBAL-PHB-A4-SC',
  HARDCOVER_PHOTOBOOK_A4: 'GLOBAL-PHB-A4-HC',
} as const;

/**
 * Product type to SKU mapping
 */
export const PRODUCT_TYPE_TO_SKU: Record<string, string> = {
  'SOFTCOVER_JOURNAL': PRODIGI_SKUS.SOFTCOVER_A5_100,
  'HARDCOVER_PLANNER': PRODIGI_SKUS.HARDCOVER_A5_100,
  'EXECUTIVE_VISION_BOOK': PRODIGI_SKUS.HARDCOVER_A4_120,
  'LEGACY_EDITION': PRODIGI_SKUS.HARDCOVER_LETTER_150,
  'DAILY_PAD_A5': PRODIGI_SKUS.DAILY_PAD_A5,
  'HABIT_CARDS': PRODIGI_SKUS.HABIT_CARDS,
};

/**
 * Calculate safe area dimensions for a given trim size
 * Returns the printable area inside the safety margins
 */
export function calculateSafeArea(trimSize: keyof typeof TRIM_SIZES): {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
} {
  const size = TRIM_SIZES[trimSize];
  const marginPx = PRODIGI_SPECS.SAFETY_MARGIN_PX;

  return {
    width: size.widthPx - (marginPx * 2),
    height: size.heightPx - (marginPx * 2),
    offsetX: marginPx,
    offsetY: marginPx,
  };
}

/**
 * Convert millimeters to pixels at specified DPI
 */
export function mmToPixels(mm: number, dpi: number = PRODIGI_SPECS.DPI): number {
  return Math.round((mm / 25.4) * dpi);
}

/**
 * Convert pixels to millimeters at specified DPI
 */
export function pixelsToMm(pixels: number, dpi: number = PRODIGI_SPECS.DPI): number {
  return (pixels / dpi) * 25.4;
}

/**
 * Check if page count meets Prodigi requirements
 */
export function isValidPageCount(
  pageCount: number,
  bindingType: 'softcover' | 'hardcover'
): { valid: boolean; reason?: string } {
  const min = bindingType === 'softcover'
    ? PRODIGI_SPECS.SOFTCOVER_MIN_PAGES
    : PRODIGI_SPECS.HARDCOVER_MIN_PAGES;
  const max = bindingType === 'softcover'
    ? PRODIGI_SPECS.SOFTCOVER_MAX_PAGES
    : PRODIGI_SPECS.HARDCOVER_MAX_PAGES;

  if (pageCount % 2 !== 0) {
    return { valid: false, reason: 'Page count must be even' };
  }

  if (pageCount < min) {
    return { valid: false, reason: `Minimum ${min} pages required for ${bindingType}` };
  }

  if (pageCount > max) {
    return { valid: false, reason: `Maximum ${max} pages allowed for ${bindingType}` };
  }

  return { valid: true };
}
