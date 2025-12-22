# Onboarding "WOW" Optimization Plan

**Document Version:** 1.0
**Created:** December 22, 2025
**Status:** AWAITING APPROVAL
**Author:** Claude (Solutions Architect)
**Project:** Visionary AI Platform v1.8

---

## Executive Summary

This plan implements an **"Identity-First" onboarding flow** that generates a high-fidelity vision board in the background while the user completes subsequent steps, culminating in a "Magic Mirror" dashboard reveal that creates an immediate emotional impact.

### Goals
1. Reduce perceived wait time by 80%+ (background generation vs blocking)
2. Create a "wow moment" on first dashboard load
3. Demonstrate AI agent capabilities during onboarding (micro-contract)
4. Personalize the experience from step 2 onwards

### Core Constraints (Non-Negotiable)
- **Non-Destructive:** No database schema changes
- **Apple Watch Deferral:** All wearable features → Phase 2
- **Model Routing:** Use existing `ModelRouter` with `gemini-3-pro-image-preview`
- **Likeness Preservation:** Maintain v2.1.0 likeness fix parameters

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Proposed Flow Changes](#2-proposed-flow-changes)
3. [Implementation Details](#3-implementation-details)
4. [Data Flow Diagram](#4-data-flow-diagram)
5. [File Modification List](#5-file-modification-list)
6. [Testing Strategy](#6-testing-strategy)
7. [Rollback Procedures](#7-rollback-procedures)
8. [Implementation Phases](#8-implementation-phases)

---

## 1. Current State Analysis

### 1.1 Current Onboarding Steps

```
1. THEME              → Select coaching style
2. COACH_INTRO        → Meet AMIE (static)
3. MASTER_PROMPT_QNA  → Identity questions
4. VISION_CAPTURE     → Text/voice vision input
5. PHOTO_UPLOAD       → Reference photo (optional)
6. FINANCIAL_TARGET   → Set money goal
7. VISION_GENERATION  → ⚠️ BLOCKING - User waits 15-45 seconds
8. DRAFT_PLAN_REVIEW  → Edit AI-generated tasks
9. HABITS_SETUP       → Select daily habits
10. COMPLETION        → Generic completion screen
```

### 1.2 Pain Points

| Issue | Impact | User Sentiment |
|-------|--------|----------------|
| Vision generation blocks user | 15-45s wait with spinner | "Is this broken?" |
| No early demonstration of AI | Agent feels passive | "What can this do?" |
| Dashboard reveal is anticlimactic | Generic greeting | "That's it?" |
| Theme selection underutilized | Only affects vocabulary | "Why did I pick this?" |

### 1.3 Files Currently Involved

| File | Purpose | Lines |
|------|---------|-------|
| `components/onboarding/GuidedOnboarding.tsx` | Main orchestrator | ~400 |
| `components/onboarding/VisionGenerationStep.tsx` | Blocking generation UI | ~180 |
| `components/onboarding/PhotoUploadStep.tsx` | Photo upload handler | ~200 |
| `components/onboarding/HabitsSetupStep.tsx` | Habit selection | ~150 |
| `components/onboarding/CompletionStep.tsx` | Final step | ~100 |
| `components/dashboard/DashboardGreetingCard.tsx` | Dashboard header | ~80 |

---

## 2. Proposed Flow Changes

### 2.1 New Flow Architecture

```
1. THEME              → Select coaching style
2. COACH_INTRO        → ✨ NEW: Dynamic AMIE greeting based on theme
3. MASTER_PROMPT_QNA  → Identity questions
4. VISION_CAPTURE     → Text/voice vision input
5. PHOTO_UPLOAD       → Reference photo + 🚀 TRIGGER BACKGROUND GENERATION
6. FINANCIAL_TARGET   → Set money goal (generation running)
7. DRAFT_PLAN_REVIEW  → Edit tasks (generation running - "waiting room")
8. HABITS_SETUP       → ✨ NEW: AMIE micro-contract ("Want me to text you?")
9. COMPLETION         → ✨ NEW: Fallback loading if generation incomplete
10. DASHBOARD         → ✨ NEW: "Magic Mirror" hero reveal
```

### 2.2 Key Innovations

| Innovation | Location | Description |
|------------|----------|-------------|
| **Identity-First Greeting** | Step 2 | AMIE greets user in their selected theme's voice |
| **Zero-Click Generation** | Step 5→6 | Generation starts immediately after photo upload |
| **Waiting Room** | Step 7 | DraftPlanReview naturally buffers while image generates |
| **Micro-Contract** | Step 8 | AMIE offers to send SMS reminder, user sees agent in action |
| **Magic Mirror Reveal** | Dashboard | Full-screen vision reveal on first login |

---

## 3. Implementation Details

### 3.1 Identity-First Coach Intro (Step 2)

**File:** `components/onboarding/CoachIntroStep.tsx`

**Current Behavior:**
- Static greeting regardless of theme

**New Behavior:**
- Call `amie-psychological-coach` or `onboarding-themes` edge function
- Generate theme-specific greeting based on `motivational_theme`

**Code Changes:**

```typescript
// CoachIntroStep.tsx - Add dynamic greeting

interface Props {
  selectedTheme: MotivationalTheme;
  onNext: () => void;
}

const CoachIntroStep: React.FC<Props> = ({ selectedTheme, onNext }) => {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGreeting = async () => {
      try {
        const { data } = await supabase.functions.invoke('onboarding-themes', {
          body: {
            action: 'generate_greeting',
            theme_id: selectedTheme.id,
            motivation_style: selectedTheme.motivation_style
          }
        });
        setGreeting(data.greeting);
      } catch (err) {
        // Fallback to static greeting
        setGreeting(getStaticGreeting(selectedTheme.motivation_style));
      } finally {
        setIsLoading(false);
      }
    };
    fetchGreeting();
  }, [selectedTheme]);

  // ... render with dynamic greeting
};
```

**Theme-Specific Personas:**

| Theme | Motivation Style | Greeting Tone |
|-------|------------------|---------------|
| Executive | `challenging` | Strategic, results-focused |
| Nurturer | `encouraging` | Warm, supportive |
| Analyst | `analytical` | Data-driven, logical |
| Believer | `spiritual` | Faith-based, purpose-driven |

---

### 3.2 Background Zero-Click Vision Generation

**Files:**
- `components/onboarding/GuidedOnboarding.tsx`
- `components/onboarding/PhotoUploadStep.tsx`

**Current Behavior:**
- `VisionGenerationStep` blocks user with spinner
- Generation only starts when step renders

**New Behavior:**
- Generation triggers immediately after `PhotoUploadStep` completes
- Promise stored in onboarding context
- User proceeds to Financial Target while generation runs

**State Management:**

```typescript
// GuidedOnboarding.tsx - Add to OnboardingState

interface OnboardingState {
  // ... existing fields

  // NEW: Background generation tracking
  pendingVisionPromise?: Promise<{ id: string; url: string }>;
  pendingVisionId?: string;
  visionGenerationStatus?: 'pending' | 'complete' | 'error';
  visionGenerationError?: string;
}
```

**Trigger Point (PhotoUploadStep completion):**

```typescript
// GuidedOnboarding.tsx - handlePhotoUploadComplete

const handlePhotoUploadComplete = async (photoRefId?: string) => {
  // Start background generation IMMEDIATELY
  const generationPromise = generateVisionInBackground({
    visionText: state.visionText!,
    photoRefId,
    themeName: state.selectedTheme?.name,
    // CRITICAL: Likeness parameters from v2.1.0 fix
    identityPrompt: state.identityDescription,
    referenceImageTags: ['self'],
    responseModalities: ['IMAGE']
  });

  // Store promise in state (don't await!)
  updateState({
    photoRefId,
    pendingVisionPromise: generationPromise,
    visionGenerationStatus: 'pending',
    currentStep: 'FINANCIAL_TARGET' // Advance immediately
  });

  // Handle resolution in background
  generationPromise
    .then(result => {
      updateState({
        generatedVisionId: result.id,
        generatedVisionUrl: result.url,
        visionGenerationStatus: 'complete'
      });
    })
    .catch(err => {
      console.error('Background vision generation failed:', err);
      updateState({
        visionGenerationStatus: 'error',
        visionGenerationError: err.message
      });
    });
};
```

**Critical Likeness Parameters (MUST PRESERVE):**

```typescript
// generateVisionInBackground function

const generateVisionInBackground = async (params: {
  visionText: string;
  photoRefId?: string;
  themeName?: string;
  identityPrompt?: string;      // ← REQUIRED for likeness
  referenceImageTags: string[]; // ← MUST include 'self'
  responseModalities: string[]; // ← MUST be ['IMAGE']
}) => {
  return supabase.functions.invoke('gemini-proxy', {
    body: {
      action: 'generateImage',
      prompt: buildEnhancedPrompt(params.visionText, params.themeName),
      referenceImageUrl: params.photoRefId,
      // LIKENESS FIX v2.1.0 PARAMETERS
      identityPrompt: params.identityPrompt,
      referenceImageTags: params.referenceImageTags,
      responseModalities: params.responseModalities,
      // Model routing
      model: 'gemini-3-pro-image-preview'
    }
  });
};
```

---

### 3.3 The "Waiting Room" (Draft Plan Review)

**File:** `components/onboarding/DraftPlanReviewStep.tsx`

**Current Behavior:**
- User edits their action plan
- No awareness of background generation

**New Behavior:**
- Acts as natural buffer while generation completes
- No UI changes needed - timing is natural

**Timing Analysis:**

| Activity | Typical Duration |
|----------|------------------|
| Vision generation | 15-45 seconds |
| Financial Target step | 30-60 seconds |
| Draft Plan Review step | 60-180 seconds |
| **Total buffer time** | **90-240 seconds** |

Since users typically spend 1-3 minutes on Draft Plan Review, the vision will almost always be ready before they proceed.

---

### 3.4 Agentic Micro-Contract (Habit Setup)

**File:** `components/onboarding/HabitsSetupStep.tsx`

**Current Behavior:**
- User selects habits from predefined list
- No agent interaction

**New Behavior:**
- After habit selection, AMIE offers: "I can text you tomorrow at 7:00 AM to remind you. Shall I set that up?"
- If confirmed, trigger `schedule-notification` or `send-sms`
- User sees immediate confirmation: "Done! You'll hear from me at 7 AM."

**Code Changes:**

```typescript
// HabitsSetupStep.tsx - Add micro-contract

const [showMicroContract, setShowMicroContract] = useState(false);
const [reminderSet, setReminderSet] = useState(false);

const handleHabitSelected = (habit: Habit) => {
  // ... existing selection logic

  // Show micro-contract for first habit selected
  if (selectedHabits.length === 0 && habit.category === 'morning') {
    setShowMicroContract(true);
  }
};

const handleAcceptReminder = async () => {
  try {
    // Schedule SMS for tomorrow 7 AM
    const tomorrow7am = new Date();
    tomorrow7am.setDate(tomorrow7am.getDate() + 1);
    tomorrow7am.setHours(7, 0, 0, 0);

    await supabase.functions.invoke('schedule-notification', {
      body: {
        user_id: userId,
        type: 'habit_reminder',
        channel: 'sms',
        scheduled_for: tomorrow7am.toISOString(),
        message: `Good morning! Time for your ${selectedHabits[0].name}. You've got this! - AMIE`
      }
    });

    setReminderSet(true);
    setShowMicroContract(false);
  } catch (err) {
    console.error('Failed to schedule reminder:', err);
  }
};

// Render micro-contract modal
{showMicroContract && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-6 max-w-sm mx-4">
      <div className="text-4xl mb-4">🤖</div>
      <h3 className="text-lg font-bold mb-2">Quick question!</h3>
      <p className="text-gray-600 mb-4">
        I can text you tomorrow at 7:00 AM to remind you about your morning routine.
        Want me to set that up?
      </p>
      <div className="flex gap-3">
        <button onClick={() => setShowMicroContract(false)} className="flex-1 px-4 py-2 border rounded-lg">
          No thanks
        </button>
        <button onClick={handleAcceptReminder} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg">
          Yes, remind me!
        </button>
      </div>
    </div>
  </div>
)}

{reminderSet && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
    <span className="text-green-700">✓ Reminder set for 7:00 AM tomorrow!</span>
  </div>
)}
```

---

### 3.5 Completion Step Fallback

**File:** `components/onboarding/CompletionStep.tsx`

**Current Behavior:**
- Static completion message
- Immediately marks onboarding complete

**New Behavior:**
- Check if vision generation is complete
- If not complete, show "Finalizing your vision..." with progress
- Wait for completion before proceeding to dashboard

**Code Changes:**

```typescript
// CompletionStep.tsx - Add generation check

