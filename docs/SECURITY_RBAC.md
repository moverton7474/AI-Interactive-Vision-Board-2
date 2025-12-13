# Visionary AI Security Architecture - RBAC & Policies

> **Version**: 2.0
> **Last Updated**: 2025-12-13
> **Author**: Security Architecture Review

## Table of Contents

1. [Overview](#overview)
2. [Role Model](#role-model)
3. [Permission Matrix](#permission-matrix)
4. [RLS Policy Design](#rls-policy-design)
5. [Audit Logging](#audit-logging)
6. [Edge Function Authorization](#edge-function-authorization)
7. [Frontend Authorization](#frontend-authorization)
8. [Enterprise Identity (Future)](#enterprise-identity-future)

---

## Overview

This document defines the enterprise-grade Role-Based Access Control (RBAC) model for Visionary AI, covering:

- **Platform-level roles**: For internal Visionary operators and support staff
- **Team/Organization-level roles**: For enterprise customers
- **User-level access**: Individual user data isolation

### Security Principles

1. **Principle of Least Privilege**: Users only access what they need
2. **Defense in Depth**: Multiple layers (RLS, Edge Functions, Frontend)
3. **Audit Everything**: Log all sensitive operations
4. **Fail Secure**: Default deny, explicit allow

---

## Role Model

### Platform Roles

| Role | Description | Use Case |
|------|-------------|----------|
| `platform_admin` | Full cross-tenant access | System configuration, troubleshooting, data ops |
| `support_agent` | Limited cross-tenant read access | Customer support, viewing user data (with logging) |

Platform roles are stored in the `platform_roles` table and checked via `is_platform_admin()` and `has_platform_role()` helper functions.

### Team Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `owner` | Billing owner, full admin | All team operations, including destructive actions |
| `admin` | Team administrator | Manage members, integrations, goals, print orders |
| `member` | Standard team member | Create/update own goals, view team data |
| `viewer` | Read-only access | View team dashboards, goals, reports only |

Team roles are stored in `team_members.role` column.

### Role Hierarchy

```
platform_admin
    └── (cross-tenant access)

support_agent
    └── (cross-tenant read-only)

Team Level:
    owner
      └── admin
            └── member
                  └── viewer
```

---

## Permission Matrix

### User Domain

| Action | owner | admin | member | viewer | platform_admin | support_agent |
|--------|-------|-------|--------|--------|----------------|---------------|
| Read own profile | - | - | - | - | Yes | Yes (logged) |
| Update own profile | - | - | - | - | Yes | No |
| Read other user profile | No | No | No | No | Yes | Yes (logged) |

### Vision Boards Domain

| Action | Own Data | Team Data | Cross-Tenant |
|--------|----------|-----------|--------------|
| Create | Yes | N/A | platform_admin |
| Read | Yes | N/A | platform_admin, support_agent |
| Update | Yes | N/A | platform_admin |
| Delete | Yes | N/A | platform_admin |

### Team Domain

| Action | owner | admin | member | viewer | platform_admin |
|--------|-------|-------|--------|--------|----------------|
| Create team | Yes | No | No | No | Yes |
| Read team | Yes | Yes | Yes | Yes | Yes |
| Update team settings | Yes | Yes | No | No | Yes |
| Delete team | Yes | No | No | No | Yes |

### Team Memberships

| Action | owner | admin | member | viewer | platform_admin |
|--------|-------|-------|--------|--------|----------------|
| Invite member | Yes | Yes | No | No | Yes |
| Remove member | Yes | Yes | No | No | Yes |
| Change member role | Yes | Yes | No | No | Yes |
| Update own visibility flags | Yes | Yes | Yes | Yes | No |
| View all members | Yes | Yes | Yes | Yes | Yes |

### Team Goals

| Action | owner | admin | member | viewer | platform_admin |
|--------|-------|-------|--------|--------|----------------|
| Create goal | Yes | Yes | Yes | No | Yes |
| Read goals | Yes | Yes | Yes | Yes | Yes |
| Update own goal | Yes | Yes | Yes | No | Yes |
| Update any goal | Yes | Yes | No | No | Yes |
| Delete goal | Yes | Yes | No | No | Yes |

### Team Integrations (Slack/Teams)

| Action | owner | admin | member | viewer | platform_admin |
|--------|-------|-------|--------|--------|----------------|
| View integrations | Yes | Yes | No | No | Yes |
| Configure integrations | Yes | Yes | No | No | Yes |
| Delete integrations | Yes | Yes | No | No | Yes |

### Financial Data (Plaid, Accounts)

| Action | Own Data | Team Data | Cross-Tenant |
|--------|----------|-----------|--------------|
| Link account | Yes | N/A | No |
| Read transactions | Yes | N/A | platform_admin, support_agent |
| Unlink account | Yes | N/A | platform_admin |

### Print Orders

| Action | owner | admin | member | viewer | platform_admin |
|--------|-------|-------|--------|--------|----------------|
| Create order | Yes | Yes | Yes | No | Yes |
| View own orders | Yes | Yes | Yes | Yes | Yes |
| View team orders | Yes | Yes | No | No | Yes |
| Cancel order | Yes (own) | Yes (own) | Yes (own) | No | Yes |

### AMIE/Coaching Data

| Action | Own Data | Cross-Tenant |
|--------|----------|--------------|
| Create profile | Yes | platform_admin |
| Read profile | Yes | platform_admin, support_agent |
| Update profile | Yes | platform_admin |
| Read knowledge sources | Yes | platform_admin, support_agent |
| Manage voice sessions | Yes | platform_admin |

---

## RLS Policy Design

### Platform Roles Table

```sql
CREATE TABLE platform_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('platform_admin', 'support_agent')),
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  notes TEXT
);
```

### Helper Functions

```sql
-- Check if current user is a platform admin
CREATE FUNCTION is_platform_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_roles
    WHERE user_id = auth.uid()
    AND role = 'platform_admin'
    AND (expires_at IS NULL OR expires_at > NOW())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user has any platform role
CREATE FUNCTION has_platform_role(required_roles TEXT[]) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_roles
    WHERE user_id = auth.uid()
    AND role = ANY(required_roles)
    AND (expires_at IS NULL OR expires_at > NOW())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get user's team role
CREATE FUNCTION get_team_role(p_team_id UUID) RETURNS TEXT AS $$
  SELECT role FROM team_members
  WHERE team_id = p_team_id
  AND user_id = auth.uid()
  AND is_active = TRUE;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user has required team role
CREATE FUNCTION has_team_role(p_team_id UUID, required_roles TEXT[]) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = auth.uid()
    AND role = ANY(required_roles)
    AND is_active = TRUE
  ) OR is_platform_admin();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Policy Patterns

#### User-Owned Data Pattern
```sql
-- Standard user-owned data policy
CREATE POLICY "Users own their data" ON table_name
  FOR ALL
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR (has_platform_role(ARRAY['support_agent']) AND current_setting('app.audit_mode', true) = 'true')
  );
```

#### Team-Scoped Data Pattern
```sql
-- Team data with role-based access
CREATE POLICY "Team members can view" ON team_goals
  FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND is_active = TRUE)
    OR is_platform_admin()
  );

CREATE POLICY "Team admins can modify" ON team_goals
  FOR INSERT UPDATE DELETE
  USING (
    has_team_role(team_id, ARRAY['owner', 'admin', 'member'])
  );
```

---

## Audit Logging

### Audit Log Table

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  team_id UUID REFERENCES teams(id),
  platform_role TEXT,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Audit Actions

| Action | Description |
|--------|-------------|
| `team.create` | Team created |
| `team.delete` | Team deleted |
| `team.member.invite` | Member invited |
| `team.member.remove` | Member removed |
| `team.member.role_change` | Member role changed |
| `team.integration.add` | Integration added |
| `team.integration.remove` | Integration removed |
| `billing.subscription.create` | Subscription created |
| `billing.subscription.cancel` | Subscription cancelled |
| `print.order.create` | Print order created |
| `print.order.cancel` | Print order cancelled |
| `platform.impersonate` | Support agent viewed user data |
| `platform.data.export` | Data exported |

### Audit Function

```sql
CREATE FUNCTION log_audit(
  p_action TEXT,
  p_target_table TEXT,
  p_target_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_team_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_platform_role TEXT;
  v_audit_id UUID;
BEGIN
  SELECT role INTO v_platform_role FROM platform_roles WHERE user_id = auth.uid();

  INSERT INTO audit_logs (
    user_id, team_id, platform_role, action, target_table, target_id,
    old_values, new_values, description
  ) VALUES (
    auth.uid(), p_team_id, v_platform_role, p_action, p_target_table, p_target_id,
    p_old_values, p_new_values, p_description
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Edge Function Authorization

### Authorization Helper Module

Located at: `supabase/functions/_shared/authz.ts`

```typescript
interface AuthzContext {
  userId: string;
  platformRole?: 'platform_admin' | 'support_agent';
  teamRoles: Map<string, TeamRole>;
}

// Check if user has required team role
function assertTeamRole(ctx: AuthzContext, teamId: string, allowedRoles: TeamRole[]): void;

// Check if user has required platform role
function assertPlatformRole(ctx: AuthzContext, allowedRoles: PlatformRole[]): void;

// Get user's authorization context
async function getAuthzContext(supabase: SupabaseClient, userId: string): Promise<AuthzContext>;
```

### Usage in Edge Functions

```typescript
// At the top of each sensitive Edge Function
const authz = await getAuthzContext(supabase, userId);

// For team operations
assertTeamRole(authz, teamId, ['owner', 'admin']);

// For platform operations
assertPlatformRole(authz, ['platform_admin']);
```

---

## Frontend Authorization

### useAuthz Hook

Located at: `hooks/useAuthz.ts`

```typescript
interface UseAuthzReturn {
  // State
  isLoading: boolean;
  platformRole?: PlatformRole;
  teamMemberships: TeamMembership[];

  // Helpers
  isPlatformAdmin(): boolean;
  isSupportAgent(): boolean;
  canManageTeam(teamId: string): boolean;
  canInviteMembers(teamId: string): boolean;
  canEditGoal(goal: Goal): boolean;
  getTeamRole(teamId: string): TeamRole | null;

  // Refresh
  refresh(): Promise<void>;
}

export function useAuthz(): UseAuthzReturn;
```

### Usage in Components

```tsx
function TeamSettings({ teamId }: { teamId: string }) {
  const { canManageTeam, isLoading } = useAuthz();

  if (isLoading) return <Spinner />;

  if (!canManageTeam(teamId)) {
    return <NoAccessMessage message="Ask your team admin to grant you access" />;
  }

  return <SettingsForm />;
}
```

---

## Enterprise Identity (Future)

### Planned Features

1. **SAML 2.0 SSO**
   - IdP-initiated and SP-initiated flows
   - Automatic user provisioning
   - Group-to-role mapping

2. **SCIM 2.0 Provisioning**
   - Automatic user creation/deactivation
   - Group sync to team memberships
   - Directory integration

3. **OAuth 2.0 / OIDC**
   - Support for Azure AD, Okta, Google Workspace
   - Custom OAuth providers

### Integration Points

```
IdP Groups → team_memberships.role mapping:
  - "Visionary-Admins" → role: 'admin'
  - "Visionary-Users" → role: 'member'
  - "Visionary-Viewers" → role: 'viewer'
```

### Configuration Table (Future)

```sql
CREATE TABLE sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('saml', 'oidc', 'azure_ad', 'okta', 'google')),
  is_enabled BOOLEAN DEFAULT FALSE,
  config JSONB NOT NULL,
  group_mappings JSONB DEFAULT '[]',
  enforce_sso BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, provider)
);
```

---

## Implementation Checklist

- [x] Define RBAC model and permission matrix
- [ ] Create platform_roles table
- [ ] Create audit_logs table
- [ ] Add helper SQL functions
- [ ] Update RLS policies for all tables
- [ ] Create Edge Function authz helpers
- [ ] Update Edge Functions with authorization
- [ ] Create useAuthz frontend hook
- [ ] Add role-gating to UI components
- [ ] Write integration tests

---

## Security Contacts

For security issues, contact: security@visionary.app

---

*This document is part of Visionary AI's security architecture. Changes require security review.*
