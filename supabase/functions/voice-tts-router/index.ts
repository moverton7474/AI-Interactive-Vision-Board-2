import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Voice TTS Router - v2.9 Premium Voice Integration
 *
 * Routes text-to-speech requests to appropriate provider based on user tier:
 * - Free: Returns text only (client uses browser TTS)
 * - Pro: OpenAI TTS (nova/onyx voices)
 * - Elite: ElevenLabs (Maya/James personas, custom voices)
 *
 * Features:
 * - Quota management and enforcement
 * - Provider fallback chain: ElevenLabs → OpenAI → Google → Browser
 * - Streaming audio response for low latency
 * - Usage tracking for cost monitoring
 */

interface TTSRequest {
  text: string;
  sessionId?: string;
  usageType?: 'coaching' | 'affirmation' | 'greeting' | 'preview' | 'other';
  preferredPersona?: 'maya' | 'james' | 'custom' | 'system';
  language?: string;
  stream?: boolean;
}

interface QuotaResult {
  allowed: boolean;
  remaining_chars: number;
  quota_limit: number;
  used_this_month: number;
  resets_at: string;
}

// Provider-specific TTS functions
async function generateOpenAITTS(
  text: string,
  voice: string,
  apiKey: string,
  speed: number = 1.0
): Promise<ArrayBuffer> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1', // Use tts-1 for lower latency (tts-1-hd for higher quality)
      input: text,
      voice: voice, // alloy, echo, fable, onyx, nova, shimmer
      speed: speed,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS error: ${response.status} - ${error}`);
  }

  return await response.arrayBuffer();
}

async function generateElevenLabsTTS(
  text: string,
  voiceId: string,
  apiKey: string,
  settings?: { stability?: number; similarityBoost?: number; speed?: number }
): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2_5', // Fast model for low latency
        voice_settings: {
          stability: settings?.stability ?? 0.5,
          similarity_boost: settings?.similarityBoost ?? 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs TTS error: ${response.status} - ${error}`);
  }

  return await response.arrayBuffer();
}

async function generateGoogleTTS(
  text: string,
  languageCode: string,
  apiKey: string
): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: languageCode,
          ssmlGender: 'FEMALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google TTS error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  // Google returns base64-encoded audio
  const binaryString = atob(data.audioContent);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Get persona voice configuration
