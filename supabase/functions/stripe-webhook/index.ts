import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2022-11-15',
    httpClient: Stripe.createFetchHttpClient(),
})

/**
 * Check if a webhook event has already been processed (idempotency check)
 * Returns true if event should be processed, false if already handled
 */
async function shouldProcessEvent(
    supabase: any,
    eventId: string,
    eventType: string
): Promise<boolean> {
    // Check if event already exists
    const { data: existingEvent, error: checkError } = await supabase
        .from('stripe_webhook_events')
        .select('event_id, processing_status')
        .eq('event_id', eventId)
        .single();

    if (checkError && checkError.code !== 'PGRST116') {
        // Real error (not "no rows found")
        console.error('Error checking event idempotency:', checkError);
        // Continue processing to avoid blocking valid events
        return true;
    }

    if (existingEvent) {
        // Event already exists
        if (existingEvent.processing_status === 'completed') {
            console.log(`Event ${eventId} already processed, skipping`);
            return false;
        }
        if (existingEvent.processing_status === 'processing') {
            console.log(`Event ${eventId} currently being processed, skipping`);
            return false;
        }
        // If failed, we'll retry
        console.log(`Retrying failed event ${eventId}`);
    }

    // Insert or update event as 'processing'
    const { error: upsertError } = await supabase
        .from('stripe_webhook_events')
        .upsert({
            event_id: eventId,
            event_type: eventType,
            processing_status: 'processing',
            created_at: new Date().toISOString(),
        }, {
            onConflict: 'event_id'
        });

    if (upsertError) {
        console.error('Error marking event as processing:', upsertError);
        // Continue anyway - better to risk duplicate than miss payment
    }

    return true;
}

/**
 * Mark event as completed or failed
 */
async function markEventStatus(
    supabase: any,
    eventId: string,
    status: 'completed' | 'failed',
    metadata?: any,
    errorMessage?: string
): Promise<void> {
    const { error } = await supabase
        .from('stripe_webhook_events')
        .update({
            processing_status: status,
            processed_at: status === 'completed' ? new Date().toISOString() : null,
            metadata: metadata || {},
            error_message: errorMessage || null,
        })
        .eq('event_id', eventId);

    if (error) {
        console.error(`Error marking event ${eventId} as ${status}:`, error);
    }
}

