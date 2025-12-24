# CLAUDE.md - Visionary AI Project Instructions

## Project Overview

Visionary AI is an agentic success platform combining emotional visualization, financial intelligence, autonomous AI execution, and identity-driven coaching. Built with React + TypeScript frontend and Supabase backend (Postgres + Edge Functions + Auth + Storage).

## Critical Development Rules

### 1. NEVER IMPLEMENT WITHOUT APPROVAL

Before writing ANY code, you MUST:

1. Present a detailed implementation plan
2. **STOP and wait for my explicit approval**
3. Do not proceed until I confirm with "approved", "go ahead", "proceed", or similar

Even for "simple" changes — ask first, implement after approval.

### 2. MANDATORY IMPACT ANALYSIS

Every plan must analyze impacts across ALL of these areas:

| Area | Check For |
|------|-----------|
| Database Schema | New tables, columns, indexes, FKs, data migration |
| RLS Policies | New policies, policy updates, cross-table dependencies |
| Edge Functions | New functions, modifications to existing, `_shared/` utilities |
| Frontend Components | New components, state changes, prop cascades, routing |
| TypeScript Types | New types in `types.ts`, type extensions, import updates |
| Storage Buckets | New buckets, storage policies, file paths |

### 3. DATABASE CHANGES ARE MANDATORY IN PLAN

If ANY database changes are required, include this section:

```markdown
## Database Changes

### Migration File
- Filename: `supabase/migrations/YYYYMMDD_[description].sql`

### Schema Changes
[Exact SQL]

### RLS Policies
[All policies for new/modified tables]

### Indexes
[Performance indexes]

### Rollback Plan
[SQL to undo if needed]
```

### 4. TESTING REQUIREMENTS

Before marking any feature complete:

- [ ] Run `npm test` or `npm run test:run`
- [ ] Test edge functions manually (curl or Supabase dashboard)
- [ ] Verify RLS policies don't block legitimate access
- [ ] Test in browser — no console errors
- [ ] Check network tab for failed requests
- [ ] Confirm data persists correctly

## Project-Specific Patterns

### Database Conventions

- All user-owned tables MUST have `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`
- All tables MUST have RLS enabled: `ALTER TABLE [table] ENABLE ROW LEVEL SECURITY`
- Use `auth.uid()` in RLS policies for user ownership checks
- Use `gen_random_uuid()` for primary keys
- Include `created_at TIMESTAMPTZ DEFAULT NOW()` on all tables
- Use `is_platform_admin()` helper for admin-only operations

### Edge Function Conventions

- Import CORS headers from `../_shared/cors.ts`
- Import Supabase client from `../_shared/supabase.ts`
- Use service role client for admin operations
- Always return proper error responses with status codes
- Include request validation at the top of handlers
- Log errors with context for debugging

### Frontend Conventions

- Types go in `src/types.ts`
- Services go in `src/services/`
- Hooks go in `src/hooks/`
- Components use TypeScript interfaces for props
- Use existing patterns from similar components before creating new approaches

### Existing Infrastructure (Do Not Break)

- **68 Edge Functions** — Check if your change affects any existing functions
- **40+ Database Tables** — Review foreign key relationships before schema changes
- **RLS Policies on 18+ tables** — Verify policy consistency
- **Rate limiting infrastructure** — Don't bypass `rate_limits` checks
- **Security audit logging** — Maintain `data_access_logs` patterns

## Response Template

When I ask you to implement something, respond with:

```markdown
## Proposed Plan: [Feature Name]

### Changes Overview
| File | Action | Description |
|------|--------|-------------|
| [path] | Create/Modify | [what changes] |

### Implementation Steps
1. [Specific step]
2. [Specific step]
...

### Impact Analysis

#### Database Schema: [None | Low | Medium | High]
- [Details]

#### RLS Policies: [None | Low | Medium | High]
- [Details]

#### Edge Functions: [None | Low | Medium | High]
- [Details]

#### Frontend UI: [None | Low | Medium | High]
- [Details]

#### TypeScript Types: [None | Low | Medium | High]
- [Details]

### Database Changes (if applicable)
[Full SQL migration with RLS policies]

### Testing Plan
- [ ] Unit tests: [what]
- [ ] Integration tests: [what]
- [ ] Regression checks: [existing tests to verify]
- [ ] Manual verification: [browser testing steps]

### Potential Risks
- [Risk and mitigation]

---
**Awaiting your approval before proceeding.**
```

## Supabase Checklist (Verify Before Finalizing Plan)

- [ ] New tables have `user_id` FK to `auth.users` where appropriate
- [ ] RLS is enabled on ALL new tables
- [ ] RLS policies use `auth.uid()` correctly
- [ ] Edge functions include CORS headers from `_shared/cors.ts`
- [ ] Edge functions use service role for admin operations
- [ ] Storage bucket policies match table RLS patterns
- [ ] Indexes exist for FKs and frequently queried columns
- [ ] TypeScript types in `types.ts` match database schema exactly
- [ ] Existing edge functions that query affected tables still work
- [ ] No circular dependencies introduced

## Commands Reference

```bash
# Run tests
npm test
npm run test:run

# Deploy edge function
supabase functions deploy [function-name]

# Apply migration
supabase db push

# Check function logs
supabase functions logs [function-name]
```

## Key Files to Know

- `src/types.ts` — All TypeScript interfaces
- `src/App.tsx` — Main app with routing and auth state
- `src/services/` — API service functions
- `supabase/functions/_shared/` — Shared edge function utilities
- `supabase/migrations/` — Database migrations
- `docs/ROADMAP.md` — Feature roadmap and system architecture
