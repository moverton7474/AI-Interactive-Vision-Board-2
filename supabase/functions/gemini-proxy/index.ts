import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Available models for different tasks
// Image generation options:
// 1. imagen-3.0-generate-001 - Best quality, requires Vertex AI (Google Cloud + billing)
// 2. gemini-2.0-flash-exp - Can generate images with responseModalities, but experimental
// 3. gemini-2.0-flash-preview-image-generation - Specific image generation model (if available)
const MODELS = {
  chat: 'gemini-1.5-flash-001',
  // Primary: Try the dedicated image generation preview model
  image_primary: 'gemini-2.0-flash-preview-image-generation',
  // Fallback 1: Standard experimental model with image output
  image_fallback: 'gemini-2.0-flash-exp',
  // Fallback 2: Imagen 3 (requires Vertex AI - most users won't have access)
  image_fallback_vertex: 'imagen-3.0-generate-001',
  // Reasoning: High-intelligence model for complex planning and projections
  reasoning: 'gemini-1.5-pro',
}

/**
 * Gemini API Proxy
 *
 * Securely proxies Gemini API requests from the frontend.
 * Keeps GEMINI_API_KEY server-side to prevent client exposure.
 *
 * Actions:
 * - chat: Vision Coach conversation
 * - summarize: Generate image prompt from chat
 * - generate_image: Edit/generate vision board images
 * - financial_projection: Generate financial projections
 * - parse_financial: Extract financial data from chat
 * - action_plan: Generate 3-year roadmap with search grounding
 * - raw: Direct API call (for flexibility)
 * - diagnose: Check API key and model availability (debugging)
 */
serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8)
  const startTime = Date.now()

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Enhanced API key validation
    if (!GEMINI_API_KEY) {
      console.error(`[${requestId}] GEMINI_API_KEY not found in environment`)
      return errorResponse('GEMINI_API_KEY not configured. Please set it in Supabase Edge Function Secrets.', 500, requestId)
    }

    // Validate API key format (basic check)
    if (GEMINI_API_KEY.length < 30) {
      console.error(`[${requestId}] GEMINI_API_KEY appears too short (${GEMINI_API_KEY.length} chars)`)
      return errorResponse('GEMINI_API_KEY appears invalid (too short). Please check the secret value.', 500, requestId)
    }

    console.log(`[${requestId}] API key loaded: ${GEMINI_API_KEY.substring(0, 8)}...${GEMINI_API_KEY.slice(-4)} (${GEMINI_API_KEY.length} chars)`)

    const body = await req.json()
    const { action, ...params } = body

    console.log(`[${requestId}] Action: ${action}`)

    // Allow diagnose action without auth (for debugging)
    if (action === 'diagnose') {
      return await handleDiagnose(GEMINI_API_KEY, requestId)
    }

    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401, requestId)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error(`[${requestId}] Auth error:`, authError?.message)
      return errorResponse('Invalid or expired authentication token', 401, requestId)
    }

    console.log(`[${requestId}] User authenticated: ${user.id.slice(0, 8)}...`)

    // Check user credits/subscription (optional rate limiting)
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits, subscription_tier')
      .eq('id', user.id)
      .single()

    // Route to appropriate handler
    let result: Response
    switch (action) {
      case 'chat':
        result = await handleChat(GEMINI_API_KEY, params, requestId)
        break
      case 'summarize':
        result = await handleSummarize(GEMINI_API_KEY, params, requestId)
        break
      case 'generate_image':
        result = await handleImageGeneration(GEMINI_API_KEY, params, profile, requestId)
        break
      case 'enhance_prompt':
        result = await handleEnhancePrompt(GEMINI_API_KEY, params, requestId)
        break
      case 'generate_suggestions':
        result = await handleGenerateSuggestions(GEMINI_API_KEY, params, requestId)
        break
      case 'financial_projection':
        result = await handleFinancialProjection(GEMINI_API_KEY, params, requestId)
        break
      case 'parse_financial':
        result = await handleParseFinancial(GEMINI_API_KEY, params, requestId)
        break
      case 'action_plan':
        result = await handleActionPlan(GEMINI_API_KEY, params, requestId)
        break
      case 'raw':
        result = await handleRawRequest(GEMINI_API_KEY, params, requestId)
        break
      default:
        return errorResponse(
          `Unknown action: ${action}. Valid actions: chat, summarize, generate_image, financial_projection, parse_financial, action_plan, raw, diagnose`,
          400,
          requestId
        )
    }

    const duration = Date.now() - startTime
    console.log(`[${requestId}] Completed in ${duration}ms`)
    return result

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[${requestId}] Error after ${duration}ms:`, error.message)
    console.error(`[${requestId}] Stack:`, error.stack)
    return errorResponse(error.message, 400, requestId)
  }
})

/**
 * Diagnose API Key and Model Availability
 * Call with action: 'diagnose' to check configuration
 */
async function handleDiagnose(apiKey: string, requestId: string) {
  console.log(`[${requestId}] Running diagnostics...`)

  const results: any = {
    timestamp: new Date().toISOString(),
    requestId,
    apiKeyInfo: {
      length: apiKey.length,
      prefix: apiKey.substring(0, 8),
      suffix: apiKey.slice(-4)
    },
    models: {}
  }

  // Test each model
  const modelsToTest = [
    { name: 'gemini-2.0-flash', type: 'chat' },
    { name: 'gemini-1.5-flash', type: 'chat' },
    { name: 'imagen-3.0-generate-001', type: 'image' },
  ]

  for (const model of modelsToTest) {
    try {
      console.log(`[${requestId}] Testing model: ${model.name}`)

      if (model.type === 'image') {
        // Test Imagen with predict endpoint
        const response = await fetch(
          `${GEMINI_API_BASE}/models/${model.name}:predict?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instances: [{ prompt: 'test' }],
              parameters: { sampleCount: 1 }
            })
          }
        )

        const status = response.status
        const body = await response.text()

        results.models[model.name] = {
          available: response.ok,
          status,
          error: response.ok ? null : parseGeminiError(body)
        }
      } else {
        // Test chat model with simple request
        const response = await fetch(
          `${GEMINI_API_BASE}/models/${model.name}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Say "OK" if you can hear me.' }] }],
              generationConfig: { maxOutputTokens: 10 }
            })
          }
        )

        const status = response.status
        const body = await response.text()

        results.models[model.name] = {
          available: response.ok,
          status,
          error: response.ok ? null : parseGeminiError(body)
        }
      }
    } catch (error: any) {
      results.models[model.name] = {
        available: false,
        status: 0,
        error: error.message
      }
    }
  }

  // Summary
  const availableModels = Object.entries(results.models)
    .filter(([_, v]: any) => v.available)
    .map(([k]) => k)

  results.summary = {
    totalModels: modelsToTest.length,
    availableModels: availableModels.length,
    available: availableModels,
    canGenerateImages: availableModels.some(m => m.includes('imagen')),
    canChat: availableModels.some(m => m.includes('gemini'))
  }

  if (results.summary.availableModels === 0) {
    results.recommendation = 'No models are accessible. Please verify your GEMINI_API_KEY is valid and has not expired. Get a new key at https://aistudio.google.com/app/apikey'
  } else if (!results.summary.canGenerateImages) {
    results.recommendation = 'Image generation models are not accessible. Imagen 3 requires a Google Cloud project with Vertex AI enabled and billing configured.'
  }

  console.log(`[${requestId}] Diagnostics complete:`, JSON.stringify(results.summary))

  return new Response(
    JSON.stringify({ success: true, diagnostics: results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Vision Coach Chat
 */
async function handleChat(apiKey: string, params: any, requestId: string) {
  const { history = [], message } = params

  const systemInstruction = `You are a high-end retirement vision coach named "Visionary".
Your goal is to help couples (like Milton and Lisa) articulate their dream retirement.
Be inspiring, professional, and concise. Ask probing questions about their lifestyle, location (e.g., Thailand), and legacy.`

  const prompt = `
History: ${history.map((h: any) => `${h.role}: ${h.text}`).join('\n')}
User: ${message}
  `

  const response = await callGeminiAPI(apiKey, MODELS.chat, {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  }, requestId)

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ||
    "I'm having trouble envisioning that right now. Please try again."

  return successResponse({ text }, requestId)
}

/**
 * Summarize chat into image prompt
 */
async function handleSummarize(apiKey: string, params: any, requestId: string) {
  const { history = [] } = params

  const prompt = `
Based on the conversation below, create a concise, highly visual image generation prompt that captures the user's dream retirement.
Include details about location, atmosphere, people, and lighting.
Do not include "I want" or "The user wants". Just describe the scene.

Conversation:
${history.map((h: any) => `${h.role}: ${h.text}`).join('\n')}
  `

  const response = await callGeminiAPI(apiKey, MODELS.chat, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 512
    }
  }, requestId)

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return successResponse({ summary: text }, requestId)
}

/**
 * Generate/Edit Vision Board Image
 *
 * Attempts image generation in order:
 * 1. Gemini 2.0 Flash Preview Image Generation (dedicated model)
 * 2. Gemini 2.0 Flash Exp (with responseModalities)
 * 3. Imagen 3 (requires Vertex AI - most won't have access)
 */
async function handleImageGeneration(apiKey: string, params: any, profile: any, requestId: string) {
  const { images = [], prompt, embeddedText, titleText, style, aspectRatio } = params

  console.log(`[${requestId}] Image generation requested. Images: ${images.length}, Style: ${style}, Tier: ${profile?.subscription_tier}`)

  // Build prompt for image generation
  let finalPrompt = prompt || 'Create a beautiful, inspiring vision board image.'

  if (titleText) {
    finalPrompt += ` Include the title "${titleText}" prominently in the image.`
  }

  if (embeddedText) {
    finalPrompt += ` Include the text "${embeddedText}" naturally in the scene.`
  }

  // Apply Style Modifiers
  if (style) {
    finalPrompt += ` Style: ${style}.`
  }

  // Apply Premium Enhancements (Pro/Elite only)
  const isPremium = profile?.subscription_tier === 'PRO' || profile?.subscription_tier === 'ELITE';
  if (isPremium) {
    finalPrompt += ` High resolution, 8k, ultra-detailed, masterpiece, professional photography, cinematic lighting, award-winning composition.`
  } else {
    // Free tier limitation (optional: could enforce lower quality or standard style)
    finalPrompt += ` Standard quality.`
  }

  console.log(`[${requestId}] Final prompt: ${finalPrompt.substring(0, 100)}...`)

  const errors: Record<string, string> = {}

  // Attempt 1: Try dedicated image generation preview model
  const previewResult = await tryGeminiImageGeneration(apiKey, finalPrompt, images, MODELS.image_primary, requestId, aspectRatio)
  if (previewResult.success) {
    console.log(`[${requestId}] Gemini Preview Image Gen succeeded`)
    return successResponse({ image: previewResult.image }, requestId)
  }
  errors['gemini_preview'] = previewResult.error || 'Unknown error'
  console.warn(`[${requestId}] Gemini Preview Image Gen failed: ${previewResult.error}`)

  // Attempt 2: Try Gemini 2.0 Flash Experimental with image output
  const geminiExpResult = await tryGeminiImageGeneration(apiKey, finalPrompt, images, MODELS.image_fallback, requestId, aspectRatio)
  if (geminiExpResult.success) {
    console.log(`[${requestId}] Gemini 2.0 Flash Exp succeeded`)
    return successResponse({ image: geminiExpResult.image }, requestId)
  }
  errors['gemini_exp'] = geminiExpResult.error || 'Unknown error'
  console.warn(`[${requestId}] Gemini 2.0 Flash Exp failed: ${geminiExpResult.error}`)

  // Attempt 3: Try Imagen 3 (requires Vertex AI)
  const imagenResult = await tryImagenGeneration(apiKey, finalPrompt, requestId, aspectRatio)
  if (imagenResult.success) {
    console.log(`[${requestId}] Imagen 3 succeeded`)
    return successResponse({ image: imagenResult.image }, requestId)
  }
  errors['imagen3'] = imagenResult.error || 'Unknown error'
  console.warn(`[${requestId}] Imagen 3 failed: ${imagenResult.error}`)

  console.error(`[${requestId}] All image generation methods failed:`, JSON.stringify(errors))

  // Provide actionable error message
  let helpMessage = 'Image generation is currently unavailable. '

  // Check for common error patterns
  const allErrors = Object.values(errors).join(' ')
  if (allErrors.includes('API_KEY_INVALID')) {
    helpMessage = 'Your Gemini API key is invalid. Please check your GEMINI_API_KEY in Supabase secrets. '
  } else if (allErrors.includes('PERMISSION_DENIED') || allErrors.includes('not found') || allErrors.includes('404')) {
    helpMessage += 'The image generation models may not be available with your API key. Try getting a new key from https://aistudio.google.com/app/apikey '
  }
  helpMessage += 'Please check your GEMINI_API_KEY configuration or try again later.'

  return errorResponse(
    `${helpMessage} Technical details: ${JSON.stringify(errors)}`,
    400,
    requestId
  )
}

/**
 * Try Imagen 3 generation
 */
async function tryImagenGeneration(apiKey: string, prompt: string, requestId: string, aspectRatio?: string): Promise<{ success: boolean; image?: string; error?: string }> {
  try {
    console.log(`[${requestId}] Trying Imagen 3...`)

    const response = await fetch(
      `${GEMINI_API_BASE}/models/${MODELS.image_primary}:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: aspectRatio || '4:3',
            safetyFilterLevel: 'block_only_high',
            personGeneration: 'allow_adult'
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      const parsedError = parseGeminiError(errorText)
      return { success: false, error: `${response.status}: ${parsedError}` }
    }

    const data = await response.json()
    if (data.predictions?.[0]?.bytesBase64Encoded) {
      return {
        success: true,
        image: `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`
      }
    }

    return { success: false, error: 'No image in response' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Try Gemini model for image generation
 * Note: Gemini 2.0 Flash Exp requires responseModalities to be set for image generation
 */
async function tryGeminiImageGeneration(
  apiKey: string,
  prompt: string,
  images: string[],
  model: string,
  requestId: string,
  aspectRatio?: string
): Promise<{ success: boolean; image?: string; error?: string }> {
  try {
    console.log(`[${requestId}] Trying ${model} for image generation...`)

    const parts: any[] = []

    // Add reference images if provided
    for (const img of images) {
      if (!img) continue

      let base64Data = img
      let mimeType = 'image/jpeg'

      if (base64Data.includes('base64,')) {
        const mimeMatch = base64Data.match(/^data:(.*?);/)
        if (mimeMatch) mimeType = mimeMatch[1]
        base64Data = base64Data.split(',')[1]
      }

      parts.push({
        inlineData: { mimeType, data: base64Data }
      })
    }

    // Add text prompt for image generation
    parts.push({
      text: `Generate an image: ${prompt}. Create a high-quality, photorealistic vision board image.`
    })

    // For Gemini 2.0 Flash Exp, we need responseModalities to enable image generation
    const isExpModel = model.includes('exp') || model.includes('2.0')

    const requestBody: any = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 8192
      }
    }

    // Add responseModalities for experimental models that support image output
    if (isExpModel) {
      requestBody.generationConfig.responseModalities = ['IMAGE', 'TEXT']
      console.log(`[${requestId}] Using responseModalities for ${model}`)
    }

    const response = await callGeminiAPI(apiKey, model, requestBody, requestId)

    const imageData = extractImageFromResponse(response)
    if (imageData) {
      return { success: true, image: imageData }
    }

    // Check if we got text instead
    const textResponse = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (textResponse) {
      return { success: false, error: `Model returned text instead of image: "${textResponse.substring(0, 100)}..."` }
    }

    return { success: false, error: 'No image or text in response' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Generate Financial Projection
 */
async function handleFinancialProjection(apiKey: string, params: any, requestId: string) {
  const { description } = params

  const prompt = `Generate a JSON array of 5 objects representing financial growth over 5 years based on this scenario: "${description}".
Each object must have: "year" (number), "savings" (number), "projected" (number), "goal" (number).
Return ONLY valid JSON.`

  const response = await callGeminiAPI(apiKey, MODELS.reasoning, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 512,
      responseMimeType: 'application/json'
    }
  }, requestId)

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

  try {
    const projection = JSON.parse(text)
    return successResponse({ projection }, requestId)
  } catch {
    console.warn(`[${requestId}] Failed to parse financial projection, using fallback`)
    return successResponse({
      projection: [
        { year: 2024, savings: 500000, projected: 500000, goal: 500000 },
        { year: 2025, savings: 600000, projected: 650000, goal: 700000 },
        { year: 2026, savings: 750000, projected: 800000, goal: 950000 },
        { year: 2027, savings: 900000, projected: 1000000, goal: 1200000 },
      ]
    }, requestId)
  }
}

/**
 * Parse Financial Data from Chat
 */
async function handleParseFinancial(apiKey: string, params: any, requestId: string) {
  const { history } = params

  const prompt = `Extract financial data from this conversation history into JSON:
History: ${history}
Required fields: currentSavings (number), monthlyContribution (number), targetGoal (number), targetYear (number), dreamDescription (string).
If a field is missing, estimate a reasonable default for a high-net-worth individual.`

  const response = await callGeminiAPI(apiKey, MODELS.chat, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 512,
      responseMimeType: 'application/json'
    }
  }, requestId)

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  try {
    const financialData = JSON.parse(text)
    return successResponse({ data: financialData }, requestId)
  } catch {
    console.warn(`[${requestId}] Failed to parse financial data, using fallback`)
    return successResponse({
      data: {
        currentSavings: 100000,
        monthlyContribution: 5000,
        targetGoal: 1000000,
        targetYear: 2030,
        dreamDescription: 'Retire comfortably'
      }
    }, requestId)
  }
}

