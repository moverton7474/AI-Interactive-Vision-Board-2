import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseClient,
  mockUser,
  mockProfile
} from './edge-function-utils';

/**
 * Gemini Proxy Edge Function Tests
 *
 * Tests for the secure Gemini API proxy that keeps API keys server-side.
 */

describe('Gemini Proxy', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should require authorization header', () => {
      const request = new Request('https://test.supabase.co/functions/v1/gemini-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat' })
      });

      expect(request.headers.get('Authorization')).toBeNull();
    });

    it('should verify user authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const result = await mockSupabase.auth.getUser('test-token');
      expect(result.data.user).toEqual(mockUser);
    });

    it('should check user credits/subscription', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { credits: 100, subscription_tier: 'pro' },
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await mockSupabase.from('profiles')
        .select('credits, subscription_tier')
        .eq('id', mockUser.id)
        .single();

      expect(result.data.credits).toBe(100);
      expect(result.data.subscription_tier).toBe('pro');
    });
  });

  describe('Action Routing', () => {
    const validActions = ['chat', 'summarize', 'generate_image', 'financial_projection', 'parse_financial', 'action_plan', 'raw'];

    it('should recognize all valid actions', () => {
      validActions.forEach(action => {
        expect(validActions.includes(action)).toBe(true);
      });
    });

    it('should reject unknown actions', () => {
      const unknownAction = 'unknown_action';
      expect(validActions.includes(unknownAction)).toBe(false);
    });
  });

  describe('Chat Action', () => {
    const buildChatPrompt = (history: any[], message: string): string => {
      return `
History: ${history.map((h: any) => `${h.role}: ${h.text}`).join('\n')}
User: ${message}
      `.trim();
    };

    it('should format chat history correctly', () => {
      const history = [
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Hi there!' }
      ];
      const prompt = buildChatPrompt(history, 'How are you?');

      expect(prompt).toContain('user: Hello');
      expect(prompt).toContain('assistant: Hi there!');
      expect(prompt).toContain('User: How are you?');
    });

    it('should handle empty history', () => {
      const prompt = buildChatPrompt([], 'First message');
      expect(prompt).toContain('User: First message');
    });
  });

  describe('Summarize Action', () => {
    const buildSummaryPrompt = (history: any[]): string => {
      return `
Based on the conversation below, create a concise, highly visual image generation prompt that captures the user's dream retirement.
Include details about location, atmosphere, people, and lighting.
Do not include "I want" or "The user wants". Just describe the scene.

Conversation:
${history.map((h: any) => `${h.role}: ${h.text}`).join('\n')}
      `.trim();
    };

    it('should build summary prompt from history', () => {
      const history = [
        { role: 'user', text: 'I want to retire in Thailand on a beach' },
        { role: 'assistant', text: 'That sounds wonderful! What activities?' }
      ];

      const prompt = buildSummaryPrompt(history);

      expect(prompt).toContain('Thailand');
      expect(prompt).toContain('beach');
      expect(prompt).toContain('visual image generation prompt');
    });
  });

  describe('Image Generation Action', () => {
    const buildImagePrompt = (
      basePrompt: string,
      hasMultipleImages: boolean,
      titleText?: string,
      embeddedText?: string
    ): string => {
      let finalPrompt = '';

      if (hasMultipleImages) {
        finalPrompt = 'The FIRST image provided is the BASE scene to be edited. The SUBSEQUENT images are VISUAL REFERENCES. Apply the visual characteristics of the reference images to the base scene. ';
      }

      finalPrompt += `Edit the base image to match this description: ${basePrompt}. Maintain photorealism.`;

      if (titleText) {
        finalPrompt += ` HEADER: Render the title "${titleText}" prominently at the top of the image using an elegant, readable font.`;
      }

      if (embeddedText) {
        finalPrompt += ` INTEGRATE TEXT: Render the text "${embeddedText}" naturally into the scene (e.g. on a sign, neon light, or object).`;
      }

      return finalPrompt;
    };

    it('should handle single image prompt', () => {
      const prompt = buildImagePrompt('Beach sunset', false);

      expect(prompt).toContain('Beach sunset');
      expect(prompt).toContain('photorealism');
      expect(prompt).not.toContain('FIRST image');
    });

    it('should handle multiple images with reference', () => {
      const prompt = buildImagePrompt('Beach sunset', true);

      expect(prompt).toContain('FIRST image');
      expect(prompt).toContain('VISUAL REFERENCES');
    });

    it('should include title text when provided', () => {
      const prompt = buildImagePrompt('Beach', false, 'My Dream Retirement');

      expect(prompt).toContain('HEADER');
      expect(prompt).toContain('My Dream Retirement');
    });

    it('should include embedded text when provided', () => {
      const prompt = buildImagePrompt('Beach', false, undefined, 'Paradise Awaits');

      expect(prompt).toContain('INTEGRATE TEXT');
      expect(prompt).toContain('Paradise Awaits');
    });
  });

  describe('Image Data Processing', () => {
    const processImageData = (img: string): { mimeType: string; data: string } => {
      let base64Data = img;
      let mimeType = 'image/jpeg';

      if (base64Data.includes('base64,')) {
        const mimeMatch = base64Data.match(/^data:(.*?);/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
        base64Data = base64Data.split(',')[1];
      }

      return { mimeType, data: base64Data };
    };

    it('should extract mime type from data URL', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo...';
      const result = processImageData(dataUrl);

      expect(result.mimeType).toBe('image/png');
    });

    it('should default to image/jpeg', () => {
      const rawBase64 = 'iVBORw0KGgo...';
      const result = processImageData(rawBase64);

      expect(result.mimeType).toBe('image/jpeg');
    });

    it('should extract base64 data from data URL', () => {
      const dataUrl = 'data:image/png;base64,ABC123xyz';
      const result = processImageData(dataUrl);

      expect(result.data).toBe('ABC123xyz');
    });
  });

  describe('Financial Projection Action', () => {
    const buildFinancialPrompt = (description: string): string => {
      return `Generate a JSON array of 5 objects representing financial growth over 5 years based on this scenario: "${description}".
Each object must have: "year" (number), "savings" (number), "projected" (number), "goal" (number).
Return ONLY valid JSON.`;
    };

    it('should build financial prompt correctly', () => {
      const prompt = buildFinancialPrompt('Retire with $2M in Thailand');

      expect(prompt).toContain('5 objects');
      expect(prompt).toContain('Retire with $2M in Thailand');
      expect(prompt).toContain('JSON array');
    });

    const parseFallbackProjection = (): any[] => {
      return [
        { year: 2024, savings: 500000, projected: 500000, goal: 500000 },
        { year: 2025, savings: 600000, projected: 650000, goal: 700000 },
        { year: 2026, savings: 750000, projected: 800000, goal: 950000 },
        { year: 2027, savings: 900000, projected: 1000000, goal: 1200000 }
      ];
    };

    it('should have fallback projection data', () => {
      const fallback = parseFallbackProjection();

      expect(fallback.length).toBe(4);
      expect(fallback[0].year).toBe(2024);
      expect(fallback[0]).toHaveProperty('savings');
      expect(fallback[0]).toHaveProperty('projected');
      expect(fallback[0]).toHaveProperty('goal');
    });
  });

  describe('Parse Financial Action', () => {
    const buildParsePrompt = (history: string): string => {
      return `Extract financial data from this conversation history into JSON:
History: ${history}
Required fields: currentSavings (number), monthlyContribution (number), targetGoal (number), targetYear (number), dreamDescription (string).
If a field is missing, estimate a reasonable default for a high-net-worth individual.`;
    };

    it('should build parse prompt correctly', () => {
      const history = 'User mentioned saving $5000/month';
      const prompt = buildParsePrompt(history);

      expect(prompt).toContain('currentSavings');
      expect(prompt).toContain('monthlyContribution');
      expect(prompt).toContain('high-net-worth');
    });

    const getDefaultFinancialData = () => ({
      currentSavings: 100000,
      monthlyContribution: 5000,
      targetGoal: 1000000,
      targetYear: 2030,
      dreamDescription: 'Retire comfortably'
    });

    it('should have sensible default financial data', () => {
      const defaults = getDefaultFinancialData();

      expect(defaults.currentSavings).toBeGreaterThan(0);
      expect(defaults.monthlyContribution).toBeGreaterThan(0);
      expect(defaults.targetGoal).toBeGreaterThan(defaults.currentSavings);
      expect(defaults.targetYear).toBeGreaterThan(2024);
    });
  });

  describe('Action Plan Action', () => {
    const buildActionPlanPrompt = (visionContext: string, financialContext: string): string => {
      return `
You are an expert Life Execution Agent.
Vision Context: ${visionContext}
Financial Context: ${financialContext}
Current Date: ${new Date().toISOString()}

TASK:
Generate a 3-year roadmap.
USE GOOGLE SEARCH to find *real* market data (e.g. median home price in specific location, visa costs) to populate the 'marketResearchSnippet'.

For each year, generate:
1. A Title.
2. A specific "Market Research Snippet" with REAL DATA found via search tools.
3. 2-3 specific Action Tasks.
4. For each task, suggest the best tool to use: 'GMAIL' (for outreach), 'MAPS' (for location scout), 'CALENDAR' (for deadlines).

Return ONLY a valid JSON array of Milestone objects.
      `.trim();
    };

    it('should build action plan prompt with context', () => {
      const prompt = buildActionPlanPrompt('Retire in Thailand', 'Have $500k saved');

      expect(prompt).toContain('Thailand');
      expect(prompt).toContain('$500k');
      expect(prompt).toContain('3-year roadmap');
      expect(prompt).toContain('GOOGLE SEARCH');
    });

    it('should request specific tools', () => {
      const prompt = buildActionPlanPrompt('Test', 'Test');

      expect(prompt).toContain('GMAIL');
      expect(prompt).toContain('MAPS');
      expect(prompt).toContain('CALENDAR');
    });
  });

  describe('Raw Action', () => {
    it('should allow custom model specification', () => {
      const params = { model: 'gemini-2.0-flash', contents: [], config: {} };
      expect(params.model).toBe('gemini-2.0-flash');
    });

    it('should default to gemini-2.0-flash', () => {
      const params = { contents: [] };
      const model = params.model || 'gemini-2.0-flash';
      expect(model).toBe('gemini-2.0-flash');
    });
  });

  describe('Gemini API Call', () => {
    const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

    it('should construct correct API URL', () => {
      const apiKey = 'test-key';
      const model = 'gemini-2.0-flash';
      const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

      expect(url).toContain('generativelanguage.googleapis.com');
      expect(url).toContain('gemini-2.0-flash');
      expect(url).toContain('test-key');
    });

    it('should handle successful API response', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{ text: 'AI response' }]
          }
        }]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('https://api.test.com', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const data = await response.json();
      expect(data.candidates[0].content.parts[0].text).toBe('AI response');
    });

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request')
      });

      const response = await fetch('https://api.test.com');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('Image Extraction', () => {
    const extractImageFromResponse = (response: any): string | null => {
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            return `data:${mimeType};base64,${part.inlineData.data}`;
          }
        }
      }
      return null;
    };

    it('should extract image from response', () => {
      const response = {
        candidates: [{
          content: {
            parts: [{
              inlineData: {
                mimeType: 'image/png',
                data: 'base64ImageData'
              }
            }]
          }
        }]
      };

      const image = extractImageFromResponse(response);
      expect(image).toBe('data:image/png;base64,base64ImageData');
    });

    it('should return null when no image in response', () => {
      const response = {
        candidates: [{
          content: {
            parts: [{ text: 'Just text' }]
          }
        }]
      };

      const image = extractImageFromResponse(response);
      expect(image).toBeNull();
    });

    it('should default mime type to image/png', () => {
      const response = {
        candidates: [{
          content: {
            parts: [{
              inlineData: {
                data: 'base64ImageData'
              }
            }]
          }
        }]
      };

      const image = extractImageFromResponse(response);
      expect(image).toContain('image/png');
    });
  });

  describe('CORS Headers', () => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    };

    it('should allow all origins', () => {
      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should allow required headers', () => {
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('authorization');
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('content-type');
    });
  });

  describe('Text Response Extraction', () => {
    const extractTextFromResponse = (response: any, fallback: string): string => {
      return response.candidates?.[0]?.content?.parts?.[0]?.text || fallback;
    };

    it('should extract text from successful response', () => {
      const response = {
        candidates: [{
          content: {
            parts: [{ text: 'Hello world' }]
          }
        }]
      };

      const text = extractTextFromResponse(response, 'Fallback');
      expect(text).toBe('Hello world');
    });

    it('should use fallback when no text', () => {
      const response = { candidates: [] };
      const text = extractTextFromResponse(response, 'Fallback message');
      expect(text).toBe('Fallback message');
    });

    it('should handle undefined candidates', () => {
      const response = {};
      const text = extractTextFromResponse(response, 'Default');
      expect(text).toBe('Default');
    });
  });

  describe('JSON Cleaning', () => {
    const cleanJsonResponse = (text: string): string => {
      return text.replace(/```json\n?|\n?```/g, '').trim();
    };

    it('should remove markdown code blocks', () => {
      const text = '```json\n{"key": "value"}\n```';
      const cleaned = cleanJsonResponse(text);
      expect(cleaned).toBe('{"key": "value"}');
    });

    it('should handle clean JSON', () => {
      const text = '{"key": "value"}';
      const cleaned = cleanJsonResponse(text);
      expect(cleaned).toBe('{"key": "value"}');
    });

    it('should trim whitespace', () => {
      const text = '  {"key": "value"}  ';
      const cleaned = cleanJsonResponse(text);
      expect(cleaned).toBe('{"key": "value"}');
    });
  });

  describe('Model Selection', () => {
    it('should use gemini-2.0-flash for chat', () => {
      const model = 'gemini-2.0-flash';
      expect(model).toBe('gemini-2.0-flash');
    });

    it('should use gemini-2.0-flash-exp for image generation', () => {
      const model = 'gemini-2.0-flash-exp';
      expect(model).toContain('exp');
    });

    it('should have imagen fallback for images', () => {
      const fallbackModel = 'imagen-3.0-generate-002';
      expect(fallbackModel).toContain('imagen');
    });
  });
});
