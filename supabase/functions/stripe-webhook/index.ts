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
          // Logic to find user by email/metadata and update profile
          console.log("Subscription successful for", session.customer_email)
          // Update 'profiles' table logic here...
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