function getPersonaVoice(persona: string): { openaiVoice: string; elevenlabsVoiceId: string | null } {
  switch (persona) {
    case 'maya':
      return {
        openaiVoice: 'nova',
        elevenlabsVoiceId: Deno.env.get('ELEVENLABS_VOICE_MAYA_ID') || 'Bn9xWp6PwkrqKRbq8cX2'
      };
    case 'james':
      return {
        openaiVoice: 'onyx',
        elevenlabsVoiceId: Deno.env.get('ELEVENLABS_VOICE_JAMES_ID') || 'ePn9OncKq8KyJvrTRqTi'
      };
    case 'tonya':
      return {
        openaiVoice: 'shimmer',
        elevenlabsVoiceId: Deno.env.get('ELEVENLABS_VOICE_TONYA_ID') || 'zwbQ2XUiIlOKD6b3JWXd'
      };
    case 'system':
    default:
      return { openaiVoice: 'alloy', elevenlabsVoiceId: null };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    });
  }

  try {
    // Environment variables
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const GOOGLE_CLOUD_TTS_KEY = Deno.env.get('GOOGLE_CLOUD_TTS_KEY');

    // Authentication required
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', code: 'UNAUTHORIZED' }),
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
        JSON.stringify({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body: TTSRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { text, sessionId, usageType = 'coaching', preferredPersona = 'maya', language = 'en' } = body;

    // Validate text
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text is required', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit text length (5000 chars max)
    const trimmedText = text.slice(0, 5000);
    const charCount = trimmedText.length;

    // Get user profile to determine tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    const tier = profile?.subscription_tier || 'free';
    console.log(`User ${user.id} tier: ${tier}, chars: ${charCount}`);

    // Check quota for paid tiers
    let quotaInfo: QuotaResult | null = null;
    if (tier !== 'free') {
      const { data: quotaData, error: quotaError } = await supabase
        .rpc('check_voice_quota', {
          p_user_id: user.id,
          p_tier: tier,
          p_characters_requested: charCount
        });

      if (quotaError) {
        console.error('Quota check error:', quotaError);
      } else if (quotaData && quotaData.length > 0) {
        quotaInfo = quotaData[0];

        // If over quota, return text for browser TTS fallback
        if (!quotaInfo.allowed) {
          return new Response(
            JSON.stringify({
              error: 'Monthly quota exceeded',
              code: 'QUOTA_EXCEEDED',
              fallbackText: trimmedText,
              quotaInfo: {
                remaining: quotaInfo.remaining_chars,
                limit: quotaInfo.quota_limit,
                used: quotaInfo.used_this_month,
                resetsAt: quotaInfo.resets_at
              }
            }),
            {
              status: 200, // Return 200 so client can handle gracefully
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      }
    }

    // For Free tier, return text only (browser TTS)
    if (tier === 'free') {
      return new Response(
        JSON.stringify({
          provider: 'browser',
          text: trimmedText,
          message: 'Upgrade to Pro for premium AI voices'
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Voice-Provider': 'browser',
            'X-Characters-Used': '0'
          }
        }
      );
    }

    // Get voice configuration
    const personaVoice = getPersonaVoice(preferredPersona);
    let audioBuffer: ArrayBuffer | null = null;
    let usedProvider = 'browser';

    // Get user voice settings for speed
    const { data: voiceSettings } = await supabase
      .rpc('get_user_voice_settings', { p_user_id: user.id });

    const voiceSpeed = voiceSettings?.[0]?.voice_speed || 1.0;

    // Provider selection and fallback chain
    const providers: Array<{ name: string; fn: () => Promise<ArrayBuffer> }> = [];

    // Elite tier: Try ElevenLabs first
    if (tier === 'elite' && ELEVENLABS_API_KEY && personaVoice.elevenlabsVoiceId) {
      providers.push({
        name: 'elevenlabs',
        fn: () => generateElevenLabsTTS(trimmedText, personaVoice.elevenlabsVoiceId!, ELEVENLABS_API_KEY)
      });
    }

    // Pro/Elite: OpenAI as primary/fallback
    if (OPENAI_API_KEY) {
      providers.push({
        name: 'openai',
        fn: () => generateOpenAITTS(trimmedText, personaVoice.openaiVoice, OPENAI_API_KEY, voiceSpeed)
      });
    }

    // Google Cloud as final fallback
    if (GOOGLE_CLOUD_TTS_KEY) {
      providers.push({
        name: 'google',
        fn: () => generateGoogleTTS(trimmedText, language, GOOGLE_CLOUD_TTS_KEY)
      });
    }

    // Try providers in order until one succeeds
    for (const provider of providers) {
      try {
        console.log(`Trying provider: ${provider.name}`);
        audioBuffer = await provider.fn();
        usedProvider = provider.name;
        console.log(`Success with ${provider.name}, audio size: ${audioBuffer.byteLength} bytes`);
        break;
      } catch (error: any) {
        console.error(`Provider ${provider.name} failed:`, error.message);
        // Continue to next provider
      }
    }

    // If all providers failed, return text for browser TTS
    if (!audioBuffer) {
      console.log('All providers failed, falling back to browser TTS');
      return new Response(
        JSON.stringify({
          provider: 'browser',
          text: trimmedText,
          error: 'Voice providers unavailable, using browser fallback'
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Voice-Provider': 'browser',
            'X-Characters-Used': '0'
          }
        }
      );
    }

    // Record usage
    try {
      await supabase.rpc('record_voice_usage', {
        p_user_id: user.id,
        p_provider: usedProvider,
        p_characters: charCount,
        p_session_id: sessionId || null,
        p_usage_type: usageType
      });
    } catch (usageError) {
      console.error('Failed to record usage:', usageError);
      // Don't fail the request, just log
    }

    // Calculate remaining quota
    const remainingChars = quotaInfo ? quotaInfo.remaining_chars - charCount : 0;

    // Return audio response
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'X-Voice-Provider': usedProvider,
        'X-Characters-Used': charCount.toString(),
        'X-Quota-Remaining': remainingChars.toString(),
        'Cache-Control': 'no-cache',
      }
    });

  } catch (error: any) {
    console.error('Voice TTS Router error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        code: 'PROVIDER_ERROR',
        fallbackText: null
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