serve(async (req) => {
    const signature = req.headers.get('Stripe-Signature') || req.headers.get('stripe-signature')
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')

    if (!signature || !STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY) {
        return new Response('Missing secrets or signature', { status: 400 })
    }

    // Verify signature using raw body
    const body = await req.text()
    let event: Stripe.Event;
    try {
        event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`Received Stripe event: ${event.type} (${event.id})`);

    // ============================================
    // IDEMPOTENCY CHECK
    // ============================================
    const shouldProcess = await shouldProcessEvent(supabase, event.id, event.type);
    if (!shouldProcess) {
        // Event already processed - return 200 so Stripe doesn't retry
        return new Response(JSON.stringify({ received: true, skipped: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    try {
        // ============================================
        // CHECKOUT SESSION COMPLETED
        // ============================================
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.userId || session.metadata?.user_id;
            const tier = session.metadata?.tier;

            // 1. Handle Subscription
            if (session.mode === 'subscription') {
                if (userId) {
                    // Determine tier from metadata or default to PRO
                    const subscriptionTier = tier || 'PRO';
                    const credits = subscriptionTier === 'ELITE' ? 1000 : 500;

                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            subscription_tier: subscriptionTier,
                            credits: credits,
                            stripe_customer_id: session.customer,
                            stripe_subscription_id: session.subscription,
                        })
                        .eq('id', userId)

                    if (error) {
                        console.error('Failed to update profile for subscription:', error);
                        throw error;
                    } else {
                        console.log(`Successfully upgraded user to ${subscriptionTier}:`, userId);
                    }
                } else {
                    console.error('No userId found in subscription session metadata');
                }
            }
            // 2. Handle Credit Pack Purchase (no orderId)
            else if (session.mode === 'payment' && !session.metadata?.orderId && !session.metadata?.order_id) {
                if (userId) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('credits')
                        .eq('id', userId)
                        .single()

                    const currentCredits = profile?.credits || 0

                    const { error } = await supabase
                        .from('profiles')
                        .update({ credits: currentCredits + 50 })
                        .eq('id', userId)

                    if (error) {
                        console.error('Failed to add credits:', error);
                        throw error;
                    }

                    console.log(`Added 50 credits to user ${userId}. New total: ${currentCredits + 50}`);
                }
            }

            // 3. Handle Print/Workbook Orders (with orderId)
            if (session.mode === 'payment' && (session.metadata?.orderId || session.metadata?.order_id)) {
                const orderId = session.metadata?.orderId || session.metadata?.order_id;
                console.log(`Processing order payment: ${orderId}`);

                // Check if it's a Poster Order
                const { data: posterOrder } = await supabase
                    .from('poster_orders')
                    .select('id, status')
                    .eq('id', orderId)
                    .single();

                if (posterOrder) {
                    // Idempotency: Only process if not already paid
                    if (posterOrder.status !== 'paid') {
                        await supabase
                            .from('poster_orders')
                            .update({
                                status: 'paid',
                                discount_applied: true,
                                paid_at: new Date().toISOString()
                            })
                            .eq('id', orderId);
                        console.log("Marked poster order as paid:", orderId);

                        // Trigger Prodigi submission
                        try {
                            await supabase.functions.invoke('submit-to-prodigi', {
                                body: { orderId: orderId }
                            });
                            console.log("Triggered Prodigi submission for:", orderId);
                        } catch (prodigiError) {
                            console.error("Failed to trigger Prodigi:", prodigiError);
                            // Don't throw - order is paid, Prodigi can be retried
                        }
                    } else {
                        console.log("Poster order already paid, skipping:", orderId);
                    }
                } else {
                    // Check if it's a Workbook Order
                    const { data: workbookOrder } = await supabase
                        .from('workbook_orders')
                        .select('id, status')
                        .eq('id', orderId)
                        .single();

                    if (workbookOrder) {
                        // Idempotency: Only process if not already paid
                        if (workbookOrder.status !== 'paid') {
                            await supabase
                                .from('workbook_orders')
                                .update({ status: 'paid', paid_at: new Date().toISOString() })
                                .eq('id', orderId);

                            console.log("Marked workbook order as paid:", orderId);

                            // Trigger Workbook Generation
                            try {
                                await supabase.functions.invoke('generate-workbook-pdf', {
                                    body: { order_id: orderId, action: 'generate' }
                                });
                                console.log("Triggered workbook generation for:", orderId);
                            } catch (genError) {
                                console.error("Failed to generate workbook:", genError);
                                // Don't throw - order is paid, generation can be retried
                            }
                        } else {
                            console.log("Workbook order already paid, skipping:", orderId);
                        }
                    } else {
                        console.error("Order not found in poster_orders or workbook_orders:", orderId);
                    }
                }
            }
        }

        // ============================================
        // SUBSCRIPTION LIFECYCLE EVENTS
        // ============================================
        else if (event.type === 'customer.subscription.updated') {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;

            // Find user by stripe_customer_id
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, subscription_tier')
                .eq('stripe_customer_id', customerId)
                .single();

            if (profile) {
                // Check subscription status
                if (subscription.status === 'active') {
                    console.log(`Subscription active for customer: ${customerId}`);
                } else if (subscription.status === 'past_due') {
                    console.log(`Subscription past due for customer: ${customerId}`);
                    // Could send notification to user here
                }
            }
        }

        else if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;

            // Find user and downgrade to FREE
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .single();

            if (profile) {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'FREE',
                        stripe_subscription_id: null,
                    })
                    .eq('id', profile.id);

                if (error) {
                    console.error('Failed to downgrade subscription:', error);
                    throw error;
                } else {
                    console.log(`Downgraded user ${profile.id} to FREE tier`);
                }
            }
        }

        else if (event.type === 'invoice.payment_failed') {
            const invoice = event.data.object as Stripe.Invoice;
            const customerId = invoice.customer as string;

            console.error(`Payment failed for customer: ${customerId}`);

            // Find user and log the failure
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, email')
                .eq('stripe_customer_id', customerId)
                .single();

            if (profile) {
                // Could insert into a notifications table or send email
                console.log(`Payment failed notification needed for user: ${profile.id}`);
            }
        }

        // ============================================
        // MARK EVENT AS COMPLETED
        // ============================================
        await markEventStatus(supabase, event.id, 'completed', {
            type: event.type,
            processed_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (processingError) {
        // ============================================
        // MARK EVENT AS FAILED
        // ============================================
        console.error('Error processing webhook event:', processingError);

        await markEventStatus(
            supabase,
            event.id,
            'failed',
            { type: event.type },
            processingError instanceof Error ? processingError.message : 'Unknown error'
        );

        // Return 200 anyway to prevent infinite retries for unrecoverable errors
        // Stripe will see 200 and not retry, but we've logged the failure
        return new Response(JSON.stringify({
            received: true,
            error: 'Processing failed, logged for retry'
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });
    }
})
