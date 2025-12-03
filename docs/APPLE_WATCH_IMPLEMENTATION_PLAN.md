# Apple Watch Companion App - Implementation Plan

**Created:** December 2, 2025
**Status:** Planning Phase
**Target:** v1.6 Release

---

## 1. Executive Summary

The Visionary Apple Watch Companion App provides **micro-coaching at habit trigger moments**, enabling users to:
- View and complete habits from their wrist
- Receive personalized coaching notifications
- Track streaks without opening their phone
- Access quick "Talk to Coach" voice interactions

This app complements the existing React/Supabase web platform with a native watchOS experience.

---

## 2. Technical Architecture

### Platform Requirements

| Requirement | Value |
|-------------|-------|
| Language | Swift 5.9+ |
| UI Framework | SwiftUI |
| IDE | Xcode 16+ |
| Deployment Target | watchOS 10.0+ |
| iOS Companion | iOS 17.0+ |
| Backend | Existing Supabase (edaigbnnofyxcfbpcvct) |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VISIONARY WATCH SYSTEM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │ Apple Watch  │────▶│ iPhone App   │────▶│ Supabase Backend         │ │
│  │ Extension    │     │ (Bridge)     │     │ (edaigbnnofyxcfbpcvct)   │ │
│  └──────────────┘     └──────────────┘     └──────────────────────────┘ │
│         │                    │                        │                  │
│         │                    │                        ▼                  │
│  Features:             Handles:              ┌──────────────────────┐   │
│  • Habit list          • Auth sync           │ Edge Functions       │   │
│  • Completions         • Deep links          ├──────────────────────┤   │
│  • Complications       • Background          │ watch-notifications  │   │
│  • Voice input           refresh             │ watch-sync           │   │
│                                              │ habit-service        │   │
│                                              └──────────────────────┘   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                         NOTIFICATION FLOW                                │
│                                                                          │
│  Supabase Trigger ──▶ Edge Function ──▶ APNs ──▶ Watch Notification    │
│                                                                          │
│  Fallback Chain: watch ──▶ push ──▶ sms ──▶ email                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Project Structure

### Repository Structure

```
visionary-ios/
├── Visionary.xcodeproj
├── Visionary/                          # iOS App
│   ├── App/
│   │   ├── VisionaryApp.swift
│   │   └── ContentView.swift
│   ├── Services/
│   │   ├── SupabaseService.swift       # Supabase client
│   │   ├── AuthService.swift           # Auth management
│   │   ├── HabitService.swift          # Habit operations
│   │   └── NotificationService.swift   # Push handling
│   ├── Models/
│   │   ├── Habit.swift
│   │   ├── HabitCompletion.swift
│   │   └── UserProfile.swift
│   └── Views/
│       └── ...
│
├── VisionaryWatch/                     # watchOS Extension
│   ├── VisionaryWatchApp.swift
│   ├── ContentView.swift
│   ├── Views/
│   │   ├── HabitListView.swift         # Main habit list
│   │   ├── HabitRowView.swift          # Individual habit row
│   │   ├── CompletionView.swift        # Completion confirmation
│   │   └── CoachView.swift             # Quick coach interaction
│   ├── Complications/
│   │   ├── ComplicationController.swift
│   │   └── ComplicationViews.swift
│   └── Services/
│       ├── WatchConnectivity.swift     # iPhone ↔ Watch sync
│       └── WatchSupabaseService.swift  # Direct API calls
│
├── Shared/                             # Shared code
│   ├── Models/
│   ├── Extensions/
│   └── Constants.swift
│
└── Package.swift                       # SPM dependencies
```

### Dependencies (Swift Package Manager)

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/supabase-community/supabase-swift.git", from: "2.0.0"),
    .package(url: "https://github.com/onevcat/Kingfisher.git", from: "7.0.0"), // Image caching
]
```

---

## 4. Data Models

### Swift Models (Matching Supabase Schema)

```swift
// Habit.swift
import Foundation

