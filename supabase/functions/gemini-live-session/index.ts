import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Gemini Live Voice Session Handler
 *
 * This edge function manages real-time bidirectional voice conversations
 * using Google's Gemini Live API.
 *
 * Actions:
 * - check_eligibility: Check if user can start a live voice session
 * - start: Start a new live voice session
 * - process_audio: Process audio chunk and get response
 * - end: End the session and save transcript
 * - get_usage: Get user's monthly usage stats
 *
 * Tier Requirements:
 * - PRO: 30 minutes/month
 * - ELITE: 120 minutes/month
 * - TEAM: 300 minutes/month
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_LIVE_MODEL = 'gemini-2.0-flash-exp'; // Supports live audio

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GEMINI_API_KEY) {
      console.error(`[${requestId}] GEMINI_API_KEY not found`);
      return errorResponse('GEMINI_API_KEY not configured', 500, requestId);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401, requestId);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error(`[${requestId}] Auth error:`, authError?.message);
      return errorResponse('Invalid or expired authentication token', 401, requestId);
    }

    console.log(`[${requestId}] User authenticated: ${user.id.slice(0, 8)}...`);

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[${requestId}] Action: ${action}`);

    let result: Response;
    switch (action) {
      case 'check_eligibility':
        result = await handleCheckEligibility(supabase, user.id, requestId);
        break;
      case 'start':
        result = await handleStartSession(supabase, user.id, params, requestId);
        break;
      case 'process_audio':
        result = await handleProcessAudio(supabase, GEMINI_API_KEY, user.id, params, requestId);
        break;
      case 'process_text':
        result = await handleProcessText(supabase, GEMINI_API_KEY, user.id, params, requestId, authHeader);
        break;
      case 'end':
        result = await handleEndSession(supabase, user.id, params, requestId);
        break;
      case 'get_usage':
        result = await handleGetUsage(supabase, user.id, requestId);
        break;
      default:
        return errorResponse(
          `Unknown action: ${action}. Valid actions: check_eligibility, start, process_audio, process_text, end, get_usage`,
          400,
          requestId
        );
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Completed in ${duration}ms`);
    return result;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Error after ${duration}ms:`, error.message);
    return errorResponse(error.message, 400, requestId);
  }
});

/**
 * Check if user is eligible to start a live voice session
 */
async function handleCheckEligibility(supabase: any, userId: string, requestId: string) {
  console.log(`[${requestId}] Checking eligibility for user ${userId.slice(0, 8)}...`);

  try {
    // Call the database function to check eligibility
    const { data, error } = await supabase.rpc('can_start_live_voice_session', {
      p_user_id: userId
    });

    if (error) {
      console.error(`[${requestId}] Eligibility check error:`, error);
      // Fallback: check profile directly
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();

      const tier = profile?.subscription_tier || 'FREE';
      const allowed = ['PRO', 'ELITE', 'TEAM'].includes(tier);

      return successResponse({
        allowed,
        reason: allowed ? 'OK' : 'Live voice requires PRO subscription or higher',
        tier,
        limit_minutes: tier === 'PRO' ? 30 : tier === 'ELITE' ? 120 : tier === 'TEAM' ? 300 : 0,
        used_minutes: 0,
        remaining_minutes: tier === 'PRO' ? 30 : tier === 'ELITE' ? 120 : tier === 'TEAM' ? 300 : 0
      }, requestId);
    }

    return successResponse(data, requestId);
  } catch (err: any) {
    console.error(`[${requestId}] Eligibility check failed:`, err);
    return errorResponse('Failed to check eligibility', 500, requestId);
  }
}

/**
 * Start a new live voice session
 */
async function handleStartSession(supabase: any, userId: string, params: any, requestId: string) {
  const { sessionType = 'coaching' } = params;

  console.log(`[${requestId}] Starting live voice session for user ${userId.slice(0, 8)}...`);

  // First check eligibility
  const { data: eligibility, error: eligError } = await supabase.rpc('can_start_live_voice_session', {
    p_user_id: userId
  });

  if (eligError) {
    console.error(`[${requestId}] Eligibility check error:`, eligError);
    // Continue anyway if function doesn't exist
  } else if (!eligibility?.allowed) {
    return errorResponse(eligibility?.reason || 'Not eligible for live voice', 403, requestId);
  }

  // Create the session
  const { data: session, error: sessionError } = await supabase
    .from('live_voice_sessions')
    .insert({
      user_id: userId,
      session_type: sessionType,
      status: 'active',
      transcript: [],
      model_used: GEMINI_LIVE_MODEL
    })
    .select()
    .single();

  if (sessionError) {
    console.error(`[${requestId}] Failed to create session:`, sessionError);
    return errorResponse('Failed to create session', 500, requestId);
  }

  // Get user context for personalization
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, first_name, subscription_tier')
    .eq('id', userId)
    .single();

  const userName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'friend';

  // Get user's goals for context
  const { data: goals } = await supabase
    .from('goals')
    .select('title, description')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(3);

  // Build opening message
  const openingMessage = buildOpeningMessage(sessionType, userName, goals || []);

  console.log(`[${requestId}] Session created: ${session.id}`);

  return successResponse({
    session: {
      id: session.id,
      session_type: sessionType,
      started_at: session.started_at
    },
    openingMessage,
    eligibility: eligibility || { remaining_minutes: 30 },
    model: GEMINI_LIVE_MODEL
  }, requestId);
}

/**
 * Build personalized opening message based on session type
 */
function buildOpeningMessage(sessionType: string, userName: string, goals: any[]): string {
  const goalContext = goals.length > 0
    ? `I see you're working on some great goals like "${goals[0].title}".`
    : '';

  const messages: Record<string, string> = {
    coaching: `Hey ${userName}! I'm ready for a real-time coaching conversation. ${goalContext} What's on your mind today?`,
    goal_review: `Hi ${userName}! Let's do a live goal review session. ${goalContext} How are things progressing?`,
    habit_checkin: `Hey ${userName}! Time for a quick habit check-in. How have your habits been going lately?`,
    motivation: `Hi ${userName}! I'm here to give you a motivational boost. ${goalContext} Tell me what you need today.`,
    free_form: `Hey ${userName}! I'm all ears. What would you like to talk about?`
  };

  return messages[sessionType] || messages.free_form;
}

