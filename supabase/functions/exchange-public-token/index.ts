import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { public_token, metadata } = await req.json()

    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET')
    const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'

    // Supabase Admin Client to write to protected table
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Plaid API URL based on environment
    const PLAID_API_URLS: Record<string, string> = {
      'sandbox': 'https://sandbox.plaid.com',
      'development': 'https://development.plaid.com',
      'production': 'https://production.plaid.com'
    }
    const PLAID_API_URL = PLAID_API_URLS[PLAID_ENV] || 'https://sandbox.plaid.com'

    console.log('Exchanging public token with Plaid:', PLAID_API_URL)

    // 1. Exchange Public Token
    const tokenResponse = await fetch(`${PLAID_API_URL}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token: public_token,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('Plaid exchange error:', JSON.stringify(tokenData))
      throw new Error(tokenData.error_message || 'Failed to exchange token')
    }

    const accessToken = tokenData.access_token
    const itemId = tokenData.item_id

    // 2. Get User ID from Auth Header
    const authHeader = req.headers.get('Authorization')
    let userId = null

    if (authHeader) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      if (!userError && user) {
        userId = user.id
      } else {
        console.warn('Could not verify user for token storage')
      }
    }

    // 3. Save to Database
    const { error: dbError } = await supabase
      .from('plaid_items')
      .insert({
        user_id: userId,
        access_token: accessToken, // Note: In production, encrypt this before storing
        institution_id: metadata?.institution?.institution_id,
        status: 'active'
      })

    if (dbError) {
      console.error('Database error:', dbError)
      throw dbError
    }

    console.log('Token exchanged and saved successfully')

    return new Response(
      JSON.stringify({ success: true, item_id: itemId }),
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
