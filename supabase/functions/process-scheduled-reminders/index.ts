import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Process Scheduled Reminders Edge Function
 *
 * Cron job to send pending habit and goal reminders.
 * Should be triggered every 5 minutes to check for due reminders.
 *
 * This function:
 * 1. Gets all pending reminders that are due now
 * 2. Sends them via the appropriate channel (email, SMS, voice)
 * 3. Updates their status to sent/failed
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const now = new Date()
    console.log(`Processing reminders at ${now.toISOString()}`)

    // Get pending habit reminders that are due
    const { data: dueReminders, error: remindersError } = await supabase
      .from('scheduled_habit_reminders')
      .select(`
        id,
        user_id,
        habit_id,
        scheduled_for,
        reminder_channel,
        habit_name,
        reminder_message,
        status
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_for', now.toISOString())
      .limit(100)

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError)
      throw remindersError
    }

    console.log(`Found ${dueReminders?.length || 0} due reminders`)

    let sentCount = 0
    let failedCount = 0
    let skippedCount = 0

    for (const reminder of dueReminders || []) {
      try {
        // Check if habit was already completed today (user may have done it)
        const todayStr = now.toISOString().split('T')[0]
        const { data: completion } = await supabase
          .from('habit_completions')
          .select('id')
          .eq('habit_id', reminder.habit_id)
          .gte('completed_at', todayStr + 'T00:00:00')
          .single()

        if (completion) {
          // Habit already completed, skip reminder
          await supabase
            .from('scheduled_habit_reminders')
            .update({ status: 'skipped', sent_at: now.toISOString() })
            .eq('id', reminder.id)
          skippedCount++
          continue
        }

        // Get user's agent settings to verify permissions
        const { data: agentSettings } = await supabase
          .from('user_agent_settings')
          .select('agent_actions_enabled, allow_send_email, allow_send_sms, allow_voice_calls')
          .eq('user_id', reminder.user_id)
          .single()

        if (!agentSettings?.agent_actions_enabled) {
          await supabase
            .from('scheduled_habit_reminders')
            .update({ status: 'skipped', sent_at: now.toISOString() })
            .eq('id', reminder.id)
          skippedCount++
          continue
        }

        // Send via appropriate channel
        let sendResult: any = { success: false }

        switch (reminder.reminder_channel) {
          case 'email':
            if (agentSettings.allow_send_email !== false) {
              sendResult = await sendEmailReminder(supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, reminder)
            } else {
              sendResult = { success: false, error: 'Email disabled' }
            }
            break

          case 'sms':
            if (agentSettings.allow_send_sms === true) {
              sendResult = await sendSmsReminder(supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, reminder)
            } else {
              sendResult = { success: false, error: 'SMS disabled' }
            }
            break

          case 'voice':
            if (agentSettings.allow_voice_calls === true) {
              sendResult = await sendVoiceReminder(supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, reminder)
            } else {
              sendResult = { success: false, error: 'Voice calls disabled' }
            }
            break

          case 'push':
          default:
            // For push notifications, we'd need a push notification service
            // For now, fall back to email if available
            if (agentSettings.allow_send_email !== false) {
              sendResult = await sendEmailReminder(supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, reminder)
            } else {
              sendResult = { success: true, message: 'Push notification simulated' }
            }
            break
        }

        if (sendResult.success) {
          await supabase
            .from('scheduled_habit_reminders')
            .update({ status: 'sent', sent_at: now.toISOString() })
            .eq('id', reminder.id)
          sentCount++
        } else {
          await supabase
            .from('scheduled_habit_reminders')
            .update({ status: 'failed', sent_at: now.toISOString() })
            .eq('id', reminder.id)
          failedCount++
          console.error(`Failed to send reminder ${reminder.id}:`, sendResult.error)
        }

      } catch (reminderError: any) {
        console.error(`Error processing reminder ${reminder.id}:`, reminderError)
        await supabase
          .from('scheduled_habit_reminders')
          .update({ status: 'failed' })
          .eq('id', reminder.id)
        failedCount++
      }
    }

    // Also process goal check-ins
    const goalCheckinsResult = await processGoalCheckins(supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, now)

    console.log(`Processed: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped`)
    console.log(`Goal check-ins: ${goalCheckinsResult.sent} sent, ${goalCheckinsResult.failed} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        habit_reminders: {
          sent: sentCount,
          failed: failedCount,
          skipped: skippedCount
        },
        goal_checkins: goalCheckinsResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('Process Reminders Error:', err.message)
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Send email reminder
 */
async function sendEmailReminder(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  reminder: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user's email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', reminder.user_id)
      .single()

    if (!profile?.email) {
      return { success: false, error: 'No email found for user' }
    }

    // Call send-email function
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        to: profile.email,
        template: 'habit_reminder',
        subject: `Reminder: ${reminder.habit_name}`,
        data: {
          habitTitle: reminder.habit_name,
          message: reminder.reminder_message,
          subject: `Reminder: ${reminder.habit_name}`
        }
      })
    })

    const result = await response.json()

    // Log to agent action history
    await supabase.from('agent_action_history').insert({
      user_id: reminder.user_id,
      action_type: 'send_email',
      action_status: result.error ? 'failed' : 'executed',
      action_payload: {
        email: profile.email,
        subject: `Reminder: ${reminder.habit_name}`,
        habit_id: reminder.habit_id
      },
      trigger_context: 'habit_reminder',
      related_habit_id: reminder.habit_id,
      error_message: result.error,
      executed_at: new Date().toISOString()
    })

    return result.error ? { success: false, error: result.error } : { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Send SMS reminder
 */
async function sendSmsReminder(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  reminder: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Call agent-send-sms function
    const response = await fetch(`${supabaseUrl}/functions/v1/agent-send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        user_id: reminder.user_id,
        message: reminder.reminder_message,
        context: {
          type: 'habit_reminder',
          habit_id: reminder.habit_id,
          habit_name: reminder.habit_name
        }
      })
    })

    const result = await response.json()
    return result.success ? { success: true } : { success: false, error: result.error }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Send voice call reminder
 */
async function sendVoiceReminder(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  reminder: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Call agent-voice-call function
    const response = await fetch(`${supabaseUrl}/functions/v1/agent-voice-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        user_id: reminder.user_id,
        call_type: 'habit_reminder',
        message: reminder.reminder_message,
        context: {
          habit_id: reminder.habit_id,
          habit_title: reminder.habit_name
        }
      })
    })

    const result = await response.json()
    return result.success ? { success: true } : { success: false, error: result.error }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Process goal check-ins
 */
