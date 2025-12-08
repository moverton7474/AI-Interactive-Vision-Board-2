
import { supabase } from '../lib/supabase';
import { ChatMessage, FinancialGoal, Milestone } from '../types';
import { WorkbookPage, WorkbookPageType, WorkbookEdition, WorkbookTrimSize } from '../types/workbookTypes';

/**
 * Helper to convert URL to Base64
 * Required because Gemini API expects inlineData (base64), not remote URLs.
 */
const urlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("URL to Base64 conversion failed:", error);
    return "";
  }
};

/**
 * Retry Helper with Exponential Backoff
 */
const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  fallbackFn?: () => Promise<T>
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error.status === 429 || error.status === 503 || error.message?.includes('400'); // Include 400 for Nano Banana errors

    if (retries <= 0 || !isRetryable) {
      if (fallbackFn) {
        console.warn(`Primary attempt failed, trying fallback... (${error.message})`);
        return fallbackFn();
      }
      throw error;
    }

    console.log(`Retrying operation... (${retries} attempts left)`);
    await new Promise(r => setTimeout(r, delay));
    return withRetry(fn, retries - 1, delay * 2, fallbackFn);
  }
};

/**
 * Chat with the Visionary Coach (Gemini 2.5 Flash)
 */
export const sendVisionChatMessage = async (
  history: ChatMessage[],
  newMessage: string
): Promise<string> => {
  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'chat',
        history,
        message: newMessage
      }
    });

    if (error) throw error;
    return data?.text || "I'm having trouble envisioning that right now. Please try again.";
  });
};

/**
 * Summarize Vision Chat into a concise Image Prompt
 */
export const generateVisionSummary = async (history: { role: string, text: string }[]): Promise<string> => {
  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'summarize',
        history
      }
    });

    if (error) throw error;
    return data?.summary || "";
  });
};

/**
 * Edit User Image(s) - Upgraded to Gemini 2.5 Pro with Retry
 */
export const editVisionImage = async (
  images: string | string[],
  prompt: string,
  embeddedText?: string,
  titleText?: string,
  style?: string,
  aspectRatio?: string
): Promise<string | null> => {
  const rawImageList = Array.isArray(images) ? images : [images];
  const processedImages: string[] = [];

  for (const img of rawImageList) {
    if (!img) continue;

    let base64Data = img;

    if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
      base64Data = await urlToBase64(img);
      if (!base64Data) continue;
    }

    // Ensure we just send the base64 string or data URL, the proxy handles parsing
    processedImages.push(base64Data);
  }

  if (processedImages.length === 0) {
    console.error("No valid image data to process.");
    return null;
  }

  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'generate_image',
        images: processedImages,
        prompt,
        embeddedText,
        titleText,
        style,
        aspectRatio
      }
    });

    if (error) {
      console.error("Gemini Proxy Error:", error);
      throw error;
    }

    if (!data?.success) {
      console.error("Gemini Generation Failed:", data?.error);
      throw new Error(data?.error || "Generation failed");
    }

    return data.image;
  });
};

/**
 * Generate Workbook Content
 * Generates personalized text for the workbook sections.
 */
export const generateWorkbookContent = async (
  sectionType: 'dedication' | 'coach_letter' | 'quote' | 'reflection',
  userContext: any
): Promise<string> => {
  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'raw', // Using raw for flexibility or we could add a specific action
        model: 'gemini-2.0-flash',
        contents: [{ parts: [{ text: `Generate ${sectionType} for workbook. Context: ${JSON.stringify(userContext)}` }] }]
      }
    });

    if (error) throw error;
    return data?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  });
};

/**
 * Generate Financial Projection
 */
export const generateFinancialProjection = async (description: string): Promise<FinancialGoal[]> => {
  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'financial_projection',
        description
      }
    });

    if (error) throw error;
    return data?.projection || [];
  }, 2, 1000, async () => {
    // Fallback static data
    return [
      { year: 2024, savings: 500000, projected: 500000, goal: 500000 },
      { year: 2025, savings: 600000, projected: 650000, goal: 700000 },
      { year: 2026, savings: 750000, projected: 800000, goal: 950000 },
      { year: 2027, savings: 900000, projected: 1000000, goal: 1200000 },
    ];
  });
};

export const parseFinancialChat = async (history: string): Promise<any> => {
  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'parse_financial',
        history
      }
    });

    if (error) throw error;
    return data?.data || {};
  }, 2, 1000, async () => {
    return { currentSavings: 100000, monthlyContribution: 5000, targetGoal: 1000000, targetYear: 2030, dreamDescription: 'Retire comfortably' };
  });
}

