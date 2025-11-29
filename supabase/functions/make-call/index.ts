import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Make Voice Call via Twilio
 *
 * Supports:
 * - Direct call to any number
 * - User lookup by userId (fetches phone from user_comm_preferences)
 * - TwiML voice scripts for automated messages
 * - Callback URL for call status updates
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    })
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio credentials not configured')
    }

    const supabase = createClient(
      SUPABASE_URL ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { to, userId, message, template, templateData, voiceType } = body

    // Determine recipient phone number
    let recipientPhone = to

    if (!recipientPhone && userId) {
      const { data: prefs, error: prefsError } = await supabase
        .from('user_comm_preferences')
        .select('phone_number, phone_verified, call_enabled')
        .eq('user_id', userId)
        .single()

      if (prefsError || !prefs?.phone_number) {
        throw new Error('User phone number not found')
      }

      if (!prefs.call_enabled) {
        throw new Error('User has not enabled voice calls')
      }

      recipientPhone = prefs.phone_number
    }

    if (!recipientPhone) {
      throw new Error('No recipient phone number provided')
    }

    // Build TwiML for the call
    const twiml = buildTwiML(message, template, templateData, voiceType)

    // Make call via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`

    const formData = new URLSearchParams()
    formData.append('To', recipientPhone)
    formData.append('From', TWILIO_PHONE_NUMBER)
    formData.append('Twiml', twiml)

    // Optional: Add status callback
    if (SUPABASE_URL) {
      formData.append('StatusCallback', `${SUPABASE_URL}/functions/v1/twilio-webhook`)
      formData.append('StatusCallbackEvent', 'completed')
    }

    const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    })

    const twilioData = await twilioResponse.json()

    if (!twilioResponse.ok) {
      console.error('Twilio API error:', twilioData)
      throw new Error(twilioData.message || 'Failed to initiate call')
    }

    // Log the call in scheduled_checkins if userId provided
    if (userId) {
      await supabase
        .from('scheduled_checkins')
        .insert({
          user_id: userId,
          checkin_type: 'custom',
          scheduled_for: new Date().toISOString(),
          channel: 'call',
          status: 'sent',
          content: { message, template, twiml },
          response: { sid: twilioData.sid, status: twilioData.status }
        })
    }

    console.log('Call initiated:', twilioData.sid)

    return new Response(
      JSON.stringify({
        success: true,
        callSid: twilioData.sid,
        status: twilioData.status,
        to: recipientPhone
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Make call error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Build TwiML voice script
 */
function buildTwiML(
  message?: string,
  template?: string,
  data: Record<string, any> = {},
  voiceType: string = 'Polly.Joanna'
): string {
  let spokenText = message

  if (template && !message) {
    spokenText = buildVoiceTemplate(template, data)
  }

  if (!spokenText) {
    spokenText = 'Hello from Visionary. Have a great day!'
  }

  // Build TwiML response
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voiceType}">${escapeXml(spokenText)}</Say>
  <Pause length="1"/>
  <Say voice="${voiceType}">Goodbye!</Say>
</Response>`
}

/**
 * Build voice message from template
 */
function buildVoiceTemplate(template: string, data: Record<string, any> = {}): string {
  const templates: Record<string, string> = {
    // Weekly review call
    'weekly_review': `Hi ${data.name || 'there'}! This is your Vision Coach from Visionary calling for your weekly check-in.
      This week you completed ${data.tasksCompleted || 0} tasks and maintained a ${data.habitRate || 0} percent habit completion rate.
      ${data.wins ? `Your biggest win was: ${data.wins}. ` : ''}
      ${data.focus ? `Your focus for next week should be: ${data.focus}. ` : ''}
      Keep up the great work on your journey to ${data.dreamLocation || 'your dream retirement'}!`,

    // Habit reminder
    'habit_reminder': `Hello ${data.name}! This is a friendly reminder from your Vision Coach.
      It's time for your daily habit: ${data.habitTitle}.
      You're currently on a ${data.streak || 0} day streak. Don't break the chain!`,

    // Milestone celebration
    'milestone_celebration': `Congratulations ${data.name}! This is your Vision Coach calling with exciting news.
      You've reached a major milestone: ${data.milestoneTitle}!
      This is a huge step toward your vision of ${data.dreamLocation || 'your dream future'}.
      Take a moment to celebrate this achievement!`,

    // Pace warning
    'pace_warning': `Hi ${data.name}, this is your Vision Coach. I wanted to check in because I noticed you might be falling behind on your goal: ${data.goalTitle}.
      At your current pace, you may miss your target by ${data.delayWeeks || 'a few'} weeks.
      Don't worry though, we can adjust your plan. Open the Visionary app to chat with me about next steps.`,

    // Morning motivation
    'morning_motivation': `Good morning ${data.name}! This is your Vision Coach.
      Today is a new opportunity to move closer to your dream of ${data.dreamLocation || 'your ideal retirement'}.
      Your top priority today is: ${data.topTask || 'making progress on your action plan'}.
      You've got this! Have a productive day.`,

    // Welcome call
    'welcome': `Welcome to Visionary, ${data.name}! I'm your AI Vision Coach, and I'm thrilled to help you turn your retirement dreams into reality.
      Over the coming weeks, I'll be here to guide you, celebrate your wins, and keep you accountable.
      Let's make your vision a reality!`,

    // Generic
    'generic': data.content || 'Hello from Visionary. Your Vision Coach is here to support your journey.'
  }

  return templates[template] || templates['generic']
}

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
