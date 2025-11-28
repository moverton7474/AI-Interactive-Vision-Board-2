import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Stripe } from "https://esm.sh/stripe@12.0.0?target=deno"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
    if (!STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY')

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

        const supabase = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
              )

    const { mode, priceId, orderId, successUrl, cancelUrl } = await req.json()

    let sessionConfig: any = {
      line_items: [],
      mode: mode, // 'subscription' or 'payment'
      success_url: successUrl,
      cancel_url: cancelUrl,
    }

    if (mode === 'subscription') {
        // For Pro/Elite Upgrades
        sessionConfig.line_items.push({
            price: priceId, 
            quantity: 1,
        })
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
          },quantity: 1,
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

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
