import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Habit Service - Core Habit Management API
 *
 * Actions:
 * - create: Create a new habit
 * - complete: Record habit completion (triggers streak calculation)
 * - list: List user habits with current streaks
 * - stats: Get completion rates and streak statistics
 * - delete: Delete a habit
 * - update: Update habit details
 * - uncomplete: Remove a completion (undo)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' }
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create client with user's auth token for RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid or expired authentication token')
    }

    const userId = user.id

    // Get action from query params or body
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    let body = {}
    if (req.method === 'POST' || req.method === 'DELETE') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    // Route to appropriate handler
    switch (action) {
      case 'create':
        return await createHabit(supabase, userId, body)
      case 'complete':
        return await completeHabit(supabase, userId, body)
      case 'uncomplete':
        return await uncompleteHabit(supabase, userId, body)
      case 'list':
        return await listHabits(supabase, userId, url.searchParams)
      case 'stats':
        return await getHabitStats(supabase, userId, url.searchParams)
      case 'delete':
        return await deleteHabit(supabase, userId, body)
      case 'update':
        return await updateHabit(supabase, userId, body)
      case 'get':
        return await getHabit(supabase, userId, url.searchParams)
      default:
        throw new Error(`Unknown action: ${action}. Valid actions: create, complete, uncomplete, list, stats, delete, update, get`)
    }

  } catch (error: any) {
    console.error('Habit service error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Create a new habit
 */
async function createHabit(supabase: any, userId: string, body: any) {
  const { title, description, frequency, customDays, reminderTime, taskId } = body

  if (!title) {
    throw new Error('Habit title is required')
  }

  const habitData: any = {
    user_id: userId,
    title,
    description: description || null,
    frequency: frequency || 'daily',
    custom_days: customDays || [],
    reminder_time: reminderTime || null,
    task_id: taskId || null,
    is_active: true
  }

  const { data: habit, error } = await supabase
    .from('habits')
    .insert(habitData)
    .select()
    .single()

  if (error) {
    console.error('Create habit error:', error)
    throw new Error(`Failed to create habit: ${error.message}`)
  }

  // Schedule reminder if reminder_time is set
  if (reminderTime) {
    await scheduleHabitReminder(supabase, userId, habit.id, reminderTime)
  }

  console.log('Habit created:', habit.id)

  return new Response(
    JSON.stringify({
      success: true,
      habit: {
        ...habit,
        currentStreak: 0,
        longestStreak: 0,
        completedToday: false
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Record habit completion
 */
async function completeHabit(supabase: any, userId: string, body: any) {
  const { habitId, date, notes, moodRating } = body

  if (!habitId) {
    throw new Error('Habit ID is required')
  }

  // Verify habit belongs to user
  const { data: habit, error: habitError } = await supabase
    .from('habits')
    .select('id, title, user_id')
    .eq('id', habitId)
    .eq('user_id', userId)
    .single()

  if (habitError || !habit) {
    throw new Error('Habit not found or access denied')
  }

  const completionDate = date || new Date().toISOString().split('T')[0]

  // Insert completion (unique constraint will prevent duplicates)
  const { data: completion, error: completionError } = await supabase
    .from('habit_completions')
    .insert({
      habit_id: habitId,
      completed_at: completionDate,
      notes: notes || null,
      mood_rating: moodRating || null
    })
    .select()
    .single()

  if (completionError) {
    if (completionError.code === '23505') {
      throw new Error('Habit already completed for this date')
    }
    throw new Error(`Failed to record completion: ${completionError.message}`)
  }

  // Get updated streak (calculated by PostgreSQL trigger)
  const { data: streakData } = await supabase
    .rpc('calculate_streak', { p_habit_id: habitId })

  const currentStreak = streakData || 0

  // Check for streak milestones and trigger notifications
  await checkStreakMilestone(supabase, userId, habitId, habit.title, currentStreak)

  console.log('Habit completed:', habitId, 'Streak:', currentStreak)

  return new Response(
    JSON.stringify({
      success: true,
      completion,
      currentStreak,
      habitTitle: habit.title
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Remove a habit completion (undo)
 */
async function uncompleteHabit(supabase: any, userId: string, body: any) {
  const { habitId, date } = body

  if (!habitId) {
    throw new Error('Habit ID is required')
  }

  // Verify habit belongs to user
  const { data: habit, error: habitError } = await supabase
    .from('habits')
    .select('id, user_id')
    .eq('id', habitId)
    .eq('user_id', userId)
    .single()

  if (habitError || !habit) {
    throw new Error('Habit not found or access denied')
  }

  const completionDate = date || new Date().toISOString().split('T')[0]

  const { error: deleteError } = await supabase
    .from('habit_completions')
    .delete()
    .eq('habit_id', habitId)
    .eq('completed_at', completionDate)

  if (deleteError) {
    throw new Error(`Failed to remove completion: ${deleteError.message}`)
  }

  // Get updated streak
  const { data: streakData } = await supabase
    .rpc('calculate_streak', { p_habit_id: habitId })

  return new Response(
    JSON.stringify({
      success: true,
      currentStreak: streakData || 0,
      message: 'Completion removed'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * List user habits with current streaks
 */
async function listHabits(supabase: any, userId: string, params: URLSearchParams) {
  const includeInactive = params.get('includeInactive') === 'true'
  const taskId = params.get('taskId')

  let query = supabase
    .from('habits')
    .select(`
      id,
      title,
      description,
      frequency,
      custom_days,
      reminder_time,
      task_id,
      is_active,
      created_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  if (taskId) {
    query = query.eq('task_id', taskId)
  }

  const { data: habits, error } = await query

  if (error) {
    throw new Error(`Failed to fetch habits: ${error.message}`)
  }

  // Get today's date for completion check
  const today = new Date().toISOString().split('T')[0]

  // Enrich each habit with streak data and completion status
  const enrichedHabits = await Promise.all(
    habits.map(async (habit: any) => {
      // Get current streak
      const { data: streakData } = await supabase
        .rpc('calculate_streak', { p_habit_id: habit.id })

      // Check if completed today
      const { data: todayCompletion } = await supabase
        .from('habit_completions')
        .select('id')
        .eq('habit_id', habit.id)
        .eq('completed_at', today)
        .single()

      // Get longest streak from achievements
      const { data: longestStreakData } = await supabase
        .from('user_achievements')
        .select('value')
        .eq('user_id', userId)
        .eq('achievement_key', `habit_streak_${habit.id}`)
        .single()

      // Get total completions count
      const { count: totalCompletions } = await supabase
        .from('habit_completions')
        .select('id', { count: 'exact', head: true })
        .eq('habit_id', habit.id)

      return {
        ...habit,
        currentStreak: streakData || 0,
        longestStreak: longestStreakData?.value || streakData || 0,
        completedToday: !!todayCompletion,
        totalCompletions: totalCompletions || 0
      }
    })
  )

  return new Response(
    JSON.stringify({
      success: true,
      habits: enrichedHabits,
      count: enrichedHabits.length
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get a single habit with details
 */
async function getHabit(supabase: any, userId: string, params: URLSearchParams) {
  const habitId = params.get('habitId')

  if (!habitId) {
    throw new Error('Habit ID is required')
  }

  const { data: habit, error } = await supabase
    .from('habits')
    .select('*')
    .eq('id', habitId)
    .eq('user_id', userId)
    .single()

  if (error || !habit) {
    throw new Error('Habit not found')
  }

  // Get streak
  const { data: streakData } = await supabase
    .rpc('calculate_streak', { p_habit_id: habitId })

  // Get recent completions
  const { data: recentCompletions } = await supabase
    .from('habit_completions')
    .select('*')
    .eq('habit_id', habitId)
    .order('completed_at', { ascending: false })
    .limit(30)

  // Check if completed today
  const today = new Date().toISOString().split('T')[0]
  const completedToday = recentCompletions?.some(
    (c: any) => c.completed_at === today
  ) || false

  return new Response(
    JSON.stringify({
      success: true,
      habit: {
        ...habit,
        currentStreak: streakData || 0,
        completedToday,
        recentCompletions: recentCompletions || []
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get habit statistics
 */
async function getHabitStats(supabase: any, userId: string, params: URLSearchParams) {
  const habitId = params.get('habitId')
  const period = params.get('period') || '30' // days

  const periodDays = parseInt(period)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - periodDays)
  const startDateStr = startDate.toISOString().split('T')[0]

  if (habitId) {
    // Stats for specific habit
    return await getSingleHabitStats(supabase, userId, habitId, startDateStr, periodDays)
  } else {
    // Aggregate stats for all habits
    return await getAllHabitsStats(supabase, userId, startDateStr, periodDays)
  }
}

async function getSingleHabitStats(
  supabase: any,
  userId: string,
  habitId: string,
  startDate: string,
  periodDays: number
) {
  // Verify habit belongs to user
  const { data: habit, error: habitError } = await supabase
    .from('habits')
    .select('id, title, frequency, created_at')
    .eq('id', habitId)
    .eq('user_id', userId)
    .single()

  if (habitError || !habit) {
    throw new Error('Habit not found')
  }

  // Get completions in period
  const { data: completions, error: completionsError } = await supabase
    .from('habit_completions')
    .select('completed_at, mood_rating, notes')
    .eq('habit_id', habitId)
    .gte('completed_at', startDate)
    .order('completed_at', { ascending: true })

  if (completionsError) {
    throw new Error(`Failed to fetch completions: ${completionsError.message}`)
  }

  // Get current streak
  const { data: streakData } = await supabase
    .rpc('calculate_streak', { p_habit_id: habitId })

  // Calculate expected days based on frequency
  const expectedDays = calculateExpectedDays(habit.frequency, periodDays, habit.created_at)
  const completedDays = completions?.length || 0
  const completionRate = expectedDays > 0 ? (completedDays / expectedDays) * 100 : 0

  // Calculate average mood
  const moodRatings = completions?.filter((c: any) => c.mood_rating).map((c: any) => c.mood_rating) || []
  const averageMood = moodRatings.length > 0
    ? moodRatings.reduce((a: number, b: number) => a + b, 0) / moodRatings.length
    : null

  // Build completion calendar
  const completionDates = completions?.map((c: any) => c.completed_at) || []

  return new Response(
    JSON.stringify({
      success: true,
      stats: {
        habitId,
        habitTitle: habit.title,
        period: `${periodDays} days`,
        currentStreak: streakData || 0,
        completedDays,
        expectedDays,
        completionRate: Math.round(completionRate * 10) / 10,
        averageMood: averageMood ? Math.round(averageMood * 10) / 10 : null,
        completionDates,
        frequency: habit.frequency
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function getAllHabitsStats(
  supabase: any,
  userId: string,
  startDate: string,
  periodDays: number
) {
  // Get all active habits
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select('id, title, frequency, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (habitsError) {
    throw new Error(`Failed to fetch habits: ${habitsError.message}`)
  }

  if (!habits || habits.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          totalHabits: 0,
          overallCompletionRate: 0,
          totalCompletions: 0,
          bestStreak: 0,
          habitsWithStreaks: 0,
          habitStats: []
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get stats for each habit
  const habitStats = await Promise.all(
    habits.map(async (habit: any) => {
      const { data: completions } = await supabase
        .from('habit_completions')
        .select('completed_at')
        .eq('habit_id', habit.id)
        .gte('completed_at', startDate)

      const { data: streakData } = await supabase
        .rpc('calculate_streak', { p_habit_id: habit.id })

      const expectedDays = calculateExpectedDays(habit.frequency, periodDays, habit.created_at)
      const completedDays = completions?.length || 0
      const completionRate = expectedDays > 0 ? (completedDays / expectedDays) * 100 : 0

      return {
        habitId: habit.id,
        habitTitle: habit.title,
        currentStreak: streakData || 0,
        completedDays,
        expectedDays,
        completionRate: Math.round(completionRate * 10) / 10
      }
    })
  )

  // Calculate aggregates
  const totalCompletions = habitStats.reduce((sum, h) => sum + h.completedDays, 0)
  const totalExpected = habitStats.reduce((sum, h) => sum + h.expectedDays, 0)
  const overallRate = totalExpected > 0 ? (totalCompletions / totalExpected) * 100 : 0
  const bestStreak = Math.max(...habitStats.map(h => h.currentStreak), 0)
  const habitsWithStreaks = habitStats.filter(h => h.currentStreak > 0).length

  // Get achievement badges
  const { data: achievements } = await supabase
    .from('user_achievements')
    .select('achievement_type, achievement_key, value, earned_at')
    .eq('user_id', userId)
    .eq('achievement_type', 'badge')

  return new Response(
    JSON.stringify({
      success: true,
      stats: {
        period: `${periodDays} days`,
        totalHabits: habits.length,
        overallCompletionRate: Math.round(overallRate * 10) / 10,
        totalCompletions,
        bestStreak,
        habitsWithStreaks,
        habitStats,
        achievements: achievements || []
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Update habit details
 */
async function updateHabit(supabase: any, userId: string, body: any) {
  const { habitId, title, description, frequency, customDays, reminderTime, isActive } = body

  if (!habitId) {
    throw new Error('Habit ID is required')
  }

  // Verify habit belongs to user
  const { data: existing, error: existingError } = await supabase
    .from('habits')
    .select('id')
    .eq('id', habitId)
    .eq('user_id', userId)
    .single()

  if (existingError || !existing) {
    throw new Error('Habit not found or access denied')
  }

  const updates: any = {}
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (frequency !== undefined) updates.frequency = frequency
  if (customDays !== undefined) updates.custom_days = customDays
  if (reminderTime !== undefined) updates.reminder_time = reminderTime
  if (isActive !== undefined) updates.is_active = isActive

  if (Object.keys(updates).length === 0) {
    throw new Error('No updates provided')
  }

  const { data: habit, error } = await supabase
    .from('habits')
    .update(updates)
    .eq('id', habitId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update habit: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      habit
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Delete a habit
 */
async function deleteHabit(supabase: any, userId: string, body: any) {
  const { habitId, permanent } = body

  if (!habitId) {
    throw new Error('Habit ID is required')
  }

  // Verify habit belongs to user
  const { data: existing, error: existingError } = await supabase
    .from('habits')
    .select('id, title')
    .eq('id', habitId)
    .eq('user_id', userId)
    .single()

  if (existingError || !existing) {
    throw new Error('Habit not found or access denied')
  }

  if (permanent) {
    // Permanent delete (cascades to completions due to FK)
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', habitId)

    if (error) {
      throw new Error(`Failed to delete habit: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Habit "${existing.title}" permanently deleted`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } else {
    // Soft delete (mark inactive)
    const { error } = await supabase
      .from('habits')
      .update({ is_active: false })
      .eq('id', habitId)

    if (error) {
      throw new Error(`Failed to deactivate habit: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Habit "${existing.title}" deactivated`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Helper: Calculate expected completion days based on frequency
 */
function calculateExpectedDays(
  frequency: string,
  periodDays: number,
  createdAt: string
): number {
  const habitAge = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  const effectiveDays = Math.min(periodDays, habitAge + 1)

  switch (frequency) {
    case 'daily':
      return effectiveDays
    case 'weekdays':
      // Approximate: 5/7 of days
      return Math.round(effectiveDays * (5 / 7))
    case 'weekly':
      return Math.ceil(effectiveDays / 7)
    default:
      return effectiveDays
  }
}

/**
 * Helper: Schedule habit reminder notification
 */
async function scheduleHabitReminder(
  supabase: any,
  userId: string,
  habitId: string,
  reminderTime: string
) {
  // Get user's timezone preference
  const { data: prefs } = await supabase
    .from('user_comm_preferences')
    .select('timezone, preferred_channel')
    .eq('user_id', userId)
    .single()

  const timezone = prefs?.timezone || 'America/New_York'
  const channel = prefs?.preferred_channel || 'push'

  // Calculate next occurrence of reminder time
  const now = new Date()
  const [hours, minutes] = reminderTime.split(':').map(Number)
  const scheduledFor = new Date(now)
  scheduledFor.setHours(hours, minutes, 0, 0)

  if (scheduledFor <= now) {
    scheduledFor.setDate(scheduledFor.getDate() + 1)
  }

  await supabase
    .from('scheduled_checkins')
    .insert({
      user_id: userId,
      checkin_type: 'daily_habit',
      scheduled_for: scheduledFor.toISOString(),
      channel,
      status: 'pending',
      content: {
        habit_id: habitId,
        type: 'reminder'
      }
    })
}

/**
 * Helper: Check for streak milestones and trigger celebrations
 */
async function checkStreakMilestone(
  supabase: any,
  userId: string,
  habitId: string,
  habitTitle: string,
  currentStreak: number
) {
  const milestones = [7, 14, 21, 30, 60, 90, 100, 180, 365]

  if (milestones.includes(currentStreak)) {
    // Log milestone achievement
    console.log(`Streak milestone reached: ${habitTitle} - ${currentStreak} days`)

    // Call celebrate-streak function for notification handling
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
      const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

      const celebrateResponse = await fetch(`${SUPABASE_URL}/functions/v1/celebrate-streak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          habitId,
          userId,
          newStreak: currentStreak
        })
      })

      if (celebrateResponse.ok) {
        const result = await celebrateResponse.json()
        console.log(`Celebration result:`, result)
      } else {
        console.error('Celebrate-streak call failed:', await celebrateResponse.text())
      }
    } catch (celebrateError) {
      console.error('Error calling celebrate-streak:', celebrateError)

      // Fallback: Insert into scheduled_checkins as backup
      const { data: prefs } = await supabase
        .from('user_comm_preferences')
        .select('preferred_channel')
        .eq('user_id', userId)
        .single()

      await supabase
        .from('scheduled_checkins')
        .insert({
          user_id: userId,
          checkin_type: 'custom',
          scheduled_for: new Date().toISOString(),
          channel: prefs?.preferred_channel || 'push',
          status: 'pending',
          content: {
            type: 'streak_milestone',
            habit_id: habitId,
            habit_title: habitTitle,
            streak: currentStreak
          }
        })
    }

    // Also trigger automation rules for streak milestones
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
      const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

      await fetch(`${SUPABASE_URL}/functions/v1/process-automations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          trigger_type: 'streak_milestone',
          user_id: userId,
          trigger_data: {
            habit_id: habitId,
            habit_title: habitTitle,
            streak: currentStreak
          }
        })
      })
    } catch (automationError) {
      console.error('Error triggering automations:', automationError)
    }
  }
}
