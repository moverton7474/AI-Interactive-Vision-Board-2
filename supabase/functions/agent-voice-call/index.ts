import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Agent Voice Call Edge Function
 *
 * Initiates AI-powered voice calls via Twilio.
 * Used for habit reminders, goal check-ins, and proactive outreach.
 *
 * Required environment variables:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

    // Check for Twilio configuration
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.warn('Twilio not configured - voice calls will be simulated')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body = await req.json()
    const { user_id, call_type, context, message } = body
    // call_type: 'habit_reminder', 'goal_checkin', 'accountability', 'custom'

    // Validate required fields
    if (!user_id) {
      throw new Error('user_id is required')
    }
    if (!call_type) {
      throw new Error('call_type is required')
    }

    // Validate user has voice calls enabled in agent settings
    const { data: agentSettings } = await supabase
      .from('user_agent_settings')
      .select('agent_actions_enabled, allow_voice_calls')
      .eq('user_id', user_id)
      .single()

    if (agentSettings) {
      if (!agentSettings.agent_actions_enabled) {
        throw new Error('Agent actions are disabled. Enable them in Settings > AI Agent.')
      }
      if (agentSettings.allow_voice_calls === false) {
        throw new Error('Voice calls are disabled in your agent settings.')
      }
    }

    // Get user's phone number and call preferences from comm preferences
    const { data: commPrefs, error: prefsError } = await supabase
      .from('user_comm_preferences')
      .select('phone_number, phone_verified, call_enabled, quiet_hours, timezone')
      .eq('user_id', user_id)
      .single()

    if (prefsError || !commPrefs?.phone_number) {
      throw new Error('No phone number found for user. Please configure in Settings > Notifications.')
    }

    if (!commPrefs.call_enabled) {
      throw new Error('Voice calls are disabled in your notification preferences.')
    }

    let targetPhone = commPrefs.phone_number

    // Normalize phone number (ensure it starts with +)
    if (!targetPhone.startsWith('+')) {
      // Assume US number if no country code
      targetPhone = '+1' + targetPhone.replace(/\D/g, '')
    }

    // Check user's quiet hours
    if (commPrefs.quiet_hours) {
      const now = new Date()
      const userTimezone = commPrefs.timezone || 'America/New_York'

      // Get current hour in user's timezone
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }))
      const currentHour = userTime.getHours()
      const currentMinutes = currentHour * 60 + userTime.getMinutes()

      // Parse quiet hours
      const [startHour, startMin] = (commPrefs.quiet_hours.start || '22:00').split(':').map(Number)
      const [endHour, endMin] = (commPrefs.quiet_hours.end || '07:00').split(':').map(Number)
      const quietStart = startHour * 60 + startMin
      const quietEnd = endHour * 60 + endMin

      // Check if currently in quiet hours
      let inQuietHours = false
      if (quietStart > quietEnd) {
        // Quiet hours span midnight (e.g., 22:00 to 07:00)
        inQuietHours = currentMinutes >= quietStart || currentMinutes < quietEnd
      } else {
        // Quiet hours within same day
        inQuietHours = currentMinutes >= quietStart && currentMinutes < quietEnd
      }

      if (inQuietHours) {
        // Log the blocked call attempt
        await supabase.from('agent_action_history').insert({
          user_id,
          action_type: 'voice_call',
          action_status: 'failed',
          action_payload: { phone_number: targetPhone, call_type, blocked_reason: 'quiet_hours' },
          error_message: 'Voice call blocked due to quiet hours',
          trigger_context: context || call_type
        })

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Currently in quiet hours. Voice call will not be initiated.',
            quiet_hours: commPrefs.quiet_hours
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    let callResult: any

    // Initiate call via Twilio if configured
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`

      // Generate TwiML for the call
      const callMessage = message || generateCallMessage(call_type, context)
      const twimlUrl = `${SUPABASE_URL}/functions/v1/twilio-voice-webhook?user_id=${user_id}&call_type=${call_type}&message=${encodeURIComponent(callMessage)}`

      const twilioBody = new URLSearchParams({
        To: targetPhone,
        From: TWILIO_PHONE_NUMBER,
        Url: twimlUrl,
        StatusCallback: `${SUPABASE_URL}/functions/v1/twilio-call-status?user_id=${user_id}`,
        StatusCallbackEvent: 'initiated ringing answered completed'
      })

      const authString = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: twilioBody.toString()
      })

      callResult = await response.json()

      if (!response.ok) {
        console.error('Twilio error:', callResult)

        // Log failed attempt
        await supabase.from('agent_action_history').insert({
          user_id,
          action_type: 'voice_call',
          action_status: 'failed',
          action_payload: { phone_number: targetPhone, call_type, message: callMessage },
          error_message: callResult.message || 'Twilio API error',
          trigger_context: context || call_type
        })

        throw new Error(callResult.message || 'Failed to initiate voice call via Twilio')
      }

      console.log('Voice call initiated:', callResult.sid)
    } else {
      // Simulate call for development/testing
      console.log('SIMULATED VOICE CALL to', targetPhone, ':', call_type)
      callResult = {
        simulated: true,
        to: targetPhone,
        call_type,
        sid: 'SIMULATED_CALL_' + Date.now()
      }
    }

    // Log pending call (will be updated by status callback)
    await supabase.from('agent_action_history').insert({
      user_id,
      action_type: 'voice_call',
      action_status: callResult.simulated ? 'executed' : 'pending',
      action_payload: {
        phone_number: targetPhone,
        call_type,
        call_sid: callResult.sid
      },
      result_payload: { sid: callResult.sid, simulated: callResult.simulated || false },
      trigger_context: context || call_type,
      executed_at: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Voice call initiated successfully',
        call_sid: callResult.sid,
        simulated: callResult.simulated || false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('Voice Call Error:', err.message)
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Generate a default message based on call type
 */
function generateCallMessage(callType: string, context?: any): string {
  switch (callType) {
    case 'habit_reminder':
      const habitTitle = context?.habit_title || 'your habit'
      return `Hi! This is your AI Coach with a friendly reminder about ${habitTitle}. Don't forget to complete it today to keep your streak going!`

    case 'goal_checkin':
      const goalTitle = context?.goal_title || 'your goal'
      return `Hi! This is your AI Coach checking in on ${goalTitle}. How's your progress going? Remember, every small step counts!`

    case 'accountability':
      return `Hi! This is your AI Coach. I noticed you might need some support today. Remember, I'm here to help you stay on track with your goals and habits.`

    case 'celebration':
      return `Congratulations! This is your AI Coach calling to celebrate your amazing progress! You're doing fantastic work!`

    default:
      return `Hi! This is your AI Coach. Just checking in to see how you're doing today. Remember, you've got this!`
  }
}
