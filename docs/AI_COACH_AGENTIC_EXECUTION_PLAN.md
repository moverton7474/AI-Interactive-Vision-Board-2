# Vision AI Coach - Agentic Execution Enhancement Plan

## Executive Summary

This plan outlines enhancements to enable the Vision AI Coach (AMIE) to execute agentic requests on behalf of users—such as sending emails, making calls, sending texts, and setting calendar appointments—both reactively (user-initiated) and proactively (AI-recommended during conversation).

---

## Current State Analysis

### Already Implemented (Working)

| Capability | Backend | Frontend | Function Calling |
|------------|---------|----------|------------------|
| **Send Email** | ✅ `send-email` function (Resend API) | ✅ Settings UI | ✅ In VoiceCoach |
| **Send SMS** | ✅ `agent-send-sms` function (Twilio) | ✅ Settings UI | ✅ In VoiceCoach |
| **Voice Calls** | ✅ `agent-voice-call` function (Twilio) | ✅ Settings UI | ❌ Missing from tools |
| **Create Tasks** | ✅ Direct DB insert | ✅ Settings UI | ✅ In VoiceCoach |
| **Schedule Reminders** | ✅ Fallback to tasks | ✅ Settings UI | ✅ In VoiceCoach |
| **Mark Habit Complete** | ✅ Full implementation | ❌ No UI trigger | ✅ In VoiceCoach |
| **Update Goal Progress** | ✅ Full implementation | ❌ No UI trigger | ✅ In VoiceCoach |
| **Get User Data** | ✅ Full implementation | N/A | ✅ In VoiceCoach |

### Infrastructure in Place

1. **User Permissions System** (`user_agent_settings` table)
   - Master toggle: `agent_actions_enabled`
   - Per-action toggles: `allow_send_email`, `allow_send_sms`, `allow_voice_calls`, etc.
   - Confirmation requirements: `require_confirmation_email/sms/voice`
   - Proactive outreach settings

2. **Team-Level Guardrails** (`team_ai_settings` table)
   - Blocked topics
   - Crisis detection keywords
   - Rate limiting (sessions per day, cooldown)

3. **Audit Trail** (`agent_action_history` table)
   - Full action logging with status tracking
   - Payload storage for debugging

4. **Communication Infrastructure**
   - Twilio integration (SMS + Voice)
   - Resend integration (Email)
   - Quiet hours enforcement
   - Phone number validation

### Key Gaps Identified

| Gap | Impact | Priority |
|-----|--------|----------|
| **Voice calls not in Gemini tools** | Users can't request calls via conversation | HIGH |
| **AgentChat lacks function calling** | Text chat can't execute actions | HIGH |
| **Calendar API not integrated** | Only deep links, no direct booking | MEDIUM |
| **Confirmation flow incomplete** | Actions execute without user approval | HIGH |
| **No proactive action suggestions** | AI doesn't organically recommend actions | MEDIUM |
| **No send-to-others capability** | Can only SMS/email to self | MEDIUM |

---

## Implementation Plan

### Phase 1: Core Agentic Execution (Priority: HIGH)

#### 1.1 Add Voice Call to Function Declarations

**File:** `supabase/functions/voice-coach-session/index.ts`

Add to `getGeminiTools()`:
```typescript
{
  name: 'make_voice_call',
  description: 'Initiate a voice call to the user for reminders or check-ins',
  parameters: {
    type: 'object',
    properties: {
      call_type: {
        type: 'string',
        enum: ['habit_reminder', 'goal_checkin', 'accountability', 'celebration', 'custom'],
        description: 'Type of call to make'
      },
      message: {
        type: 'string',
        description: 'Custom message for the call (optional)'
      }
    },
    required: ['call_type']
  }
}
```

