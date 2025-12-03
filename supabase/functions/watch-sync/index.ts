import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Watch Sync - Apple Watch Data Synchronization Service
 *
 * This function handles all data sync between the Apple Watch app and Supabase:
 * - get_habits: Fetch active habits with today's completion status
 * - complete_habit: Log a habit completion from Watch
 * - uncomplete_habit: Undo a habit completion from Watch
 * - get_stats: Get user's habit statistics (streaks, counts)
 * - register_device: Register Watch device token for push notifications
 * - get_coach_prompt: Get a micro-coaching message for the Watch
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

    // Authenticate user from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError('Missing Authorization header', 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return jsonError('Unauthorized', 401)
    }

    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'get_habits':
        return await getHabits(supabase, user.id)

      case 'complete_habit':
        return await completeHabit(supabase, user.id, body.habit_id, body.notes)

      case 'uncomplete_habit':
        return await uncompleteHabit(supabase, user.id, body.habit_id)

      case 'get_stats':
        return await getStats(supabase, user.id)

      case 'register_device':
        return await registerDevice(supabase, user.id, body.device_token, body.device_type)

      case 'get_coach_prompt':
        return await getCoachPrompt(supabase, user.id, body.context)

      default:
        return jsonError(`Unknown action: ${action}`, 400)
    }

  } catch (error: any) {
    console.error('Watch sync error:', error.message)
    return jsonError(error.message, 500)
  }
})

/**
 * Get active habits with today's completion status
 */
async function getHabits(supabase: any, userId: string) {
  const today = new Date().toISOString().split('T')[0]

  // Get active habits
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (habitsError) throw habitsError

  // Get today's completions
  const { data: completions, error: compError } = await supabase
    .from('habit_completions')
    .select('habit_id, completed_at')
    .eq('user_id', userId)
    .gte('completed_at', `${today}T00:00:00`)
    .lte('completed_at', `${today}T23:59:59`)

  if (compError) throw compError

  const completedHabitIds = new Set(completions?.map((c: any) => c.habit_id) || [])

  // Calculate streaks for each habit
  const habitsWithStatus = await Promise.all((habits || []).map(async (habit: any) => {
    // Simple streak calculation - count consecutive days backward
    const streak = await calculateStreak(supabase, habit.id, userId)

    return {
      id: habit.id,
      title: habit.title,
      description: habit.description,
      frequency: habit.frequency,
      reminderTime: habit.reminder_time,
      completedToday: completedHabitIds.has(habit.id),
      currentStreak: streak,
      targetCount: habit.target_count || 1
    }
  }))

  return jsonSuccess({
    habits: habitsWithStatus,
    syncedAt: new Date().toISOString()
  })
}

/**
 * Calculate consecutive day streak for a habit
 */
