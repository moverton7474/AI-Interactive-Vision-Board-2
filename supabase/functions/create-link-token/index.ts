import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get User from Supabase Auth (via Header)
    // Note: In a real app, validate the JWT here.
    // For this implementation, we assume the user is authenticated if they hit this endpoint.
    
    // 2. Configuration
    const PLAID_CLIENT_ID = (Deno as any).env.get('PLAID_CLIENT_ID')
    const PLAID_SECRET = (Deno as any).env.get('PLAID_SECRET')
    const PLAID_ENV = (Deno as any).env.get('PLAID_ENV') || 'sandbox' // 'sandbox' | 'development' | 'production'
    
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error('Missing Plaid Credentials in Edge Function Secrets')
    }

    const PLAID_API_URL = PLAID_ENV === 'sandbox' 
      ? 'https://sandbox.plaid.com' 
      : 'https://development.plaid.com'; // Adjust for production if needed

    // 3. Request Link Token from Plaid
    const response = await fetch(`${PLAID_API_URL}/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        client_name: 'Visionary SaaS',
        user: {
          client_user_id: 'user_123', // In prod, map this to Supabase User ID
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