Add to `executeAgentTool()`:
```typescript
case 'make_voice_call': {
  // Check guardrail
  if (aiSettings?.allow_voice_calls === false) {
    return { success: false, error: 'Voice calls disabled by team policy.' }
  }

  // Call agent-voice-call function
  const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-voice-call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      user_id: userId,
      call_type: args.call_type,
      message: args.message
    })
  })
  return await response.json()
}
```

#### 1.2 Enable Function Calling in AgentChat

**File:** `supabase/functions/agent-chat/index.ts` (or create if missing)

The current `amie-psychological-coach` function doesn't have function calling. Create a new unified endpoint or enhance it:

```typescript
// Add tools parameter to Gemini call
const geminiResponse = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: geminiContents,
      tools: getGeminiTools(),  // Add this!
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7
      }
    })
  }
)

// Handle function calls in response
```

**Frontend Change:** Update `AgentChat.tsx` to call the enhanced function.

#### 1.3 Implement Confirmation Flow

**New Table:** `pending_agent_actions`
```sql
CREATE TABLE pending_agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id UUID,
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending_confirmation',
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Flow:**
1. AI requests action → Check `require_confirmation_*` setting
2. If confirmation required → Insert into `pending_agent_actions` → Return to AI: "I'd like to [action]. Should I proceed?"
3. User confirms → AI calls `confirm_pending_action` tool → Execute action
4. User declines → AI calls `cancel_pending_action` tool → Mark cancelled

**New Tools:**
```typescript
{
  name: 'confirm_pending_action',
  description: 'Execute a previously proposed action after user confirmation',
  parameters: {
    type: 'object',
    properties: {
      action_id: { type: 'string', description: 'ID of pending action' }
    },
    required: ['action_id']
  }
},
{
  name: 'cancel_pending_action',
  description: 'Cancel a previously proposed action',
  parameters: {
    type: 'object',
    properties: {
      action_id: { type: 'string', description: 'ID of pending action' }
    },
    required: ['action_id']
  }
}
```

---

### Phase 2: Calendar Integration (Priority: MEDIUM)

#### 2.1 Google Calendar OAuth Integration

**New Files:**
- `supabase/functions/google-calendar-connect/index.ts` - OAuth flow
- `supabase/functions/google-calendar-create-event/index.ts` - Create events
- `supabase/functions/google-calendar-list-events/index.ts` - Check availability

**Database:**
```sql
CREATE TABLE user_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  provider TEXT DEFAULT 'google',
  access_token TEXT ENCRYPTED,
  refresh_token TEXT ENCRYPTED,
  token_expires_at TIMESTAMPTZ,
  calendar_id TEXT DEFAULT 'primary',
  connected_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New Tools:**
```typescript
{
  name: 'create_calendar_event',
  description: 'Create a calendar appointment for the user',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Event title' },
      start_time: { type: 'string', description: 'Start time (ISO 8601 or natural language)' },
      duration_minutes: { type: 'number', description: 'Duration in minutes' },
      description: { type: 'string', description: 'Event description' },
      location: { type: 'string', description: 'Event location (optional)' }
    },
    required: ['title', 'start_time']
  }
},
{
  name: 'check_calendar_availability',
  description: 'Check if the user is free at a specific time',
  parameters: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'Date to check (YYYY-MM-DD)' },
      time_range_start: { type: 'string', description: 'Start of range (HH:MM)' },
      time_range_end: { type: 'string', description: 'End of range (HH:MM)' }
    },
    required: ['date']
  }
}
```

**Frontend:** Add Calendar connection UI in Settings.

---

### Phase 3: Proactive Action Recommendations (Priority: MEDIUM)

#### 3.1 Context-Aware Action Suggestions

Enhance the system prompt to include proactive capability awareness:

```typescript
const systemPromptAddition = `
PROACTIVE ACTION CAPABILITIES:
You can proactively suggest and execute actions when contextually appropriate. When you notice opportunities:

1. **Missed Habits**: If user mentions they forgot a habit, offer to send a reminder
   - "I notice you mentioned forgetting to meditate. Would you like me to send you a reminder tomorrow morning?"

