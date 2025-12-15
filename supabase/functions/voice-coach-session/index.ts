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

  // Generate AI response
  let aiResponse = ''
  let sentiment = 0.5

  if (openaiKey) {
    try {
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 300,
          temperature: 0.7
        })
      })

      const result = await completion.json()
      aiResponse = result.choices?.[0]?.message?.content || ''

      // Simple sentiment analysis based on keywords
      sentiment = analyzeSentiment(transcript)
    } catch (err) {
      console.error('OpenAI error:', err)
      aiResponse = generateFallbackResponse(session.session_type, theme)
    }
  } else {
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

  // Extract key topics and action items
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

Respond in JSON format:
{
  "keyTopics": ["topic1", "topic2"],
  "actionItems": ["action1", "action2"],
  "summary": "Brief summary here"
}`

      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: summaryPrompt }],
          max_tokens: 500,
          temperature: 0.3
        })
      })

      const result = await completion.json()
      const content = result.choices?.[0]?.message?.content || ''

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

  return `You are ${themeName}, an AI voice coach with a ${voiceStyle} communication style.

Your role: ${sessionContext[sessionType] || sessionContext.check_in}

Communication guidelines:
- Keep responses concise and conversational (2-4 sentences max)
- Speak naturally as if in a voice conversation
- Be warm, encouraging, and authentic
- Ask one question at a time
- Acknowledge emotions before offering advice
- Use the user's name if known
- Avoid bullet points or lists - speak in flowing sentences

${personalityContext ? `User context: ${personalityContext}` : ''}

${theme?.encouragement_phrases ? `When encouraging, consider phrases like: ${theme.encouragement_phrases.join(', ')}` : ''}

Remember: This is a voice conversation. Keep it natural and human.`
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