/**
 * Generate Action Plan with Search Grounding
 */
async function handleActionPlan(apiKey: string, params: any, requestId: string) {
  const { visionContext, financialContext } = params

  const prompt = `
You are an expert Life Execution Agent & Systems Architect.
Vision Context: ${visionContext}
Financial Context: ${financialContext}
Current Date: ${new Date().toISOString()}

TASK:
Generate a 3-year roadmap based on "Systems Thinking" (Dan Martell / Atomic Habits).
Instead of just one-off tasks, define RECURRING SYSTEMS.
USE GOOGLE SEARCH to find *real* market data (e.g. median home price in specific location, visa costs) to populate the 'marketResearchSnippet'.

For each year, generate:
1. A Title.
2. A specific "Market Research Snippet" with REAL DATA found via search tools.
3. 2-3 specific Action Tasks (One-off).
4. **NEW**: Define 1-2 "System SOPs" (Recurring Habits) for this phase.
   - Name: e.g., "Weekly Finance Review"
   - Trigger: "time" | "event"
   - Schedule: Cron format or description (e.g., "Every Friday at 9am")
   - Prompt: Instructions for the user.

Return ONLY a valid JSON array of Milestone objects. Do not wrap in markdown code blocks.
Schema:
[{
  "year": number,
  "title": string,
  "marketResearchSnippet": string,
  "tasks": [{ "id": string, "title": string, "description": string, "dueDate": string, "type": string, "isCompleted": false, "aiMetadata": { "suggestedTool": "GMAIL" | "MAPS" | "CALENDAR" } }],
  "systemSOPs": [{ "name": string, "trigger": "time", "schedule": string, "prompt": string }]
}]
  `

  const response = await callGeminiAPI(apiKey, MODELS.reasoning, {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 4096
    }
  }, requestId)

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

  try {
    // Clean markdown if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim()
    const plan = JSON.parse(cleanText)

    // Add UUIDs if missing
    plan.forEach((m: any) => {
      if (m.tasks) {
        m.tasks.forEach((t: any) => {
          if (!t.id) t.id = crypto.randomUUID()
        })
      }
    })

    return successResponse({ plan }, requestId)
  } catch (e) {
    console.error(`[${requestId}] Action plan parse error:`, e)
    return successResponse({ plan: [], rawText: text }, requestId)
  }
}