2. **Goal Discussions**: When discussing goals, offer to schedule check-ins
   - "This goal sounds important. Want me to schedule a weekly check-in call?"

3. **Accountability Needs**: When user expresses needing motivation, offer proactive outreach
   - "I can call you tomorrow to check on your progress. Would that help?"

4. **Task Extraction**: When user discusses plans, offer to create tasks
   - "I heard several action items. Should I add them to your task list?"

5. **Communication Needs**: When user needs to reach out to someone
   - "Would you like me to draft that email for you?"

Always ASK before executing actions. Frame suggestions naturally in conversation.
`;
```

#### 3.2 Intelligent Action Detection

Add post-processing to detect implicit action requests:

```typescript
const actionPatterns = [
  { pattern: /remind me (to|about|when)/i, action: 'schedule_reminder' },
  { pattern: /send (an )?email/i, action: 'send_email' },
  { pattern: /text (me|them)/i, action: 'send_sms' },
  { pattern: /call me/i, action: 'make_voice_call' },
  { pattern: /schedule|book|set up (a )?(meeting|appointment|call)/i, action: 'create_calendar_event' },
  { pattern: /add (this |that )?(to|as) (a )?task/i, action: 'create_task' },
  { pattern: /mark (it |that |this )?(as )?complete/i, action: 'mark_habit_complete' }
];
```

---

### Phase 4: Extended Communication (Priority: LOW-MEDIUM)

#### 4.1 Send to Others (with User Consent)

**New Tools:**
```typescript
{
  name: 'send_email_to_contact',
  description: 'Send an email to someone on behalf of the user (requires explicit consent)',
  parameters: {
    type: 'object',
    properties: {
      to_email: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body' },
      from_name: { type: 'string', description: 'Sender name to show' }
    },
    required: ['to_email', 'subject', 'body']
  }
}
```

**Safeguards:**
- Always require explicit confirmation
- Include "Sent on behalf of [user] via Visionary AI" footer
- Log all external communications
- Rate limit: Max 5 external emails per day

#### 4.2 SMS to Others (Future Consideration)

Not recommended initially due to:
- Spam/abuse potential
- Regulatory concerns (TCPA)
- Cost implications

If implemented, require:
- Contact must opt-in first
- Explicit per-message confirmation
- Clear attribution to user

---

### Phase 5: Advanced Capabilities (Priority: LOW)

#### 5.1 Smart Scheduling

```typescript
{
  name: 'find_optimal_time',
  description: 'Find the best time for an activity based on user patterns',
  parameters: {
    type: 'object',
    properties: {
      activity_type: { type: 'string', enum: ['habit', 'goal_work', 'reflection', 'exercise'] },
      duration_minutes: { type: 'number' },
      preferred_time_of_day: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'any'] }
    },
    required: ['activity_type']
  }
}
```

#### 5.2 Multi-Step Workflows

```typescript
{
  name: 'create_action_sequence',
  description: 'Create a sequence of automated actions',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      trigger: { type: 'string', enum: ['time', 'habit_complete', 'goal_progress', 'manual'] },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action_type: { type: 'string' },
            delay_minutes: { type: 'number' },
            parameters: { type: 'object' }
          }
        }
      }
    },
    required: ['name', 'trigger', 'actions']
  }
}
```

---

## Recommendations for Additional Capabilities

### High-Value Additions

1. **Document/File Generation**
   - Generate personalized habit tracker PDFs
   - Create goal progress reports
   - Export vision board summaries

2. **Integration Hub**
   - Slack/Teams notifications
   - Notion/Todoist task sync
   - Apple Health/Google Fit data access

3. **Smart Follow-ups**
   - AI-determined optimal check-in times
   - Sentiment-based outreach triggers
   - Streak protection alerts

4. **Team Collaboration**
   - Send updates to accountability partners
   - Schedule team check-ins
   - Share progress with coaches/managers

