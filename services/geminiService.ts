
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, FinancialGoal, Milestone } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

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
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a high-end retirement vision coach named "Visionary". 
    Your goal is to help couples (like Milton and Lisa) articulate their dream retirement.
    Be inspiring, professional, and concise. Ask probing questions about their lifestyle, location (e.g., Thailand), and legacy.`;

    const prompt = `
      History: ${history.map(h => `${h.role}: ${h.text}`).join('\n')}
      User: ${newMessage}
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
      }
    });

    return response.text || "I'm having trouble envisioning that right now. Please try again.";
  });
};

/**
 * Summarize Vision Chat into a concise Image Prompt
 */
export const generateVisionSummary = async (history: {role: string, text: string}[]): Promise<string> => {
  return withRetry(async () => {
    const prompt = `
      Based on the conversation below, create a concise, highly visual image generation prompt that captures the user's dream retirement.
      Include details about location, atmosphere, people, and lighting.
      Do not include "I want" or "The user wants". Just describe the scene.
      
      Conversation:
      ${history.map(h => `${h.role}: ${h.text}`).join('\n')}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "";
  });
};

/**
 * Edit User Image(s) - Upgraded to Gemini 2.5 Pro with Retry
 */
export const editVisionImage = async (
  images: string | string[],
  prompt: string,
  embeddedText?: string,
  titleText?: string
): Promise<string | null> => {
  const rawImageList = Array.isArray(images) ? images : [images];
  const parts: any[] = [];

  for (const img of rawImageList) {
      if (!img) continue;
      
      let base64Data = img;

      if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
          base64Data = await urlToBase64(img);
          if (!base64Data) continue; 
      }

      let mimeType = 'image/jpeg';
      let cleanBase64 = base64Data;

      if (base64Data.includes('base64,')) {
          const split = base64Data.split(',');
          // Robustly get mime type
          const mimeMatch = base64Data.match(/^data:(.*?);/);
          if (mimeMatch) {
              mimeType = mimeMatch[1];
          }
          cleanBase64 = split[1];
      }

      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64,
        },
      });
  }

  if (parts.length === 0) {
      console.error("No valid image data to process.");
      return null;
  }

  let finalPrompt = '';
  if (parts.length > 1) {
      finalPrompt = `The FIRST image provided is the BASE scene to be edited. The SUBSEQUENT images are VISUAL REFERENCES. Apply the visual characteristics of the reference images to the base scene. `;
  }
  finalPrompt += `Edit the base image to match this description: ${prompt}. Maintain photorealism.`;
  
  if (titleText) {
    finalPrompt += ` HEADER: Render the title "${titleText}" prominently at the top of the image using an elegant, readable font.`;
  }
  
  if (embeddedText) {
    finalPrompt += ` INTEGRATE TEXT: Render the text "${embeddedText}" naturally into the scene (e.g. on a sign, neon light, or object).`;
  }

  parts.push({ text: finalPrompt });

  const primaryModel = 'gemini-2.5-pro'; // As requested
  const fallbackModel = 'gemini-1.5-pro'; // Reliable fallback

  const generateWithModel = async (modelName: string) => {
    console.log(`Attempting generation with: ${modelName}`);
    const response = await ai.models.generateContent({
      model: modelName, 
      contents: { parts: parts },
      config: {
        imageConfig: {
          imageSize: "1K", 
          aspectRatio: "16:9" 
        }
      }
    });
    return extractImageFromResponse(response);
  };

  try {
    return await withRetry(
      () => generateWithModel(primaryModel),
      2, // 2 retries
      1000,
      () => generateWithModel(fallbackModel) // Fallback function
    );
  } catch (error: any) {
    console.error("All image generation attempts failed:", error);
    return null;
  }
};

const extractImageFromResponse = (response: GenerateContentResponse): string | null => {
    const responseParts = response.candidates?.[0]?.content?.parts;
    if (responseParts) {
      for (const part of responseParts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
}

/**
 * Generate Workbook Content
 * Generates personalized text for the workbook sections.
 */
export const generateWorkbookContent = async (
  sectionType: 'dedication' | 'coach_letter' | 'quote' | 'reflection',
  userContext: any
): Promise<string> => {
  return withRetry(async () => {
    const model = 'gemini-2.5-flash';
    let prompt = '';

    const contextStr = `
      User Name: ${userContext.name || 'Visionary'}
      Dream Location: ${userContext.dreamLocation || 'Unknown'}
      Retirement Year: ${userContext.targetYear || 'Future'}
      Core Values: ${userContext.values?.join(', ') || 'Growth, Freedom'}
      Vision: ${userContext.visionStatement || 'To live a life of purpose.'}
    `;

    switch (sectionType) {
      case 'dedication':
        prompt = `Write a short, elegant dedication for a vision workbook. 
        Context: ${contextStr}
        Tone: Inspiring, timeless, personal. Max 50 words.`;
        break;
      case 'coach_letter':
        prompt = `Write a letter from a "Vision Coach" introducing this workbook.
        Context: ${contextStr}
        Tone: Encouraging, professional, executive. Explain that this book is a tool to manifest their future. Max 200 words.`;
        break;
      case 'quote':
        prompt = `Generate a unique, powerful quote about vision, legacy, and action.
        Context: ${contextStr}
        Style: Like Marcus Aurelius meets Steve Jobs. Max 20 words.`;
        break;
      case 'reflection':
        prompt = `Generate a deep reflection question for a weekly journal page.
        Context: ${contextStr}
        Focus: Overcoming obstacles or visualizing success. Max 1 sentence.`;
        break;
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text || "";
  });
};

/**
 * Generate Financial Projection
 */
export const generateFinancialProjection = async (description: string): Promise<FinancialGoal[]> => {
  return withRetry(async () => {
     const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a JSON array of 5 objects representing financial growth over 5 years based on this scenario: "${description}".
      Each object must have: "year" (number), "savings" (number), "projected" (number), "goal" (number).
      Return ONLY valid JSON.`,
      config: {
        responseMimeType: 'application/json'
      }
    });
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as FinancialGoal[];
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
    const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: `Extract financial data from this conversation history into JSON:
       History: ${history}
       Required fields: currentSavings (number), monthlyContribution (number), targetGoal (number), targetYear (number), dreamDescription (string).
       If a field is missing, estimate a reasonable default for a high-net-worth individual.`,
       config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || '{}');
  }, 2, 1000, async () => {
    return { currentSavings: 100000, monthlyContribution: 5000, targetGoal: 1000000, targetYear: 2030, dreamDescription: 'Retire comfortably' };
  });
}

