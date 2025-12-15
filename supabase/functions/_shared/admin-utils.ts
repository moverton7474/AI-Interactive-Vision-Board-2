/**
 * Admin Utilities Module for Visionary Edge Functions
 *
 * Provides shared utilities for all admin Edge Functions including:
 * - Admin-specific authorization checks
 * - Audit logging helpers
 * - Response builders
 * - Common types
 *
 * @module admin-utils
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  AuthzContext,
  getAuthzContextFromRequest,
  assertPlatformRole,
  logAudit,
  AuthorizationError,
  PlatformRole
} from './authz.ts'
import { corsHeaders, jsonResponse, errorResponse } from './cors.ts'

// ============================================
// Types
// ============================================

export interface AdminFunctionContext {
  supabase: SupabaseClient;
  authz: AuthzContext;
  req: Request;
  body?: Record<string, any>;
}

export interface AdminResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface FilterParams {
  search?: string;
  status?: string;
  tier?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Constants
// ============================================

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

// Fields that should NEVER be exposed via admin APIs
export const SENSITIVE_FIELDS = [
  'plaid_access_token',
  'plaid_item_id',
  'stripe_payment_method_id',
  'stripe_secret',
  'api_key',
  'gemini_api_key',
  'password_hash',
  'totp_secret',
  'recovery_codes'
];

// ============================================
// Request Helpers
// ============================================

/**
 * Initialize admin function context with RBAC verification
 */
export async function initAdminContext(
  req: Request,
  supabase: SupabaseClient,
  allowedRoles: PlatformRole[] = ['platform_admin']
): Promise<AdminFunctionContext> {
  const authHeader = req.headers.get('Authorization');
  const authz = await getAuthzContextFromRequest(supabase, authHeader);

  // Enforce platform role
  assertPlatformRole(authz, allowedRoles);

  // Parse body for POST/PUT requests
  let body: Record<string, any> | undefined;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  return { supabase, authz, req, body };
}

/**
 * Parse pagination parameters from URL
 */
export function parsePaginationParams(url: URL): PaginationParams {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_PAGE_SIZE)))
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Parse filter parameters from URL
 */
export function parseFilterParams(url: URL): FilterParams {
  return {
    search: url.searchParams.get('search') || undefined,
    status: url.searchParams.get('status') || undefined,
    tier: url.searchParams.get('tier') || undefined,
    dateFrom: url.searchParams.get('date_from') || undefined,
    dateTo: url.searchParams.get('date_to') || undefined,
    sortBy: url.searchParams.get('sort_by') || undefined,
    sortOrder: (url.searchParams.get('sort_order') || 'desc') as 'asc' | 'desc'
  };
}

// ============================================
// Response Helpers
// ============================================

/**
 * Create a success response with data
 */
export function successResponse<T>(
  data: T,
  meta?: AdminResponse['meta']
): Response {
  const response: AdminResponse<T> = {
    success: true,
    data,
    ...(meta && { meta })
  };

  return jsonResponse(response);
}

/**
 * Create a paginated success response
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationParams,
  total: number
): Response {
  const hasMore = pagination.offset + data.length < total;

  return successResponse(data, {
    total,
    page: pagination.page,
    limit: pagination.limit,
    hasMore
  });
}

/**
 * Create an error response with structured format
 */