interface Props {
  // ... existing props
  visionGenerationStatus: 'pending' | 'complete' | 'error';
  pendingVisionPromise?: Promise<any>;
  onComplete: () => void;
}

const CompletionStep: React.FC<Props> = ({
  visionGenerationStatus,
  pendingVisionPromise,
  onComplete
}) => {
  const [isWaiting, setIsWaiting] = useState(visionGenerationStatus === 'pending');

  useEffect(() => {
    if (visionGenerationStatus === 'pending' && pendingVisionPromise) {
      // Wait for generation to complete
      pendingVisionPromise
        .then(() => setIsWaiting(false))
        .catch(() => setIsWaiting(false)); // Proceed even on error (placeholder used)
    } else {
      setIsWaiting(false);
    }
  }, [visionGenerationStatus, pendingVisionPromise]);

  if (isWaiting) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <h2 className="text-xl font-bold mb-2">Finalizing your vision...</h2>
        <p className="text-gray-500">Just a few more seconds</p>
      </div>
    );
  }

  // ... existing completion UI
};
```

---

### 3.6 Magic Mirror Dashboard Reveal

**File:** `components/dashboard/DashboardGreetingCard.tsx`

**Current Behavior:**
- Standard greeting card with time-based message
- No special first-login handling

**New Behavior:**
- Detect first login via `profiles.onboarding_completed` timestamp
- Show "Hero Reveal" layout with full vision image
- Provide "Make Primary" vs "Refine" actions

**Code Changes:**

```typescript
// DashboardGreetingCard.tsx - Add hero reveal mode