/**
 * Raw API Request (for flexibility)
 */
async function handleRawRequest(apiKey: string, params: any, requestId: string) {
  const { model = MODELS.chat, contents, config = {} } = params

  const response = await callGeminiAPI(apiKey, model, {
    contents,
    ...config
  }, requestId)

  return successResponse({ response }, requestId)
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function callGeminiAPI(apiKey: string, model: string, requestBody: any, requestId: string): Promise<any> {
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`

  console.log(`[${requestId}] Calling Gemini API: ${model}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    const parsedError = parseGeminiError(errorText)
    console.error(`[${requestId}] Gemini API error (${model}): ${response.status} - ${parsedError}`)
    throw new Error(`Gemini API error (${model}): ${parsedError}`)
  }

  return await response.json()
}

function extractImageFromResponse(response: any): string | null {
  const parts = response.candidates?.[0]?.content?.parts
  if (parts) {
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        const mimeType = part.inlineData.mimeType || 'image/png'
        return `data:${mimeType};base64,${part.inlineData.data}`
      }
    }
  }
  return null
}

/**
 * Parse Gemini error response into readable message
 */
function parseGeminiError(errorText: string): string {
  try {
    const parsed = JSON.parse(errorText)
    if (parsed.error) {
      const { message, status, details } = parsed.error
      let errorMsg = message || status || 'Unknown error'

      // Extract specific error reasons
      if (details?.[0]?.reason) {
        errorMsg += ` (${details[0].reason})`
      }

      // Add helpful hints based on error type
      if (errorMsg.includes('API_KEY_INVALID')) {
        errorMsg += ' - Please get a new API key from https://aistudio.google.com/app/apikey'
      } else if (errorMsg.includes('PERMISSION_DENIED')) {
        errorMsg += ' - This model may require additional permissions or Vertex AI access'
      } else if (errorMsg.includes('RESOURCE_EXHAUSTED')) {
        errorMsg += ' - Rate limit exceeded, please try again later'
      }

      return errorMsg
    }
    return errorText.substring(0, 200)
  } catch {
    return errorText.substring(0, 200)
  }
}

