import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

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
 */
serve(async (req) => {
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

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid or expired authentication token')
    }

    // Check user credits/subscription (optional rate limiting)
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits, subscription_tier')
      .eq('id', user.id)
      .single()

    const body = await req.json()
    const { action, ...params } = body

    // Route to appropriate handler
    switch (action) {
      case 'chat':
        return await handleChat(GEMINI_API_KEY, params)
      case 'summarize':
        return await handleSummarize(GEMINI_API_KEY, params)
      case 'generate_image':
        return await handleImageGeneration(GEMINI_API_KEY, params, profile)
      case 'financial_projection':
        return await handleFinancialProjection(GEMINI_API_KEY, params)
      case 'parse_financial':
        return await handleParseFinancial(GEMINI_API_KEY, params)
      case 'action_plan':
        return await handleActionPlan(GEMINI_API_KEY, params)
      case 'raw':
        return await handleRawRequest(GEMINI_API_KEY, params)
      default:
        throw new Error(`Unknown action: ${action}. Valid: chat, summarize, generate_image, financial_projection, parse_financial, action_plan, raw`)
    }

  } catch (error: any) {
    console.error('Gemini proxy error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Vision Coach Chat
 */
async function handleChat(apiKey: string, params: any) {
  const { history = [], message } = params

  const systemInstruction = `You are a high-end retirement vision coach named "Visionary".
Your goal is to help couples (like Milton and Lisa) articulate their dream retirement.
Be inspiring, professional, and concise. Ask probing questions about their lifestyle, location (e.g., Thailand), and legacy.`

  const prompt = `
History: ${history.map((h: any) => `${h.role}: ${h.text}`).join('\n')}
User: ${message}
  `

  const response = await callGeminiAPI(apiKey, 'gemini-2.0-flash', {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ||
    "I'm having trouble envisioning that right now. Please try again."

  return new Response(
    JSON.stringify({ success: true, text }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Summarize chat into image prompt
 */
async function handleSummarize(apiKey: string, params: any) {
  const { history = [] } = params

  const prompt = `
Based on the conversation below, create a concise, highly visual image generation prompt that captures the user's dream retirement.
Include details about location, atmosphere, people, and lighting.
Do not include "I want" or "The user wants". Just describe the scene.

Conversation:
${history.map((h: any) => `${h.role}: ${h.text}`).join('\n')}
  `

  const response = await callGeminiAPI(apiKey, 'gemini-2.0-flash', {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 512
    }
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return new Response(
    JSON.stringify({ success: true, summary: text }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Generate/Edit Vision Board Image
 */
async function handleImageGeneration(apiKey: string, params: any, profile: any) {
  const { images = [], prompt, embeddedText, titleText } = params

  // Build parts array
  const parts: any[] = []

  // Add images
  for (const img of images) {
    if (!img) continue

    let base64Data = img
    let mimeType = 'image/jpeg'

    // Handle data URL format
    if (base64Data.includes('base64,')) {
      const mimeMatch = base64Data.match(/^data:(.*?);/)
      if (mimeMatch) {
        mimeType = mimeMatch[1]
      }
      base64Data = base64Data.split(',')[1]
    }

    parts.push({
      inlineData: {
        mimeType,
        data: base64Data
      }
    })
  }

  // Build prompt
  let finalPrompt = ''
  if (parts.length > 1) {
    finalPrompt = 'The FIRST image provided is the BASE scene to be edited. The SUBSEQUENT images are VISUAL REFERENCES. Apply the visual characteristics of the reference images to the base scene. '
  }
  finalPrompt += `Edit the base image to match this description: ${prompt}. Maintain photorealism.`

  if (titleText) {
    finalPrompt += ` HEADER: Render the title "${titleText}" prominently at the top of the image using an elegant, readable font.`
  }

  if (embeddedText) {
    finalPrompt += ` INTEGRATE TEXT: Render the text "${embeddedText}" naturally into the scene (e.g. on a sign, neon light, or object).`
  }

  parts.push({ text: finalPrompt })

  // Try Gemini 2.0 Flash for image generation
  try {
    const response = await callGeminiAPI(apiKey, 'gemini-2.0-flash-exp', {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['image', 'text'],
        imageDimension: '1024x1024'
      }
    })

    const imageData = extractImageFromResponse(response)
    if (imageData) {
      return new Response(
        JSON.stringify({ success: true, image: imageData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error: any) {
    console.warn('Primary model failed, trying fallback:', error.message)
  }

  // Fallback to imagen model
  try {
    const response = await callGeminiAPI(apiKey, 'imagen-3.0-generate-002', {
      contents: [{ parts: [{ text: finalPrompt }] }],
      generationConfig: {
        imageCount: 1
      }
    })

    const imageData = extractImageFromResponse(response)
    if (imageData) {
      return new Response(
        JSON.stringify({ success: true, image: imageData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (fallbackError: any) {
    console.error('Image generation failed:', fallbackError.message)
    throw new Error('Image generation failed. Please try again.')
  }

  throw new Error('No image generated')
}

/**
 * Generate Financial Projection
 */
async function handleFinancialProjection(apiKey: string, params: any) {
  const { description } = params

  const prompt = `Generate a JSON array of 5 objects representing financial growth over 5 years based on this scenario: "${description}".
Each object must have: "year" (number), "savings" (number), "projected" (number), "goal" (number).
Return ONLY valid JSON.`

  const response = await callGeminiAPI(apiKey, 'gemini-2.0-flash', {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 512,
      responseMimeType: 'application/json'
    }
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

  try {
    const projection = JSON.parse(text)
    return new Response(
      JSON.stringify({ success: true, projection }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    // Return fallback data
    return new Response(
      JSON.stringify({
        success: true,
        projection: [
          { year: 2024, savings: 500000, projected: 500000, goal: 500000 },
          { year: 2025, savings: 600000, projected: 650000, goal: 700000 },
          { year: 2026, savings: 750000, projected: 800000, goal: 950000 },
          { year: 2027, savings: 900000, projected: 1000000, goal: 1200000 },
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Parse Financial Data from Chat
 */
async function handleParseFinancial(apiKey: string, params: any) {
  const { history } = params

  const prompt = `Extract financial data from this conversation history into JSON:
History: ${history}
Required fields: currentSavings (number), monthlyContribution (number), targetGoal (number), targetYear (number), dreamDescription (string).
If a field is missing, estimate a reasonable default for a high-net-worth individual.`

  const response = await callGeminiAPI(apiKey, 'gemini-2.0-flash', {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 512,
      responseMimeType: 'application/json'
    }
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  try {
    const financialData = JSON.parse(text)
    return new Response(
      JSON.stringify({ success: true, data: financialData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          currentSavings: 100000,
          monthlyContribution: 5000,
          targetGoal: 1000000,
          targetYear: 2030,
          dreamDescription: 'Retire comfortably'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Generate Action Plan with Search Grounding
 */
async function handleActionPlan(apiKey: string, params: any) {
  const { visionContext, financialContext } = params

  const prompt = `
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

Return ONLY a valid JSON array of Milestone objects. Do not wrap in markdown code blocks.
Schema:
[{
  "year": number,
  "title": string,
  "marketResearchSnippet": string,
  "tasks": [{ "id": string, "title": string, "description": string, "dueDate": string, "type": string, "isCompleted": false, "aiMetadata": { "suggestedTool": "GMAIL" | "MAPS" | "CALENDAR" } }]
}]
  `

  const response = await callGeminiAPI(apiKey, 'gemini-2.0-flash', {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 4096
    }
  })

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

    return new Response(
      JSON.stringify({ success: true, plan }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('Action plan parse error:', e)
    return new Response(
      JSON.stringify({ success: true, plan: [], rawText: text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Raw API Request (for flexibility)
 */
async function handleRawRequest(apiKey: string, params: any) {
  const { model = 'gemini-2.0-flash', contents, config = {} } = params

  const response = await callGeminiAPI(apiKey, model, {
    contents,
    ...config
  })

  return new Response(
    JSON.stringify({ success: true, response }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function callGeminiAPI(apiKey: string, model: string, requestBody: any): Promise<any> {
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Gemini API error (${model}):`, errorText)
    throw new Error(`Gemini API error: ${response.status}`)
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
