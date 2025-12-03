import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2022-11-15',
    httpClient: Stripe.createFetchHttpClient(),
})

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

serve(async (req) => {
    const signature = req.headers.get('stripe-signature')

    if (!signature || !endpointSecret) {
        return new Response('Webhook Error: Missing signature or secret', { status: 400 })
    }

    try {
        const body = await req.text()
        const event = stripe.webhooks.constructEvent(body, signature, endpointSecret)

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object
            const userId = session.metadata.userId

            if (userId) {
                const supabaseAdmin = createClient(
                    Deno.env.get('SUPABASE_URL') ?? '',
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                )

                // Determine what was purchased based on price ID or mode
                // For simplicity in this demo, we'll assume:
                // - Subscription mode = Upgrade to PRO
                // - Payment mode = Credit pack (e.g., 50 credits)

                if (session.mode === 'subscription') {
                    await supabaseAdmin
                        .from('profiles')
                        .update({ subscription_tier: 'PRO' })
                        .eq('id', userId)
                } else if (session.mode === 'payment') {
                    // Add 50 credits for one-time purchase
                    // In a real app, you'd lookup the price ID to know how many credits
                    const { data: profile } = await supabaseAdmin
                        .from('profiles')
                        .select('credits')
                        .eq('id', userId)
                        .single()

                    const currentCredits = profile?.credits || 0

                    await supabaseAdmin
                        .from('profiles')
                        .update({ credits: currentCredits + 50 })
                        .eq('id', userId)
                }
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (err) {
        return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }
})
