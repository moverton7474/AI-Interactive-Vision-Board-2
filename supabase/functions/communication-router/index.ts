import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CommunicationRequest {
    userId: string;
    type: 'morning_briefing' | 'habit_reminder' | 'pace_warning' | 'weekly_review' | 'generic';
    content: string; // Text content or ID of content to generate
    urgency?: 'high' | 'medium' | 'low';
    context?: any; // Extra data for the message
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { userId, type, content, urgency = 'medium', context }: CommunicationRequest = await req.json()

        if (!userId) throw new Error('userId is required')

        // 1. Get User Preferences & Phone Number
        const { data: userProfile, error: profileError } = await supabase
            .from('user_identity_profiles')
            .select('communication_style, encouragement_frequency')
            .eq('user_id', userId)
            .single()

        // We also need the phone number from auth or a separate profile table
        // Assuming it's in auth.users or a 'profiles' table. Let's check 'profiles' first.
        const { data: profile, error: userError } = await supabase
            .from('profiles')
            .select('phone_number') // Assuming this column exists, if not we might need to fetch from auth
            .eq('id', userId)
            .single()

        // 2. Determine Channel based on Urgency & Type
        let channel = 'push'; // Default
        if (urgency === 'high') channel = 'sms';
        if (type === 'morning_briefing') channel = 'voice'; // Or push with audio link
        if (type === 'weekly_review') channel = 'email';

        console.log(`Routing message for user ${userId}: Type=${type}, Urgency=${urgency} -> Channel=${channel}`);

        // 3. Route to appropriate handler
        let result;
        switch (channel) {
            case 'sms':
                if (profile?.phone_number) {
                    result = await supabase.functions.invoke('send-sms', {
                        body: { to: profile.phone_number, body: content }
                    });
                } else {
                    console.log("No phone number, falling back to push");
                    channel = 'push'; // Fallback
                }
                break;

            case 'voice':
                if (profile?.phone_number) {
                    // For voice, we might trigger a call or just send an audio link via SMS
                    // Let's assume we trigger a call for now if it's a briefing
                    result = await supabase.functions.invoke('make-call', {
                        body: { to: profile.phone_number, script: content }
                    });
                }
                break;

            case 'email':
                // TODO: Implement email sending (e.g. via Resend or SendGrid)
                console.log("Email sending not yet implemented, logging content:", content);
                break;

            case 'push':
            default:
                // Trigger push notification (via 'schedule-notification' or direct)
                result = await supabase.functions.invoke('schedule-notification', {
                    body: {
                        user_id: userId,
                        title: getTitleForType(type),
                        body: content,
                        scheduled_for: new Date().toISOString() // Immediate
                    }
                });
                break;
        }

        return new Response(
            JSON.stringify({ success: true, channel, result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})

function getTitleForType(type: string): string {
    switch (type) {
        case 'morning_briefing': return '🌅 Your Morning Briefing';
        case 'habit_reminder': return '💪 Habit Reminder';
        case 'pace_warning': return '⚠️ Pace Alert';
        case 'weekly_review': return '📅 Weekly Review';
        default: return 'Visionary AI';
    }
}
