import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Compile Knowledge Base
 *
 * Aggregates all user data into a structured knowledge base for:
 * - AI Agent conversations (rich context)
 * - Weekly reviews (data source)
 * - Workbook PDF generation (content source)
 * - Progress predictions (analytics foundation)
 *
 * Data Sources:
 * - profiles: User identity and preferences
 * - vision_boards: Dream visualization
 * - documents: Financial documents
 * - action_tasks: 3-year roadmap
 * - habits + habit_completions: Daily actions and streaks
 * - agent_sessions + agent_messages: Conversation history
 * - weekly_reviews: Progress summaries
 * - progress_predictions: Pace analytics
 * - plaid_items: Bank connections (if any)
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

    // Get query params
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'compile'
    const format = url.searchParams.get('format') || 'full' // full, summary, ai_context

    switch (action) {
      case 'compile':
        return await compileKnowledgeBase(supabase, userId, format)
      case 'get':
        return await getKnowledgeBase(supabase, userId, format)
      case 'get_ai_context':
        return await getAIContext(supabase, userId)
      default:
        throw new Error(`Unknown action: ${action}. Valid actions: compile, get, get_ai_context`)
    }

  } catch (error: any) {
    console.error('Compile knowledge base error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Compile full knowledge base from all sources
 */
async function compileKnowledgeBase(supabase: any, userId: string, format: string) {
  console.log('Compiling knowledge base for user:', userId)

  // Fetch all data sources in parallel for performance
  const [
    profileData,
    visionBoardsData,
    documentsData,
    actionTasksData,
    habitsData,
    habitCompletionsData,
    achievementsData,
    sessionsData,
    weeklyReviewsData,
    predictionsData,
    plaidItemsData,
    commPrefsData
  ] = await Promise.all([
    // Profile
    supabase.from('profiles').select('*').eq('id', userId).single(),
    // Vision Boards
    supabase.from('vision_boards').select('id, prompt, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    // Documents
    supabase.from('documents').select('id, title, doc_type, content, created_at').eq('user_id', userId),
    // Action Tasks
    supabase.from('action_tasks').select('*').eq('user_id', userId).order('due_date', { ascending: true }),
    // Habits
    supabase.from('habits').select('*').eq('user_id', userId),
    // Habit Completions (last 90 days)
    supabase.from('habit_completions')
      .select('habit_id, completed_at, mood_rating')
      .gte('completed_at', getDateDaysAgo(90))
      .in('habit_id', await getHabitIds(supabase, userId)),
    // Achievements
    supabase.from('user_achievements').select('*').eq('user_id', userId),
    // Agent Sessions (last 10)
    supabase.from('agent_sessions').select('id, session_type, summary, sentiment_score, action_items, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    // Weekly Reviews (last 12 weeks)
    supabase.from('weekly_reviews').select('*').eq('user_id', userId).order('week_start', { ascending: false }).limit(12),
    // Progress Predictions
    supabase.from('progress_predictions').select('*').eq('user_id', userId).order('calculated_at', { ascending: false }).limit(5),
    // Plaid Items
    supabase.from('plaid_items').select('institution_name, created_at').eq('user_id', userId),
    // Communication Preferences
    supabase.from('user_comm_preferences').select('*').eq('user_id', userId).single()
  ])

  // Process profile
  const profile = profileData.data || {}

  // Process vision boards
  const visionBoards = visionBoardsData.data || []
  const visionStatements = visionBoards
    .map((v: any) => v.prompt)
    .filter((p: string) => p && p.length > 20)
    .slice(0, 10)

  // Extract dream locations from vision statements
  const dreamLocations = extractLocations(visionStatements)

  // Process documents for financial summary
  const documents = documentsData.data || []
  const financialSummary = compileFinancialSummary(documents)

  // Process action tasks
  const actionTasks = actionTasksData.data || []
  const goalsSummary = compileGoalsSummary(actionTasks)
  const milestones = extractMilestones(actionTasks)

  // Process habits and completions
  const habits = habitsData.data || []
  const habitCompletions = habitCompletionsData.data || []
  const habitsSummary = compileHabitsSummary(habits, habitCompletions)

  // Process achievements
  const achievements = achievementsData.data || []
  const totalStreakDays = achievements
    .filter((a: any) => a.achievement_type === 'streak')
    .reduce((sum: number, a: any) => sum + (a.value || 0), 0)

  // Process agent sessions for insights
  const sessions = sessionsData.data || []
  const conversationInsights = compileConversationInsights(sessions)

  // Process weekly reviews for trends
  const weeklyReviews = weeklyReviewsData.data || []
  const sentimentTrend = calculateSentimentTrend(weeklyReviews)

  // Process predictions for recommendations
  const predictions = predictionsData.data || []
  const recommendedFocusAreas = extractFocusAreas(predictions, goalsSummary)

  // Compile Plaid summary
  const plaidItems = plaidItemsData.data || []
  const plaidAccountsSummary = {
    connected: plaidItems.length > 0,
    institutions: plaidItems.map((p: any) => p.institution_name),
    lastSync: plaidItems.length > 0 ? plaidItems[0].created_at : null
  }

  // Build the compiled knowledge base
  const knowledgeBase = {
    // Profile Summary
    names: profile.full_name || profile.email?.split('@')[0] || 'User',
    retirement_year: profile.retirement_year || null,
    dream_locations: dreamLocations,

    // Financial Summary
    financial_summary: financialSummary,
    plaid_accounts_summary: plaidAccountsSummary,
    monthly_budget: financialSummary.monthlyBudget || null,
    retirement_goal: financialSummary.retirementGoal || null,

    // Vision Summary
    vision_statements: visionStatements,
    top_priorities: extractTopPriorities(visionStatements, goalsSummary),
    vision_board_count: visionBoards.length,

    // Goals & Actions
    goals_summary: goalsSummary,
    milestones: milestones,
    active_tasks_count: actionTasks.filter((t: any) => t.status !== 'completed').length,
    completed_tasks_count: actionTasks.filter((t: any) => t.status === 'completed').length,

    // Habits
    habits_summary: habitsSummary,
    active_habits_count: habits.filter((h: any) => h.is_active).length,
    total_streak_days: totalStreakDays,

    // AI Context
    conversation_insights: conversationInsights,
    recommended_focus_areas: recommendedFocusAreas,
    agent_notes: compileAgentNotes(sessions, predictions),
    sentiment_trend: sentimentTrend,

    // Data Provenance
    data_sources: [
      { source: 'profile', count: 1 },
      { source: 'vision_boards', count: visionBoards.length },
      { source: 'documents', count: documents.length },
      { source: 'action_tasks', count: actionTasks.length },
      { source: 'habits', count: habits.length },
      { source: 'habit_completions', count: habitCompletions.length },
      { source: 'achievements', count: achievements.length },
      { source: 'agent_sessions', count: sessions.length },
      { source: 'weekly_reviews', count: weeklyReviews.length }
    ],
    last_plaid_sync: plaidAccountsSummary.lastSync,
    last_compiled_at: new Date().toISOString()
  }

  // Upsert to database
  const { error: upsertError } = await supabase
    .from('user_knowledge_base')
    .upsert({
      user_id: userId,
      ...knowledgeBase,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })

  if (upsertError) {
    console.error('Failed to save knowledge base:', upsertError)
    throw new Error(`Failed to save knowledge base: ${upsertError.message}`)
  }

  console.log('Knowledge base compiled successfully')

  // Return based on format
  if (format === 'summary') {
    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          visionBoardCount: knowledgeBase.vision_board_count,
          activeHabits: knowledgeBase.active_habits_count,
          totalStreakDays: knowledgeBase.total_streak_days,
          activeTasks: knowledgeBase.active_tasks_count,
          completedTasks: knowledgeBase.completed_tasks_count,
          recommendedFocusAreas: knowledgeBase.recommended_focus_areas,
          lastCompiled: knowledgeBase.last_compiled_at
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (format === 'ai_context') {
    return new Response(
      JSON.stringify({
        success: true,
        context: buildAIContext(knowledgeBase)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      knowledgeBase
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get existing knowledge base without recompiling
 */
async function getKnowledgeBase(supabase: any, userId: string, format: string) {
  const { data, error } = await supabase
    .from('user_knowledge_base')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch knowledge base: ${error.message}`)
  }

  if (!data) {
    // Compile if not exists
    return await compileKnowledgeBase(supabase, userId, format)
  }

  if (format === 'ai_context') {
    return new Response(
      JSON.stringify({
        success: true,
        context: buildAIContext(data)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      knowledgeBase: data,
      cached: true
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get optimized AI context string
 */
async function getAIContext(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('user_knowledge_base')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch knowledge base: ${error.message}`)
  }

  // If no knowledge base exists or it's stale (>24 hours), recompile
  if (!data || isStale(data.last_compiled_at, 24)) {
    const response = await compileKnowledgeBase(supabase, userId, 'ai_context')
    return response
  }

  return new Response(
    JSON.stringify({
      success: true,
      context: buildAIContext(data)
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

function getDateDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

function isStale(lastCompiled: string | null, hours: number): boolean {
  if (!lastCompiled) return true
  const compiled = new Date(lastCompiled)
  const now = new Date()
  const diffHours = (now.getTime() - compiled.getTime()) / (1000 * 60 * 60)
  return diffHours > hours
}

function extractLocations(visionStatements: string[]): string[] {
  const locationKeywords = [
    'thailand', 'portugal', 'spain', 'mexico', 'costa rica', 'bali', 'vietnam',
    'italy', 'france', 'greece', 'hawaii', 'florida', 'arizona', 'beach',
    'mountain', 'lake', 'island', 'countryside', 'city'
  ]

  const found: string[] = []
  const combined = visionStatements.join(' ').toLowerCase()

  for (const location of locationKeywords) {
    if (combined.includes(location)) {
      found.push(location.charAt(0).toUpperCase() + location.slice(1))
    }
  }

  return [...new Set(found)].slice(0, 5)
}

function compileFinancialSummary(documents: any[]): Record<string, any> {
  const summary: Record<string, any> = {
    hasDocuments: documents.length > 0,
    documentTypes: [...new Set(documents.map((d: any) => d.doc_type))],
    documentCount: documents.length
  }

  // Extract financial data from documents if available
  for (const doc of documents) {
    if (doc.content) {
      try {
        const content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content
        if (content.monthlyBudget) summary.monthlyBudget = content.monthlyBudget
        if (content.retirementGoal) summary.retirementGoal = content.retirementGoal
        if (content.currentSavings) summary.currentSavings = content.currentSavings
        if (content.monthlyIncome) summary.monthlyIncome = content.monthlyIncome
        if (content.monthlyExpenses) summary.monthlyExpenses = content.monthlyExpenses
      } catch {
        // Content not parseable, skip
      }
    }
  }

  return summary
}

function compileGoalsSummary(actionTasks: any[]): Record<string, any> {
  const byCategory: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const upcomingMilestones: any[] = []

  for (const task of actionTasks) {
    // Count by category
    const category = task.category || 'uncategorized'
    byCategory[category] = (byCategory[category] || 0) + 1

    // Count by status
    const status = task.status || 'pending'
    byStatus[status] = (byStatus[status] || 0) + 1

    // Track upcoming milestones
    if (task.is_milestone && task.due_date) {
      const dueDate = new Date(task.due_date)
      const today = new Date()
      const daysUntil = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntil >= 0 && daysUntil <= 90) {
        upcomingMilestones.push({
          title: task.title,
          dueDate: task.due_date,
          daysUntil,
          category: task.category
        })
      }
    }
  }

  return {
    totalTasks: actionTasks.length,
    byCategory,
    byStatus,
    completionRate: actionTasks.length > 0
      ? Math.round((byStatus['completed'] || 0) / actionTasks.length * 100)
      : 0,
    upcomingMilestones: upcomingMilestones.slice(0, 5)
  }
}

function extractMilestones(actionTasks: any[]): any[] {
  return actionTasks
    .filter((t: any) => t.is_milestone)
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      dueDate: t.due_date,
      status: t.status,
      category: t.category
    }))
    .slice(0, 10)
}

function compileHabitsSummary(habits: any[], completions: any[]): Record<string, any> {
  const activeHabits = habits.filter((h: any) => h.is_active)

  // Calculate completion rate for last 30 days
  const thirtyDaysAgo = getDateDaysAgo(30)
  const recentCompletions = completions.filter((c: any) => c.completed_at >= thirtyDaysAgo)

  // Calculate average mood from completions
  const moodRatings = recentCompletions.filter((c: any) => c.mood_rating).map((c: any) => c.mood_rating)
  const averageMood = moodRatings.length > 0
    ? Math.round(moodRatings.reduce((a: number, b: number) => a + b, 0) / moodRatings.length * 10) / 10
    : null

  // Group completions by habit
  const completionsByHabit: Record<string, number> = {}
  for (const completion of recentCompletions) {
    completionsByHabit[completion.habit_id] = (completionsByHabit[completion.habit_id] || 0) + 1
  }

  // Calculate per-habit stats
  const habitStats = activeHabits.map((habit: any) => {
    const completionCount = completionsByHabit[habit.id] || 0
    const expectedDays = habit.frequency === 'daily' ? 30 : habit.frequency === 'weekly' ? 4 : 30
    return {
      id: habit.id,
      title: habit.title,
      frequency: habit.frequency,
      completions30Days: completionCount,
      completionRate: Math.round(completionCount / expectedDays * 100)
    }
  })

  return {
    totalHabits: habits.length,
    activeHabits: activeHabits.length,
    completions30Days: recentCompletions.length,
    averageMood,
    habitStats,
    overallCompletionRate: habitStats.length > 0
      ? Math.round(habitStats.reduce((sum, h) => sum + h.completionRate, 0) / habitStats.length)
      : 0
  }
}

function compileConversationInsights(sessions: any[]): string {
  if (sessions.length === 0) return 'No conversation history yet.'

  const summaries = sessions
    .filter((s: any) => s.summary)
    .map((s: any) => s.summary)
    .slice(0, 3)

  if (summaries.length === 0) return 'Recent conversations without summaries.'

  return `Recent coaching conversations:\n${summaries.join('\n')}`
}

function calculateSentimentTrend(weeklyReviews: any[]): string {
  if (weeklyReviews.length < 2) return 'insufficient_data'

  const recentMoods = weeklyReviews
    .filter((r: any) => r.mood_average)
    .slice(0, 4)
    .map((r: any) => r.mood_average)

  if (recentMoods.length < 2) return 'insufficient_data'

  const recent = recentMoods[0]
  const older = recentMoods[recentMoods.length - 1]

  if (recent > older + 0.5) return 'improving'
  if (recent < older - 0.5) return 'declining'
  return 'stable'
}

function extractFocusAreas(predictions: any[], goalsSummary: Record<string, any>): string[] {
  const focusAreas: string[] = []

  // Add areas from predictions
  for (const prediction of predictions) {
    if (prediction.recommendations) {
      const recs = Array.isArray(prediction.recommendations) ? prediction.recommendations : []
      for (const rec of recs.slice(0, 2)) {
        if (typeof rec === 'string') focusAreas.push(rec)
        else if (rec.text) focusAreas.push(rec.text)
      }
    }
  }

  // Add areas from goals with low completion
  const lowCompletionCategories = Object.entries(goalsSummary.byCategory || {})
    .filter(([_, count]) => (count as number) > 2)
    .map(([category]) => `Complete ${category} tasks`)

  return [...new Set([...focusAreas, ...lowCompletionCategories])].slice(0, 5)
}

function extractTopPriorities(visionStatements: string[], goalsSummary: Record<string, any>): string[] {
  const priorities: string[] = []

  // Extract from upcoming milestones
  const milestones = goalsSummary.upcomingMilestones || []
  for (const m of milestones.slice(0, 3)) {
    priorities.push(m.title)
  }

  // Extract key themes from vision statements
  const themes = ['retirement', 'financial freedom', 'health', 'family', 'travel', 'home', 'business']
  const combined = visionStatements.join(' ').toLowerCase()

  for (const theme of themes) {
    if (combined.includes(theme) && priorities.length < 5) {
      priorities.push(theme.charAt(0).toUpperCase() + theme.slice(1))
    }
  }

  return [...new Set(priorities)].slice(0, 5)
}

function compileAgentNotes(sessions: any[], predictions: any[]): string {
  const notes: string[] = []

  // Extract action items from sessions
  for (const session of sessions.slice(0, 3)) {
    if (session.action_items && Array.isArray(session.action_items)) {
      for (const item of session.action_items.slice(0, 2)) {
        if (typeof item === 'string') notes.push(`Action: ${item}`)
        else if (item.text) notes.push(`Action: ${item.text}`)
      }
    }
  }

  // Add pace warnings from predictions
  for (const pred of predictions) {
    if (pred.current_pace < 0.8 && pred.goal_type) {
      notes.push(`Warning: ${pred.goal_type} behind pace (${Math.round(pred.current_pace * 100)}%)`)
    }
  }

  return notes.join('\n') || 'No agent notes yet.'
}

/**
 * Build optimized AI context string for conversation
 */
function buildAIContext(kb: any): string {
  const sections: string[] = []

  // User identity
  sections.push(`**User:** ${kb.names || 'Unknown'}`)
  if (kb.retirement_year) {
    sections.push(`**Target Retirement:** ${kb.retirement_year}`)
  }
  if (kb.dream_locations?.length > 0) {
    sections.push(`**Dream Locations:** ${kb.dream_locations.join(', ')}`)
  }

  // Vision summary
  if (kb.vision_board_count > 0) {
    sections.push(`\n**Vision Boards:** ${kb.vision_board_count} created`)
  }
  if (kb.vision_statements?.length > 0) {
    sections.push(`**Key Visions:**\n${kb.vision_statements.slice(0, 3).map((v: string) => `- ${v.slice(0, 100)}...`).join('\n')}`)
  }

  // Financial status
  if (kb.financial_summary?.hasDocuments) {
    const fs = kb.financial_summary
    sections.push(`\n**Financial:**`)
    if (fs.retirementGoal) sections.push(`- Goal: $${fs.retirementGoal.toLocaleString()}`)
    if (fs.currentSavings) sections.push(`- Current: $${fs.currentSavings.toLocaleString()}`)
    if (fs.monthlyBudget) sections.push(`- Budget: $${fs.monthlyBudget.toLocaleString()}/mo`)
  }

  // Goals progress
  if (kb.goals_summary) {
    const gs = kb.goals_summary
    sections.push(`\n**Goals:** ${gs.totalTasks || 0} tasks (${gs.completionRate || 0}% complete)`)
    if (gs.upcomingMilestones?.length > 0) {
      sections.push(`**Upcoming Milestones:**`)
      for (const m of gs.upcomingMilestones.slice(0, 3)) {
        sections.push(`- ${m.title} (${m.daysUntil} days)`)
      }
    }
  }

  // Habits status
  if (kb.habits_summary) {
    const hs = kb.habits_summary
    sections.push(`\n**Habits:** ${hs.activeHabits || 0} active, ${hs.overallCompletionRate || 0}% completion rate`)
    if (hs.averageMood) {
      sections.push(`**Average Mood:** ${hs.averageMood}/5`)
    }
  }

  // Focus areas
  if (kb.recommended_focus_areas?.length > 0) {
    sections.push(`\n**Recommended Focus:**`)
    for (const area of kb.recommended_focus_areas.slice(0, 3)) {
      sections.push(`- ${area}`)
    }
  }

  // Sentiment
  if (kb.sentiment_trend && kb.sentiment_trend !== 'insufficient_data') {
    sections.push(`\n**Sentiment Trend:** ${kb.sentiment_trend}`)
  }

  // Agent notes
  if (kb.agent_notes && kb.agent_notes !== 'No agent notes yet.') {
    sections.push(`\n**Notes:**\n${kb.agent_notes}`)
  }

  return sections.join('\n')
}