/**
 * Generate Action Plan Agent with SEARCH GROUNDING
 */
export const generateActionPlan = async (visionContext: string, financialContextStr: string): Promise<Milestone[]> => {
  return withRetry(async () => {
    const model = 'gemini-2.5-flash';
    
    const prompt = `
      You are an expert Life Execution Agent. 
      Vision Context: ${visionContext}
      Financial Context: ${financialContextStr}
      Current Date: ${new Date().toISOString()}
      
      TASK:
      Generate a 3-year roadmap.
      USE GOOGLE SEARCH to find *real* market data (e.g. median home price in specific location, visa costs) to populate the 'marketResearchSnippet'.
      
      For each year, generate:
      1. A Title.
      2. A specific "Market Research Snippet" with REAL DATA found via search tools.
      3. 2-3 specific Action Tasks.
      4. For each task, suggest the best tool to use: 'GMAIL' (for outreach), 'MAPS' (for location scout), 'CALENDAR' (for deadlines).
      
      Return ONLY a valid JSON array of Milestone objects. Do not wrap in markdown code blocks.
      Schema: 
      [{ 
        "year": number, 
        "title": string, 
        "marketResearchSnippet": string, 
        "tasks": [{ "id": uuid, "title": string, "description": string, "dueDate": date, "type": string, "isCompleted": false, "aiMetadata": { "suggestedTool": "GMAIL" | "MAPS" | "CALENDAR" } }] 
      }]
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        // responseMimeType: 'application/json', // CANNOT USE MIME TYPE WITH GOOGLE SEARCH TOOLS
        tools: [{ googleSearch: {} }] // Enable Grounding
      }
    });

    const text = response.text;
    if (!text) return [];

    // Helper to clean potential markdown from response since we can't enforce JSON mode
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

    const plan = JSON.parse(cleanText);
    
    // Add UUIDs if missing
    plan.forEach((m: any) => {
        m.tasks.forEach((t: any) => {
            if(!t.id) t.id = crypto.randomUUID();
        })
    });

    return plan as Milestone[];

  }, 1, 1000); // Low retry on search as it's expensive/slow
}