struct Habit: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    let title: String
    let description: String?
    let frequency: HabitFrequency
    let targetCount: Int
    let reminderTime: String?
    let isActive: Bool
    let createdAt: Date

    // Computed for Watch display
    var currentStreak: Int?
    var lastCompleted: Date?
    var completedToday: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case title
        case description
        case frequency
        case targetCount = "target_count"
        case reminderTime = "reminder_time"
        case isActive = "is_active"
        case createdAt = "created_at"
        case currentStreak = "current_streak"
        case lastCompleted = "last_completed"
    }
}

enum HabitFrequency: String, Codable {
    case daily
    case weekly
    case custom
}

// HabitCompletion.swift
struct HabitCompletion: Codable {
    let id: UUID
    let habitId: UUID
    let completedAt: Date
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id
        case habitId = "habit_id"
        case completedAt = "completed_at"
        case notes
    }
}
```

---

## 5. Supabase API Endpoints

### Existing Endpoints (Already Available)

| Endpoint | Method | Purpose | Edge Function |
|----------|--------|---------|---------------|
| `/rest/v1/habits` | GET | List user habits | Direct DB |
| `/rest/v1/habits` | POST | Create habit | Direct DB |
| `/rest/v1/habit_completions` | POST | Log completion | Direct DB |
| `/functions/v1/habit-service` | POST | Habit operations | `habit-service` |

### New Endpoints (To Be Created)

| Endpoint | Method | Purpose | New Function |
|----------|--------|---------|--------------|
| `/functions/v1/watch-sync` | POST | Sync watch data | `watch-sync` |
| `/functions/v1/watch-notifications` | POST | Send APNs push | `watch-notifications` |
| `/functions/v1/watch-coach-prompt` | GET | Get micro-coaching | `watch-coach-prompt` |

---

## 6. Edge Functions (New)

### watch-sync

```typescript
// supabase/functions/watch-sync/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface WatchSyncRequest {
  action: 'get_habits' | 'complete_habit' | 'get_stats'
  habit_id?: string
  device_id?: string
  last_sync?: string
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const authHeader = req.headers.get('Authorization')
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader?.replace('Bearer ', '') || ''
  )

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const body: WatchSyncRequest = await req.json()

  switch (body.action) {
    case 'get_habits': {
      // Get active habits with today's completion status
      const today = new Date().toISOString().split('T')[0]

      const { data: habits } = await supabase
        .from('habits')
        .select(`
          *,
          completions:habit_completions(completed_at)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      // Mark which habits are completed today
      const habitsWithStatus = habits?.map(h => ({
        ...h,
        completedToday: h.completions?.some(c =>
          c.completed_at.startsWith(today)
        ) || false
      }))

      return new Response(JSON.stringify({ habits: habitsWithStatus }))
    }

    case 'complete_habit': {
      const { data, error } = await supabase
        .from('habit_completions')
        .insert({
          habit_id: body.habit_id,
          user_id: user.id,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, completion: data }))
    }

    case 'get_stats': {
      const { data: stats } = await supabase
        .from('habits')
        .select('id, title, current_streak')
        .eq('user_id', user.id)
        .eq('is_active', true)

      const totalHabits = stats?.length || 0
      const longestStreak = Math.max(...(stats?.map(s => s.current_streak || 0) || [0]))

      return new Response(JSON.stringify({ totalHabits, longestStreak }))
    }
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
})
```

### watch-notifications

```typescript
// supabase/functions/watch-notifications/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface APNsPayload {
  userId: string
  deviceToken: string
  title: string
  body: string
  category?: 'HABIT_REMINDER' | 'STREAK_ALERT' | 'COACH_MESSAGE'
  habitId?: string
}

serve(async (req) => {
  const payload: APNsPayload = await req.json()

  // APNs configuration
  const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID')!
  const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID')!
  const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY')!
  const BUNDLE_ID = 'com.visionary.app'

  // Build APNs JWT
  const jwt = await generateAPNsJWT(APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY)

  // Build notification payload
  const apnsPayload = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body
      },
      sound: 'default',
      category: payload.category || 'DEFAULT',
      'content-available': 1
    },
    habitId: payload.habitId
  }

  // Send to APNs
  const response = await fetch(
    `https://api.push.apple.com/3/device/${payload.deviceToken}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${jwt}`,
        'apns-topic': `${BUNDLE_ID}.watchkitapp`,
        'apns-push-type': 'alert',
        'apns-priority': '10'
      },
      body: JSON.stringify(apnsPayload)
    }
  )

  return new Response(JSON.stringify({
    success: response.ok,
    status: response.status
  }))
})

