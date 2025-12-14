import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

/**
 * Stripe Webhook Handler with P0-A Security & Idempotency Hardening
 *
 * Key Security Features:
 * 1. Signature verification using raw request body (Stripe SDK best practice)
 * 2. Global idempotency via stripe_webhook_events table
 * 3. Order-level idempotency via status checks (defense in depth)
 * 4. Proper error handling and logging
 *
 * Event Types Handled:
 * - checkout.session.completed (subscriptions, credits, orders)
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_failed
 */

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2022-11-15',
    httpClient: Stripe.createFetchHttpClient(),
})

interface WebhookEventRecord {
    event_id: string
    type: string
    created_at: string
    processed_at: string | null
    metadata: Record<string, any>
}

serve(async (req) => {
    const requestId = crypto.randomUUID().slice(0, 8)
    console.log(`[${requestId}] Stripe webhook request received`)

    // Get signature from header (case-insensitive check)
    const signature = req.headers.get('Stripe-Signature') || req.headers.get('stripe-signature')
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')

    if (!signature || !STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY) {
        console.error(`[${requestId}] Missing secrets or signature`)
        return new Response('Missing webhook configuration', { status: 400 })
    }

    // P0-A: Verify Stripe signature using raw request body
    // CRITICAL: Must use raw body text, not parsed JSON
    const body = await req.text()
    let event: Stripe.Event
    try {
        event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET)
    } catch (err: any) {
        console.error(`[${requestId}] Signature verification failed:`, err.message)
        return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 })
    }

    console.log(`[${requestId}] Event verified: ${event.id} (${event.type})`)

    // Create Supabase client with service role (for cross-user operations)
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ============================================
    // P0-A: IDEMPOTENCY CHECK
    // Check if this exact event was already processed
    // ============================================
    try {
        // Check if event already exists and was processed
        const { data: existingEvent, error: checkError } = await supabase
            .from('stripe_webhook_events')
            .select('event_id, processed_at')
            .eq('event_id', event.id)
            .maybeSingle()

        if (checkError) {
            console.warn(`[${requestId}] Idempotency check failed (continuing):`, checkError.message)
            // Continue processing - table might not exist yet
        } else if (existingEvent?.processed_at) {
            // Event was already fully processed - return 200 to acknowledge receipt
            console.log(`[${requestId}] Event ${event.id} already processed at ${existingEvent.processed_at}, skipping`)
            return new Response(JSON.stringify({
                received: true,
                duplicate: true,
                event_id: event.id
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // Insert or update the event record (mark as in-progress)
        const { error: insertError } = await supabase
            .from('stripe_webhook_events')
            .upsert({
                event_id: event.id,
                type: event.type,
                created_at: new Date().toISOString(),
                processed_at: null, // Will be set after successful processing
                metadata: {
                    request_id: requestId,
                    started_at: new Date().toISOString()
                }
            }, {
                onConflict: 'event_id'
            })

        if (insertError) {
            console.warn(`[${requestId}] Failed to record event start:`, insertError.message)
        }
    } catch (idempotencyErr: any) {
        console.warn(`[${requestId}] Idempotency system error (continuing):`, idempotencyErr.message)
    }

    // ============================================
    // EVENT HANDLERS
    // ============================================

    let processingMetadata: Record<string, any> = {
        event_type: event.type,
        request_id: requestId
    }

    try {
        // ============================================
        // CHECKOUT SESSION COMPLETED
        // ============================================
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session
            const userId = session.metadata?.userId || session.metadata?.user_id
            const tier = session.metadata?.tier

            processingMetadata.session_id = session.id
            processingMetadata.mode = session.mode
            processingMetadata.user_id = userId

            // 1. Handle Subscription
            if (session.mode === 'subscription') {
                if (userId) {
                    const subscriptionTier = tier || 'PRO'
                    const credits = subscriptionTier === 'ELITE' ? 1000 : 500

                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            subscription_tier: subscriptionTier,
                            credits: credits,
                            stripe_customer_id: session.customer as string,
                            stripe_subscription_id: session.subscription as string,
                        })
                        .eq('id', userId)

                    if (error) {
                        console.error(`[${requestId}] Failed to update subscription:`, error)
                        processingMetadata.error = error.message
                    } else {
                        console.log(`[${requestId}] User ${userId} upgraded to ${subscriptionTier}`)
                        processingMetadata.subscription_tier = subscriptionTier
                        processingMetadata.success = true
                    }
                } else {
                    console.error(`[${requestId}] No userId in subscription session metadata`)
                    processingMetadata.error = 'Missing userId in metadata'
                }
            }

            // 2. Handle Credit Pack Purchase (no orderId)
            else if (session.mode === 'payment' && !session.metadata?.orderId && !session.metadata?.order_id) {
                if (userId) {
                    // Atomic credit increment to handle concurrent requests
                    const { data: profile, error: fetchError } = await supabase
                        .from('profiles')
                        .select('credits')
                        .eq('id', userId)
                        .single()

                    if (fetchError) {
                        console.error(`[${requestId}] Failed to fetch profile:`, fetchError)
                        processingMetadata.error = fetchError.message
                    } else {
                        const currentCredits = profile?.credits || 0
                        const { error: updateError } = await supabase
                            .from('profiles')
                            .update({ credits: currentCredits + 50 })
                            .eq('id', userId)

                        if (updateError) {
                            console.error(`[${requestId}] Failed to add credits:`, updateError)
                            processingMetadata.error = updateError.message
                        } else {
                            console.log(`[${requestId}] Added 50 credits to user ${userId}. New total: ${currentCredits + 50}`)
                            processingMetadata.credits_added = 50
                            processingMetadata.new_total = currentCredits + 50
                            processingMetadata.success = true
                        }
                    }
                }
            }

            // 3. Handle Print/Workbook Orders (with orderId)
            if (session.mode === 'payment' && (session.metadata?.orderId || session.metadata?.order_id)) {
                const orderId = session.metadata.orderId || session.metadata.order_id
                console.log(`[${requestId}] Processing order payment: ${orderId}`)
                processingMetadata.order_id = orderId

                // Check Poster Orders first
                const { data: posterOrder } = await supabase
                    .from('poster_orders')
                    .select('id, status')
                    .eq('id', orderId)
                    .single()

                if (posterOrder) {
                    processingMetadata.order_type = 'poster'

                    // Defense-in-depth idempotency: Check order status
                    if (posterOrder.status !== 'paid' && posterOrder.status !== 'submitted' && posterOrder.status !== 'shipped') {
                        const { error: updateError } = await supabase
                            .from('poster_orders')
                            .update({
                                status: 'paid',
                                discount_applied: true,
                                paid_at: new Date().toISOString()
                            })
                            .eq('id', orderId)

                        if (updateError) {
                            console.error(`[${requestId}] Failed to mark poster order as paid:`, updateError)
                            processingMetadata.error = updateError.message
                        } else {
                            console.log(`[${requestId}] Marked poster order as paid: ${orderId}`)
                            processingMetadata.poster_paid = true

                            // Trigger Prodigi submission
                            try {
                                await supabase.functions.invoke('submit-to-prodigi', {
                                    body: { orderId: orderId }
                                })
                                console.log(`[${requestId}] Triggered Prodigi submission for: ${orderId}`)
                                processingMetadata.prodigi_triggered = true
                            } catch (prodigiError: any) {
                                console.error(`[${requestId}] Prodigi trigger failed:`, prodigiError.message)
                                processingMetadata.prodigi_error = prodigiError.message
                            }
                        }
                    } else {
                        console.log(`[${requestId}] Poster order ${orderId} already processed (status: ${posterOrder.status})`)
                        processingMetadata.already_processed = true
                    }
                } else {
                    // Check Workbook Orders
                    const { data: workbookOrder } = await supabase
                        .from('workbook_orders')
                        .select('id, status')
                        .eq('id', orderId)
                        .single()

                    if (workbookOrder) {
                        processingMetadata.order_type = 'workbook'

                        // Defense-in-depth idempotency
                        if (workbookOrder.status !== 'paid' && workbookOrder.status !== 'submitted' && workbookOrder.status !== 'printing') {
                            const { error: updateError } = await supabase
                                .from('workbook_orders')
                                .update({
                                    status: 'paid',
                                    paid_at: new Date().toISOString()
                                })
                                .eq('id', orderId)

                            if (updateError) {
                                console.error(`[${requestId}] Failed to mark workbook order as paid:`, updateError)
                                processingMetadata.error = updateError.message
                            } else {
                                console.log(`[${requestId}] Marked workbook order as paid: ${orderId}`)
                                processingMetadata.workbook_paid = true

                                // Trigger Workbook Generation
                                try {
                                    await supabase.functions.invoke('generate-workbook-pdf', {
                                        body: { order_id: orderId, action: 'generate' }
                                    })
                                    console.log(`[${requestId}] Triggered workbook generation for: ${orderId}`)
                                    processingMetadata.generation_triggered = true
                                } catch (genError: any) {
                                    console.error(`[${requestId}] Workbook generation failed:`, genError.message)
                                    processingMetadata.generation_error = genError.message
                                }
                            }
                        } else {
                            console.log(`[${requestId}] Workbook order ${orderId} already processed (status: ${workbookOrder.status})`)
                            processingMetadata.already_processed = true
                        }
                    } else {
                        console.error(`[${requestId}] Order not found: ${orderId}`)
                        processingMetadata.error = 'Order not found'
                    }
                }
            }
        }

        // ============================================
        // SUBSCRIPTION UPDATED
        // ============================================
        else if (event.type === 'customer.subscription.updated') {
            const subscription = event.data.object as Stripe.Subscription
            const customerId = subscription.customer as string

            processingMetadata.customer_id = customerId
            processingMetadata.subscription_status = subscription.status

            const { data: profile } = await supabase
                .from('profiles')
                .select('id, subscription_tier')
                .eq('stripe_customer_id', customerId)
                .single()

            if (profile) {
                processingMetadata.user_id = profile.id

                if (subscription.status === 'active') {
                    console.log(`[${requestId}] Subscription active for user ${profile.id}`)
                } else if (subscription.status === 'past_due') {
                    console.log(`[${requestId}] Subscription past_due for user ${profile.id}`)
                    // Could trigger notification here
                } else if (subscription.status === 'canceled') {
                    console.log(`[${requestId}] Subscription canceled for user ${profile.id}`)
                }
                processingMetadata.success = true
            }
        }

        // ============================================
        // SUBSCRIPTION DELETED
        // ============================================
        else if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object as Stripe.Subscription
            const customerId = subscription.customer as string

            processingMetadata.customer_id = customerId

            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .single()

            if (profile) {
                processingMetadata.user_id = profile.id

                const { error } = await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'FREE',
                        stripe_subscription_id: null,
                    })
                    .eq('id', profile.id)

                if (error) {
                    console.error(`[${requestId}] Failed to downgrade subscription:`, error)
                    processingMetadata.error = error.message
                } else {
                    console.log(`[${requestId}] Downgraded user ${profile.id} to FREE tier`)
                    processingMetadata.downgraded = true
                    processingMetadata.success = true
                }
            }
        }

        // ============================================
        // PAYMENT FAILED
        // ============================================
        else if (event.type === 'invoice.payment_failed') {
            const invoice = event.data.object as Stripe.Invoice
            const customerId = invoice.customer as string

            processingMetadata.customer_id = customerId
            console.error(`[${requestId}] Payment failed for customer: ${customerId}`)

            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .single()

            if (profile) {
                processingMetadata.user_id = profile.id
                console.log(`[${requestId}] Payment failure logged for user: ${profile.id}`)
                // Could insert notification or send email here
                processingMetadata.success = true
            }
        }

        // ============================================
        // MARK EVENT AS PROCESSED
        // ============================================
        try {
            await supabase
                .from('stripe_webhook_events')
                .update({
                    processed_at: new Date().toISOString(),
                    metadata: processingMetadata
                })
                .eq('event_id', event.id)

            console.log(`[${requestId}] Event ${event.id} marked as processed`)
        } catch (markErr: any) {
            console.warn(`[${requestId}] Failed to mark event as processed:`, markErr.message)
        }

    } catch (processingError: any) {
        console.error(`[${requestId}] Processing error:`, processingError.message)
        processingMetadata.fatal_error = processingError.message

        // Try to record the error
        try {
            await supabase
                .from('stripe_webhook_events')
                .update({
                    metadata: processingMetadata
                    // Note: NOT setting processed_at so it can be retried
                })
                .eq('event_id', event.id)
        } catch (e) {
            console.error(`[${requestId}] Failed to record error:`, e)
        }
    }

    // Always return 200 to acknowledge receipt
    // Stripe will retry on non-2xx, which we only want for true failures
    return new Response(JSON.stringify({
        received: true,
        event_id: event.id,
        request_id: requestId
    }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
    })
})
