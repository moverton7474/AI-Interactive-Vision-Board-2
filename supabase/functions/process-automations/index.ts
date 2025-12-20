import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Process Automations - Event-Driven Automation Engine
 *
 * Triggered by various events to check and execute automation rules:
 * - streak_milestone: When user hits a streak milestone
 * - missed_habit: When user misses habits for X days
 * - goal_progress: When goal progress changes significantly
 * - inactivity: When user hasn't logged in for X days
 *
 * Usage: POST with { trigger_type, user_id, trigger_data }
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

    const body = await req.json()
    const { trigger_type, user_id, trigger_data } = body

    if (!trigger_type || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: trigger_type, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${trigger_type} automation for user ${user_id}`)

    // Find matching active automation rules for this user and trigger type
    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', user_id)
      .eq('trigger_type', trigger_type)
      .eq('is_active', true)

    if (rulesError) {
      throw new Error(`Failed to fetch automation rules: ${rulesError.message}`)
    }

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          executed: 0,
          message: 'No matching automation rules found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = {
      executed: 0,
      successful: 0,
      failed: 0,
      executions: [] as any[]
    }

    // Get user profile and comm preferences for actions
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user_id)
      .single()

    const { data: commPrefs } = await supabase
      .from('user_comm_preferences')
      .select('phone_number, phone_verified, sms_enabled')
      .eq('user_id', user_id)
      .single()

    const firstName = profile?.full_name?.split(' ')[0] || 'there'

    // Process each matching rule
    for (const rule of rules) {
      try {
        // Check if trigger conditions are met
        const conditionsMet = checkTriggerConditions(rule.trigger_config, trigger_data)

        if (!conditionsMet) {
          console.log(`Rule ${rule.id} conditions not met, skipping`)
          continue
        }

        // Execute the action
        const actionResult = await executeAction(
          rule.action_type,
          rule.action_config,
          {
            user_id,
            firstName,
            trigger_type,
            trigger_data,
            commPrefs,
            supabase,
            twilio: {
              accountSid: TWILIO_ACCOUNT_SID,
              authToken: TWILIO_AUTH_TOKEN,
              phoneNumber: TWILIO_PHONE_NUMBER
            }
          }
        )

        // Log execution
        const { data: execution, error: execError } = await supabase
          .from('automation_executions')
          .insert({
            rule_id: rule.id,
            user_id: user_id,
            trigger_data: trigger_data,
            action_result: actionResult,
            status: actionResult.success ? 'success' : 'failed',
            error_message: actionResult.error || null
          })
          .select()
          .single()

        // Update rule stats
        await supabase
          .from('automation_rules')
          .update({
            last_triggered_at: new Date().toISOString(),
            trigger_count: rule.trigger_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', rule.id)

        results.executed++
        if (actionResult.success) {
          results.successful++
        } else {
          results.failed++
        }
        results.executions.push({
          rule_id: rule.id,
          rule_name: rule.name,
          action_type: rule.action_type,
          success: actionResult.success,
          error: actionResult.error
        })

      } catch (ruleError: any) {
        console.error(`Error processing rule ${rule.id}:`, ruleError)
        results.executed++
        results.failed++
        results.executions.push({
          rule_id: rule.id,
          rule_name: rule.name,
          action_type: rule.action_type,
          success: false,
          error: ruleError.message
        })
      }
    }

    console.log(`Automation complete: ${results.successful} successful, ${results.failed} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        trigger_type,
        ...results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('Process Automations Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Check if trigger conditions are met
 */
function checkTriggerConditions(config: any, triggerData: any): boolean {
  if (!config || Object.keys(config).length === 0) {
    return true // No conditions means always trigger
  }

  // Streak milestone check
  if (config.milestones && triggerData.streak) {
    return config.milestones.includes(triggerData.streak)
  }

  // Days missed check
  if (config.days_missed && triggerData.days_missed) {
    return triggerData.days_missed >= config.days_missed
  }

  // Days inactive check
  if (config.days_inactive && triggerData.days_inactive) {
    return triggerData.days_inactive >= config.days_inactive
  }

  // Progress threshold check
  if (config.progress_threshold && triggerData.progress) {
    return triggerData.progress >= config.progress_threshold
  }

  return true
}

/**
 * Execute an automation action
 */
async function executeAction(
  actionType: string,
  actionConfig: any,
  context: {
    user_id: string
    firstName: string
    trigger_type: string
    trigger_data: any
    commPrefs: any
    supabase: any
    twilio: { accountSid: string; authToken: string; phoneNumber: string }
  }
): Promise<{ success: boolean; error?: string; data?: any }> {

  const { user_id, firstName, trigger_type, trigger_data, commPrefs, supabase, twilio } = context

  switch (actionType) {
    case 'send_sms': {
      if (!commPrefs?.phone_number) {
        return { success: false, error: 'No phone number on file' }
      }
      if (commPrefs.sms_enabled === false) {
        return { success: false, error: 'User has SMS disabled' }
      }
      if (!twilio.accountSid) {
        return { success: false, error: 'Twilio not configured' }
      }

      const message = generateActionMessage(actionConfig.template, firstName, trigger_type, trigger_data)

      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`

        const formData = new URLSearchParams()
        formData.append('To', commPrefs.phone_number)
        formData.append('From', twilio.phoneNumber)
        formData.append('Body', message)

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilio.accountSid}:${twilio.authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData
        })

        if (response.ok) {
          const data = await response.json()
          return { success: true, data: { message_sid: data.sid } }
        } else {
          const error = await response.json()
          return { success: false, error: error.message || 'Twilio error' }
        }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }

    case 'schedule_call': {
      // Schedule a voice coach call
      const callType = actionConfig.call_type || 'check_in'
      const scheduledFor = new Date()
      scheduledFor.setHours(scheduledFor.getHours() + 2) // Schedule for 2 hours from now

      const { error } = await supabase
        .from('outreach_queue')
        .insert({
          user_id,
          call_type: callType,
          status: 'queued',
          scheduled_for: scheduledFor.toISOString(),
          priority: actionConfig.priority || 'normal'
        })

      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true, data: { scheduled_for: scheduledFor.toISOString() } }
    }

    case 'create_task': {
      // Create a task/reminder for the user
      const { error } = await supabase
        .from('scheduled_reminders')
        .insert({
          user_id,
          reminder_type: actionConfig.task_type || 'check_in',
          scheduled_for: new Date().toISOString(),
          message: actionConfig.message || null,
          channel: actionConfig.channel || 'sms',
          status: 'pending'
        })

      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true }
    }

    case 'send_email': {
      // TODO: Implement email sending
      return { success: false, error: 'Email sending not yet implemented' }
    }

    default:
      return { success: false, error: `Unknown action type: ${actionType}` }
  }
}

/**
 * Generate message based on template and context
 */
function generateActionMessage(
  template: string,
  firstName: string,
  triggerType: string,
  triggerData: any
): string {
  const templates: Record<string, Record<string, string[]>> = {
    celebration: {
      streak_milestone: [
        `${firstName}, AMAZING! You've hit a ${triggerData.streak}-day streak! Your dedication is truly inspiring.`,
        `WOW ${firstName}! ${triggerData.streak} days strong! You're building something incredible.`
      ]
    },
    encouragement: {
      missed_habit: [
        `Hey ${firstName}, we noticed you've been away for ${triggerData.days_missed} days. No judgment - life happens! Ready to get back on track?`,
        `${firstName}, missing a few days doesn't erase your progress. Your streak might reset, but your growth doesn't. Come back when you're ready!`
      ],
      inactivity: [
        `Hey ${firstName}, checking in! We haven't seen you in a while. Everything okay?`,
        `${firstName}, your goals are waiting for you. No pressure, just a friendly nudge to say we're here when you're ready.`
      ]
    },
    motivation: {
      default: [
        `${firstName}, remember: small steps lead to big changes. You've got this!`,
        `Hey ${firstName}! Your future self will thank you for staying consistent today.`
      ]
    }
  }

  // Get template messages
  let messages = templates[template]?.[triggerType]
  if (!messages) {
    messages = templates.motivation?.default || [`Hey ${firstName}, keep going! You're doing great.`]
  }

  return messages[Math.floor(Math.random() * messages.length)]
}
