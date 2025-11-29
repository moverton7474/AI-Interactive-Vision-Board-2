import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@11.1.0?target=deno&deno-std=0.132.0"
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
    // Parse body first before any other operations
    const body = await req.json()
    const { mode, priceId, orderId, successUrl, cancelUrl, customerEmail, tier } = body

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
    if (!STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY')

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2022-11-15',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let sessionConfig: any = {
      line_items: [],
      mode: mode, // 'subscription' or 'payment'
      success_url: successUrl,
      cancel_url: cancelUrl,
    }

    // Include customer email for webhook user matching
    if (customerEmail) {
      sessionConfig.customer_email = customerEmail
    }

    if (mode === 'subscription') {
        // For Pro/Elite Upgrades
        sessionConfig.line_items.push({
            price: priceId,
            quantity: 1,
        })
        // Pass tier in metadata for reliable webhook processing
        sessionConfig.metadata = {
            tier: tier || (priceId?.includes('elite') ? 'ELITE' : 'PRO')
        }
    } else if (mode === 'payment') {
        // For Print Orders (One-time)
        // Fetch actual order price from database for security
        let unitAmount = 2900 // Default fallback: $29.00

        if (orderId) {
            const { data: order, error: orderError } = await supabase
                .from('poster_orders')
                .select('total_price, print_config')
                .eq('id', orderId)
                .single()

            if (!orderError && order?.total_price) {
                // Convert dollars to cents for Stripe
                unitAmount = Math.round(order.total_price * 100)
            }
        }

        const sizeLabel = orderId ? `Order #${orderId.substring(0, 8)}` : 'Vision Board Poster'

        sessionConfig.line_items.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: sizeLabel,
                    description: `Order #${orderId}`,
                },
                unit_amount: unitAmount,
            },
            quantity: 1,
        })
        sessionConfig.metadata = {
            order_id: orderId
        }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (error: any) {
    console.error('Create checkout session error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
