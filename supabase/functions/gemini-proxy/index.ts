import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * Model Configuration
 *
 * NANO BANANA = Gemini 2.5 Flash native image generation
 * NANO BANANA PRO = Gemini 2.5 Pro native image generation (better likeness/character consistency)
 *
 * These models support:
 * - Native image generation via responseModalities: ['IMAGE', 'TEXT']
 * - Multi-turn conversations with image inputs for character consistency
 * - Text rendering in images
 * - High-quality photorealistic outputs
 */

// Environment variable overrides for flexibility
const getModelConfig = () => {
  const env = typeof Deno !== 'undefined' ? Deno.env : { get: () => undefined }
  return {
    // Primary: Gemini 2.0 Flash Exp - MOST RELIABLE for image generation
    // This is currently the best working model for image generation with reference images
    // If you have access to gemini-3-pro-image-preview, set GOOGLE_IMAGE_MODEL_PRIMARY env var
    image_primary: env.get?.('GOOGLE_IMAGE_MODEL_PRIMARY') || 'gemini-2.0-flash-exp',

    // Fallback 1: Gemini 2.5 Flash Image (Nano Banana)
    // Good balance of speed/quality, supports up to 3 reference images
    image_fallback_1: env.get?.('GOOGLE_IMAGE_MODEL_FALLBACK') || 'gemini-2.5-flash-preview-05-20',

    // Fallback 2: Gemini 2.0 Flash Experimental (older variant)
    // Older but stable, uses responseModalities
    image_fallback_2: 'gemini-2.0-flash-exp-image-generation',

    // Fallback 3: Imagen 3 (different API endpoint)
    // Last resort - doesn't support reference images for likeness
    // WARNING: Likeness will NOT be preserved with this model
    image_imagen: 'imagen-3.0-generate-002',
  }
}

