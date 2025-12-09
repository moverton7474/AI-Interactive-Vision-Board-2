import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2022-11-15',
    httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
    const signature = req.headers.get('Stripe-Signature') || req.headers.get('stripe-signature')
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')

    if (!signature || !STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY) {
        return new Response('Missing secrets or signature', { status: 400 })
    }

    // Verify signature
    const body = await req.text()
    let event;
    try {
        event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata?.userId || session.metadata?.user_id;

        // 1. Handle Subscription (Remote Logic)
        if (session.mode === 'subscription') {
            if (userId) {
                // PRO subscription: Update tier, add credits, set status to active
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'PRO',
                        subscription_status: 'active',
                        credits: 500  // PRO users get 500 credits
                    })
                    .eq('id', userId)

                if (error) {
                    console.error('Failed to update profile for subscription:', error);
                } else {
                    console.log('Successfully upgraded user to PRO:', userId);
                }
            } else {
                console.error('No userId found in subscription session metadata');
            }
        }
        // 2. Handle Credits (Remote Logic)
        else if (session.mode === 'payment' && !session.metadata?.orderId && !session.metadata?.order_id) {
            // Assume credit pack if no orderId is present
            if (userId) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('credits')
                    .eq('id', userId)
                    .single()

                const currentCredits = profile?.credits || 0

                await supabase
                    .from('profiles')
                    .update({ credits: currentCredits + 50 })
                    .eq('id', userId)
            }
        }

        // 3. Handle Print Orders (HEAD Logic)
        if (session.mode === 'payment' && (session.metadata?.orderId || session.metadata?.order_id)) {
            const orderId = session.metadata.orderId || session.metadata.order_id;

            // Check if it's a Poster Order
            const { data: posterOrder } = await supabase
                .from('poster_orders')
                .select('id')
                .eq('id', orderId)
                .single();

            if (posterOrder) {
                await supabase
                    .from('poster_orders')
                    .update({ status: 'paid', discount_applied: true })
                    .eq('id', orderId);
                console.log("Marked poster order as paid:", orderId);
                // Trigger Prodigi submission for poster...
                await supabase.functions.invoke('submit-to-prodigi', {
                    body: { orderId: orderId }
                });
            } else {
                // Check if it's a Workbook Order
                const { data: workbookOrder } = await supabase
                    .from('workbook_orders')
                    .select('id')
                    .eq('id', orderId)
                    .single();

                if (workbookOrder) {
                    await supabase
                        .from('workbook_orders')
                        .update({ status: 'paid', paid_at: new Date().toISOString() })
                        .eq('id', orderId);

                    console.log("Marked workbook order as paid:", orderId);

                    // Trigger Workbook Generation
                    await supabase.functions.invoke('generate-workbook-pdf', {
                        body: { order_id: orderId, action: 'generate' }
                    });
                }
            }
        }
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
    })
})
