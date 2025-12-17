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
    const { action, team_id, settings } = body

    if (!team_id) {
      throw new Error('team_id is required')
    }

    // Verify user has access to this team (manager or platform admin)
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

    switch (action) {
      case 'get': {
        // Get team AI settings
        const { data, error } = await supabase
          .from('team_ai_settings')
          .select('*')
          .eq('team_id', team_id)
          .single()

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        // Return default settings if none exist
        const defaultSettings = {
          team_id,
          coach_name: 'AMIE',
          coach_tone: 'warm_encouraging',
          blocked_topics: [],
          required_disclaimers: [],
          enable_sentiment_alerts: true,
          sentiment_alert_threshold: 0.3,
          enable_crisis_detection: true,
          crisis_escalation_email: null,
          max_session_duration_minutes: 30,
          max_sessions_per_day: 5,
          allow_send_email: true,
          allow_create_tasks: true,
          allow_schedule_reminders: true,
          require_confirmation: true
        }

        return new Response(
          JSON.stringify({ settings: data || defaultSettings }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update': {
        if (!settings) {
          throw new Error('settings object is required for update action')
        }

        // Check if settings exist
        const { data: existing } = await supabase
          .from('team_ai_settings')
          .select('id')
          .eq('team_id', team_id)
          .single()

        let result
        if (existing) {
          // Update existing settings
          const { data, error } = await supabase
            .from('team_ai_settings')
            .update({
              ...settings,
              updated_by: user.id,
              updated_at: new Date().toISOString()
            })
            .eq('team_id', team_id)
            .select()
            .single()

          if (error) throw error
          result = data
        } else {
          // Insert new settings
          const { data, error } = await supabase
            .from('team_ai_settings')
            .insert({
              team_id,
              ...settings,
              updated_by: user.id
            })
            .select()
            .single()

          if (error) throw error
          result = data
        }

        // Log the action
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'ai_settings_update',
          resource_type: 'team_ai_settings',
          resource_id: result.id,
          details: {
            team_id,
            updated_fields: Object.keys(settings)
          }
        })

        return new Response(
          JSON.stringify({ success: true, settings: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'add_blocked_topic': {
        const { topic } = settings
        if (!topic) {
          throw new Error('topic is required')
        }

        // Get current settings
        let { data: current } = await supabase
          .from('team_ai_settings')
          .select('blocked_topics')
          .eq('team_id', team_id)
          .single()

        const currentTopics = current?.blocked_topics || []
        if (currentTopics.includes(topic)) {
          return new Response(
            JSON.stringify({ success: true, message: 'Topic already blocked' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const newTopics = [...currentTopics, topic]

        // Upsert the settings
        const { data, error } = await supabase
          .from('team_ai_settings')
          .upsert({
            team_id,
            blocked_topics: newTopics,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          }, { onConflict: 'team_id' })
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, blocked_topics: newTopics }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'remove_blocked_topic': {
        const { topic } = settings
        if (!topic) {
          throw new Error('topic is required')
        }

        // Get current settings
        const { data: current } = await supabase
          .from('team_ai_settings')
          .select('blocked_topics')
          .eq('team_id', team_id)
          .single()

        if (!current) {
          return new Response(
            JSON.stringify({ success: true, blocked_topics: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const newTopics = (current.blocked_topics || []).filter((t: string) => t !== topic)

        const { error } = await supabase
          .from('team_ai_settings')
          .update({
            blocked_topics: newTopics,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('team_id', team_id)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, blocked_topics: newTopics }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        throw new Error(`Unknown action: ${action}. Valid actions: get, update, add_blocked_topic, remove_blocked_topic`)
    }

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
