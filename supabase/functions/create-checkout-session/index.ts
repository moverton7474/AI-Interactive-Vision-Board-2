import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Use service role for order lookups
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    const { priceId, orderId, mode = 'subscription', successUrl, cancelUrl, tier } = await req.json()

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    let orderAmount = 0;
    let productName = '';

    // For subscription mode, use priceId
    if (mode === 'subscription' && priceId) {
      lineItems = [{
        price: priceId,
        quantity: 1,
      }];
    }
    // For payment mode with orderId, look up order and create dynamic price
    else if (mode === 'payment' && orderId) {
      // Try poster_orders first
      let { data: posterOrder } = await supabaseAdmin
        .from('poster_orders')
        .select('total_price, sku, product_type')
        .eq('id', orderId)
        .single();

      if (posterOrder) {
        orderAmount = Math.round(posterOrder.total_price * 100); // Convert to cents
        productName = posterOrder.product_type === 'canvas'
          ? `Vision Board Canvas (${posterOrder.sku})`
          : `Vision Board Poster (${posterOrder.sku})`;
      } else {
        // Try workbook_orders
        let { data: workbookOrder } = await supabaseAdmin
          .from('workbook_orders')
          .select('total_price, edition_type')
          .eq('id', orderId)
          .single();

        if (workbookOrder) {
          orderAmount = Math.round(workbookOrder.total_price * 100); // Convert to cents
          productName = `Visionary Workbook (${workbookOrder.edition_type})`;
        } else {
          throw new Error('Order not found');
        }
      }

      // Create dynamic price for the order
      lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            description: 'AI-generated vision board product',
          },
          unit_amount: orderAmount,
        },
        quantity: 1,
      }];
    }
    // Fallback for credit packs or other payments with priceId
    else if (mode === 'payment' && priceId) {
      lineItems = [{
        price: priceId,
        quantity: 1,
      }];
    }
    else {
      throw new Error('Invalid checkout configuration: missing priceId or orderId');
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        orderId: orderId || undefined,
        tier: tier || undefined,
      },
    })

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