/**
 * Enhance Vision Prompt using AI
 */
export const enhanceVisionPrompt = async (prompt: string): Promise<string> => {
  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'enhance_prompt',
        prompt
      }
    });

    if (error) throw error;
    return data?.enhancedPrompt || prompt;
  });
};

/**
 * Get Contextual Vision Suggestions based on User Profile
 */
export const getVisionSuggestions = async (userProfile: any): Promise<string[]> => {
  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'generate_suggestions',
        userProfile
      }
    });

    if (error) throw error;
    return data?.suggestions || [];
  });
};

/**
 * Generate Action Plan Agent with SEARCH GROUNDING
 */
export const generateActionPlan = async (visionContext: string, financialContextStr: string): Promise<Milestone[]> => {
  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'action_plan',
        visionContext,
        financialContext: financialContextStr
      }
    });

    if (error) throw error;
    return data?.plan || [];
  }, 1, 1000);
}

/**
 * Generate a complete Workbook Page JSON
 */
export const generateWorkbookPage = async (
  pageType: WorkbookPageType,
  edition: WorkbookEdition,
  trimSize: WorkbookTrimSize,
  aiContext: any,
  existingPage?: WorkbookPage
): Promise<WorkbookPage> => {
  const systemPrompt = `You are a senior executive designer and AI layout architect.
Your role is to generate ONE page of a premium, leather - bound Executive Vision Planner Workbook.

Use minimalism, elegance, white space, and executive tone.
    Typography:
  - Serif for titles(refined, editorial style)
    - Clean sans - serif for body text

Color Palette:
      - Navy, charcoal, ivory, soft gold accents

You will receive:
  - pageType
    - edition
    - trimSize
    - aiContext(vision boards, goals, habits, themes)
    - existing WorkbookPage JSON if regenerating

Your output:
  - A complete JSON object defining text blocks, image blocks, structured content(planners, calendars, trackers, roadmaps), quotes, and prompts for images.
- JSON only, no explanations.

      Rules:
    - Cover pages must be clean and premium.
- Quote pages use max 1–2 concise quotes.
- Vision spreads must include prompts for aspirational imagery.
- Roadmap pages must summarize years, quarters, goals, milestones.
- Reflection pages must use thoughtful, high - impact questions.
- Monthly / weekly planners must reflect standard calendar layout.

Return JSON matching the WorkbookPage model.`;

  const userMessage = JSON.stringify({
    pageType,
    edition,
    trimSize,
    aiContext,
    existingPage
  });

  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'raw',
        model: 'gemini-2.0-flash', // Use 2.0 Flash for stability
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { responseMimeType: "application/json" }
      }
    });

    if (error) throw error;

    const responseText = data?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error("No response from AI");

    try {
      return JSON.parse(responseText) as WorkbookPage;
    } catch (e) {
      console.error("Failed to parse AI response as JSON", responseText);
      throw new Error("Invalid JSON response from AI");
    }
  }, 1, 1000, async () => {
    // Fallback Mock Page
    console.warn("Generating fallback page due to AI failure");
    return {
      id: "fallback-" + Date.now(),
      edition: edition,
      type: pageType,
      pageNumber: 1,
      layout: { trimSize, widthPx: 2100, heightPx: 2700, bleedPx: 37.5, safeMarginPx: 150, dpi: 300 },
      textBlocks: [{ id: "t1", role: "TITLE", content: "Fallback Page: " + pageType }],
      imageBlocks: [],
      isVisible: true
    } as WorkbookPage;
  });
};

/**
 * Generate AI Image Prompt for a Workbook Page
 */
export const generatePageImagePrompt = async (
  pageType: WorkbookPageType,
  goalThemes: string[]
): Promise<string> => {
  const promptTemplate = `Generate ONE high - end illustration or photograph for a premium executive vision planner page.

    Context:
  - pageType: ${pageType}
  - goal themes: ${goalThemes.join(', ')}
  - Edition: EXECUTIVE_VISION_BOOK
    - Style: luxurious, minimalist, aspirational, vertical aspect ratio

  Rules:
  - No logos, brands, or copyrighted material.
- Subtle luxury tones: navy, gold, ivory, matte black.
- Focus on emotional resonance and clarity.

Return only the image description prompt.`;

  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'raw',
        model: 'gemini-2.0-flash',
        contents: [{ parts: [{ text: promptTemplate }] }]
      }
    });

    if (error) throw error;
    return data?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  });
};
