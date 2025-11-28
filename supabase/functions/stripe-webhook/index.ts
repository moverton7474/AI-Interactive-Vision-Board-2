import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Stripe } from "https://esm.sh/stripe@12.0.0?target=deno"

declare const Deno: any;

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
  
  if (!signature || !STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY) {
      return new Response('Missing secrets', { status: 400 })
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
  })

  // Verify signature (Simplified for Deno environment example)
  // In strict prod, use stripe.webhooks.constructEvent with raw body
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

      // Handle Subscription
      if (session.mode === 'subscription') {
        const customerEmail = session.customer_email || session.customer_details?.email
        const amountTotal = session.amount_total || 0

        // Determine subscription tier based on amount
        // ELITE: $49.99/mo (4999 cents), PRO: $19.99/mo (1999 cents)
        let tier = 'FREE'
        if (amountTotal >= 4000) {
          tier = 'ELITE'
        } else if (amountTotal >= 1500) {
          tier = 'PRO'
        }

        console.log(`Processing subscription: email=${customerEmail}, amount=${amountTotal}, tier=${tier}`)

        // Find user by email and update their subscription
        if (customerEmail) {
          // Single call to listUsers - much more efficient
          const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers()

          if (listError) {
            console.error('Failed to list users:', listError)
            return new Response(JSON.stringify({ error: 'Failed to lookup user' }), { status: 500 })
          }

          const matchedUser = authUsers.users?.find(u => u.email === customerEmail)

          if (matchedUser) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_tier: tier,
                credits: 9999, // Unlimited credits for paid tiers
                stripe_customer_id: session.customer,
                subscription_status: 'active'
              })
              .eq('id', matchedUser.id)

            if (updateError) {
              console.error('Failed to update profile:', updateError)
              return new Response(JSON.stringify({ error: 'Failed to update profile' }), { status: 500 })
            } else {
              console.log(`Successfully upgraded user ${customerEmail} to ${tier}`)
            }
          } else {
            console.warn('No user found with email:', customerEmail)
          }
        } else {
          console.warn('No customer email in session')
        }
      }

      // Handle Print Order
      if (session.mode === 'payment' && session.metadata?.order_id) {
        const { error: orderError } = await supabase
          .from('poster_orders')
          .update({ status: 'paid', discount_applied: true })
          .eq('id', session.metadata.order_id)

        if (orderError) {
          console.error('Failed to update order:', orderError)
        } else {
          console.log("Marked order as paid:", session.metadata.order_id)
        }
        // Trigger Prodigi submission here...
      }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
