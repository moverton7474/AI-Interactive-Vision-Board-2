import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { allHeaders, handleCors, rateLimitResponse } from '../_shared/cors.ts'
import { checkRateLimitWithAlert, RATE_LIMITS, getClientIp, getRateLimitHeaders } from '../_shared/rate-limit.ts'

declare const Deno: any;

/**
 * Send SMS via Twilio
 *
 * Supports:
 * - Direct SMS to any number
 * - User lookup by userId (fetches phone from user_comm_preferences)
 * - Message templates for common notifications
 */
serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio credentials not configured')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Rate limiting - 10 SMS per minute per IP (stricter than default API)
    const clientIp = getClientIp(req)
    const rateLimitResult = await checkRateLimitWithAlert(
      supabase,
      clientIp,
      { maxRequests: 10, windowSeconds: 60, keyType: 'ip' },
      'send-sms'
    )

    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for IP ${clientIp} on send-sms`)
      return rateLimitResponse(rateLimitResult.resetIn)
    }

    const body = await req.json()
    const { to, userId, message, template, templateData } = body

    // Determine recipient phone number
    let recipientPhone = to

    if (!recipientPhone && userId) {
      // Look up phone from user_comm_preferences
      const { data: prefs, error: prefsError } = await supabase
        .from('user_comm_preferences')
        .select('phone_number, phone_verified')
        .eq('user_id', userId)
        .single()

      if (prefsError || !prefs?.phone_number) {
        throw new Error('User phone number not found or not configured')
      }

      if (!prefs.phone_verified) {
        console.warn('Warning: Sending to unverified phone number')
      }

      recipientPhone = prefs.phone_number
    }

    if (!recipientPhone) {
      throw new Error('No recipient phone number provided')
    }

    // Build message content
    let messageBody = message

    if (template && !message) {
      messageBody = buildTemplateMessage(template, templateData)
    }

    if (!messageBody) {
      throw new Error('No message content provided')
    }

    // Send via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`

    const formData = new URLSearchParams()
    formData.append('To', recipientPhone)
    formData.append('From', TWILIO_PHONE_NUMBER)
    formData.append('Body', messageBody)

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
      throw new Error(twilioData.message || 'Failed to send SMS')
    }

    // Log the notification in scheduled_checkins if userId provided
    if (userId) {
      await supabase
        .from('scheduled_checkins')
        .insert({
          user_id: userId,
          checkin_type: 'custom',
          scheduled_for: new Date().toISOString(),
          channel: 'sms',
          status: 'sent',
          content: { message: messageBody, template },
          response: { sid: twilioData.sid, status: twilioData.status }
        })
    }

    console.log('SMS sent successfully:', twilioData.sid)

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: twilioData.sid,
        status: twilioData.status,
        to: recipientPhone
      }),
      {
        headers: {
          ...allHeaders,
          ...getRateLimitHeaders(rateLimitResult)
        }
      }
    )

  } catch (error: any) {
    console.error('Send SMS error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: allHeaders, status: 400 }
    )
  }
})

/**
 * Build message from template
 */
function buildTemplateMessage(template: string, data: Record<string, any> = {}): string {
  const templates: Record<string, string> = {
    // Habit reminders
    'habit_reminder': `Hey ${data.name || 'there'}! Time for your daily habit: "${data.habitTitle}". You're on a ${data.streak || 0} day streak - keep it going! Reply DONE when complete.`,

    // Streak celebrations
    'streak_milestone': `Congratulations ${data.name}! You've hit a ${data.streak} day streak on "${data.habitTitle}"! You're building real momentum toward your vision.`,

    // Weekly review
    'weekly_review': `Hi ${data.name}, it's time for your weekly vision review! This week: ${data.tasksCompleted || 0} tasks completed, ${data.habitRate || 0}% habit completion. Tap to review: ${data.reviewUrl || 'Open Visionary app'}`,

    // Milestone reminder
    'milestone_reminder': `${data.name}, your milestone "${data.milestoneTitle}" is coming up in ${data.daysUntil} days. Are you on track? Reply YES or HELP.`,

    // Pace warning
    'pace_warning': `Heads up ${data.name}: At current pace, you may miss your "${data.goalTitle}" goal by ${data.delayWeeks} weeks. Let's adjust - tap to chat with your Vision Coach.`,

    // Welcome
    'welcome': `Welcome to Visionary, ${data.name}! I'm your Vision Coach. I'll help you turn your retirement dreams into reality. Reply GOALS to get started.`,

    // Check-in
    'daily_checkin': `Good ${data.timeOfDay || 'morning'} ${data.name}! How are you feeling about your vision today? (1-5) Reply with a number.`,

    // Generic
    'generic': data.content || 'Message from Visionary'
  }

  return templates[template] || templates['generic']
}
