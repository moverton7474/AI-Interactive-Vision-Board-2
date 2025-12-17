import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Invalid token')
    }

    const body = await req.json()
    const { team_id, start_date, end_date } = body

    if (!team_id) {
      throw new Error('team_id is required')
    }

    // Verify user has access to this team
    const { data: memberCheck } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    const { data: platformRole } = await supabase
      .from('platform_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    const isPlatformAdmin = platformRole?.role === 'platform_admin'
    const isTeamManager = memberCheck && ['owner', 'admin', 'manager'].includes(memberCheck.role)

    if (!isPlatformAdmin && !isTeamManager) {
      throw new Error('Access denied: You must be a team manager or platform admin')
    }

    // Default date range
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = end_date || new Date().toISOString().split('T')[0]

    // Get aggregate stats
    const { data: summaryData, error: summaryError } = await supabase
      .rpc('get_team_voice_stats', {
        p_team_id: team_id,
        p_start_date: startDate,
        p_end_date: endDate
      })

    if (summaryError) {
      console.error('Summary error:', summaryError)
    }

    // Get per-member stats
    const { data: memberData, error: memberError } = await supabase
      .rpc('get_team_member_voice_stats', {
        p_team_id: team_id,
        p_start_date: startDate,
        p_end_date: endDate
      })

    if (memberError) {
      console.error('Member stats error:', memberError)
    }

    // Get session type distribution
    const { data: typeData, error: typeError } = await supabase
      .rpc('get_team_session_type_distribution', {
        p_team_id: team_id,
        p_start_date: startDate,
        p_end_date: endDate
      })

    if (typeError) {
      console.error('Type distribution error:', typeError)
    }

    // Get trend data
    const { data: trendData, error: trendError } = await supabase
      .rpc('get_team_voice_trend', {
        p_team_id: team_id,
        p_start_date: startDate,
        p_end_date: endDate
      })

    if (trendError) {
      console.error('Trend data error:', trendError)
    }

    // Format the response
    const summary = summaryData?.[0] || {
      total_sessions: 0,
      unique_users: 0,
      avg_duration_minutes: 0,
      avg_sentiment: 0.5,
      sessions_this_week: 0,
      total_minutes: 0
    }

    return new Response(
      JSON.stringify({
        summary: {
          total_sessions: Number(summary.total_sessions) || 0,
          unique_users: Number(summary.unique_users) || 0,
          avg_duration_minutes: Number(summary.avg_duration_minutes) || 0,
          avg_sentiment: Number(summary.avg_sentiment) || 0.5,
          sessions_this_week: Number(summary.sessions_this_week) || 0,
          total_minutes: Number(summary.total_minutes) || 0
        },
        by_member: (memberData || []).map((m: any) => ({
          user_id: m.user_id,
          email: m.email,
          display_name: m.display_name,
          session_count: Number(m.session_count) || 0,
          total_minutes: Number(m.total_minutes) || 0,
          avg_sentiment: Number(m.avg_sentiment) || 0.5,
          last_session: m.last_session,
          favorite_session_type: m.favorite_session_type
        })),
        by_session_type: (typeData || []).map((t: any) => ({
          session_type: t.session_type,
          count: Number(t.count) || 0,
          percentage: Number(t.percentage) || 0
        })),
        trend_data: (trendData || []).map((t: any) => ({
          date: t.date,
          sessions: Number(t.sessions) || 0,
          avg_sentiment: Number(t.avg_sentiment) || 0.5,
          unique_users: Number(t.unique_users) || 0
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (err: any) {
    console.error('Error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
