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
    // PRIORITY 1: Nano Banana Pro - BEST for likeness preservation (character consistency)
    // Uses Gemini 2.5 Pro with native image generation
    image_nano_banana_pro: env.get?.('GOOGLE_IMAGE_MODEL_PRO') || 'gemini-2.5-pro-preview-06-05',

    // PRIORITY 2: Nano Banana Flash - Good balance of speed and likeness
    // Uses Gemini 2.5 Flash with native image generation
    image_nano_banana_flash: 'gemini-2.5-flash-preview-05-20',

    // PRIORITY 3: Gemini 2.0 Flash Exp - Reliable fallback
    // Documentation: https://ai.google.dev/gemini-api/docs/image-generation
    image_primary: env.get?.('GOOGLE_IMAGE_MODEL_PRIMARY') || 'gemini-2.0-flash-exp',

    // PRIORITY 4: Gemini 2.0 Flash (stable version) - If exp fails
    // More stable but may have slightly different behavior
    image_fallback_1: env.get?.('GOOGLE_IMAGE_MODEL_FALLBACK') || 'gemini-2.0-flash',

    // PRIORITY 5: Gemini 1.5 Pro - Multimodal support as last Gemini fallback
    // Older but widely available, uses responseModalities
    image_fallback_2: 'gemini-1.5-pro',

    // LAST RESORT: Imagen 3 (different API endpoint)
    // WARNING: Likeness will NOT be preserved - no reference image support
    image_imagen: 'imagen-3.0-generate-002',
  }
}

