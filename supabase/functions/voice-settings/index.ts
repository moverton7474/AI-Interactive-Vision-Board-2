import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Voice Settings - v2.9 Premium Voice Integration
 *
 * CRUD operations for user voice preferences:
 * - GET: Retrieve current settings with quota info
 * - PUT: Update voice preferences
 *
 * Also provides:
 * - Available personas based on tier
 * - Monthly usage summary
 * - Quota status
 */

interface VoiceSettingsUpdate {
  preferredProvider?: 'browser' | 'openai' | 'elevenlabs';
  preferredPersona?: 'maya' | 'james' | 'tonya' | 'custom' | 'system';  // Tonya added for v2.9
  language?: string;
  voiceSpeed?: number;
  voicePitch?: number;
  autoPlayAffirmations?: boolean;
  useClonedVoiceForAffirmations?: boolean;
}

interface VoicePersona {
  name: string;
  displayName: string;
  description: string;
  gender: string;
  style: string;
  previewUrl: string | null;
  available: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS'
      }
    });
  }

  try {
    // Environment variables
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Authentication required
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for tier with fallback detection
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    let tier = profile?.subscription_tier;

    // If tier is null/undefined, check subscriptions table as fallback
    if (!tier) {
      console.log('[voice-settings] No subscription_tier in profile, checking subscriptions table...');
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('tier, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (subscription?.tier) {
        tier = subscription.tier;
        console.log('[voice-settings] Found active subscription tier:', tier);
      } else {
        tier = 'free';
        console.log('[voice-settings] No active subscription found, defaulting to free');
      }
    }

    console.log('[voice-settings] User tier:', tier, 'for user:', user.id);

    // Handle GET request - retrieve settings
    if (req.method === 'GET') {
      // Get user settings
      const { data: settings } = await supabase
        .rpc('get_user_voice_settings', { p_user_id: user.id });

      const userSettings = settings?.[0] || {
        preferred_provider: 'browser',
        preferred_persona: 'maya',
        custom_voice_id: null,
        custom_voice_name: null,
        custom_voice_status: 'none',
        language: 'en',
        voice_speed: 1.0,
        voice_pitch: 1.0,
        auto_play_affirmations: true,
        use_cloned_voice_for_affirmations: false
      };

      // Get quota info
      const { data: quotaData } = await supabase
        .rpc('check_voice_quota', {
          p_user_id: user.id,
          p_tier: tier,
          p_characters_requested: 0
        });

      const quota = quotaData?.[0] || {
        remaining_chars: 0,
        quota_limit: 0,
        used_this_month: 0,
        resets_at: null
      };

      // Get usage summary
      const { data: usageSummary } = await supabase
        .rpc('get_voice_usage_summary', { p_user_id: user.id });

      // Get available personas
      const { data: personas } = await supabase
        .from('voice_personas')
        .select('*')
        .eq('is_active', true)
        .order('name');

      // Filter personas by tier availability
      const availablePersonas: VoicePersona[] = (personas || []).map(p => ({
        name: p.name,
        displayName: p.display_name,
        description: p.description,
        gender: p.gender,
        style: p.style,
        previewUrl: p.preview_url,
        available: p.available_tiers.includes(tier)
      }));

      // Get user's voice clones (Elite only)
      let voiceClones: any[] = [];
      if (tier === 'elite') {
        const { data: clones } = await supabase
          .from('voice_clones')
          .select('id, voice_name, status, quality_score, created_at, ready_at')
          .eq('user_id', user.id)
          .neq('status', 'deleted')
          .order('created_at', { ascending: false });

        voiceClones = clones || [];
      }

      // Determine effective provider based on tier
      let effectiveProvider = userSettings.preferred_provider;
      if (tier === 'free') {
        effectiveProvider = 'browser';
      } else if (tier === 'pro' && effectiveProvider === 'elevenlabs') {
        effectiveProvider = 'openai'; // Pro can't use ElevenLabs
      }

      return new Response(
        JSON.stringify({
          settings: {
            preferredProvider: effectiveProvider,
            preferredPersona: userSettings.preferred_persona,
            customVoiceId: userSettings.custom_voice_id,
            customVoiceName: userSettings.custom_voice_name,
            customVoiceStatus: userSettings.custom_voice_status,
            language: userSettings.language,
            voiceSpeed: userSettings.voice_speed,
            voicePitch: userSettings.voice_pitch,
            autoPlayAffirmations: userSettings.auto_play_affirmations,
            useClonedVoiceForAffirmations: userSettings.use_cloned_voice_for_affirmations
          },
          tier,
          quota: {
            used: quota.used_this_month,
            limit: quota.quota_limit,
            remaining: quota.remaining_chars,
            resetsAt: quota.resets_at
          },
          usage: usageSummary || [],
          personas: availablePersonas,
          voiceClones,
          features: {
            canUseOpenAI: tier === 'pro' || tier === 'elite',
            canUseElevenLabs: tier === 'elite',
            canCloneVoice: tier === 'elite',
            canUseMultiLanguage: tier === 'elite',
            maxClones: tier === 'elite' ? 2 : 0
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle PUT request - update settings
    if (req.method === 'PUT') {
      let body: VoiceSettingsUpdate;
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate provider based on tier
      if (body.preferredProvider) {
        if (tier === 'free' && body.preferredProvider !== 'browser') {
          return new Response(
            JSON.stringify({ error: 'Free tier can only use browser TTS. Upgrade to Pro for premium voices.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (tier === 'pro' && body.preferredProvider === 'elevenlabs') {
          return new Response(
            JSON.stringify({ error: 'ElevenLabs is available for Elite tier only. Upgrade to unlock premium voices.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Validate voice speed
      if (body.voiceSpeed !== undefined) {
        if (body.voiceSpeed < 0.5 || body.voiceSpeed > 2.0) {
          return new Response(
            JSON.stringify({ error: 'Voice speed must be between 0.5 and 2.0' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Validate voice pitch
      if (body.voicePitch !== undefined) {
        if (body.voicePitch < 0.5 || body.voicePitch > 2.0) {
          return new Response(
            JSON.stringify({ error: 'Voice pitch must be between 0.5 and 2.0' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Update settings using the upsert function
      const { data: settingsId, error: updateError } = await supabase
        .rpc('upsert_user_voice_settings', {
          p_user_id: user.id,
          p_preferred_provider: body.preferredProvider || null,
          p_preferred_persona: body.preferredPersona || null,
          p_language: body.language || null,
          p_voice_speed: body.voiceSpeed || null,
          p_voice_pitch: body.voicePitch || null,
          p_auto_play_affirmations: body.autoPlayAffirmations ?? null,
          p_use_cloned_voice_for_affirmations: body.useClonedVoiceForAffirmations ?? null
        });

      if (updateError) {
        console.error('Settings update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update settings' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch and return updated settings
      const { data: updatedSettings } = await supabase
        .rpc('get_user_voice_settings', { p_user_id: user.id });

      const newSettings = updatedSettings?.[0] || {};

      return new Response(
        JSON.stringify({
          success: true,
          settings: {
            preferredProvider: newSettings.preferred_provider,
            preferredPersona: newSettings.preferred_persona,
            language: newSettings.language,
            voiceSpeed: newSettings.voice_speed,
            voicePitch: newSettings.voice_pitch,
            autoPlayAffirmations: newSettings.auto_play_affirmations,
            useClonedVoiceForAffirmations: newSettings.use_cloned_voice_for_affirmations
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Voice Settings error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