interface Props {
  userName: string;
  themeName?: string;
  motivationStyle?: 'encouraging' | 'challenging' | 'analytical' | 'spiritual';
  themeInsight?: string;
  onPlayBriefing?: () => void;
  // NEW: First login reveal
  isFirstLogin?: boolean;
  primaryVisionUrl?: string;
  primaryVisionId?: string;
  onMakePrimary?: (visionId: string) => void;
  onRefineVision?: (visionId: string) => void;
}

const DashboardGreetingCard: React.FC<Props> = ({
  userName,
  themeName,
  motivationStyle,
  themeInsight,
  onPlayBriefing,
  isFirstLogin,
  primaryVisionUrl,
  primaryVisionId,
  onMakePrimary,
  onRefineVision
}) => {
  // First login hero reveal
  if (isFirstLogin && primaryVisionUrl) {
    return (
      <div className="relative rounded-2xl overflow-hidden">
        {/* Full-width vision image */}
        <div className="relative h-64 md:h-80">
          <img
            src={primaryVisionUrl}
            alt="Your Vision"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Overlay content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <p className="text-sm opacity-80 mb-1">Welcome to your journey</p>
            <h1 className="text-2xl md:text-3xl font-bold mb-4">{userName}, your vision awaits</h1>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => onMakePrimary?.(primaryVisionId!)}
                className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition"
              >
                ✓ Make Primary
              </button>
              <button
                onClick={() => onRefineVision?.(primaryVisionId!)}
                className="px-4 py-2 bg-white/20 backdrop-blur text-white rounded-lg font-medium hover:bg-white/30 transition"
              >
                Refine Vision
              </button>
            </div>
          </div>
        </div>

        {/* Celebration animation */}
        <div className="absolute top-4 right-4">
          <span className="text-4xl animate-bounce">✨</span>
        </div>
      </div>
    );
  }

  // ... existing standard greeting
};
```

**Dashboard Integration:**

```typescript
// Dashboard.tsx - Detect first login

