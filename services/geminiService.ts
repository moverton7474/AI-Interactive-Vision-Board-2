
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
 * Chat with the Visionary Coach (Gemini 2.5 Flash)
 */
export const sendVisionChatMessage = async (
  history: ChatMessage[], 
  newMessage: string
): Promise<string> => {
  try {
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
  } catch (error) {
    console.error("Chat Error:", error);
    return "Networking error. Please check your connection.";
  }
};

/**
 * Summarize Vision Chat into a concise Image Prompt
 */
export const generateVisionSummary = async (history: {role: string, text: string}[]): Promise<string> => {
  try {
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
  } catch (error) {
    console.error("Summary Error", error);
    return "";
  }
};

/**
 * Edit User Image(s)
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

  try {
    const model = 'gemini-3-pro-image-preview'; 
    console.log("Attempting generation with:", model);
    
    const response = await ai.models.generateContent({
      model, 
      contents: { parts: parts },
      config: {
        imageConfig: {
          imageSize: "1K", 
          aspectRatio: "16:9" 
        }
      }
    });

    return extractImageFromResponse(response);

  } catch (error: any) {
    console.warn("Gemini 3 Pro failed, attempting fallback to Gemini 2.5 Flash...", error.message);

    try {
        const fallbackModel = 'gemini-2.5-flash-image';
        const response = await ai.models.generateContent({
            model: fallbackModel,
            contents: { parts: parts },
        });

        return extractImageFromResponse(response);
    } catch (fallbackError) {
        console.error("Fallback generation failed:", fallbackError);
        throw fallbackError;
    }
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
 * Generate Financial Projection
 */
export const generateFinancialProjection = async (description: string): Promise<FinancialGoal[]> => {
  try {
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
  } catch (e) {
    return [
      { year: 2024, savings: 500000, projected: 500000, goal: 500000 },
      { year: 2025, savings: 600000, projected: 650000, goal: 700000 },
      { year: 2026, savings: 750000, projected: 800000, goal: 950000 },
      { year: 2027, savings: 900000, projected: 1000000, goal: 1200000 },
    ];
  }
};

export const parseFinancialChat = async (history: string): Promise<any> => {
  try {
    const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: `Extract financial data from this conversation history into JSON:
       History: ${history}
       Required fields: currentSavings (number), monthlyContribution (number), targetGoal (number), targetYear (number), dreamDescription (string).
       If a field is missing, estimate a reasonable default for a high-net-worth individual.`,
       config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return { currentSavings: 100000, monthlyContribution: 5000, targetGoal: 1000000, targetYear: 2030, dreamDescription: 'Retire comfortably' };
  }
}

/**
 * Generate Action Plan Agent with SEARCH GROUNDING
 */
export const generateActionPlan = async (visionContext: string, financialContextStr: string): Promise<Milestone[]> => {
  try {
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

  } catch (e) {
    console.error("Agent Plan Error", e);
    return [];
  }
}