const MODELS = {
  // Chat: Use Gemini 2.0 Flash for conversational AI
  chat: 'gemini-2.0-flash-exp',

  // Reasoning: Use Gemini 1.5 Pro for complex planning and projections
  reasoning: 'gemini-1.5-pro',

  // Likeness Validation: Use multimodal model to compare faces
  likeness_validator: 'gemini-2.0-flash-exp',
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

  // Test each model - prioritize Nano Banana Pro for best likeness
  const modelsToTest = [
    { name: MODELS.chat, type: 'chat' },
    { name: modelConfig.image_nano_banana_pro, type: 'gemini_image', label: 'Nano Banana Pro (Priority 1 - Best Likeness)' },
    { name: modelConfig.image_nano_banana_flash, type: 'gemini_image', label: 'Nano Banana Flash (Priority 2)' },
    { name: modelConfig.image_primary, type: 'gemini_image', label: 'Gemini 2.0 Flash Exp (Priority 3)' },
    { name: modelConfig.image_fallback_1, type: 'gemini_image', label: 'Gemini 2.0 Flash (Priority 4)' },
    { name: modelConfig.image_fallback_2, type: 'gemini_image', label: 'Gemini 1.5 Pro (Priority 5)' },
    { name: modelConfig.image_imagen, type: 'imagen', label: 'Imagen 3 (Last Resort - No Likeness)' },
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
  const {
    images = [],
    prompt,
    embeddedText,
    titleText,
    style,
    aspectRatio,
    identityPrompt,
    referenceImageTags = [],
    // NEW: Identity Anchor & Complexity Router parameters
    identityAnchorImage,
    requestType = 'AUTO' // 'EDIT' | 'GENERATE' | 'AUTO'
  } = params

  // Enhanced logging for likeness pipeline debugging (no PII logged)
  const baseImagePresent = images.length > 0
  const referenceImageCount = images.length > 1 ? images.length - 1 : 0 // First image is base
  const hasIdentity = !!identityPrompt
  const identityLength = identityPrompt ? identityPrompt.length : 0
  const isPremium = profile?.subscription_tier === 'PRO' || profile?.subscription_tier === 'ELITE'
  const hasIdentityAnchor = !!identityAnchorImage

  console.log(`[${requestId}] Image generation requested:`, JSON.stringify({
    baseImage: baseImagePresent,
    referenceImages: referenceImageCount,
    style: style || 'default',
    tier: profile?.subscription_tier || 'unknown',
    hasIdentityPrompt: hasIdentity,
    identityPromptLength: identityLength,
    hasTitle: !!titleText,
    hasEmbeddedText: !!embeddedText,
    referenceTagCount: referenceImageTags.length,
    tags: referenceImageTags, // Log actual tags to debug
    // NEW: Identity Anchor & Complexity Router logging
    hasIdentityAnchor,
    requestType
  }))

  // DIAGNOSTIC: Warn if tags don't match reference count (indicates frontend bug)
  if (referenceImageTags.length > 0 && referenceImageTags.length !== referenceImageCount) {
    console.warn(`[${requestId}] ⚠️ TAG MISMATCH: ${referenceImageTags.length} tags for ${referenceImageCount} reference images! This causes prompt issues.`)
  }

  // ============================================
  // IDENTITY ANCHOR HANDLING
  // ============================================
  // If identityAnchorImage is provided, it becomes the PRIMARY reference
  // This prevents the "melting face" degradation loop when refining AI-generated images
  let finalImages = [...images]
  let finalTags = [...referenceImageTags]

  if (identityAnchorImage) {
    // Prepend the identity anchor as the FIRST image
    // This ensures the original selfie is always the primary reference
    finalImages = [identityAnchorImage, ...images]
    finalTags = ['primary_identity_anchor', ...referenceImageTags]
    console.log(`[${requestId}] Identity Anchor applied - original selfie prepended as primary reference`)
  }

  // Common request params
  const requestParams: LikenessRequestParams = {
    baseImage: finalImages[0] || null,
    referenceImages: finalImages.slice(1),
    referenceImageTags: finalTags,
    identityPrompt,
    sceneDescription: prompt || 'Create a beautiful, inspiring vision board image.',
    titleText,
    embeddedText,
    style,
    aspectRatio,
    isPremium
  }

  // ============================================
  // COMPLEXITY ROUTER - EDIT vs GENERATE
  // ============================================
  let resolvedRequestType = requestType

  if (requestType === 'AUTO' && prompt) {
    console.log(`[${requestId}] Running Complexity Router to classify prompt intent...`)
    resolvedRequestType = await classifyGenerationIntent(apiKey, prompt, requestId)
  }

  // Build requests based on resolved type
  let primaryRequest: { contents: any[]; generationConfig: any }
  let strategyLabel: string

  if (resolvedRequestType === 'EDIT') {
    // EDIT MODE: Use specialized face-preserving request
    const detectedChanges = extractEditChanges(prompt || '')
    primaryRequest = buildEditModeRequest(requestParams, detectedChanges, requestId)
    strategyLabel = 'edit_mode'
    console.log(`[${requestId}] Using EDIT MODE - detected changes: ${detectedChanges}`)
  } else {
    // GENERATE MODE: Use existing multi-strategy approach
    primaryRequest = buildLikenessPreservingRequest(requestParams, requestId)
    strategyLabel = 'natural_3turn'
  }

  // Build ALL request strategies for GENERATE mode fallbacks
  // Strategy A: Natural 3-turn conversation (improved - avoids safety filters)
  const complexRequest = resolvedRequestType === 'EDIT'
    ? primaryRequest
    : buildLikenessPreservingRequest(requestParams, requestId)

  // Strategy B: Simple single-turn (more compatible - fallback for when complex fails)
  const simpleRequest = buildSimpleLikenessRequest(requestParams, requestId)

  // Strategy C: Ultra-simple (last resort before giving up on Gemini)
  const ultraSimpleRequest = buildUltraSimpleLikenessRequest(requestParams, requestId)

  console.log(`[${requestId}] Built generation requests: mode=${resolvedRequestType}, primary=${strategyLabel}, fallbacks ready`)

  // Get model configuration
  const modelConfig = getModelConfig()
  const errors: Record<string, string> = {}

  // Define model sequence to try - prioritize Nano Banana Pro for best likeness
  // Model priority:
  // 1. Nano Banana Pro (Gemini 2.5 Pro) - BEST likeness preservation
  // 2. Nano Banana Flash (Gemini 2.5 Flash) - Good balance of speed/likeness
  // 3. Gemini 2.0 Flash Exp - Reliable fallback
  // 4. Gemini 2.0 Flash - Stable fallback
  // 5. Gemini 1.5 Pro - Last Gemini option
  const modelSequence = [
    { id: modelConfig.image_nano_banana_pro, name: 'Nano Banana Pro (Gemini 2.5 Pro)' },
    { id: modelConfig.image_nano_banana_flash, name: 'Nano Banana Flash (Gemini 2.5 Flash)' },
    { id: modelConfig.image_primary, name: 'Primary (Gemini 2.0 Flash Exp)' },
    { id: modelConfig.image_fallback_1, name: 'Fallback 1 (Gemini 2.0 Flash)' },
    { id: modelConfig.image_fallback_2, name: 'Fallback 2 (Gemini 1.5 Pro)' },
  ]

  // Collect all reference images for likeness validation
  // IMPORTANT: Use finalImages to include the identity anchor if present
  const allReferenceImages: string[] = [...finalImages]

  // Helper function to validate likeness and retry if needed
  const validateAndRetryIfNeeded = async (
    image: string,
    modelId: string,
    strategyName: string
  ): Promise<{ image: string; likenessScore?: number; wasRetried: boolean }> => {
    // Skip validation if no reference images
    if (allReferenceImages.length === 0) {
      return { image, wasRetried: false }
    }

    // Quick likeness check
    const validation = await quickLikenessCheck(apiKey, allReferenceImages, image, requestId)
    console.log(`[${requestId}] Likeness validation: score=${validation.score}, shouldRetry=${validation.shouldRetry}`)

    if (!validation.shouldRetry) {
      return { image, likenessScore: validation.score, wasRetried: false }
    }

    // Likeness is low - retry with maximum likeness prompt
    console.log(`[${requestId}] ⚠️ Low likeness score (${validation.score}). Retrying with MAX LIKENESS prompt...`)
    const retryRequest = buildMaxLikenessRetryRequest(requestParams, requestId)
    const retryResult = await tryGeminiImageGenerationV2(apiKey, retryRequest, modelId, requestId)

    if (retryResult.success && retryResult.image) {
      // Validate the retry result too
      const retryValidation = await quickLikenessCheck(apiKey, allReferenceImages, retryResult.image, requestId)
      console.log(`[${requestId}] Retry likeness score: ${retryValidation.score} (original: ${validation.score})`)

      // Use retry image if it's better, otherwise keep original
      if (retryValidation.score > validation.score) {
        console.log(`[${requestId}] ✅ Retry improved likeness! Using retry image.`)
        return { image: retryResult.image, likenessScore: retryValidation.score, wasRetried: true }
      } else {
        console.log(`[${requestId}] ⚠️ Retry didn't improve likeness. Keeping original.`)
        return { image, likenessScore: validation.score, wasRetried: true }
      }
    }

    console.log(`[${requestId}] ⚠️ Retry generation failed. Keeping original image.`)
    return { image, likenessScore: validation.score, wasRetried: true }
  }

  // Try each model with ALL THREE strategies before moving to next model
  for (const model of modelSequence) {
    console.log(`[${requestId}] Trying ${model.name} (${model.id})...`)

    // Strategy A: Try natural multi-turn prompt first
    let result = await tryGeminiImageGenerationV2(apiKey, complexRequest, model.id, requestId)

    if (result.success && result.image) {
      const imageSize = result.image?.length || 0
      console.log(`[${requestId}] ✅ SUCCESS: model=${model.id}, strategy=${strategyLabel}, mode=${resolvedRequestType}, refs=${referenceImageCount}, hasIdentity=${hasIdentity}, hasAnchor=${hasIdentityAnchor}, imageSize=${imageSize}`)
      console.log(`[${requestId}] 📊 IMAGE DIAGNOSTIC: starts=${result.image?.substring(0, 30)}, ends=${result.image?.substring(Math.max(0, imageSize - 30))}`)

      // Validate likeness and retry if score is low
      const validated = await validateAndRetryIfNeeded(result.image, model.id, strategyLabel)

      return successResponse({
        image: validated.image,
        model_used: model.id,
        strategy_used: validated.wasRetried ? `${strategyLabel}+max_likeness_retry` : strategyLabel,
        request_mode: resolvedRequestType, // NEW: Include EDIT/GENERATE mode
        identity_anchor_used: hasIdentityAnchor, // NEW: Confirm anchor was applied
        likeness_optimized: true,
        likeness_score: validated.likenessScore,
        was_retried: validated.wasRetried
      }, requestId)
    }

    const complexError = result.error || 'Unknown error'
    console.warn(`[${requestId}] ${model.name} natural prompt failed: ${complexError}`)

    // Strategy B: If natural fails, try SIMPLE single-turn on SAME model
    console.log(`[${requestId}] ${model.name} - retrying with SIMPLE single-turn prompt...`)
    result = await tryGeminiImageGenerationV2(apiKey, simpleRequest, model.id, requestId)

    if (result.success && result.image) {
      const imageSize = result.image?.length || 0
      console.log(`[${requestId}] ✅ SUCCESS: model=${model.id}, strategy=simple_single_turn, mode=${resolvedRequestType}, refs=${referenceImageCount}, hasIdentity=${hasIdentity}, hasAnchor=${hasIdentityAnchor}, imageSize=${imageSize}`)
      console.log(`[${requestId}] 📊 IMAGE DIAGNOSTIC: starts=${result.image?.substring(0, 30)}, ends=${result.image?.substring(Math.max(0, imageSize - 30))}`)

      // Validate likeness and retry if score is low
      const validated = await validateAndRetryIfNeeded(result.image, model.id, 'simple_single_turn')

      return successResponse({
        image: validated.image,
        model_used: model.id,
        strategy_used: validated.wasRetried ? 'simple_single_turn+max_likeness_retry' : 'simple_single_turn',
        request_mode: resolvedRequestType,
        identity_anchor_used: hasIdentityAnchor,
        likeness_optimized: true,
        likeness_score: validated.likenessScore,
        was_retried: validated.wasRetried
      }, requestId)
    }

    const simpleError = result.error || 'Unknown error'
    console.warn(`[${requestId}] ${model.name} simple prompt failed: ${simpleError}`)

    // Strategy C: Last try - ULTRA-SIMPLE prompt
    console.log(`[${requestId}] ${model.name} - final attempt with ULTRA-SIMPLE prompt...`)
    result = await tryGeminiImageGenerationV2(apiKey, ultraSimpleRequest, model.id, requestId)

    if (result.success && result.image) {
      const imageSize = result.image?.length || 0
      console.log(`[${requestId}] ✅ SUCCESS: model=${model.id}, strategy=ultra_simple, mode=${resolvedRequestType}, refs=${referenceImageCount}, hasIdentity=${hasIdentity}, hasAnchor=${hasIdentityAnchor}, imageSize=${imageSize}`)
      console.log(`[${requestId}] 📊 IMAGE DIAGNOSTIC: starts=${result.image?.substring(0, 30)}, ends=${result.image?.substring(Math.max(0, imageSize - 30))}`)

      // Validate likeness and retry if score is low
      const validated = await validateAndRetryIfNeeded(result.image, model.id, 'ultra_simple')

      return successResponse({
        image: validated.image,
        model_used: model.id,
        strategy_used: validated.wasRetried ? 'ultra_simple+max_likeness_retry' : 'ultra_simple',
        request_mode: resolvedRequestType,
        identity_anchor_used: hasIdentityAnchor,
        likeness_optimized: true,
        likeness_score: validated.likenessScore,
        was_retried: validated.wasRetried
      }, requestId)
    }

    // All three strategies failed for this model - record error and move to next
    const ultraSimpleError = result.error || 'Unknown error'
    errors[model.id] = `natural: ${complexError} | simple: ${simpleError} | ultra: ${ultraSimpleError}`
    console.warn(`[${requestId}] ${model.name} failed all strategies: ${errors[model.id]}`)
  }

  // CRITICAL: If user has reference images, DO NOT fall back to Imagen
  // Imagen doesn't support reference images - it would produce random people!
  const hasReferenceImages = referenceImageCount > 0 || baseImagePresent

  if (hasReferenceImages) {
    console.error(`[${requestId}] ❌ All Gemini models failed with ${referenceImageCount} reference images. NOT falling back to Imagen to preserve user intent.`)

    // Return helpful error instead of wrong result
    return errorResponse(
      'Unable to generate image with your reference photos. All likeness-preserving models are currently unavailable. Please try again in a few moments, or try simplifying your scene description. Your reference photos require Gemini models which support likeness preservation.',
      503, // Service Unavailable
      requestId
    )
  }

  // Only use Imagen for text-only prompts (no reference images = no likeness needed)
  console.log(`[${requestId}] No reference images provided - using Imagen 3 for text-only generation`)

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
    console.log(`[${requestId}] Imagen 3 succeeded (${modelConfig.image_imagen}) - text-only mode`)
    return successResponse({
      image: imagenResult.image,
      model_used: modelConfig.image_imagen,
      strategy_used: 'imagen_text_only',
      likeness_optimized: false
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
  // TURN 1: Identity Introduction (User)
  // REWRITTEN: Natural conversational language instead of robotic commands
  // Per Google's recommendation: "Describe the scene, don't just list keywords"
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

  // Build NATURAL LANGUAGE identity description (avoids safety filter triggers)
  const peopleNames = referenceImageTags.length > 0
    ? referenceImageTags.join(' and ')
    : 'these people'

  const totalImageCount = (baseImage ? 1 : 0) + referenceImages.length

  let identityText = `I'm sharing ${totalImageCount} photo(s) of ${peopleNames} so you can see exactly what they look like.`

  if (baseImage) {
    identityText += ` The first photo is the primary reference - this is who needs to appear in the final image.`
  }

  // Add specific feature descriptions (research shows 5-7 features = 41% better retention)
  if (referenceImageTags.length > 0 && identityDescriptions.length > 0) {
    identityText += `\n\nHere are the key features to remember for each person:\n`
    referenceImageTags.forEach((tag, index) => {
      const desc = identityDescriptions[index]
      if (desc) {
        identityText += `- ${tag}: ${desc}\n`
      }
    })
  }

  identityText += `\nPlease study these photos carefully. I'll need you to generate an image of ${peopleNames} in a moment, and it's really important that they look exactly like themselves - same face, same skin tone, same build.`

  turn1Parts.push({ text: identityText })

  contents.push({
    role: 'user',
    parts: turn1Parts
  })

  // ============================================
  // TURN 2: Scene Generation Request (User)
  // NOTE: Removed fake model turn - API doesn't support simulated responses
  // ============================================
  let sceneRequest = `Now please create an image showing ${peopleNames} ${sceneDescription}.

Make sure they look exactly like the reference photos - same faces, same skin tones, same body types. This is the most important thing.`

  // Text overlay with SPECIFIC placement to avoid duplication
  // Only render short text - long text gets garbled by image generation
  const safeTitle = titleText && titleText.length <= 60 ? titleText : null
  const safeGoal = embeddedText && embeddedText.length <= 40 ? embeddedText : null

  if (safeTitle || safeGoal) {
    sceneRequest += '\n\nText overlay requirements (render each text ONCE only):'
    if (safeTitle) {
      sceneRequest += `\n- At the TOP CENTER of the image, add "${safeTitle}" in large, elegant lettering.`
    }
    if (safeGoal) {
      sceneRequest += `\n- At the BOTTOM CENTER of the image, add "${safeGoal}" in smaller decorative text.`
    }
  }

  // Log if text was too long and skipped
  if (titleText && !safeTitle) {
    console.log(`[${requestId}] Title too long (${titleText.length} chars) - skipping image text render to prevent garbling`)
  }
  if (embeddedText && !safeGoal) {
    console.log(`[${requestId}] Goal text too long (${embeddedText.length} chars) - skipping image text render to prevent garbling`)
  }

  if (style && style !== 'photorealistic') {
    const styleDescriptions: Record<string, string> = {
      'cinematic': 'Use cinematic lighting and film-like colors',
      'oil_painting': 'Give it an oil painting look',
      'watercolor': 'Use a soft watercolor style',
      'cyberpunk': 'Make it cyberpunk with neon aesthetics',
      '3d_render': 'Render it in 3D style'
    }
    sceneRequest += `\n\nFor the style: ${styleDescriptions[style] || style}. But keep the people looking like themselves.`
  }

  if (isPremium) {
    sceneRequest += `\n\nMake it high quality with professional lighting and lots of detail.`
  }

  // Anti-duplication and face preservation instructions
  sceneRequest += `\n\nIMPORTANT QUALITY REQUIREMENTS:
- Generate a single cohesive image (no mirror effects, no duplicates, no tiled layouts)
- FACE QUALITY: Keep facial features natural and proportional - do NOT warp, stretch, or distort the face
- Preserve the exact eye shape, nose shape, and mouth from the reference photos
- Maintain natural facial proportions - no elongation, no compression
- The face should look like a real photograph, not AI-generated`

  contents.push({
    role: 'user',
    parts: [{ text: sceneRequest }]
  })

  // Build generation config - need both TEXT and IMAGE for Gemini to work properly
  const generationConfig: any = {
    maxOutputTokens: 8192,
    responseModalities: ['TEXT', 'IMAGE'] // Both required - IMAGE-only causes model failures
  }

  // Add imageConfig for aspect ratio and resolution
  if (aspectRatio || isPremium) {
    generationConfig.imageConfig = {}

    if (aspectRatio) {
      generationConfig.imageConfig.aspectRatio = aspectRatio
    }

    if (isPremium) {
      generationConfig.imageConfig.imageSize = '2K' // Higher resolution for premium users
    }
  }

  console.log(`[${requestId}] Built 2-turn conversation with ${totalImageCount} reference images (fake model turn removed)`)

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

  // Text overlay with SPECIFIC placement to avoid duplication
  // Only render short text - long text gets garbled by image generation
  const safeTitle = titleText && titleText.length <= 60 ? titleText : null
  const safeGoal = embeddedText && embeddedText.length <= 40 ? embeddedText : null

  if (safeTitle || safeGoal) {
    prompt += '\n\nText overlay (render each text ONCE only):'
    if (safeTitle) {
      prompt += `\n- At the TOP of the image: "${safeTitle}" in large, elegant lettering.`
    }
    if (safeGoal) {
      prompt += `\n- At the BOTTOM of the image: "${safeGoal}" in smaller decorative text.`
    }
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

  // Anti-duplication and face preservation instructions
  prompt += `\n\nIMPORTANT QUALITY REQUIREMENTS:
- Single cohesive image (no mirrors, no duplicates, no tiled layouts)
- FACE QUALITY: Keep facial features natural and proportional - do NOT warp, stretch, or distort the face
- Preserve exact eye shape, nose shape, and mouth from the reference
- Maintain natural facial proportions - the face should look like a real photograph`

  parts.push({ text: prompt })

  // Build generation config - need both TEXT and IMAGE for Gemini to work properly
  const generationConfig: any = {
    maxOutputTokens: 8192,
    responseModalities: ['TEXT', 'IMAGE'] // Both required - IMAGE-only causes model failures
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
 * Ultra-Simple Request Builder - Last resort before giving up on Gemini
 *
 * This is the most minimal prompt possible:
 * - All images in one message
 * - Super short, direct instruction
 * - No fancy formatting or requirements
 *
 * Use this when both complex and simple strategies fail.
 */
function buildUltraSimpleLikenessRequest(params: LikenessRequestParams, requestId: string): {
  contents: any[]
  generationConfig: any
} {
  const {
    baseImage,
    referenceImages,
    referenceImageTags,
    sceneDescription,
    titleText,
    aspectRatio,
    isPremium
  } = params

  const parts: any[] = []

  // Add all images
  if (baseImage) {
    const data = extractBase64Data(baseImage)
    parts.push({ inlineData: { mimeType: data.mimeType, data: data.base64 } })
  }

  referenceImages.forEach((img: string) => {
    const data = extractBase64Data(img)
    parts.push({ inlineData: { mimeType: data.mimeType, data: data.base64 } })
  })

  const totalImages = (baseImage ? 1 : 0) + referenceImages.length
  const names = referenceImageTags.length > 0 ? referenceImageTags.join(' and ') : 'these people'

  // Ultra-minimal prompt - essentials with anti-duplication and face preservation
  let prompt = `Using these ${totalImages} photos, create an image of ${names} ${sceneDescription}. Keep their faces exactly the same as in the photos - natural proportions, no distortion or warping of facial features.`

  // Only add short title text
  const safeTitle = titleText && titleText.length <= 60 ? titleText : null
  if (safeTitle) {
    prompt += ` Add "${safeTitle}" at the top of the image.`
  }

  // Critical: prevent duplication and face distortion
  prompt += ` Create ONE single image, no mirroring or duplication. The face should look like a real photograph.`

  parts.push({ text: prompt })

  const generationConfig: any = {
    maxOutputTokens: 8192,
    responseModalities: ['TEXT', 'IMAGE'] // Both required - IMAGE-only causes model failures
  }

  if (aspectRatio || isPremium) {
    generationConfig.imageConfig = {}
    if (aspectRatio) generationConfig.imageConfig.aspectRatio = aspectRatio
    if (isPremium) generationConfig.imageConfig.imageSize = '2K'
  }

  console.log(`[${requestId}] Built ULTRA-SIMPLE request with ${totalImages} images`)

  return {
    contents: [{ role: 'user', parts }],
    generationConfig
  }
}

/**
 * Quick Likeness Score Check
 *
 * Performs a fast validation to check if the generated image matches reference photos.
 * Returns a score from 0-1, where:
 * - 1.0 = Perfect match
 * - 0.7+ = Good likeness
 * - 0.5-0.7 = Moderate likeness (may need retry)
 * - <0.5 = Poor likeness (should retry)
 *
 * This is a lightweight check that runs in the background after initial generation.
 */
async function quickLikenessCheck(
  apiKey: string,
  referenceImages: string[],
  generatedImage: string,
  requestId: string
): Promise<{ score: number; shouldRetry: boolean; reason?: string }> {
  // If no reference images, skip validation
  if (!referenceImages || referenceImages.length === 0) {
    return { score: 1.0, shouldRetry: false }
  }

  try {
    const parts: any[] = []

    // Add first reference image only (for speed)
    const refData = extractBase64Data(referenceImages[0])
    parts.push({
      inlineData: { mimeType: refData.mimeType, data: refData.base64 }
    })
    parts.push({ text: 'Reference photo of the person to match:' })

    // Add generated image
    const genData = extractBase64Data(generatedImage)
    parts.push({
      inlineData: { mimeType: genData.mimeType, data: genData.base64 }
    })
    parts.push({ text: 'Generated image:' })

    // Quick evaluation prompt
    parts.push({
      text: `Rate the facial similarity between the person in the Reference photo and the Generated image.
Score from 0.0 to 1.0 where:
- 1.0 = Same person, perfect match
- 0.7 = Recognizable as same person
- 0.5 = Somewhat similar
- 0.3 = Different person but similar features
- 0.0 = Completely different person

Respond with ONLY a JSON object: {"score": <number>, "reason": "<brief reason>"}`
    })

    const response = await callGeminiAPI(apiKey, MODELS.likeness_validator, {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 150,
        responseMimeType: 'application/json'
      }
    }, requestId)

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const result = JSON.parse(text)
    const score = typeof result.score === 'number' ? result.score : 0.5

    console.log(`[${requestId}] Quick likeness check: score=${score}, reason=${result.reason || 'N/A'}`)

    return {
      score,
      shouldRetry: score < 0.6, // Retry if below 0.6
      reason: result.reason
    }
  } catch (error: any) {
    console.warn(`[${requestId}] Quick likeness check failed: ${error.message}. Skipping retry.`)
    return { score: 0.7, shouldRetry: false, reason: 'Validation error - using original' }
  }
}

/**
 * Build Maximum Likeness Retry Request
 *
 * When initial generation has low likeness score, this builds an aggressive
 * retry prompt with MAXIMUM emphasis on face preservation.
 */
function buildMaxLikenessRetryRequest(params: LikenessRequestParams, requestId: string): {
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
    aspectRatio,
    isPremium
  } = params

  const parts: any[] = []

  // Add base image first
  if (baseImage) {
    const data = extractBase64Data(baseImage)
    parts.push({ inlineData: { mimeType: data.mimeType, data: data.base64 } })
  }

  // Add reference images
  referenceImages.forEach((img: string) => {
    const data = extractBase64Data(img)
    parts.push({ inlineData: { mimeType: data.mimeType, data: data.base64 } })
  })

  const totalImages = (baseImage ? 1 : 0) + referenceImages.length
  const names = referenceImageTags.length > 0 ? referenceImageTags.join(' and ') : 'this person'

  // MAXIMUM LIKENESS prompt - very aggressive face preservation
  let prompt = `*** CRITICAL FACE MATCHING REQUIRED ***

These ${totalImages} photos show ${names}. Generate an image of EXACTLY this person in this scene: ${sceneDescription}

MANDATORY REQUIREMENTS (FAILURE IS NOT AN OPTION):
1. The FACE must be an EXACT COPY of the reference photos
   - Same exact eye shape, eye color, eye spacing
   - Same exact nose shape and size
   - Same exact mouth shape and lip fullness
   - Same exact face shape (round, oval, square, etc.)
   - Same exact jawline and chin

2. The SKIN must match EXACTLY
   - Same skin tone (do NOT lighten or darken)
   - Same complexion and any visible features

3. The BODY TYPE must be IDENTICAL
   - Same build (slim/medium/heavy)
   - Same proportions
   - Do NOT idealize or change the body

4. The AGE must be the SAME
   - Do NOT make them look younger or older`

  // Add identity description if provided
  if (identityPrompt) {
    prompt += `\n\nIdentity description: ${identityPrompt}`
  }

  // Add title if short enough
  const safeTitle = titleText && titleText.length <= 50 ? titleText : null
  if (safeTitle) {
    prompt += `\n\nAdd "${safeTitle}" at the top.`
  }

  prompt += `\n\nGenerate ONE single high-quality image. The person MUST be immediately recognizable as the same person from the reference photos. This is a RETRY because the first attempt did not match well enough.`

  parts.push({ text: prompt })

  const generationConfig: any = {
    maxOutputTokens: 8192,
    responseModalities: ['TEXT', 'IMAGE']
  }

  if (aspectRatio || isPremium) {
    generationConfig.imageConfig = {}
    if (aspectRatio) generationConfig.imageConfig.aspectRatio = aspectRatio
    if (isPremium) generationConfig.imageConfig.imageSize = '2K'
  }

  console.log(`[${requestId}] Built MAXIMUM LIKENESS retry request`)

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
// COMPLEXITY ROUTER - EDIT vs GENERATE Classification
// ============================================

/**
 * Classify Generation Intent
 *
 * Uses a fast Gemini model to determine whether the user's prompt requires:
 * - EDIT: Keep face/body identical, only modify clothing/background/lighting
 * - GENERATE: Full scene regeneration (action, physics, camera angle changes)
 *
 * This prevents unnecessary face regeneration for simple edits like "wearing a Santa suit"
 *
 * @param apiKey - Gemini API key
 * @param prompt - User's scene description
 * @param requestId - Request ID for logging
 * @returns 'EDIT' | 'GENERATE'
 */
async function classifyGenerationIntent(
  apiKey: string,
  prompt: string,
  requestId: string
): Promise<'EDIT' | 'GENERATE'> {
  const classificationPrompt = `You are an AI image generation router. Classify the following user prompt into one of two categories:

**EDIT**: The prompt asks to keep the person/pose the same but change:
- Clothing (e.g., "wearing a suit", "in a Santa costume", "dressed formally")
- Background (e.g., "on a beach", "in the snow", "at a mansion")
- Lighting (e.g., "golden hour", "dramatic shadows", "soft lighting")
- Accessories (e.g., "wearing sunglasses", "holding a trophy", "with a wine glass")
- Minor additions that don't change the person's position

**GENERATE**: The prompt requires changing:
- Physics or action (e.g., "flying", "running", "swimming", "riding a horse")
- Camera angle (e.g., "aerial view", "from below", "close-up")
- Body position or pose (e.g., "sitting", "jumping", "arms raised", "yoga pose")
- Adding multiple new people (e.g., "with their children", "surrounded by friends")
- Complex scene transformations

User Prompt: "${prompt}"

Respond with ONLY one word: EDIT or GENERATE`

  try {
    const response = await callGeminiAPI(apiKey, MODELS.chat, {
      contents: [{ parts: [{ text: classificationPrompt }] }],
      generationConfig: {
        temperature: 0.1, // Very low for consistent classification
        maxOutputTokens: 10
      }
    }, requestId)

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() || ''

    // Parse response - look for EDIT or GENERATE
    if (text.includes('EDIT')) {
      console.log(`[${requestId}] Complexity Router: EDIT mode (prompt implies cosmetic changes)`)
      return 'EDIT'
    } else if (text.includes('GENERATE')) {
      console.log(`[${requestId}] Complexity Router: GENERATE mode (prompt implies scene transformation)`)
      return 'GENERATE'
    }

    // Default to GENERATE if unclear (safer for complex prompts)
    console.log(`[${requestId}] Complexity Router: Unclear classification "${text}", defaulting to GENERATE`)
    return 'GENERATE'

  } catch (error: any) {
    // On classifier failure, default to GENERATE (per user's decision)
    console.warn(`[${requestId}] Complexity Router failed: ${error.message}. Defaulting to GENERATE.`)
    return 'GENERATE'
  }
}

/**
 * Build Edit Mode Request
 *
 * Creates a request optimized for preserving the face while only modifying
 * specified elements (clothing, background, lighting, accessories).
 *
 * Key differences from GENERATE mode:
 * - Explicit instructions to NOT regenerate the face
 * - Lower creativity (temperature 0.3)
 * - Focus on inpainting-style modifications
 * - Stronger identity anchoring language
 */
function buildEditModeRequest(
  params: LikenessRequestParams,
  detectedChanges: string,
  requestId: string
): {
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

  // Add all reference images first
  if (baseImage) {
    const data = extractBase64Data(baseImage)
    parts.push({ inlineData: { mimeType: data.mimeType, data: data.base64 } })
  }

  referenceImages.forEach((img: string) => {
    const data = extractBase64Data(img)
    parts.push({ inlineData: { mimeType: data.mimeType, data: data.base64 } })
  })

  const totalImages = (baseImage ? 1 : 0) + referenceImages.length
  const names = referenceImageTags.length > 0 ? referenceImageTags.join(' and ') : 'the person'

  // EDIT MODE PROMPT - Aggressive face preservation
  let prompt = `*** EDIT MODE - FACE PRESERVATION CRITICAL ***

I'm providing ${totalImages} reference photo(s) of ${names}.

YOUR TASK: Create a modified version where ${sceneDescription}

CRITICAL RULES FOR EDIT MODE:
1. DO NOT REGENERATE THE FACE
   - Copy the face EXACTLY from the reference photo
   - Same exact facial features: eyes, nose, mouth, jawline
   - Same exact skin tone and complexion
   - Same exact age appearance
   - The face should be pixel-perfect identical to the reference

2. DO NOT CHANGE THE BODY TYPE
   - Same build (slim/medium/heavy)
   - Same proportions
   - Same height representation

3. ONLY MODIFY WHAT WAS REQUESTED:
   - ${detectedChanges}
   - Everything else stays identical to the reference

Think of this like a professional photo edit - you're changing the outfit/background, NOT recreating the person.`

  // Add identity description if available
  if (identityPrompt) {
    prompt += `\n\nIdentity details to preserve: ${identityPrompt}`
  }

  // Text overlay (only short text)
  const safeTitle = titleText && titleText.length <= 60 ? titleText : null
  const safeGoal = embeddedText && embeddedText.length <= 40 ? embeddedText : null

  if (safeTitle || safeGoal) {
    prompt += '\n\nText overlay (render each text ONCE only):'
    if (safeTitle) {
      prompt += `\n- At the TOP: "${safeTitle}"`
    }
    if (safeGoal) {
      prompt += `\n- At the BOTTOM: "${safeGoal}"`
    }
  }

  // Style (if not photorealistic)
  if (style && style !== 'photorealistic') {
    const styleDescriptions: Record<string, string> = {
      'cinematic': 'cinematic lighting',
      'oil_painting': 'oil painting style',
      'watercolor': 'watercolor aesthetic',
      'cyberpunk': 'cyberpunk neon aesthetic',
      '3d_render': '3D rendered style'
    }
    prompt += `\n\nApply ${styleDescriptions[style] || style} to the scene, but keep the face photorealistic and unchanged.`
  }

  prompt += `\n\nFINAL CHECK: The person in the output MUST be immediately recognizable as the SAME person from the reference photos. If you regenerate or modify the face, the output is REJECTED.`

  parts.push({ text: prompt })

  // Lower temperature for more consistent face preservation
  const generationConfig: any = {
    maxOutputTokens: 8192,
    temperature: 0.3, // Lower than GENERATE mode for consistency
    responseModalities: ['TEXT', 'IMAGE']
  }

  if (aspectRatio || isPremium) {
    generationConfig.imageConfig = {}
    if (aspectRatio) generationConfig.imageConfig.aspectRatio = aspectRatio
    if (isPremium) generationConfig.imageConfig.imageSize = '2K'
  }

  console.log(`[${requestId}] Built EDIT MODE request with ${totalImages} images, changes: ${detectedChanges}`)

  return {
    contents: [{ role: 'user', parts }],
    generationConfig
  }
}

/**
 * Extract the type of changes from an EDIT prompt
 * Used to tell the model exactly what to modify
 */
function extractEditChanges(prompt: string): string {
  const changes: string[] = []

  const promptLower = prompt.toLowerCase()

  // Clothing detection
  if (promptLower.match(/wear(ing)?|dress(ed)?|suit|costume|outfit|clothes|shirt|pants|jacket|coat/)) {
    changes.push('clothing/outfit')
  }

  // Background detection
  if (promptLower.match(/beach|snow|mansion|office|garden|forest|city|mountain|sunset|sunrise|indoor|outdoor|background/)) {
    changes.push('background/setting')
  }

  // Lighting detection
  if (promptLower.match(/lighting|golden hour|dramatic|soft light|shadows|bright|dark|sunset light|studio/)) {
    changes.push('lighting')
  }

  // Accessories detection
  if (promptLower.match(/glasses|sunglasses|hat|jewelry|watch|holding|trophy|wine|champagne|briefcase/)) {
    changes.push('accessories/props')
  }

  return changes.length > 0 ? changes.join(', ') : 'visual elements as described'
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
