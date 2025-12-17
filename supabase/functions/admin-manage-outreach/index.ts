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
    const { action, team_id, outreach_id, outreach_data, filters } = body

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
      case 'list': {
        // Get pending outreach for the team
        let query = supabase
          .from('voice_outreach_queue')
          .select(`
            *,
            profiles:user_id (
              email
            )
          `)
          .eq('team_id', team_id)
          .order('scheduled_time', { ascending: true })

        // Apply filters if provided
        if (filters?.status) {
          query = query.eq('status', filters.status)
        } else {
          // Default to pending and scheduled
          query = query.in('status', ['pending', 'scheduled'])
        }

        if (filters?.outreach_type) {
          query = query.eq('outreach_type', filters.outreach_type)
        }

        if (filters?.user_id) {
          query = query.eq('user_id', filters.user_id)
        }

        const { data, error } = await query.limit(100)

        if (error) throw error

        // Transform for frontend
        const outreach = (data || []).map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          email: item.profiles?.email || 'Unknown',
          outreach_type: item.outreach_type,
          scheduled_time: item.scheduled_time,
          status: item.status,
          message_template: item.message_template,
          priority: item.priority,
          created_at: item.created_at
        }))

        return new Response(
          JSON.stringify({ outreach }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'schedule': {
        if (!outreach_data) {
          throw new Error('outreach_data is required for schedule action')
        }

        const { user_ids, outreach_type, scheduled_time, message_template, priority } = outreach_data

        if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
          throw new Error('user_ids array is required')
        }

        if (!outreach_type) {
          throw new Error('outreach_type is required')
        }

        // Validate users are team members
        const { data: validMembers, error: memberError } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', team_id)
          .eq('is_active', true)
          .in('user_id', user_ids)

        if (memberError) throw memberError

        const validUserIds = (validMembers || []).map((m: any) => m.user_id)

        if (validUserIds.length === 0) {
          throw new Error('No valid team members found in provided user_ids')
        }

        // Create outreach entries for each user
        const outreachEntries = validUserIds.map((userId: string) => ({
          team_id,
          user_id: userId,
          outreach_type,
          scheduled_time: scheduled_time || new Date().toISOString(),
          message_template: message_template || null,
          priority: priority || 'normal',
          status: 'scheduled',
          created_by: user.id
        }))

        const { data, error } = await supabase
          .from('voice_outreach_queue')
          .insert(outreachEntries)
          .select()

        if (error) throw error

        // Log the action
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'outreach_scheduled',
          resource_type: 'voice_outreach_queue',
          details: {
            team_id,
            outreach_type,
            user_count: validUserIds.length,
            scheduled_time
          }
        })

        return new Response(
          JSON.stringify({
            success: true,
            scheduled_count: data?.length || 0,
            outreach: data
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'cancel': {
        if (!outreach_id) {
          throw new Error('outreach_id is required for cancel action')
        }

        // Verify outreach belongs to this team
        const { data: existing, error: fetchError } = await supabase
          .from('voice_outreach_queue')
          .select('id, status')
          .eq('id', outreach_id)
          .eq('team_id', team_id)
          .single()

        if (fetchError || !existing) {
          throw new Error('Outreach not found or does not belong to this team')
        }

        if (!['pending', 'scheduled'].includes(existing.status)) {
          throw new Error('Can only cancel pending or scheduled outreach')
        }

        const { error } = await supabase
          .from('voice_outreach_queue')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', outreach_id)

        if (error) throw error

        // Log the action
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'outreach_cancelled',
          resource_type: 'voice_outreach_queue',
          resource_id: outreach_id,
          details: { team_id }
        })

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'pause_user': {
        const { target_user_id } = outreach_data || {}
        if (!target_user_id) {
          throw new Error('target_user_id is required for pause_user action')
        }

        // Update all pending outreach for this user to paused
        const { data, error } = await supabase
          .from('voice_outreach_queue')
          .update({
            status: 'paused',
            updated_at: new Date().toISOString()
          })
          .eq('team_id', team_id)
          .eq('user_id', target_user_id)
          .in('status', ['pending', 'scheduled'])
          .select()

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            paused_count: data?.length || 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'resume_user': {
        const { target_user_id } = outreach_data || {}
        if (!target_user_id) {
          throw new Error('target_user_id is required for resume_user action')
        }

        // Resume all paused outreach for this user
        const { data, error } = await supabase
          .from('voice_outreach_queue')
          .update({
            status: 'scheduled',
            updated_at: new Date().toISOString()
          })
          .eq('team_id', team_id)
          .eq('user_id', target_user_id)
          .eq('status', 'paused')
          .select()

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            resumed_count: data?.length || 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'get_team_members': {
        // Get team members for scheduling outreach
        const { data, error } = await supabase
          .from('team_members')
          .select(`
            user_id,
            role,
            profiles:user_id (
              email
            )
          `)
          .eq('team_id', team_id)
          .eq('is_active', true)

        if (error) throw error

        const members = (data || []).map((m: any) => ({
          user_id: m.user_id,
          email: m.profiles?.email || 'Unknown',
          role: m.role
        }))

        return new Response(
          JSON.stringify({ members }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        throw new Error(`Unknown action: ${action}. Valid actions: list, schedule, cancel, pause_user, resume_user, get_team_members`)
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
