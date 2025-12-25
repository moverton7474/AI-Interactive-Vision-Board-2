/**
 * Image Validation Service for Prodigi Print Requirements
 *
 * Validates that images meet minimum DPI requirements for print quality.
 * Images must be at least 300 DPI at the target print size.
 *
 * Sources:
 * - https://www.prodigi.com/faq/images/
 * - https://www.prodigi.com/blog/photo-books-technical-guide/
 */

import { PRODIGI_SPECS } from './printSpecifications';
import { PrintValidationResult } from '../../types/workbookTypes';

export interface ImageValidationResult {
  isValid: boolean;
  actualDpi: number;
  requiredMinPixels: { width: number; height: number };
  actualPixels: { width: number; height: number };
  warnings: string[];
  errors: string[];
}

/**
 * Validate image resolution for Prodigi print requirements
 * Images must be at least 300 DPI at target print size
 *
 * @param imageUrl - URL of the image to validate
 * @param targetWidthMm - Target print width in millimeters
 * @param targetHeightMm - Target print height in millimeters
 * @param requiredDpi - Minimum required DPI (default: 300)
 */
export async function validateImageForPrint(
  imageUrl: string,
  targetWidthMm: number,
  targetHeightMm: number,
  requiredDpi: number = PRODIGI_SPECS.DPI
): Promise<ImageValidationResult> {
  // Calculate required pixels at target DPI
  const requiredWidth = Math.round((targetWidthMm / 25.4) * requiredDpi);
  const requiredHeight = Math.round((targetHeightMm / 25.4) * requiredDpi);

  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Load image and check dimensions
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
    });

    // Calculate effective DPI based on target print size
    const dpiWidth = (img.naturalWidth / targetWidthMm) * 25.4;
    const dpiHeight = (img.naturalHeight / targetHeightMm) * 25.4;
    const actualDpi = Math.min(dpiWidth, dpiHeight);

    // Check against thresholds
    if (actualDpi < PRODIGI_SPECS.MIN_DPI_ERROR) {
      errors.push(
        `Image resolution too low (${Math.round(actualDpi)} DPI). ` +
          `Minimum ${requiredDpi} DPI required for acceptable print quality. ` +
          `Current image: ${img.naturalWidth}x${img.naturalHeight}px, ` +
          `Required: ${requiredWidth}x${requiredHeight}px.`
      );
    } else if (actualDpi < PRODIGI_SPECS.MIN_DPI_WARNING) {
      warnings.push(
        `Image resolution (${Math.round(actualDpi)} DPI) is below optimal ${requiredDpi} DPI. ` +
          `Print quality may be affected. Consider using a higher resolution image.`
      );
    }

    return {
      isValid: errors.length === 0,
      actualDpi: Math.round(actualDpi),
      requiredMinPixels: { width: requiredWidth, height: requiredHeight },
      actualPixels: { width: img.naturalWidth, height: img.naturalHeight },
      warnings,
      errors,
    };
  } catch (error) {
    return {
      isValid: false,
      actualDpi: 0,
      requiredMinPixels: { width: requiredWidth, height: requiredHeight },
      actualPixels: { width: 0, height: 0 },
      warnings: [],
      errors: [`Failed to load or validate image: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Validate page count for Prodigi requirements
 * Page count must be even and within binding-specific limits
 *
 * @param pageCount - Number of pages in the workbook
 * @param bindingType - Type of binding (softcover or hardcover)
 */
export function validatePageCount(
  pageCount: number,
  bindingType: 'SOFTCOVER' | 'HARDCOVER' | 'softcover' | 'hardcover'
): { isValid: boolean; errors: string[]; warnings: string[]; paddingNeeded: number } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const normalizedBinding = bindingType.toUpperCase() as 'SOFTCOVER' | 'HARDCOVER';
  const min =
    normalizedBinding === 'SOFTCOVER'
      ? PRODIGI_SPECS.SOFTCOVER_MIN_PAGES
      : PRODIGI_SPECS.HARDCOVER_MIN_PAGES;
  const max =
    normalizedBinding === 'SOFTCOVER'
      ? PRODIGI_SPECS.SOFTCOVER_MAX_PAGES
      : PRODIGI_SPECS.HARDCOVER_MAX_PAGES;

  // Must be even
  const isOdd = pageCount % 2 !== 0;
  if (isOdd) {
    errors.push(`Page count must be even. Current: ${pageCount}. A blank page will be added automatically.`);
  }

  // Check minimum
  if (pageCount < min) {
    errors.push(`Minimum ${min} pages required for ${normalizedBinding.toLowerCase()} binding. Current: ${pageCount}.`);
  }

  // Check maximum
  if (pageCount > max) {
    errors.push(`Maximum ${max} pages allowed for ${normalizedBinding.toLowerCase()} binding. Current: ${pageCount}.`);
  }

  // Calculate padding needed
  let paddingNeeded = 0;
  if (pageCount < min) {
    paddingNeeded = min - pageCount;
  }
  if ((pageCount + paddingNeeded) % 2 !== 0) {
    paddingNeeded += 1;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    paddingNeeded,
  };
}

/**
 * Validate all images in a workbook for print readiness
 *
 * @param imageUrls - Array of image URLs to validate
 * @param targetWidthMm - Target print width in mm
 * @param targetHeightMm - Target print height in mm
 */
export async function validateAllImages(
  imageUrls: string[],
  targetWidthMm: number,
  targetHeightMm: number
): Promise<{
  allValid: boolean;
  results: ImageValidationResult[];
  summary: { valid: number; warnings: number; errors: number };
}> {
  const results = await Promise.all(
    imageUrls.map((url) => validateImageForPrint(url, targetWidthMm, targetHeightMm))
  );

  const summary = {
    valid: results.filter((r) => r.isValid && r.warnings.length === 0).length,
    warnings: results.filter((r) => r.isValid && r.warnings.length > 0).length,
    errors: results.filter((r) => !r.isValid).length,
  };

  return {
    allValid: summary.errors === 0,
    results,
    summary,
  };
}

/**
 * Generate a complete print validation report
 *
 * @param pages - Workbook pages with image blocks
 * @param bindingType - Type of binding
 * @param trimWidthMm - Trim width in mm
 * @param trimHeightMm - Trim height in mm
 */
export async function generatePrintValidationReport(
  pages: Array<{ imageBlocks: Array<{ url: string }> }>,
  bindingType: 'SOFTCOVER' | 'HARDCOVER',
  trimWidthMm: number,
  trimHeightMm: number
): Promise<PrintValidationResult> {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  const imageResolutions: Array<{ url: string; dpi: number; isValid: boolean }> = [];

  // Validate page count
  const pageValidation = validatePageCount(pages.length, bindingType);
  allErrors.push(...pageValidation.errors);
  allWarnings.push(...pageValidation.warnings);

  // Collect all image URLs
  const imageUrls: string[] = [];
  for (const page of pages) {
    for (const imageBlock of page.imageBlocks || []) {
      if (imageBlock.url) {
        imageUrls.push(imageBlock.url);
      }
    }
  }

  // Validate all images
  if (imageUrls.length > 0) {
    const imageValidation = await validateAllImages(imageUrls, trimWidthMm, trimHeightMm);

    for (let i = 0; i < imageValidation.results.length; i++) {
      const result = imageValidation.results[i];
      imageResolutions.push({
        url: imageUrls[i],
        dpi: result.actualDpi,
        isValid: result.isValid,
      });

      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }
  }

  return {
    status: allErrors.length === 0 ? 'valid' : 'invalid',
    errors: allErrors,
    warnings: allWarnings,
    validatedAt: new Date().toISOString(),
    imageResolutions,
    pageCount: {
      current: pages.length,
      min:
        bindingType === 'SOFTCOVER'
          ? PRODIGI_SPECS.SOFTCOVER_MIN_PAGES
          : PRODIGI_SPECS.HARDCOVER_MIN_PAGES,
      max:
        bindingType === 'SOFTCOVER'
          ? PRODIGI_SPECS.SOFTCOVER_MAX_PAGES
          : PRODIGI_SPECS.HARDCOVER_MAX_PAGES,
      isEven: pages.length % 2 === 0,
    },
  };
}
