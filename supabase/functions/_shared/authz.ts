/**
 * Authorization Helper Module for Visionary Edge Functions
 *
 * Provides centralized authorization logic for RBAC enforcement.
 * All sensitive Edge Functions should use this module.
 *
 * @module authz
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// Types
// ============================================

export type PlatformRole = 'platform_admin' | 'support_agent';
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface TeamMembership {
  teamId: string;
  teamName: string;
  role: TeamRole;
  isActive: boolean;
}

export interface AuthzContext {
  userId: string;
  email?: string;
  platformRole?: PlatformRole;
  teamMemberships: TeamMembership[];
  isAuthenticated: boolean;
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID_ROLE' = 'FORBIDDEN'
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// ============================================
// Core Functions
// ============================================

/**
 * Get the authorization context for the current user
 *
 * @param supabase - Supabase client (should use service role for full access)
 * @param userId - User ID to get context for
 * @returns AuthzContext with user's roles and permissions
 */
export async function getAuthzContext(
  supabase: SupabaseClient,
  userId: string
): Promise<AuthzContext> {
  if (!userId) {
    return {
      userId: '',
      isAuthenticated: false,
      teamMemberships: []
    };
  }

  // Fetch platform role
  const { data: platformRoleData } = await supabase
    .from('platform_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.now()')
    .single();

  // Fetch team memberships
  const { data: teamData } = await supabase
    .from('team_members')
    .select(`
      team_id,
      role,
      is_active,
      teams (
        name
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true);

  // Fetch user email
  const { data: userData } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  const teamMemberships: TeamMembership[] = (teamData || []).map((tm: any) => ({
    teamId: tm.team_id,
    teamName: tm.teams?.name || 'Unknown',
    role: tm.role as TeamRole,
    isActive: tm.is_active
  }));

  return {
    userId,
    platformRole: platformRoleData?.role as PlatformRole | undefined,
    teamMemberships,
    isAuthenticated: true
  };
}

/**
 * Get authorization context from request headers (JWT)
 *
 * @param supabase - Supabase client
 * @param authHeader - Authorization header from request
 * @returns AuthzContext or throws AuthorizationError
 */
export async function getAuthzContextFromRequest(
  supabase: SupabaseClient,
  authHeader: string | null
): Promise<AuthzContext> {
  if (!authHeader) {
    throw new AuthorizationError('Missing authorization header', 'UNAUTHENTICATED');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new AuthorizationError('Invalid or expired token', 'UNAUTHENTICATED');
  }

  return getAuthzContext(supabase, user.id);
}

// ============================================
// Assertion Functions
// ============================================

/**
 * Assert that the user has a required platform role
 *
 * @param ctx - Authorization context
 * @param allowedRoles - Array of allowed platform roles
 * @throws AuthorizationError if user doesn't have required role
 */
export function assertPlatformRole(
  ctx: AuthzContext,
  allowedRoles: PlatformRole[]
): void {
  if (!ctx.isAuthenticated) {
    throw new AuthorizationError('Not authenticated', 'UNAUTHENTICATED');
  }

  if (!ctx.platformRole || !allowedRoles.includes(ctx.platformRole)) {
    throw new AuthorizationError(
      `Requires platform role: ${allowedRoles.join(' or ')}`,
      'FORBIDDEN'
    );
  }
}

/**
 * Assert that the user has a required role in a specific team
 *
 * @param ctx - Authorization context
 * @param teamId - Team ID to check role for
 * @param allowedRoles - Array of allowed team roles
 * @throws AuthorizationError if user doesn't have required role
 */
export function assertTeamRole(
  ctx: AuthzContext,
  teamId: string,
  allowedRoles: TeamRole[]
): void {
  if (!ctx.isAuthenticated) {
    throw new AuthorizationError('Not authenticated', 'UNAUTHENTICATED');
  }

  // Platform admins bypass team role checks
  if (ctx.platformRole === 'platform_admin') {
    return;
  }

  const membership = ctx.teamMemberships.find(tm => tm.teamId === teamId);

  if (!membership) {
    throw new AuthorizationError('Not a member of this team', 'FORBIDDEN');
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new AuthorizationError(
      `Requires team role: ${allowedRoles.join(' or ')}`,
      'FORBIDDEN'
    );
  }
}

/**
 * Assert that the user is a member of a team (any role)
 *
 * @param ctx - Authorization context
 * @param teamId - Team ID to check membership for
 * @throws AuthorizationError if user is not a team member
 */
export function assertTeamMember(
  ctx: AuthzContext,
  teamId: string
): void {
  if (!ctx.isAuthenticated) {
    throw new AuthorizationError('Not authenticated', 'UNAUTHENTICATED');
  }

  // Platform admins can access any team
  if (ctx.platformRole === 'platform_admin') {
    return;
  }

  const membership = ctx.teamMemberships.find(tm => tm.teamId === teamId);

  if (!membership) {
    throw new AuthorizationError('Not a member of this team', 'FORBIDDEN');
  }
}

/**
 * Assert that the user owns the specified resource
 *
 * @param ctx - Authorization context
 * @param resourceUserId - User ID that owns the resource
 * @throws AuthorizationError if user doesn't own the resource
 */
export function assertResourceOwner(
  ctx: AuthzContext,
  resourceUserId: string
): void {
  if (!ctx.isAuthenticated) {
    throw new AuthorizationError('Not authenticated', 'UNAUTHENTICATED');
  }

  // Platform admins can access any resource
  if (ctx.platformRole === 'platform_admin') {
    return;
  }

  if (ctx.userId !== resourceUserId) {
    throw new AuthorizationError('Not authorized to access this resource', 'FORBIDDEN');
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if user is a platform admin
 */
export function isPlatformAdmin(ctx: AuthzContext): boolean {
  return ctx.platformRole === 'platform_admin';
}

/**
 * Check if user is a support agent
 */
export function isSupportAgent(ctx: AuthzContext): boolean {
  return ctx.platformRole === 'support_agent';
}

/**
 * Check if user has any platform role
 */
export function hasPlatformRole(ctx: AuthzContext, roles: PlatformRole[]): boolean {
  return ctx.platformRole !== undefined && roles.includes(ctx.platformRole);
}

/**
 * Get user's role in a specific team
 */
export function getTeamRole(ctx: AuthzContext, teamId: string): TeamRole | null {
  const membership = ctx.teamMemberships.find(tm => tm.teamId === teamId);
  return membership?.role || null;
}

/**
 * Check if user has required role in a team
 */
export function hasTeamRole(
  ctx: AuthzContext,
  teamId: string,
  roles: TeamRole[]
): boolean {
  // Platform admins have all team roles
  if (ctx.platformRole === 'platform_admin') {
    return true;
  }

  const membership = ctx.teamMemberships.find(tm => tm.teamId === teamId);
  return membership !== undefined && roles.includes(membership.role);
}

/**
 * Check if user is a member of a team (any role)
 */
export function isTeamMember(ctx: AuthzContext, teamId: string): boolean {
  // Platform admins are members of all teams
  if (ctx.platformRole === 'platform_admin') {
    return true;
  }

  return ctx.teamMemberships.some(tm => tm.teamId === teamId);
}

/**
 * Check if user can manage a team (owner or admin)
 */
export function canManageTeam(ctx: AuthzContext, teamId: string): boolean {
  return hasTeamRole(ctx, teamId, ['owner', 'admin']);
}

/**
 * Check if user can edit content in a team (owner, admin, or member)
 */
export function canEditTeamContent(ctx: AuthzContext, teamId: string): boolean {
  return hasTeamRole(ctx, teamId, ['owner', 'admin', 'member']);
}

// ============================================
// Audit Logging Helper
// ============================================

/**
 * Log an audit event
 *
 * @param supabase - Supabase client with service role
 * @param ctx - Authorization context
 * @param action - Action being performed
 * @param targetTable - Table being modified
 * @param targetId - ID of the target record
 * @param description - Human-readable description
 * @param metadata - Additional metadata
 */
export async function logAudit(
  supabase: SupabaseClient,
  ctx: AuthzContext,
  action: string,
  targetTable: string,
  targetId?: string,
  description?: string,
  metadata?: {
    teamId?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: ctx.userId,
        team_id: metadata?.teamId,
        platform_role: ctx.platformRole,
        action,
        target_table: targetTable,
        target_id: targetId,
        old_values: metadata?.oldValues,
        new_values: metadata?.newValues,
        description,
        ip_address: metadata?.ipAddress,
        user_agent: metadata?.userAgent,
        metadata: {}
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create audit log:', error);
      return null;
    }

    return data?.id;
  } catch (err) {
    console.error('Audit logging error:', err);
    return null;
  }
}

// ============================================
// Response Helpers
// ============================================

/**
 * Create an error response for authorization failures
 */
export function createAuthzErrorResponse(
  error: AuthorizationError,
  corsHeaders: Record<string, string> = {}
): Response {
  const status = error.code === 'UNAUTHENTICATED' ? 401 : 403;

  return new Response(
    JSON.stringify({
      error: error.message,
      code: error.code
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Wrap an Edge Function handler with authorization
 *
 * @param handler - The handler function to wrap
 * @param options - Authorization options
 * @returns Wrapped handler that checks authorization first
 */
export function withAuthz<T>(
  handler: (
    req: Request,
    ctx: AuthzContext,
    supabase: SupabaseClient
  ) => Promise<Response>,
  options: {
    requireAuth?: boolean;
    requirePlatformRole?: PlatformRole[];
    corsHeaders?: Record<string, string>;
  } = {}
): (req: Request, supabase: SupabaseClient) => Promise<Response> {
  const { requireAuth = true, requirePlatformRole, corsHeaders = {} } = options;

  return async (req: Request, supabase: SupabaseClient): Promise<Response> => {
    try {
      // Get authorization context
      const authHeader = req.headers.get('Authorization');
      let ctx: AuthzContext;

      if (requireAuth || authHeader) {
        ctx = await getAuthzContextFromRequest(supabase, authHeader);
      } else {
        ctx = {
          userId: '',
          isAuthenticated: false,
          teamMemberships: []
        };
      }

      // Check platform role if required
      if (requirePlatformRole) {
        assertPlatformRole(ctx, requirePlatformRole);
      }

      // Call the actual handler
      return await handler(req, ctx, supabase);

    } catch (error) {
      if (error instanceof AuthorizationError) {
        return createAuthzErrorResponse(error, corsHeaders);
      }

      console.error('Authorization wrapper error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }
  };
}
