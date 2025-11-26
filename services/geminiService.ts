import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, FinancialGoal } from '../types';

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
 * Edit User Image using Gemini 2.5 Flash Image (Nano Banana)
 * This handles "Put us in Thailand" or "Add a retro filter"
 */
export const editVisionImage = async (
  base64Image: string,
  prompt: string
): Promise<string | null> => {
  try {
    // Determine MIME type (assuming jpeg for simplicity or extracting from base64 header)
    const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Targeting the image editing capabilities
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          {
            text: `Edit this image strictly following this instruction: ${prompt}. Maintain high photorealism.`
          },
        ],
      },
    });

    // Iterate through parts to find the image
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
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