/**
 * Create success response with standard format
 */
function successResponse(data: any, requestId: string): Response {
  return new Response(
    JSON.stringify({ success: true, requestId, ...data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Create error response with standard format
 */
function errorResponse(message: string, status: number, requestId: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      requestId,
      timestamp: new Date().toISOString(),
      help: 'Run with action: "diagnose" to check API key and model availability'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
}

/**
 * Enhance a user's prompt using Gemini
 */
async function handleEnhancePrompt(apiKey: string, params: any, requestId: string) {
  const { prompt } = params

  const systemInstruction = `You are an expert prompt engineer for AI image generation. 
  Rewrite the following user description into a detailed, artistic, and high-quality image generation prompt.
  Keep it under 100 words. Focus on lighting, texture, composition, and atmosphere.
  Do NOT add any conversational text. Return ONLY the enhanced prompt.`

  const response = await callGeminiAPI(apiKey, MODELS.chat, {
    contents: [{ parts: [{ text: `User Description: "${prompt}"\n\nEnhanced Prompt:` }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 256
    }
  }, requestId)

  const enhancedPrompt = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || prompt

  return successResponse({ enhancedPrompt }, requestId)
}

/**
 * Generate Contextual Vision Suggestions
 */
async function handleGenerateSuggestions(apiKey: string, params: any, requestId: string) {
  const { userProfile } = params

  const systemInstruction = `You are a creative Vision Board Consultant.
  Based on the user's profile, suggest 3 distinct, vivid, and inspiring vision board image concepts.
  Each suggestion should be a single sentence description suitable for an image prompt.
  Focus on their specific goals (e.g. retirement location, hobbies).
  Return ONLY a valid JSON array of strings. Example: ["A modern villa in Tuscany...", "Hiking in the Swiss Alps...", "Reading by a fireplace..."]`

  const prompt = `User Profile: ${JSON.stringify(userProfile)}`

  const response = await callGeminiAPI(apiKey, MODELS.chat, {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 512,
      responseMimeType: 'application/json'
    }
  }, requestId)

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

  try {
    const suggestions = JSON.parse(text)
    return successResponse({ suggestions }, requestId)
  } catch (e) {
    console.error(`[${requestId}] Failed to parse suggestions:`, e)
    return successResponse({ suggestions: [] }, requestId)
  }
}
