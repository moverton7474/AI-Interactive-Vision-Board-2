import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-slack-signature, x-slack-request-timestamp',
}

/**
 * Slack Bot Integration Service
 *
 * Handles Slack app interactions for daily habit prompts,
 * goal updates, and team accountability features.
 *
 * Endpoints:
 * - /oauth: Handle OAuth installation flow
 * - /events: Process Slack events (messages, reactions)
 * - /commands: Handle slash commands
 * - /interactions: Process button clicks and modal submissions
 * - /send: Send messages to connected workspaces (internal)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const SLACK_CLIENT_ID = Deno.env.get('SLACK_CLIENT_ID')
    const SLACK_CLIENT_SECRET = Deno.env.get('SLACK_CLIENT_SECRET')
    const SLACK_SIGNING_SECRET = Deno.env.get('SLACK_SIGNING_SECRET')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const url = new URL(req.url)
    const endpoint = url.searchParams.get('endpoint') || 'status'

    // Route to appropriate handler
    switch (endpoint) {
      case 'oauth':
        return await handleOAuth(supabase, url, SLACK_CLIENT_ID, SLACK_CLIENT_SECRET)
      case 'events':
        return await handleEvents(supabase, req, SLACK_SIGNING_SECRET)
      case 'commands':
        return await handleCommands(supabase, req, SLACK_SIGNING_SECRET)
      case 'interactions':
        return await handleInteractions(supabase, req, SLACK_SIGNING_SECRET)
      case 'send':
        return await sendMessage(supabase, req)
      case 'status':
        return await getIntegrationStatus(supabase, req)
      case 'disconnect':
        return await disconnectWorkspace(supabase, req)
      case 'settings':
        return await updateSettings(supabase, req)
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown endpoint' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

  } catch (error: any) {
    console.error('Slack bot error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

/**
 * Handle OAuth installation flow
 */
