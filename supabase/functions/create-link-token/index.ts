const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight - return immediately
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // Get environment variables
    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET')
    const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      console.error('Missing credentials:', { hasClientId: !!PLAID_CLIENT_ID, hasSecret: !!PLAID_SECRET })
      throw new Error('Missing Plaid Credentials in Edge Function Secrets')
    }

    // Generate a simple user ID
    const clientUserId = `user_${Date.now()}`

    // Plaid API URL based on environment
    const PLAID_API_URLS: Record<string, string> = {
      'sandbox': 'https://sandbox.plaid.com',
      'development': 'https://development.plaid.com',
      'production': 'https://production.plaid.com'
    }
    const PLAID_API_URL = PLAID_API_URLS[PLAID_ENV] || 'https://sandbox.plaid.com'

    console.log('Calling Plaid API:', PLAID_API_URL, 'ENV:', PLAID_ENV)

    // Request Link Token from Plaid
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
      console.error('Plaid API Error:', JSON.stringify(data))
      throw new Error(data.error_message || 'Failed to create link token')
    }

    console.log('Plaid link token created successfully')

    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      },
    )

  } catch (error: any) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      },
    )
  }
})
