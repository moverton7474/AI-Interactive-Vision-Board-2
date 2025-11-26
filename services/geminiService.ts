import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, FinancialGoal, Milestone } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

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

    // Convert internal history to Gemini format (simplified for this context)
    // In a real app, use ai.chats.create with history.
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
 * Edit User Image(s) using Gemini 3 Pro Image Preview
 * Supports High Fidelity and Text Rendering.
 * Accepts Single image string or Array of image strings (for compositing).
 */
export const editVisionImage = async (
  images: string | string[],
  prompt: string,
  embeddedText?: string // New optional param for text rendering
): Promise<string | null> => {
  try {
    // Upgraded to Pro model for best visual quality and text rendering
    const model = 'gemini-3-pro-image-preview'; 
    const imageList = Array.isArray(images) ? images : [images];
    
    const parts: any[] = [];

    for (const img of imageList) {
        let mimeType = 'image/jpeg';
        let cleanBase64 = img;

        if (img.startsWith('data:')) {
            const match = img.match(/^data:(image\/[a-z]+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                cleanBase64 = match[2];
            } else {
                cleanBase64 = img.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
                if (img.includes('image/png')) mimeType = 'image/png';
            }
        } else {
            cleanBase64 = img;
            if (img.startsWith('iVBOR')) mimeType = 'image/png';
        }

        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64,
          },
        });
    }

    // Construct a rich prompt that handles text rendering if requested
    let finalPrompt = '';

    // Explicitly handle multi-image context (Base + References)
    if (Array.isArray(images) && images.length > 1) {
        finalPrompt = `The FIRST image provided is the BASE scene to be edited. The SUBSEQUENT images are VISUAL REFERENCES (e.g., for people, style, or specific items). `;
        finalPrompt += `Apply the visual characteristics of the reference images to the base scene where appropriate based on the prompt. `;
    }

    finalPrompt += `Edit the base image to match this description: ${prompt}. Maintain photorealism and high dynamic range.`;
    
    if (embeddedText) {
      finalPrompt += ` INTEGRATE TEXT: Render the text "${embeddedText}" naturally into the scene (e.g., on a sign, neon light, cloud writing, or framed poster). Ensure the text is legible and spelled correctly.`;
    }

    parts.push({ text: finalPrompt });

    const response = await ai.models.generateContent({
      model, 
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          imageSize: "1K", // Ensure high resolution
          aspectRatio: "16:9" // Cinematic aspect ratio
        }
      }
    });

    // Iterate through parts to find the image
    const responseParts = response.candidates?.[0]?.content?.parts;
    if (responseParts) {
      for (const part of responseParts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};

/**
 * Mock Financial Analysis (using Gemini to generate dummy data based on user input)
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
    // Fallback data
    return [
      { year: 2024, savings: 500000, projected: 500000, goal: 500000 },
      { year: 2025, savings: 600000, projected: 650000, goal: 700000 },
      { year: 2026, savings: 750000, projected: 800000, goal: 950000 },
      { year: 2027, savings: 900000, projected: 1000000, goal: 1200000 },
    ];
  }
};

/**
 * Generate Action Plan Agent
 * Creates a structured roadmap based on the vision board context and financial status.
 */
export const generateActionPlan = async (visionContext: string, financialContextStr: string): Promise<Milestone[]> => {
  try {
    const model = 'gemini-2.5-flash';
    
    const prompt = `
      You are an expert Life Execution Agent. 
      Vision Context: ${visionContext}
      Financial Context: ${financialContextStr}
      Current Date: ${new Date().toISOString()}
      
      Generate a 3-year roadmap (current year + 2).
      For each year, generate:
      1. A Title (Milestone Name).
      2. A specific "Market Research Snippet" that provides real-world data relevant to the vision.
      3. 2-3 specific Action Tasks (type: FINANCE, LIFESTYLE, ADMIN).
      
      Return JSON array of Milestone objects.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as Milestone[];

  } catch (e) {
    console.error("Agent Plan Error", e);
    return [];
  }
}