/**
 * Process audio input and get AI response
 * This handles the real-time audio conversation
 */
async function handleProcessAudio(
  supabase: any,
  apiKey: string,
  userId: string,
  params: any,
  requestId: string
) {
  const { sessionId, audioData, mimeType = 'audio/webm' } = params;

  if (!sessionId || !audioData) {
    return errorResponse('Missing sessionId or audioData', 400, requestId);
  }

  console.log(`[${requestId}] Processing audio for session ${sessionId.slice(0, 8)}...`);

  // Verify session ownership
  const { data: session, error: sessionError } = await supabase
    .from('live_voice_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (sessionError || !session) {
    return errorResponse('Session not found or already ended', 404, requestId);
  }

  // Get user context for personalized response
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, first_name')
    .eq('id', userId)
    .single();

  const userName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'friend';

  // Build conversation history from transcript
  const history = (session.transcript || []).map((entry: any) => ({
    role: entry.role,
    parts: [{ text: entry.content }]
  }));

  // Build system instruction
  const systemInstruction = buildSystemInstruction(session.session_type, userName);

  try {
    // Call Gemini with audio input
    const response = await callGeminiWithAudio(
      apiKey,
      audioData,
      mimeType,
      history,
      systemInstruction,
      requestId
    );

    // Extract text response
    const aiResponse = response.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm having trouble processing that. Could you try again?";

    // Update transcript with user's transcribed speech and AI response
    const userTranscript = response.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.text && p.role === 'user'
    )?.text || '[Audio input]';

    const newTranscript = [
      ...(session.transcript || []),
      { role: 'user', content: userTranscript, timestamp: new Date().toISOString() },
      { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() }
    ];

    // Update session
    await supabase
      .from('live_voice_sessions')
      .update({
        transcript: newTranscript,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    // Calculate audio duration for usage tracking
    const audioDurationMs = estimateAudioDuration(audioData);

    return successResponse({
      response: aiResponse,
      transcribedInput: userTranscript,
      audioDurationMs,
      turnCount: newTranscript.length / 2
    }, requestId);

  } catch (err: any) {
    console.error(`[${requestId}] Gemini audio processing error:`, err);
    return errorResponse(`Audio processing failed: ${err.message}`, 500, requestId);
  }
}

/**
 * Process text input for live session (fallback when audio not available)
 */
async function handleProcessText(
  supabase: any,
  apiKey: string,
  userId: string,
  params: any,
  requestId: string,
  authHeader?: string
) {
  const { sessionId, text } = params;

  if (!sessionId || !text) {
    return errorResponse('Missing sessionId or text', 400, requestId);
  }

  console.log(`[${requestId}] Processing text for session ${sessionId.slice(0, 8)}...`);

  // Verify session ownership
  const { data: session, error: sessionError } = await supabase
    .from('live_voice_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (sessionError || !session) {
    return errorResponse('Session not found or already ended', 404, requestId);
  }

  // Get user context
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, first_name')
    .eq('id', userId)
    .single();

  const userName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'friend';

  // Build conversation history
  const history = (session.transcript || []).map((entry: any) => ({
    role: entry.role,
    parts: [{ text: entry.content }]
  }));

  // Build system instruction with calendar capability info
  let systemInstruction = buildSystemInstruction(session.session_type, userName);
  systemInstruction += `\n\nYou have access to the user's Google Calendar. You can:
- Check their availability using the check_calendar_availability function
- Create calendar events using the create_calendar_event function
When the user asks to schedule something, use these tools. Always confirm the details before creating an event.`;

  try {
    // Call Gemini with text and tools
    console.log(`[${requestId}] Calling Gemini with tools enabled, authHeader present: ${!!authHeader}`);

    let response = await callGeminiWithText(
      apiKey,
      text,
      history,
      systemInstruction,
      requestId,
      true // Include tools
    );

    console.log(`[${requestId}] Gemini raw response:`, JSON.stringify(response).substring(0, 500));

    let aiResponse = '';
    let functionCallExecuted = false;

    // Check if Gemini wants to call a function
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    console.log(`[${requestId}] Response parts count: ${parts.length}`);

    for (const part of parts) {
      console.log(`[${requestId}] Processing part:`, JSON.stringify(part).substring(0, 200));

      if (part.functionCall) {
        const functionCall = part.functionCall;
        const functionName = functionCall.name;
        const functionArgs = functionCall.args || {};

        console.log(`[${requestId}] Gemini requested function call: ${functionName}`, JSON.stringify(functionArgs));

        // Execute the calendar tool
        if (!authHeader) {
          console.error(`[${requestId}] No auth header available for calendar tool execution!`);
        }

        const toolResult = await executeCalendarTool(
          supabase,
          userId,
          functionName,
          functionArgs,
          authHeader || '',
          requestId
        );

        console.log(`[${requestId}] Tool execution result:`, JSON.stringify(toolResult));
        functionCallExecuted = true;

        // Call Gemini again with the function result
        const functionResultHistory = [
          ...history,
          { role: 'user', parts: [{ text }] },
          { role: 'model', parts: [{ functionCall }] },
          {
            role: 'function',
            parts: [{
              functionResponse: {
                name: functionName,
                response: toolResult
              }
            }]
          }
        ];

        const followUpResponse = await fetch(
          `${GEMINI_API_BASE}/models/${GEMINI_LIVE_MODEL}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: functionResultHistory,
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 300,
                topP: 0.9
              }
            })
          }
        );

        if (followUpResponse.ok) {
          const followUpData = await followUpResponse.json();
          aiResponse = followUpData.candidates?.[0]?.content?.parts?.[0]?.text ||
            (toolResult.success
              ? `Done! ${toolResult.message || 'Action completed successfully.'}`
              : `I encountered an issue: ${toolResult.error}`);
        } else {
          aiResponse = toolResult.success
            ? `Done! ${toolResult.message || 'Action completed successfully.'}`
            : `I encountered an issue: ${toolResult.error}`;
        }
        break;
      } else if (part.text) {
        aiResponse = part.text;
      }
    }

    if (!aiResponse) {
      aiResponse = "I'm having trouble right now. Could you try again?";
    }

    // Update transcript
    const newTranscript = [
      ...(session.transcript || []),
      { role: 'user', content: text, timestamp: new Date().toISOString() },
      { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString(), functionCalled: functionCallExecuted }
    ];

    await supabase
      .from('live_voice_sessions')
      .update({
        transcript: newTranscript,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    return successResponse({
      response: aiResponse,
      turnCount: newTranscript.length / 2,
      functionCalled: functionCallExecuted
    }, requestId);

  } catch (err: any) {
    console.error(`[${requestId}] Gemini text processing error:`, err);
    return errorResponse(`Text processing failed: ${err.message}`, 500, requestId);
  }
}

/**
 * End a live voice session
 */
async function handleEndSession(supabase: any, userId: string, params: any, requestId: string) {
  const { sessionId, errorMessage, errorCode } = params;

  if (!sessionId) {
    return errorResponse('Missing sessionId', 400, requestId);
  }

  console.log(`[${requestId}] Ending session ${sessionId.slice(0, 8)}...`);

  try {
    // Use the database function to end session properly
    const { data: session, error } = await supabase.rpc('end_live_voice_session', {
      p_session_id: sessionId,
      p_transcript: null, // Keep existing transcript
      p_error_message: errorMessage || null,
      p_error_code: errorCode || null
    });

    if (error) {
      console.error(`[${requestId}] End session error:`, error);
      // Fallback: update directly
      const { data: updatedSession } = await supabase
        .from('live_voice_sessions')
        .update({
          status: errorMessage ? 'failed' : 'ended',
          ended_at: new Date().toISOString(),
          error_message: errorMessage,
          error_code: errorCode
        })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .select()
        .single();

      return successResponse({
        session: updatedSession,
        message: 'Session ended'
      }, requestId);
    }

    return successResponse({
      session,
      message: 'Session ended successfully'
    }, requestId);

  } catch (err: any) {
    console.error(`[${requestId}] End session failed:`, err);
    return errorResponse('Failed to end session', 500, requestId);
  }
}

/**
 * Get user's monthly usage statistics
 */
async function handleGetUsage(supabase: any, userId: string, requestId: string) {
  console.log(`[${requestId}] Getting usage for user ${userId.slice(0, 8)}...`);

  try {
    // Get eligibility which includes usage stats
    const { data, error } = await supabase.rpc('can_start_live_voice_session', {
      p_user_id: userId
    });

    if (error) {
      console.error(`[${requestId}] Usage check error:`, error);
      return errorResponse('Failed to get usage', 500, requestId);
    }

    // Get session history for this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: sessions } = await supabase
      .from('live_voice_sessions')
      .select('id, session_type, started_at, duration_seconds, status')
      .eq('user_id', userId)
      .gte('started_at', startOfMonth.toISOString())
      .order('started_at', { ascending: false });

    return successResponse({
      usage: data,
      sessions: sessions || [],
      month: startOfMonth.toISOString()
    }, requestId);

  } catch (err: any) {
    console.error(`[${requestId}] Get usage failed:`, err);
    return errorResponse('Failed to get usage', 500, requestId);
  }
}

/**
 * Build system instruction for the AI coach
 */
function buildSystemInstruction(sessionType: string, userName: string): string {
  const baseInstruction = `You are AMIE (Adaptive Mindset & Intention Engine), a warm, supportive AI life coach.
You're having a LIVE VOICE conversation with ${userName}. Keep your responses:
- Conversational and natural (like talking to a friend)
- Concise (2-4 sentences for voice)
- Encouraging and empathetic
- Action-oriented when appropriate

Remember: This is real-time voice, so be brief but impactful.`;

  const sessionInstructions: Record<string, string> = {
    coaching: `${baseInstruction}

Focus on: General life coaching, helping ${userName} work through challenges and identify solutions.`,
    goal_review: `${baseInstruction}

Focus on: Reviewing goals, celebrating progress, and helping ${userName} overcome obstacles.`,
    habit_checkin: `${baseInstruction}

Focus on: Quick habit check-in. Ask about specific habits, celebrate streaks, troubleshoot challenges.`,
    motivation: `${baseInstruction}

Focus on: Providing motivation and encouragement. Be uplifting and help ${userName} see their potential.`,
    free_form: `${baseInstruction}

Focus on: Open conversation. Follow ${userName}'s lead and provide support as needed.`
  };

  return sessionInstructions[sessionType] || sessionInstructions.free_form;
}

/**
 * Call Gemini API with audio input
 */
async function callGeminiWithAudio(
  apiKey: string,
  audioData: string,
  mimeType: string,
  history: any[],
  systemInstruction: string,
  requestId: string
): Promise<any> {
  const url = `${GEMINI_API_BASE}/models/${GEMINI_LIVE_MODEL}:generateContent?key=${apiKey}`;

  // Build contents with history and new audio
  const contents = [
    ...history,
    {
      role: 'user',
      parts: [{
        inlineData: {
          mimeType,
          data: audioData.includes('base64,') ? audioData.split(',')[1] : audioData
        }
      }]
    }
  ];

  const requestBody = {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 256, // Keep responses short for voice
      topP: 0.9
    }
  };

  console.log(`[${requestId}] Calling Gemini with audio input...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  return await response.json();
}

/**
 * Get calendar function declarations for Gemini
 */
function getCalendarTools() {
  return [
    {
      name: 'check_calendar_availability',
      description: 'Check the user\'s Google Calendar availability to find free time slots for scheduling',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date to check availability (YYYY-MM-DD format). Defaults to today.'
          },
          duration_minutes: {
            type: 'number',
            description: 'Minimum slot duration needed in minutes (default: 30)'
          }
        }
      }
    },
    {
      name: 'create_calendar_event',
      description: 'Create a new event/appointment on the user\'s Google Calendar',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Event title/name'
          },
          start_time: {
            type: 'string',
            description: 'Event start time in ISO 8601 format (e.g., 2024-12-28T10:00:00)'
          },
          end_time: {
            type: 'string',
            description: 'Event end time in ISO 8601 format (e.g., 2024-12-28T11:00:00)'
          },
          description: {
            type: 'string',
            description: 'Event description (optional)'
          }
        },
        required: ['title', 'start_time', 'end_time']
      }
    }
  ];
}

/**
 * Execute a calendar tool
 */
async function executeCalendarTool(
  supabase: any,
  userId: string,
  toolName: string,
  args: any,
  authHeader: string,
  requestId: string
): Promise<any> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

  console.log(`[${requestId}] Executing calendar tool: ${toolName}`, args);

  // Check if calendar is connected
  const { data: connection, error: connError } = await supabase
    .from('user_calendar_connections')
    .select('id, is_active')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('is_active', true)
    .single();

  if (!connection) {
    console.log(`[${requestId}] No calendar connection found`);
    return {
      success: false,
      error: 'No Google Calendar connected. Please connect your Google Calendar in Settings first.'
    };
  }

  try {
    if (toolName === 'check_calendar_availability') {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          date: args.date,
          duration_minutes: args.duration_minutes || 30
        })
      });

      const result = await response.json();
      console.log(`[${requestId}] Calendar availability result:`, JSON.stringify(result).substring(0, 200));

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const slots = result.available_slots || [];
      return {
        success: true,
        available_slots: slots.slice(0, 5),
        total_slots: slots.length,
        busy_events: result.summary?.total_busy_events || 0
      };

    } else if (toolName === 'create_calendar_event') {
      // Normalize dates to ISO format
      let { title, start_time, end_time, description } = args;

      try {
        const startDate = new Date(start_time);
        const endDate = new Date(end_time);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return { success: false, error: 'Invalid date format provided' };
        }

        start_time = startDate.toISOString();
        end_time = endDate.toISOString();
      } catch (e) {
        return { success: false, error: 'Failed to parse date/time' };
      }

      console.log(`[${requestId}] Creating calendar event: ${title} at ${start_time}`);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-create-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          title,
          start_time,
          end_time,
          description: description || ''
        })
      });

      const result = await response.json();
      console.log(`[${requestId}] Calendar create event result:`, JSON.stringify(result).substring(0, 300));

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Log to agent action history
      await supabase.from('agent_action_history').insert({
        user_id: userId,
        action_type: 'create_calendar_event',
        action_status: 'executed',
        action_payload: { title, start_time, end_time, description },
        trigger_context: 'live_voice',
        executed_at: new Date().toISOString()
      });

      return {
        success: true,
        message: `Event "${title}" created successfully`,
        event_id: result.event?.id,
        html_link: result.event?.html_link
      };
    }

    return { success: false, error: `Unknown tool: ${toolName}` };

  } catch (err: any) {
    console.error(`[${requestId}] Calendar tool execution error:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Call Gemini API with text input
 */
async function callGeminiWithText(
  apiKey: string,
  text: string,
  history: any[],
  systemInstruction: string,
  requestId: string,
  includeTools: boolean = true
): Promise<any> {
  const url = `${GEMINI_API_BASE}/models/${GEMINI_LIVE_MODEL}:generateContent?key=${apiKey}`;

  const contents = [
    ...history,
    {
      role: 'user',
      parts: [{ text }]
    }
  ];

  const requestBody: any = {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 256,
      topP: 0.9
    }
  };

  // Add calendar tools
  if (includeTools) {
    const tools = getCalendarTools();
    requestBody.tools = [{
      functionDeclarations: tools
    }];
    console.log(`[${requestId}] Including ${tools.length} calendar tools`);
  }

  console.log(`[${requestId}] Calling Gemini with text input (tools: ${includeTools}), user text: "${text.substring(0, 100)}"`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  return await response.json();
}

/**
 * Estimate audio duration from base64 data size
 * Rough estimate: WebM audio is ~12kbps, so 1.5KB ≈ 1 second
 */
function estimateAudioDuration(audioData: string): number {
  const base64Data = audioData.includes('base64,') ? audioData.split(',')[1] : audioData;
  const byteLength = Math.ceil(base64Data.length * 3 / 4);
  const estimatedMs = (byteLength / 1500) * 1000;
  return Math.round(estimatedMs);
}

/**
 * Create success response
 */
function successResponse(data: any, requestId: string): Response {
  return new Response(
    JSON.stringify({ success: true, requestId, ...data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Create error response
 */
function errorResponse(message: string, status: number, requestId: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      requestId,
      timestamp: new Date().toISOString()
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}
