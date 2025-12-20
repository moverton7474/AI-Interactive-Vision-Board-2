/**
 * Shared CORS & Security Headers for Supabase Edge Functions
 *
 * Import this in all Edge Functions for consistent CORS and security handling.
 * Implements L1 - Security Headers Enhancement (OWASP Best Practices)
 */

// CORS headers for cross-origin requests
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Security headers (L1 - OWASP Best Practices)
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
}

// Combined headers for all responses
export const allHeaders = {
  ...corsHeaders,
  ...securityHeaders,
  'Content-Type': 'application/json',
}

/**
 * Handle CORS preflight request
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders
    })
  }
  return null
}

/**
 * Create a JSON response with CORS and security headers
 */
export function jsonResponse(data: any, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: allHeaders
    }
  )
}

/**
 * Create an error response with CORS and security headers
 */
export function errorResponse(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: allHeaders
    }
  )
}

/**
 * Create a rate limit exceeded response
 */
export function rateLimitResponse(retryAfter: number = 60): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      retry_after: retryAfter
    }),
    {
      status: 429,
      headers: {
        ...allHeaders,
        'Retry-After': String(retryAfter)
      }
    }
  )
}
