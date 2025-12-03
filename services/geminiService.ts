
import { supabase } from '../lib/supabase';
import { ChatMessage, FinancialGoal, Milestone } from '../types';

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
