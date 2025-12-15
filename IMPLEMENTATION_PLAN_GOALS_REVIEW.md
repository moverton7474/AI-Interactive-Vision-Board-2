# Implementation Plan: Goals Review & Approval Flow

## Overview

Add a "Review & Approve" step after AI generates goals, allowing users to edit, delete, add, and approve goals before the AI Coach begins helping execute them.

---

## Current State

### Existing Flow
```
THEME → COACH_INTRO → VISION_CAPTURE → PHOTO_UPLOAD → FINANCIAL_TARGET
     → VISION_GENERATION → ACTION_PLAN_PREVIEW → HABITS_SETUP → COMPLETION
```

### Current Limitations
- `ActionPlanPreviewStep.tsx` only shows a read-only preview of AI-generated tasks
- No editing capabilities exist (only completion toggle in dashboard)
- No approval mechanism - goals go directly to execution
- `action_tasks` table lacks approval/draft status field

---

## Proposed Flow

```
THEME → COACH_INTRO → VISION_CAPTURE → PHOTO_UPLOAD → FINANCIAL_TARGET
     → VISION_GENERATION → ACTION_PLAN_PREVIEW → [NEW] GOALS_REVIEW → HABITS_SETUP → COMPLETION
```

### New Step: GOALS_REVIEW
A dedicated step where users can:
1. View all AI-generated goals organized by year/milestone
2. Edit goal titles and descriptions
3. Delete goals they don't want
4. Add custom goals
5. Reorder goals within milestones
6. Regenerate suggestions for specific milestones
7. Approve the final plan

---

## Implementation Phases

### Phase 1: Database Schema Updates (P0)

**File:** `supabase/migrations/[timestamp]_add_goals_approval.sql`

```sql
-- Add status field to action_tasks
ALTER TABLE action_tasks
ADD COLUMN status TEXT DEFAULT 'approved'
CHECK (status IN ('draft', 'approved', 'archived'));

-- Add approval tracking
ALTER TABLE action_tasks
ADD COLUMN approved_at TIMESTAMP;

-- Add user-modified flag (to distinguish AI vs user edits)
ALTER TABLE action_tasks
ADD COLUMN is_user_modified BOOLEAN DEFAULT false;

-- Add ordering within milestone
ALTER TABLE action_tasks
ADD COLUMN sort_order INT DEFAULT 0;

-- Index for performance
CREATE INDEX idx_action_tasks_status ON action_tasks(user_id, status);

-- Update existing tasks to 'approved' status (backward compatibility)
UPDATE action_tasks SET status = 'approved' WHERE status IS NULL;
```

**Estimated effort:** Small - schema addition only

---

### Phase 2: Storage Service Updates (P0)

**File:** `services/storageService.ts`

#### New Functions to Add:

```typescript
// Save tasks as drafts during onboarding
export const saveDraftTasks = async (
  tasks: ActionTask[],
  milestoneYear: number
): Promise<void>

// Approve all draft tasks
export const approveAllTasks = async (userId: string): Promise<void>

// Update a single task (full edit)
export const updateTask = async (
  taskId: string,
  updates: Partial<ActionTask>
): Promise<void>

// Delete a task
export const deleteTask = async (taskId: string): Promise<void>

// Reorder tasks within a milestone
export const reorderTasks = async (
  taskIds: string[],
  milestoneYear: number
): Promise<void>

// Get draft tasks for review
export const getDraftTasks = async (userId: string): Promise<ActionTask[]>

// Add a custom task
export const addCustomTask = async (
  task: Omit<ActionTask, 'id' | 'created_at'>
): Promise<ActionTask>
```

**Estimated effort:** Medium - 7 new functions

---

### Phase 3: New Onboarding Step Component (P0)

**File:** `components/onboarding/GoalsReviewStep.tsx`

#### Component Structure:

```typescript
interface GoalsReviewStepProps {
  tasks: ActionTask[];
  milestones: Milestone[];
  onTaskUpdate: (taskId: string, updates: Partial<ActionTask>) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskAdd: (milestoneYear: number) => void;
  onTaskReorder: (milestoneYear: number, taskIds: string[]) => void;
  onRegenerateMilestone: (milestoneYear: number) => void;
  onApprove: () => void;
  onBack: () => void;
}
```

