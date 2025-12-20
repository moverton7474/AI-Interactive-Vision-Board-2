import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * SMS Scheduler - Processes Scheduled Reminders
 *
 * This function runs on a cron schedule to:
 * 1. Find all pending reminders that are due
 * 2. Send SMS/notifications for each
 * 3. Update status and log results
 *
 * Designed to be called every minute by a cron job:
 * SELECT cron.schedule('sms-scheduler', '* * * * *', $$SELECT ... $$);
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Parse request body for optional parameters
    let batchSize = 50
    let dryRun = false

    try {
      const body = await req.json()
      if (body.batchSize) batchSize = Math.min(body.batchSize, 100)
      if (body.dryRun) dryRun = body.dryRun
    } catch {
      // No body provided, use defaults
    }

    // Get pending reminders that are due
    const now = new Date().toISOString()
    const { data: pendingReminders, error: fetchError } = await supabase
      .from('scheduled_reminders')
      .select(`
        id,
        user_id,
        habit_id,
        reminder_type,
        scheduled_for,
        message,
        channel
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(batchSize)

    if (fetchError) {
      throw new Error(`Failed to fetch pending reminders: ${fetchError.message}`)
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: 'No pending reminders to process'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${pendingReminders.length} pending reminders`)

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Process each reminder
    for (const reminder of pendingReminders) {
      try {
        // Get user's communication preferences
        const { data: commPrefs } = await supabase
          .from('user_comm_preferences')
          .select('phone_number, phone_verified, sms_enabled')
          .eq('user_id', reminder.user_id)
          .single()

        // Get user's profile for personalization
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', reminder.user_id)
          .single()

        const firstName = profile?.full_name?.split(' ')[0] || 'there'

        // Determine message content
        let messageContent = reminder.message
        if (!messageContent) {
          messageContent = generateDefaultMessage(reminder.reminder_type, firstName)
        } else {
          // Replace placeholders in message
          messageContent = messageContent.replace('{firstName}', firstName)
        }

        let sent = false
        let errorMessage = ''

        if (dryRun) {
          console.log(`[DRY RUN] Would send to ${reminder.user_id}: ${messageContent}`)
          sent = true
        } else if (reminder.channel === 'sms' && commPrefs?.phone_number && TWILIO_ACCOUNT_SID) {
          // Check if user has SMS enabled
          if (commPrefs.sms_enabled === false) {
            errorMessage = 'User has SMS disabled'
          } else {
            // Send SMS via Twilio
            try {
              const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`

              const formData = new URLSearchParams()
              formData.append('To', commPrefs.phone_number)
              formData.append('From', TWILIO_PHONE_NUMBER!)
              formData.append('Body', messageContent)

              const twilioResponse = await fetch(twilioUrl, {
                method: 'POST',
                headers: {
                  'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
              })

              if (twilioResponse.ok) {
                sent = true
                console.log(`SMS sent for reminder ${reminder.id}`)
              } else {
                const errorData = await twilioResponse.json()
                errorMessage = errorData.message || 'Twilio error'
                console.error('Twilio SMS error:', errorData)
              }
            } catch (smsError: any) {
              errorMessage = smsError.message || 'SMS sending failed'
              console.error('Error sending SMS:', smsError)
            }
          }
        } else if (reminder.channel === 'push') {
          // TODO: Implement push notifications
          errorMessage = 'Push notifications not yet implemented'
        } else if (reminder.channel === 'email') {
          // TODO: Implement email notifications
          errorMessage = 'Email notifications not yet implemented'
        } else {
          errorMessage = 'No valid communication channel available'
        }

        // Update reminder status
        await supabase
          .from('scheduled_reminders')
          .update({
            status: sent ? 'sent' : 'failed',
            sent_at: sent ? new Date().toISOString() : null,
            error_message: errorMessage || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', reminder.id)

        results.processed++
        if (sent) {
          results.sent++
        } else {
          results.failed++
          if (errorMessage) {
            results.errors.push(`${reminder.id}: ${errorMessage}`)
          }
        }

      } catch (reminderError: any) {
        console.error(`Error processing reminder ${reminder.id}:`, reminderError)
        results.processed++
        results.failed++
        results.errors.push(`${reminder.id}: ${reminderError.message}`)

        // Mark as failed
        await supabase
          .from('scheduled_reminders')
          .update({
            status: 'failed',
            error_message: reminderError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', reminder.id)
      }
    }

    console.log(`Scheduler complete: ${results.sent} sent, ${results.failed} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        ...results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('SMS Scheduler Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Generate default message based on reminder type
 */
function generateDefaultMessage(reminderType: string, firstName: string): string {
  const messages: Record<string, string[]> = {
    habit: [
      `Hey ${firstName}! Time to check in on your habits. Every small action counts toward your bigger vision.`,
      `${firstName}, this is your daily nudge! Don't break the chain - complete your habits today.`
    ],
    streak: [
      `${firstName}, you're on a roll! Keep your streak alive by completing your habits today.`,
      `Don't let your streak end, ${firstName}! You've worked hard to build this momentum.`
    ],
    motivation: [
      `${firstName}, remember why you started. Your future self will thank you for staying consistent today.`,
      `Small progress is still progress, ${firstName}. Keep moving toward your vision!`
    ],
    check_in: [
      `Hey ${firstName}, we noticed you've been quiet. Everything okay? We're here to help you stay on track.`,
      `${firstName}, checking in! Need any support with your goals? Reply and let us know.`
    ]
  }

  const typeMessages = messages[reminderType] || messages.motivation
  return typeMessages[Math.floor(Math.random() * typeMessages.length)]
}
