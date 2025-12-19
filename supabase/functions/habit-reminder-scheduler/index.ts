import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Habit Reminder Scheduler Edge Function
 *
 * Cron job to schedule daily habit reminders for all users.
 * Should be triggered daily (ideally at midnight for each timezone,
 * or once globally and adjust for user timezones).
 *
 * This function:
 * 1. Gets all users with habit reminders enabled
 * 2. Gets their habits scheduled for today
 * 3. Creates scheduled_habit_reminders records for each
 * 4. The process-scheduled-reminders function will send them at the right time
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

    // Get all users with habit reminders enabled and agent actions enabled
    const { data: usersWithSettings, error: usersError } = await supabase
      .from('user_agent_settings')
      .select(`
        user_id,
        habit_reminders_enabled,
        habit_reminder_channel,
        habit_reminder_timing,
        habit_reminder_minutes_before,
        agent_actions_enabled
      `)
      .eq('habit_reminders_enabled', true)
      .eq('agent_actions_enabled', true)

    if (usersError) {
      console.error('Error fetching users:', usersError)
      throw usersError
    }

    console.log(`Found ${usersWithSettings?.length || 0} users with habit reminders enabled`)

    let totalScheduled = 0
    let totalSkipped = 0

    for (const userSettings of usersWithSettings || []) {
      try {
        // Get user's timezone from comm preferences
        const { data: commPrefs } = await supabase
          .from('user_comm_preferences')
          .select('timezone')
          .eq('user_id', userSettings.user_id)
          .single()

        const userTimezone = commPrefs?.timezone || 'America/New_York'

        // Get today's date in user's timezone
        const now = new Date()
        const userNow = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }))
        const dayOfWeek = userNow.getDay() // 0 = Sunday, 1 = Monday, etc.
        const todayStr = userNow.toISOString().split('T')[0]

        // Get user's active habits
        const { data: habits, error: habitsError } = await supabase
          .from('habits')
          .select('id, title, description, frequency, custom_days, reminder_time, current_streak')
          .eq('user_id', userSettings.user_id)
          .eq('is_active', true)

        if (habitsError) {
          console.error(`Error fetching habits for user ${userSettings.user_id}:`, habitsError)
          continue
        }

        for (const habit of habits || []) {
          // Check if habit is scheduled for today based on frequency
          if (!isHabitScheduledForToday(habit, dayOfWeek)) {
            continue
          }

          // Check if already reminded today
          const { data: existingReminder } = await supabase
            .from('scheduled_habit_reminders')
            .select('id')
            .eq('habit_id', habit.id)
            .gte('scheduled_for', todayStr + 'T00:00:00')
            .lt('scheduled_for', todayStr + 'T23:59:59')
            .single()

          if (existingReminder) {
            totalSkipped++
            continue
          }

          // Check if habit already completed today
          const { data: completion } = await supabase
            .from('habit_completions')
            .select('id')
            .eq('habit_id', habit.id)
            .gte('completed_at', todayStr + 'T00:00:00')
            .single()

          if (completion) {
            // Already completed, no need to remind
            totalSkipped++
            continue
          }

          // Calculate reminder time
          const reminderTime = calculateReminderTime(
            habit.reminder_time,
            userSettings.habit_reminder_timing,
            userSettings.habit_reminder_minutes_before,
            userTimezone,
            todayStr
          )

          // Generate personalized message
          const message = await generateHabitReminderMessage(supabase, habit, userSettings.user_id)

          // Schedule the reminder
          const { error: insertError } = await supabase
            .from('scheduled_habit_reminders')
            .insert({
              user_id: userSettings.user_id,
              habit_id: habit.id,
              scheduled_for: reminderTime.toISOString(),
              reminder_channel: userSettings.habit_reminder_channel || 'push',
              habit_name: habit.title,
              reminder_message: message,
              status: 'scheduled'
            })

          if (insertError) {
            console.error(`Error scheduling reminder for habit ${habit.id}:`, insertError)
            continue
          }

          totalScheduled++
        }
      } catch (userError) {
        console.error(`Error processing user ${userSettings.user_id}:`, userError)
      }
    }

    console.log(`Scheduled ${totalScheduled} reminders, skipped ${totalSkipped}`)

    return new Response(
      JSON.stringify({
        success: true,
        scheduled: totalScheduled,
        skipped: totalSkipped,
        users_processed: usersWithSettings?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('Habit Reminder Scheduler Error:', err.message)
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
 * Check if a habit is scheduled for today based on its frequency
 */
function isHabitScheduledForToday(habit: any, dayOfWeek: number): boolean {
  if (!habit.frequency || habit.frequency === 'daily') {
    return true
  }

  if (habit.frequency === 'weekly' || habit.frequency === 'custom') {
    // Check if today is in custom_days array
    // custom_days is an array of day numbers (0 = Sunday, 1 = Monday, etc.)
    if (Array.isArray(habit.custom_days)) {
      return habit.custom_days.includes(dayOfWeek)
    }
    // If no custom_days specified for weekly, default to true
    return habit.frequency === 'weekly'
  }

  if (habit.frequency === 'weekdays') {
    return dayOfWeek >= 1 && dayOfWeek <= 5
  }

  if (habit.frequency === 'weekends') {
    return dayOfWeek === 0 || dayOfWeek === 6
  }

  // Default to true for unknown frequencies
  return true
}

/**
 * Calculate the reminder time based on habit settings and user preferences
 */
function calculateReminderTime(
  habitReminderTime: string | null,
  timing: string,
  minutesBefore: number,
  timezone: string,
  todayStr: string
): Date {
  let baseTime: Date

  if (habitReminderTime) {
    // Parse habit's specific reminder time (format: "HH:MM" or "HH:MM:SS")
    const [hours, minutes] = habitReminderTime.split(':').map(Number)
    baseTime = new Date(`${todayStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`)
  } else {
    // Default to 9:00 AM in user's timezone
    baseTime = new Date(`${todayStr}T09:00:00`)
  }

  // Adjust based on timing preference
  if (timing === 'before' && minutesBefore > 0) {
    baseTime = new Date(baseTime.getTime() - minutesBefore * 60 * 1000)
  } else if (timing === 'after_miss') {
    // Add 30 minutes after the scheduled time
    baseTime = new Date(baseTime.getTime() + 30 * 60 * 1000)
  }
  // 'at_time' means no adjustment

  return baseTime
}

/**
 * Generate a personalized habit reminder message
 */
async function generateHabitReminderMessage(
  supabase: any,
  habit: any,
  userId: string
): Promise<string> {
  // Get user's name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const streak = habit.current_streak || 0

  // Generate contextual message based on streak
  if (streak === 0) {
    const messages = [
      `Hey ${firstName}! Time for "${habit.title}". Today's a fresh start - let's build that streak!`,
      `${firstName}, ready to start something great? "${habit.title}" is waiting for you!`,
      `New day, new opportunity! Let's get "${habit.title}" done today, ${firstName}!`
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  } else if (streak < 7) {
    const messages = [
      `${firstName}, you're on a ${streak}-day streak with "${habit.title}"! Keep it going today!`,
      `${streak} days strong on "${habit.title}", ${firstName}! Don't break the chain!`,
      `You're building momentum, ${firstName}! Day ${streak + 1} of "${habit.title}" awaits!`
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  } else if (streak < 30) {
    const messages = [
      `Amazing ${streak}-day streak, ${firstName}! "${habit.title}" is becoming second nature!`,
      `${firstName}, ${streak} days of "${habit.title}"! You're making this a real habit!`,
      `Week ${Math.floor(streak / 7)} champion! Keep "${habit.title}" going, ${firstName}!`
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  } else {
    const messages = [
      `${firstName}, ${streak} days strong on "${habit.title}"! You're a legend!`,
      `Month ${Math.floor(streak / 30)} of "${habit.title}"! Incredible dedication, ${firstName}!`,
      `${streak}-day streak master! "${habit.title}" is truly part of who you are now, ${firstName}!`
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  }
}