### User Experience Enhancements

1. **Action History Dashboard**
   - Visual timeline of all AI actions
   - Quick undo/redo capabilities
   - Export action logs

2. **Preference Learning**
   - Learn preferred communication times
   - Adapt message tone over time
   - Remember confirmation preferences

3. **Natural Language Scheduling**
   - "Remind me next Tuesday at 9"
   - "Call me every morning at 7"
   - "Email my coach on Fridays"

---

## Implementation Priority Matrix

| Phase | Feature | Effort | Impact | Priority |
|-------|---------|--------|--------|----------|
| 1.1 | Voice call tool | Low | High | P0 |
| 1.2 | AgentChat function calling | Medium | High | P0 |
| 1.3 | Confirmation flow | Medium | High | P0 |
| 2.1 | Google Calendar OAuth | High | High | P1 |
| 3.1 | Proactive suggestions | Low | Medium | P1 |
| 3.2 | Action pattern detection | Low | Medium | P1 |
| 4.1 | Email to others | Medium | Medium | P2 |
| 5.1 | Smart scheduling | Medium | Medium | P2 |
| 5.2 | Multi-step workflows | High | Medium | P3 |

---

## Security Considerations

1. **Rate Limiting**
   - Max 10 emails/day
   - Max 20 SMS/day
   - Max 5 voice calls/day
   - Configurable per user/team

2. **Content Filtering**
   - Scan outgoing messages for sensitive data
   - Block messages containing PII patterns
   - Flag unusual activity patterns

3. **Audit Compliance**
   - Full action history retention (90+ days)
   - Exportable logs for compliance
   - Admin override capabilities

4. **User Control**
   - Instant disable all actions
   - Granular permission management
   - Clear action attribution

---

## Testing Strategy

1. **Unit Tests**
   - Each tool function
   - Permission checking
   - Rate limiting

2. **Integration Tests**
   - Full conversation → action flow
   - Confirmation workflow
   - External API integrations

3. **E2E Tests**
   - User enables feature → requests action → confirms → action executes
   - Proactive suggestion → user declines → no action

4. **Security Tests**
   - Permission bypass attempts
   - Rate limit enforcement
   - Injection prevention

---

## Success Metrics

1. **Adoption**
   - % users enabling agent actions
   - Actions per user per week
   - Feature retention rate

2. **Effectiveness**
   - Task completion rate after AI creation
   - Habit adherence with reminders
   - Goal progress with check-ins

3. **User Satisfaction**
   - Action accuracy (did AI understand correctly?)
   - Appropriate timing of proactive suggestions
   - NPS for agentic features

---

## Files to Modify/Create

### Modify
- `supabase/functions/voice-coach-session/index.ts` - Add voice call tool + confirmation flow
- `supabase/functions/amie-psychological-coach/index.ts` - Add function calling
- `components/AgentChat.tsx` - Call enhanced function
- `components/settings/AgentSettings.tsx` - Add calendar connection UI

### Create
- `supabase/functions/google-calendar-connect/index.ts`
- `supabase/functions/google-calendar-create-event/index.ts`
- `supabase/migrations/YYYYMMDD_pending_actions.sql`
- `supabase/migrations/YYYYMMDD_calendar_connections.sql`
- `components/settings/CalendarConnectionSettings.tsx`

---

## Conclusion

The Vision AI Coach already has a robust foundation for agentic execution. The primary gaps are:

1. **Voice calls not accessible via conversation** - Quick fix
2. **Text chat lacks function calling** - Medium effort, high impact
3. **Confirmation flow incomplete** - Essential for user trust
4. **Calendar integration via deep links only** - OAuth integration needed

By implementing Phase 1, users will have full agentic capabilities across all communication channels with proper safeguards. Phases 2-5 enhance the experience with calendar integration, proactive suggestions, and advanced workflows.

The architecture is extensible and security-conscious, with granular permissions, audit logging, and rate limiting already in place.