async function calculateStreak(supabase: any, habitId: string, userId: string): Promise<number> {
  const { data: completions, error } = await supabase
    .from('habit_completions')
    .select('completed_at')
    .eq('habit_id', habitId)
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(100)

  if (error || !completions?.length) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get unique dates
  const completedDates = [...new Set(completions.map((c: any) =>
    new Date(c.completed_at).toISOString().split('T')[0]
  ))].sort().reverse()

  // Check if completed today or yesterday to start streak
  const todayStr = today.toISOString().split('T')[0]
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  if (completedDates[0] !== todayStr && completedDates[0] !== yesterdayStr) {
    return 0 // Streak broken
  }

  // Count consecutive days
  let checkDate = new Date(completedDates[0])
  for (const dateStr of completedDates) {
    const date = new Date(dateStr)
    const checkDateStr = checkDate.toISOString().split('T')[0]

    if (dateStr === checkDateStr) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

/**
 * Log a habit completion from Watch
 */
async function completeHabit(supabase: any, userId: string, habitId: string, notes?: string) {
  if (!habitId) {
    return jsonError('habit_id is required', 400)
  }

  // Check if already completed today
  const today = new Date().toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('habit_completions')
    .select('id')
    .eq('habit_id', habitId)
    .eq('user_id', userId)
    .gte('completed_at', `${today}T00:00:00`)
    .lte('completed_at', `${today}T23:59:59`)
    .single()

  if (existing) {
    return jsonSuccess({
      success: true,
      alreadyCompleted: true,
      completionId: existing.id
    })
  }

  // Insert completion
  const { data: completion, error } = await supabase
    .from('habit_completions')
    .insert({
      habit_id: habitId,
      user_id: userId,
      completed_at: new Date().toISOString(),
      notes: notes || null,
      source: 'watch' // Track that this came from Watch
    })
    .select()
    .single()

  if (error) throw error

  // Calculate new streak
  const newStreak = await calculateStreak(supabase, habitId, userId)

  // Check for streak milestones and trigger notification if needed
  if ([7, 30, 100].includes(newStreak)) {
    await triggerStreakMilestone(supabase, userId, habitId, newStreak)
  }

  return jsonSuccess({
    success: true,
    completion,
    newStreak,
    isMilestone: [7, 30, 100].includes(newStreak)
  })
}

/**
 * Undo a habit completion from Watch
 */
async function uncompleteHabit(supabase: any, userId: string, habitId: string) {
  if (!habitId) {
    return jsonError('habit_id is required', 400)
  }

  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('habit_completions')
    .delete()
    .eq('habit_id', habitId)
    .eq('user_id', userId)
    .gte('completed_at', `${today}T00:00:00`)
    .lte('completed_at', `${today}T23:59:59`)

  if (error) throw error

  return jsonSuccess({ success: true, undone: true })
}

/**
 * Get user's habit statistics
 */
async function getStats(supabase: any, userId: string) {
  const { data: habits, error } = await supabase
    .from('habits')
    .select('id, title')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) throw error

  const today = new Date().toISOString().split('T')[0]

  // Get today's completions
  const { data: todayCompletions } = await supabase
    .from('habit_completions')
    .select('habit_id')
    .eq('user_id', userId)
    .gte('completed_at', `${today}T00:00:00`)
    .lte('completed_at', `${today}T23:59:59`)

  const completedToday = new Set(todayCompletions?.map((c: any) => c.habit_id) || [])

  // Calculate longest streak
  let longestStreak = 0
  for (const habit of habits || []) {
    const streak = await calculateStreak(supabase, habit.id, userId)
    if (streak > longestStreak) longestStreak = streak
  }

  // Get total completions this week
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const { count: weeklyCompletions } = await supabase
    .from('habit_completions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('completed_at', weekAgo.toISOString())

  return jsonSuccess({
    totalHabits: habits?.length || 0,
    completedToday: completedToday.size,
    remainingToday: (habits?.length || 0) - completedToday.size,
    longestStreak,
    weeklyCompletions: weeklyCompletions || 0
  })
}

/**
 * Register Watch device for push notifications
 */
async function registerDevice(supabase: any, userId: string, deviceToken: string, deviceType: string) {
  if (!deviceToken) {
    return jsonError('device_token is required', 400)
  }

  // Upsert device token
  const { data, error } = await supabase
    .from('user_device_tokens')
    .upsert({
      user_id: userId,
      device_token: deviceToken,
      device_type: deviceType || 'watch',
      platform: 'apns',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,device_token'
    })
    .select()
    .single()

  if (error) throw error

  return jsonSuccess({ success: true, device: data })
}

/**
 * Get a micro-coaching prompt for Watch display
 */
async function getCoachPrompt(supabase: any, userId: string, context?: string) {
  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('names')
    .eq('id', userId)
    .single()

  const firstName = profile?.names?.split(' ')[0] || 'there'

  // Get stats for personalization
  const { data: habits } = await supabase
    .from('habits')
    .select('id, title')
    .eq('user_id', userId)
    .eq('is_active', true)

  let longestStreak = 0
  let habitWithStreak = ''
  for (const habit of habits || []) {
    const streak = await calculateStreak(supabase, habit.id, userId)
    if (streak > longestStreak) {
      longestStreak = streak
      habitWithStreak = habit.title
    }
  }

  // Generate contextual message
  let message = ''
  const hour = new Date().getHours()

  if (context === 'morning' || hour < 12) {
    message = `Good morning, ${firstName}! Your streak of ${longestStreak} days on "${habitWithStreak}" shows incredible dedication. Keep building momentum today.`
  } else if (context === 'completion' && longestStreak >= 7) {
    message = `Amazing work, ${firstName}! ${longestStreak} days strong. You're proving that consistency beats intensity.`
  } else if (longestStreak >= 30) {
    message = `${firstName}, you've built a powerful ${longestStreak}-day habit. This is the foundation of your vision becoming reality.`
  } else if (longestStreak > 0) {
    message = `Keep going, ${firstName}! Every day you complete your habits brings your vision closer. ${longestStreak} days and counting!`
  } else {
    message = `${firstName}, today is a fresh start. One small action now sets the tone for everything else. You've got this.`
  }

  return jsonSuccess({
    message,
    streak: longestStreak,
    habitCount: habits?.length || 0
  })
}

/**
 * Trigger streak milestone notification
 */
async function triggerStreakMilestone(supabase: any, userId: string, habitId: string, streak: number) {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')

    await fetch(`${SUPABASE_URL}/functions/v1/schedule-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        action: 'trigger_event',
        userId,
        eventType: 'habit_completed',
        eventData: { habitId, streak }
      })
    })
  } catch (err) {
    console.error('Failed to trigger streak milestone:', err)
  }
}

// Response helpers
function jsonSuccess(data: any): Response {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

function jsonError(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}
