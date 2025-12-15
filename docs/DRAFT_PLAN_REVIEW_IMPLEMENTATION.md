# Draft Plan Review Implementation Plan

**Version:** 1.0
**Feature:** v1.7 - Draft Plan Review & Knowledge Base Enhancements
**Created:** December 15, 2025
**Status:** In Progress

---

## Executive Summary

This implementation adds a user-controlled "Draft → Review → Approve" flow for AI-generated goal plans, addressing the core trust issue where users felt the AI was dictating their goals without input.

### Problem Statement
- AI-generated tasks went directly to Execute as "active" with no user review
- Users could not edit generated goals
- Knowledge Base sources were "write-only" from user perspective
- This caused user distrust: "AI decided my goals and I can't change them"

### Solution
- New `DRAFT_PLAN_REVIEW` step in onboarding (replacing read-only `ACTION_PLAN_PREVIEW`)
- Users can edit titles, descriptions, due dates, priorities
- Users can add/delete tasks before approval
- Knowledge Base enhancements: view content, soft delete (archive)

---

## Implementation Status

### Phase A: Schema & Migrations
| Task | Status | Notes |
|------|--------|-------|
| Create `goal_plans` table | **Complete** | `20251215_goal_plans_schema.sql` |
| Extend `action_tasks` with plan_id, priority | **Complete** | 6 columns added |
| Add archived column to `user_knowledge_sources` | **Complete** | 3 columns added |
| RLS policies | **Complete** | 4 policies created |
| Backfill script for existing users | **Complete** | `20251215_goal_plans_backfill.sql` |

### Phase B: Storage Service
| Task | Status | Notes |
|------|--------|-------|
| `createDraftPlan()` function | **Complete** | Creates draft with versioning |
| `getDraftPlan()` / `getActivePlan()` | **Complete** | With task loading |
| `saveDraftTask()` / `deleteDraftTask()` | **Complete** | With plan ownership validation |
| `approvePlan()` | **Complete** | Uses DB function for atomic transition |
| `getPlanHistory()` | **Complete** | Version history |
| `updateDraftPlan()` | **Complete** | Update plan metadata |
| `saveDraftTasks()` | **Complete** | Bulk save for regeneration |
| Types: `GoalPlan`, `GoalPlanStatus` | **Complete** | Added to types.ts |

### Phase C: UI Components
| Task | Status | Notes |
|------|--------|-------|
| `DraftPlanReviewStep.tsx` component | **Complete** | Inline editing, add/delete, AI insights |
| Update `GuidedOnboarding.tsx` | **Complete** | Integrated new step |
| Update `types.ts` | **Complete** | Added DRAFT_PLAN_REVIEW step type |
| Feature flag setup | **Complete** | `ENABLE_DRAFT_PLAN_REVIEW` |

### Phase D: Knowledge Base Enhancements
| Task | Status | Notes |
|------|--------|-------|
| View source content modal | Pending | |
| Soft delete (archive) | Pending | |
| Edit manual sources | Pending | Phase 2 |

### Phase E: Testing
| Task | Status | Notes |
|------|--------|-------|
| Unit tests for storage service | Pending | |
| Component tests for DraftPlanReviewStep | Pending | |
| E2E: Onboarding with draft review | Pending | |
| E2E: Knowledge base management | Pending | |

### Phase F: Rollout
| Task | Status | Notes |
|------|--------|-------|
| Deploy to staging | Pending | |
| Internal team testing | Pending | |
| New users only (Phase 1) | Pending | |
| All users (Phase 2) | Pending | |

---

## Technical Details

### New Database Tables

#### `goal_plans` Table
```sql
CREATE TABLE goal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  version INT NOT NULL DEFAULT 1,
  source TEXT DEFAULT 'onboarding',
  ai_insights JSONB DEFAULT '{}',
  vision_text TEXT,
  financial_target NUMERIC,
  theme_id UUID REFERENCES motivational_themes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);
```

#### Extended `action_tasks` Columns
```sql
ALTER TABLE action_tasks
ADD COLUMN plan_id UUID REFERENCES goal_plans(id),
ADD COLUMN display_order INT DEFAULT 0,
ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
ADD COLUMN source TEXT DEFAULT 'manual';
```