const [isFirstLogin, setIsFirstLogin] = useState(false);

useEffect(() => {
  const checkFirstLogin = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed, onboarding_completed_at, primary_vision_id')
      .eq('id', userId)
      .single();

    if (profile?.onboarding_completed) {
      const completedAt = new Date(profile.onboarding_completed_at);
      const now = new Date();
      const hoursSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);

      // Show hero reveal if completed within last 24 hours
      setIsFirstLogin(hoursSinceCompletion < 24);
    }
  };
  checkFirstLogin();
}, [userId]);
```

---

## 4. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ONBOARDING DATA FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: THEME
    │
    ├─► selectedTheme { id, name, motivation_style }
    │
    ▼
Step 2: COACH_INTRO
    │
    ├─► Call onboarding-themes → dynamic greeting
    │
    ▼
Step 3: MASTER_PROMPT_QNA
    │
    ├─► identityDescription (for likeness)
    │
    ▼
Step 4: VISION_CAPTURE
    │
    ├─► visionText
    │
    ▼
Step 5: PHOTO_UPLOAD ════════════════════════════════════════════════════╗
    │                                                                     ║
    ├─► photoRefId                                                        ║
    │                                                                     ║
    │   🚀 TRIGGER: generateVisionInBackground({                          ║
    │       visionText,                                                   ║
    │       photoRefId,                                                   ║
    │       identityPrompt,        ← LIKENESS                             ║
    │       referenceImageTags,    ← LIKENESS                             ║
    │       responseModalities     ← LIKENESS                             ║
    │   })                                                                ║
    │                                                                     ║
    ├─► pendingVisionPromise (stored, not awaited)                        ║
    │                                                                     ║
    ▼                                                                     ║
Step 6: FINANCIAL_TARGET                                                  ║
    │                                                                     ║
    ├─► financialTarget                                    [GENERATING]   ║
    │                                                                     ║
    ▼                                                                     ║
Step 7: DRAFT_PLAN_REVIEW ("Waiting Room")                                ║
    │                                                                     ║
    ├─► User edits tasks (60-180 seconds)                  [GENERATING]   ║
    │                                                                     ║
    ▼                                                                     ║
Step 8: HABITS_SETUP                                                      ║
    │                                                                     ║
    ├─► selectedHabits[]                                                  ║
    ├─► 🤖 AMIE Micro-Contract: "Want a text reminder?"                   ║
    │   └─► If yes: schedule-notification                                 ║
    │                                                                     ║
    ▼                                                                     ║
Step 9: COMPLETION ◄═══════════════════════════════════════════════════════╝
    │                                                      [COMPLETE]
    ├─► Check: visionGenerationStatus === 'complete'?
    │   └─► If pending: Show "Finalizing..." spinner
    │   └─► Wait for pendingVisionPromise
    │
    ▼
DASHBOARD
    │
    ├─► Check: isFirstLogin? (completed < 24h ago)
    │   └─► If yes: Show "Magic Mirror" hero reveal
    │   └─► Actions: "Make Primary" | "Refine"
    │
    ▼
NORMAL DASHBOARD
```

