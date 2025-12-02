# Visionary v1.6 UX Overhaul Documentation

## Overview

This document describes the UX refactoring for Visionary v1.6, focusing on:
1. Guided, identity-driven onboarding flow (AMIE themes + voice vision capture)
2. Unified Home Dashboard for the daily loop
3. Cleaner navigation between features

## New Routes/Views

### AppView Additions
| View | Purpose |
|------|---------|
| `DASHBOARD` | Main daily home for logged-in users |
| `GUIDED_ONBOARDING` | Multi-step onboarding flow orchestrator |

### Onboarding Steps (Internal)
1. Theme Selection (AMIE)
2. Coach Introduction
3. Voice/Text Vision Capture
4. Photo Upload (Optional)
5. Financial Target
6. Vision Image Generation
7. Action Plan Preview
8. Habits Setup
9. Print Offer
10. Completion

## New Components

### Onboarding Components (`components/onboarding/`)
| Component | Purpose |
|-----------|---------|
| `OnboardingLayout.tsx` | Shared shell with progress bar |
| `ThemeSelectorStep.tsx` | AMIE theme selection |
| `CoachIntroStep.tsx` | Theme-based coach introduction |
| `VisionCaptureStep.tsx` | Voice/text vision input |
| `PhotoUploadStep.tsx` | Optional reference photo |
| `FinancialTargetStep.tsx` | Financial goal setting |
| `VisionGenerationStep.tsx` | AI vision image creation |
| `ActionPlanPreviewStep.tsx` | Generated tasks preview |
| `HabitsSetupStep.tsx` | Default habits selection |
| `PrintOfferStep.tsx` | Vision poster offer |
| `CompletionStep.tsx` | Onboarding completion |
| `GuidedOnboarding.tsx` | Main orchestrator component |

### Dashboard Components (`components/dashboard/`)
| Component | Purpose |
|-----------|---------|
| `Dashboard.tsx` | Main dashboard container |
| `DashboardGreetingCard.tsx` | Personalized greeting + theme insight |
| `TodayFocusCard.tsx` | AI-generated daily focus |
| `PrimaryVisionCard.tsx` | Primary vision image display |
| `TodayActionsCard.tsx` | Today's 3 recommended tasks |
| `HabitStreakBar.tsx` | Habit completion & streaks |
| `FinancialProgressCard.tsx` | Financial goal progress ring |
| `TalkToCoachButton.tsx` | Voice coach CTA |
| `PrintCenterCard.tsx` | Print products CTA |

## Database Changes

### profiles table additions
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `onboarding_completed` | BOOLEAN | FALSE | Track onboarding status |
| `primary_vision_id` | UUID | NULL | Reference to primary vision |
| `financial_target` | DECIMAL | NULL | User's financial goal |

### user_identity_profiles table (existing)
Used to store selected theme and identity data.

## Navigation Changes

### Simplified Top Navigation (logged-in users)
```
Dashboard | Visualize | Gallery | Execute | Habits | Coach | Print | [More ▼] | [Profile]
```

### More Dropdown Contains
- Reviews
- Knowledge
- Partner
- Apps (Integrations)
- Teams
- Manager
- Shop
- Orders

## Flow Logic

### Authentication Flow
```
User logs in
  → Check profiles.onboarding_completed
    → FALSE: Redirect to GUIDED_ONBOARDING
    → TRUE: Redirect to DASHBOARD
```

### Onboarding Flow
```
Step 1: Theme Selection → Save to user_identity_profiles.theme_id
Step 2: Coach Intro → Display only
Step 3: Vision Capture → Save to onboarding state
Step 4: Photo Upload → Save to reference_images (optional)
Step 5: Financial Target → Save to profiles.financial_target
Step 6: Vision Generation → Call Gemini, save to vision_boards
Step 7: Action Plan → Generate tasks via agent, save to action_tasks
Step 8: Habits Setup → Create habits based on theme
Step 9: Print Offer → Link to /print (optional)
Step 10: Completion → Set onboarding_completed = TRUE, go to Dashboard
```

## Implementation Notes

- Uses existing Vite + React SPA architecture
- Custom AppView enum routing (no React Router)
- Reuses existing components where possible
- Tailwind CSS styling consistent with current design
- Supabase for all data persistence