export function adminErrorResponse(
  message: string,
  code: string = 'ADMIN_ERROR',
  status: number = 400
): Response {
  const response: AdminResponse = {
    success: false,
    error: message,
    code
  };

  return new Response(
    JSON.stringify(response),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Handle common error cases
 */
export function handleAdminError(error: unknown): Response {
  console.error('Admin function error:', error);

  if (error instanceof AuthorizationError) {
    const status = error.code === 'UNAUTHENTICATED' ? 401 : 403;
    return adminErrorResponse(error.message, error.code, status);
  }

  if (error instanceof Error) {
    return adminErrorResponse(error.message, 'INTERNAL_ERROR', 500);
  }

  return adminErrorResponse('An unexpected error occurred', 'UNKNOWN_ERROR', 500);
}

// ============================================
// Audit Helpers
// ============================================

/**
 * Log an admin action with standardized format
 */
export async function logAdminAction(
  ctx: AdminFunctionContext,
  action: string,
  targetTable: string,
  targetId?: string,
  description?: string,
  metadata?: {
    teamId?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
  }
): Promise<void> {
  const ipAddress = ctx.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || ctx.req.headers.get('x-real-ip')
    || undefined;
  const userAgent = ctx.req.headers.get('user-agent') || undefined;

  await logAudit(
    ctx.supabase,
    ctx.authz,
    action,
    targetTable,
    targetId,
    description,
    {
      teamId: metadata?.teamId,
      oldValues: metadata?.oldValues,
      newValues: metadata?.newValues,
      ipAddress,
      userAgent
    }
  );
}

// ============================================
// Data Sanitization
// ============================================

/**
 * Remove sensitive fields from an object
 */
export function sanitizeRecord<T extends Record<string, any>>(
  record: T,
  additionalSensitiveFields: string[] = []
): Partial<T> {
  const allSensitiveFields = [...SENSITIVE_FIELDS, ...additionalSensitiveFields];
  const sanitized: Partial<T> = { ...record };

  for (const field of allSensitiveFields) {
    delete sanitized[field];
  }

  return sanitized;
}

/**
 * Sanitize an array of records
 */
export function sanitizeRecords<T extends Record<string, any>>(
  records: T[],
  additionalSensitiveFields: string[] = []
): Partial<T>[] {
  return records.map(r => sanitizeRecord(r, additionalSensitiveFields));
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Validate email format
 */
export function isValidEmail(str: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: Record<string, any> | undefined,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!body) {
    return { valid: false, missing: requiredFields };
  }

  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null) {
      missing.push(field);
    }
  }

  return { valid: missing.length === 0, missing };
}

// ============================================
// Query Helpers
// ============================================

/**
 * Apply search filter to a query
 */
export function applySearchFilter(
  query: any,
  search: string | undefined,
  fields: string[]
): any {
  if (!search || fields.length === 0) return query;

  // Build OR filter for multiple fields
  const searchLower = search.toLowerCase();
  const orFilters = fields.map(f => `${f}.ilike.%${searchLower}%`).join(',');

  return query.or(orFilters);
}

/**
 * Apply date range filter to a query
 */
export function applyDateFilter(
  query: any,
  dateField: string,
  dateFrom: string | undefined,
  dateTo: string | undefined
): any {
  if (dateFrom) {
    query = query.gte(dateField, dateFrom);
  }
  if (dateTo) {
    query = query.lte(dateField, dateTo);
  }
  return query;
}

/**
 * Apply sorting to a query
 */
export function applySorting(
  query: any,
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc',
  defaultSortBy: string = 'created_at'
): any {
  const field = sortBy || defaultSortBy;
  const ascending = sortOrder === 'asc';

  return query.order(field, { ascending });
}

// ============================================
// Common Admin Queries
// ============================================

/**
 * Get user profile with safe fields only
 */
export async function getAdminUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, any> | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      names,
      email,
      avatar_url,
      subscription_tier,
      stripe_customer_id,
      is_beta_user,
      is_early_access,
      is_locked,
      locked_at,
      locked_reason,
      credits,
      admin_notes,
      created_at,
      updated_at,
      last_sign_in_at
    `)
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return sanitizeRecord(data);
}

/**
 * Get user's team memberships
 */
export async function getUserTeamMemberships(
  supabase: SupabaseClient,
  userId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      id,
      role,
      is_active,
      created_at,
      teams (
        id,
        name,
        slug,
        owner_id
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) return [];

  return data || [];
}

/**
 * Get basic user stats
 */
export async function getUserStats(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};

  // Vision boards count
  const { count: visionCount } = await supabase
    .from('vision_boards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  stats.visionBoards = visionCount || 0;

  // Habits count
  const { count: habitsCount } = await supabase
    .from('habits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  stats.habits = habitsCount || 0;

  // Print orders count
  const { count: ordersCount } = await supabase
    .from('print_product_orders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  stats.printOrders = ordersCount || 0;

  return stats;
}

// Re-export from other modules for convenience
export { corsHeaders, jsonResponse, errorResponse } from './cors.ts';
export {
  AuthzContext,
  getAuthzContextFromRequest,
  assertPlatformRole,
  logAudit,
  AuthorizationError,
  PlatformRole,
  TeamRole
} from './authz.ts';
