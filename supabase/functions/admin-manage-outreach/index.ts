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
    const { action, team_id, outreach_id, outreach_data, filters, channel } = body

    // team_id is required except for send_now (we get it from the outreach record)
    if (!team_id && action !== 'send_now') {
      throw new Error('team_id is required')
    }

    // Check platform admin status first (applies to all actions)
    const { data: platformRole } = await supabase
      .from('platform_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    const isPlatformAdmin = platformRole?.role === 'platform_admin'

    // For send_now action, we verify access after getting the outreach record
    let isTeamManager = false
    if (team_id) {
      const { data: memberCheck } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', team_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      isTeamManager = memberCheck && ['owner', 'admin', 'manager'].includes(memberCheck.role)
    }

    // Skip authorization check for send_now (will check after getting outreach)
    if (action !== 'send_now' && !isPlatformAdmin && !isTeamManager) {
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
          .order('scheduled_for', { ascending: true })

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
          scheduled_for: item.scheduled_for,
          status: item.status,
          context: item.context,
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

        const { user_ids, outreach_type, scheduled_for, context, priority } = outreach_data

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
          scheduled_for: scheduled_for || new Date().toISOString(),
          context: context || null,
          priority: priority || 1,
          status: 'scheduled'
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
            scheduled_for
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

      case 'send_now': {
        // Send outreach immediately (for testing or urgent needs)
        if (!outreach_id) {
          throw new Error('outreach_id is required for send_now action')
        }

        // Get the outreach record
        const { data: outreach, error: fetchError } = await supabase
          .from('voice_outreach_queue')
          .select('*')
          .eq('id', outreach_id)
          .single()

        if (fetchError || !outreach) {
          throw new Error('Outreach not found')
        }

        // Verify access to the outreach's team
        if (!isPlatformAdmin) {
          const { data: memberCheck } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', outreach.team_id)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

          if (!memberCheck || !['owner', 'admin', 'manager'].includes(memberCheck.role)) {
            throw new Error('Access denied: You must be a team manager for this outreach')
          }
        }

        // Get user's phone number from user_comm_preferences
        const { data: commPrefs, error: commError } = await supabase
          .from('user_comm_preferences')
          .select('phone_number')
          .eq('user_id', outreach.user_id)
          .single()

        if (commError || !commPrefs) {
          throw new Error('User communication preferences not found - please configure phone in settings')
        }

        if (!commPrefs.phone_number) {
          throw new Error(`User does not have a phone number configured`)
        }

        // Get user email for personalization
        const { data: userData } = await supabase.auth.admin.getUserById(outreach.user_id)
        const userEmail = userData?.user?.email

        // Mark as processing
        await supabase
          .from('voice_outreach_queue')
          .update({
            status: 'processing',
            last_attempt_at: new Date().toISOString(),
            attempt_count: (outreach.attempt_count || 0) + 1
          })
          .eq('id', outreach_id)

        // Determine if this is SMS or Voice based on outreach_type
        // For now, we'll use voice for all types (can be extended)
        const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
        const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
        const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
          // Mark as failed and return error
          await supabase
            .from('voice_outreach_queue')
            .update({
              status: 'failed',
              result: { error: 'Twilio credentials not configured' }
            })
            .eq('id', outreach_id)
          throw new Error('Twilio credentials not configured')
        }

        // Prepare message context
        const messageContext = outreach.context?.message || ''
        const outreachType = outreach.outreach_type
        const userName = userEmail?.split('@')[0] || 'there'

        // Default messages based on outreach type
        const defaultMessages: Record<string, string> = {
          'morning_motivation': `Good morning ${userName}! This is your AI coach checking in. Remember, every day is a new opportunity to grow. What's one goal you're focusing on today?`,
          'habit_reminder': `Hey ${userName}, this is a friendly reminder to check in on your habits. Small consistent actions lead to big results!`,
          'celebration': `Congratulations ${userName}! I'm calling to celebrate your amazing progress. You've been doing great work!`,
          'check_in': `Hi ${userName}, just checking in to see how you're doing. Your well-being matters to us.`,
          'goal_review': `Hi ${userName}, let's take a moment to review your goals. Progress is being made every day!`,
          'weekly_summary': `Hey ${userName}, here's your weekly check-in. Let's reflect on what you've accomplished!`
        }

        const message = messageContext || defaultMessages[outreachType] || `Hi ${userName}, this is your AI coach reaching out!`

        // Determine channel: 'sms' or 'voice' (default to voice)
        const sendChannel = channel || 'voice'

        try {
          let twilioResult: any
          let responseMessage: string

          if (sendChannel === 'sms') {
            // Send SMS
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`

            const formData = new URLSearchParams()
            formData.append('To', commPrefs.phone_number)
            formData.append('From', TWILIO_PHONE_NUMBER)
            formData.append('Body', message)

            const twilioResponse = await fetch(twilioUrl, {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: formData
            })

            twilioResult = await twilioResponse.json()

            if (!twilioResponse.ok) {
              throw new Error(twilioResult.message || 'Twilio SMS failed')
            }

            responseMessage = `SMS sent to ${commPrefs.phone_number}`
          } else {
            // Make Twilio API call for voice
            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${message}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Press any key to repeat this message, or hang up when you're ready. Have a great day!</Say>
  <Gather numDigits="1" action="" timeout="10">
    <Say voice="Polly.Joanna">${message}</Say>
  </Gather>
</Response>`

            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`

            const formData = new URLSearchParams()
            formData.append('To', commPrefs.phone_number)
            formData.append('From', TWILIO_PHONE_NUMBER)
            formData.append('Twiml', twiml)

            const twilioResponse = await fetch(twilioUrl, {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: formData
            })

            twilioResult = await twilioResponse.json()

            if (!twilioResponse.ok) {
              throw new Error(twilioResult.message || 'Twilio call failed')
            }

            responseMessage = `Voice call initiated to ${commPrefs.phone_number}`
          }

          // Mark as completed
          await supabase
            .from('voice_outreach_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              result: {
                sid: twilioResult.sid,
                status: twilioResult.status,
                channel: sendChannel,
                to: commPrefs.phone_number
              }
            })
            .eq('id', outreach_id)

          // Log the action
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'outreach_sent_now',
            resource_type: 'voice_outreach_queue',
            resource_id: outreach_id,
            details: {
              outreach_type: outreachType,
              channel: sendChannel,
              target_user: outreach.user_id,
              sid: twilioResult.sid
            }
          })

          return new Response(
            JSON.stringify({
              success: true,
              message: responseMessage,
              sid: twilioResult.sid,
              channel: sendChannel
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (callError: any) {
          console.error('Twilio error:', callError)

          // Mark as failed
          await supabase
            .from('voice_outreach_queue')
            .update({
              status: 'failed',
              result: { error: callError.message, channel: sendChannel }
            })
            .eq('id', outreach_id)

          throw new Error(`Failed to send ${sendChannel}: ${callError.message}`)
        }
      }

      default:
        throw new Error(`Unknown action: ${action}. Valid actions: list, schedule, cancel, pause_user, resume_user, get_team_members, send_now`)
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
