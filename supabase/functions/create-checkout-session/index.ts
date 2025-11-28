import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Stripe } from "https://esm.sh/stripe@12.0.0?target=deno"

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
        // In production, fetch the order from DB to verify price.
        // Here we use a dynamic price data for flexibility in this demo.
        sessionConfig.line_items.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: 'Vision Board Poster',
                    description: `Order #${orderId}`,
                },
                unit_amount: 2900, // Example fixed price, in cents. In real app, pass this securely.
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

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})