const MODELS = {
  // Chat: Use Gemini 2.0 Flash for conversational AI
  chat: 'gemini-2.0-flash-001',

  // Reasoning: Use Gemini 2.5 Pro for complex planning and projections
  reasoning: 'gemini-2.5-pro',

  // Likeness Validation: Use multimodal model to compare faces
  likeness_validator: 'gemini-2.0-flash-001',
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
      case 'validate_likeness':
        result = await handleLikenessValidation(GEMINI_API_KEY, params, requestId)
        break
      default:
        return errorResponse(
          `Unknown action: ${action}. Valid actions: chat, summarize, generate_image, enhance_prompt, generate_suggestions, financial_projection, parse_financial, action_plan, raw, validate_likeness, diagnose`,
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

  // Get model config for testing
  const modelConfig = getModelConfig()

  // Test each model
  const modelsToTest = [
    { name: MODELS.chat, type: 'chat' },
    { name: modelConfig.image_primary, type: 'gemini_image', label: 'Nano Banana Pro (Primary)' },
    { name: modelConfig.image_fallback_1, type: 'gemini_image', label: 'Nano Banana (Fallback 1)' },
    { name: modelConfig.image_fallback_2, type: 'gemini_image', label: 'Gemini 2.0 Exp (Fallback 2)' },
    { name: modelConfig.image_imagen, type: 'imagen', label: 'Imagen 3 (Fallback 3)' },
  ]

  for (const model of modelsToTest) {
    try {
      console.log(`[${requestId}] Testing model: ${model.name} (${model.type})`)

      if (model.type === 'imagen') {
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
          type: 'imagen',
          error: response.ok ? null : parseGeminiError(body)
        }
      } else if (model.type === 'gemini_image') {
        // Test Gemini image model with generateContent (just check if model is accessible)
        const response = await fetch(
          `${GEMINI_API_BASE}/models/${model.name}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Describe a beautiful sunset.' }] }],
              generationConfig: {
                maxOutputTokens: 50,
                responseModalities: ['TEXT'] // Just text to check model availability
              }
            })
          }
        )

        const status = response.status
        const body = await response.text()

        results.models[model.name] = {
          available: response.ok,
          status,
          type: 'gemini_image',
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
          type: 'chat',
          error: response.ok ? null : parseGeminiError(body)
        }
      }
    } catch (error: any) {
      results.models[model.name] = {
        available: false,
        status: 0,
        type: model.type,
        error: error.message
      }
    }
  }

  // Summary
  const availableModels = Object.entries(results.models)
    .filter(([_, v]: any) => v.available)
    .map(([k]) => k)

  const availableImageModels = Object.entries(results.models)
    .filter(([_, v]: any) => v.available && (v.type === 'gemini_image' || v.type === 'imagen'))
    .map(([k]) => k)

  results.summary = {
    totalModels: modelsToTest.length,
    availableModels: availableModels.length,
    available: availableModels,
    canGenerateImages: availableImageModels.length > 0,
    availableImageModels,
    canChat: availableModels.some(m => m.includes('gemini') && !m.includes('image'))
  }

  if (results.summary.availableModels === 0) {
    results.recommendation = 'No models are accessible. Please verify your GEMINI_API_KEY is valid and has not expired. Get a new key at https://aistudio.google.com/app/apikey'
  } else if (!results.summary.canGenerateImages) {
    results.recommendation = 'No image generation models are accessible. Please ensure your API key has access to gemini-2.5-flash-image, gemini-2.0-flash-exp, or imagen-3.0-generate-002. Visit https://aistudio.google.com/app/apikey to check your key permissions.'
  } else {
    results.recommendation = `Image generation is available using: ${availableImageModels.join(', ')}`
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
 * Generate/Edit Vision Board Image with Likeness Preservation
 *
 * UPDATED: December 2025 - Dual-Strategy Approach for Better Success Rate
 *
 * This function implements a TWO-STRATEGY approach for each model:
 *
 * STRATEGY A (Complex): 3-turn conversation with Identity Lock Protocol
 * - Best for advanced models that support multi-turn with images
 * - More detailed identity preservation instructions
 * - May fail due to safety filters or unsupported model formats
 *
 * STRATEGY B (Simple): Single-turn request with all images + text together
 * - More compatible across different model versions
 * - Natural language prompt (less "robotic")
 * - Used as immediate fallback when complex fails
 *
 * Model fallback order:
 * 1. Gemini 2.0 Flash Exp (Primary) - Most reliable for image generation
 * 2. Gemini 2.5 Flash Preview - Good balance of speed/quality
 * 3. Gemini 2.0 Flash Exp Image Gen - Older variant fallback
 * 4. Imagen 3 - LAST RESORT (no reference image support - likeness LOST)
 *
 * For each Gemini model, we try BOTH strategies before moving to next model.
 * This significantly improves success rate while preserving likeness.
 */
async function handleImageGeneration(apiKey: string, params: any, profile: any, requestId: string) {
  const { images = [], prompt, embeddedText, titleText, style, aspectRatio, identityPrompt, referenceImageTags = [] } = params

  // Enhanced logging for likeness pipeline debugging (no PII logged)
  const baseImagePresent = images.length > 0
  const referenceImageCount = images.length > 1 ? images.length - 1 : 0 // First image is base
  const hasIdentity = !!identityPrompt
  const identityLength = identityPrompt ? identityPrompt.length : 0
  const isPremium = profile?.subscription_tier === 'PRO' || profile?.subscription_tier === 'ELITE'

  console.log(`[${requestId}] Image generation requested:`, JSON.stringify({
    baseImage: baseImagePresent,
    referenceImages: referenceImageCount,
    style: style || 'default',
    tier: profile?.subscription_tier || 'unknown',
    hasIdentityPrompt: hasIdentity,
    identityPromptLength: identityLength,
    hasTitle: !!titleText,
    hasEmbeddedText: !!embeddedText,
    referenceTagCount: referenceImageTags.length
  }))

  // Common request params
  const requestParams: LikenessRequestParams = {
    baseImage: images[0] || null,
    referenceImages: images.slice(1),
    referenceImageTags,
    identityPrompt,
    sceneDescription: prompt || 'Create a beautiful, inspiring vision board image.',
    titleText,
    embeddedText,
    style,
    aspectRatio,
    isPremium
  }

  // Build BOTH request strategies
  // Strategy A: Complex 3-turn conversation (original approach - better for advanced models)
  const complexRequest = buildLikenessPreservingRequest(requestParams, requestId)

  // Strategy B: Simple single-turn (more compatible - fallback for when complex fails)
  const simpleRequest = buildSimpleLikenessRequest(requestParams, requestId)

  console.log(`[${requestId}] Built generation requests: complex=${complexRequest.contents.length} turns, simple=1 turn`)

  // Get model configuration
  const modelConfig = getModelConfig()
  const errors: Record<string, string> = {}

  // Define model sequence to try
  // Prioritize gemini-2.0-flash-exp as it's currently most reliable for image generation
  const modelSequence = [
    { id: modelConfig.image_primary, name: 'Primary (Nano Banana Pro)' },
    { id: modelConfig.image_fallback_2, name: 'Gemini 2.0 Flash Exp' }, // Moved up - most reliable
    { id: modelConfig.image_fallback_1, name: 'Fallback (Nano Banana)' },
  ]

  // Try each model with BOTH strategies before moving to next model
  for (const model of modelSequence) {
    console.log(`[${requestId}] Trying ${model.name} (${model.id})...`)

    // Strategy A: Try complex multi-turn prompt first
    let result = await tryGeminiImageGenerationV2(apiKey, complexRequest, model.id, requestId)

    if (result.success) {
      const imageSize = result.image?.length || 0
      console.log(`[${requestId}] ✅ SUCCESS: model=${model.id}, strategy=complex_3turn, refs=${referenceImageCount}, hasIdentity=${hasIdentity}, imageSize=${imageSize}`)
      console.log(`[${requestId}] 📊 IMAGE DIAGNOSTIC: starts=${result.image?.substring(0, 30)}, ends=${result.image?.substring(Math.max(0, imageSize - 30))}`)
      return successResponse({
        image: result.image,
        model_used: model.id,
        strategy_used: 'complex_3turn',
        likeness_optimized: true
      }, requestId)
    }

    const complexError = result.error || 'Unknown error'
    console.warn(`[${requestId}] ${model.name} complex prompt failed: ${complexError}`)

    // Strategy B: If complex fails, immediately try SIMPLE single-turn on SAME model
    // This often succeeds when complex fails due to safety filters or format issues
    console.log(`[${requestId}] ${model.name} - retrying with SIMPLE single-turn prompt...`)
    result = await tryGeminiImageGenerationV2(apiKey, simpleRequest, model.id, requestId)

    if (result.success) {
      const imageSize = result.image?.length || 0
      console.log(`[${requestId}] ✅ SUCCESS: model=${model.id}, strategy=simple_single_turn, refs=${referenceImageCount}, hasIdentity=${hasIdentity}, imageSize=${imageSize}`)
      console.log(`[${requestId}] 📊 IMAGE DIAGNOSTIC: starts=${result.image?.substring(0, 30)}, ends=${result.image?.substring(Math.max(0, imageSize - 30))}`)
      return successResponse({
        image: result.image,
        model_used: model.id,
        strategy_used: 'simple_single_turn',
        likeness_optimized: true
      }, requestId)
    }

    // Both strategies failed for this model - record error and move to next
    const simpleError = result.error || 'Unknown error'
    errors[model.id] = `complex: ${complexError} | simple: ${simpleError}`
    console.warn(`[${requestId}] ${model.name} failed all strategies: ${errors[model.id]}`)
  }

  // Last resort: Imagen 3 (no reference image support - likeness WILL be lost)
  console.warn(`[${requestId}] ⚠️ FALLBACK TO IMAGEN: All Gemini models failed with refs=${referenceImageCount}. Reference images will NOT be used - likeness WILL be lost!`)

  const imagenPrompt = buildImagenFallbackPrompt({
    sceneDescription: prompt,
    identityPrompt,
    titleText,
    embeddedText,
    style,
    isPremium
  })

  const imagenResult = await tryImagenGeneration(apiKey, imagenPrompt, requestId, aspectRatio)
  if (imagenResult.success) {
    console.log(`[${requestId}] Imagen 3 succeeded (${modelConfig.image_imagen}) - WARNING: No likeness preservation`)
    return successResponse({
      image: imagenResult.image,
      model_used: modelConfig.image_imagen,
      strategy_used: 'imagen_text_only',
      likeness_optimized: false,
      warning: 'Generated with Imagen 3 fallback - likeness may not be preserved. Reference photos were not used.'
    }, requestId)
  }
  errors[modelConfig.image_imagen] = imagenResult.error || 'Unknown error'
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
  } else if (allErrors.includes('RESOURCE_EXHAUSTED') || allErrors.includes('quota')) {
    helpMessage += 'API quota exceeded. Please try again later or upgrade your API plan. '
  }
  helpMessage += 'Please check your GEMINI_API_KEY configuration or try again later.'

  return errorResponse(
    `${helpMessage} Technical details: ${JSON.stringify(errors)}`,
    400,
    requestId
  )
}

/**
 * Centralized Prompt Builder for Likeness-Preserving Image Generation
 *
 * UPDATED: December 2025 - Optimized for Gemini 3 Pro Image (Nano Banana Pro)
 *
 * This builds a 3-turn conversation structure based on Google's best practices:
 * 1. TURN 1 (User): All reference images with comprehensive identity anchoring
 * 2. TURN 2 (Model - Simulated): Acknowledgment that reinforces understanding
 * 3. TURN 3 (User): Scene generation request with identity reminders
 *
 * Key improvements:
 * - All images sent in first turn for better context
 * - Simulated model acknowledgment for identity reinforcement
 * - Lower temperature (0.4) for more consistent likeness
 * - Proper imageConfig for aspect ratio and resolution
 */
interface LikenessRequestParams {
  baseImage: string | null
  referenceImages: string[]
  referenceImageTags: string[]
  identityPrompt?: string
  sceneDescription: string
  titleText?: string
  embeddedText?: string
  style?: string
  aspectRatio?: string
  isPremium: boolean
}

function buildLikenessPreservingRequest(params: LikenessRequestParams, requestId: string): {
  contents: any[]
  generationConfig: any
} {
  const {
    baseImage,
    referenceImages,
    referenceImageTags,
    identityPrompt,
    sceneDescription,
    titleText,
    embeddedText,
    style,
    aspectRatio,
    isPremium
  } = params

  const contents: any[] = []

  // Parse identity descriptions from the identityPrompt (separated by double newlines)
  const identityDescriptions = identityPrompt
    ? identityPrompt.split('\n\n').filter(Boolean)
    : []

  // ============================================
  // TURN 1: Identity Establishment (User)
  // Introduce ALL reference images with strong identity anchoring
  // ============================================
  const turn1Parts: any[] = []

  // Add base image first
  if (baseImage) {
    const baseImageData = extractBase64Data(baseImage)
    turn1Parts.push({
      inlineData: {
        mimeType: baseImageData.mimeType,
        data: baseImageData.base64
      }
    })
  }

  // Add all reference images to the first turn
  referenceImages.forEach((refImage) => {
    const refImageData = extractBase64Data(refImage)
    turn1Parts.push({
      inlineData: {
        mimeType: refImageData.mimeType,
        data: refImageData.base64
      }
    })
  })

  // Build comprehensive identity description
  // CRITICAL: Explicitly mention using people from the base/first image - this dramatically improves likeness
  let identityText = `IDENTITY LOCK PROTOCOL - READ CAREFULLY:

These photos show the EXACT person(s) who MUST appear in all generated images.
${baseImage ? `\nIMPORTANT: The FIRST image is the primary reference photo. Use the exact appearance of the people shown in this base image as the foundation for likeness.\n` : ''}
`

  // Add tagged descriptions for each person
  if (referenceImageTags.length > 0) {
    identityText += `PEOPLE IN THESE PHOTOS:\n`
    referenceImageTags.forEach((tag, index) => {
      const desc = identityDescriptions[index] || ''
      if (desc) {
        identityText += `- ${tag}: ${desc}\n`
      } else {
        identityText += `- ${tag}\n`
      }
    })
    identityText += `\n`
  }

  identityText += `MANDATORY IDENTITY REQUIREMENTS:
1. FACE: Preserve EXACT facial structure, shape, and proportions. Every facial feature must match.
2. SKIN: Match skin tone, complexion, and any visible marks/features EXACTLY.
3. AGE: Keep the SAME age appearance - do NOT make younger or older.
4. BODY: Preserve body type, height ratio, and build EXACTLY as shown.
5. FEATURES: Keep hair style/color, glasses, facial hair, or accessories if present.
6. ETHNICITY: Preserve exact ethnic appearance - do NOT change or generalize.

These requirements are ABSOLUTE and override any scene requirements.
If the scene conflicts with identity preservation, MODIFY THE SCENE, not the people.

Confirm you understand these people and will preserve their exact likeness in any images you generate.`

  turn1Parts.push({ text: identityText })

  contents.push({
    role: 'user',
    parts: turn1Parts
  })

  // ============================================
  // TURN 2: Model Acknowledgment (Simulated)
  // This helps reinforce the identity understanding
  // ============================================
  const peopleNames = referenceImageTags.length > 0
    ? referenceImageTags.join(' and ')
    : 'the person(s) shown'

  const totalImageCount = (baseImage ? 1 : 0) + referenceImages.length

  contents.push({
    role: 'model',
    parts: [{
      text: `I have carefully analyzed all ${totalImageCount} reference photo(s) and locked in the identity characteristics of ${peopleNames}.

I will preserve their exact:
- Facial features and structure
- Skin tone and complexion
- Age appearance
- Body type and proportions
- Distinctive features (hair, glasses, etc.)

I understand that identity preservation is the HIGHEST PRIORITY and will never substitute generic models or idealized versions. I am ready to generate images with these individuals while maintaining 100% likeness fidelity. What scene would you like me to create?`
    }]
  })

  // ============================================
  // TURN 3: Scene Generation Request (User)
  // Now request the actual vision board
  // ============================================
  let sceneInstructions = `Now generate a vision board image with the following scene:

${sceneDescription}

CRITICAL REMINDERS:
- The people in this image MUST be the EXACT same individuals from the reference photos
- Match their face, skin tone, age, body type, and all distinguishing features PRECISELY
- If you cannot preserve likeness perfectly, adjust the scene composition instead
- Do NOT substitute generic models or idealized versions
- Do NOT change ethnicity, body type, or age appearance
- KEEP FACE SAME - this is the most important requirement
`

  if (titleText) {
    sceneInstructions += `
TEXT TO INCLUDE:
- Display "${titleText}" prominently in elegant typography
- Position text in a clear area that doesn't obscure the people
`
  }

  if (embeddedText) {
    sceneInstructions += `- Also include: "${embeddedText}"\n`
  }

  if (style && style !== 'photorealistic') {
    const styleInstructions: Record<string, string> = {
      'cinematic': 'Apply cinematic style with dramatic lighting and film-like color grading.',
      'oil_painting': 'Render in oil painting style while preserving recognizable facial features.',
      'watercolor': 'Apply soft watercolor aesthetic while maintaining facial likeness accuracy.',
      'cyberpunk': 'Use cyberpunk neon aesthetic while keeping faces clearly recognizable.',
      '3d_render': 'Create 3D rendered style while preserving accurate facial proportions and features.'
    }

    sceneInstructions += `
ARTISTIC STYLE: ${styleInstructions[style] || style}
Note: Apply style to the environment and aesthetic, but DO NOT alter the people's identities or features.
`
  }

  if (isPremium) {
    sceneInstructions += `
QUALITY: Render at highest quality with professional lighting, cinematic composition, and ultra-detailed textures.
`
  }

  contents.push({
    role: 'user',
    parts: [{ text: sceneInstructions }]
  })

  // Build generation config with improved settings
  const generationConfig: any = {
    temperature: 0.4, // Lower temperature for more consistent likeness
    maxOutputTokens: 8192,
    responseModalities: ['IMAGE', 'TEXT']
  }

  // Add imageConfig for Gemini 3 Pro Image
  if (aspectRatio || isPremium) {
    generationConfig.imageConfig = {}

    if (aspectRatio) {
      generationConfig.imageConfig.aspectRatio = aspectRatio
    }

    if (isPremium) {
      generationConfig.imageConfig.imageSize = '2K' // Higher resolution for premium users
    }
  }

  console.log(`[${requestId}] Built ${contents.length}-turn conversation with ${totalImageCount} reference images, temp=${generationConfig.temperature}`)

  return { contents, generationConfig }
}

/**
 * Simple Single-Turn Likeness Request Builder
 *
 * UPDATED: December 2025 - Alternative to complex 3-turn structure
 *
 * This builds a simpler single-turn request that:
 * - Puts all images + text in ONE user message
 * - Avoids simulated model turns that may trigger safety refusals
 * - More compatible with various Gemini model versions
 *
 * Use this as a fallback when the complex 3-turn approach fails.
 */
function buildSimpleLikenessRequest(params: LikenessRequestParams, requestId: string): {
  contents: any[]
  generationConfig: any
} {
  const {
    baseImage,
    referenceImages,
    referenceImageTags,
    identityPrompt,
    sceneDescription,
    titleText,
    embeddedText,
    style,
    aspectRatio,
    isPremium
  } = params

  const parts: any[] = []

  // 1. Add ALL reference images first (base image + additional references)
  if (baseImage) {
    const data = extractBase64Data(baseImage)
    parts.push({ inlineData: { mimeType: data.mimeType, data: data.base64 } })
  }

  referenceImages.forEach((img: string) => {
    const data = extractBase64Data(img)
    parts.push({ inlineData: { mimeType: data.mimeType, data: data.base64 } })
  })

  const totalImages = (baseImage ? 1 : 0) + referenceImages.length

  // 2. Build a natural language prompt (less "robotic" than the Identity Lock Protocol)
  const identityNames = referenceImageTags.length > 0
    ? referenceImageTags.join(' and ')
    : 'these people'

  // Parse identity descriptions
  const identityDescriptions = identityPrompt
    ? identityPrompt.split('\n\n').filter(Boolean)
    : []

  let identityDesc = ''
  if (identityDescriptions.length > 0) {
    identityDesc = `\n\nKey physical details to preserve:\n${identityDescriptions.map((desc, i) => {
      const tag = referenceImageTags[i] || `Person ${i + 1}`
      return `- ${tag}: ${desc}`
    }).join('\n')}`
  }

  // Build natural conversational prompt (like Gemini chat - avoids triggering safety filters)
  // CRITICAL: When base image contains people, explicitly instruct to use them for likeness
  let baseImageInstruction = ''
  if (baseImage) {
    // Auto-detect: if a base image is provided, assume it contains the person(s) to match
    // This is the key insight - explicitly telling the model to use people from the base image
    // dramatically improves likeness preservation
    baseImageInstruction = `IMPORTANT: The first attached image is the primary reference photo showing the person(s) to depict. Use the exact appearance of the people in this base image. `
  }

  let prompt = `${baseImageInstruction}Use the attached reference photos of ${identityNames} and generate an image of them ${sceneDescription}.

Make sure the faces and body types match the reference photos exactly - same skin tone, same facial features, same build.${identityDesc}`

  // Add text overlay instructions (natural language)
  if (titleText) {
    prompt += `\n\nInclude the text "${titleText}" in elegant typography.`
  }
  if (embeddedText) {
    prompt += ` Also include: "${embeddedText}"`
  }

  // Add style instructions (natural language)
  if (style && style !== 'photorealistic') {
    const styleDescriptions: Record<string, string> = {
      'cinematic': 'with cinematic lighting and film-like colors',
      'oil_painting': 'in oil painting style',
      'watercolor': 'with soft watercolor aesthetic',
      'cyberpunk': 'with cyberpunk neon aesthetic',
      '3d_render': 'in 3D rendered style'
    }
    prompt += `\n\nStyle: ${styleDescriptions[style] || style}. Keep the people looking like themselves.`
  }

  if (isPremium) {
    prompt += `\n\nMake it high quality with professional lighting and detail.`
  }

  parts.push({ text: prompt })

  // Build generation config - request IMAGE only (not TEXT) for better results
  const generationConfig: any = {
    temperature: 0.4, // Low temperature for more consistent likeness
    maxOutputTokens: 8192,
    responseModalities: ['IMAGE'] // Only IMAGE - matches how Gemini chat works
  }

  // Add imageConfig for aspect ratio and resolution
  if (aspectRatio || isPremium) {
    generationConfig.imageConfig = {}
    if (aspectRatio) {
      generationConfig.imageConfig.aspectRatio = aspectRatio
    }
    if (isPremium) {
      generationConfig.imageConfig.imageSize = '2K'
    }
  }

  console.log(`[${requestId}] Built SIMPLE single-turn request with ${totalImages} reference images`)

  return {
    contents: [{ role: 'user', parts }],
    generationConfig
  }
}

/**
 * Build simplified prompt for Imagen fallback (text-only, no image references)
 */
function buildImagenFallbackPrompt(params: {
  sceneDescription?: string
  identityPrompt?: string
  titleText?: string
  embeddedText?: string
  style?: string
  isPremium: boolean
}): string {
  let prompt = params.sceneDescription || 'A beautiful, inspiring vision board image.'

  // Add identity descriptions as text (best effort without images)
  if (params.identityPrompt) {
    prompt = `Create an image featuring people with these characteristics: ${params.identityPrompt}. Scene: ${prompt}`
  }

  if (params.titleText) {
    prompt += ` Include the title text "${params.titleText}" prominently.`
  }

  if (params.embeddedText) {
    prompt += ` Include the text "${params.embeddedText}" in the scene.`
  }

  if (params.style) {
    prompt += ` Style: ${params.style}.`
  }

  if (params.isPremium) {
    prompt += ` High resolution, ultra-detailed, professional quality.`
  }

  return prompt
}

/**
 * Extract base64 data and MIME type from various image formats
 */
function extractBase64Data(imageData: string): { base64: string; mimeType: string } {
  if (imageData.includes('base64,')) {
    const mimeMatch = imageData.match(/^data:(.*?);/)
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    const base64 = imageData.split(',')[1]
    return { base64, mimeType }
  }
  return { base64: imageData, mimeType: 'image/jpeg' }
}

/**
 * Improved Gemini Image Generation with multi-turn conversation structure
 *
 * UPDATED: December 2025 - Added thought signature handling for Gemini 3 Pro Image
 *
 * Thought signatures are critical for Gemini 3 Pro Image:
 * - They must be passed back exactly as received in multi-turn conversations
 * - Failure to circulate thought signatures may cause the response to fail
 */
async function tryGeminiImageGenerationV2(
  apiKey: string,
  request: { contents: any[]; generationConfig: any },
  model: string,
  requestId: string
): Promise<{ success: boolean; image?: string; error?: string; thoughtSignature?: string }> {
  try {
    console.log(`[${requestId}] Trying ${model} for likeness-preserving image generation...`)
    console.log(`[${requestId}] Request has ${request.contents.length} turns, temp=${request.generationConfig.temperature}`)

    const requestBody = {
      contents: request.contents,
      generationConfig: request.generationConfig
    }

    const response = await callGeminiAPI(apiKey, model, requestBody, requestId)

    // Extract image from response
    const imageData = extractImageFromResponse(response)
    if (imageData) {
      // Extract thought signature if present (for Gemini 3 Pro Image)
      // This should be passed back in subsequent requests if doing multi-step refinement
      const parts = response.candidates?.[0]?.content?.parts || []
      const thoughtSignature = parts.find((p: any) => p.thought_signature)?.thought_signature

      if (thoughtSignature) {
        console.log(`[${requestId}] Thought signature captured for potential refinement`)
      }

      return {
        success: true,
        image: imageData,
        thoughtSignature
      }
    }

    // Check if we got text instead of image
    const textResponse = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (textResponse) {
      // Log the full text for debugging likeness issues
      console.log(`[${requestId}] Model returned text instead of image: ${textResponse.substring(0, 300)}`)
      return { success: false, error: `Model returned text instead of image: "${textResponse.substring(0, 100)}..."` }
    }

    // Check for safety blocks or other issues
    const finishReason = response.candidates?.[0]?.finishReason
    if (finishReason && finishReason !== 'STOP') {
      console.log(`[${requestId}] Unexpected finish reason: ${finishReason}`)
      return { success: false, error: `Generation stopped: ${finishReason}` }
    }

    return { success: false, error: 'No image or text in response' }
  } catch (error: any) {
    console.error(`[${requestId}] tryGeminiImageGenerationV2 error:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Try Imagen 3 generation
 * Uses :predict endpoint (different from Gemini's :generateContent)
 * Note: Imagen does NOT support reference images, only text prompts
 */
async function tryImagenGeneration(apiKey: string, prompt: string, requestId: string, aspectRatio?: string): Promise<{ success: boolean; image?: string; error?: string }> {
  const modelConfig = getModelConfig()
  try {
    console.log(`[${requestId}] Trying Imagen 3 (${modelConfig.image_imagen})...`)

    // Add negative prompts to improve quality and consistency
    const negativePrompt = 'blurry, distorted faces, cartoon, anime, low quality, ugly, deformed hands, extra fingers, bad proportions, unrealistic skin'

    const response = await fetch(
      `${GEMINI_API_BASE}/models/${modelConfig.image_imagen}:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: aspectRatio || '4:3',
            safetyFilterLevel: 'block_only_high',
            personGeneration: 'allow_adult',
            negativePrompt
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
// LIKENESS VALIDATION (Optional Advanced Pass)
// ============================================

/**
 * Validate Likeness Score
 *
 * This optional function compares reference images with generated output
 * to provide a likeness score and feedback for quality assurance.
 *
 * Returns:
 * - likeness_score: 0-1 (1 = perfect match)
 * - face_match: boolean (are faces recognizable)
 * - body_type_match: boolean (is body type preserved)
 * - explanation: string (detailed feedback)
 * - suggestions: string[] (improvement tips)
 */
async function handleLikenessValidation(apiKey: string, params: any, requestId: string) {
  const { referenceImages = [], generatedImage, referenceDescriptions = [] } = params

  if (!generatedImage) {
    return errorResponse('Missing generatedImage parameter', 400, requestId)
  }

  if (referenceImages.length === 0) {
    return successResponse({
      likeness_score: null,
      skipped: true,
      reason: 'No reference images provided for comparison'
    }, requestId)
  }

  console.log(`[${requestId}] Running likeness validation with ${referenceImages.length} reference images`)

  // Build validation prompt
  const parts: any[] = []

  // Add reference images
  referenceImages.forEach((refImage: string, index: number) => {
    const refData = extractBase64Data(refImage)
    parts.push({
      inlineData: {
        mimeType: refData.mimeType,
        data: refData.base64
      }
    })

    const description = referenceDescriptions[index] || `Reference person ${index + 1}`
    parts.push({
      text: `Reference Image ${index + 1}: ${description}`
    })
  })

  // Add generated image
  const genData = extractBase64Data(generatedImage)
  parts.push({
    inlineData: {
      mimeType: genData.mimeType,
      data: genData.base64
    }
  })

  parts.push({
    text: `Generated Vision Board Image (to evaluate)`
  })

  // Add evaluation prompt
  parts.push({
    text: `You are an expert at comparing faces and body types in images.

Compare the person(s) in the Reference Images with the person(s) in the Generated Vision Board Image.

Evaluate the following aspects:

1. FACE MATCHING
   - Are the facial features recognizable as the same person(s)?
   - Is the face shape preserved?
   - Are distinctive features (nose shape, eye shape, jawline) maintained?

2. SKIN TONE & COMPLEXION
   - Is the skin tone accurate?
   - Is the complexion similar?

3. AGE APPEARANCE
   - Does the person appear the same age?
   - Were they made to look younger/older inappropriately?

4. BODY TYPE
   - Is the general body shape preserved (slim, average, heavy)?
   - Is the height proportion reasonable?
   - Were they idealized or changed significantly?

5. DISTINCTIVE FEATURES
   - Are glasses preserved (if present)?
   - Is facial hair preserved (if present)?
   - Are other identifying features maintained?

Respond ONLY with valid JSON in this exact format:
{
  "likeness_score": <number 0.0 to 1.0>,
  "face_match": <boolean>,
  "skin_tone_match": <boolean>,
  "age_match": <boolean>,
  "body_type_match": <boolean>,
  "overall_recognizable": <boolean>,
  "explanation": "<2-3 sentence summary of comparison>",
  "issues": ["<list any specific issues found>"],
  "suggestions": ["<list improvement suggestions for regeneration>"]
}`
  })

  try {
    const response = await callGeminiAPI(apiKey, MODELS.likeness_validator, {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.2, // Low temperature for consistent evaluation
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    }, requestId)

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

    try {
      const validation = JSON.parse(text)
      console.log(`[${requestId}] Likeness validation complete:`, JSON.stringify({
        score: validation.likeness_score,
        recognizable: validation.overall_recognizable
      }))

      return successResponse({
        validation,
        model_used: MODELS.likeness_validator
      }, requestId)
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse validation response:`, text.substring(0, 200))
      return successResponse({
        validation: null,
        raw_response: text.substring(0, 500),
        error: 'Failed to parse validation response'
      }, requestId)
    }
  } catch (error: any) {
    console.error(`[${requestId}] Likeness validation error:`, error.message)
    return errorResponse(`Validation failed: ${error.message}`, 400, requestId)
  }
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