async function handleOAuth(supabase: any, url: URL, clientId: string, clientSecret: string) {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') // Contains user_id
  const error = url.searchParams.get('error')

  if (error) {
    return new Response(
      `<html><body><h1>Installation Cancelled</h1><p>You cancelled the Slack installation.</p><script>window.close();</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  if (!code || !state) {
    // Redirect to Slack OAuth
    const redirectUri = `${url.origin}${url.pathname}?endpoint=oauth`
    const scopes = 'chat:write,commands,users:read,channels:read,groups:read,im:read,mpim:read'
    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&state=${state || 'unknown'}&redirect_uri=${encodeURIComponent(redirectUri)}`

    return Response.redirect(slackAuthUrl, 302)
  }

  // Exchange code for access token
  // Use the exact redirect_uri that's registered in Slack app settings
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://edaigbnnofyxcfbpcvct.supabase.co'
  const exactRedirectUri = `${SUPABASE_URL}/functions/v1/slack-bot?endpoint=oauth`

  const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: exactRedirectUri
    })
  })

  const tokenData = await tokenResponse.json()

  if (!tokenData.ok) {
    console.error('Slack OAuth error:', tokenData.error)
    return new Response(
      `<html><body><h1>Installation Failed</h1><p>${tokenData.error}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  // Store the installation
  const { error: saveError } = await supabase
    .from('slack_installations')
    .upsert({
      user_id: state,
      team_id: tokenData.team.id,
      team_name: tokenData.team.name,
      bot_user_id: tokenData.bot_user_id,
      access_token: tokenData.access_token, // In production, encrypt this
      scope: tokenData.scope,
      authed_user_id: tokenData.authed_user.id,
      is_active: true,
      installed_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,team_id'
    })

  if (saveError) {
    console.error('Failed to save installation:', saveError)
    return new Response(
      `<html><body><h1>Installation Failed</h1><p>Could not save installation.</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  console.log(`Slack installed for user ${state} in team ${tokenData.team.name}`)

  return new Response(
    `<html><body>
      <h1>✅ Visionary Connected!</h1>
      <p>Your Slack workspace <strong>${tokenData.team.name}</strong> is now connected.</p>
      <p>You can now use:</p>
      <ul>
        <li><code>/visionary habits</code> - View today's habits</li>
        <li><code>/visionary goals</code> - View your goals</li>
        <li><code>/visionary progress</code> - Get progress summary</li>
      </ul>
      <script>setTimeout(() => window.close(), 5000);</script>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

/**
 * Handle Slack events (messages, reactions, etc.)
 */
async function handleEvents(supabase: any, req: Request, signingSecret: string) {
  const body = await req.text()
  const payload = JSON.parse(body)

  // URL verification challenge
  if (payload.type === 'url_verification') {
    return new Response(payload.challenge, {
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  // Process events asynchronously
  if (payload.type === 'event_callback') {
    const event = payload.event

    // Handle different event types
    switch (event.type) {
      case 'app_mention':
        // Bot was mentioned - could trigger help message
        await handleAppMention(supabase, payload.team_id, event)
        break
      case 'reaction_added':
        // Track reactions as engagement metrics
        break
    }
  }

  // Always respond quickly to Slack
  return new Response('ok', {
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
  })
}

/**
 * Handle slash commands
 */
async function handleCommands(supabase: any, req: Request, signingSecret: string) {
  const formData = await req.formData()
  const command = formData.get('command') as string
  const text = (formData.get('text') as string || '').trim().toLowerCase()
  const userId = formData.get('user_id') as string
  const teamId = formData.get('team_id') as string
  const responseUrl = formData.get('response_url') as string

  // Find the Visionary user linked to this Slack user
  const { data: installation } = await supabase
    .from('slack_installations')
    .select('user_id, access_token')
    .eq('team_id', teamId)
    .eq('authed_user_id', userId)
    .eq('is_active', true)
    .single()

  if (!installation) {
    return new Response(JSON.stringify({
      response_type: 'ephemeral',
      text: '❌ Your Slack account is not linked to Visionary. Please connect from the Visionary app settings.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const visionaryUserId = installation.user_id

  // Route to command handlers
  let response
  switch (text.split(' ')[0]) {
    case 'habits':
    case 'habit':
      response = await getHabitsCommand(supabase, visionaryUserId)
      break
    case 'goals':
    case 'goal':
      response = await getGoalsCommand(supabase, visionaryUserId)
      break
    case 'progress':
    case 'summary':
      response = await getProgressCommand(supabase, visionaryUserId)
      break
    case 'complete':
      const habitName = text.replace('complete ', '').trim()
      response = await completeHabitCommand(supabase, visionaryUserId, habitName)
      break
    case 'help':
    default:
      response = getHelpCommand()
  }

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

/**
 * Handle interactive components (buttons, menus, modals)
 */
async function handleInteractions(supabase: any, req: Request, signingSecret: string) {
  const formData = await req.formData()
  const payloadStr = formData.get('payload') as string
  const payload = JSON.parse(payloadStr)

  if (payload.type === 'block_actions') {
    const action = payload.actions[0]
    const actionId = action.action_id
    const value = action.value

    if (actionId.startsWith('complete_habit_')) {
      const habitId = actionId.replace('complete_habit_', '')

      // Find user
      const { data: installation } = await supabase
        .from('slack_installations')
        .select('user_id')
        .eq('team_id', payload.team.id)
        .eq('authed_user_id', payload.user.id)
        .eq('is_active', true)
        .single()

      if (installation) {
        // Complete the habit
        await supabase
          .from('habit_completions')
          .insert({
            habit_id: habitId,
            user_id: installation.user_id,
            completed_at: new Date().toISOString(),
            notes: 'Completed via Slack'
          })

        // Update the message
        return new Response(JSON.stringify({
          replace_original: true,
          text: `✅ Habit completed! Keep up the great work! 🔥`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

/**
 * Send message to user's Slack (called internally for reminders)
 */
async function sendMessage(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('Missing authorization')
  }

  const body = await req.json()
  const { userId, messageType, customMessage } = body

  // Get user's Slack installation
  const { data: installation } = await supabase
    .from('slack_installations')
    .select('access_token, authed_user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!installation) {
    throw new Error('No Slack installation found for user')
  }

  let message
  switch (messageType) {
    case 'morning_habits':
      message = await buildMorningHabitsMessage(supabase, userId)
      break
    case 'evening_summary':
      message = await buildEveningSummaryMessage(supabase, userId)
      break
    case 'goal_reminder':
      message = await buildGoalReminderMessage(supabase, userId)
      break
    case 'custom':
      message = { text: customMessage }
      break
    default:
      throw new Error('Unknown message type')
  }

  // Send via Slack API
  const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${installation.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: installation.authed_user_id, // DM the user
      ...message
    })
  })

  const result = await slackResponse.json()

  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error}`)
  }

  return new Response(
    JSON.stringify({ success: true, messageId: result.ts }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get integration status
 */
async function getIntegrationStatus(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('Missing authorization')
  }

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) throw new Error('Invalid token')

  const { data: installation } = await supabase
    .from('slack_installations')
    .select('team_id, team_name, is_active, installed_at, settings')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  return new Response(
    JSON.stringify({
      success: true,
      connected: !!installation,
      installation: installation ? {
        teamName: installation.team_name,
        installedAt: installation.installed_at,
        settings: installation.settings || {}
      } : null
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Disconnect workspace
 */
async function disconnectWorkspace(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('Missing authorization')
  }

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) throw new Error('Invalid token')

  await supabase
    .from('slack_installations')
    .update({ is_active: false, disconnected_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('is_active', true)

  return new Response(
    JSON.stringify({ success: true, message: 'Slack workspace disconnected' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Update notification settings
 */
async function updateSettings(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('Missing authorization')
  }

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) throw new Error('Invalid token')

  const body = await req.json()
  const { morningReminder, eveningSummary, goalReminders, reminderTime } = body

  await supabase
    .from('slack_installations')
    .update({
      settings: {
        morning_reminder: morningReminder,
        evening_summary: eveningSummary,
        goal_reminders: goalReminders,
        reminder_time: reminderTime
      }
    })
    .eq('user_id', user.id)
    .eq('is_active', true)

  return new Response(
    JSON.stringify({ success: true, message: 'Settings updated' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// === Command Handlers ===

async function getHabitsCommand(supabase: any, userId: string) {
  const { data: habits } = await supabase
    .from('habits')
    .select(`
      id,
      title,
      frequency,
      current_streak
    `)
    .eq('user_id', userId)
    .eq('is_active', true)

  // Get today's completions
  const today = new Date().toISOString().split('T')[0]
  const { data: completions } = await supabase
    .from('habit_completions')
    .select('habit_id')
    .eq('user_id', userId)
    .gte('completed_at', `${today}T00:00:00`)

  const completedIds = new Set(completions?.map((c: any) => c.habit_id) || [])

  if (!habits || habits.length === 0) {
    return {
      response_type: 'ephemeral',
      text: "You don't have any habits set up yet. Visit Visionary to create your first habit!"
    }
  }

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📋 Today\'s Habits', emoji: true }
    },
    { type: 'divider' }
  ]

  habits.forEach((habit: any) => {
    const isCompleted = completedIds.has(habit.id)
    const streakText = habit.current_streak > 0 ? ` 🔥 ${habit.current_streak} day streak` : ''

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${isCompleted ? '✅' : '⬜'} *${habit.title}*${streakText}`
      },
      ...(isCompleted ? {} : {
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Complete', emoji: true },
          action_id: `complete_habit_${habit.id}`,
          style: 'primary'
        }
      })
    } as any)
  })

  const completed = completedIds.size
  const total = habits.length
  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `Progress: ${completed}/${total} habits completed today (${Math.round((completed/total)*100)}%)`
      }]
    } as any
  )

  return {
    response_type: 'ephemeral',
    blocks
  }
}

async function getGoalsCommand(supabase: any, userId: string) {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('title, due_date, is_completed, milestone_year')
    .eq('user_id', userId)
    .eq('is_completed', false)
    .order('due_date', { ascending: true })
    .limit(10)

  if (!tasks || tasks.length === 0) {
    return {
      response_type: 'ephemeral',
      text: "You don't have any active goals. Visit Visionary to set up your action plan!"
    }
  }

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🎯 Active Goals', emoji: true }
    },
    { type: 'divider' }
  ]

  tasks.forEach((task: any) => {
    const dueText = task.due_date ? ` (Due: ${new Date(task.due_date).toLocaleDateString()})` : ''
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• *${task.title}*${dueText}`
      }
    } as any)
  })

  return {
    response_type: 'ephemeral',
    blocks
  }
}

async function getProgressCommand(supabase: any, userId: string) {
  // Get habit stats
  const { data: habits } = await supabase
    .from('habits')
    .select('id, current_streak')
    .eq('user_id', userId)
    .eq('is_active', true)

  const today = new Date().toISOString().split('T')[0]
  const { data: todayCompletions } = await supabase
    .from('habit_completions')
    .select('id')
    .eq('user_id', userId)
    .gte('completed_at', `${today}T00:00:00`)

  // Get task stats
  const { count: completedTasks } = await supabase
    .from('tasks')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_completed', true)

  const { count: totalTasks } = await supabase
    .from('tasks')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)

  // Get vision board count
  const { count: visionCount } = await supabase
    .from('vision_boards')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)

  const totalStreak = habits?.reduce((sum: number, h: any) => sum + (h.current_streak || 0), 0) || 0
  const avgStreak = habits?.length ? Math.round(totalStreak / habits.length) : 0

  return {
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📊 Your Progress Summary', emoji: true }
      },
      { type: 'divider' },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Today's Habits*\n${todayCompletions?.length || 0}/${habits?.length || 0} completed` },
          { type: 'mrkdwn', text: `*Average Streak*\n🔥 ${avgStreak} days` },
          { type: 'mrkdwn', text: `*Tasks Completed*\n${completedTasks || 0}/${totalTasks || 0}` },
          { type: 'mrkdwn', text: `*Vision Boards*\n🖼️ ${visionCount || 0} created` }
        ]
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: 'Keep going! Every small step counts toward your dreams. ✨'
        }]
      }
    ]
  }
}

