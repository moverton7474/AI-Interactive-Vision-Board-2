import { supabase } from '../../lib/supabase';

/**
 * Identity Engine Service
 *
 * Uses Gemini Vision to analyze a user's reference photo and extract
 * physical descriptors that can be passed to the image generator
 * to enforce likeness preservation.
 *
 * This solves the "Stranger Effect" where generated images don't match
 * the user's actual appearance.
 */

/**
 * Analyzes a user's reference photo to extract physical descriptors.
 * This text description is passed to the image generator to enforce likeness.
 *
 * @param imageBase64 - The base64 image data (can be data URL or raw base64)
 * @returns A text description of the person's physical characteristics
 */
export async function analyzeUserFace(imageBase64: string): Promise<string> {
  console.log("🔍 Identity Engine: Analyzing user photo for likeness...");

  try {
    // Extract raw base64 if it's a data URL
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'raw',
        model: 'gemini-2.0-flash-001', // Vision capable model
        contents: [{
          parts: [
            {
              text: `You are a visual profiler for an AI artist. Analyze this photo and describe the person's physical characteristics.

FOCUS ONLY on these traits (be specific and accurate):
1. Age group (20s, 30s, 40s, 50s, 60s+)
2. Gender
3. Ethnicity/skin tone
4. Body type (slim, athletic, medium build, heavy set)
5. Hair style and color
6. Facial hair (if any)
7. Glasses (if any)
8. Any distinctive features

Format: Write a single descriptive sentence, like:
"A 50-year-old Black man with a medium athletic build, short gray hair, clean-shaven face, and glasses."

Keep it under 40 words. Be accurate about body type - do not idealize.`
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.2, // Low temp for consistency
          maxOutputTokens: 100
        }
      }
    });

    if (error) {
      console.error("❌ Identity Engine error:", error);
      throw error;
    }

    // Parse the response - handle both direct response and nested structure
    let description = '';
    if (data?.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      description = data.response.candidates[0].content.parts[0].text;
    } else if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      description = data.candidates[0].content.parts[0].text;
    } else if (typeof data === 'string') {
      description = data;
    }

    description = description.trim();

    if (description) {
      console.log("✅ Identity Engine - Description extracted:", description);
      return description;
    } else {
      console.warn("⚠️ Identity Engine - Empty description returned");
      return "";
    }

  } catch (err: any) {
    console.error("⚠️ Identity Engine - Face analysis failed:", err.message || err);
    return ""; // Fail gracefully - don't block image generation
  }
}

/**
 * Extracts and validates identity from multiple reference images
 * Useful when user has multiple photos in their reference library
 *
 * @param images - Array of base64 image data
 * @returns Combined identity description
 */
export async function analyzeMultipleReferences(images: string[]): Promise<string> {
  if (images.length === 0) return "";

  // For now, just analyze the first image
  // In the future, we could analyze multiple and combine/validate
  return analyzeUserFace(images[0]);
}

/**
 * Combines user-provided identity description with auto-detected traits
 * User description takes precedence where there's overlap
 *
 * @param userDescription - Manual description from user
 * @param autoDescription - Auto-detected description from AI
 * @returns Combined description
 */
export function combineIdentityDescriptions(
  userDescription: string | undefined,
  autoDescription: string
): string {
  if (!autoDescription) return userDescription || "";
  if (!userDescription) return autoDescription;

  // If user provided a description, prepend auto-detected for context
  // but user description takes precedence
  return `${autoDescription} User specifies: ${userDescription}`;
}