async function processGoalCheckins(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  now: Date
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  try {
    // Get pending goal check-ins that are due
    const { data: dueCheckins, error } = await supabase
      .from('scheduled_goal_checkins')
      .select(`
        id,
        user_id,
        goal_id,
        scheduled_for,
        checkin_channel,
        goal_title,
        current_progress,
        status
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_for', now.toISOString())
      .limit(50)

    if (error) {
      console.error('Error fetching goal check-ins:', error)
      return { sent, failed }
    }

    for (const checkin of dueCheckins || []) {
      try {
        // Get user's agent settings
        const { data: agentSettings } = await supabase
          .from('user_agent_settings')
          .select('agent_actions_enabled, allow_send_email')
          .eq('user_id', checkin.user_id)
          .single()

        if (!agentSettings?.agent_actions_enabled) {
          await supabase
            .from('scheduled_goal_checkins')
            .update({ status: 'skipped' })
            .eq('id', checkin.id)
          continue
        }

        // Get user's email
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', checkin.user_id)
          .single()

        if (!profile?.email) {
          await supabase
            .from('scheduled_goal_checkins')
            .update({ status: 'failed' })
            .eq('id', checkin.id)
          failed++
          continue
        }

        const firstName = profile.full_name?.split(' ')[0] || 'there'

        // Send check-in email
        const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`
          },
          body: JSON.stringify({
            to: profile.email,
            template: 'goal_checkin',
            subject: `Goal Check-in: ${checkin.goal_title}`,
            data: {
              goalTitle: checkin.goal_title,
              progress: checkin.current_progress,
              firstName,
              subject: `Goal Check-in: ${checkin.goal_title}`
            }
          })
        })

        const result = await response.json()

        if (result.error) {
          await supabase
            .from('scheduled_goal_checkins')
            .update({ status: 'failed' })
            .eq('id', checkin.id)
          failed++
        } else {
          await supabase
            .from('scheduled_goal_checkins')
            .update({ status: 'sent', sent_at: now.toISOString() })
            .eq('id', checkin.id)
          sent++
        }

        // Log to agent action history
        await supabase.from('agent_action_history').insert({
          user_id: checkin.user_id,
          action_type: 'send_email',
          action_status: result.error ? 'failed' : 'executed',
          action_payload: {
            email: profile.email,
            subject: `Goal Check-in: ${checkin.goal_title}`,
            goal_id: checkin.goal_id
          },
          trigger_context: 'goal_checkin',
          related_goal_id: checkin.goal_id,
          error_message: result.error,
          executed_at: now.toISOString()
        })

      } catch (checkinError: any) {
        console.error(`Error processing goal check-in ${checkin.id}:`, checkinError)
        await supabase
          .from('scheduled_goal_checkins')
          .update({ status: 'failed' })
          .eq('id', checkin.id)
        failed++
      }
    }
  } catch (err: any) {
    console.error('Error in processGoalCheckins:', err)
  }

  return { sent, failed }
}
