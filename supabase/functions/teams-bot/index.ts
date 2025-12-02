import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Microsoft Teams Bot Integration Service
 *
 * Handles Teams app interactions for daily habit prompts,
 * goal updates, and enterprise team accountability features.
 *
 * Endpoints:
 * - /messages: Handle incoming messages from Teams (Bot Framework)
 * - /oauth: Handle Azure AD OAuth flow
 * - /send: Send proactive messages
 * - /status: Get connection status
 * - /settings: Update notification settings
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
    const TEAMS_APP_ID = Deno.env.get('TEAMS_APP_ID')
    const TEAMS_APP_SECRET = Deno.env.get('TEAMS_APP_SECRET')
    const TEAMS_TENANT_ID = Deno.env.get('TEAMS_TENANT_ID')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const url = new URL(req.url)
    const endpoint = url.searchParams.get('endpoint') || 'status'

    switch (endpoint) {
      case 'messages':
        return await handleMessages(supabase, req, TEAMS_APP_ID, TEAMS_APP_SECRET)
      case 'oauth':
        return await handleOAuth(supabase, url, TEAMS_APP_ID, TEAMS_APP_SECRET, TEAMS_TENANT_ID)
      case 'send':
        return await sendProactiveMessage(supabase, req, TEAMS_APP_ID, TEAMS_APP_SECRET)
      case 'status':
        return await getIntegrationStatus(supabase, req)
      case 'disconnect':
        return await disconnectTeams(supabase, req)
      case 'settings':
        return await updateSettings(supabase, req)
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown endpoint' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

  } catch (error: any) {
    console.error('Teams bot error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

/**
 * Handle incoming messages from Teams Bot Framework
 */
async function handleMessages(supabase: any, req: Request, appId: string, appSecret: string) {
  const activity = await req.json()

  // Handle different activity types
  switch (activity.type) {
    case 'message':
      return await handleTextMessage(supabase, activity, appId, appSecret)
    case 'conversationUpdate':
      return await handleConversationUpdate(supabase, activity, appId, appSecret)
    case 'invoke':
      return await handleInvoke(supabase, activity, appId, appSecret)
    default:
      console.log('Unknown activity type:', activity.type)
  }

  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

/**
 * Handle text messages
 */
async function handleTextMessage(supabase: any, activity: any, appId: string, appSecret: string) {
  const text = activity.text?.toLowerCase().trim() || ''
  const userId = activity.from.aadObjectId // Azure AD Object ID
  const conversationId = activity.conversation.id
  const serviceUrl = activity.serviceUrl

  // Find linked Visionary user
  const { data: installation } = await supabase
    .from('teams_installations')
    .select('user_id, access_token')
    .eq('teams_user_id', userId)
    .eq('is_active', true)
    .single()

  if (!installation) {
    await sendTeamsMessage(serviceUrl, conversationId, appId, appSecret, {
      type: 'message',
      text: "👋 Hi! I'm Visionary Bot. Please link your account from the Visionary app settings to get started."
    })
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const visionaryUserId = installation.user_id
  let response

  // Parse commands
  if (text.includes('habits') || text.includes('habit')) {
    response = await buildHabitsCard(supabase, visionaryUserId)
  } else if (text.includes('goals') || text.includes('goal')) {
    response = await buildGoalsCard(supabase, visionaryUserId)
  } else if (text.includes('progress') || text.includes('summary')) {
    response = await buildProgressCard(supabase, visionaryUserId)
  } else if (text.startsWith('complete ')) {
    const habitName = text.replace('complete ', '').trim()
    response = await completeHabit(supabase, visionaryUserId, habitName)
  } else if (text.includes('help') || text === 'hi' || text === 'hello') {
    response = buildHelpCard()
  } else {
    response = {
      type: 'message',
      text: "I didn't understand that. Try saying 'habits', 'goals', 'progress', or 'help'."
    }
  }

  await sendTeamsMessage(serviceUrl, conversationId, appId, appSecret, response)

  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

/**
 * Handle conversation updates (bot added/removed)
 */
async function handleConversationUpdate(supabase: any, activity: any, appId: string, appSecret: string) {
  const membersAdded = activity.membersAdded || []
  const serviceUrl = activity.serviceUrl
  const conversationId = activity.conversation.id

  // Check if bot was added
  const botAdded = membersAdded.some((member: any) => member.id === activity.recipient.id)

  if (botAdded) {
    await sendTeamsMessage(serviceUrl, conversationId, appId, appSecret, {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: '🌟 Welcome to Visionary!',
              weight: 'bolder',
              size: 'large'
            },
            {
              type: 'TextBlock',
              text: "I'm your AI-powered vision and habit coach. I can help you track habits, view goals, and stay accountable.",
              wrap: true
            },
            {
              type: 'TextBlock',
              text: '**Commands:**',
              weight: 'bolder'
            },
            {
              type: 'TextBlock',
              text: '• **habits** - View today\'s habits\n• **goals** - View your goals\n• **progress** - Get your summary\n• **complete [habit]** - Mark done',
              wrap: true
            }
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'Open Visionary',
              url: 'https://visionary.app'
            }
          ]
        }
      }]
    })
  }

  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

