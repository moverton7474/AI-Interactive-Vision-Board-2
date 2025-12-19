import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Agent Send SMS Edge Function
 *
 * Sends SMS messages via Twilio on behalf of the AI agent.
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
      console.warn('Twilio not configured - SMS will be simulated')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body = await req.json()
    const { user_id, phone_number, message, context } = body

    // Validate required fields
    if (!user_id) {
      throw new Error('user_id is required')
    }
    if (!message) {
      throw new Error('message is required')
    }

    // Get phone number from user preferences if not provided
    let targetPhone = phone_number
    if (!targetPhone) {
      const { data: commPrefs, error: prefsError } = await supabase
        .from('user_comm_preferences')
        .select('phone_number, phone_verified')
        .eq('user_id', user_id)
        .single()

      if (prefsError || !commPrefs?.phone_number) {
        throw new Error('No phone number found for user. Please configure in Settings > Notifications.')
      }

      targetPhone = commPrefs.phone_number
    }

    // Normalize phone number (ensure it starts with +)
    if (!targetPhone.startsWith('+')) {
      // Assume US number if no country code
      targetPhone = '+1' + targetPhone.replace(/\D/g, '')
    }

    // Check user's agent settings for SMS permission
    const { data: agentSettings } = await supabase
      .from('user_agent_settings')
      .select('agent_actions_enabled, allow_send_sms')
      .eq('user_id', user_id)
      .single()

    // Check if agent actions are enabled and SMS is allowed
    if (agentSettings) {
      if (!agentSettings.agent_actions_enabled) {
        throw new Error('Agent actions are disabled. Enable them in Settings > AI Agent.')
      }
      if (agentSettings.allow_send_sms === false) {
        throw new Error('SMS sending is disabled in your agent settings.')
      }
    }

    // Check user's quiet hours
    const { data: commPrefs } = await supabase
      .from('user_comm_preferences')
      .select('quiet_hours, timezone')
      .eq('user_id', user_id)
      .single()

    if (commPrefs?.quiet_hours) {
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
        // Log the blocked SMS attempt
        await supabase.from('agent_action_history').insert({
          user_id,
          action_type: 'send_sms',
          action_status: 'failed',
          action_payload: { phone_number: targetPhone, message, blocked_reason: 'quiet_hours' },
          error_message: 'SMS blocked due to quiet hours',
          trigger_context: context || 'scheduled'
        })

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Currently in quiet hours. SMS will not be sent.',
            quiet_hours: commPrefs.quiet_hours
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    let smsResult: any

    // Send SMS via Twilio if configured
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`

      const twilioBody = new URLSearchParams({
        To: targetPhone,
        From: TWILIO_PHONE_NUMBER,
        Body: message
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

      smsResult = await response.json()

      if (!response.ok) {
        console.error('Twilio error:', smsResult)

        // Log failed attempt
        await supabase.from('agent_action_history').insert({
          user_id,
          action_type: 'send_sms',
          action_status: 'failed',
          action_payload: { phone_number: targetPhone, message },
          error_message: smsResult.message || 'Twilio API error',
          trigger_context: context || 'conversation'
        })

        throw new Error(smsResult.message || 'Failed to send SMS via Twilio')
      }

      console.log('SMS sent successfully:', smsResult.sid)
    } else {
      // Simulate SMS for development/testing
      console.log('SIMULATED SMS to', targetPhone, ':', message)
      smsResult = {
        simulated: true,
        to: targetPhone,
        body: message,
        sid: 'SIMULATED_' + Date.now()
      }
    }

    // Log successful SMS
    await supabase.from('agent_action_history').insert({
      user_id,
      action_type: 'send_sms',
      action_status: 'executed',
      action_payload: { phone_number: targetPhone, message },
      result_payload: { sid: smsResult.sid, simulated: smsResult.simulated || false },
      trigger_context: context || 'conversation',
      executed_at: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'SMS sent successfully',
        sid: smsResult.sid,
        simulated: smsResult.simulated || false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('SMS Error:', err.message)
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
