// Supabase Edge Function: submit-to-prodigi
// Submits poster orders to Prodigi Print-on-Demand API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PRODIGI_API_URL = 'https://api.prodigi.com/v4.0/Orders';
const PRODIGI_SANDBOX_URL = 'https://api.sandbox.prodigi.com/v4.0/Orders';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProdigiOrderPayload {
  orderId: string;
  recipient: {
    name: string;
    address: {
      line1: string;
      line2?: string;
      postalOrZipCode: string;
      countryCode: string;
      townOrCity: string;
      stateOrCounty?: string;
    };
  };
  items: Array<{
    sku: string;
    copies: number;
    sizing: string;
    assets: Array<{
      url: string;
      printArea: string;
    }>;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Get API Key from environment
    const apiKey = Deno.env.get('PRODIGI_API_KEY');
    if (!apiKey) {
      console.error('PRODIGI_API_KEY not configured');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Print service not configured. Please contact support.',
          code: 'API_KEY_MISSING'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. Parse incoming request
    const payload: ProdigiOrderPayload = await req.json();
    console.log('Received order request:', payload.orderId);

    // 3. Validate payload
    if (!payload.recipient || !payload.items || payload.items.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid order payload: missing recipient or items',
          code: 'INVALID_PAYLOAD'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. Construct Prodigi API request
    const prodigiRequest = {
      shippingMethod: 'Standard',
      idempotencyKey: payload.orderId, // Prevents duplicate orders
      recipient: payload.recipient,
      items: payload.items
    };

    // 5. Determine API URL (use sandbox for testing, production for live)
    // Check if using sandbox key (sandbox keys typically start with different prefix)
    const useSandbox = apiKey.includes('sandbox') || Deno.env.get('PRODIGI_USE_SANDBOX') === 'true';
    const apiUrl = useSandbox ? PRODIGI_SANDBOX_URL : PRODIGI_API_URL;

    console.log(`Submitting to Prodigi ${useSandbox ? 'SANDBOX' : 'PRODUCTION'}:`, apiUrl);

    // 6. Call Prodigi API
    const prodigiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(prodigiRequest),
    });

    const responseData = await prodigiResponse.json();

    // 7. Handle Prodigi response
    if (!prodigiResponse.ok) {
      console.error('Prodigi API error:', prodigiResponse.status, responseData);

      // Extract meaningful error message
      let errorMessage = 'Order submission failed';
      if (responseData.traceParent) {
        errorMessage = `Prodigi error: ${responseData.statusCode || prodigiResponse.status}`;
      }
      if (responseData.errors && responseData.errors.length > 0) {
        errorMessage = responseData.errors.map((e: any) => e.description || e.message).join(', ');
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          code: 'PRODIGI_API_ERROR',
          details: responseData
        }),
        {
          status: prodigiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 8. Success! Extract order ID
    const prodigiOrderId = responseData.order?.id || responseData.id;
    console.log('Order submitted successfully:', prodigiOrderId);

    // 9. Optionally update the database with the Prodigi order ID
    // (The frontend already does this, but we can do it here as backup)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from('poster_orders')
          .update({
            vendor_order_id: prodigiOrderId,
            status: 'submitted'
          })
          .eq('id', payload.orderId);
      }
    } catch (dbError) {
      console.warn('Failed to update database (non-critical):', dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: prodigiOrderId,
        status: responseData.order?.status || 'submitted',
        message: 'Order submitted to print provider'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        code: 'INTERNAL_ERROR'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
