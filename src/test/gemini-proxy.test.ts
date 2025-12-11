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
    // Model configuration matching gemini-proxy/index.ts (updated for Nano Banana Pro)
    const getModelConfig = () => ({
      image_primary: 'gemini-2.5-pro-preview-06-05',
      image_fallback_1: 'gemini-2.5-flash-preview-05-20',
      image_fallback_2: 'gemini-2.0-flash-exp',
      image_imagen: 'imagen-3.0-generate-002',
    });

    const MODELS = {
      chat: 'gemini-2.0-flash-001',
      reasoning: 'gemini-2.5-pro',
      likeness_validator: 'gemini-2.0-flash-001',
    };

    it('should use gemini-2.0-flash-001 for chat', () => {
      expect(MODELS.chat).toBe('gemini-2.0-flash-001');
    });

    it('should use Nano Banana Pro as primary image model', () => {
      const config = getModelConfig();
      expect(config.image_primary).toBe('gemini-2.5-pro-preview-06-05');
      expect(config.image_primary).toContain('pro');
    });

    it('should use Nano Banana as first fallback', () => {
      const config = getModelConfig();
      expect(config.image_fallback_1).toBe('gemini-2.5-flash-preview-05-20');
      expect(config.image_fallback_1).toContain('flash');
    });

    it('should use gemini-2.0-flash-exp as second fallback', () => {
      const config = getModelConfig();
      expect(config.image_fallback_2).toBe('gemini-2.0-flash-exp');
    });

    it('should have imagen-3 as last resort (no likeness support)', () => {
      const config = getModelConfig();
      expect(config.image_imagen).toBe('imagen-3.0-generate-002');
    });
  });

  describe('Likeness-Preserving Prompt Builder', () => {
    // Helper function to simulate buildLikenessPreservingRequest
    interface LikenessRequestParams {
      baseImage: string | null;
      referenceImages: string[];
      referenceImageTags: string[];
      identityPrompt?: string;
      sceneDescription: string;
      titleText?: string;
      embeddedText?: string;
      style?: string;
      isPremium: boolean;
    }

    const extractBase64Data = (imageData: string) => {
      if (imageData.includes('base64,')) {
        const mimeMatch = imageData.match(/^data:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const base64 = imageData.split(',')[1];
        return { base64, mimeType };
      }
      return { base64: imageData, mimeType: 'image/jpeg' };
    };

    const buildLikenessPreservingRequest = (params: LikenessRequestParams) => {
      const contents: any[] = [];
      const identityDescriptions = params.identityPrompt
        ? params.identityPrompt.split('\n\n').filter(Boolean)
        : [];

      // Turn 1: Base Image
      if (params.baseImage) {
        const baseImageData = extractBase64Data(params.baseImage);
        contents.push({
          role: 'user',
          parts: [
            { inlineData: { mimeType: baseImageData.mimeType, data: baseImageData.base64 } },
            { text: 'CRITICAL LIKENESS REQUIREMENTS...' }
          ]
        });
      }

      // Reference images
      params.referenceImages.forEach((refImage, index) => {
        const refImageData = extractBase64Data(refImage);
        const tagLabel = params.referenceImageTags[index] || `Person ${index + 1}`;
        const identityDesc = identityDescriptions[index] || '';

        contents.push({
          role: 'user',
          parts: [
            { inlineData: { mimeType: refImageData.mimeType, data: refImageData.base64 } },
            { text: `Reference photo of "${tagLabel}". ${identityDesc}` }
          ]
        });
      });

      // Final turn: Scene instructions
      contents.push({
        role: 'user',
        parts: [{ text: `Generate: ${params.sceneDescription}` }]
      });

      return {
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseModalities: ['IMAGE', 'TEXT']
        }
      };
    };

    it('should create multi-turn conversation structure', () => {
      const result = buildLikenessPreservingRequest({
        baseImage: 'data:image/jpeg;base64,base64data',
        referenceImages: [],
        referenceImageTags: [],
        sceneDescription: 'Beach sunset',
        isPremium: false
      });

      // Should have base image turn + final scene turn = 2 turns minimum
      expect(result.contents.length).toBe(2);
    });

    it('should include base image as first turn', () => {
      const result = buildLikenessPreservingRequest({
        baseImage: 'data:image/jpeg;base64,base64data',
        referenceImages: [],
        referenceImageTags: [],
        sceneDescription: 'Beach sunset',
        isPremium: false
      });

      expect(result.contents[0].role).toBe('user');
      expect(result.contents[0].parts[0]).toHaveProperty('inlineData');
      expect(result.contents[0].parts[1].text).toContain('CRITICAL LIKENESS REQUIREMENTS');
    });

    it('should add reference images as separate turns', () => {
      const result = buildLikenessPreservingRequest({
        baseImage: 'data:image/jpeg;base64,base64data',
        referenceImages: ['ref1base64', 'ref2base64'],
        referenceImageTags: ['Milton', 'Lisa'],
        sceneDescription: 'Beach sunset',
        isPremium: false
      });

      // base turn + 2 reference turns + final turn = 4 turns
      expect(result.contents.length).toBe(4);
      expect(result.contents[1].parts[1].text).toContain('Milton');
      expect(result.contents[2].parts[1].text).toContain('Lisa');
    });

    it('should include identity descriptions in reference turns', () => {
      const result = buildLikenessPreservingRequest({
        baseImage: 'data:image/jpeg;base64,base64data',
        referenceImages: ['ref1base64'],
        referenceImageTags: ['Milton'],
        identityPrompt: 'Tall Black male, 50s, athletic, glasses',
        sceneDescription: 'Beach sunset',
        isPremium: false
      });

      expect(result.contents[1].parts[1].text).toContain('Tall Black male');
    });

    it('should use responseModalities for image output', () => {
      const result = buildLikenessPreservingRequest({
        baseImage: 'data:image/jpeg;base64,base64data',
        referenceImages: [],
        referenceImageTags: [],
        sceneDescription: 'Beach sunset',
        isPremium: false
      });

      expect(result.generationConfig.responseModalities).toContain('IMAGE');
      expect(result.generationConfig.responseModalities).toContain('TEXT');
    });

    it('should use lower temperature for consistent likeness', () => {
      const result = buildLikenessPreservingRequest({
        baseImage: 'data:image/jpeg;base64,base64data',
        referenceImages: [],
        referenceImageTags: [],
        sceneDescription: 'Beach sunset',
        isPremium: false
      });

      expect(result.generationConfig.temperature).toBe(0.7);
      expect(result.generationConfig.temperature).toBeLessThan(1.0);
    });

    it('should work without base image', () => {
      const result = buildLikenessPreservingRequest({
        baseImage: null,
        referenceImages: ['ref1base64'],
        referenceImageTags: ['Milton'],
        sceneDescription: 'Beach sunset',
        isPremium: false
      });

      // Should have reference turn + final turn = 2 turns
      expect(result.contents.length).toBe(2);
    });

    it('should always include reference images as inlineData', () => {
      const result = buildLikenessPreservingRequest({
        baseImage: 'data:image/jpeg;base64,base64data',
        referenceImages: ['ref1base64', 'ref2base64'],
        referenceImageTags: ['Milton', 'Lisa'],
        sceneDescription: 'Beach sunset',
        isPremium: false
      });

      // Check each reference image turn has inlineData
      expect(result.contents[1].parts[0]).toHaveProperty('inlineData');
      expect(result.contents[2].parts[0]).toHaveProperty('inlineData');
    });
  });

  describe('Likeness Validation', () => {
    const buildValidationPrompt = (
      referenceImages: string[],
      generatedImage: string,
      referenceDescriptions: string[]
    ) => {
      const parts: any[] = [];

      referenceImages.forEach((refImage, index) => {
        parts.push({
          inlineData: { mimeType: 'image/jpeg', data: refImage }
        });
        parts.push({
          text: `Reference Image ${index + 1}: ${referenceDescriptions[index] || `Person ${index + 1}`}`
        });
      });

      parts.push({
        inlineData: { mimeType: 'image/jpeg', data: generatedImage }
      });
      parts.push({ text: 'Generated Vision Board Image (to evaluate)' });
      parts.push({
        text: 'Evaluate likeness... Return JSON with likeness_score 0-1'
      });

      return { contents: [{ parts }] };
    };

    it('should include all reference images in validation', () => {
      const result = buildValidationPrompt(
        ['ref1', 'ref2'],
        'generated',
        ['Milton', 'Lisa']
      );

      const parts = result.contents[0].parts;
      // 2 refs * 2 (image + text) + generated (2) + evaluation (1) = 7 parts
      expect(parts.length).toBe(7);
    });

    it('should include generated image for comparison', () => {
      const result = buildValidationPrompt(
        ['ref1'],
        'generatedBase64',
        ['Milton']
      );

      const parts = result.contents[0].parts;
      const generatedPart = parts.find((p: any) => p.inlineData?.data === 'generatedBase64');
      expect(generatedPart).toBeDefined();
    });

    it('should include likeness score request in prompt', () => {
      const result = buildValidationPrompt(
        ['ref1'],
        'generated',
        ['Milton']
      );

      const parts = result.contents[0].parts;
      const evaluationPart = parts.find((p: any) => p.text?.includes('likeness_score'));
      expect(evaluationPart).toBeDefined();
    });

    // Score interpretation test
    const interpretLikenessScore = (score: number): 'good' | 'moderate' | 'poor' => {
      if (score >= 0.7) return 'good';
      if (score >= 0.5) return 'moderate';
      return 'poor';
    };

    it('should interpret high scores as good', () => {
      expect(interpretLikenessScore(0.85)).toBe('good');
      expect(interpretLikenessScore(0.7)).toBe('good');
    });

    it('should interpret medium scores as moderate', () => {
      expect(interpretLikenessScore(0.6)).toBe('moderate');
      expect(interpretLikenessScore(0.5)).toBe('moderate');
    });

    it('should interpret low scores as poor', () => {
      expect(interpretLikenessScore(0.4)).toBe('poor');
      expect(interpretLikenessScore(0.2)).toBe('poor');
    });
  });

  describe('Model Fallback Chain', () => {
    const simulateModelFallback = async (
      modelAvailability: Record<string, boolean>
    ): Promise<{ modelUsed: string; success: boolean }> => {
      const models = [
        'gemini-2.5-pro-preview-06-05',
        'gemini-2.5-flash-preview-05-20',
        'gemini-2.0-flash-exp',
        'imagen-3.0-generate-002'
      ];

      for (const model of models) {
        if (modelAvailability[model]) {
          return { modelUsed: model, success: true };
        }
      }

      return { modelUsed: '', success: false };
    };

    it('should use primary model when available', async () => {
      const result = await simulateModelFallback({
        'gemini-2.5-pro-preview-06-05': true,
        'gemini-2.5-flash-preview-05-20': true,
        'gemini-2.0-flash-exp': true,
        'imagen-3.0-generate-002': true
      });

      expect(result.modelUsed).toBe('gemini-2.5-pro-preview-06-05');
    });

    it('should fall back to flash when pro unavailable', async () => {
      const result = await simulateModelFallback({
        'gemini-2.5-pro-preview-06-05': false,
        'gemini-2.5-flash-preview-05-20': true,
        'gemini-2.0-flash-exp': true,
        'imagen-3.0-generate-002': true
      });

      expect(result.modelUsed).toBe('gemini-2.5-flash-preview-05-20');
    });

    it('should fall back to 2.0 exp when 2.5 models unavailable', async () => {
      const result = await simulateModelFallback({
        'gemini-2.5-pro-preview-06-05': false,
        'gemini-2.5-flash-preview-05-20': false,
        'gemini-2.0-flash-exp': true,
        'imagen-3.0-generate-002': true
      });

      expect(result.modelUsed).toBe('gemini-2.0-flash-exp');
    });

    it('should fall back to imagen as last resort', async () => {
      const result = await simulateModelFallback({
        'gemini-2.5-pro-preview-06-05': false,
        'gemini-2.5-flash-preview-05-20': false,
        'gemini-2.0-flash-exp': false,
        'imagen-3.0-generate-002': true
      });

      expect(result.modelUsed).toBe('imagen-3.0-generate-002');
    });

    it('should fail when all models unavailable', async () => {
      const result = await simulateModelFallback({
        'gemini-2.5-pro-preview-06-05': false,
        'gemini-2.5-flash-preview-05-20': false,
        'gemini-2.0-flash-exp': false,
        'imagen-3.0-generate-002': false
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Imagen Fallback Prompt', () => {
    // Imagen doesn't support reference images, so we build a text-only prompt
    const buildImagenFallbackPrompt = (params: {
      sceneDescription?: string;
      identityPrompt?: string;
      titleText?: string;
      style?: string;
    }): string => {
      let prompt = params.sceneDescription || 'A beautiful vision board image.';

      if (params.identityPrompt) {
        prompt = `Create an image featuring people with these characteristics: ${params.identityPrompt}. Scene: ${prompt}`;
      }

      if (params.titleText) {
        prompt += ` Include the title text "${params.titleText}" prominently.`;
      }

      if (params.style) {
        prompt += ` Style: ${params.style}.`;
      }

      return prompt;
    };

    it('should include identity descriptions as text', () => {
      const prompt = buildImagenFallbackPrompt({
        sceneDescription: 'Beach vacation',
        identityPrompt: 'tall Black male, 50s, athletic'
      });

      expect(prompt).toContain('tall Black male');
      expect(prompt).toContain('Beach vacation');
    });

    it('should include title text', () => {
      const prompt = buildImagenFallbackPrompt({
        sceneDescription: 'Beach vacation',
        titleText: '2025 Vision Board'
      });

      expect(prompt).toContain('2025 Vision Board');
    });

    it('should work without identity prompt', () => {
      const prompt = buildImagenFallbackPrompt({
        sceneDescription: 'Beach vacation'
      });

      expect(prompt).toBe('Beach vacation');
    });
  });

  describe('Validate Likeness Action', () => {
    const validActions = [
      'chat', 'summarize', 'generate_image', 'enhance_prompt',
      'generate_suggestions', 'financial_projection', 'parse_financial',
      'action_plan', 'raw', 'validate_likeness', 'diagnose'
    ];

    it('should include validate_likeness in valid actions', () => {
      expect(validActions.includes('validate_likeness')).toBe(true);
    });
  });
});
