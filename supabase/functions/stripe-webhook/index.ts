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
const priceId = session.line_items?.data?.[0]?.price?.id
            const customerEmail = session.customer_email
      
            // Determine subscription tier based on price
            let tier = 'FREE'
            const amountTotal = session.amount_total || 0
            if (priceId?.includes('elite') || amountTotal >= 9900) {
                      tier = 'ELITE'
                    } else if (priceId?.includes('pro') || priceId?.includes('price_pro') || amountTotal >= 1999) {
                      tier = 'PRO'
                    }

              // Find user by email and update their subscription
              if (customerEmail) {
                        // First, find the user ID from auth.users
                        const { data: users, error: userError } = await supabase
                          .from('profiles')
                          .select('id')
                          .eq('id', (await supabase.auth.admin.listUsers()).data.users?.find(u => u.email === customerEmail)?.id)
                          .single()

                        // Alternative: Query via RPC or just update by email match if profiles has email
                        // For simplicity, try to update profiles where we have a match
                        const { data: authUsers } = await supabase.auth.admin.listUsers()
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
                                                } else {
                                                  console.log(`Successfully upgraded user ${customerEmail} to ${tier}`)
                                                }
                                  }
                      } else {
                        console.warn('Could not find user with email:', customerEmail)
                      }
            }
      
      // Handle Print Order
      if (session.mode === 'payment' && session.metadata?.order_id) {
          await supabase
            .from('poster_orders')
            .update({ status: 'paid', discount_applied: true })
            .eq('id', session.metadata.order_id)
          
          console.log("Marked order as paid:", session.metadata.order_id)
          // Trigger Prodigi submission here...
      }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
