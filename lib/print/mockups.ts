/**
 * Print Shop v1.5 - Mockup Helper Module
 *
 * Provides configuration for product mockups that overlay user's vision board
 * images and goal statements onto realistic product templates.
 */

export type MockupContext = {
  imageUrl?: string;        // main vision board image
  goalStatement?: string;   // short text (e.g. "Retire at 55 with $2M")
};

export interface MockupConfig {
  baseTemplate: string;     // path to static PNG/JPG in /public
  overlayImageUrl?: string; // image to place on top
  overlayText?: string;     // optional text to render in UI over mockup
  aspectRatio: string;      // CSS aspect-ratio value
  overlayStyle: {
    top?: string;
    left?: string;
    width?: string;
    height?: string;
    borderRadius?: string;
    transform?: string;
  };
}

// Product mockup templates
const MOCKUP_TEMPLATES: Record<string, Omit<MockupConfig, 'overlayImageUrl' | 'overlayText'>> = {
  poster: {
    baseTemplate: '/print-mockups/poster_frame.png',
    aspectRatio: '4/3',
    overlayStyle: {
      top: '8%',
      left: '15%',
      width: '70%',
      height: '75%',
    },
  },
  canvas: {
    baseTemplate: '/print-mockups/canvas_wall.png',
    aspectRatio: '4/3',
    overlayStyle: {
      top: '10%',
      left: '20%',
      width: '60%',
      height: '70%',
      borderRadius: '2px',
    },
  },
  workbook: {
    baseTemplate: '/print-mockups/workbook_flat.png',
    aspectRatio: '3/4',
    overlayStyle: {
      top: '15%',
      left: '10%',
      width: '80%',
      height: '55%',
    },
  },
  pad: {
    baseTemplate: '/print-mockups/pad_desk.png',
    aspectRatio: '4/3',
    overlayStyle: {
      top: '20%',
      left: '25%',
      width: '50%',
      height: '50%',
    },
  },
  cards: {
    baseTemplate: '/print-mockups/cards_spread.png',
    aspectRatio: '16/9',
    overlayStyle: {
      top: '30%',
      left: '35%',
      width: '30%',
      height: '40%',
      borderRadius: '4px',
    },
  },
  calendar: {
    baseTemplate: '/print-mockups/calendar_wall.png',
    aspectRatio: '3/4',
    overlayStyle: {
      top: '5%',
      left: '10%',
      width: '80%',
      height: '45%',
    },
  },
  mug: {
    baseTemplate: '/print-mockups/mug_desk.png',
    aspectRatio: '1/1',
    overlayStyle: {
      top: '25%',
      left: '30%',
      width: '40%',
      height: '40%',
      borderRadius: '50%',
      transform: 'perspective(200px) rotateY(-10deg)',
    },
  },
  sticker: {
    baseTemplate: '/print-mockups/stickers_sheet.png',
    aspectRatio: '1/1',
    overlayStyle: {
      top: '20%',
      left: '20%',
      width: '60%',
      height: '60%',
    },
  },
  bundle: {
    baseTemplate: '/print-mockups/bundle_box.png',
    aspectRatio: '4/3',
    overlayStyle: {
      top: '15%',
      left: '20%',
      width: '60%',
      height: '50%',
    },
  },
};

// Fallback gradients for products without mockups
const PRODUCT_GRADIENTS: Record<string, string> = {
  poster: 'from-blue-100 to-indigo-100',
  canvas: 'from-amber-50 to-orange-100',
  workbook: 'from-slate-100 to-slate-200',
  pad: 'from-green-50 to-emerald-100',
  cards: 'from-purple-50 to-pink-100',
  calendar: 'from-cyan-50 to-blue-100',
  mug: 'from-rose-50 to-red-100',
  sticker: 'from-yellow-50 to-amber-100',
  bundle: 'from-gold-50 to-gold-100',
};

/**
 * Get mockup configuration for a product
 */
export function getProductMockup(productType: string, ctx: MockupContext): MockupConfig {
  const template = MOCKUP_TEMPLATES[productType] || MOCKUP_TEMPLATES.poster;

  return {
    ...template,
    overlayImageUrl: ctx.imageUrl,
    overlayText: ctx.goalStatement,
  };
}

/**
 * Get gradient class for product type (fallback when no mockup image)
 */
export function getProductGradient(productType: string): string {
  return PRODUCT_GRADIENTS[productType] || 'from-gray-100 to-gray-200';
}

/**
 * Get product display icon
 */
export function getProductIcon(productType: string): string {
  const icons: Record<string, string> = {
    poster: '🖼️',
    canvas: '🎨',
    workbook: '📘',
    pad: '📝',
    cards: '🃏',
    sticker: '⭐',
    calendar: '📅',
    mug: '☕',
    bundle: '🎁',
  };
  return icons[productType] || '📦';
}

/**
 * Check if a product type supports vision board overlay
 */
export function supportsVisionOverlay(productType: string): boolean {
  return ['poster', 'canvas', 'workbook', 'calendar'].includes(productType);
}

/**
 * Check if a product type supports goal text overlay
 */
export function supportsGoalOverlay(productType: string): boolean {
  return ['pad', 'cards', 'calendar', 'mug'].includes(productType);
}