### New Components

#### `DraftPlanReviewStep.tsx`
Location: `components/onboarding/DraftPlanReviewStep.tsx`

Features:
- Inline editing of task titles, descriptions
- Due date picker
- Priority selector (High/Medium/Low with colors)
- Add task by category (Finance/Lifestyle/Admin)
- Delete task with confirmation
- AI Insights panel (collapsible)
- "Regenerate with AI" option
- Auto-save functionality
- Validation (at least 1 task, all titles required)

Props:
```typescript
interface Props {
  visionText: string;
  financialTarget?: number;
  themeName?: string;
  existingTasks?: ActionTask[];
  onTasksChanged: (tasks: ActionTask[]) => void;
  generateActionPlan: (context) => Promise<ActionTask[]>;
}
```

### Feature Flag

```typescript
// In GuidedOnboarding.tsx
const ENABLE_DRAFT_PLAN_REVIEW = true;

// Steps array uses conditional
ENABLE_DRAFT_PLAN_REVIEW ? 'DRAFT_PLAN_REVIEW' : 'ACTION_PLAN_PREVIEW'
```

---

## Files Changed

### Created
- `components/onboarding/DraftPlanReviewStep.tsx` - New editable review component
- `docs/DRAFT_PLAN_REVIEW_IMPLEMENTATION.md` - This document

### Modified
- `types.ts` - Added `DRAFT_PLAN_REVIEW` to OnboardingStep type
- `components/onboarding/GuidedOnboarding.tsx` - Integrated new component

### Pending Creation
- `supabase/migrations/20251215_goal_plans_schema.sql` - Database migration
- `lib/featureFlags.ts` - Centralized feature flags (optional)

---

## Migration Strategy

### For New Users
1. Complete onboarding through Vision Generation step
2. Land on DRAFT_PLAN_REVIEW with AI-generated tasks
3. Edit/add/delete tasks as desired
4. Click "Continue" to approve plan
5. Tasks saved with `approved_at` timestamp
6. Proceed to Habits Setup

### For Existing Users (Backfill)
1. Run migration to add new columns
2. Execute backfill script:
   - Create `goal_plans` record with status='active' for each user with tasks
   - Link existing `action_tasks` to new plan via `plan_id`
   - Set `approved_at` to earliest task creation date
3. Users continue using app normally
4. Optional: Show banner to "Review your plan" on Execute page

---

## Rollout Plan

### Phase 1: Internal Testing (Days 1-3)
- Deploy schema to staging
- Enable flag for team only
- Complete E2E testing

### Phase 2: New Users (Days 4-10)
- Enable for new signups only
- Monitor completion rates
- Gather feedback

### Phase 3: All Users (Days 11-14)
- Enable for existing users
- Show review prompt
- Monitor adoption

### Phase 4: Cleanup (Day 15+)
- Remove feature flag
- Remove legacy ACTION_PLAN_PREVIEW code
- Update documentation

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Migration data loss | INSERT only, keep original action_tasks |
| Onboarding abandonment | Track metrics, make review optional if needed |
| Feature flag complexity | Single source of truth, remove after stable |

---

## Acceptance Criteria

- [ ] Users can edit task titles and descriptions inline
- [ ] Users can change due dates and priorities
- [ ] Users can add new tasks by category
- [ ] Users can delete tasks with confirmation
- [ ] At least 1 task required to proceed
- [ ] Tasks with empty titles show validation warning
- [ ] Auto-save works (no lost changes on navigation)
- [ ] Existing users with tasks are migrated correctly
- [ ] Knowledge Base shows view option for sources

---

## Related Documentation

- [ROADMAP.md](../ROADMAP.md) - Master product roadmap
- [UX_VISIONARY_V1_6.md](UX_VISIONARY_V1_6.md) - Previous version UX docs
- [AI_AGENT_IMPLEMENTATION_PLAN.md](AI_AGENT_IMPLEMENTATION_PLAN.md) - Agent architecture
