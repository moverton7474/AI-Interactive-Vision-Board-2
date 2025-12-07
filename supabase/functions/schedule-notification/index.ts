import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Schedule Notification - AI Agent Notification Trigger Service
 *
 * This function handles:
 * 1. Scheduling future notifications (creates scheduled_checkins record)
 * 2. Processing due notifications (called by cron or manually)
 * 3. Triggering immediate notifications based on events
 *
 * Trigger Types:
 * - habit_reminder: Daily habit check-ins
 * - weekly_review: Weekly progress summaries
 * - milestone_reminder: Upcoming milestone alerts
 * - pace_warning: Goal pace warnings
 * - streak_celebration: Streak milestones (7, 30, 100 days)
 * - custom: Custom messages from AI Agent
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'schedule':
        return await scheduleNotification(supabase, body)

      case 'process_due':
        return await processDueNotifications(supabase)

      case 'trigger_event':
        return await triggerEventNotification(supabase, body)

      case 'check_habits':
        return await checkHabitReminders(supabase)

      case 'check_streaks':
        return await checkStreakMilestones(supabase)

      case 'check_pace':
        return await checkPaceWarnings(supabase)

      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error: any) {
    console.error('Schedule notification error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Schedule a future notification
 */
async function scheduleNotification(supabase: any, params: any) {
  const { userId, checkinType, scheduledFor, channel, content } = params

  const { data, error } = await supabase
    .from('scheduled_checkins')
    .insert({
      user_id: userId,
      checkin_type: checkinType || 'custom',
      scheduled_for: scheduledFor || new Date().toISOString(),
      channel: channel || 'sms',
      status: 'pending',
      content: content || {}
    })
    .select()
    .single()

  if (error) throw error

  return new Response(
    JSON.stringify({ success: true, checkin: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Process all due notifications
 */
async function processDueNotifications(supabase: any) {
  const now = new Date().toISOString()

  // Get pending notifications that are due
  const { data: dueNotifications, error } = await supabase
    .from('scheduled_checkins')
    .select(`
      *,
      profiles:user_id (names),
      user_comm_preferences:user_id (phone_number, preferred_channel, quiet_hours)
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(50)

  if (error) throw error

  const results = []

  for (const notification of dueNotifications || []) {
    try {
      // Check quiet hours
      if (isInQuietHours(notification.user_comm_preferences?.quiet_hours)) {
        // Reschedule for after quiet hours
        await supabase
          .from('scheduled_checkins')
          .update({
            scheduled_for: getNextAvailableTime(notification.user_comm_preferences?.quiet_hours),
            status: 'pending'
          })
          .eq('id', notification.id)

        results.push({ id: notification.id, status: 'rescheduled' })
        continue
      }

      // Send notification based on channel
      const channel = notification.channel || notification.user_comm_preferences?.preferred_channel || 'sms'

      if (channel === 'sms' || channel === 'push') {
        await sendSmsNotification(supabase, notification)
      } else if (channel === 'call') {
        await sendCallNotification(supabase, notification)
      }

      // Mark as sent
      await supabase
        .from('scheduled_checkins')
        .update({ status: 'sent' })
        .eq('id', notification.id)

      results.push({ id: notification.id, status: 'sent', channel })

    } catch (err: any) {
      console.error(`Failed to send notification ${notification.id}:`, err.message)

      await supabase
        .from('scheduled_checkins')
        .update({ status: 'failed', response: { error: err.message } })
        .eq('id', notification.id)

      results.push({ id: notification.id, status: 'failed', error: err.message })
    }
  }

  return new Response(
    JSON.stringify({ success: true, processed: results.length, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Trigger notification based on an event
 */
async function triggerEventNotification(supabase: any, params: any) {
  const { userId, eventType, eventData } = params

  // Get user preferences
  const { data: prefs } = await supabase
    .from('user_comm_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('names')
    .eq('id', userId)
    .single()

  const templateData = {
    name: profile?.names?.split(' ')[0] || 'there',
    ...eventData
  }

  // Determine template and channel based on event
  let template = 'generic'
  let channel = prefs?.preferred_channel || 'sms'

  switch (eventType) {
    case 'habit_completed':
      if (eventData.streak && [7, 30, 100].includes(eventData.streak)) {
        template = 'streak_milestone'
      }
      break

    case 'milestone_approaching':
      template = 'milestone_reminder'
      break

    case 'pace_falling_behind':
      template = 'pace_warning'
      break

    case 'weekly_review_ready':
      template = 'weekly_review'
      break

    case 'welcome':
      template = 'welcome'
      break
  }

  // Send immediately via appropriate channel
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')

  if (channel === 'sms' || channel === 'push') {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        userId,
        template,
        templateData
      })
    })
  } else if (channel === 'call' && prefs?.call_enabled) {
    await fetch(`${SUPABASE_URL}/functions/v1/make-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        userId,
        template,
        templateData
      })
    })
  }

  return new Response(
    JSON.stringify({ success: true, eventType, template, channel }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Check for habit reminders to send
 */
async function checkHabitReminders(supabase: any) {
  const now = new Date()

  // Find all active habits
  const { data: habits, error } = await supabase
    .from('habits')
    .select(`
      *,
      profiles:user_id (names),
      user_comm_preferences:user_id (phone_number, preferred_channel, timezone)
    `)
    .eq('is_active', true)

  if (error) throw error

  const sent = []

  // Group by user to optimize checks
  const habitsByUser: Record<string, any[]> = {}
  for (const habit of habits || []) {
    if (!habitsByUser[habit.user_id]) habitsByUser[habit.user_id] = []
    habitsByUser[habit.user_id].push(habit)
  }

  // Process each user
  for (const userId of Object.keys(habitsByUser)) {
    const userHabits = habitsByUser[userId]
    if (userHabits.length === 0) continue

    const prefs = userHabits[0].user_comm_preferences
    const timezone = prefs?.timezone || 'UTC'

    // Get user's local time
    let localTimeStr: string;
    try {
      localTimeStr = new Date().toLocaleString('en-US', { timeZone: timezone, hour12: false });
    } catch (e) {
      console.warn(`Invalid timezone ${timezone}, falling back to UTC`);
      localTimeStr = new Date().toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
    }

    const localDate = new Date(localTimeStr)
    const currentHour = localDate.getHours()
    const currentMinute = localDate.getMinutes()

    // Determine "Smart" hour (Peak Activity) for this user
    // We infer this logic: If we haven't cached it, we fetch it via RPC
    let smartHour = 9; // Default
    try {
      const { data: peak } = await supabase.rpc('get_user_peak_activity_hour', { p_user_id: userId })
      if (peak !== null) smartHour = peak
    } catch (e) {
      console.warn('Failed to get peak activity:', e)
    }

    // Check each habit
    for (const habit of userHabits) {
      let shouldRemind = false

      if (habit.reminder_time) {
        // Strict Time Match (User Local Time)
        const [h, m] = habit.reminder_time.split(':').map(Number)
        // Match if hour is exact and minute is within last 15 mins (cron window)
        // Assuming cron runs every 15 mins
        if (currentHour === h && Math.abs(currentMinute - m) < 15) {
          shouldRemind = true
        }
      } else {
        // Smart Reminder (No fixed time)
        // Send if current hour matches Peak Activity Hour
        // And it's the top of the hour (0-15 mins) to avoid repeat
        if (currentHour === smartHour && currentMinute < 15) {
          shouldRemind = true
        }
      }

      if (shouldRemind) {
        // Check if already completed today (in User Local Date)
        // Need formatting YYYY-MM-DD in local time
        const year = localDate.getFullYear()
        const month = String(localDate.getMonth() + 1).padStart(2, '0')
        const day = String(localDate.getDate()).padStart(2, '0')
        const todayStr = `${year}-${month}-${day}` // Local "Today"

        const { data: completion } = await supabase
          .from('habit_completions')
          .select('id')
          .eq('habit_id', habit.id)
          .eq('completed_at', todayStr)
          .single()

        if (!completion) {
          // Calculate streak
          const { data: streakData } = await supabase
            .rpc('calculate_streak', { p_habit_id: habit.id })

          // Send reminder (Reuse existing send logic)
          // Note: We use existing sendSmsNotification helper indirectly or direct fetch
          // Existing code used direct fetch to send-sms. We keep that pattern.

          const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
          await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              userId: habit.user_id,
              template: 'habit_reminder',
              templateData: {
                name: habit.profiles?.names?.split(' ')[0] || 'there',
                habitTitle: habit.title,
                streak: streakData || 0
              }
            })
          })

          sent.push({ habitId: habit.id, userId: habit.user_id, type: habit.reminder_time ? 'fixed' : 'smart' })
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ success: true, habitReminders: sent.length, sent }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Check for streak milestones to celebrate
 */
async function checkStreakMilestones(supabase: any) {
  const milestones = [7, 30, 100]
  const celebrated = []

  // Get recent achievements to avoid duplicates
  const { data: achievements } = await supabase
    .from('user_achievements')
    .select('user_id, achievement_key, value')
    .in('achievement_key', ['7_day_streak', '30_day_streak', '100_day_streak'])

  const achievementMap = new Set(
    (achievements || []).map((a: any) => `${a.user_id}_${a.achievement_key}`)
  )

  // Find habits with milestone streaks
  const { data: habits } = await supabase
    .from('habits')
    .select(`
      id,
      user_id,
      title,
      profiles:user_id (names)
    `)
    .eq('is_active', true)

  for (const habit of habits || []) {
    const { data: streak } = await supabase
      .rpc('calculate_streak', { p_habit_id: habit.id })

    if (milestones.includes(streak)) {
      const achievementKey = `${streak}_day_streak`
      const mapKey = `${habit.user_id}_${achievementKey}`

      if (!achievementMap.has(mapKey)) {
        // Send celebration notification
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            userId: habit.user_id,
            template: 'streak_milestone',
            templateData: {
              name: habit.profiles?.names?.split(' ')[0] || 'there',
              habitTitle: habit.title,
              streak
            }
          })
        })

        celebrated.push({ userId: habit.user_id, habitId: habit.id, streak })
      }
    }
  }

  return new Response(
    JSON.stringify({ success: true, celebrations: celebrated.length, celebrated }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Check for pace warnings to send
 */
async function checkPaceWarnings(supabase: any) {
  const { data: predictions, error } = await supabase
    .from('progress_predictions')
    .select(`
      *,
      profiles:user_id (names)
    `)
    .lt('current_pace', 0.8) // Behind pace threshold
    .gte('calculated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Recent

  if (error) throw error

  const warned = []

  for (const prediction of predictions || []) {
    // Calculate delay
    const targetDate = new Date(prediction.target_date)
    const predictedDate = new Date(prediction.predicted_completion_date)
    const delayWeeks = Math.ceil((predictedDate.getTime() - targetDate.getTime()) / (7 * 24 * 60 * 60 * 1000))

    if (delayWeeks > 0) {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
      await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          userId: prediction.user_id,
          template: 'pace_warning',
          templateData: {
            name: prediction.profiles?.names?.split(' ')[0] || 'there',
            goalTitle: prediction.goal_type,
            delayWeeks
          }
        })
      })

      warned.push({ userId: prediction.user_id, goalType: prediction.goal_type, delayWeeks })
    }
  }

  return new Response(
    JSON.stringify({ success: true, warnings: warned.length, warned }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Helper functions
async function sendSmsNotification(supabase: any, notification: any) {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    },
    body: JSON.stringify({
      userId: notification.user_id,
      message: notification.content?.message,
      template: notification.content?.template,
      templateData: {
        name: notification.profiles?.names?.split(' ')[0] || 'there',
        ...notification.content?.templateData
      }
    })
  })
}

async function sendCallNotification(supabase: any, notification: any) {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  await fetch(`${SUPABASE_URL}/functions/v1/make-call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    },
    body: JSON.stringify({
      userId: notification.user_id,
      message: notification.content?.message,
      template: notification.content?.template,
      templateData: {
        name: notification.profiles?.names?.split(' ')[0] || 'there',
        ...notification.content?.templateData
      }
    })
  })
}

function isInQuietHours(quietHours: any): boolean {
  if (!quietHours) return false

  const now = new Date()
  const currentHour = now.getHours()
  const startHour = parseInt(quietHours.start?.split(':')[0] || '22')
  const endHour = parseInt(quietHours.end?.split(':')[0] || '7')

  if (startHour > endHour) {
    // Quiet hours span midnight (e.g., 22:00 - 07:00)
    return currentHour >= startHour || currentHour < endHour
  } else {
    return currentHour >= startHour && currentHour < endHour
  }
}

function getNextAvailableTime(quietHours: any): string {
  const endHour = parseInt(quietHours?.end?.split(':')[0] || '7')
  const tomorrow = new Date()
  tomorrow.setHours(endHour, 0, 0, 0)

  if (tomorrow < new Date()) {
    tomorrow.setDate(tomorrow.getDate() + 1)
  }

  return tomorrow.toISOString()
}