#### UI Layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Review Your Roadmap                                    [?] │
│  "Edit, add, or remove goals before we begin"               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ 2025 - Foundation ─────────────────────────────────┐   │
│  │                                                      │   │
│  │  ☐ Launch Initial Marketing Campaign          [✎][🗑] │   │
│  │    Build brand awareness through social media...     │   │
│  │                                                      │   │
│  │  ☐ Develop Minimum Viable Product             [✎][🗑] │   │
│  │    Create first version of core offering...          │   │
│  │                                                      │   │
│  │  [+ Add Goal]              [↻ Regenerate Suggestions]│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 2026 - Growth ─────────────────────────────────────┐   │
│  │  ...                                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 2027 - Scale ──────────────────────────────────────┐   │
│  │  ...                                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Summary: 8 goals across 3 years                            │
│                                                             │
│  ☐ I've reviewed and approve this plan                      │
│                                                             │
│  [← Back]                              [Approve & Continue →]│
└─────────────────────────────────────────────────────────────┘
```

#### Sub-Components:

1. **MilestoneCard.tsx** - Collapsible card for each year
2. **GoalItem.tsx** - Individual goal with edit/delete actions
3. **GoalEditModal.tsx** - Modal for editing goal details
4. **AddGoalModal.tsx** - Modal for adding custom goals

**Estimated effort:** Large - New component with multiple sub-components

---

### Phase 4: Goal Edit Modal (P1)

**File:** `components/onboarding/GoalEditModal.tsx`

#### Fields:
- Title (required, max 100 chars)
- Description (optional, max 500 chars)
- Due Date (date picker)
- Type (dropdown: FINANCE, LIFESTYLE, ADMIN)
- Priority (Low, Medium, High)

#### Features:
- Validate required fields
- Show character count
- Preview changes before saving
- Cancel/Save buttons

**Estimated effort:** Medium

---

### Phase 5: Add Goal Modal (P1)

**File:** `components/onboarding/AddGoalModal.tsx`

#### Features:
- Same fields as edit modal
- Pre-populate milestone year based on which section user clicked
- Option to request AI suggestion: "Suggest a goal for this milestone"

**Estimated effort:** Medium

---

### Phase 6: Update GuidedOnboarding Orchestrator (P0)

**File:** `components/onboarding/GuidedOnboarding.tsx`

#### Changes:

1. Add new step to enum:
```typescript
type OnboardingStep =
  | 'THEME'
  | 'COACH_INTRO'
  | 'VISION_CAPTURE'
  | 'PHOTO_UPLOAD'
  | 'FINANCIAL_TARGET'
  | 'VISION_GENERATION'
  | 'ACTION_PLAN_PREVIEW'
  | 'GOALS_REVIEW'  // NEW
  | 'HABITS_SETUP'
  | 'COMPLETION';
```

2. Add step transition logic:
```typescript
// After ACTION_PLAN_PREVIEW
case 'ACTION_PLAN_PREVIEW':
  return 'GOALS_REVIEW';

// After GOALS_REVIEW (only when approved)
case 'GOALS_REVIEW':
  return 'HABITS_SETUP';
```

3. Add state for draft tasks:
```typescript
const [draftTasks, setDraftTasks] = useState<ActionTask[]>([]);
const [isApproved, setIsApproved] = useState(false);
```

4. Render new step:
```typescript
case 'GOALS_REVIEW':
  return (
    <GoalsReviewStep
      tasks={draftTasks}
      milestones={milestones}
      onTaskUpdate={handleTaskUpdate}
      onTaskDelete={handleTaskDelete}
      onTaskAdd={handleTaskAdd}
      onTaskReorder={handleTaskReorder}
      onRegenerateMilestone={handleRegenerateMilestone}
      onApprove={handleApproveAndContinue}
      onBack={() => setCurrentStep('ACTION_PLAN_PREVIEW')}
    />
  );
```

**Estimated effort:** Medium

---

### Phase 7: Update ActionPlanPreviewStep (P1)

**File:** `components/onboarding/ActionPlanPreviewStep.tsx`

#### Changes:
- Remove "Continue" button that skips review
- Change button text to "Review & Customize →"
- Add subtitle: "Next, you'll be able to edit these goals"
- Store generated tasks as drafts (status: 'draft')

**Estimated effort:** Small

---

### Phase 8: Post-Approval Editing in Dashboard (P2)

**File:** `components/dashboard/ExecutionPanel.tsx`

#### Add Features:
1. Edit button on each task (opens modal)
2. "Add Task" button at bottom of task list
3. Archive/delete option via swipe or menu
4. Drag-and-drop reordering (optional P3)

**Estimated effort:** Medium

---

### Phase 9: Regenerate Milestone Feature (P2)

**File:** `services/geminiService.ts`

#### New Function:
```typescript
export const regenerateMilestoneGoals = async (
  milestoneYear: number,
  context: {
    vision: string;
    financialTarget: number;
    existingGoals: ActionTask[];
  }
): Promise<ActionTask[]>
```

This calls the AI to generate new goals for a specific year while considering:
- User's vision and financial target
- Goals from other years (for context)
- Previously rejected goals (to avoid repeating)

**Estimated effort:** Medium

---

## TypeScript Types Updates

**File:** `types.ts`

```typescript
// Update ActionTask interface
export interface ActionTask {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  type: 'FINANCE' | 'LIFESTYLE' | 'ADMIN';
  isCompleted: boolean;
  milestoneYear?: number;
  aiMetadata?: {
    suggestedTool?: string;
  };
  // NEW FIELDS
  status: 'draft' | 'approved' | 'archived';
  approvedAt?: string;
  isUserModified: boolean;
  sortOrder: number;
  priority?: 'low' | 'medium' | 'high';
}