---

## 5. File Modification List

### 5.1 Components to Modify

| File | Changes | Effort |
|------|---------|--------|
| `components/onboarding/GuidedOnboarding.tsx` | Add background generation trigger, state management | 2 hours |
| `components/onboarding/CoachIntroStep.tsx` | Add dynamic theme-based greeting | 1 hour |
| `components/onboarding/PhotoUploadStep.tsx` | Trigger generation on complete | 30 min |
| `components/onboarding/HabitsSetupStep.tsx` | Add AMIE micro-contract modal | 1.5 hours |
| `components/onboarding/CompletionStep.tsx` | Add fallback loading state | 1 hour |
| `components/dashboard/DashboardGreetingCard.tsx` | Add hero reveal mode | 1.5 hours |
| `components/dashboard/Dashboard.tsx` | Add first-login detection | 30 min |

### 5.2 Hooks to Modify

| File | Changes | Effort |
|------|---------|--------|
| `hooks/useOnboarding.ts` (if exists) | Add background generation handling | 1 hour |

### 5.3 Types to Extend

| File | Changes | Effort |
|------|---------|--------|
| `types.ts` | Add `pendingVisionPromise`, `visionGenerationStatus` to OnboardingState | 15 min |

### 5.4 Edge Functions (No Changes)

The following functions already exist and require **no modifications**:
- `gemini-proxy` - Vision generation
- `onboarding-themes` - Theme greetings
- `schedule-notification` - SMS scheduling
- `send-sms` - Direct SMS sending

---

## 6. Testing Strategy

### 6.1 Unit Tests

