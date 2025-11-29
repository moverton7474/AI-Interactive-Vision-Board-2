import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get User from Supabase Auth (via Header)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '') || ''
    )

    // Use authenticated user ID or fallback for unauthenticated requests
    const clientUserId = user?.id || `anonymous_${Date.now()}`

    // 2. Configuration
    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET')
    const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox' // 'sandbox' | 'development' | 'production'
    
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error('Missing Plaid Credentials in Edge Function Secrets')
    }

    // Plaid API URL based on environment
    const PLAID_API_URLS: Record<string, string> = {
      'sandbox': 'https://sandbox.plaid.com',
      'development': 'https://development.plaid.com',
      'production': 'https://production.plaid.com'
    };
    const PLAID_API_URL = PLAID_API_URLS[PLAID_ENV] || 'https://sandbox.plaid.com';

    // 3. Request Link Token from Plaid
    const response = await fetch(`${PLAID_API_URL}/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        client_name: 'Visionary SaaS',
        user: {
          client_user_id: clientUserId,
        },
        products: ['auth', 'transactions'],
        country_codes: ['US'],
        language: 'en',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Plaid API Error:", data);
      throw new Error(data.error_message || 'Failed to create link token')
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})