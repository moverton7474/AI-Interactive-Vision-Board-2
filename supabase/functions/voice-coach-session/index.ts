import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Voice Coach Session Service
 *
 * Handles voice-based coaching interactions with AMIE personality.
 * Supports real-time transcription processing, sentiment analysis,
 * and contextual coaching responses.
 *
 * Actions:
 * - start: Initialize a new voice coaching session
 * - process: Process transcript and generate AI response
 * - end: Complete session and generate summary
 * - list: Get session history
 * - get: Get specific session details
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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

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

    let body: any = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    // Get action from query params OR body (body takes precedence for supabase.functions.invoke compatibility)
    const url = new URL(req.url)
    let action = url.searchParams.get('action') || 'list'

    // Infer action from body content if not explicitly set
    if (body.sessionType && !body.sessionId) {
      action = 'start'
    } else if (body.sessionId && body.transcript) {
      action = 'process'
    } else if (body.sessionId && !body.transcript) {
      action = 'end'
    } else if (body.action) {
      action = body.action
    }

    // Route to appropriate handler
    switch (action) {
      case 'start':
        return await startSession(supabase, userId, body)
      case 'process':
        return await processTranscript(supabase, userId, body, OPENAI_API_KEY)
      case 'end':
        return await endSession(supabase, userId, body, OPENAI_API_KEY)
      case 'list':
        return await listSessions(supabase, userId, url.searchParams)
      case 'get':
        return await getSession(supabase, userId, url.searchParams)
      default:
        throw new Error(`Unknown action: ${action}. Valid actions: start, process, end, list, get`)
    }

  } catch (error: any) {
    console.error('Voice coach session error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Get team AI settings for guardrails
 */
async function getTeamAISettings(supabase: any, userId: string): Promise<any> {
  try {
    // Get user's team
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (!teamMember?.team_id) {
      return null // No team = no guardrails
    }

    // Get team AI settings (table may not exist yet)
    const { data: settings, error } = await supabase
      .from('team_ai_settings')
      .select('*')
      .eq('team_id', teamMember.team_id)
      .single()

    // If table doesn't exist or no settings, return null (no guardrails)
    if (error) {
      console.log('AI settings not available:', error.message)
      return null
    }

    return settings
  } catch (err) {
    // Gracefully handle missing table or other errors
    console.log('Error fetching AI settings, proceeding without guardrails:', err)
    return null
  }
}

/**
 * Check guardrails for session start
 */
async function checkSessionGuardrails(supabase: any, userId: string, settings: any): Promise<{ allowed: boolean; reason?: string }> {
  if (!settings) {
    return { allowed: true }
  }

  // Check daily session limit
  if (settings.max_sessions_per_day) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('voice_coach_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('started_at', today.toISOString())

    if (count >= settings.max_sessions_per_day) {
      return {
        allowed: false,
        reason: `Daily session limit reached (${settings.max_sessions_per_day} sessions). Please try again tomorrow.`
      }
    }
  }

  return { allowed: true }
}

/**
 * Check content guardrails for blocked topics
 */
function checkContentGuardrails(transcript: string, settings: any): { allowed: boolean; reason?: string; blockedTopic?: string } {
  if (!settings?.blocked_topics || settings.blocked_topics.length === 0) {
    return { allowed: true }
  }

  const lowerTranscript = transcript.toLowerCase()

  for (const topic of settings.blocked_topics) {
    if (lowerTranscript.includes(topic.toLowerCase())) {
      return {
        allowed: false,
        reason: `This topic has been restricted by team policy. Let's focus on something else.`,
        blockedTopic: topic
      }
    }
  }

  return { allowed: true }
}

/**
 * Check if sentiment triggers an alert
 */
async function checkSentimentAlert(supabase: any, userId: string, sentiment: number, settings: any, sessionId: string) {
  // Skip if no settings or sentiment alerts disabled
  if (!settings?.enable_sentiment_alerts) {
    return
  }

  const threshold = settings.sentiment_alert_threshold || 0.3

  if (sentiment < threshold) {
    try {
      // Get user's team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (teamMember?.team_id) {
        // Create engagement alert (table may not exist yet)
        const { error } = await supabase
          .from('engagement_alerts')
          .insert({
            team_id: teamMember.team_id,
            user_id: userId,
            alert_type: 'low_sentiment',
            severity: sentiment < 0.2 ? 'high' : 'medium',
            title: 'Low sentiment detected in voice session',
            description: `User's voice coaching session showed sentiment score of ${(sentiment * 100).toFixed(0)}%, which is below the team threshold of ${(threshold * 100).toFixed(0)}%.`,
            metadata: {
              session_id: sessionId,
              sentiment_score: sentiment,
              threshold: threshold
            }
          })

        if (error) {
          console.log('Could not create sentiment alert:', error.message)
        }

        // If crisis escalation email is configured and sentiment is very low
        if (sentiment < 0.2 && settings.crisis_escalation_email) {
          // Log for potential email notification (would trigger in separate function)
          console.log(`Crisis alert: Low sentiment ${sentiment} for user ${userId}, escalation email: ${settings.crisis_escalation_email}`)
        }
      }
    } catch (err) {
      // Gracefully handle missing table
      console.log('Error creating sentiment alert:', err)
    }
  }
}

/**
 * Start a new voice coaching session
 */
async function startSession(supabase: any, userId: string, body: any) {
  const {
    sessionType = 'check_in',
    triggerContext,
    deviceType = 'web'
  } = body

  // Validate session type
  const validTypes = ['morning_routine', 'check_in', 'reflection', 'goal_setting', 'celebration', 'accountability', 'crisis_support']
  if (!validTypes.includes(sessionType)) {
    throw new Error(`Invalid sessionType. Valid types: ${validTypes.join(', ')}`)
  }

  // Check guardrails
  const aiSettings = await getTeamAISettings(supabase, userId)
  const guardrailCheck = await checkSessionGuardrails(supabase, userId, aiSettings)

  if (!guardrailCheck.allowed) {
    throw new Error(guardrailCheck.reason || 'Session not allowed by team policy')
  }

  // Get user's AMIE profile and theme
  const { data: identityProfile } = await supabase
    .from('user_identity_profiles')
    .select(`
      master_prompt,
      identity_summary,
      theme:motivational_themes (
        id,
        name,
        display_name,
        motivation_style,
        vocabulary_examples
      )
    `)
    .eq('user_id', userId)
    .single()

  const theme = identityProfile?.theme

  // Map schema fields to expected format
  if (theme) {
    theme.voice_style = theme.motivation_style
    theme.greeting_style = 'warm' // Default
    theme.encouragement_phrases = theme.vocabulary_examples
  }

  // Map profile fields
  if (identityProfile) {
    identityProfile.compiled_prompt = identityProfile.master_prompt
    identityProfile.personality_snapshot = identityProfile.identity_summary
  }

  // Create session record
  const { data: session, error: sessionError } = await supabase
    .from('voice_coach_sessions')
    .insert({
      user_id: userId,
      session_type: sessionType,
      trigger_context: triggerContext,
      device_type: deviceType,
      started_at: new Date().toISOString(),
      transcript: [],
      key_topics: [],
      action_items_generated: []
    })
    .select()
    .single()

  if (sessionError) {
    throw new Error(`Failed to create session: ${sessionError.message}`)
  }

  // Generate opening message based on session type and theme
  const openingMessage = generateOpeningMessage(sessionType, theme, identityProfile)

  console.log(`Started voice session for user ${userId}: ${sessionType}`)

  return new Response(
    JSON.stringify({
      success: true,
      session: {
        id: session.id,
        sessionType,
        startedAt: session.started_at
      },
      openingMessage,
      theme: theme ? {
        name: theme.display_name || theme.name,
        voiceStyle: theme.voice_style
      } : null
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Process transcript and generate AI response
 */
async function processTranscript(supabase: any, userId: string, body: any, openaiKey: string) {
  const { sessionId, transcript, isPartial = false } = body

  if (!sessionId || !transcript) {
    throw new Error('sessionId and transcript are required')
  }

  // Verify session ownership
  const { data: session, error: sessionError } = await supabase
    .from('voice_coach_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()

  if (sessionError || !session) {
    throw new Error('Session not found or access denied')
  }

  if (session.ended_at) {
    throw new Error('Session has already ended')
  }

  // Get AI settings for guardrails
  const aiSettings = await getTeamAISettings(supabase, userId)

  // Check content guardrails for blocked topics
  const contentCheck = checkContentGuardrails(transcript, aiSettings)
  if (!contentCheck.allowed) {
    return new Response(
      JSON.stringify({
        success: true,
        response: contentCheck.reason,
        blocked: true,
        blockedTopic: contentCheck.blockedTopic
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Update transcript history
  const transcriptHistory = session.transcript || []
  transcriptHistory.push({
    role: 'user',
    content: transcript,
    timestamp: new Date().toISOString(),
    isPartial
  })

  // If partial transcript, just store and return
  if (isPartial) {
    await supabase
      .from('voice_coach_sessions')
      .update({ transcript: transcriptHistory })
      .eq('id', sessionId)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Partial transcript stored'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get AMIE context for personalized response
  const { data: identityProfile } = await supabase
    .from('user_identity_profiles')
    .select(`
      master_prompt,
      identity_summary,
      theme:motivational_themes (
        name,
        display_name,
        motivation_style,
        vocabulary_examples,
        system_prompt_template
      )
    `)
    .eq('user_id', userId)
    .single()

  const theme = identityProfile?.theme

  // Map schema fields to expected format
  if (theme) {
    theme.voice_style = theme.motivation_style
    theme.encouragement_phrases = theme.vocabulary_examples
  }

  // Map profile fields
  if (identityProfile) {
    identityProfile.compiled_prompt = identityProfile.master_prompt
    identityProfile.personality_snapshot = identityProfile.identity_summary
  }

  // Build system prompt for voice coaching
  const systemPrompt = buildVoiceCoachPrompt(session.session_type, theme, identityProfile)

  // Format conversation for AI
  const messages = [
    { role: 'system', content: systemPrompt },
    ...transcriptHistory.filter((t: any) => !t.isPartial).map((t: any) => ({
      role: t.role,
      content: t.content
    }))
  ]

  // Generate AI response using OpenAI with function calling
  let aiResponse = ''
  let sentiment = 0.5
  let actionsPerformed: any[] = []

  console.log(`[Voice Coach] Processing transcript. OPENAI_API_KEY present: ${!!openaiKey}, key length: ${openaiKey?.length || 0}`)

  if (openaiKey) {
    try {
      console.log('[Voice Coach] Calling OpenAI API with', messages.length, 'messages')

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          tools: getOpenAITools(),
          tool_choice: 'auto',
          max_tokens: 500,
          temperature: 0.7
        })
      })

      const result = await openaiResponse.json()
      console.log('[Voice Coach] OpenAI response status:', openaiResponse.status)

      // Check for API errors
      if (result.error) {
        console.error('[Voice Coach] OpenAI API error:', result.error)
        throw new Error(result.error.message || 'OpenAI API error')
      }

      const choice = result.choices?.[0]
      const message = choice?.message

      // Check if OpenAI wants to call functions
      if (message?.tool_calls && message.tool_calls.length > 0) {
        // Process each tool call
        const toolMessages: any[] = []

        for (const toolCall of message.tool_calls) {
          const name = toolCall.function?.name
          let args = {}

          try {
            args = JSON.parse(toolCall.function?.arguments || '{}')
          } catch (e) {
            console.error('Failed to parse tool arguments:', e)
          }

          console.log('Function call detected:', name, args)

          // Execute the tool with guardrails
          let toolResult
          try {
            toolResult = await executeAgentTool(supabase, userId, name, args, aiSettings)
            actionsPerformed.push({ tool: name, args, result: toolResult })
          } catch (toolError: any) {
            console.error('Tool execution error:', toolError)
            toolResult = { success: false, error: toolError.message || 'Tool execution failed' }
          }

          // Add tool result to messages
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          })
        }

        // Get OpenAI to respond based on tool results (single follow-up call)
        try {
          const followUpMessages = [
            ...messages,
            message, // The assistant message with tool_calls
            ...toolMessages // The tool results
          ]

          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              max_tokens: 300,
              temperature: 0.7
            })
          })

          const followUpResult = await followUpResponse.json()
          aiResponse = followUpResult.choices?.[0]?.message?.content ||
            (actionsPerformed[0]?.result?.success
              ? `Done! I've completed the action for you. ${actionsPerformed[0]?.result?.message || ''}`
              : `I tried to help, but encountered an issue: ${actionsPerformed[0]?.result?.error || 'Please try again.'}`)
        } catch (followUpError: any) {
          console.error('Follow-up OpenAI error:', followUpError)
          // Generate response based on tool result
          const lastResult = actionsPerformed[actionsPerformed.length - 1]?.result
          aiResponse = lastResult?.success
            ? `Done! ${lastResult.message || 'Action completed successfully.'}`
            : `I encountered an issue: ${lastResult?.error || 'Please try again.'}`
        }
      } else if (message?.content) {
        aiResponse = message.content
      }

      if (!aiResponse) {
        aiResponse = message?.content || ''
      }

      // Simple sentiment analysis based on keywords
      sentiment = analyzeSentiment(transcript)
    } catch (err: any) {
      console.error('[Voice Coach] OpenAI error:', err?.message || err)
      console.error('[Voice Coach] Full error:', JSON.stringify(err, null, 2))
      aiResponse = generateFallbackResponse(session.session_type, theme)
      console.log('[Voice Coach] Using fallback response due to OpenAI error')
    }
  } else {
    console.warn('[Voice Coach] OPENAI_API_KEY not available, using fallback response')
    aiResponse = generateFallbackResponse(session.session_type, theme)
  }

  // Add AI response to transcript
  transcriptHistory.push({
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date().toISOString()
  })

  // Update session
  await supabase
    .from('voice_coach_sessions')
    .update({
      transcript: transcriptHistory,
      sentiment_score: sentiment
    })
    .eq('id', sessionId)

  // Check sentiment and create alert if below threshold
  await checkSentimentAlert(supabase, userId, sentiment, aiSettings, sessionId)

  return new Response(
    JSON.stringify({
      success: true,
      response: aiResponse,
      sentiment,
      turnCount: transcriptHistory.filter((t: any) => t.role === 'user' && !t.isPartial).length
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * End session and generate summary
 */
async function endSession(supabase: any, userId: string, body: any, openaiKey: string) {
  const { sessionId } = body

  if (!sessionId) {
    throw new Error('sessionId is required')
  }

  // Get session
  const { data: session, error: sessionError } = await supabase
    .from('voice_coach_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()

  if (sessionError || !session) {
    throw new Error('Session not found or access denied')
  }

  if (session.ended_at) {
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Session already ended',
        session
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const transcript = session.transcript || []
  const userMessages = transcript.filter((t: any) => t.role === 'user' && !t.isPartial)

  // Extract key topics and action items using Gemini
  let keyTopics: string[] = []
  let actionItems: string[] = []
  let sessionSummary = ''

  if (openaiKey && userMessages.length > 0) {
    try {
      const summaryPrompt = `Analyze this voice coaching session and extract:
1. Key topics discussed (max 5)
2. Any action items or commitments made
3. A brief 2-3 sentence summary

Session transcript:
${transcript.map((t: any) => `${t.role}: ${t.content}`).join('\n')}

Respond in JSON format only, no markdown:
{
  "keyTopics": ["topic1", "topic2"],
  "actionItems": ["action1", "action2"],
  "summary": "Brief summary here"
}`

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: summaryPrompt }],
          max_tokens: 500,
          temperature: 0.3
        })
      })

      const result = await openaiResponse.json()
      let content = result.choices?.[0]?.message?.content || ''

      // Clean up potential markdown code blocks
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

      try {
        const parsed = JSON.parse(content)
        keyTopics = parsed.keyTopics || []
        actionItems = parsed.actionItems || []
        sessionSummary = parsed.summary || ''
      } catch {
        // If JSON parsing fails, use simple extraction
        keyTopics = extractKeywords(userMessages.map((m: any) => m.content).join(' '))
      }
    } catch (err) {
      console.error('Summary generation error:', err)
      keyTopics = extractKeywords(userMessages.map((m: any) => m.content).join(' '))
    }
  } else {
    keyTopics = extractKeywords(userMessages.map((m: any) => m.content).join(' '))
  }

  // Calculate average sentiment
  const avgSentiment = session.sentiment_score || 0.5

  // Calculate duration
  const startTime = new Date(session.started_at)
  const endTime = new Date()
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  // Update session
  const { data: updatedSession, error: updateError } = await supabase
    .from('voice_coach_sessions')
    .update({
      ended_at: endTime.toISOString(),
      duration_minutes: durationMinutes,
      key_topics: keyTopics,
      action_items_generated: actionItems,
      sentiment_score: avgSentiment
    })
    .eq('id', sessionId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`Failed to end session: ${updateError.message}`)
  }

  // Create action items as tasks if any
  if (actionItems.length > 0) {
    const tasks = actionItems.map((item: string) => ({
      user_id: userId,
      title: item,
      description: `From voice coaching session on ${new Date().toLocaleDateString()}`,
      source: 'voice_coach',
      source_reference: sessionId,
      priority: 'medium',
      status: 'pending'
    }))

    await supabase
      .from('tasks')
      .insert(tasks)
      .select()
  }

  console.log(`Ended voice session ${sessionId}: ${durationMinutes} minutes, ${keyTopics.length} topics`)

  return new Response(
    JSON.stringify({
      success: true,
      session: updatedSession,
      summary: {
        duration: durationMinutes,
        keyTopics,
        actionItems,
        sentiment: avgSentiment,
        turnCount: userMessages.length
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * List session history
 */
async function listSessions(supabase: any, userId: string, params: URLSearchParams) {
  const limit = parseInt(params.get('limit') || '20')
  const sessionType = params.get('type')

  let query = supabase
    .from('voice_coach_sessions')
    .select(`
      id,
      session_type,
      trigger_context,
      started_at,
      ended_at,
      duration_minutes,
      key_topics,
      sentiment_score
    `)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (sessionType) {
    query = query.eq('session_type', sessionType)
  }

  const { data: sessions, error } = await query

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`)
  }

  // Calculate stats
  const completedSessions = sessions?.filter((s: any) => s.ended_at) || []
  const totalMinutes = completedSessions.reduce((acc: number, s: any) => acc + (s.duration_minutes || 0), 0)
  const avgSentiment = completedSessions.length > 0
    ? completedSessions.reduce((acc: number, s: any) => acc + (s.sentiment_score || 0.5), 0) / completedSessions.length
    : 0.5

  return new Response(
    JSON.stringify({
      success: true,
      sessions: sessions || [],
      stats: {
        totalSessions: sessions?.length || 0,
        completedSessions: completedSessions.length,
        totalMinutes,
        averageSentiment: avgSentiment
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get specific session details
 */
async function getSession(supabase: any, userId: string, params: URLSearchParams) {
  const sessionId = params.get('sessionId')

  if (!sessionId) {
    throw new Error('sessionId is required')
  }

  const { data: session, error } = await supabase
    .from('voice_coach_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()

  if (error || !session) {
    throw new Error('Session not found')
  }

  return new Response(
    JSON.stringify({
      success: true,
      session
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Generate opening message based on session type and theme
 */
function generateOpeningMessage(sessionType: string, theme: any, profile: any): string {
  const themeName = theme?.display_name || theme?.name || 'Coach'
  const greetingStyle = theme?.greeting_style || 'warm'

  const openings: Record<string, string[]> = {
    morning_routine: [
      `Good morning! I'm ${themeName}, and I'm here to help you start your day with intention. What's on your mind?`,
      `Rise and shine! Let's set the tone for an amazing day. What would you like to focus on?`,
      `A new day, a fresh start. What energy do you want to bring into today?`
    ],
    check_in: [
      `Hey there! I'm ${themeName}. How are you doing right now?`,
      `Let's check in together. What's going on in your world?`,
      `I'm here to listen. What's on your heart today?`
    ],
    reflection: [
      `Welcome to your reflection space. I'm ${themeName}. What would you like to explore?`,
      `Let's take a moment to look back and learn. What's been on your mind lately?`,
      `Reflection is where growth happens. What insights are emerging for you?`
    ],
    goal_setting: [
      `Let's dream big together! I'm ${themeName}. What goal has been calling to you?`,
      `Ready to set some intentions? What do you want to create in your life?`,
      `Goals give us direction. What would make the biggest difference for you right now?`
    ],
    celebration: [
      `Time to celebrate! I'm ${themeName}, and I'm excited to hear about your wins!`,
      `Let's acknowledge your progress! What are you proud of?`,
      `Every win matters. What success would you like to celebrate?`
    ],
    accountability: [
      `Let's keep you on track! I'm ${themeName}. How are you progressing on your commitments?`,
      `Accountability time! What's working and what needs adjustment?`,
      `Checking in on your goals. What progress have you made?`
    ],
    crisis_support: [
      `I'm here for you. I'm ${themeName}, and I'm listening. What's happening?`,
      `Take a breath. You're not alone. Tell me what you're experiencing.`,
      `I'm here to support you. What do you need right now?`
    ]
  }

  const messages = openings[sessionType] || openings.check_in
  return messages[Math.floor(Math.random() * messages.length)]
}

/**
 * Build voice coach system prompt
 */
function buildVoiceCoachPrompt(sessionType: string, theme: any, profile: any): string {
  const themeName = theme?.display_name || theme?.name || 'AMIE'
  const voiceStyle = theme?.voice_style || 'warm and encouraging'
  const personalityContext = profile?.personality_snapshot || ''

  const sessionContext: Record<string, string> = {
    morning_routine: 'helping the user start their day with intention and clarity',
    check_in: 'checking in on the user\'s emotional state and providing support',
    reflection: 'guiding the user through reflection on recent experiences',
    goal_setting: 'helping the user clarify and commit to meaningful goals',
    celebration: 'celebrating the user\'s wins and reinforcing positive behavior',
    accountability: 'reviewing progress on commitments and adjusting plans',
    crisis_support: 'providing calm, supportive presence during difficulty'
  }

  return `You are ${themeName}, an AI voice coach and executive assistant with a ${voiceStyle} communication style.

Your role: ${sessionContext[sessionType] || sessionContext.check_in}

CAPABILITIES - You can perform actions for the user:
- Send emails on their behalf (use send_email tool)
- Create tasks and to-do items (use create_task tool)
- Schedule reminders (use schedule_reminder tool)
- Look up their goals and progress (use get_user_data tool)

When the user asks you to do something like "send an email" or "create a task" or "remind me", use the appropriate tool.
Always confirm the action before executing and report back what you did.

Communication guidelines:
- Keep responses concise and conversational (2-4 sentences max)
- Speak naturally as if in a voice conversation
- Be warm, encouraging, and authentic
- Ask one question at a time
- Acknowledge emotions before offering advice
- When the user asks you to perform a task, confirm the details and execute it
- Report back on completed actions

${personalityContext ? `User context: ${personalityContext}` : ''}

${theme?.encouragement_phrases ? `When encouraging, consider phrases like: ${theme.encouragement_phrases.join(', ')}` : ''}

Remember: This is a voice conversation. Keep it natural and human. You are both a coach AND an assistant who can take action.`
}

/**
 * Get OpenAI tools definition for agentic capabilities
 * Converted from Gemini functionDeclarations format to OpenAI function format
 */
function getOpenAITools() {
  return [
    {
      type: 'function',
      function: {
        name: 'send_email',
        description: 'Send an email on behalf of the user',
        parameters: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Email address of recipient (or "team" for team members)'
            },
            subject: {
              type: 'string',
              description: 'Email subject line'
            },
            body: {
              type: 'string',
              description: 'Email body content'
            }
          },
          required: ['to', 'subject', 'body']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_task',
        description: 'Create a new task or action item for the user',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Task title'
            },
            description: {
              type: 'string',
              description: 'Task description (optional)'
            },
            due_date: {
              type: 'string',
              description: 'Due date in YYYY-MM-DD format (optional)'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Task priority'
            }
          },
          required: ['title']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'schedule_reminder',
        description: 'Schedule a reminder notification for the user',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Reminder message'
            },
            when: {
              type: 'string',
              description: 'When to send (e.g., "tomorrow at 9am", "in 2 hours", "2024-12-20 14:00")'
            }
          },
          required: ['message', 'when']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_user_data',
        description: 'Get information about the user\'s goals, habits, or progress',
        parameters: {
          type: 'object',
          properties: {
            data_type: {
              type: 'string',
              enum: ['goals', 'habits', 'tasks', 'progress', 'vision'],
              description: 'Type of data to retrieve'
            }
          },
          required: ['data_type']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_todays_habits',
        description: 'Get the user\'s habits scheduled for today with their completion status',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'mark_habit_complete',
        description: 'Mark a specific habit as completed for today',
        parameters: {
          type: 'object',
          properties: {
            habit_id: {
              type: 'string',
              description: 'The ID of the habit to mark complete'
            },
            habit_name: {
              type: 'string',
              description: 'The name of the habit (if ID is not known, will search by name)'
            },
            notes: {
              type: 'string',
              description: 'Optional notes about the completion'
            }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_habit_reminder',
        description: 'Send a reminder to the user about a specific habit',
        parameters: {
          type: 'object',
          properties: {
            habit_id: {
              type: 'string',
              description: 'The ID of the habit to remind about'
            },
            habit_name: {
              type: 'string',
              description: 'The name of the habit (if ID is not known)'
            },
            channel: {
              type: 'string',
              enum: ['push', 'sms', 'email'],
              description: 'Channel to send the reminder through'
            },
            message: {
              type: 'string',
              description: 'Custom reminder message'
            }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_goal_progress',
        description: 'Update the progress percentage on a user\'s goal',
        parameters: {
          type: 'object',
          properties: {
            goal_id: {
              type: 'string',
              description: 'The ID of the goal to update'
            },
            goal_name: {
              type: 'string',
              description: 'The name of the goal (if ID is not known)'
            },
            progress: {
              type: 'number',
              description: 'New progress percentage (0-100)'
            },
            notes: {
              type: 'string',
              description: 'Optional notes about the progress update'
            }
          },
          required: ['progress']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'schedule_goal_checkin',
        description: 'Schedule a future check-in for a specific goal',
        parameters: {
          type: 'object',
          properties: {
            goal_id: {
              type: 'string',
              description: 'The ID of the goal'
            },
            goal_name: {
              type: 'string',
              description: 'The name of the goal (if ID is not known)'
            },
            when: {
              type: 'string',
              description: 'When to schedule the check-in (e.g., "tomorrow", "next week", "in 3 days")'
            },
            channel: {
              type: 'string',
              enum: ['push', 'sms', 'email', 'voice'],
              description: 'Channel for the check-in reminder'
            }
          },
          required: ['when']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_sms',
        description: 'Send an SMS text message to the user\'s phone',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The SMS message to send'
            }
          },
          required: ['message']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'make_voice_call',
        description: 'Initiate a voice call to the user for reminders, check-ins, or celebrations',
        parameters: {
          type: 'object',
          properties: {
            call_type: {
              type: 'string',
              enum: ['habit_reminder', 'goal_checkin', 'accountability', 'celebration', 'custom'],
              description: 'Type of call to make'
            },
            message: {
              type: 'string',
              description: 'Custom message for the call (what AMIE should say)'
            },
            related_habit_id: {
              type: 'string',
              description: 'If this is a habit reminder, the habit ID'
            },
            related_goal_id: {
              type: 'string',
              description: 'If this is a goal check-in, the goal ID'
            }
          },
          required: ['call_type']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'confirm_pending_action',
        description: 'Confirm and execute a previously proposed action after user approval',
        parameters: {
          type: 'object',
          properties: {
            action_id: {
              type: 'string',
              description: 'The ID of the pending action to confirm'
            }
          },
          required: ['action_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'cancel_pending_action',
        description: 'Cancel a previously proposed action that the user declined',
        parameters: {
          type: 'object',
          properties: {
            action_id: {
              type: 'string',
              description: 'The ID of the pending action to cancel'
            },
            reason: {
              type: 'string',
              description: 'Reason for cancellation'
            }
          },
          required: ['action_id']
        }
      }
    }
  ]
}

/**
 * Execute agent tool based on function call with guardrails
 */
async function executeAgentTool(supabase: any, userId: string, toolName: string, args: any, aiSettings?: any): Promise<any> {
  console.log(`Executing tool: ${toolName}`, args)

  // Check agentic capability guardrails
  if (aiSettings) {
    switch (toolName) {
      case 'send_email':
        if (aiSettings.allow_send_email === false) {
          return { success: false, error: 'Email sending has been disabled by team policy.' }
        }
        break
      case 'create_task':
        if (aiSettings.allow_create_tasks === false) {
          return { success: false, error: 'Task creation has been disabled by team policy.' }
        }
        break
      case 'schedule_reminder':
        if (aiSettings.allow_schedule_reminders === false) {
          return { success: false, error: 'Reminder scheduling has been disabled by team policy.' }
        }
        break
    }

    // Check if confirmation is required (log for now, could be expanded)
    if (aiSettings.require_confirmation) {
      console.log(`Action ${toolName} would require confirmation in strict mode`)
    }
  }

  switch (toolName) {
    case 'send_email': {
      const to = args?.to
      const subject = args?.subject
      const body = args?.body

      // Validate required args
      if (!to || !subject || !body) {
        return {
          success: false,
          error: `Missing required information. I need: ${!to ? 'email address, ' : ''}${!subject ? 'subject, ' : ''}${!body ? 'message body' : ''}`.replace(/, $/, '')
        }
      }

      // Check if sending to team or specific email
      if (to.toLowerCase() === 'team') {
        // Get user's team
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('team_id, teams(name)')
          .eq('user_id', userId)
          .single()

        if (!teamMember?.team_id) {
          return { success: false, error: 'You are not part of a team' }
        }

        // Create team communication
        const { data: comm, error } = await supabase
          .from('team_communications')
          .insert({
            team_id: teamMember.team_id,
            sender_id: userId,
            subject,
            body_html: body,
            body_text: body,
            template_type: 'custom',
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          return { success: false, error: error.message }
        }

        return {
          success: true,
          message: `Email sent to team: ${subject}`,
          communicationId: comm.id
        }
      } else {
        // Send individual email via send-email function
        try {
          const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
          const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

          const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({
              to,
              subject,
              template: 'generic',
              data: {
                subject,
                html: `<p>${body}</p>`,
                content: body
              }
            })
          })

          const result = await emailResponse.json()
          return {
            success: true,
            message: `Email sent to ${to}: "${subject}"`,
            result
          }
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      }
    }

    case 'create_task': {
      const title = args?.title
      const description = args?.description
      const due_date_raw = args?.due_date

      // Validate required args
      if (!title) {
        return {
          success: false,
          error: 'I need a title for the task. What should I call it?'
        }
      }

      // Parse due_date - handle relative dates like "today", "tomorrow"
      let parsedDueDate: string | null = null
      if (due_date_raw) {
        const lowerDate = due_date_raw.toLowerCase().trim()
        const now = new Date()

        if (lowerDate === 'today') {
          parsedDueDate = now.toISOString().split('T')[0]
        } else if (lowerDate === 'tomorrow') {
          const tomorrow = new Date(now)
          tomorrow.setDate(tomorrow.getDate() + 1)
          parsedDueDate = tomorrow.toISOString().split('T')[0]
        } else if (lowerDate.includes('next week')) {
          const nextWeek = new Date(now)
          nextWeek.setDate(nextWeek.getDate() + 7)
          parsedDueDate = nextWeek.toISOString().split('T')[0]
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(due_date_raw)) {
          // Already in YYYY-MM-DD format
          parsedDueDate = due_date_raw
        } else {
          // Try to parse as date
          const parsed = new Date(due_date_raw)
          if (!isNaN(parsed.getTime())) {
            parsedDueDate = parsed.toISOString().split('T')[0]
          } else {
            // Default to today if can't parse
            parsedDueDate = now.toISOString().split('T')[0]
          }
        }
      }

      // Build the insert object for action_tasks table
      const insertData: any = {
        user_id: userId,
        title,
        description: description || '',
        type: 'task',
        is_completed: false,
        created_at: new Date().toISOString()
      }

      // Only add due_date if we have one
      if (parsedDueDate) {
        insertData.due_date = parsedDueDate
      }

      console.log('[create_task] Inserting task:', JSON.stringify(insertData))

      // Create action task (using correct table name)
      const { data: task, error } = await supabase
        .from('action_tasks')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('[create_task] Error:', error.message, error.details, error.hint)
        return { success: false, error: `Failed to create task: ${error.message}` }
      }

      const dueDateDisplay = parsedDueDate || ''
      return {
        success: true,
        message: `Task created: "${title}"${dueDateDisplay ? ` due ${dueDateDisplay}` : ''}`,
        taskId: task.id
      }
    }

    case 'schedule_reminder': {
      const message = args?.message
      const when = args?.when

      // Validate required args
      if (!message || !when) {
        return {
          success: false,
          error: `I need ${!message ? 'a message for the reminder' : ''}${!message && !when ? ' and ' : ''}${!when ? 'when to send it' : ''}`
        }
      }

      // Parse the "when" into a timestamp
      const scheduledFor = parseReminderTime(when)

      // Create scheduled notification - use action_tasks as fallback if scheduled_checkins doesn't exist
      try {
        const { data: reminder, error } = await supabase
          .from('scheduled_checkins')
          .insert({
            user_id: userId,
            checkin_type: 'custom',
            scheduled_for: scheduledFor.toISOString(),
            channel: 'push',
            status: 'pending',
            content: { message }
          })
          .select()
          .single()

        if (error) {
          // If table doesn't exist, create as a task instead
          if (error.message.includes('does not exist') || error.code === '42P01') {
            const { data: task, error: taskError } = await supabase
              .from('action_tasks')
              .insert({
                user_id: userId,
                title: `Reminder: ${message}`,
                description: `Scheduled reminder for ${scheduledFor.toLocaleString()}`,
                due_date: scheduledFor.toISOString().split('T')[0],
                type: 'reminder',
                is_completed: false,
                created_at: new Date().toISOString()
              })
              .select()
              .single()

            if (taskError) {
              return { success: false, error: taskError.message }
            }

            return {
              success: true,
              message: `Reminder created as task for ${scheduledFor.toLocaleString()}: "${message}"`,
              taskId: task.id
            }
          }
          return { success: false, error: error.message }
        }

        return {
          success: true,
          message: `Reminder scheduled for ${scheduledFor.toLocaleString()}: "${message}"`,
          reminderId: reminder.id
        }
      } catch (err: any) {
        // Fallback: create as task
        const { data: task, error: taskError } = await supabase
          .from('action_tasks')
          .insert({
            user_id: userId,
            title: `Reminder: ${message}`,
            description: `Scheduled reminder for ${scheduledFor.toLocaleString()}`,
            due_date: scheduledFor.toISOString().split('T')[0],
            type: 'reminder',
            is_completed: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (taskError) {
          return { success: false, error: taskError.message }
        }

        return {
          success: true,
          message: `Reminder saved as task for ${scheduledFor.toLocaleString()}: "${message}"`,
          taskId: task.id
        }
      }
    }

    case 'get_user_data': {
      const data_type = args?.data_type

      if (!data_type) {
        return {
          success: false,
          error: 'I need to know what data you want to see. Options are: goals, habits, tasks, progress, or vision.'
        }
      }

      switch (data_type) {
        case 'goals': {
          const { data: goals } = await supabase
            .from('milestones')
            .select('id, title, target_date, completion_percentage')
            .eq('user_id', userId)
            .order('target_date', { ascending: true })
            .limit(5)

          return {
            success: true,
            data: goals || [],
            summary: goals?.length
              ? `Found ${goals.length} goals: ${goals.map((g: any) => g.title).join(', ')}`
              : 'No goals found'
          }
        }

        case 'habits': {
          const { data: habits } = await supabase
            .from('habits')
            .select('id, title, current_streak, is_active')
            .eq('user_id', userId)
            .eq('is_active', true)

          return {
            success: true,
            data: habits || [],
            summary: habits?.length
              ? `Found ${habits.length} active habits: ${habits.map((h: any) => `${h.title} (${h.current_streak} day streak)`).join(', ')}`
              : 'No active habits found'
          }
        }

        case 'tasks': {
          const { data: tasks } = await supabase
            .from('action_tasks')
            .select('id, title, is_completed, due_date, type')
            .eq('user_id', userId)
            .eq('is_completed', false)
            .order('due_date', { ascending: true })
            .limit(10)

          return {
            success: true,
            data: tasks || [],
            summary: tasks?.length
              ? `Found ${tasks.length} pending tasks: ${tasks.map((t: any) => t.title).join(', ')}`
              : 'No pending tasks'
          }
        }

        case 'vision': {
          const { data: vision } = await supabase
            .from('vision_boards')
            .select('id, prompt, image_url, is_favorite, created_at')
            .eq('user_id', userId)
            .eq('is_favorite', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          return {
            success: true,
            data: vision || null,
            summary: vision
              ? `Your vision board: "${vision.prompt}" (created ${new Date(vision.created_at).toLocaleDateString()})`
              : 'No vision board set yet'
          }
        }

        case 'progress': {
          // Get overall progress stats
          const { data: habits } = await supabase
            .from('habits')
            .select('current_streak')
            .eq('user_id', userId)
            .eq('is_active', true)

          const { data: tasks } = await supabase
            .from('action_tasks')
            .select('is_completed')
            .eq('user_id', userId)

          const completedTasks = tasks?.filter((t: any) => t.is_completed === true).length || 0
          const totalTasks = tasks?.length || 0
          const avgStreak = habits?.length
            ? Math.round(habits.reduce((sum: number, h: any) => sum + (h.current_streak || 0), 0) / habits.length)
            : 0

          return {
            success: true,
            data: {
              completedTasks,
              totalTasks,
              taskCompletionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
              averageHabitStreak: avgStreak,
              activeHabits: habits?.length || 0
            },
            summary: `You've completed ${completedTasks} of ${totalTasks} tasks (${totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0}%). Average habit streak: ${avgStreak} days.`
          }
        }

        default:
          return { success: false, error: `Unknown data type: ${data_type}` }
      }
    }

    case 'get_todays_habits': {
      // Get today's day of week (0 = Sunday, 1 = Monday, etc.)
      const today = new Date()
      const dayOfWeek = today.getDay()
      const todayStr = today.toISOString().split('T')[0]

      // Get all active habits
      const { data: habits, error } = await supabase
        .from('habits')
        .select('id, title, description, frequency, custom_days, reminder_time, current_streak')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) {
        return { success: false, error: error.message }
      }

      // Filter habits scheduled for today
      const todaysHabits = (habits || []).filter((h: any) => {
        if (h.frequency === 'daily') return true
        if (h.frequency === 'weekly') {
          // Check if today matches any custom_days
          return h.custom_days?.includes(dayOfWeek)
        }
        return true // Include all if frequency not set
      })

      // Check completion status for each habit
      const habitIds = todaysHabits.map((h: any) => h.id)
      const { data: completions } = await supabase
        .from('habit_completions')
        .select('habit_id')
        .in('habit_id', habitIds)
        .gte('completed_at', todayStr)

      const completedIds = new Set((completions || []).map((c: any) => c.habit_id))

      const habitsWithStatus = todaysHabits.map((h: any) => ({
        ...h,
        completed_today: completedIds.has(h.id)
      }))

      const completedCount = habitsWithStatus.filter((h: any) => h.completed_today).length
      const pendingCount = habitsWithStatus.length - completedCount

      return {
        success: true,
        data: habitsWithStatus,
        summary: habitsWithStatus.length > 0
          ? `You have ${habitsWithStatus.length} habits for today: ${completedCount} completed, ${pendingCount} remaining. ${habitsWithStatus.filter((h: any) => !h.completed_today).map((h: any) => h.title).join(', ')}`
          : 'No habits scheduled for today'
      }
    }

    case 'mark_habit_complete': {
      const habit_id = args?.habit_id
      const habit_name = args?.habit_name
      const notes = args?.notes

      // Find habit by ID or name
      let habit: any
      if (habit_id) {
        const { data } = await supabase
          .from('habits')
          .select('id, title, current_streak')
          .eq('id', habit_id)
          .eq('user_id', userId)
          .single()
        habit = data
      } else if (habit_name) {
        const { data } = await supabase
          .from('habits')
          .select('id, title, current_streak')
          .eq('user_id', userId)
          .ilike('title', `%${habit_name}%`)
          .single()
        habit = data
      }

      if (!habit) {
        return {
          success: false,
          error: 'Habit not found. Please specify the habit name or ID.'
        }
      }

      // Check if already completed today
      const todayStr = new Date().toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('habit_completions')
        .select('id')
        .eq('habit_id', habit.id)
        .gte('completed_at', todayStr)
        .single()

      if (existing) {
        return {
          success: true,
          message: `"${habit.title}" was already marked complete today! Current streak: ${habit.current_streak} days.`,
          alreadyCompleted: true
        }
      }

      // Create completion record
      const { error } = await supabase
        .from('habit_completions')
        .insert({
          habit_id: habit.id,
          completed_at: new Date().toISOString(),
          notes: notes || null
        })

      if (error) {
        return { success: false, error: error.message }
      }

      // Update streak (increment by 1)
      const newStreak = (habit.current_streak || 0) + 1
      await supabase
        .from('habits')
        .update({ current_streak: newStreak })
        .eq('id', habit.id)

      // Log to agent action history
      await supabase.from('agent_action_history').insert({
        user_id: userId,
        action_type: 'mark_habit_complete',
        action_status: 'executed',
        action_payload: { habit_id: habit.id, habit_name: habit.title, notes },
        trigger_context: 'conversation',
        related_habit_id: habit.id,
        executed_at: new Date().toISOString()
      })

      return {
        success: true,
        message: `Great job! "${habit.title}" marked complete. Your streak is now ${newStreak} days!`,
        habitId: habit.id,
        newStreak
      }
    }

    case 'send_habit_reminder': {
      const habit_id = args?.habit_id
      const habit_name = args?.habit_name
      const channel = args?.channel || 'push'
      const message = args?.message

      // Find habit
      let habit: any
      if (habit_id) {
        const { data } = await supabase
          .from('habits')
          .select('id, title, reminder_time')
          .eq('id', habit_id)
          .eq('user_id', userId)
          .single()
        habit = data
      } else if (habit_name) {
        const { data } = await supabase
          .from('habits')
          .select('id, title, reminder_time')
          .eq('user_id', userId)
          .ilike('title', `%${habit_name}%`)
          .single()
        habit = data
      }

      if (!habit) {
        return {
          success: false,
          error: 'Habit not found. Please specify the habit name or ID.'
        }
      }

      const reminderMessage = message || `Don't forget your habit: ${habit.title}!`

      // Create scheduled reminder
      const { data: reminder, error } = await supabase
        .from('scheduled_habit_reminders')
        .insert({
          user_id: userId,
          habit_id: habit.id,
          scheduled_for: new Date().toISOString(),
          reminder_channel: channel,
          habit_name: habit.title,
          reminder_message: reminderMessage,
          status: 'scheduled'
        })
        .select()
        .single()

      if (error) {
        // Fallback if table doesn't exist yet
        return {
          success: true,
          message: `Habit reminder for "${habit.title}" has been noted. The reminder system will be fully operational soon.`,
          habitId: habit.id
        }
      }

      return {
        success: true,
        message: `Reminder set for "${habit.title}" via ${channel}: "${reminderMessage}"`,
        reminderId: reminder?.id,
        habitId: habit.id
      }
    }

    case 'update_goal_progress': {
      const goal_id = args?.goal_id
      const goal_name = args?.goal_name
      const progress = args?.progress
      const notes = args?.notes

      if (progress === undefined || progress === null) {
        return {
          success: false,
          error: 'Please specify the progress percentage (0-100).'
        }
      }

      // Find goal (milestone)
      let goal: any
      if (goal_id) {
        const { data } = await supabase
          .from('milestones')
          .select('id, title, completion_percentage')
          .eq('id', goal_id)
          .eq('user_id', userId)
          .single()
        goal = data
      } else if (goal_name) {
        const { data } = await supabase
          .from('milestones')
          .select('id, title, completion_percentage')
          .eq('user_id', userId)
          .ilike('title', `%${goal_name}%`)
          .single()
        goal = data
      } else {
        // Get the most recent active goal
        const { data } = await supabase
          .from('milestones')
          .select('id, title, completion_percentage')
          .eq('user_id', userId)
          .lt('completion_percentage', 100)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        goal = data
      }

      if (!goal) {
        return {
          success: false,
          error: 'Goal not found. Please specify the goal name or ID.'
        }
      }

      const oldProgress = goal.completion_percentage || 0
      const newProgress = Math.min(100, Math.max(0, progress))

      // Update the goal
      const { error } = await supabase
        .from('milestones')
        .update({
          completion_percentage: newProgress,
          updated_at: new Date().toISOString()
        })
        .eq('id', goal.id)

      if (error) {
        return { success: false, error: error.message }
      }

      // Log to agent action history
      await supabase.from('agent_action_history').insert({
        user_id: userId,
        action_type: 'update_goal_progress',
        action_status: 'executed',
        action_payload: { goal_id: goal.id, goal_name: goal.title, old_progress: oldProgress, new_progress: newProgress, notes },
        trigger_context: 'conversation',
        related_goal_id: goal.id,
        executed_at: new Date().toISOString()
      })

      const progressDiff = newProgress - oldProgress
      const direction = progressDiff > 0 ? 'up' : progressDiff < 0 ? 'down' : 'unchanged'

      return {
        success: true,
        message: newProgress === 100
          ? `Congratulations! "${goal.title}" is now complete at 100%!`
          : `Updated "${goal.title}" progress from ${oldProgress}% to ${newProgress}% (${direction === 'up' ? '+' : ''}${progressDiff}%)`,
        goalId: goal.id,
        oldProgress,
        newProgress
      }
    }

    case 'schedule_goal_checkin': {
      const goal_id = args?.goal_id
      const goal_name = args?.goal_name
      const when = args?.when
      const channel = args?.channel || 'push'

      if (!when) {
        return {
          success: false,
          error: 'Please specify when you want the check-in scheduled.'
        }
      }

      // Find goal
      let goal: any
      if (goal_id) {
        const { data } = await supabase
          .from('milestones')
          .select('id, title, completion_percentage')
          .eq('id', goal_id)
          .eq('user_id', userId)
          .single()
        goal = data
      } else if (goal_name) {
        const { data } = await supabase
          .from('milestones')
          .select('id, title, completion_percentage')
          .eq('user_id', userId)
          .ilike('title', `%${goal_name}%`)
          .single()
        goal = data
      } else {
        // Get the most recent active goal
        const { data } = await supabase
          .from('milestones')
          .select('id, title, completion_percentage')
          .eq('user_id', userId)
          .lt('completion_percentage', 100)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        goal = data
      }

      if (!goal) {
        return {
          success: false,
          error: 'Goal not found. Please specify the goal name or create a goal first.'
        }
      }

      const scheduledFor = parseReminderTime(when)

      // Create scheduled check-in
      const { data: checkin, error } = await supabase
        .from('scheduled_goal_checkins')
        .insert({
          user_id: userId,
          goal_id: goal.id,
          scheduled_for: scheduledFor.toISOString(),
          checkin_channel: channel,
          goal_title: goal.title,
          current_progress: goal.completion_percentage,
          status: 'scheduled'
        })
        .select()
        .single()

      if (error) {
        // Fallback: create as reminder task
        const { data: task, error: taskError } = await supabase
          .from('action_tasks')
          .insert({
            user_id: userId,
            title: `Goal Check-in: ${goal.title}`,
            description: `Scheduled check-in for your goal "${goal.title}" (currently at ${goal.completion_percentage}%)`,
            due_date: scheduledFor.toISOString().split('T')[0],
            type: 'checkin',
            is_completed: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (taskError) {
          return { success: false, error: taskError.message }
        }

        return {
          success: true,
          message: `Goal check-in scheduled for ${scheduledFor.toLocaleString()}: "${goal.title}" (saved as task)`,
          taskId: task.id,
          goalId: goal.id
        }
      }

      return {
        success: true,
        message: `Goal check-in scheduled for ${scheduledFor.toLocaleString()}: "${goal.title}" via ${channel}`,
        checkinId: checkin?.id,
        goalId: goal.id
      }
    }

    case 'send_sms': {
      const message = args?.message

      if (!message) {
        return {
          success: false,
          error: 'I need a message to send. What would you like the SMS to say?'
        }
      }

      // Check if SMS is allowed
      if (aiSettings?.allow_send_sms === false) {
        return { success: false, error: 'SMS sending has been disabled by team policy.' }
      }

      // Get user's phone number from comm preferences
      const { data: commPrefs } = await supabase
        .from('user_comm_preferences')
        .select('phone_number, phone_verified')
        .eq('user_id', userId)
        .single()

      if (!commPrefs?.phone_number) {
        return {
          success: false,
          error: 'No phone number found. Please add your phone number in Settings > Notifications.'
        }
      }

      // Check user's agent settings for SMS permission
      const { data: agentSettings } = await supabase
        .from('user_agent_settings')
        .select('allow_send_sms, require_confirmation_sms')
        .eq('user_id', userId)
        .single()

      if (agentSettings && agentSettings.allow_send_sms === false) {
        return {
          success: false,
          error: 'SMS sending is disabled in your agent settings. Enable it in Settings > AI Agent to allow SMS.'
        }
      }

      // Call the SMS edge function
      try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        const smsResponse = await fetch(`${SUPABASE_URL}/functions/v1/agent-send-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            user_id: userId,
            phone_number: commPrefs.phone_number,
            message
          })
        })

        const result = await smsResponse.json()

        if (!result.success) {
          return { success: false, error: result.error || 'Failed to send SMS' }
        }

        // Log to agent action history
        await supabase.from('agent_action_history').insert({
          user_id: userId,
          action_type: 'send_sms',
          action_status: 'executed',
          action_payload: { phone_number: commPrefs.phone_number, message },
          trigger_context: 'conversation',
          executed_at: new Date().toISOString()
        })

        return {
          success: true,
          message: `SMS sent to your phone: "${message}"`,
          result
        }
      } catch (err: any) {
        return { success: false, error: `Failed to send SMS: ${err.message}` }
      }
    }

    case 'make_voice_call': {
      const call_type = args?.call_type
      const message = args?.message
      const related_habit_id = args?.related_habit_id
      const related_goal_id = args?.related_goal_id

      if (!call_type) {
        return {
          success: false,
          error: 'I need to know what type of call to make. Options: habit_reminder, goal_checkin, accountability, celebration, or custom.'
        }
      }

      // Check if voice calls are allowed
      if (aiSettings?.allow_voice_calls === false) {
        return { success: false, error: 'Voice calls have been disabled by team policy.' }
      }

      // Get user's phone number
      const { data: commPrefs } = await supabase
        .from('user_comm_preferences')
        .select('phone_number, phone_verified')
        .eq('user_id', userId)
        .single()

      if (!commPrefs?.phone_number) {
        return {
          success: false,
          error: 'No phone number found. Please add your phone number in Settings > Notifications to receive voice calls.'
        }
      }

      // Check user's agent settings for voice call permission
      const { data: userAgentSettings } = await supabase
        .from('user_agent_settings')
        .select('allow_voice_calls, require_confirmation_voice_calls, confidence_threshold')
        .eq('user_id', userId)
        .single()

      if (userAgentSettings?.allow_voice_calls === false) {
        return {
          success: false,
          error: 'Voice calls are disabled in your agent settings. Enable it in Settings > AI Agent.'
        }
      }

      // Determine risk level and if confirmation is required
      const riskLevel = 'high' // Voice calls are high risk by default
      const requiresConfirmation = userAgentSettings?.require_confirmation_voice_calls !== false

      // Generate call message if not provided
      let callMessage = message
      if (!callMessage) {
        switch (call_type) {
          case 'habit_reminder':
            callMessage = 'Hi! This is AMIE, your AI coach. Just a friendly reminder about your habit. Keep up the great work!'
            break
          case 'goal_checkin':
            callMessage = 'Hi! This is AMIE. I wanted to check in on your progress. How are you doing with your goals?'
            break
          case 'accountability':
            callMessage = 'Hi! This is AMIE. Just checking in to help you stay on track. Let\'s keep that momentum going!'
            break
          case 'celebration':
            callMessage = 'Hi! This is AMIE. I wanted to celebrate your amazing progress with you! You\'re doing fantastic!'
            break
          default:
            callMessage = 'Hi! This is AMIE, your AI coach. I\'m here to support you on your journey.'
        }
      }

      if (requiresConfirmation) {
        // Create pending action for user confirmation
        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + 30) // 30 min expiry

        const { data: pendingAction, error: pendingError } = await supabase
          .from('pending_agent_actions')
          .insert({
            user_id: userId,
            action_type: 'make_voice_call',
            action_payload: {
              call_type,
              message: callMessage,
              phone_number: commPrefs.phone_number,
              related_habit_id,
              related_goal_id
            },
            status: 'pending',
            risk_level: riskLevel,
            expires_at: expiresAt.toISOString(),
            proposed_at: new Date().toISOString()
          })
          .select()
          .single()

        if (pendingError) {
          console.error('Failed to create pending action:', pendingError)
          // Fall through to direct execution if table doesn't exist
        } else {
          return {
            success: true,
            requiresConfirmation: true,
            pendingActionId: pendingAction.id,
            message: `I'd like to make a ${call_type.replace(/_/g, ' ')} call to you. The message would be: "${callMessage}". Do you want me to proceed with the call?`,
            proposedAction: {
              type: 'make_voice_call',
              callType: call_type,
              message: callMessage
            }
          }
        }
      }

      // Execute the voice call directly
      try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        const callResponse = await fetch(`${SUPABASE_URL}/functions/v1/agent-voice-call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            user_id: userId,
            phone_number: commPrefs.phone_number,
            call_type,
            message: callMessage,
            related_habit_id,
            related_goal_id
          })
        })

        const result = await callResponse.json()

        if (!result.success) {
          return { success: false, error: result.error || 'Failed to initiate voice call' }
        }

        // Log to agent action history
        await supabase.from('agent_action_history').insert({
          user_id: userId,
          action_type: 'make_voice_call',
          action_status: 'executed',
          action_payload: { call_type, message: callMessage, related_habit_id, related_goal_id },
          trigger_context: 'conversation',
          related_habit_id,
          related_goal_id,
          executed_at: new Date().toISOString()
        })

        return {
          success: true,
          message: `Voice call initiated! You should receive a ${call_type.replace(/_/g, ' ')} call shortly.`,
          result
        }
      } catch (err: any) {
        return { success: false, error: `Failed to initiate voice call: ${err.message}` }
      }
    }

    case 'confirm_pending_action': {
      const action_id = args?.action_id

      if (!action_id) {
        return {
          success: false,
          error: 'I need to know which action to confirm. Please provide the action ID.'
        }
      }

      // Get the pending action
      const { data: pendingAction, error: fetchError } = await supabase
        .from('pending_agent_actions')
        .select('*')
        .eq('id', action_id)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .single()

      if (fetchError || !pendingAction) {
        return {
          success: false,
          error: 'Pending action not found or already processed.'
        }
      }

      // Check if action has expired
      if (new Date(pendingAction.expires_at) < new Date()) {
        await supabase
          .from('pending_agent_actions')
          .update({ status: 'expired' })
          .eq('id', action_id)

        return {
          success: false,
          error: 'This action has expired. Please request the action again.'
        }
      }

      // Mark as confirmed
      await supabase
        .from('pending_agent_actions')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', action_id)

      // Execute the confirmed action
      const actionType = pendingAction.action_type
      const actionPayload = pendingAction.action_payload

      let executionResult: any

      try {
        // Re-execute the action without confirmation check
        switch (actionType) {
          case 'make_voice_call': {
            const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
            const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

            const callResponse = await fetch(`${SUPABASE_URL}/functions/v1/agent-voice-call`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({
                user_id: userId,
                phone_number: actionPayload.phone_number,
                call_type: actionPayload.call_type,
                message: actionPayload.message,
                related_habit_id: actionPayload.related_habit_id,
                related_goal_id: actionPayload.related_goal_id
              })
            })

            executionResult = await callResponse.json()
            break
          }

          case 'send_email':
          case 'send_sms':
          case 'create_calendar_event':
            // Execute the original action type
            executionResult = await executeAgentTool(
              supabase,
              userId,
              actionType,
              actionPayload,
              { ...aiSettings, require_confirmation: false } // Skip confirmation loop
            )
            break

          default:
            executionResult = { success: false, error: `Unknown action type: ${actionType}` }
        }

        // Update pending action with execution result
        await supabase
          .from('pending_agent_actions')
          .update({
            status: executionResult.success ? 'executed' : 'failed',
            executed_at: new Date().toISOString(),
            execution_result: executionResult
          })
          .eq('id', action_id)

        // Log to agent action history
        await supabase.from('agent_action_history').insert({
          user_id: userId,
          action_type: actionType,
          action_status: executionResult.success ? 'executed' : 'failed',
          action_payload: actionPayload,
          trigger_context: 'confirmation',
          executed_at: new Date().toISOString()
        })

        return {
          success: executionResult.success,
          message: executionResult.success
            ? `Action confirmed and executed: ${actionType.replace(/_/g, ' ')}`
            : `Action confirmed but execution failed: ${executionResult.error}`,
          executionResult
        }
      } catch (err: any) {
        await supabase
          .from('pending_agent_actions')
          .update({
            status: 'failed',
            execution_result: { error: err.message }
          })
          .eq('id', action_id)

        return {
          success: false,
          error: `Failed to execute confirmed action: ${err.message}`
        }
      }
    }

    case 'cancel_pending_action': {
      const action_id = args?.action_id
      const reason = args?.reason

      if (!action_id) {
        return {
          success: false,
          error: 'I need to know which action to cancel. Please provide the action ID.'
        }
      }

      // Get the pending action
      const { data: pendingAction, error: fetchError } = await supabase
        .from('pending_agent_actions')
        .select('*')
        .eq('id', action_id)
        .eq('user_id', userId)
        .single()

      if (fetchError || !pendingAction) {
        return {
          success: false,
          error: 'Pending action not found.'
        }
      }

      if (pendingAction.status !== 'pending') {
        return {
          success: false,
          error: `Cannot cancel action. Current status: ${pendingAction.status}`
        }
      }

      // Update to cancelled status
      const { error: updateError } = await supabase
        .from('pending_agent_actions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'User declined'
        })
        .eq('id', action_id)

      if (updateError) {
        return {
          success: false,
          error: `Failed to cancel action: ${updateError.message}`
        }
      }

      // Log to agent action history
      await supabase.from('agent_action_history').insert({
        user_id: userId,
        action_type: pendingAction.action_type,
        action_status: 'cancelled',
        action_payload: pendingAction.action_payload,
        trigger_context: 'cancellation',
        executed_at: new Date().toISOString()
      })

      return {
        success: true,
        message: `Action cancelled: ${pendingAction.action_type.replace(/_/g, ' ')}${reason ? `. Reason: ${reason}` : ''}`
      }
    }

    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}

/**
 * Parse reminder time string to Date
 */
function parseReminderTime(when: string): Date {
  const now = new Date()
  const lowerWhen = when.toLowerCase()

  // Handle relative times
  if (lowerWhen.includes('hour')) {
    const hours = parseInt(lowerWhen.match(/(\d+)/)?.[1] || '1')
    return new Date(now.getTime() + hours * 60 * 60 * 1000)
  }
  if (lowerWhen.includes('minute')) {
    const minutes = parseInt(lowerWhen.match(/(\d+)/)?.[1] || '30')
    return new Date(now.getTime() + minutes * 60 * 1000)
  }
  if (lowerWhen.includes('tomorrow')) {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (lowerWhen.includes('9am') || lowerWhen.includes('9 am')) {
      tomorrow.setHours(9, 0, 0, 0)
    } else if (lowerWhen.includes('noon')) {
      tomorrow.setHours(12, 0, 0, 0)
    } else {
      tomorrow.setHours(9, 0, 0, 0) // Default to 9am
    }
    return tomorrow
  }

  // Try to parse as ISO date
  const parsed = new Date(when)
  if (!isNaN(parsed.getTime())) {
    return parsed
  }

  // Default to 1 hour from now
  return new Date(now.getTime() + 60 * 60 * 1000)
}

/**
 * Generate fallback response without AI
 */
function generateFallbackResponse(sessionType: string, theme: any): string {
  const responses: Record<string, string[]> = {
    morning_routine: [
      "That sounds like a great way to start your day. What's your first priority?",
      "I hear you. What would make today feel successful for you?",
      "Good intention! How can you make that happen today?"
    ],
    check_in: [
      "Thank you for sharing that. Tell me more about how you're feeling.",
      "I appreciate you opening up. What would help right now?",
      "That makes sense. What's one thing you could do to feel better?"
    ],
    reflection: [
      "That's an interesting insight. What does that teach you?",
      "I can see you're thinking deeply. What patterns do you notice?",
      "Reflection like this is powerful. What would you do differently?"
    ],
    goal_setting: [
      "That's an exciting goal! What's the first step you could take?",
      "I love that ambition. How will you know when you've achieved it?",
      "Great vision! What might get in your way, and how will you handle it?"
    ],
    celebration: [
      "That's wonderful! You should be proud of yourself!",
      "What an achievement! How does it feel to have accomplished that?",
      "Amazing work! What made the difference in reaching this milestone?"
    ],
    accountability: [
      "Thanks for the update. What's working well for you?",
      "Progress is progress! What adjustments would help?",
      "I appreciate your honesty. What support do you need?"
    ],
    crisis_support: [
      "I hear you, and that sounds really difficult. You're not alone in this.",
      "Thank you for trusting me with this. What would help you feel even a little better?",
      "Your feelings are valid. Let's take this one step at a time."
    ]
  }

  const typeResponses = responses[sessionType] || responses.check_in
  return typeResponses[Math.floor(Math.random() * typeResponses.length)]
}

/**
 * Simple sentiment analysis
 */
function analyzeSentiment(text: string): number {
  const positiveWords = ['happy', 'great', 'amazing', 'wonderful', 'excited', 'love', 'grateful', 'proud', 'accomplished', 'good', 'better', 'progress', 'win', 'success']
  const negativeWords = ['sad', 'angry', 'frustrated', 'anxious', 'worried', 'stressed', 'overwhelmed', 'tired', 'stuck', 'bad', 'worse', 'fail', 'lost', 'confused']

  const words = text.toLowerCase().split(/\s+/)
  let score = 0.5

  for (const word of words) {
    if (positiveWords.some(pw => word.includes(pw))) score += 0.1
    if (negativeWords.some(nw => word.includes(nw))) score -= 0.1
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although', 'though', 'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'him', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'im', 'ive', 'dont', 'didnt', 'wont', 'cant', 'couldnt', 'shouldnt', 'wouldnt', 'isnt', 'arent', 'wasnt', 'werent', 'havent', 'hasnt', 'hadnt', 'doesnt', 'didnt', 'really', 'like', 'think', 'know', 'want', 'going', 'get', 'got', 'make', 'made', 'see', 'feel', 'feeling'])

  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))

  // Count word frequency
  const wordCounts: Record<string, number> = {}
  for (const word of words) {
    wordCounts[word] = (wordCounts[word] || 0) + 1
  }

  // Sort by frequency and return top 5
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
}
