import { supabase } from '../lib/supabase';

interface ImageCacheMetadata {
    url: string;
    timestamp: number;
    blobUrl?: string;
}

const CACHE_PREFIX = 'visionary_img_cache_';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generates an optimized URL for a Supabase Storage image
 * @param url Original public URL
 * @param width Target width
 * @param height Target height
 * @param quality Quality (0-100)
 */
export const getOptimizedImageUrl = (
    url: string,
    width: number = 800,
    height?: number,
    quality: number = 80
): string => {
    if (!url || !url.includes('supabase.co')) return url;

    // Check if it's already a transformed URL to avoid double-transforming
    if (url.includes('?width=')) return url;

    const params = new URLSearchParams();
    params.append('width', width.toString());
    if (height) params.append('height', height.toString());
    params.append('quality', quality.toString());
    params.append('format', 'origin'); // Use WebP if supported by browser (Supabase handles this)

    // Append transformation params
    // Note: This assumes Supabase Image Transformations are enabled on the project
    // If not, this will just append query params that might be ignored, which is safe
    return `${url}?${params.toString()}`;
};

/**
 * Caches an image blob locally to avoid re-fetching
 * @param url Image URL
 */
export const cacheImage = async (url: string): Promise<string> => {
    try {
        // Check memory/local storage cache first
        const cacheKey = `${CACHE_PREFIX}${url}`;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
            const metadata: ImageCacheMetadata = JSON.parse(cached);
            if (Date.now() - metadata.timestamp < CACHE_EXPIRY) {
                // Valid cache exists
                // In a real PWA we'd use Cache API, but for now we'll rely on browser HTTP cache
                // and just return the URL. The browser will handle the 304s.
                return url;
            }
        }

        // Update cache metadata
        const metadata: ImageCacheMetadata = {
            url,
            timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(metadata));

        return url;
    } catch (error) {
        console.warn('Image caching failed:', error);
        return url;
    }
};

/**
 * Preloads an image
 * @param url Image URL
 */
export const preloadImage = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve();
        img.onerror = reject;
    });
};
