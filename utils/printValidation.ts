/**
 * Print Asset Validation Utility (P0-C)
 *
 * Validates image dimensions against print size requirements to ensure
 * acceptable print quality. Standard DPI requirements:
 * - 300 DPI: High quality (recommended)
 * - 150 DPI: Acceptable quality (minimum)
 * - Below 150 DPI: Low quality (warning)
 */

export interface PrintSize {
  id: string;
  widthInches: number;
  heightInches: number;
  label: string;
}

export interface PrintQualityResult {
  effectiveDpi: number;
  quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  message: string;
  canPrint: boolean;
  recommendedSize: string | null;
}

// Print sizes in inches
export const PRINT_SIZES: PrintSize[] = [
  { id: '12x18', widthInches: 12, heightInches: 18, label: '12" x 18"' },
  { id: '18x24', widthInches: 18, heightInches: 24, label: '18" x 24"' },
  { id: '24x36', widthInches: 24, heightInches: 36, label: '24" x 36"' },
];

// DPI thresholds
const DPI_EXCELLENT = 300; // Professional quality
const DPI_GOOD = 200;      // Good quality
const DPI_ACCEPTABLE = 150; // Minimum acceptable
const DPI_MINIMUM = 100;    // Below this, quality is poor

/**
 * Calculate effective DPI for a given image and print size
 */
export function calculateEffectiveDpi(
  imageWidth: number,
  imageHeight: number,
  printWidthInches: number,
  printHeightInches: number
): number {
  // Calculate DPI for both dimensions and use the lower one
  // (the limiting factor for quality)
  const widthDpi = imageWidth / printWidthInches;
  const heightDpi = imageHeight / printHeightInches;

  return Math.min(widthDpi, heightDpi);
}

/**
 * Get quality rating based on effective DPI
 */
export function getQualityRating(dpi: number): PrintQualityResult['quality'] {
  if (dpi >= DPI_EXCELLENT) return 'excellent';
  if (dpi >= DPI_GOOD) return 'good';
  if (dpi >= DPI_ACCEPTABLE) return 'acceptable';
  return 'poor';
}

/**
 * Find the largest print size that would have acceptable quality
 */
export function findRecommendedSize(
  imageWidth: number,
  imageHeight: number
): PrintSize | null {
  // Sort sizes from largest to smallest
  const sortedSizes = [...PRINT_SIZES].sort(
    (a, b) => (b.widthInches * b.heightInches) - (a.widthInches * a.heightInches)
  );

  for (const size of sortedSizes) {
    const dpi = calculateEffectiveDpi(imageWidth, imageHeight, size.widthInches, size.heightInches);
    if (dpi >= DPI_ACCEPTABLE) {
      return size;
    }
  }

  return null; // Image is too small even for smallest size
}

/**
 * Validate print asset quality for a given print size
 */
export function validatePrintAsset(
  imageWidth: number,
  imageHeight: number,
  printSizeId: string
): PrintQualityResult {
  const printSize = PRINT_SIZES.find(s => s.id === printSizeId);

  if (!printSize) {
    return {
      effectiveDpi: 0,
      quality: 'poor',
      message: 'Invalid print size selected',
      canPrint: false,
      recommendedSize: null,
    };
  }

  const effectiveDpi = calculateEffectiveDpi(
    imageWidth,
    imageHeight,
    printSize.widthInches,
    printSize.heightInches
  );

  const quality = getQualityRating(effectiveDpi);
  const recommendedSize = quality === 'poor'
    ? findRecommendedSize(imageWidth, imageHeight)?.id || null
    : null;

  let message: string;
  let canPrint: boolean;

  switch (quality) {
    case 'excellent':
      message = 'Excellent quality - Your image will print beautifully at this size.';
      canPrint = true;
      break;
    case 'good':
      message = 'Good quality - Your print will look great.';
      canPrint = true;
      break;
    case 'acceptable':
      message = 'Acceptable quality - Print will be clear but not optimal.';
      canPrint = true;
      break;
    case 'poor':
      message = recommendedSize
        ? `Low quality at this size. For best results, try ${PRINT_SIZES.find(s => s.id === recommendedSize)?.label || 'a smaller size'}.`
        : 'Image resolution is too low for quality printing.';
      canPrint = effectiveDpi >= DPI_MINIMUM; // Allow printing but warn
      break;
    default:
      message = 'Unable to determine print quality.';
      canPrint = true;
  }

  return {
    effectiveDpi: Math.round(effectiveDpi),
    quality,
    message,
    canPrint,
    recommendedSize,
  };
}

/**
 * Load image and get its dimensions
 * Returns a promise with width and height
 */
export function getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for dimension check'));
    };

    // Handle CORS by attempting to load with crossOrigin
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
  });
}

/**
 * Complete validation helper that fetches dimensions and validates
 */
export async function validatePrintAssetFromUrl(
  imageUrl: string,
  printSizeId: string
): Promise<PrintQualityResult & { imageDimensions?: { width: number; height: number } }> {
  try {
    const dimensions = await getImageDimensions(imageUrl);
    const result = validatePrintAsset(dimensions.width, dimensions.height, printSizeId);

    return {
      ...result,
      imageDimensions: dimensions,
    };
  } catch (error) {
    console.warn('Could not validate print asset:', error);
    // Return permissive result if we can't check
    return {
      effectiveDpi: 0,
      quality: 'good', // Assume good if we can't verify
      message: 'Unable to verify image quality. Proceeding with order.',
      canPrint: true,
      recommendedSize: null,
    };
  }
}
