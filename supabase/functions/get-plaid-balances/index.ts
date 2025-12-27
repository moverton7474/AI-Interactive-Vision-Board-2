import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { allHeaders, handleCors, rateLimitResponse } from '../_shared/cors.ts'
import { checkRateLimitWithAlert, getClientIp, getRateLimitHeaders } from '../_shared/rate-limit.ts'

declare const Deno: any;

/**
 * Get Plaid Account Balances
 *
 * Retrieves current account balances for a user's linked Plaid accounts.
 * Requires user authentication.
 */
serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Get environment variables
    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET')
    const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error('Plaid credentials not configured')
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Rate limiting - 30 requests per minute per IP
    const clientIp = getClientIp(req)
    const rateLimitResult = await checkRateLimitWithAlert(
      supabase,
      clientIp,
      { maxRequests: 30, windowSeconds: 60, keyType: 'ip' },
      'get-plaid-balances'
    )

    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for IP ${clientIp} on get-plaid-balances`)
      return rateLimitResponse(rateLimitResult.resetIn)
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authentication required')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid authentication token')
    }

    const userId = user.id

    // Get user's Plaid items (linked accounts)
    const { data: plaidItems, error: itemsError } = await supabase
      .from('plaid_items')
      .select('id, access_token, institution_id, status')
      .eq('user_id', userId)
      .eq('status', 'active')

    if (itemsError) {
      console.error('Error fetching Plaid items:', itemsError)
      throw new Error('Failed to retrieve linked accounts')
    }

    if (!plaidItems || plaidItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          accounts: [],
          message: 'No linked accounts found. Please link a bank account first.'
        }),
        {
          headers: {
            ...allHeaders,
            ...getRateLimitHeaders(rateLimitResult)
          }
        }
      )
    }

    // Plaid API URL based on environment
    const PLAID_API_URLS: Record<string, string> = {
      'sandbox': 'https://sandbox.plaid.com',
      'development': 'https://development.plaid.com',
      'production': 'https://production.plaid.com'
    }
    const PLAID_API_URL = PLAID_API_URLS[PLAID_ENV] || 'https://sandbox.plaid.com'

    // Fetch balances for all linked accounts
    const allAccounts: any[] = []
    const errors: any[] = []

    for (const item of plaidItems) {
      try {
        console.log(`Fetching balances for item ${item.id}`)

        const balanceResponse = await fetch(`${PLAID_API_URL}/accounts/balance/get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            access_token: item.access_token,
          }),
        })

        const balanceData = await balanceResponse.json()

        if (!balanceResponse.ok) {
          console.error(`Plaid balance error for item ${item.id}:`, balanceData)

          // Check if token needs refresh
          if (balanceData.error_code === 'ITEM_LOGIN_REQUIRED') {
            // Mark item as needing re-authentication
            // Using 'error' status (valid in CHECK constraint) with error details
            await supabase
              .from('plaid_items')
              .update({
                status: 'error',
                error_code: balanceData.error_code,
                error_message: 'Re-authentication required - please reconnect your bank account'
              })
              .eq('id', item.id)

            errors.push({
              item_id: item.id,
              institution_id: item.institution_id,
              error: 'Re-authentication required',
              error_code: balanceData.error_code
            })
          } else {
            errors.push({
              item_id: item.id,
              institution_id: item.institution_id,
              error: balanceData.error_message || 'Failed to fetch balances',
              error_code: balanceData.error_code
            })
          }
          continue
        }

        // Process accounts from this item
        for (const account of balanceData.accounts) {
          allAccounts.push({
            plaid_item_id: item.id,
            institution_id: item.institution_id,
            account_id: account.account_id,
            name: account.name,
            official_name: account.official_name,
            type: account.type,
            subtype: account.subtype,
            mask: account.mask,
            balances: {
              available: account.balances.available,
              current: account.balances.current,
              limit: account.balances.limit,
              iso_currency_code: account.balances.iso_currency_code,
              unofficial_currency_code: account.balances.unofficial_currency_code
            }
          })
        }
      } catch (fetchError: any) {
        console.error(`Error fetching item ${item.id}:`, fetchError)
        errors.push({
          item_id: item.id,
          institution_id: item.institution_id,
          error: fetchError.message || 'Network error'
        })
      }
    }

    // Calculate totals by account type
    const totals = {
      checking: 0,
      savings: 0,
      credit: 0,
      investment: 0,
      loan: 0,
      other: 0
    }

    for (const account of allAccounts) {
      const balance = account.balances.current || account.balances.available || 0

      switch (account.type) {
        case 'depository':
          if (account.subtype === 'checking') {
            totals.checking += balance
          } else if (account.subtype === 'savings') {
            totals.savings += balance
          } else {
            totals.other += balance
          }
          break
        case 'credit':
          totals.credit += balance
          break
        case 'investment':
          totals.investment += balance
          break
        case 'loan':
          totals.loan += balance
          break
        default:
          totals.other += balance
      }
    }

    const netWorth = totals.checking + totals.savings + totals.investment - totals.credit - totals.loan

    console.log(`Successfully retrieved ${allAccounts.length} accounts for user ${userId}`)

    return new Response(
      JSON.stringify({
        success: true,
        accounts: allAccounts,
        totals: {
          ...totals,
          net_worth: netWorth
        },
        errors: errors.length > 0 ? errors : undefined,
        fetched_at: new Date().toISOString()
      }),
      {
        headers: {
          ...allHeaders,
          ...getRateLimitHeaders(rateLimitResult)
        }
      }
    )

  } catch (error: any) {
    console.error('Get Plaid balances error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: allHeaders, status: 400 }
    )
  }
})