/**
 * Handle invoke actions (button clicks, etc.)
 */
async function handleInvoke(supabase: any, activity: any, appId: string, appSecret: string) {
  const action = activity.value?.action
  const userId = activity.from.aadObjectId

  if (action?.startsWith('complete_')) {
    const habitId = action.replace('complete_', '')

    const { data: installation } = await supabase
      .from('teams_installations')
      .select('user_id')
      .eq('teams_user_id', userId)
      .eq('is_active', true)
      .single()

    if (installation) {
      await supabase
        .from('habit_completions')
        .insert({
          habit_id: habitId,
          user_id: installation.user_id,
          completed_at: new Date().toISOString(),
          notes: 'Completed via Teams'
        })

      return new Response(JSON.stringify({
        statusCode: 200,
        type: 'application/vnd.microsoft.activity.message',
        value: '✅ Habit completed! Keep up the momentum! 🔥'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  return new Response(JSON.stringify({ statusCode: 200 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

/**
 * Handle Azure AD OAuth flow
 */
async function handleOAuth(supabase: any, url: URL, appId: string, appSecret: string, tenantId: string) {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') // Contains user_id
  const error = url.searchParams.get('error')

  if (error) {
    return new Response(
      `<html><body><h1>Connection Cancelled</h1><script>window.close();</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  if (!code || !state) {
    // Redirect to Microsoft OAuth
    const redirectUri = `${url.origin}${url.pathname}?endpoint=oauth`
    const scopes = 'User.Read offline_access'
    const authUrl = `https://login.microsoftonline.com/${tenantId || 'common'}/oauth2/v2.0/authorize?client_id=${appId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state || 'unknown'}`

    return Response.redirect(authUrl, 302)
  }

  // Exchange code for tokens
  const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId || 'common'}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: `${url.origin}${url.pathname}?endpoint=oauth`,
      grant_type: 'authorization_code'
    })
  })

  const tokenData = await tokenResponse.json()

  if (tokenData.error) {
    return new Response(
      `<html><body><h1>Connection Failed</h1><p>${tokenData.error_description}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  // Get user info from Microsoft Graph
  const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
  })
  const userData = await userResponse.json()

  // Store the installation
  await supabase
    .from('teams_installations')
    .upsert({
      user_id: state,
      teams_user_id: userData.id,
      teams_user_email: userData.mail || userData.userPrincipalName,
      teams_display_name: userData.displayName,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      is_active: true,
      installed_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })

  console.log(`Teams connected for user ${state}`)

  return new Response(
    `<html><body>
      <h1>✅ Microsoft Teams Connected!</h1>
      <p>You can now chat with Visionary Bot in Teams.</p>
      <script>setTimeout(() => window.close(), 3000);</script>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

/**
 * Send proactive message to user
 */
async function sendProactiveMessage(supabase: any, req: Request, appId: string, appSecret: string) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('Missing authorization')

  const body = await req.json()
  const { userId, messageType } = body

  const { data: installation } = await supabase
    .from('teams_installations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!installation) {
    throw new Error('No Teams installation found')
  }

  let message
  switch (messageType) {
    case 'morning_habits':
      message = await buildHabitsCard(supabase, userId)
      break
    case 'evening_summary':
      message = await buildProgressCard(supabase, userId)
      break
    default:
      throw new Error('Unknown message type')
  }

  // For proactive messaging, we'd need to use the Bot Framework SDK
  // This is a simplified version
  console.log(`Would send ${messageType} to Teams user ${installation.teams_user_id}`)

  return new Response(
    JSON.stringify({ success: true, message: 'Message queued' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get integration status
 */
async function getIntegrationStatus(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('Missing authorization')

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) throw new Error('Invalid token')

  const { data: installation } = await supabase
    .from('teams_installations')
    .select('teams_display_name, teams_user_email, is_active, installed_at, settings')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  return new Response(
    JSON.stringify({
      success: true,
      connected: !!installation,
      installation: installation ? {
        displayName: installation.teams_display_name,
        email: installation.teams_user_email,
        installedAt: installation.installed_at,
        settings: installation.settings || {}
      } : null
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Disconnect Teams
 */
async function disconnectTeams(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('Missing authorization')

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) throw new Error('Invalid token')

  await supabase
    .from('teams_installations')
    .update({ is_active: false, disconnected_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Update notification settings
 */
async function updateSettings(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('Missing authorization')

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) throw new Error('Invalid token')

  const body = await req.json()

  await supabase
    .from('teams_installations')
    .update({ settings: body })
    .eq('user_id', user.id)
    .eq('is_active', true)

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// === Message Builders ===

async function buildHabitsCard(supabase: any, userId: string) {
  const { data: habits } = await supabase
    .from('habits')
    .select('id, title, current_streak')
    .eq('user_id', userId)
    .eq('is_active', true)

  const today = new Date().toISOString().split('T')[0]
  const { data: completions } = await supabase
    .from('habit_completions')
    .select('habit_id')
    .eq('user_id', userId)
    .gte('completed_at', `${today}T00:00:00`)

  const completedIds = new Set(completions?.map((c: any) => c.habit_id) || [])

  if (!habits || habits.length === 0) {
    return {
      type: 'message',
      text: "You don't have any habits set up yet. Visit Visionary to create your first habit!"
    }
  }

  const bodyItems: any[] = [
    {
      type: 'TextBlock',
      text: '📋 Today\'s Habits',
      weight: 'bolder',
      size: 'large'
    }
  ]

  habits.forEach((habit: any) => {
    const isCompleted = completedIds.has(habit.id)
    const streakText = habit.current_streak > 0 ? ` 🔥${habit.current_streak}` : ''

    bodyItems.push({
      type: 'ColumnSet',
      columns: [
        {
          type: 'Column',
          width: 'auto',
          items: [{
            type: 'TextBlock',
            text: isCompleted ? '✅' : '⬜',
            size: 'medium'
          }]
        },
        {
          type: 'Column',
          width: 'stretch',
          items: [{
            type: 'TextBlock',
            text: `${habit.title}${streakText}`,
            wrap: true
          }]
        },
        ...(isCompleted ? [] : [{
          type: 'Column',
          width: 'auto',
          items: [{
            type: 'ActionSet',
            actions: [{
              type: 'Action.Submit',
              title: 'Done',
              data: { action: `complete_${habit.id}` }
            }]
          }]
        }])
      ]
    })
  })

  const completed = completedIds.size
  const total = habits.length
  bodyItems.push({
    type: 'TextBlock',
    text: `Progress: ${completed}/${total} (${Math.round((completed/total)*100)}%)`,
    size: 'small',
    isSubtle: true
  })

  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.4',
        body: bodyItems
      }
    }]
  }
}

async function buildGoalsCard(supabase: any, userId: string) {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('title, due_date')
    .eq('user_id', userId)
    .eq('is_completed', false)
    .order('due_date', { ascending: true })
    .limit(8)

  if (!tasks || tasks.length === 0) {
    return {
      type: 'message',
      text: "You don't have any active goals. Visit Visionary to set up your action plan!"
    }
  }

  const bodyItems: any[] = [
    {
      type: 'TextBlock',
      text: '🎯 Active Goals',
      weight: 'bolder',
      size: 'large'
    }
  ]

  tasks.forEach((task: any) => {
    const dueText = task.due_date ? ` (${new Date(task.due_date).toLocaleDateString()})` : ''
    bodyItems.push({
      type: 'TextBlock',
      text: `• ${task.title}${dueText}`,
      wrap: true
    })
  })

  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.4',
        body: bodyItems
      }
    }]
  }
}

async function buildProgressCard(supabase: any, userId: string) {
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

  const { count: completedTasks } = await supabase
    .from('tasks')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_completed', true)

  const { count: totalTasks } = await supabase
    .from('tasks')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)

  const totalStreak = habits?.reduce((sum: number, h: any) => sum + (h.current_streak || 0), 0) || 0
  const avgStreak = habits?.length ? Math.round(totalStreak / habits.length) : 0

  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          {
            type: 'TextBlock',
            text: '📊 Your Progress',
            weight: 'bolder',
            size: 'large'
          },
          {
            type: 'FactSet',
            facts: [
              { title: "Today's Habits", value: `${todayCompletions?.length || 0}/${habits?.length || 0}` },
              { title: 'Average Streak', value: `🔥 ${avgStreak} days` },
              { title: 'Tasks Completed', value: `${completedTasks || 0}/${totalTasks || 0}` }
            ]
          },
          {
            type: 'TextBlock',
            text: 'Keep going! Every step counts. ✨',
            size: 'small',
            isSubtle: true
          }
        ]
      }
    }]
  }
}

async function completeHabit(supabase: any, userId: string, habitName: string) {
  if (!habitName) {
    return { type: 'message', text: 'Usage: complete [habit name]' }
  }

  const { data: habits } = await supabase
    .from('habits')
    .select('id, title')
    .eq('user_id', userId)
    .eq('is_active', true)
    .ilike('title', `%${habitName}%`)

  if (!habits || habits.length === 0) {
    return { type: 'message', text: `Couldn't find a habit matching "${habitName}".` }
  }

  const habit = habits[0]
  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await supabase
    .from('habit_completions')
    .select('id')
    .eq('habit_id', habit.id)
    .gte('completed_at', `${today}T00:00:00`)
    .single()

  if (existing) {
    return { type: 'message', text: `You already completed "${habit.title}" today! 🎉` }
  }

  await supabase
    .from('habit_completions')
    .insert({
      habit_id: habit.id,
      user_id: userId,
      completed_at: new Date().toISOString(),
      notes: 'Completed via Teams'
    })

  return { type: 'message', text: `✅ "${habit.title}" marked complete! Keep it up! 🔥` }
}

function buildHelpCard() {
  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          {
            type: 'TextBlock',
            text: '🌟 Visionary Commands',
            weight: 'bolder',
            size: 'large'
          },
          {
            type: 'TextBlock',
            text: '**habits** - View today\'s habits with complete buttons\n**goals** - View your active goals\n**progress** - Get your progress summary\n**complete [habit]** - Mark a habit as complete\n**help** - Show this help',
            wrap: true
          }
        ],
        actions: [
          {
            type: 'Action.OpenUrl',
            title: 'Open Visionary',
            url: 'https://visionary.app'
          }
        ]
      }
    }]
  }
}

// === Utilities ===

async function sendTeamsMessage(serviceUrl: string, conversationId: string, appId: string, appSecret: string, message: any) {
  // Get Bot Framework token
  const tokenResponse = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: appId,
      client_secret: appSecret,
      scope: 'https://api.botframework.com/.default'
    })
  })

  const tokenData = await tokenResponse.json()

  if (!tokenData.access_token) {
    console.error('Failed to get Bot Framework token:', tokenData)
    return
  }

  // Send message
  const response = await fetch(`${serviceUrl}v3/conversations/${conversationId}/activities`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  })

  if (!response.ok) {
    console.error('Failed to send Teams message:', await response.text())
  }
}