| Test | File | Description |
|------|------|-------------|
| Background generation triggers | `guided-onboarding.test.ts` | Verify promise created after photo upload |
| Likeness params passed | `guided-onboarding.test.ts` | Verify `identityPrompt`, `referenceImageTags` sent to gemini-proxy |
| State persistence | `guided-onboarding.test.ts` | Verify promise survives step transitions |

### 6.2 Integration Tests

| Test | Description |
|------|-------------|
| End-to-end onboarding | Complete flow with background generation |
| Fallback loading | Artificially slow generation, verify CompletionStep waits |
| Error handling | Generation failure → placeholder used → flow continues |
| Micro-contract | Accept reminder → verify schedule-notification called |

### 6.3 Manual Test Cases

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1 | Complete onboarding with photo | Vision ready by Draft Plan Review |
| 2 | Skip photo upload | Generation still runs with text-only |
| 3 | Fast user (skip Draft Plan Review quickly) | CompletionStep shows "Finalizing..." |
| 4 | Generation error | Placeholder image used, flow continues |
| 5 | First dashboard load | Hero reveal with vision image |
| 6 | Second dashboard load | Normal greeting card |
| 7 | Accept SMS reminder | Notification scheduled, confirmation shown |

### 6.4 Likeness Verification Checklist

- [ ] `identityPrompt` passed to gemini-proxy
- [ ] `referenceImageTags` includes 'self'
- [ ] `responseModalities` is ['IMAGE']
- [ ] Generated image shows recognizable likeness to uploaded photo
- [ ] Placeholder fallback does not break flow

---

## 7. Rollback Procedures

### 7.1 Feature Flag

Add feature flag for gradual rollout:

```typescript
// GuidedOnboarding.tsx

const ENABLE_BACKGROUND_GENERATION = true; // Set to false to rollback

// In handlePhotoUploadComplete:
if (ENABLE_BACKGROUND_GENERATION) {
  // New background generation flow
} else {
  // Original blocking flow
  updateState({ currentStep: 'VISION_GENERATION' });
}
```

### 7.2 Emergency Rollback

If critical issues arise:

1. Set `ENABLE_BACKGROUND_GENERATION = false`
2. Deploy immediately
3. Users will see original blocking flow
4. No data loss - existing visions preserved

---

## 8. Implementation Phases

### Phase 1: Background Generation (3-4 hours)

| Task | File | Priority |
|------|------|----------|
| Add state fields | `types.ts` | P0 |
| Implement background trigger | `GuidedOnboarding.tsx` | P0 |
| Update PhotoUploadStep | `PhotoUploadStep.tsx` | P0 |
| Add completion fallback | `CompletionStep.tsx` | P0 |

### Phase 2: Dynamic Coach Intro (1-2 hours)

| Task | File | Priority |
|------|------|----------|
| Fetch theme greeting | `CoachIntroStep.tsx` | P1 |
| Add fallback greetings | `CoachIntroStep.tsx` | P1 |

### Phase 3: Micro-Contract (1.5-2 hours)

| Task | File | Priority |
|------|------|----------|
| Add contract modal | `HabitsSetupStep.tsx` | P1 |
| Integrate schedule-notification | `HabitsSetupStep.tsx` | P1 |

### Phase 4: Magic Mirror Reveal (1.5-2 hours)

| Task | File | Priority |
|------|------|----------|
| Add hero reveal mode | `DashboardGreetingCard.tsx` | P1 |
| Add first-login detection | `Dashboard.tsx` | P1 |

### Phase 5: Testing & Polish (2-3 hours)

| Task | Priority |
|------|----------|
| Write unit tests | P0 |
| Manual QA all flows | P0 |
| Likeness verification | P0 |
| Performance testing | P1 |

---

## 9. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Onboarding completion rate | TBD | +10% |
| Time on VisionGenerationStep | 15-45s | 0s (background) |
| First-day return rate | TBD | +15% |
| "Wow" survey score | TBD | 4.5+/5.0 |

---

## 10. Approval Checklist

Before implementation, confirm:

- [ ] Plan reviewed and approved by stakeholder
- [ ] Likeness parameters documented and understood
- [ ] Feature flag strategy approved
- [ ] Testing strategy approved
- [ ] Rollback procedure understood

---

**AWAITING APPROVAL - No implementation until this plan is approved.**
