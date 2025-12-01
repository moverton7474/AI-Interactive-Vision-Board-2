import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * AMIE Prompt Builder - Adaptive Motivational Identity Engine
 *
 * Compiles user's theme, identity profile, and knowledge chunks into
 * personalized system prompts for AI coaching interactions.
 *
 * Actions:
 * - build: Build complete AMIE context for a user
 * - get_system_prompt: Get formatted system prompt for AI chat
 * - refresh: Force refresh of cached AMIE context
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // All actions require authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid or expired authentication token')
    }

    const userId = user.id

    // Get action from query params
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'build'

    let body = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    // Route to appropriate handler
    switch (action) {
      case 'build':
        return await buildAMIEContext(supabase, userId, body)
      case 'get_system_prompt':
        return await getSystemPrompt(supabase, userId, body)
      case 'refresh':
        return await refreshContext(supabase, userId)
      default:
        throw new Error(`Unknown action: ${action}. Valid actions: build, get_system_prompt, refresh`)
    }

  } catch (error: any) {
    console.error('AMIE Prompt Builder error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Build complete AMIE context for a user
 */
async function buildAMIEContext(supabase: any, userId: string, options: any) {
  const { includeKnowledge = true, knowledgeQuery = '', maxKnowledgeChunks = 5 } = options

  // Get user's identity profile with theme
  const { data: profile, error: profileError } = await supabase
    .from('user_identity_profiles')
    .select(`
      *,
      theme:motivational_themes(*)
    `)
    .eq('user_id', userId)
    .single()

  if (profileError) {
    // No profile - return default context
    if (profileError.code === 'PGRST116') {
      return new Response(
        JSON.stringify({
          success: true,
          context: getDefaultContext(),
          hasProfile: false,
          message: 'Using default context. User has not completed onboarding.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    throw new Error(`Failed to fetch profile: ${profileError.message}`)
  }

  // Build theme context
  const themeContext = profile.theme ? {
    name: profile.theme.name,
    displayName: profile.theme.display_name,
    systemPrompt: profile.theme.system_prompt_template,
    style: profile.theme.motivation_style,
    includeScripture: profile.theme.include_scripture,
    includeMetrics: profile.theme.include_metrics,
    includeWellness: profile.theme.include_wellness,
    includeLegacy: profile.theme.include_legacy,
    vocabularyExamples: profile.theme.vocabulary_examples || [],
    contentSources: profile.theme.content_sources || []
  } : null

  // Build identity context
  const identityContext = {
    masterPrompt: profile.master_prompt,
    masterPromptResponses: profile.master_prompt_responses || [],
    coreValues: profile.core_values || [],
    lifeRoles: profile.life_roles || [],
    communicationStyle: profile.communication_style,
    motivationDrivers: profile.motivation_drivers || [],
    identitySummary: profile.identity_summary,
    coachingFocusAreas: profile.coaching_focus_areas || []
  }

  // Build preferences context
  const preferencesContext = {
    formalityLevel: profile.formality_level || 'professional',
    encouragementFrequency: profile.encouragement_frequency || 'moderate',
    preferredAiVoice: profile.preferred_ai_voice || 'balanced'
  }

  // Get relevant knowledge chunks if requested
  let knowledgeChunks: any[] = []
  if (includeKnowledge) {
    knowledgeChunks = await getRelevantKnowledge(supabase, userId, knowledgeQuery, maxKnowledgeChunks)
  }

  const amieContext = {
    theme: themeContext,
    identity: identityContext,
    preferences: preferencesContext,
    knowledge: knowledgeChunks,
    metadata: {
      userId,
      onboardingCompleted: profile.onboarding_completed,
      lastIdentityUpdate: profile.last_identity_update,
      compiledAt: new Date().toISOString()
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      context: amieContext,
      hasProfile: true,
      systemPrompt: buildSystemPrompt(amieContext)
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get formatted system prompt for AI chat
 */
async function getSystemPrompt(supabase: any, userId: string, options: any) {
  const { conversationContext = '', userMessage = '' } = options

  // Get user's identity profile with theme
  const { data: profile, error: profileError } = await supabase
    .from('user_identity_profiles')
    .select(`
      *,
      theme:motivational_themes(*)
    `)
    .eq('user_id', userId)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch profile: ${profileError.message}`)
  }

  // Build context (use defaults if no profile)
  const amieContext = profile ? {
    theme: profile.theme ? {
      name: profile.theme.name,
      displayName: profile.theme.display_name,
      systemPrompt: profile.theme.system_prompt_template,
      style: profile.theme.motivation_style,
      includeScripture: profile.theme.include_scripture,
      includeMetrics: profile.theme.include_metrics,
      includeWellness: profile.theme.include_wellness,
      includeLegacy: profile.theme.include_legacy,
      vocabularyExamples: profile.theme.vocabulary_examples || [],
      contentSources: profile.theme.content_sources || []
    } : null,
    identity: {
      masterPrompt: profile.master_prompt,
      masterPromptResponses: profile.master_prompt_responses || [],
      coreValues: profile.core_values || [],
      lifeRoles: profile.life_roles || [],
      communicationStyle: profile.communication_style,
      motivationDrivers: profile.motivation_drivers || [],
      identitySummary: profile.identity_summary,
      coachingFocusAreas: profile.coaching_focus_areas || []
    },
    preferences: {
      formalityLevel: profile.formality_level || 'professional',
      encouragementFrequency: profile.encouragement_frequency || 'moderate',
      preferredAiVoice: profile.preferred_ai_voice || 'balanced'
    },
    knowledge: [] as any[]
  } : getDefaultContext()

  // Get relevant knowledge chunks based on user message
  if (userMessage && profile) {
    amieContext.knowledge = await getRelevantKnowledge(supabase, userId, userMessage, 3)
  }

  const systemPrompt = buildSystemPrompt(amieContext, conversationContext)

  return new Response(
    JSON.stringify({
      success: true,
      systemPrompt,
      hasProfile: !!profile,
      contextSummary: {
        theme: amieContext.theme?.name || 'default',
        identityLoaded: !!(amieContext.identity?.identitySummary),
        knowledgeChunks: amieContext.knowledge?.length || 0
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Force refresh of cached AMIE context
 */
async function refreshContext(supabase: any, userId: string) {
  // Update last_identity_update to trigger cache invalidation
  const { error } = await supabase
    .from('user_identity_profiles')
    .update({ last_identity_update: new Date().toISOString() })
    .eq('user_id', userId)

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to refresh context: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'AMIE context cache invalidated. Next request will rebuild context.',
      refreshedAt: new Date().toISOString()
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get relevant knowledge chunks for context
 */
async function getRelevantKnowledge(
  supabase: any,
  userId: string,
  query: string,
  limit: number
): Promise<any[]> {
  if (!query) {
    // Return most recent chunks if no query
    const { data: chunks } = await supabase
      .from('user_knowledge_chunks')
      .select(`
        id,
        chunk_text,
        source:user_knowledge_sources(source_name, source_type)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return chunks?.map((c: any) => ({
      id: c.id,
      text: c.chunk_text,
      sourceName: c.source?.source_name,
      sourceType: c.source?.source_type
    })) || []
  }

  // For now, do a simple text search
  // In production, you would use embedding similarity search
  const { data: chunks } = await supabase
    .from('user_knowledge_chunks')
    .select(`
      id,
      chunk_text,
      source:user_knowledge_sources(source_name, source_type)
    `)
    .eq('user_id', userId)
    .textSearch('chunk_text', query, { type: 'websearch' })
    .limit(limit)

  // Fallback to recent if no text search results
  if (!chunks || chunks.length === 0) {
    const { data: recentChunks } = await supabase
      .from('user_knowledge_chunks')
      .select(`
        id,
        chunk_text,
        source:user_knowledge_sources(source_name, source_type)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return recentChunks?.map((c: any) => ({
      id: c.id,
      text: c.chunk_text,
      sourceName: c.source?.source_name,
      sourceType: c.source?.source_type
    })) || []
  }

  return chunks.map((c: any) => ({
    id: c.id,
    text: c.chunk_text,
    sourceName: c.source?.source_name,
    sourceType: c.source?.source_type
  }))
}

/**
 * Build the complete system prompt from AMIE context
 */
function buildSystemPrompt(context: any, conversationContext?: string): string {
  const parts: string[] = []

  // Base identity
  parts.push(`You are AMIE (Adaptive Motivational Identity Engine), an AI life coach within the Visionary AI platform.`)
  parts.push(`Your purpose is to help users achieve their goals through personalized guidance, accountability, and motivation.`)
  parts.push('')

  // Theme-specific prompt
  if (context.theme?.systemPrompt) {
    parts.push('## Coaching Style')
    parts.push(context.theme.systemPrompt)
    parts.push('')

    // Theme characteristics
    const characteristics: string[] = []
    if (context.theme.includeScripture) characteristics.push('Include relevant scripture references when appropriate')
    if (context.theme.includeMetrics) characteristics.push('Reference data, metrics, and measurable outcomes')
    if (context.theme.includeWellness) characteristics.push('Consider holistic wellness including physical, mental, and emotional health')
    if (context.theme.includeLegacy) characteristics.push('Connect actions to long-term legacy and impact')

    if (characteristics.length > 0) {
      parts.push('### Theme Characteristics')
      characteristics.forEach(c => parts.push(`- ${c}`))
      parts.push('')
    }

    // Vocabulary guidance
    if (context.theme.vocabularyExamples?.length > 0) {
      parts.push(`### Vocabulary Style`)
      parts.push(`Use language similar to: ${context.theme.vocabularyExamples.join(', ')}`)
      parts.push('')
    }
  } else {
    parts.push('## Coaching Style')
    parts.push('Provide balanced, professional coaching that is supportive yet challenging.')
    parts.push('Focus on actionable advice and measurable progress.')
    parts.push('')
  }

  // User identity
  if (context.identity) {
    parts.push('## User Profile')

    if (context.identity.identitySummary) {
      parts.push('### Identity Summary')
      parts.push(context.identity.identitySummary)
      parts.push('')
    }

    if (context.identity.coreValues?.length > 0) {
      parts.push(`### Core Values: ${context.identity.coreValues.join(', ')}`)
    }

    if (context.identity.lifeRoles?.length > 0) {
      parts.push(`### Life Roles: ${context.identity.lifeRoles.join(', ')}`)
    }

    if (context.identity.motivationDrivers?.length > 0) {
      parts.push(`### Motivation Drivers: ${context.identity.motivationDrivers.join(', ')}`)
    }

    if (context.identity.coachingFocusAreas?.length > 0) {
      parts.push(`### Focus Areas: ${context.identity.coachingFocusAreas.join(', ')}`)
    }

    if (context.identity.communicationStyle) {
      parts.push(`### Preferred Communication: ${context.identity.communicationStyle}`)
    }

    parts.push('')
  }

  // Preferences
  if (context.preferences) {
    parts.push('## Communication Preferences')

    const formalityMap: Record<string, string> = {
      formal: 'Maintain a formal, professional tone',
      casual: 'Use a casual, friendly conversational tone',
      professional: 'Use a professional but warm tone'
    }

    const encouragementMap: Record<string, string> = {
      high: 'Provide frequent encouragement and positive reinforcement',
      moderate: 'Balance encouragement with constructive guidance',
      minimal: 'Focus on direct, actionable feedback with minimal praise'
    }

    parts.push(`- ${formalityMap[context.preferences.formalityLevel] || formalityMap.professional}`)
    parts.push(`- ${encouragementMap[context.preferences.encouragementFrequency] || encouragementMap.moderate}`)
    parts.push('')
  }

  // Knowledge context
  if (context.knowledge?.length > 0) {
    parts.push('## Relevant User Context')
    parts.push('The following information is from the user\'s personal knowledge base:')
    parts.push('')
    context.knowledge.forEach((chunk: any, i: number) => {
      parts.push(`### Source: ${chunk.sourceName || 'Personal Document'} (${chunk.sourceType || 'document'})`)
      parts.push(chunk.text)
      parts.push('')
    })
  }

  // Conversation context
  if (conversationContext) {
    parts.push('## Current Conversation Context')
    parts.push(conversationContext)
    parts.push('')
  }

  // Guidelines
  parts.push('## Guidelines')
  parts.push('1. Always be supportive while maintaining appropriate challenge')
  parts.push('2. Connect advice to the user\'s specific goals and values')
  parts.push('3. Suggest concrete, actionable next steps')
  parts.push('4. Celebrate progress and acknowledge setbacks compassionately')
  parts.push('5. Keep responses concise unless detailed explanation is needed')
  parts.push('6. Ask clarifying questions when the user\'s intent is unclear')
  parts.push('')

  return parts.join('\n')
}

/**
 * Get default context when user has no profile
 */
function getDefaultContext() {
  return {
    theme: null,
    identity: {
      masterPrompt: null,
      masterPromptResponses: [],
      coreValues: [],
      lifeRoles: [],
      communicationStyle: null,
      motivationDrivers: [],
      identitySummary: null,
      coachingFocusAreas: []
    },
    preferences: {
      formalityLevel: 'professional',
      encouragementFrequency: 'moderate',
      preferredAiVoice: 'balanced'
    },
    knowledge: []
  }
}