async function completeHabitCommand(supabase: any, userId: string, habitName: string) {
  if (!habitName) {
    return {
      response_type: 'ephemeral',
      text: 'Usage: `/visionary complete [habit name]`'
    }
  }

  // Find the habit
  const { data: habits } = await supabase
    .from('habits')
    .select('id, title')
    .eq('user_id', userId)
    .eq('is_active', true)
    .ilike('title', `%${habitName}%`)

  if (!habits || habits.length === 0) {
    return {
      response_type: 'ephemeral',
      text: `Couldn't find a habit matching "${habitName}". Use \`/visionary habits\` to see your habits.`
    }
  }

  const habit = habits[0]

  // Check if already completed today
  const today = new Date().toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('habit_completions')
    .select('id')
    .eq('habit_id', habit.id)
    .gte('completed_at', `${today}T00:00:00`)
    .single()

  if (existing) {
    return {
      response_type: 'ephemeral',
      text: `You already completed "${habit.title}" today! 🎉`
    }
  }

  // Complete it
  await supabase
    .from('habit_completions')
    .insert({
      habit_id: habit.id,
      user_id: userId,
      completed_at: new Date().toISOString(),
      notes: 'Completed via Slack command'
    })

  return {
    response_type: 'ephemeral',
    text: `✅ "${habit.title}" marked as complete! Keep up the momentum! 🔥`
  }
}

