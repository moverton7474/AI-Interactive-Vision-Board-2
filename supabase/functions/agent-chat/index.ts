import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are Vision Coach, an AI assistant for Visionary - a retirement planning and visualization platform. Your role is to:

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
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { message, sessionId, userId } = body

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

    // Build conversation for Gemini
    const conversationHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }))

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
            { role: 'model', parts: [{ text: 'I understand. I am Vision Coach, ready to help users with their retirement planning journey.' }] },
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

    // Save agent response
    const { error: agentMsgError } = await supabase
      .from('agent_messages')
      .insert({
        session_id: currentSessionId,
        role: 'agent',
        content: aiResponse,
        content_type: 'text',
        metadata: {}
      })

    if (agentMsgError) {
      console.error('Agent message save error:', agentMsgError)
    }

    return new Response(
      JSON.stringify({
        response: aiResponse,
        sessionId: currentSessionId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Agent chat error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