// New interface for milestone with editable state
export interface EditableMilestone extends Milestone {
  isExpanded: boolean;
  isRegenerating: boolean;
}
```

---

## Implementation Order (Recommended)

### Sprint 1 (Core Flow)
1. ✅ Database migration (status, sort_order fields)
2. ✅ Storage service CRUD functions
3. ✅ GoalsReviewStep component (basic version)
4. ✅ GuidedOnboarding integration
5. ✅ Update ActionPlanPreviewStep CTA

### Sprint 2 (Editing Features)
1. ✅ GoalEditModal component
2. ✅ AddGoalModal component
3. ✅ MilestoneCard with expand/collapse
4. ✅ GoalItem with inline actions

### Sprint 3 (Enhanced Features)
1. ✅ Regenerate milestone feature
2. ✅ Dashboard editing (ExecutionPanel updates)
3. ✅ Drag-and-drop reordering (optional)
4. ✅ AI suggestion for custom goals

---

## Testing Checklist

### Unit Tests
- [ ] Storage service functions (saveDraftTasks, approveAllTasks, etc.)
- [ ] Task validation (required fields, character limits)
- [ ] Type safety for new ActionTask fields

### Integration Tests
- [ ] Complete onboarding flow with review step
- [ ] Edit task → verify database update
- [ ] Delete task → verify removal
- [ ] Add custom task → verify insertion
- [ ] Approve flow → verify status change

### E2E Tests
- [ ] New user completes full onboarding with goal editing
- [ ] User regenerates goals for one milestone
- [ ] User adds custom goal and approves
- [ ] Dashboard shows only approved tasks

### Edge Cases
- [ ] User navigates back from review step
- [ ] User closes browser during review (state persistence)
- [ ] Empty milestone (all goals deleted)
- [ ] Maximum goals per milestone (suggest limit of 5)

---

## UI/UX Considerations

### Accessibility
- Keyboard navigation for goal list
- Screen reader labels for edit/delete buttons
- Focus management in modals

### Mobile Responsiveness
- Stack milestone cards vertically
- Swipe-to-delete on mobile
- Bottom sheet modals instead of centered

### Visual Design
- Match existing coach theme (AMIE, etc.)
- Use existing color palette from ThemeSelectorStep
- Consistent iconography with ExecutionPanel

### Copy/Messaging
- "Your AI Coach generated this roadmap based on your vision"
- "Feel free to customize - this is YOUR journey"
- "You can always edit these later from your dashboard"

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex state management | Medium | Use localStorage persistence like existing steps |
| Slow AI regeneration | Low | Show skeleton loading, allow single milestone regen |
| Data loss on browser close | High | Auto-save drafts every 30 seconds |
| Backward compatibility | Medium | Default existing tasks to 'approved' status |

---

## Success Metrics

1. **Completion Rate:** % of users who complete the review step
2. **Edit Rate:** % of users who modify at least one goal
3. **Custom Goal Rate:** % of users who add custom goals
4. **Regeneration Rate:** % of users who regenerate milestone suggestions
5. **Time in Review:** Average time spent on review step

---

## Files to Create/Modify

### New Files
- `supabase/migrations/[timestamp]_add_goals_approval.sql`
- `components/onboarding/GoalsReviewStep.tsx`
- `components/onboarding/MilestoneCard.tsx`
- `components/onboarding/GoalItem.tsx`
- `components/onboarding/GoalEditModal.tsx`
- `components/onboarding/AddGoalModal.tsx`

### Modified Files
- `types.ts` - Add new ActionTask fields
- `services/storageService.ts` - Add CRUD functions
- `services/geminiService.ts` - Add regenerate function
- `components/onboarding/GuidedOnboarding.tsx` - Add new step
- `components/onboarding/ActionPlanPreviewStep.tsx` - Update CTA
- `components/dashboard/ExecutionPanel.tsx` - Add editing (Phase 2)

---

## Estimated Total Effort

| Phase | Complexity | Effort |
|-------|------------|--------|
| Phase 1: Database | Small | 1 hour |
| Phase 2: Storage Service | Medium | 2-3 hours |
| Phase 3: GoalsReviewStep | Large | 4-5 hours |
| Phase 4: GoalEditModal | Medium | 2 hours |
| Phase 5: AddGoalModal | Medium | 2 hours |
| Phase 6: GuidedOnboarding | Medium | 2 hours |
| Phase 7: ActionPlanPreview | Small | 30 min |
| Phase 8: Dashboard Editing | Medium | 3 hours |
| Phase 9: Regenerate Feature | Medium | 2 hours |

**Total: ~18-20 hours of development**

---

## Product Decisions (Confirmed)

| Question | Decision |
|----------|----------|
| Should users be able to skip the review step entirely? | **YES** - Quick "Approve All" option available |
| Maximum number of goals per milestone? | **YES** - Limit to 5 goals per milestone |
| Should regenerate replace all goals or add new suggestions? | **ADD NEW** - Regenerate adds suggestions, doesn't replace |
| Track original AI suggestions vs user edits? | TBD - Future analytics consideration |
| Allow goal duplication across milestones? | TBD - Not a launch requirement |
