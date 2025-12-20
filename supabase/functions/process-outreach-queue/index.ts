import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Process Outreach Queue
 *
 * This function processes scheduled voice/SMS outreach:
 * 1. Queries for pending outreach where scheduled_for <= now
 * 2. Sends each outreach via Twilio (voice call or SMS)
 * 3. Updates status to completed/failed
 *
 * Should be called via cron job every 1-5 minutes
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as string[]
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio credentials not configured')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get pending outreach that's due (scheduled_for <= now)
    const { data: pendingOutreach, error: fetchError } = await supabase
      .from('voice_outreach_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('priority', { ascending: false }) // Higher priority first
      .order('scheduled_for', { ascending: true }) // Older first
      .limit(10) // Process in batches to avoid timeout

    if (fetchError) {
      throw new Error(`Failed to fetch pending outreach: ${fetchError.message}`)
    }

    if (!pendingOutreach || pendingOutreach.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending outreach to process',
          ...results,
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${pendingOutreach.length} outreach items`)

    // Process each outreach
    for (const outreach of pendingOutreach) {
      results.processed++

      try {
        // Mark as processing
        await supabase
          .from('voice_outreach_queue')
          .update({
            status: 'processing',
            last_attempt_at: new Date().toISOString(),
            attempt_count: (outreach.attempt_count || 0) + 1
          })
          .eq('id', outreach.id)

        // Get user's phone number from user_comm_preferences
        const { data: commPrefs, error: commError } = await supabase
          .from('user_comm_preferences')
          .select('phone_number')
          .eq('user_id', outreach.user_id)
          .single()

        if (commError || !commPrefs) {
          throw new Error('User communication preferences not found - please configure phone in settings')
        }

        if (!commPrefs.phone_number) {
          throw new Error(`User has no phone number configured`)
        }

        // Get user email from auth.users for personalization
        const { data: userData } = await supabase.auth.admin.getUserById(outreach.user_id)
        const userEmail = userData?.user?.email

        // Prepare message
        const userName = userEmail?.split('@')[0] || 'there'
        const messageContext = outreach.context?.message || ''
        const outreachType = outreach.outreach_type

        const defaultMessages: Record<string, string> = {
          'morning_motivation': `Good morning ${userName}! This is your AI coach checking in. Remember, every day is a new opportunity to grow. What's one goal you're focusing on today?`,
          'habit_reminder': `Hey ${userName}, this is a friendly reminder to check in on your habits. Small consistent actions lead to big results!`,
          'celebration': `Congratulations ${userName}! I'm calling to celebrate your amazing progress. You've been doing great work!`,
          'check_in': `Hi ${userName}, just checking in to see how you're doing. Your well-being matters to us.`,
          'goal_review': `Hi ${userName}, let's take a moment to review your goals. Progress is being made every day!`,
          'weekly_summary': `Hey ${userName}, here's your weekly check-in. Let's reflect on what you've accomplished!`
        }

        const message = messageContext || defaultMessages[outreachType] || `Hi ${userName}, this is your AI coach reaching out!`

        // Default to voice call (can be extended to check outreach_type for SMS)
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${message}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Press any key to repeat this message, or hang up when you're ready. Have a great day!</Say>
  <Gather numDigits="1" action="" timeout="10">
    <Say voice="Polly.Joanna">${message}</Say>
  </Gather>
</Response>`

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`

        const formData = new URLSearchParams()
        formData.append('To', commPrefs.phone_number)
        formData.append('From', TWILIO_PHONE_NUMBER)
        formData.append('Twiml', twiml)

        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData
        })

        const twilioResult = await twilioResponse.json()

        if (!twilioResponse.ok) {
          throw new Error(twilioResult.message || 'Twilio call failed')
        }

        // Mark as completed
        await supabase
          .from('voice_outreach_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result: {
              call_sid: twilioResult.sid,
              status: twilioResult.status,
              to: commPrefs.phone_number
            }
          })
          .eq('id', outreach.id)

        results.succeeded++
        console.log(`Successfully processed outreach ${outreach.id} for ${userEmail || 'user'}`)

      } catch (err: any) {
        console.error(`Error processing outreach ${outreach.id}:`, err)
        results.failed++
        results.errors.push(`${outreach.id}: ${err.message}`)

        // Mark as failed (or retry later if under attempt limit)
        const attemptCount = (outreach.attempt_count || 0) + 1
        const maxAttempts = 3

        await supabase
          .from('voice_outreach_queue')
          .update({
            status: attemptCount >= maxAttempts ? 'failed' : 'pending',
            result: { error: err.message, attempt: attemptCount }
          })
          .eq('id', outreach.id)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} outreach items`,
        ...results,
        duration_ms: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('Error in process-outreach-queue:', err)
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        ...results,
        duration_ms: Date.now() - startTime
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
