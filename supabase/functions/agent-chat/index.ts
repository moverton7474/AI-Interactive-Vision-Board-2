import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default system prompt for users without AMIE profile
const DEFAULT_SYSTEM_PROMPT = `You are Vision Coach, an AI assistant for Visionary - a retirement planning and visualization platform. Your role is to:

1. Help users clarify and articulate their retirement dreams and goals
2. Provide encouragement and accountability for their action plans
3. Suggest practical next steps toward their vision
4. Track their progress and celebrate wins
5. Offer gentle nudges when they fall behind on habits

Personality traits:
- Warm and supportive, like a trusted advisor
- Practical and action-oriented
- Knowledgeable about retirement planning basics
- Encouraging without being pushy

Keep responses concise (2-3 paragraphs max). Ask one follow-up question to keep the conversation flowing.`

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }
    })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_SERVICE_ROLE_KEY ?? '')

    const body = await req.json()
    const { message, sessionId, userId, useAMIE = true } = body

    if (!message || !userId) {
      throw new Error('Missing required fields: message and userId')
    }

    let currentSessionId = sessionId

    // Create new session if none provided
    if (!currentSessionId) {
      const { data: session, error: sessionError } = await supabase
        .from('agent_sessions')
        .insert({
          user_id: userId,
          session_type: 'text',
          status: 'active',
          context: {}
        })
        .select()
        .single()

      if (sessionError) {
        console.error('Session creation error:', sessionError)
        throw new Error('Failed to create session')
      }
      currentSessionId = session.id
    }

    // Save user message
    const { error: userMsgError } = await supabase
      .from('agent_messages')
      .insert({
        session_id: currentSessionId,
        role: 'user',
        content: message,
        content_type: 'text',
        metadata: {}
      })

    if (userMsgError) {
      console.error('User message save error:', userMsgError)
    }

    // Fetch conversation history for context
    const { data: history } = await supabase
      .from('agent_messages')
      .select('role, content')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true })
      .limit(20)

    // Get AMIE personalized system prompt if enabled
    let systemPrompt = DEFAULT_SYSTEM_PROMPT
    let amieTheme = 'default'

    if (useAMIE) {
      const amieContext = await getAMIESystemPrompt(supabase, userId, message)
      if (amieContext.systemPrompt) {
        systemPrompt = amieContext.systemPrompt
        amieTheme = amieContext.theme || 'default'
        console.log(`Using AMIE prompt for user ${userId}, theme: ${amieTheme}`)
      }
    }

    // Build conversation for Gemini
    const conversationHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }))

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'I understand. I am ready to help with personalized coaching based on your goals and values.' }] },
            ...conversationHistory
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json()
      console.error('Gemini API error:', errorData)
      throw new Error('AI service unavailable')
    }

    const geminiData = await geminiResponse.json()
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm having trouble formulating a response. Could you rephrase that?"

    // Save agent response with AMIE metadata
    const { error: agentMsgError } = await supabase
      .from('agent_messages')
      .insert({
        session_id: currentSessionId,
        role: 'agent',
        content: aiResponse,
        content_type: 'text',
        metadata: {
          amie_theme: amieTheme,
          personalized: useAMIE && amieTheme !== 'default'
        }
      })

    if (agentMsgError) {
      console.error('Agent message save error:', agentMsgError)
    }

    return new Response(
      JSON.stringify({
        response: aiResponse,
        sessionId: currentSessionId,
        amieTheme
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Agent chat error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})

/**
 * Get personalized AMIE system prompt for a user
 */
async function getAMIESystemPrompt(
  supabase: any,
  userId: string,
  userMessage: string
): Promise<{ systemPrompt: string | null; theme: string | null }> {
  try {
    // Get user's identity profile with theme
    const { data: profile, error: profileError } = await supabase
      .from('user_identity_profiles')
      .select(`
        *,
        theme:motivational_themes(*)
      `)
      .eq('user_id', userId)
      .single()

    if (profileError || !profile) {
      // No profile - return null to use default
      return { systemPrompt: null, theme: null }
    }

    // Build the personalized system prompt
    const systemPrompt = buildAMIEPrompt(profile, userMessage)
    const theme = profile.theme?.name || null

    return { systemPrompt, theme }
  } catch (error) {
    console.error('Error fetching AMIE context:', error)
    return { systemPrompt: null, theme: null }
  }
}

/**
 * Build personalized AMIE system prompt from user profile
 */
function buildAMIEPrompt(profile: any, userMessage: string): string {
  const parts: string[] = []

  // Base identity
  parts.push(`You are AMIE (Adaptive Motivational Identity Engine), a personalized AI life coach within the Visionary AI platform.`)
  parts.push(`Your purpose is to help users achieve their goals through personalized guidance, accountability, and motivation.`)
  parts.push('')

  // Theme-specific prompt
  if (profile.theme) {
    parts.push('## Your Coaching Style')

    if (profile.theme.system_prompt_template) {
      parts.push(profile.theme.system_prompt_template)
    } else {
      // Default theme description
      const themeDescriptions: Record<string, string> = {
        christian: 'You integrate faith-based wisdom and scripture into your coaching. Reference Biblical principles when relevant and appropriate.',
        business_executive: 'You use business frameworks, metrics, and executive language. Focus on ROI, efficiency, and strategic thinking.',
        health_fitness: 'You emphasize holistic wellness, energy management, and sustainable habits. Connect goals to physical and mental health.',
        retirement: 'You focus on legacy, life transitions, and making the most of every stage of life. Balance practical planning with meaningful living.',
        legacy_builder: 'You emphasize impact, purpose, and leaving a lasting legacy. Connect daily actions to long-term significance.'
      }
      parts.push(themeDescriptions[profile.theme.name] || 'Provide balanced, supportive coaching.')
    }
    parts.push('')

    // Theme characteristics
    const characteristics: string[] = []
    if (profile.theme.include_scripture) characteristics.push('Include relevant scripture references when appropriate')
    if (profile.theme.include_metrics) characteristics.push('Reference data, metrics, and measurable outcomes')
    if (profile.theme.include_wellness) characteristics.push('Consider holistic wellness including physical, mental, and emotional health')
    if (profile.theme.include_legacy) characteristics.push('Connect actions to long-term legacy and impact')

    if (characteristics.length > 0) {
      parts.push('### Approach')
      characteristics.forEach(c => parts.push(`- ${c}`))
      parts.push('')
    }
  }

  // User identity
  parts.push('## About This User')

  if (profile.identity_summary) {
    parts.push(profile.identity_summary)
    parts.push('')
  }

  // Master prompt responses
  if (profile.master_prompt_responses?.length > 0) {
    parts.push('### User Profile Details')
    for (const response of profile.master_prompt_responses) {
      if (response.answer) {
        const answer = Array.isArray(response.answer)
          ? response.answer.join(', ')
          : response.answer
        parts.push(`- ${response.question_text}: ${answer}`)
      }
    }
    parts.push('')
  }

  if (profile.core_values?.length > 0) {
    parts.push(`### Core Values: ${profile.core_values.join(', ')}`)
  }

  if (profile.life_roles?.length > 0) {
    parts.push(`### Life Roles: ${profile.life_roles.join(', ')}`)
  }

  if (profile.motivation_drivers?.length > 0) {
    parts.push(`### Motivation Drivers: ${profile.motivation_drivers.join(', ')}`)
  }

  if (profile.coaching_focus_areas?.length > 0) {
    parts.push(`### Current Focus Areas: ${profile.coaching_focus_areas.join(', ')}`)
  }

  parts.push('')

  // Communication preferences
  parts.push('## Communication Style')

  const formalityMap: Record<string, string> = {
    formal: 'Use a formal, professional tone',
    casual: 'Use a casual, friendly conversational tone',
    professional: 'Use a professional but warm tone'
  }

  const encouragementMap: Record<string, string> = {
    high: 'Provide frequent encouragement and positive reinforcement',
    moderate: 'Balance encouragement with constructive guidance',
    minimal: 'Focus on direct, actionable feedback'
  }

  parts.push(`- ${formalityMap[profile.formality_level] || formalityMap.professional}`)
  parts.push(`- ${encouragementMap[profile.encouragement_frequency] || encouragementMap.moderate}`)

  if (profile.communication_style) {
    const styleMap: Record<string, string> = {
      direct: 'Be direct and to-the-point',
      supportive: 'Lead with empathy and support',
      analytical: 'Use data and logical reasoning',
      storytelling: 'Use stories and examples to illustrate points'
    }
    parts.push(`- ${styleMap[profile.communication_style] || ''}`)
  }

  parts.push('')

  // Guidelines
  parts.push('## Guidelines')
  parts.push('1. Keep responses concise (2-3 paragraphs max) unless more detail is needed')
  parts.push('2. Connect advice to the user\'s specific values and goals')
  parts.push('3. Suggest concrete, actionable next steps')
  parts.push('4. Celebrate progress and acknowledge setbacks compassionately')
  parts.push('5. Ask one follow-up question to keep the conversation flowing')
  parts.push('')

  return parts.join('\n')
}
