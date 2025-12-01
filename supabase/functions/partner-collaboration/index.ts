import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Partner Collaboration Service
 *
 * Handles partner/couple workspace features for shared goal alignment,
 * accountability, and progress tracking.
 *
 * Actions:
 * - invite: Send partner invitation by email
 * - accept: Accept partner invitation
 * - decline: Decline partner invitation
 * - status: Get partnership status
 * - unlink: Remove partner connection
 * - shared_goals: Get/create shared goals
 * - partner_progress: Get partner's progress summary
 * - feed: Get shared activity feed
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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid or expired authentication token')
    }

    const userId = user.id
    const userEmail = user.email

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'status'

    let body: any = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    switch (action) {
      case 'invite':
        return await invitePartner(supabase, userId, userEmail, body)
      case 'accept':
        return await acceptInvitation(supabase, userId, body)
      case 'decline':
        return await declineInvitation(supabase, userId, body)
      case 'status':
        return await getPartnershipStatus(supabase, userId)
      case 'unlink':
        return await unlinkPartner(supabase, userId)
      case 'shared_goals':
        if (req.method === 'POST') {
          return await createSharedGoal(supabase, userId, body)
        }
        return await getSharedGoals(supabase, userId)
      case 'partner_progress':
        return await getPartnerProgress(supabase, userId)
      case 'feed':
        return await getSharedFeed(supabase, userId, url.searchParams)
      case 'pending':
        return await getPendingInvitations(supabase, userId, userEmail)
      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error: any) {
    console.error('Partner collaboration error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Send partner invitation
 */
async function invitePartner(supabase: any, userId: string, userEmail: string | undefined, body: any) {
  const { partnerEmail, message } = body

  if (!partnerEmail) {
    throw new Error('partnerEmail is required')
  }

  if (partnerEmail.toLowerCase() === userEmail?.toLowerCase()) {
    throw new Error('You cannot invite yourself')
  }

  // Check if user already has a partner
  const { data: existingPartnership } = await supabase
    .from('partner_connections')
    .select('id')
    .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
    .eq('status', 'active')
    .single()

  if (existingPartnership) {
    throw new Error('You already have an active partner connection')
  }

  // Check for existing pending invitation
  const { data: existingInvite } = await supabase
    .from('partner_invitations')
    .select('id')
    .eq('inviter_id', userId)
    .eq('invitee_email', partnerEmail.toLowerCase())
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    throw new Error('You already have a pending invitation to this email')
  }

  // Generate unique invite code
  const inviteCode = generateInviteCode()

  // Create invitation
  const { data: invitation, error: inviteError } = await supabase
    .from('partner_invitations')
    .insert({
      inviter_id: userId,
      invitee_email: partnerEmail.toLowerCase(),
      invite_code: inviteCode,
      message: message || null,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    })
    .select()
    .single()

  if (inviteError) {
    throw new Error(`Failed to create invitation: ${inviteError.message}`)
  }

  // Get inviter's name for email
  const { data: profile } = await supabase
    .from('profiles')
    .select('names')
    .eq('id', userId)
    .single()

  console.log(`Partner invitation sent from ${userId} to ${partnerEmail}`)

  // In production, this would send an email via Twilio/SendGrid
  // For now, we return the invite code for testing

  return new Response(
    JSON.stringify({
      success: true,
      invitation: {
        id: invitation.id,
        inviteCode,
        partnerEmail,
        expiresAt: invitation.expires_at
      },
      message: `Invitation sent to ${partnerEmail}. They can use code: ${inviteCode}`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Accept partner invitation
 */
async function acceptInvitation(supabase: any, userId: string, body: any) {
  const { inviteCode } = body

  if (!inviteCode) {
    throw new Error('inviteCode is required')
  }

  // Find invitation
  const { data: invitation, error: findError } = await supabase
    .from('partner_invitations')
    .select('*')
    .eq('invite_code', inviteCode)
    .eq('status', 'pending')
    .single()

  if (findError || !invitation) {
    throw new Error('Invalid or expired invitation code')
  }

  // Check expiration
  if (new Date(invitation.expires_at) < new Date()) {
    await supabase
      .from('partner_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id)
    throw new Error('This invitation has expired')
  }

  // Check if accepter is the inviter
  if (invitation.inviter_id === userId) {
    throw new Error('You cannot accept your own invitation')
  }

  // Check if either user already has a partner
  const { data: existingPartnership } = await supabase
    .from('partner_connections')
    .select('id')
    .or(`user_id.eq.${userId},partner_id.eq.${userId},user_id.eq.${invitation.inviter_id},partner_id.eq.${invitation.inviter_id}`)
    .eq('status', 'active')
    .single()

  if (existingPartnership) {
    throw new Error('One of the users already has an active partner connection')
  }

  // Create partner connection
  const { data: connection, error: connectionError } = await supabase
    .from('partner_connections')
    .insert({
      user_id: invitation.inviter_id,
      partner_id: userId,
      status: 'active',
      connected_at: new Date().toISOString()
    })
    .select()
    .single()

  if (connectionError) {
    throw new Error(`Failed to create connection: ${connectionError.message}`)
  }

  // Update invitation status
  await supabase
    .from('partner_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: userId
    })
    .eq('id', invitation.id)

  console.log(`Partner connection created: ${invitation.inviter_id} <-> ${userId}`)

  return new Response(
    JSON.stringify({
      success: true,
      connection: {
        id: connection.id,
        partnerId: invitation.inviter_id,
        connectedAt: connection.connected_at
      },
      message: 'Partner connection established!'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Decline partner invitation
 */
async function declineInvitation(supabase: any, userId: string, body: any) {
  const { inviteCode } = body

  if (!inviteCode) {
    throw new Error('inviteCode is required')
  }

  const { data: invitation, error } = await supabase
    .from('partner_invitations')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString()
    })
    .eq('invite_code', inviteCode)
    .eq('status', 'pending')
    .select()
    .single()

  if (error || !invitation) {
    throw new Error('Invalid invitation code')
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Invitation declined'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get partnership status
 */
async function getPartnershipStatus(supabase: any, userId: string) {
  // Check for active connection
  const { data: connection } = await supabase
    .from('partner_connections')
    .select('*')
    .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
    .eq('status', 'active')
    .single()

  if (!connection) {
    return new Response(
      JSON.stringify({
        success: true,
        hasPartner: false,
        partner: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get partner's info
  const partnerId = connection.user_id === userId ? connection.partner_id : connection.user_id

  const { data: partnerProfile } = await supabase
    .from('profiles')
    .select('id, names, subscription_tier')
    .eq('id', partnerId)
    .single()

  // Get partner's recent stats
  const { data: partnerHabits } = await supabase
    .from('habits')
    .select('id')
    .eq('user_id', partnerId)
    .eq('is_active', true)

  const { data: partnerStreak } = await supabase
    .from('habit_completions')
    .select('id')
    .eq('user_id', partnerId)
    .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  return new Response(
    JSON.stringify({
      success: true,
      hasPartner: true,
      connectionId: connection.id,
      connectedAt: connection.connected_at,
      partner: {
        id: partnerId,
        name: partnerProfile?.names || 'Partner',
        tier: partnerProfile?.subscription_tier || 'FREE',
        stats: {
          activeHabits: partnerHabits?.length || 0,
          weeklyCompletions: partnerStreak?.length || 0
        }
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Unlink partner connection
 */
async function unlinkPartner(supabase: any, userId: string) {
  const { data: connection, error } = await supabase
    .from('partner_connections')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      ended_by: userId
    })
    .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
    .eq('status', 'active')
    .select()
    .single()

  if (error || !connection) {
    throw new Error('No active partner connection found')
  }

  console.log(`Partner connection ended by ${userId}`)

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Partner connection ended'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get shared goals
 */
async function getSharedGoals(supabase: any, userId: string) {
  // Get partner connection
  const { data: connection } = await supabase
    .from('partner_connections')
    .select('id, user_id, partner_id')
    .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
    .eq('status', 'active')
    .single()

  if (!connection) {
    return new Response(
      JSON.stringify({
        success: true,
        goals: [],
        message: 'No partner connection found'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get shared goals
  const { data: goals, error } = await supabase
    .from('shared_goals')
    .select('*')
    .eq('connection_id', connection.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch goals: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      goals: goals || [],
      connectionId: connection.id
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Create shared goal
 */
async function createSharedGoal(supabase: any, userId: string, body: any) {
  const { title, description, targetDate, category, targetValue, unit } = body

  if (!title) {
    throw new Error('title is required')
  }

  // Get partner connection
  const { data: connection } = await supabase
    .from('partner_connections')
    .select('id')
    .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
    .eq('status', 'active')
    .single()

  if (!connection) {
    throw new Error('No active partner connection found')
  }

  // Create goal
  const { data: goal, error } = await supabase
    .from('shared_goals')
    .insert({
      connection_id: connection.id,
      created_by: userId,
      title,
      description,
      target_date: targetDate,
      category: category || 'general',
      target_value: targetValue,
      unit,
      current_value: 0,
      status: 'active'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create goal: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      goal
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get partner's progress summary
 */
async function getPartnerProgress(supabase: any, userId: string) {
  // Get partner connection
  const { data: connection } = await supabase
    .from('partner_connections')
    .select('id, user_id, partner_id')
    .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
    .eq('status', 'active')
    .single()

  if (!connection) {
    return new Response(
      JSON.stringify({
        success: true,
        partner: null,
        message: 'No partner connection found'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const partnerId = connection.user_id === userId ? connection.partner_id : connection.user_id

  // Get partner's habits and completions
  const { data: habits } = await supabase
    .from('habits')
    .select(`
      id,
      title,
      frequency,
      current_streak
    `)
    .eq('user_id', partnerId)
    .eq('is_active', true)

  // Get today's completions
  const today = new Date().toISOString().split('T')[0]
  const { data: todayCompletions } = await supabase
    .from('habit_completions')
    .select('habit_id')
    .eq('user_id', partnerId)
    .gte('completed_at', `${today}T00:00:00`)

  const completedHabitIds = new Set(todayCompletions?.map((c: any) => c.habit_id) || [])

  // Get recent weekly review
  const { data: latestReview } = await supabase
    .from('weekly_reviews')
    .select('wins, mood_average, habit_completion_rate')
    .eq('user_id', partnerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get vision board count
  const { count: visionCount } = await supabase
    .from('vision_boards')
    .select('id', { count: 'exact' })
    .eq('user_id', partnerId)

  return new Response(
    JSON.stringify({
      success: true,
      partner: {
        id: partnerId,
        habits: habits?.map((h: any) => ({
          ...h,
          completedToday: completedHabitIds.has(h.id)
        })) || [],
        todayProgress: {
          completed: completedHabitIds.size,
          total: habits?.length || 0,
          percentage: habits?.length ? Math.round((completedHabitIds.size / habits.length) * 100) : 0
        },
        latestReview: latestReview || null,
        visionBoardCount: visionCount || 0
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get shared activity feed
 */
async function getSharedFeed(supabase: any, userId: string, params: URLSearchParams) {
  const limit = parseInt(params.get('limit') || '20')

  // Get partner connection
  const { data: connection } = await supabase
    .from('partner_connections')
    .select('id, user_id, partner_id')
    .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
    .eq('status', 'active')
    .single()

  if (!connection) {
    return new Response(
      JSON.stringify({
        success: true,
        feed: [],
        message: 'No partner connection found'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const partnerId = connection.user_id === userId ? connection.partner_id : connection.user_id

  // Get recent activities from both users
  const { data: habitCompletions } = await supabase
    .from('habit_completions')
    .select(`
      id,
      user_id,
      completed_at,
      habits (title)
    `)
    .in('user_id', [userId, partnerId])
    .order('completed_at', { ascending: false })
    .limit(limit)

  const { data: visionBoards } = await supabase
    .from('vision_boards')
    .select('id, user_id, prompt, created_at')
    .in('user_id', [userId, partnerId])
    .order('created_at', { ascending: false })
    .limit(10)

  // Combine and sort activities
  const activities: any[] = []

  habitCompletions?.forEach((hc: any) => {
    activities.push({
      type: 'habit_completion',
      userId: hc.user_id,
      isPartner: hc.user_id === partnerId,
      title: hc.habits?.title,
      timestamp: hc.completed_at
    })
  })

  visionBoards?.forEach((vb: any) => {
    activities.push({
      type: 'vision_created',
      userId: vb.user_id,
      isPartner: vb.user_id === partnerId,
      title: vb.prompt?.slice(0, 50) + '...',
      timestamp: vb.created_at
    })
  })

  // Sort by timestamp
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return new Response(
    JSON.stringify({
      success: true,
      feed: activities.slice(0, limit)
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get pending invitations for user
 */
async function getPendingInvitations(supabase: any, userId: string, userEmail: string | undefined) {
  // Get invitations sent by user
  const { data: sentInvitations } = await supabase
    .from('partner_invitations')
    .select('*')
    .eq('inviter_id', userId)
    .eq('status', 'pending')

  // Get invitations received (by email)
  const { data: receivedInvitations } = await supabase
    .from('partner_invitations')
    .select(`
      *,
      profiles:inviter_id (names)
    `)
    .eq('invitee_email', userEmail?.toLowerCase())
    .eq('status', 'pending')

  return new Response(
    JSON.stringify({
      success: true,
      sent: sentInvitations || [],
      received: receivedInvitations || []
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Generate unique invite code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