async function generateAPNsJWT(keyId: string, teamId: string, privateKey: string): Promise<string> {
  // JWT generation logic for APNs
  // ... implementation
  return 'jwt_token'
}
```

---

## 7. Watch UI Screens

### Screen 1: Habit List (Main View)

```
┌─────────────────────┐
│    Today's Habits   │
│    ─────────────    │
│                     │
│  ✓ Morning Prayer   │
│    7:00 AM • 5 day  │
│                     │
│  ○ Exercise         │
│    Not done yet     │
│                     │
│  ○ Read 30 min      │
│    Not done yet     │
│                     │
│  [💬 Talk to Coach] │
└─────────────────────┘
```

### Screen 2: Habit Completion

```
┌─────────────────────┐
│                     │
│        ✓            │
│                     │
│   Morning Prayer    │
│     Completed!      │
│                     │
│   🔥 6 Day Streak   │
│                     │
│    [Undo] [Done]    │
└─────────────────────┘
```

### Screen 3: Coach Micro-Prompt

```
┌─────────────────────┐
│   💬 Quick Coach    │
│   ─────────────     │
│                     │
│  "Great progress!   │
│   Your streak is    │
│   building strong   │
│   momentum."        │
│                     │
│    [🎤 Reply]       │
└─────────────────────┘
```

### Complication Designs

| Type | Content | Tap Action |
|------|---------|------------|
| Circular | `3/5` habits icon | Open app |
| Rectangular | "3 habits left" + streak | Open app |
| Inline | `🔥 12 day streak` | Open app |

---

## 8. Authentication Flow

### Initial Setup (iPhone → Watch)

```swift
// iOS App - After Supabase login
func shareSessionWithWatch() {
    let session = supabase.auth.currentSession

    // Store in shared Keychain
    let keychain = KeychainItem(
        service: "com.visionary",
        account: "session",
        accessGroup: "group.com.visionary.shared"
    )
    try keychain.saveItem(session.accessToken)

    // Notify Watch via WatchConnectivity
    if WCSession.default.isReachable {
        WCSession.default.sendMessage(
            ["action": "session_updated"],
            replyHandler: nil
        )
    }
}
```

### Watch App Authentication

```swift
// watchOS Extension
class AuthManager: ObservableObject {
    @Published var isAuthenticated = false

    func checkAuthentication() {
        // Try shared Keychain first
        let keychain = KeychainItem(
            service: "com.visionary",
            account: "session",
            accessGroup: "group.com.visionary.shared"
        )

        if let token = try? keychain.loadItem() {
            supabase.auth.setSession(token)
            isAuthenticated = true
        } else {
            // Fall back to Sign in with Apple on Watch
            requestAppleSignIn()
        }
    }
}
```

---

## 9. Notification Categories

### APNs Categories (for actionable notifications)

```swift
// iOS App - Register notification categories
func registerNotificationCategories() {
    let completeAction = UNNotificationAction(
        identifier: "COMPLETE_HABIT",
        title: "Mark Done",
        options: .foreground
    )

    let snoozeAction = UNNotificationAction(
        identifier: "SNOOZE_HABIT",
        title: "Remind in 1hr",
        options: []
    )

    let habitCategory = UNNotificationCategory(
        identifier: "HABIT_REMINDER",
        actions: [completeAction, snoozeAction],
        intentIdentifiers: [],
        options: .customDismissAction
    )

    UNUserNotificationCenter.current().setNotificationCategories([habitCategory])
}
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)

