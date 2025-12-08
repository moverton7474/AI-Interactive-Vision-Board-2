import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Generate Weekly Review
 *
 * Creates AI-powered weekly progress summaries including:
 * - Habit completion rates and streak tracking
 * - Task completion progress
 * - Wins and blockers identification
 * - AI-generated insights and recommendations
 * - Mood trend analysis
 *
 * Actions:
 * - generate: Generate review for current or specified week
 * - get: Get existing review for a week
 * - list: List recent reviews
 * - process_all: Generate reviews for all users (cron job)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' }
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'generate'

    // For process_all action (cron), no auth needed
    if (action === 'process_all') {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      return await processAllUserReviews(supabase, GEMINI_API_KEY)
    }

    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

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

    let body = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    switch (action) {
      case 'generate':
        return await generateWeeklyReview(supabase, userId, body, GEMINI_API_KEY)
      case 'get':
        return await getWeeklyReview(supabase, userId, url.searchParams)
      case 'list':
        return await listWeeklyReviews(supabase, userId, url.searchParams)
      default:
        throw new Error(`Unknown action: ${action}. Valid actions: generate, get, list, process_all`)
    }

  } catch (error: any) {
    console.error('Generate weekly review error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Generate weekly review for a user
 */
async function generateWeeklyReview(
  supabase: any,
  userId: string,
  body: any,
  geminiApiKey: string | null
) {
  const { weekStart: customWeekStart, notify = true } = body

  // Calculate week range
  const { weekStart, weekEnd } = getWeekRange(customWeekStart)

  console.log(`Generating weekly review for user ${userId}: ${weekStart} to ${weekEnd}`)

  // Check if review already exists
  const { data: existingReview } = await supabase
    .from('weekly_reviews')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single()

  if (existingReview) {
    console.log('Review already exists, regenerating...')
  }

  // Fetch all data for the week in parallel
  const [
    habitsData,
    completionsData,
    tasksData,
    profileData,
    knowledgeBaseData
  ] = await Promise.all([
    // Active habits
    supabase.from('habits').select('*').eq('user_id', userId).eq('is_active', true),
    // Habit completions for the week
    supabase.from('habit_completions')
      .select('habit_id, completed_at, mood_rating, notes')
      .gte('completed_at', weekStart)
      .lte('completed_at', weekEnd)
      .in('habit_id', await getHabitIds(supabase, userId)),
    // Tasks updated this week
    supabase.from('action_tasks')
      .select('*')
      .eq('user_id', userId)
      .or(`updated_at.gte.${weekStart},created_at.gte.${weekStart}`),
    // User profile
    supabase.from('profiles').select('full_name, email').eq('id', userId).single(),
    // Knowledge base for context
    supabase.from('user_knowledge_base').select('*').eq('user_id', userId).single()
  ])

  const habits = habitsData.data || []
  const completions = completionsData.data || []
  const tasks = tasksData.data || []
  const profile = profileData.data || {}
  const knowledgeBase = knowledgeBaseData.data || {}

  // Calculate habit completion rate
  const habitCompletionRate = calculateHabitCompletionRate(habits, completions, weekStart, weekEnd)

  // Count tasks
  const tasksCompleted = tasks.filter((t: any) => t.status === 'completed').length
  const tasksTotal = tasks.length

  // Calculate mood average
  const moodRatings = completions
    .filter((c: any) => c.mood_rating)
    .map((c: any) => c.mood_rating)
  const moodAverage = moodRatings.length > 0
    ? Math.round(moodRatings.reduce((a: number, b: number) => a + b, 0) / moodRatings.length * 10) / 10
    : null

  // Identify wins
  const wins = identifyWins(habits, completions, tasks, knowledgeBase)

  // Identify blockers
  const blockers = identifyBlockers(habits, completions, tasks, weekStart, weekEnd)

  // Generate AI insights
  let aiInsights = ''
  let nextSteps: string[] = []

  if (geminiApiKey) {
    const aiResult = await generateAIInsights(
      geminiApiKey,
      profile,
      habits,
      completions,
      tasks,
      wins,
      blockers,
      habitCompletionRate,
      moodAverage,
      knowledgeBase
    )
    aiInsights = aiResult.insights
    nextSteps = aiResult.nextSteps
  } else {
    aiInsights = generateFallbackInsights(wins, blockers, habitCompletionRate, tasksCompleted)
    nextSteps = generateFallbackNextSteps(blockers, habits, tasks)
  }

  // Build review object
  const reviewData = {
    user_id: userId,
    week_start: weekStart,
    week_end: weekEnd,
    wins,
    blockers,
    next_steps: nextSteps,
    habit_completion_rate: habitCompletionRate,
    tasks_completed: tasksCompleted,
    tasks_total: tasksTotal,
    mood_average: moodAverage,
    ai_insights: aiInsights
  }

  // Upsert review
  const { data: review, error: upsertError } = await supabase
    .from('weekly_reviews')
    .upsert(reviewData, {
      onConflict: 'user_id,week_start'
    })
    .select()
    .single()

  if (upsertError) {
    throw new Error(`Failed to save weekly review: ${upsertError.message}`)
  }

  // Update knowledge base with latest review data
  await supabase
    .from('user_knowledge_base')
    .update({
      sentiment_trend: calculateSentimentTrend(moodAverage),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)

  // Schedule notification if enabled
  if (notify) {
    await scheduleReviewNotification(supabase, userId, review, profile)
  }

  console.log('Weekly review generated successfully')

  return new Response(
    JSON.stringify({
      success: true,
      review
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get existing weekly review
 */
async function getWeeklyReview(supabase: any, userId: string, params: URLSearchParams) {
  const weekStart = params.get('weekStart') || getWeekRange().weekStart

  const { data, error } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch review: ${error.message}`)
  }

  if (!data) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'No review found for this week',
        weekStart
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      review: data
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * List recent weekly reviews
 */
async function listWeeklyReviews(supabase: any, userId: string, params: URLSearchParams) {
  const limit = parseInt(params.get('limit') || '12')

  const { data, error } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch reviews: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      reviews: data || [],
      count: data?.length || 0
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Process reviews for all users (cron job)
 */
async function processAllUserReviews(supabase: any, geminiApiKey: string | null) {
  // Get all users with weekly review preference
  const { data: users, error } = await supabase
    .from('user_comm_preferences')
    .select('user_id')
    .eq('weekly_review_day', getCurrentDayName().toLowerCase())

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`)
  }

  const results = {
    processed: 0,
    failed: 0,
    errors: [] as string[]
  }

  for (const user of users || []) {
    try {
      await generateWeeklyReviewInternal(supabase, user.user_id, geminiApiKey)
      results.processed++
    } catch (e: any) {
      results.failed++
      results.errors.push(`${user.user_id}: ${e.message}`)
    }
  }

  console.log(`Processed ${results.processed} reviews, ${results.failed} failed`)

  return new Response(
    JSON.stringify({
      success: true,
      results
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getHabitIds(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('habits')
    .select('id')
    .eq('user_id', userId)

  return data?.map((h: any) => h.id) || []
}

function getWeekRange(customStart?: string): { weekStart: string; weekEnd: string } {
  let startDate: Date

  if (customStart) {
    startDate = new Date(customStart)
  } else {
    // Get previous week's Monday
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    startDate = new Date(now)
    startDate.setDate(now.getDate() - daysToMonday - 7) // Previous week's Monday
  }

  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)

  return {
    weekStart: startDate.toISOString().split('T')[0],
    weekEnd: endDate.toISOString().split('T')[0]
  }
}

function getCurrentDayName(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[new Date().getDay()]
}

function calculateHabitCompletionRate(
  habits: any[],
  completions: any[],
  weekStart: string,
  weekEnd: string
): number {
  if (habits.length === 0) return 0

  let totalExpected = 0
  let totalCompleted = 0

  for (const habit of habits) {
    const expectedDays = getExpectedDaysInWeek(habit.frequency)
    totalExpected += expectedDays

    const habitCompletions = completions.filter((c: any) => c.habit_id === habit.id)
    totalCompleted += Math.min(habitCompletions.length, expectedDays)
  }

  return totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0
}

function getExpectedDaysInWeek(frequency: string): number {
  switch (frequency) {
    case 'daily': return 7
    case 'weekdays': return 5
    case 'weekly': return 1
    default: return 7
  }
}

function identifyWins(
  habits: any[],
  completions: any[],
  tasks: any[],
  knowledgeBase: any
): any[] {
  const wins: any[] = []

  // Completed tasks
  const completedTasks = tasks.filter((t: any) => t.status === 'completed')
  for (const task of completedTasks.slice(0, 3)) {
    wins.push({
      type: 'task_completed',
      title: task.title,
      category: task.category
    })
  }

  // High habit completion
  const habitGroups = new Map<string, number>()
  for (const completion of completions) {
    const count = habitGroups.get(completion.habit_id) || 0
    habitGroups.set(completion.habit_id, count + 1)
  }

  for (const habit of habits) {
    const count = habitGroups.get(habit.id) || 0
    const expected = getExpectedDaysInWeek(habit.frequency)
    if (count >= expected) {
      wins.push({
        type: 'habit_streak',
        title: `${habit.title} - 100% completion`,
        habitId: habit.id
      })
    }
  }

  // Mood improvement
  if (knowledgeBase.sentiment_trend === 'improving') {
    wins.push({
      type: 'mood_improvement',
      title: 'Mood trend improving!'
    })
  }

  return wins.slice(0, 5)
}

function identifyBlockers(
  habits: any[],
  completions: any[],
  tasks: any[],
  weekStart: string,
  weekEnd: string
): any[] {
  const blockers: any[] = []

  // Missed habits
  const habitGroups = new Map<string, number>()
  for (const completion of completions) {
    const count = habitGroups.get(completion.habit_id) || 0
    habitGroups.set(completion.habit_id, count + 1)
  }

  for (const habit of habits) {
    const count = habitGroups.get(habit.id) || 0
    const expected = getExpectedDaysInWeek(habit.frequency)
    const completionRate = count / expected

    if (completionRate < 0.5) {
      blockers.push({
        type: 'habit_missed',
        title: `${habit.title} - only ${Math.round(completionRate * 100)}% completed`,
        habitId: habit.id,
        severity: completionRate < 0.25 ? 'high' : 'medium'
      })
    }
  }

  // Overdue tasks
  const overdueTasks = tasks.filter((t: any) => {
    if (t.status === 'completed') return false
    if (!t.due_date) return false
    return new Date(t.due_date) < new Date(weekEnd)
  })

  for (const task of overdueTasks.slice(0, 3)) {
    blockers.push({
      type: 'task_overdue',
      title: task.title,
      dueDate: task.due_date,
      severity: 'high'
    })
  }

  return blockers.slice(0, 5)
}

async function generateAIInsights(
  apiKey: string,
  profile: any,
  habits: any[],
  completions: any[],
  tasks: any[],
  wins: any[],
  blockers: any[],
  habitCompletionRate: number,
  moodAverage: number | null,
  knowledgeBase: any
): Promise<{ insights: string; nextSteps: string[] }> {
  const userName = profile.full_name || profile.email?.split('@')[0] || 'there'

  const prompt = `You are a supportive Vision Coach providing a weekly review summary. Be encouraging but honest.

User: ${userName}
Dream Locations: ${knowledgeBase.dream_locations?.join(', ') || 'Not specified'}
Top Priorities: ${knowledgeBase.top_priorities?.join(', ') || 'Not specified'}

THIS WEEK'S DATA:
- Habit Completion Rate: ${habitCompletionRate}%
- Mood Average: ${moodAverage ? `${moodAverage}/5` : 'Not tracked'}
- Active Habits: ${habits.length}
- Tasks This Week: ${tasks.length}

WINS:
${wins.map(w => `- ${w.title}`).join('\n') || '- No specific wins recorded'}

BLOCKERS:
${blockers.map(b => `- ${b.title} (${b.severity || 'medium'} priority)`).join('\n') || '- No blockers identified'}

Write a 2-3 paragraph personalized weekly review that:
1. Celebrates their wins genuinely
2. Addresses blockers with empathy and practical suggestions
3. Connects progress to their dream retirement vision
4. Ends with motivation for next week

Then provide 3 specific, actionable next steps for next week.

Format response as JSON:
{
  "insights": "Your weekly review paragraphs here...",
  "nextSteps": ["Step 1", "Step 2", "Step 3"]
}`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    )

    if (!response.ok) {
      console.error('Gemini API error:', await response.text())
      throw new Error('AI generation failed')
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        insights: parsed.insights || text,
        nextSteps: parsed.nextSteps || []
      }
    }

    return { insights: text, nextSteps: [] }
  } catch (error) {
    console.error('AI insights error:', error)
    return {
      insights: generateFallbackInsights(wins, blockers, habitCompletionRate, tasks.filter((t: any) => t.status === 'completed').length),
      nextSteps: generateFallbackNextSteps(blockers, habits, tasks)
    }
  }
}

function generateFallbackInsights(
  wins: any[],
  blockers: any[],
  habitCompletionRate: number,
  tasksCompleted: number
): string {
  let insights = ''

  // Opening
  if (habitCompletionRate >= 80) {
    insights += `Great week! You achieved a ${habitCompletionRate}% habit completion rate, showing strong commitment to your goals. `
  } else if (habitCompletionRate >= 50) {
    insights += `Solid progress this week with ${habitCompletionRate}% habit completion. Every step forward counts! `
  } else {
    insights += `This week was challenging with ${habitCompletionRate}% habit completion, but that's okay - awareness is the first step to improvement. `
  }

  // Wins
  if (wins.length > 0) {
    insights += `\n\nYour wins this week: ${wins.map(w => w.title).join(', ')}. Celebrate these achievements! `
  }

  // Blockers
  if (blockers.length > 0) {
    insights += `\n\nAreas to focus on: ${blockers.slice(0, 2).map(b => b.title).join(', ')}. Consider what's getting in the way and how you can adjust. `
  }

  // Closing
  insights += `\n\nRemember, your vision board dreams are achieved through consistent daily actions. Keep going!`

  return insights
}

function generateFallbackNextSteps(blockers: any[], habits: any[], tasks: any[]): string[] {
  const steps: string[] = []

  // Address blockers
  const missedHabit = blockers.find(b => b.type === 'habit_missed')
  if (missedHabit) {
    steps.push(`Recommit to "${missedHabit.title.split(' - ')[0]}" - set a daily reminder`)
  }

  const overdueTask = blockers.find(b => b.type === 'task_overdue')
  if (overdueTask) {
    steps.push(`Complete or reschedule: "${overdueTask.title}"`)
  }

  // General recommendations
  if (habits.length > 0 && steps.length < 3) {
    steps.push('Review and adjust habit reminder times if needed')
  }

  if (tasks.length > 0 && steps.length < 3) {
    steps.push('Plan your top 3 priorities for next week')
  }

  if (steps.length < 3) {
    steps.push('Spend 5 minutes visualizing your dream retirement')
  }

  return steps.slice(0, 3)
}

function calculateSentimentTrend(moodAverage: number | null): string {
  if (!moodAverage) return 'insufficient_data'
  if (moodAverage >= 4) return 'positive'
  if (moodAverage >= 3) return 'stable'
  return 'needs_attention'
}

async function scheduleReviewNotification(
  supabase: any,
  userId: string,
  review: any,
  profile: any
) {
  // Get user communication preferences
  const { data: prefs } = await supabase
    .from('user_comm_preferences')
    .select('preferred_channel, phone_number, phone_verified')
    .eq('user_id', userId)
    .single()

  if (!prefs) return

  const channel = prefs.preferred_channel || 'push'

  await supabase
    .from('scheduled_checkins')
    .insert({
      user_id: userId,
      checkin_type: 'weekly_review',
      scheduled_for: new Date().toISOString(),
      channel,
      status: 'pending',
      content: {
        type: 'weekly_review_ready',
        week_start: review.week_start,
        habit_completion_rate: review.habit_completion_rate,
        wins_count: review.wins?.length || 0,
        template: 'weekly_review',
        templateData: {
          name: profile.full_name || 'there',
          tasksCompleted: review.tasks_completed,
          habitRate: review.habit_completion_rate,
          winsCount: review.wins?.length || 0
        }
      }
    })
}

async function generateWeeklyReviewInternal(
  supabase: any,
  userId: string,
  geminiApiKey: string | null
) {
  // Simplified internal version for batch processing
  const { weekStart, weekEnd } = getWeekRange()

  const [habitsData, completionsData, tasksData] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('habit_completions')
      .select('habit_id, completed_at, mood_rating')
      .gte('completed_at', weekStart)
      .lte('completed_at', weekEnd)
      .in('habit_id', await getHabitIds(supabase, userId)),
    supabase.from('action_tasks')
      .select('*')
      .eq('user_id', userId)
      .or(`updated_at.gte.${weekStart},created_at.gte.${weekStart}`)
  ])

  const habits = habitsData.data || []
  const completions = completionsData.data || []
  const tasks = tasksData.data || []

  const habitCompletionRate = calculateHabitCompletionRate(habits, completions, weekStart, weekEnd)
  const moodRatings = completions.filter((c: any) => c.mood_rating).map((c: any) => c.mood_rating)
  const moodAverage = moodRatings.length > 0
    ? Math.round(moodRatings.reduce((a: number, b: number) => a + b, 0) / moodRatings.length * 10) / 10
    : null

  const wins = identifyWins(habits, completions, tasks, {})
  const blockers = identifyBlockers(habits, completions, tasks, weekStart, weekEnd)

  await supabase
    .from('weekly_reviews')
    .upsert({
      user_id: userId,
      week_start: weekStart,
      week_end: weekEnd,
      wins,
      blockers,
      next_steps: generateFallbackNextSteps(blockers, habits, tasks),
      habit_completion_rate: habitCompletionRate,
      tasks_completed: tasks.filter((t: any) => t.status === 'completed').length,
      tasks_total: tasks.length,
      mood_average: moodAverage,
      ai_insights: generateFallbackInsights(wins, blockers, habitCompletionRate, tasks.filter((t: any) => t.status === 'completed').length)
    }, {
      onConflict: 'user_id,week_start'
    })
}
