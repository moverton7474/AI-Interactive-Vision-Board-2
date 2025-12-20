/**
 * Rate Limiting Module for Supabase Edge Functions
 *
 * Implements L2 - Rate Limiting on Sensitive Endpoints
 * Prevents enumeration attacks, brute-force, and API abuse.
 *
 * @module rate-limit
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createSecurityAlert } from './authz.ts'

// ============================================
// Types
// ============================================

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Identifier type for rate limiting */
  keyType: 'user' | 'ip' | 'endpoint';
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Seconds until rate limit resets */
  resetIn: number;
  /** Total limit for the window */
  limit: number;
}

// ============================================
// Default Rate Limit Configurations
// ============================================

export const RATE_LIMITS = {
  // Authentication endpoints - strict limits
  auth: {
    maxRequests: 5,
    windowSeconds: 300, // 5 minutes
    keyType: 'ip' as const,
  },

  // API endpoints - moderate limits
  api: {
    maxRequests: 100,
    windowSeconds: 60, // 1 minute
    keyType: 'user' as const,
  },

  // AI/Generation endpoints - expensive operations
  ai: {
    maxRequests: 20,
    windowSeconds: 60, // 1 minute
    keyType: 'user' as const,
  },

  // Admin endpoints - stricter limits
  admin: {
    maxRequests: 30,
    windowSeconds: 60, // 1 minute
    keyType: 'user' as const,
  },

  // Public endpoints - lenient limits
  public: {
    maxRequests: 200,
    windowSeconds: 60, // 1 minute
    keyType: 'ip' as const,
  },
} as const;

// ============================================
// In-Memory Rate Limiter (for Edge Functions)
// ============================================

// Simple in-memory store (resets when function cold-starts)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit using in-memory store
 * Best for: Quick checks, non-critical endpoints
 */
export function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const storeKey = `${config.keyType}:${key}`;

  let record = rateLimitStore.get(storeKey);

  // Create new record or reset if expired
  if (!record || record.resetAt < now) {
    record = {
      count: 0,
      resetAt: now + windowMs,
    };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(storeKey, record);

  const remaining = Math.max(0, config.maxRequests - record.count);
  const resetIn = Math.ceil((record.resetAt - now) / 1000);
  const allowed = record.count <= config.maxRequests;

  return {
    allowed,
    remaining,
    resetIn,
    limit: config.maxRequests,
  };
}

// ============================================
// Database-backed Rate Limiter (Persistent)
// ============================================

/**
 * Check rate limit using database (persistent across function instances)
 * Best for: Critical endpoints, auth, financial operations
 *
 * Requires the rate_limits table (see migration below)
 */
export async function checkRateLimitDb(
  supabase: SupabaseClient,
  key: string,
  config: RateLimitConfig,
  endpoint?: string
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowSeconds * 1000);
  const storeKey = `${config.keyType}:${key}`;

  try {
    // Count requests in the current window
    const { count, error: countError } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', storeKey)
      .gte('created_at', windowStart.toISOString());

    if (countError) {
      console.error('Rate limit check error:', countError);
      // Fail open - allow request if rate limit check fails
      return { allowed: true, remaining: config.maxRequests, resetIn: config.windowSeconds, limit: config.maxRequests };
    }

    const currentCount = count || 0;
    const allowed = currentCount < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - currentCount - 1);

    // Log this request
    if (allowed) {
      await supabase.from('rate_limits').insert({
        key: storeKey,
        endpoint: endpoint || 'unknown',
        key_type: config.keyType,
      });
    }

    // Clean up old records (async, don't wait)
    cleanupOldRecords(supabase, config.windowSeconds).catch(console.error);

    return {
      allowed,
      remaining,
      resetIn: config.windowSeconds,
      limit: config.maxRequests,
    };
  } catch (err) {
    console.error('Rate limit error:', err);
    // Fail open
    return { allowed: true, remaining: config.maxRequests, resetIn: config.windowSeconds, limit: config.maxRequests };
  }
}

/**
 * Clean up old rate limit records
 */
async function cleanupOldRecords(
  supabase: SupabaseClient,
  windowSeconds: number
): Promise<void> {
  const cutoff = new Date(Date.now() - windowSeconds * 2 * 1000);

  await supabase
    .from('rate_limits')
    .delete()
    .lt('created_at', cutoff.toISOString());
}

// ============================================
// Rate Limit Middleware Helper
// ============================================

/**
 * Create a rate limit checker for an endpoint
 *
 * @example
 * const rateLimit = createRateLimiter(supabase, RATE_LIMITS.api);
 * const result = await rateLimit(userId, 'my-endpoint');
 * if (!result.allowed) {
 *   return rateLimitResponse(result.resetIn);
 * }
 */
export function createRateLimiter(
  supabase: SupabaseClient | null,
  config: RateLimitConfig
) {
  return async (key: string, endpoint?: string): Promise<RateLimitResult> => {
    if (supabase) {
      return checkRateLimitDb(supabase, key, config, endpoint);
    }
    return checkRateLimitMemory(key, config);
  };
}

/**
 * Get client IP from request headers
 */
export function getClientIp(req: Request): string {
  // Check various headers for client IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return 'unknown';
}

/**
 * Rate limit and alert on excessive requests
 */
export async function checkRateLimitWithAlert(
  supabase: SupabaseClient,
  key: string,
  config: RateLimitConfig,
  endpoint: string,
  userId?: string
): Promise<RateLimitResult> {
  const result = await checkRateLimitDb(supabase, key, config, endpoint);

  // Create security alert if rate limit exceeded
  if (!result.allowed) {
    await createSecurityAlert(
      supabase,
      'rate_limit_exceeded',
      'medium',
      userId || null,
      null,
      `Rate limit exceeded for ${endpoint}`,
      {
        key,
        key_type: config.keyType,
        endpoint,
        limit: config.maxRequests,
        window_seconds: config.windowSeconds,
      }
    );
  }

  return result;
}

// ============================================
// Response Header Helpers
// ============================================

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetIn),
  };
}
