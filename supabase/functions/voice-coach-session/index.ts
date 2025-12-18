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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

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
        return await processTranscript(supabase, userId, body, GEMINI_API_KEY)
      case 'end':
        return await endSession(supabase, userId, body, GEMINI_API_KEY)
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
async function processTranscript(supabase: any, userId: string, body: any, geminiKey: string) {
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

  // Generate AI response using Gemini with tools
  let aiResponse = ''
  let sentiment = 0.5
  let actionsPerformed: any[] = []

  console.log(`[Voice Coach] Processing transcript. GEMINI_API_KEY present: ${!!geminiKey}, key length: ${geminiKey?.length || 0}`)

  if (geminiKey) {
    try {
      // Convert messages to Gemini format
      const geminiContents = messages.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : msg.role === 'system' ? 'user' : 'user',
        parts: [{ text: msg.role === 'system' ? `[System Instructions]: ${msg.content}` : msg.content }]
      }))

      console.log('[Voice Coach] Calling Gemini API with', geminiContents.length, 'messages')

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: geminiContents,
            tools: getGeminiTools(),
            generationConfig: {
              maxOutputTokens: 500,
              temperature: 0.7
            }
          })
        }
      )

      const result = await geminiResponse.json()
      console.log('[Voice Coach] Gemini response status:', geminiResponse.status)
      console.log('[Voice Coach] Gemini result:', JSON.stringify(result, null, 2))

      // Check for API errors
      if (result.error) {
        console.error('[Voice Coach] Gemini API error:', result.error)
        throw new Error(result.error.message || 'Gemini API error')
      }

      const candidate = result.candidates?.[0]
      const parts = candidate?.content?.parts || []

      // Check if Gemini wants to call a function
      for (const part of parts) {
        if (part.functionCall) {
          console.log('Function call detected:', part.functionCall)
          const name = part.functionCall?.name
          const args = part.functionCall?.args || {}

          // Validate function call has required data
          if (!name) {
            console.error('Function call missing name:', part.functionCall)
            aiResponse = "I understood you want me to take an action, but I couldn't determine what to do. Could you please clarify?"
            continue
          }

          // Execute the tool with guardrails - wrapped in try-catch
          let toolResult
          try {
            toolResult = await executeAgentTool(supabase, userId, name, args, aiSettings)
            actionsPerformed.push({ tool: name, args, result: toolResult })
          } catch (toolError: any) {
            console.error('Tool execution error:', toolError)
            toolResult = { success: false, error: toolError.message || 'Tool execution failed' }
          }

          // Get Gemini to respond based on tool result
          try {
            const followUpContents = [
              ...geminiContents,
              {
                role: 'model',
                parts: [{ functionCall: part.functionCall }]
              },
              {
                role: 'function',
                parts: [{
                  functionResponse: {
                    name: name,
                    response: toolResult
                  }
                }]
              }
            ]

            const followUpResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: followUpContents,
                  generationConfig: {
                    maxOutputTokens: 300,
                    temperature: 0.7
                  }
                })
              }
            )

            const followUpResult = await followUpResponse.json()
            aiResponse = followUpResult.candidates?.[0]?.content?.parts?.[0]?.text ||
              (toolResult.success ? `Done! I've ${name.replace(/_/g, ' ')} for you.` : `I tried to ${name.replace(/_/g, ' ')}, but encountered an issue: ${toolResult.error || 'Unknown error'}`)
          } catch (followUpError: any) {
            console.error('Follow-up Gemini error:', followUpError)
            // Generate response based on tool result
            aiResponse = toolResult.success
              ? `Done! I've ${name.replace(/_/g, ' ')} for you. ${toolResult.message || ''}`
              : `I tried to ${name.replace(/_/g, ' ')}, but encountered an issue: ${toolResult.error || 'Please try again.'}`
          }
        } else if (part.text) {
          aiResponse = part.text
        }
      }

      if (!aiResponse) {
        aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
      }

      // Simple sentiment analysis based on keywords
      sentiment = analyzeSentiment(transcript)
    } catch (err: any) {
      console.error('[Voice Coach] Gemini error:', err?.message || err)
      console.error('[Voice Coach] Full error:', JSON.stringify(err, null, 2))
      aiResponse = generateFallbackResponse(session.session_type, theme)
      console.log('[Voice Coach] Using fallback response due to Gemini error')
    }
  } else {
    console.warn('[Voice Coach] GEMINI_API_KEY not available, using fallback response')
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
async function endSession(supabase: any, userId: string, body: any, geminiKey: string) {
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

  if (geminiKey && userMessages.length > 0) {
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

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
            generationConfig: {
              maxOutputTokens: 500,
              temperature: 0.3
            }
          })
        }
      )

      const result = await geminiResponse.json()
      let content = result.candidates?.[0]?.content?.parts?.[0]?.text || ''

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
 * Get Gemini tools definition for agentic capabilities
 */
function getGeminiTools() {
  return [
    {
      functionDeclarations: [
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
      ]
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
      const due_date = args?.due_date
      const priority = args?.priority

      // Validate required args
      if (!title) {
        return {
          success: false,
          error: 'I need a title for the task. What should I call it?'
        }
      }

      // Get user's primary vision to associate task
      const { data: vision } = await supabase
        .from('visions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single()

      const visionId = vision?.id

      // Create action step (task)
      const { data: task, error } = await supabase
        .from('action_steps')
        .insert({
          user_id: userId,
          vision_id: visionId,
          title,
          description: description || '',
          due_date: due_date || null,
          priority: priority || 'medium',
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return {
        success: true,
        message: `Task created: "${title}"${due_date ? ` due ${due_date}` : ''}`,
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

      // Create scheduled notification - use action_steps as fallback if scheduled_checkins doesn't exist
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
              .from('action_steps')
              .insert({
                user_id: userId,
                title: `Reminder: ${message}`,
                description: `Scheduled reminder for ${scheduledFor.toLocaleString()}`,
                due_date: scheduledFor.toISOString().split('T')[0],
                priority: 'medium',
                status: 'pending'
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
          .from('action_steps')
          .insert({
            user_id: userId,
            title: `Reminder: ${message}`,
            description: `Scheduled reminder for ${scheduledFor.toLocaleString()}`,
            due_date: scheduledFor.toISOString().split('T')[0],
            priority: 'medium',
            status: 'pending'
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
            .from('action_steps')
            .select('id, title, status, due_date')
            .eq('user_id', userId)
            .in('status', ['pending', 'in_progress'])
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
            .from('visions')
            .select('id, title, description, dream_location, target_date')
            .eq('user_id', userId)
            .eq('is_primary', true)
            .single()

          return {
            success: true,
            data: vision || null,
            summary: vision
              ? `Your vision: "${vision.title}" - ${vision.description || vision.dream_location || 'Your dream retirement'}`
              : 'No vision set yet'
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
            .from('action_steps')
            .select('status')
            .eq('user_id', userId)

          const completedTasks = tasks?.filter((t: any) => t.status === 'completed').length || 0
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
