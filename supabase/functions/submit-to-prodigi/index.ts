import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Prodigi Print-on-Demand Edge Function
 * 
 * This function submits print orders to the Prodigi API.
 * If PRODIGI_API_KEY is not set, it returns a simulation response
 * so the demo flow continues working.
 * 
 * API Docs: https://www.prodigi.com/print-api/docs/
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const PRODIGI_API_KEY = Deno.env.get('PRODIGI_API_KEY')
    const PRODIGI_SANDBOX = Deno.env.get('PRODIGI_SANDBOX') !== 'false' // Default to sandbox

    const payload = await req.json()
    const { orderId, recipient, items } = payload

    // Validate required fields
    if (!orderId || !recipient || !items || items.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: orderId, recipient, or items'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // If no API key, return simulation response
    if (!PRODIGI_API_KEY) {
      console.log('PRODIGI_API_KEY not set - returning simulation response')
      return new Response(
        JSON.stringify({
          success: true,
          orderId: `SIM-DEMO-${orderId.substring(0, 8)}`,
          message: 'Simulation mode - Prodigi API key not configured',
          simulated: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construct Prodigi API request
    const prodigiEndpoint = PRODIGI_SANDBOX
      ? 'https://api.sandbox.prodigi.com/v4.0/Orders'
      : 'https://api.prodigi.com/v4.0/Orders'

    const prodigiPayload = {
      idempotencyKey: orderId, // Prevents duplicate orders
      merchantReference: orderId,
      shippingMethod: 'Standard',
      recipient: {
        name: recipient.name,
        address: {
          line1: recipient.address.line1,
          line2: recipient.address.line2 || '',
          postalOrZipCode: recipient.address.postalOrZipCode,
          countryCode: recipient.address.countryCode,
          townOrCity: recipient.address.townOrCity,
          stateOrCounty: recipient.address.stateOrCounty || ''
        }
      },
      items: items.map((item: any) => ({
        sku: item.sku,
        copies: item.copies || 1,
        sizing: item.sizing || 'fillPrintArea',
        attributes: {
          finish: item.finish || 'matte'
        },
        assets: item.assets.map((asset: any) => ({
          printArea: asset.printArea || 'default',
          url: asset.url
        }))
      }))
    }

    console.log('Submitting to Prodigi:', JSON.stringify(prodigiPayload, null, 2))

    const response = await fetch(prodigiEndpoint, {
      method: 'POST',
      headers: {
        'X-API-Key': PRODIGI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(prodigiPayload)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Prodigi API Error:', data)
      return new Response(
        JSON.stringify({
          success: false,
          error: data.message || 'Prodigi API rejected the order',
          details: data
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
      )
    }

    // Success - return the Prodigi order ID
    console.log('Prodigi order created:', data.id)
    return new Response(
      JSON.stringify({
        success: true,
        orderId: data.id,
        status: data.status?.stage || 'submitted',
        simulated: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Submit to Prodigi error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
