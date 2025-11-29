import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Prodigi Print-on-Demand Edge Function v3
 *
 * Fixes:
 * - Omit empty line2/stateOrCounty fields (Prodigi rejects empty strings)
 * - Remove finish attribute for canvas products (GLOBAL-CAN-*)
 * - Trim whitespace from all address fields
 */
serve(async (req) => {
  // Handle CORS preflight requests - must return before any JSON parsing
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }
    })
  }

  try {
    const PRODIGI_API_KEY = Deno.env.get('PRODIGI_API_KEY')
    const PRODIGI_SANDBOX = Deno.env.get('PRODIGI_SANDBOX') !== 'false'

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

    // Build address object - only include fields with actual values
    // Prodigi rejects empty strings for optional fields
    const address: any = {
      line1: (recipient.address.line1 || '').trim(),
      postalOrZipCode: (recipient.address.postalOrZipCode || '').trim(),
      countryCode: (recipient.address.countryCode || '').trim(),
      townOrCity: (recipient.address.townOrCity || '').trim(),
    }

    // Only add optional fields if they have non-empty values
    const line2 = (recipient.address.line2 || '').trim()
    if (line2) {
      address.line2 = line2
    }

    const stateOrCounty = (recipient.address.stateOrCounty || '').trim()
    if (stateOrCounty) {
      address.stateOrCounty = stateOrCounty
    }

    const prodigiPayload = {
      idempotencyKey: orderId,
      merchantReference: orderId,
      shippingMethod: 'Standard',
      recipient: {
        name: (recipient.name || '').trim(),
        address
      },
      items: items.map((item: any) => {
        console.log('Processing item SKU:', item.sku)

        const mappedItem: any = {
          sku: item.sku,
          copies: item.copies || 1,
          sizing: item.sizing || 'fillPrintArea',
          assets: item.assets.map((asset: any) => ({
            printArea: asset.printArea || 'default',
            url: asset.url
          }))
        }

        // Canvas products (GLOBAL-CAN-*) require 'wrap' attribute
        // Check if SKU contains 'CAN' for canvas products
        const isCanvas = item.sku && (item.sku.includes('-CAN-') || item.sku.startsWith('GLOBAL-CAN'))
        console.log('Is canvas product:', isCanvas)

        if (isCanvas) {
          mappedItem.attributes = {
            wrap: 'MirrorWrap' // Prodigi expects PascalCase
          }
        } else {
          mappedItem.attributes = {
            finish: item.finish || 'matte'
          }
        }

        console.log('Final attributes:', JSON.stringify(mappedItem.attributes))

        return mappedItem
      })
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

    // Success - log full response to understand structure
    console.log('Prodigi full response:', JSON.stringify(data, null, 2))

    // Prodigi API v4 returns order in data.order or just data
    const prodigiOrderId = data.id || data.order?.id || data.orderId
    console.log('Extracted order ID:', prodigiOrderId)

    return new Response(
      JSON.stringify({
        success: true,
        orderId: prodigiOrderId,
        status: data.status?.stage || data.order?.status?.stage || 'submitted',
        simulated: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
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