| Task | Priority | Effort |
|------|----------|--------|
| Create Xcode project with watchOS target | High | 2 hrs |
| Integrate Supabase Swift SDK | High | 4 hrs |
| Implement shared auth via Keychain | High | 8 hrs |
| Create basic habit list UI | High | 8 hrs |
| Implement `watch-sync` Edge Function | High | 4 hrs |

**Deliverable:** Watch app displays habits from Supabase

### Phase 2: Core Features (Week 3-4)

| Task | Priority | Effort |
|------|----------|--------|
| Add habit completion tap | High | 4 hrs |
| Implement complications | High | 8 hrs |
| Set up APNs push notifications | High | 8 hrs |
| Create `watch-notifications` Edge Function | High | 4 hrs |
| Add actionable notification buttons | Medium | 4 hrs |

**Deliverable:** Fully functional habit tracking on Watch

### Phase 3: Polish (Week 5-6)

| Task | Priority | Effort |
|------|----------|--------|
| Add offline caching with SwiftData | Medium | 8 hrs |
| Implement sync conflict resolution | Medium | 4 hrs |
| Add streak visualization | Medium | 4 hrs |
| Implement "Talk to Coach" voice input | Low | 8 hrs |
| App Store submission prep | High | 8 hrs |

**Deliverable:** Production-ready Watch app

---

## 11. Required Secrets

### Supabase Edge Function Secrets

```bash
# Add to Supabase Dashboard > Settings > Secrets

# Apple Push Notification Service
APNS_KEY_ID=XXXXXXXXXX           # From Apple Developer Portal
APNS_TEAM_ID=XXXXXXXXXX          # Your Apple Team ID
APNS_PRIVATE_KEY=-----BEGIN...   # .p8 key contents

# App identifiers
IOS_BUNDLE_ID=com.visionary.app
WATCH_BUNDLE_ID=com.visionary.app.watchkitapp
```

### Apple Developer Requirements

1. **Apple Developer Program** ($99/year)
2. **App ID** for iOS app
3. **App ID** for watchOS extension
4. **APNs Key** (.p8 file) for push notifications
5. **Provisioning Profiles** for both targets

---

## 12. Testing Plan

### Unit Tests

- [ ] Habit model encoding/decoding
- [ ] Auth token storage and retrieval
- [ ] Completion logic

### Integration Tests

- [ ] Supabase API connectivity
- [ ] Real-time sync between devices
- [ ] Push notification delivery

### Device Tests

- [ ] Apple Watch Series 7+ (40mm, 44mm)
- [ ] Apple Watch Ultra
- [ ] Various complication placements
- [ ] Offline mode behavior

---

## 13. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Watch engagement | 40% of iOS users | Weekly active on Watch |
| Habit completion rate | +20% increase | Completions via Watch |
| Notification interaction | 60% tap rate | APNs analytics |
| Complication usage | 30% of Watch users | Complication impressions |

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| APNs complexity | High | Use existing Twilio SMS as fallback |
| Watch connectivity issues | Medium | Implement robust offline caching |
| App Store rejection | High | Follow Apple HIG strictly |
| Battery drain | Medium | Minimize background refreshes |

---

## 15. Next Steps

1. **Immediate:** Create new iOS/watchOS Xcode project
2. **Week 1:** Implement Phase 1 foundation tasks
3. **Week 2:** Deploy `watch-sync` Edge Function
4. **Week 3-4:** Complete Phase 2 core features
5. **Week 5-6:** Polish and App Store submission

---

*Document created: December 2, 2025*
*Author: Claude AI Assistant*
*Status: Ready for Development*
