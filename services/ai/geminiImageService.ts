import { supabase } from '../../lib/supabase';

/**
 * Generate a workbook image using the Gemini proxy.
 * This function routes through the gemini-proxy edge function which handles
 * model selection and fallbacks for image generation.
 *
 * @param prompt - The text prompt describing the desired image
 * @param size - The desired image dimensions
 * @returns A base64 data URL of the generated image, or a placeholder on failure
 */
export async function generateWorkbookImage(prompt: string, size: { width: number; height: number }): Promise<string> {
    console.log(`[geminiImageService] Generating image: "${prompt.substring(0, 50)}..." (${size.width}x${size.height})`);

    try {
        // Determine aspect ratio from size
        const aspectRatio = size.width > size.height
            ? '16:9'  // landscape
            : size.width < size.height
                ? '9:16'  // portrait
                : '1:1'; // square

        // Enhance the prompt for workbook-specific styling
        const enhancedPrompt = `${prompt}. Executive workbook illustration style, clean, professional, elegant design.`;

        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: {
                action: 'generate_image',
                prompt: enhancedPrompt,
                aspectRatio,
                style: 'photorealistic'
            }
        });

        if (error) {
            console.error('[geminiImageService] Gemini proxy error:', error);
            throw new Error(error.message || 'Image generation failed');
        }

        if (!data?.success || !data?.image) {
            console.error('[geminiImageService] No image returned:', data?.error);
            throw new Error(data?.error || 'No image generated');
        }

        console.log('[geminiImageService] Image generated successfully');
        return data.image;

    } catch (error) {
        console.error('[geminiImageService] Failed to generate image:', error);

        // Return a styled placeholder on failure
        const placeholderText = encodeURIComponent('Image Generation Unavailable');
        return `https://via.placeholder.com/${size.width}x${size.height}/1a365d/ffffff?text=${placeholderText}`;
    }
}