function getHelpCommand() {
  return {
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🌟 Visionary Commands', emoji: true }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Available Commands:*\n\n' +
            '`/visionary habits` - View today\'s habits with completion buttons\n' +
            '`/visionary goals` - View your active goals\n' +
            '`/visionary progress` - Get your progress summary\n' +
            '`/visionary complete [habit]` - Mark a habit as complete\n' +
            '`/visionary help` - Show this help message'
        }
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: 'Visit <https://visionary.app|Visionary> to manage your full vision board and action plan.'
        }]
      }
    ]
  }
}

// === Message Builders ===

async function buildMorningHabitsMessage(supabase: any, userId: string) {
  const response = await getHabitsCommand(supabase, userId)
  return {
    text: "Good morning! Here are your habits for today:",
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '☀️ *Good morning!* Here are your habits for today:' }
      },
      ...response.blocks
    ]
  }
}

async function buildEveningSummaryMessage(supabase: any, userId: string) {
  const response = await getProgressCommand(supabase, userId)
  return {
    text: "Here's your daily summary:",
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '🌙 *Daily Summary* - Great job today!' }
      },
      ...response.blocks
    ]
  }
}

async function buildGoalReminderMessage(supabase: any, userId: string) {
  const response = await getGoalsCommand(supabase, userId)
  return {
    text: "Quick reminder about your goals:",
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '💡 *Goal Reminder* - Stay focused on what matters!' }
      },
      ...response.blocks
    ]
  }
}

// === Event Handlers ===

async function handleAppMention(supabase: any, teamId: string, event: any) {
  // Get installation for this team
  const { data: installation } = await supabase
    .from('slack_installations')
    .select('access_token')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!installation) return

  // Send help message
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${installation.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: event.channel,
      text: "Hi! I'm Visionary Bot. Use `/visionary help` to see what I can do!",
      thread_ts: event.ts
    })
  })
}
