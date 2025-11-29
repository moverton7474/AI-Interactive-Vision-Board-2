import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests - must return before any JSON parsing
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }
    })
  }

  try {
    console.log('Starting create-checkout-session...')

    // Parse body first before any other operations
    const body = await req.json()
    const { mode, priceId, orderId, successUrl, cancelUrl, customerEmail, tier } = body
    console.log('Request body:', JSON.stringify({ mode, orderId, priceId, customerEmail }))

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
    if (!STRIPE_SECRET_KEY) {
      console.error('Missing STRIPE_SECRET_KEY')
      throw new Error('Missing STRIPE_SECRET_KEY')
    }
    console.log('Stripe key present, length:', STRIPE_SECRET_KEY.length)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    console.log('Supabase client initialized')

    // Build form data for Stripe API
    const formData = new URLSearchParams()
    formData.append('mode', mode)
    formData.append('success_url', successUrl)
    formData.append('cancel_url', cancelUrl)

    if (customerEmail) {
      formData.append('customer_email', customerEmail)
    }

    if (mode === 'subscription') {
      // For Pro/Elite Upgrades
      formData.append('line_items[0][price]', priceId)
      formData.append('line_items[0][quantity]', '1')
      formData.append('metadata[tier]', tier || (priceId?.includes('elite') ? 'ELITE' : 'PRO'))
    } else if (mode === 'payment') {
      // For Print Orders (One-time)
      let unitAmount = 2900 // Default fallback: $29.00

      if (orderId) {
        console.log('Fetching order from database:', orderId)
        const { data: order, error: orderError } = await supabase
          .from('poster_orders')
          .select('total_price, print_config')
          .eq('id', orderId)
          .single()

        console.log('Order fetch result:', { order, error: orderError?.message })

        if (!orderError && order?.total_price) {
          unitAmount = Math.round(order.total_price * 100)
        }
      }

      const sizeLabel = orderId ? `Order #${orderId.substring(0, 8)}` : 'Vision Board Poster'

      formData.append('line_items[0][price_data][currency]', 'usd')
      formData.append('line_items[0][price_data][product_data][name]', sizeLabel)
      formData.append('line_items[0][price_data][product_data][description]', `Order #${orderId}`)
      formData.append('line_items[0][price_data][unit_amount]', unitAmount.toString())
      formData.append('line_items[0][quantity]', '1')
      formData.append('metadata[order_id]', orderId)
    }

    console.log('Making Stripe API request...')

    // Use native fetch instead of Stripe SDK
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    })

    const stripeData = await stripeResponse.json()
    console.log('Stripe response status:', stripeResponse.status)

    if (!stripeResponse.ok) {
      console.error('Stripe API error:', stripeData)
      throw new Error(stripeData.error?.message || 'Stripe API error')
    }

    console.log('Stripe session created:', stripeData.id)

    return new Response(
      JSON.stringify({ url: stripeData.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (error: any) {
    console.error('Create checkout session error:', error.message, error.stack)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
