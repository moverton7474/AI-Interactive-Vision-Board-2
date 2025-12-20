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

---

## 2025 Industry Best Practices Comparison

### Research Sources Analyzed

This plan has been validated against 2025 enterprise AI agent best practices from:
- [ISACA: Safeguarding Enterprise AI - Best Practices for Agentic Workflows](https://www.isaca.org/resources/news-and-trends/industry-news/2025/safeguarding-the-enterprise-ai-evolution-best-practices-for-agentic-ai-workflows)
- [Bain & Company: Will Agentic AI Disrupt SaaS?](https://www.bain.com/insights/will-agentic-ai-disrupt-saas-technology-report-2025/)
- [McKinsey: Deploying Agentic AI with Safety and Security](https://www.mckinsey.com/capabilities/risk-and-resilience/our-insights/deploying-agentic-ai-with-safety-and-security-a-playbook-for-technology-leaders)
- [Microsoft Azure: Agent Factory - Agentic AI Design Patterns](https://azure.microsoft.com/en-us/blog/agent-factory-the-new-era-of-agentic-ai-common-use-cases-and-design-patterns/)
- [LangChain: State of AI Agents Report 2025](https://www.langchain.com/stateofaiagents)
- [Permit.io: Human-in-the-Loop for AI Agents Best Practices](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo)
- [Deloitte: Agentic AI Strategy](https://www.deloitte.com/us/en/insights/topics/technology-management/tech-trends/2026/agentic-ai-strategy.html)
- [Twilio: Enhancing AI Agents with SMS Integration](https://www.twilio.com/en-us/blog/developers/tutorials/integrations/add-sms-capabilities-ai-agent)

---

### Alignment with 2025 Enterprise Standards

| Best Practice | Industry Standard | Our Plan | Status |
|--------------|-------------------|----------|--------|
| **Unique Agent Identity** | Each AI agent should have distinct identity in IAM system | ✅ Service account per edge function | ALIGNED |
| **Credential Rotation** | Short-lived secrets, rotate frequently | ⚠️ Static API keys currently | ENHANCEMENT NEEDED |
| **Action Audit Trail** | Log every agentic action with full payload | ✅ `agent_action_history` table | ALIGNED |
| **Human-in-the-Loop** | Approval checkpoints for sensitive actions | ✅ Planned in Phase 1.3 | ALIGNED |
| **Role-Based Access Control** | RBAC/ABAC for tool permissions | ✅ Per-action toggles in `user_agent_settings` | ALIGNED |
| **Zero Standing Privileges** | Just-in-time access, minimal permissions | ⚠️ Partially implemented | ENHANCEMENT NEEDED |
| **Observability & Tracing** | Trace multi-step reasoning chains | ⚠️ Basic logging only | ENHANCEMENT NEEDED |
| **Confidence-Based Routing** | Route uncertain decisions to humans | ❌ Not implemented | ADD TO PLAN |
| **Risk Categorization** | Categorize actions by risk level | ⚠️ Implicit via `require_confirmation_*` | ENHANCEMENT NEEDED |
| **Rate Limiting** | Prevent abuse via action limits | ✅ Planned, needs implementation | ALIGNED |
| **Quiet Hours Enforcement** | Respect user time preferences | ✅ Already implemented | ALIGNED |
| **Multi-Agent Orchestration** | Specialized agents for different tasks | ❌ Single agent model | FUTURE CONSIDERATION |
| **Feedback Loop Learning** | Learn from user corrections | ❌ Not implemented | ADD TO PLAN |

---

### Critical Gaps vs. Industry Standards (NEW ITEMS)

Based on 2025 research, the following should be added to the plan:

#### 1. Confidence-Based Routing (HIGH PRIORITY)

**Industry Standard:** "Agents should defer to humans when confidence falls below threshold."

**Enhancement:**
```typescript
// Add to executeAgentTool()
const confidenceThreshold = 0.7;

if (aiSettings?.require_high_confidence && toolResult.confidence < confidenceThreshold) {
  return {
    success: false,
    needs_confirmation: true,
    message: `I'm ${Math.round(toolResult.confidence * 100)}% confident about this action. Should I proceed?`,
    pending_action_id: await createPendingAction(...)
  };
}
```

**Database Addition:**
```sql
ALTER TABLE agent_action_history ADD COLUMN confidence_score DECIMAL(3,2);
ALTER TABLE user_agent_settings ADD COLUMN require_high_confidence BOOLEAN DEFAULT false;
ALTER TABLE user_agent_settings ADD COLUMN confidence_threshold DECIMAL(3,2) DEFAULT 0.7;
```

#### 2. Observability & LangSmith-Style Tracing (MEDIUM PRIORITY)

**Industry Standard:** "89% of organizations have implemented observability for agents. 62% have detailed tracing."

**Enhancement:** Create an `agent_execution_traces` table:
```sql
CREATE TABLE agent_execution_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  user_id UUID REFERENCES auth.users(id),
  trace_type TEXT CHECK (trace_type IN ('llm_call', 'tool_call', 'tool_result', 'decision_point')),
  step_number INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  model_used TEXT,
  tool_name TEXT,
  input_payload JSONB,
  output_payload JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_traces_session ON agent_execution_traces(session_id);
CREATE INDEX idx_traces_created ON agent_execution_traces(created_at DESC);
```

#### 3. Risk-Based Action Categorization (HIGH PRIORITY)

**Industry Standard:** "Categorize actions by risk level; automate low-risk, require approval for high-risk."

**Enhancement:**
```typescript
const ACTION_RISK_LEVELS = {
  // LOW RISK - Auto-execute
  'get_user_data': 'low',
  'get_todays_habits': 'low',
  'create_task': 'low',

  // MEDIUM RISK - Configurable confirmation
  'mark_habit_complete': 'medium',
  'update_goal_progress': 'medium',
  'schedule_reminder': 'medium',

  // HIGH RISK - Always confirm (unless explicitly disabled)
  'send_email': 'high',
  'send_sms': 'high',
  'make_voice_call': 'high',
  'send_email_to_contact': 'critical'
};
```

**Database Addition:**
```sql
ALTER TABLE user_agent_settings ADD COLUMN auto_approve_low_risk BOOLEAN DEFAULT true;
ALTER TABLE user_agent_settings ADD COLUMN auto_approve_medium_risk BOOLEAN DEFAULT false;
```

#### 4. Feedback Loop for Continuous Improvement (MEDIUM PRIORITY)

**Industry Standard:** "Every approval, rejection, or correction becomes training data."

**Enhancement:**
```sql
CREATE TABLE agent_action_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_history_id UUID REFERENCES agent_action_history(id),
  user_id UUID REFERENCES auth.users(id),
  feedback_type TEXT CHECK (feedback_type IN ('approved', 'rejected', 'edited', 'reported')),
  original_payload JSONB,
  edited_payload JSONB, -- If user modified the action
  rejection_reason TEXT,
  time_to_decision_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Use this data to:
-- 1. Fine-tune prompts for common rejections
-- 2. Adjust confidence thresholds
-- 3. Identify problematic action patterns
```

#### 5. Agent Identity Management (MEDIUM PRIORITY)

**Industry Standard:** "Each AI agent should have a distinct identity, separate service accounts."

**Enhancement:** Already partially implemented via Supabase service role, but could be improved:
- Create distinct function-specific service accounts
- Implement credential rotation schedule
- Add IP allowlisting for agent requests

---

### Twilio Integration Best Practices (Validated)

Our plan aligns with [Twilio's 2025 AI Agent Integration Guidelines](https://www.twilio.com/en-us/blog/developers/tutorials/integrations/add-sms-capabilities-ai-agent):

| Twilio Best Practice | Our Implementation | Status |
|---------------------|-------------------|--------|
| Use ConversationRelay for voice | ✅ Direct Twilio Voice API | ALIGNED |
| Middleware for channel abstraction | ✅ Separate edge functions per channel | ALIGNED |
| Status callbacks for tracking | ✅ Action history logging | ALIGNED |
| Handoff to human agents | ⚠️ Not implemented | FUTURE |
| Multi-channel context persistence | ⚠️ Per-channel only | ENHANCEMENT NEEDED |

---

### Google Calendar Integration Best Practices (Validated)

Based on [Google's OAuth 2.0 Guidelines](https://developers.google.com/identity/protocols/oauth2) and community implementations:

| Best Practice | Planned Implementation | Status |
|--------------|----------------------|--------|
| Incremental scope requests | ✅ Request calendar scope only when needed | ALIGNED |
| Refresh token management | ✅ Planned with `token_expires_at` | ALIGNED |
| Short-lived access tokens | ✅ Refresh flow planned | ALIGNED |
| Secure token storage | ⚠️ Need encryption at rest | ENHANCEMENT NEEDED |
| Conflict detection | ✅ `check_calendar_availability` tool | ALIGNED |

**Security Enhancement Needed:**
```sql
-- Use Supabase Vault for token encryption
ALTER TABLE user_calendar_connections
  ALTER COLUMN access_token TYPE TEXT USING pgp_sym_encrypt(access_token, current_setting('app.jwt_secret')),
  ALTER COLUMN refresh_token TYPE TEXT USING pgp_sym_encrypt(refresh_token, current_setting('app.jwt_secret'));
```

---

## Compatibility Analysis: No Breaking Changes

### Frontend Compatibility ✅

| Component | Current State | Proposed Change | Breaking? |
|-----------|--------------|-----------------|-----------|
| `AgentChat.tsx` | Calls `amie-psychological-coach` | Add optional action handling in response | NO - Additive |
| `VoiceCoach.tsx` | Already handles function call responses | No change needed | NO |
| `AgentSettings.tsx` | Settings UI complete | Add calendar connection section | NO - Additive |
| `ActionPlanAgent.tsx` | Uses deep links | Could add direct calendar integration | NO - Optional |

**Why No Breaking Changes:**
1. All enhancements are **additive** - new fields, new tools
2. Existing response format preserved - `{ success, response }` unchanged
3. Frontend can gracefully handle new fields (actions, pending_action_id) if present
4. Settings additions use new DB columns with defaults

### Backend Compatibility ✅

| Function | Current State | Proposed Change | Breaking? |
|----------|--------------|-----------------|-----------|
| `amie-psychological-coach` | No function calling | Add optional tools parameter | NO - Backward compatible |
| `voice-coach-session` | Has function calling | Add new tools to existing array | NO - Additive |
| `agent-send-sms` | Working | No change | NO |
| `agent-voice-call` | Working | No change | NO |
| `send-email` | Working | No change | NO |

**Why No Breaking Changes:**
1. New tools are **additive** to `getGeminiTools()` array
2. New `executeAgentTool()` cases use `default` fallback for unknown tools
3. Database migrations use `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`
4. New tables don't affect existing tables

### Database Compatibility ✅

| Table | Proposed Change | Migration Strategy |
|-------|-----------------|-------------------|
| `user_agent_settings` | Add new columns | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... DEFAULT` |
| `agent_action_history` | Add `confidence_score` | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` |
| NEW: `pending_agent_actions` | Create table | `CREATE TABLE IF NOT EXISTS` |
| NEW: `user_calendar_connections` | Create table | `CREATE TABLE IF NOT EXISTS` |
| NEW: `agent_execution_traces` | Create table | `CREATE TABLE IF NOT EXISTS` |
| NEW: `agent_action_feedback` | Create table | `CREATE TABLE IF NOT EXISTS` |

**Safe Migration Pattern:**
```sql
-- All migrations use this pattern:
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_agent_settings' AND column_name = 'confidence_threshold')
  THEN
    ALTER TABLE user_agent_settings ADD COLUMN confidence_threshold DECIMAL(3,2) DEFAULT 0.7;
  END IF;
END $$;
```

---

## Enhanced Implementation Plan (Incorporating 2025 Best Practices)

### Updated Phase 1: Core Agentic Execution + Industry Standards

#### 1.1 Voice Call Tool *(unchanged)*
#### 1.2 AgentChat Function Calling *(unchanged)*
#### 1.3 Human-in-the-Loop Confirmation Flow *(enhanced)*

**Enhancement:** Add confidence-based routing:
```typescript
async function executeWithConfirmation(
  supabase: any,
  userId: string,
  toolName: string,
  args: any,
  aiSettings: any,
  confidence?: number
): Promise<any> {
  const riskLevel = ACTION_RISK_LEVELS[toolName] || 'medium';

  // Check if auto-approve based on risk level
  const shouldAutoApprove =
    (riskLevel === 'low' && aiSettings.auto_approve_low_risk) ||
    (riskLevel === 'medium' && aiSettings.auto_approve_medium_risk);

  // Check confidence threshold
  const meetsConfidenceThreshold =
    !aiSettings.require_high_confidence ||
    (confidence && confidence >= aiSettings.confidence_threshold);

  // Determine if confirmation needed
  const needsConfirmation = !shouldAutoApprove || !meetsConfidenceThreshold;

  if (needsConfirmation) {
    // Create pending action and return for user confirmation
    const pendingAction = await createPendingAction(supabase, userId, toolName, args, confidence);
    return {
      success: false,
      needs_confirmation: true,
      pending_action_id: pendingAction.id,
      message: generateConfirmationMessage(toolName, args, confidence)
    };
  }

  // Execute immediately
  return await executeAgentTool(supabase, userId, toolName, args, aiSettings);
}
```

#### 1.4 Observability Tracing *(NEW)*

Add execution tracing to all tool calls:
```typescript
async function traceExecution(
  supabase: any,
  sessionId: string,
  traceType: string,
  payload: any
): Promise<void> {
  await supabase.from('agent_execution_traces').insert({
    session_id: sessionId,
    trace_type: traceType,
    input_payload: payload.input,
    output_payload: payload.output,
    latency_ms: payload.latency,
    model_used: payload.model,
    tool_name: payload.tool,
    created_at: new Date().toISOString()
  });
}
```

---

## Updated Priority Matrix (With Industry Best Practices)

| Phase | Feature | Effort | Impact | Industry Alignment | Priority |
|-------|---------|--------|--------|-------------------|----------|
| 1.1 | Voice call tool | Low | High | ✅ | P0 |
| 1.2 | AgentChat function calling | Medium | High | ✅ | P0 |
| 1.3 | HITL confirmation flow | Medium | High | ✅ Critical | P0 |
| **1.4** | **Confidence-based routing** | Low | High | ✅ Critical | **P0** |
| **1.5** | **Risk-based categorization** | Low | High | ✅ Critical | **P0** |
| 2.1 | Google Calendar OAuth | High | High | ✅ | P1 |
| **2.2** | **Execution tracing/observability** | Medium | Medium | ✅ Critical | **P1** |
| 3.1 | Proactive suggestions | Low | Medium | ✅ | P1 |
| **3.2** | **Feedback loop capture** | Low | Medium | ✅ | **P1** |
| 4.1 | Email to others | Medium | Medium | ✅ | P2 |
| 5.1 | Smart scheduling | Medium | Medium | ✅ | P2 |
| 5.2 | Multi-step workflows | High | Medium | ✅ | P3 |

---

---

## User & Admin Management Implementation Plan

This section details how new agentic features will be managed through both **user-level settings** (individual user control) and **admin-level settings** (team/organization control).

### Existing Management Infrastructure

#### User Settings Dashboard (`components/settings/AgentSettings.tsx`)

**Currently Manages:**
| Setting Category | Fields | Status |
|-----------------|--------|--------|
| Master Control | `agent_actions_enabled` | ✅ Implemented |
| Action Permissions | `allow_send_email`, `allow_send_sms`, `allow_voice_calls`, `allow_create_tasks`, `allow_schedule_reminders` | ✅ Implemented |
| Confirmation Requirements | `require_confirmation_email`, `require_confirmation_sms`, `require_confirmation_voice` | ✅ Implemented |
| Habit Reminders | `habit_reminders_enabled`, `habit_reminder_channel`, `habit_reminder_timing`, `habit_reminder_minutes_before` | ✅ Implemented |
| Goal Check-ins | `goal_checkins_enabled`, `goal_checkin_frequency`, `goal_checkin_channel`, `goal_checkin_day_of_week`, `goal_checkin_time` | ✅ Implemented |
| Proactive Outreach | `allow_proactive_outreach`, `proactive_outreach_frequency`, `proactive_topics` | ✅ Implemented |
| Action History | Read-only list of recent actions | ✅ Implemented |

#### Admin Settings Dashboard (`components/admin/AICoachSettings.tsx`)

**Currently Manages:**
| Setting Category | Fields | Status |
|-----------------|--------|--------|
| Coach Personality | `coach_name`, `coach_tone`, `custom_instructions` | ✅ Implemented |
| Topic Guardrails | `blocked_topics[]` | ✅ Implemented |
| Safety Controls | `enable_sentiment_alerts`, `sentiment_alert_threshold`, `enable_crisis_detection`, `crisis_escalation_email`, `crisis_keywords[]` | ✅ Implemented |
| Session Limits | `max_session_duration_minutes`, `max_sessions_per_day`, `cooldown_between_sessions_minutes` | ✅ Implemented |
| Agentic Capabilities | `allow_send_email`, `allow_create_tasks`, `allow_schedule_reminders`, `allow_access_user_data`, `require_confirmation` | ✅ Implemented |
| Voice Settings | `default_voice`, `default_voice_speed` | ✅ Implemented |

---

### Phase 1 UI Additions: User Settings

#### 1.1 Confidence & Trust Settings (NEW CARD)

**Location:** `components/settings/AgentSettings.tsx`

**New UI Section:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 AI Confidence Settings                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ☑ Require high confidence before actions                        │
│   Only execute when AI is highly confident                      │
│                                                                 │
│ Confidence Threshold: [=====●=======] 70%                       │
│   Slider: 50% ────────────────────── 95%                        │
│                                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│ Risk-Based Auto-Approval                                        │
│                                                                 │
│ ☑ Auto-approve LOW risk actions                                 │
│   (View data, create tasks)                                     │
│                                                                 │
│ ☐ Auto-approve MEDIUM risk actions                              │
│   (Mark habits complete, update progress)                       │
│                                                                 │
│ ⚠️ HIGH risk actions always require confirmation                │
│   (Emails, SMS, Voice calls)                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Database Fields:**
```sql
-- Add to user_agent_settings
require_high_confidence BOOLEAN DEFAULT false,
confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
auto_approve_low_risk BOOLEAN DEFAULT true,
auto_approve_medium_risk BOOLEAN DEFAULT false
```

#### 1.2 Action History Enhancement (ENHANCE EXISTING)

**Current:** Simple list of recent actions
**Enhanced:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Agent Action History                              [Export]   │
├─────────────────────────────────────────────────────────────────┤
│ Filter: [All ▼]  [Last 7 days ▼]  [🔍 Search...]               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📧 Send Email                                  ✅ Executed      │
│    To: john@example.com | Subject: Weekly Progress              │
│    Dec 19, 2025 at 2:30 PM | Confidence: 92%                   │
│    [View Details] [👍] [👎]                                     │
│                                                                 │
│ 💬 Send SMS                                    ⏳ Pending       │
│    Habit reminder for "Morning Meditation"                      │
│    Dec 19, 2025 at 9:00 AM | Confidence: 78%                   │
│    [Approve] [Reject] [Edit & Send]                            │
│                                                                 │
│ 📞 Voice Call                                  ❌ Cancelled     │
│    Goal check-in call                                          │
│    Dec 18, 2025 at 4:00 PM | Reason: User declined             │
│    [View Details]                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**New Features:**
- Filtering by action type, status, date range
- Export to CSV/JSON
- Inline feedback buttons (👍/👎) for executed actions
- Edit capability for pending actions
- Confidence score display

#### 1.3 Calendar Connection (Phase 2)

**New UI Section:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📅 Calendar Integration                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Connect your calendar to let AI schedule events for you.       │
│                                                                 │
│ Google Calendar                          [🔗 Connect]          │
│   Status: Not connected                                         │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ When connected, AI Coach can:                                   │
│ • Check your availability before suggesting times               │
│ • Create goal check-in appointments                             │
│ • Schedule habit time blocks                                    │
│ • Set reminders for important deadlines                        │
│                                                                 │
│ ☑ Require confirmation before creating events                   │
│ ☑ Only schedule during working hours (9am-6pm)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 1 UI Additions: Admin Settings

#### 2.1 Team-Wide Confidence Overrides (NEW CARD)

**Location:** `components/admin/AICoachSettings.tsx`

**New UI Section:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 AI Confidence & Risk Policies                    [Team]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Minimum Confidence Threshold                                    │
│ [=====●===========] 60%                                         │
│ Users cannot set their threshold below this value              │
│                                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│ Risk Level Policies                                             │
│                                                                 │
│ ☑ Allow users to auto-approve LOW risk actions                 │
│ ☐ Allow users to auto-approve MEDIUM risk actions              │
│ ☐ Allow users to auto-approve HIGH risk actions                │
│   (Not recommended - security risk)                            │
│                                                                 │
│ ⚠️ CRITICAL risk actions (send to external contacts)           │
│   always require admin approval                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Database Fields (team_ai_settings):**
```sql
-- Add to team_ai_settings
min_confidence_threshold DECIMAL(3,2) DEFAULT 0.5,
allow_user_auto_approve_low BOOLEAN DEFAULT true,
allow_user_auto_approve_medium BOOLEAN DEFAULT false,
allow_user_auto_approve_high BOOLEAN DEFAULT false,
require_admin_approval_critical BOOLEAN DEFAULT true
```

#### 2.2 Team Action Monitoring Dashboard (NEW TAB)

**New Admin Tab: "Agent Activity"**

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Team Agent Activity                              [Export]    │
├─────────────────────────────────────────────────────────────────┤
│ Time Range: [Last 7 days ▼]  Team: [All Members ▼]             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Summary                                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │   156    │ │   142    │ │    8     │ │    6     │            │
│ │ Actions  │ │ Approved │ │ Rejected │ │  Failed  │            │
│ │ Requested│ │ (91%)    │ │  (5%)    │ │  (4%)    │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│ By Action Type                      By User                     │
│ ├─ 📧 Email: 45 (29%)               ├─ John D.: 34 actions     │
│ ├─ 📝 Tasks: 52 (33%)               ├─ Sarah M.: 28 actions    │
│ ├─ ⏰ Reminders: 38 (24%)           ├─ Mike L.: 22 actions     │
│ ├─ 💬 SMS: 15 (10%)                 └─ [View All...]           │
│ └─ 📞 Calls: 6 (4%)                                            │
│                                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│ Recent Activity Feed                        [🔄 Auto-refresh]   │
│                                                                 │
│ 2:45 PM  John D. ► Email sent (Confirmed)                      │
│ 2:30 PM  Sarah M. ► Task created (Auto-approved)               │
│ 2:15 PM  Mike L. ► SMS rejected by user                        │
│ 1:58 PM  John D. ► Voice call failed (quiet hours)             │
│ [Load more...]                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3 Observability Dashboard (NEW TAB - Phase 2)

**New Admin Tab: "AI Observability"**

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 AI Agent Observability                                       │
├─────────────────────────────────────────────────────────────────┤
│ Session: [Select session ▼]  User: [All ▼]  Date: [Today ▼]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Performance Metrics                                             │
│ ┌───────────────────┐ ┌───────────────────┐                    │
│ │ Avg Response Time │ │ Token Usage Today │                    │
│ │     1.2s          │ │    45,230 tokens  │                    │
│ │ ↓ 15% from avg    │ │ $0.45 estimated   │                    │
│ └───────────────────┘ └───────────────────┘                    │
│                                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│ Session Trace: session_abc123                                   │
│                                                                 │
│ ┌─ Step 1: LLM Call (450ms)                                    │
│ │  Model: gemini-2.0-flash-exp                                 │
│ │  Input: 1,245 tokens | Output: 312 tokens                    │
│ │  [Expand to see full prompt/response]                        │
│ │                                                               │
│ ├─ Step 2: Tool Call - get_user_data (89ms)                    │
│ │  Status: ✅ Success                                           │
│ │  [View payload]                                               │
│ │                                                               │
│ ├─ Step 3: Tool Call - send_email (pending)                    │
│ │  Status: ⏳ Awaiting confirmation                             │
│ │  Confidence: 78%                                              │
│ │  [View payload] [Force approve] [Force reject]                │
│ │                                                               │
│ └─ Step 4: LLM Call (380ms)                                    │
│    Generating confirmation message...                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.4 Feedback Analytics (NEW TAB - Phase 3)

**New Admin Tab: "Feedback & Learning"**

```
┌─────────────────────────────────────────────────────────────────┐
│ 📈 Agent Feedback Analytics                                     │
├─────────────────────────────────────────────────────────────────┤
│ Time Range: [Last 30 days ▼]                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ User Satisfaction                                               │
│                                                                 │
│ Overall Approval Rate: ████████████░░░░ 78%                    │
│                                                                 │
│ By Action Type:                                                 │
│ Email     ████████████████░░ 89% approved                      │
│ Tasks     ████████████████░░ 92% approved                      │
│ Reminders ██████████████░░░░ 85% approved                      │
│ SMS       ████████████░░░░░░ 71% approved                      │
│ Calls     ████████░░░░░░░░░░ 52% approved                      │
│                                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│ Common Rejection Reasons                                        │
│                                                                 │
│ 1. "Wrong recipient" - 23 occurrences                          │
│    → Consider: Add recipient confirmation step                  │
│                                                                 │
│ 2. "Message too formal" - 18 occurrences                       │
│    → Consider: Adjust coach tone for emails                     │
│                                                                 │
│ 3. "Wrong time" - 12 occurrences                               │
│    → Consider: Better quiet hours detection                     │
│                                                                 │
│ [Export Feedback Data]                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Database Schema Additions for Management Features

```sql
-- =====================================================
-- Phase 1: User-Level Management Schema Additions
-- =====================================================

-- Add confidence and risk settings to user_agent_settings
ALTER TABLE user_agent_settings ADD COLUMN IF NOT EXISTS
  require_high_confidence BOOLEAN DEFAULT false;

ALTER TABLE user_agent_settings ADD COLUMN IF NOT EXISTS
  confidence_threshold DECIMAL(3,2) DEFAULT 0.7;

ALTER TABLE user_agent_settings ADD COLUMN IF NOT EXISTS
  auto_approve_low_risk BOOLEAN DEFAULT true;

ALTER TABLE user_agent_settings ADD COLUMN IF NOT EXISTS
  auto_approve_medium_risk BOOLEAN DEFAULT false;

-- Add confidence score to action history
ALTER TABLE agent_action_history ADD COLUMN IF NOT EXISTS
  confidence_score DECIMAL(3,2);

-- =====================================================
-- Phase 1: Admin-Level Management Schema Additions
-- =====================================================

-- Add team-wide confidence policies to team_ai_settings
ALTER TABLE team_ai_settings ADD COLUMN IF NOT EXISTS
  min_confidence_threshold DECIMAL(3,2) DEFAULT 0.5;

ALTER TABLE team_ai_settings ADD COLUMN IF NOT EXISTS
  allow_user_auto_approve_low BOOLEAN DEFAULT true;

ALTER TABLE team_ai_settings ADD COLUMN IF NOT EXISTS
  allow_user_auto_approve_medium BOOLEAN DEFAULT false;

ALTER TABLE team_ai_settings ADD COLUMN IF NOT EXISTS
  allow_user_auto_approve_high BOOLEAN DEFAULT false;

ALTER TABLE team_ai_settings ADD COLUMN IF NOT EXISTS
  require_admin_approval_critical BOOLEAN DEFAULT true;

-- Allow SMS and voice at team level
ALTER TABLE team_ai_settings ADD COLUMN IF NOT EXISTS
  allow_send_sms BOOLEAN DEFAULT false;

ALTER TABLE team_ai_settings ADD COLUMN IF NOT EXISTS
  allow_voice_calls BOOLEAN DEFAULT false;

-- =====================================================
-- Phase 2: Observability Schema
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_execution_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  user_id UUID REFERENCES auth.users(id),
  team_id UUID, -- For admin filtering
  trace_type TEXT CHECK (trace_type IN ('llm_call', 'tool_call', 'tool_result', 'decision_point')),
  step_number INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  model_used TEXT,
  tool_name TEXT,
  input_payload JSONB,
  output_payload JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_traces_team_id ON agent_execution_traces(team_id);
CREATE INDEX IF NOT EXISTS idx_traces_created_at ON agent_execution_traces(created_at DESC);

-- RLS for admin access
ALTER TABLE agent_execution_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own traces" ON agent_execution_traces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view team traces" ON agent_execution_traces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
      AND team_members.team_id = agent_execution_traces.team_id
      AND team_members.role IN ('admin', 'owner')
    )
  );

-- =====================================================
-- Phase 3: Feedback Schema
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_action_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_history_id UUID REFERENCES agent_action_history(id),
  user_id UUID REFERENCES auth.users(id),
  team_id UUID, -- For admin analytics
  feedback_type TEXT CHECK (feedback_type IN ('approved', 'rejected', 'edited', 'reported', 'thumbs_up', 'thumbs_down')),
  original_payload JSONB,
  edited_payload JSONB,
  rejection_reason TEXT,
  feedback_text TEXT, -- Free-form user feedback
  time_to_decision_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_feedback_team_id ON agent_action_feedback(team_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON agent_action_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON agent_action_feedback(created_at DESC);

-- RLS
ALTER TABLE agent_action_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feedback" ON agent_action_feedback
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view team feedback" ON agent_action_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
      AND team_members.team_id = agent_action_feedback.team_id
      AND team_members.role IN ('admin', 'owner')
    )
  );
```

---

### UI Component Files to Create/Modify

| Component | Type | Purpose | Phase |
|-----------|------|---------|-------|
| `AgentSettings.tsx` | MODIFY | Add confidence settings card, enhance action history | Phase 1 |
| `AgentSettings/ConfidenceSettings.tsx` | CREATE | Confidence & risk auto-approval UI | Phase 1 |
| `AgentSettings/ActionHistoryEnhanced.tsx` | CREATE | Filterable, exportable action history with feedback | Phase 1 |
| `AgentSettings/CalendarConnection.tsx` | CREATE | Google Calendar OAuth flow UI | Phase 2 |
| `AICoachSettings.tsx` | MODIFY | Add confidence policies card | Phase 1 |
| `admin/AgentActivityDashboard.tsx` | CREATE | Team action monitoring dashboard | Phase 1 |
| `admin/AgentObservability.tsx` | CREATE | Session traces, performance metrics | Phase 2 |
| `admin/AgentFeedbackAnalytics.tsx` | CREATE | Feedback aggregation, insights | Phase 3 |

---

### Permission Inheritance Model

The system follows a hierarchical permission model:

```
┌─────────────────────────────────────────────────────────────────┐
│                     PLATFORM DEFAULTS                           │
│  (Set in code, cannot be changed by anyone)                    │
│  • CRITICAL actions always need confirmation                    │
│  • Rate limits enforced                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   TEAM/ADMIN SETTINGS                           │
│  (Set by team admins in AICoachSettings)                       │
│  • Can RESTRICT user options                                    │
│  • Cannot EXPAND beyond platform defaults                       │
│  Example: "Users cannot auto-approve medium risk"               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    USER SETTINGS                                │
│  (Set by individual users in AgentSettings)                    │
│  • Can only enable options allowed by team                      │
│  • More restrictive = always allowed                            │
│  Example: "I want confirmation on ALL actions"                  │
└─────────────────────────────────────────────────────────────────┘
```

**Enforcement Logic:**
```typescript
function getEffectiveSettings(userSettings: UserSettings, teamSettings: TeamSettings): EffectiveSettings {
  return {
    // Confidence: User's threshold, but not below team minimum
    confidence_threshold: Math.max(
      userSettings.confidence_threshold,
      teamSettings.min_confidence_threshold
    ),

    // Auto-approve: Only if both team and user allow
    auto_approve_low_risk:
      teamSettings.allow_user_auto_approve_low &&
      userSettings.auto_approve_low_risk,

    auto_approve_medium_risk:
      teamSettings.allow_user_auto_approve_medium &&
      userSettings.auto_approve_medium_risk,

    // Actions: Must be enabled at both levels
    allow_send_email:
      teamSettings.allow_send_email &&
      userSettings.allow_send_email,

    // ... etc
  };
}
```

---

## Technical Integration Requirements

This section ensures seamless integration with existing codebase patterns, type safety, and operational excellence.

### 1. TypeScript Type Definitions

**Add to `types.ts`:**

```typescript
// ============================================
// PHASE 1: AGENTIC EXECUTION TYPES
// ============================================

// Risk Levels
export type AgentActionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const ACTION_RISK_LEVELS: Record<AgentActionType, AgentActionRiskLevel> = {
  'get_user_data': 'low',
  'create_task': 'low',
  'schedule_reminder': 'medium',
  'mark_habit_complete': 'medium',
  'update_goal_progress': 'medium',
  'send_email': 'high',
  'send_sms': 'high',
  'voice_call': 'high',
  'send_email_to_contact': 'critical',
  'create_calendar_event': 'medium',
};

// Extended User Agent Settings (add to existing interface)
export interface UserAgentSettingsExtended extends UserAgentSettings {
  // Confidence settings
  require_high_confidence: boolean;
  confidence_threshold: number; // 0.5 - 0.95

  // Risk auto-approval
  auto_approve_low_risk: boolean;
  auto_approve_medium_risk: boolean;
}

// Team AI Settings Extensions
export interface TeamAISettingsExtended {
  // Existing fields...

  // Confidence policies
  min_confidence_threshold: number;
  allow_user_auto_approve_low: boolean;
  allow_user_auto_approve_medium: boolean;
  allow_user_auto_approve_high: boolean;
  require_admin_approval_critical: boolean;

  // Channel controls
  allow_send_sms: boolean;
  allow_voice_calls: boolean;
}

// Pending Actions (for confirmation flow)
export type PendingActionStatus = 'pending_confirmation' | 'confirmed' | 'cancelled' | 'expired';

export interface PendingAgentAction {
  id: string;
  user_id: string;
  session_id?: string;
  action_type: AgentActionType;
  action_payload: Record<string, any>;
  status: PendingActionStatus;
  confidence_score?: number;
  risk_level: AgentActionRiskLevel;
  expires_at: string;
  confirmed_at?: string;
  cancelled_at?: string;
  created_at: string;
}

// Execution Traces (for observability)
export type TraceType = 'llm_call' | 'tool_call' | 'tool_result' | 'decision_point';

export interface AgentExecutionTrace {
  id: string;
  session_id?: string;
  user_id: string;
  team_id?: string;
  trace_type: TraceType;
  step_number: number;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms?: number;
  model_used?: string;
  tool_name?: string;
  input_payload?: Record<string, any>;
  output_payload?: Record<string, any>;
  error?: string;
  created_at: string;
}

// Feedback (for continuous improvement)
export type FeedbackType = 'approved' | 'rejected' | 'edited' | 'reported' | 'thumbs_up' | 'thumbs_down';

export interface AgentActionFeedback {
  id: string;
  action_history_id: string;
  user_id: string;
  team_id?: string;
  feedback_type: FeedbackType;
  original_payload?: Record<string, any>;
  edited_payload?: Record<string, any>;
  rejection_reason?: string;
  feedback_text?: string;
  time_to_decision_ms?: number;
  created_at: string;
}

// Calendar Integration
export interface UserCalendarConnection {
  id: string;
  user_id: string;
  provider: 'google' | 'microsoft' | 'apple';
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  calendar_id: string;
  connected_at: string;
  last_synced_at?: string;
}

// Effective Settings (computed from user + team)
export interface EffectiveAgentSettings {
  agent_actions_enabled: boolean;
  allow_send_email: boolean;
  allow_send_sms: boolean;
  allow_voice_calls: boolean;
  allow_create_tasks: boolean;
  allow_schedule_reminders: boolean;
  allow_calendar_access: boolean;
  confidence_threshold: number;
  auto_approve_low_risk: boolean;
  auto_approve_medium_risk: boolean;
  require_confirmation_email: boolean;
  require_confirmation_sms: boolean;
  require_confirmation_voice: boolean;
}

// API Response Types
export interface AgentToolResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  needs_confirmation?: boolean;
  pending_action_id?: string;
  confidence_score?: number;
  message?: string;
}

export interface AgentChatResponse {
  success: boolean;
  response: string;
  session_id?: string;
  actions_taken?: Array<{
    action_type: AgentActionType;
    status: AgentActionStatus;
    action_id: string;
  }>;
  pending_actions?: PendingAgentAction[];
  used_frameworks?: string[];
  error?: string;
}
```

---

### 2. Standardized API Response Format

All edge functions should return consistent response structures:

```typescript
// Success Response
interface SuccessResponse<T> {
  success: true;
  data: T;
  metadata?: {
    timestamp: string;
    request_id: string;
    latency_ms: number;
  };
}

// Error Response
interface ErrorResponse {
  success: false;
  error: {
    code: string;        // e.g., 'PERMISSION_DENIED', 'RATE_LIMITED'
    message: string;     // Human-readable message
    details?: any;       // Additional context
    recoverable: boolean; // Can user retry?
  };
  metadata?: {
    timestamp: string;
    request_id: string;
  };
}

// Error Codes (create as constants)
export const AGENT_ERROR_CODES = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  ACTION_EXPIRED: 'ACTION_EXPIRED',
  QUIET_HOURS: 'QUIET_HOURS',
  INVALID_RECIPIENT: 'INVALID_RECIPIENT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  TEAM_POLICY_BLOCKED: 'TEAM_POLICY_BLOCKED',
} as const;
```

---

### 3. Real-Time Updates (Supabase Realtime)

Enable live UI updates for pending actions and action status changes:

**Frontend Hook:**
```typescript
// hooks/useAgentActions.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PendingAgentAction, AgentActionHistory } from '../types';

export function useAgentActions(userId: string) {
  const [pendingActions, setPendingActions] = useState<PendingAgentAction[]>([]);
  const [recentActions, setRecentActions] = useState<AgentActionHistory[]>([]);

  useEffect(() => {
    // Initial fetch
    fetchPendingActions();
    fetchRecentActions();

    // Subscribe to pending actions changes
    const pendingChannel = supabase
      .channel('pending-actions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_agent_actions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPendingActions(prev => [payload.new as PendingAgentAction, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setPendingActions(prev =>
              prev.map(a => a.id === payload.new.id ? payload.new as PendingAgentAction : a)
            );
          } else if (payload.eventType === 'DELETE') {
            setPendingActions(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Subscribe to action history changes
    const historyChannel = supabase
      .channel('action-history')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_action_history',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setRecentActions(prev => [payload.new as AgentActionHistory, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pendingChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [userId]);

  return { pendingActions, recentActions, refetch: fetchPendingActions };
}
```

**Database Requirement:**
```sql
-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE pending_agent_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_action_history;
```

---

### 4. Feature Flags for Gradual Rollout

Implement feature flags for controlled deployment:

```typescript
// lib/featureFlags.ts
export interface FeatureFlags {
  // Phase 1
  agent_confidence_routing: boolean;
  agent_risk_categorization: boolean;
  agent_text_chat_tools: boolean;
  agent_voice_call_tool: boolean;

  // Phase 2
  calendar_integration: boolean;
  execution_tracing: boolean;

  // Phase 3
  feedback_collection: boolean;
  proactive_suggestions: boolean;
}

// Database table for feature flags
// CREATE TABLE feature_flags (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   flag_name TEXT UNIQUE NOT NULL,
//   enabled_globally BOOLEAN DEFAULT false,
//   enabled_for_teams UUID[] DEFAULT '{}',
//   enabled_for_users UUID[] DEFAULT '{}',
//   rollout_percentage INTEGER DEFAULT 0, -- 0-100
//   created_at TIMESTAMPTZ DEFAULT NOW(),
//   updated_at TIMESTAMPTZ DEFAULT NOW()
// );

export async function isFeatureEnabled(
  supabase: any,
  flagName: string,
  userId?: string,
  teamId?: string
): Promise<boolean> {
  const { data: flag } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('flag_name', flagName)
    .single();

  if (!flag) return false;

  // Check hierarchy: global → team → user → percentage
  if (flag.enabled_globally) return true;
  if (teamId && flag.enabled_for_teams?.includes(teamId)) return true;
  if (userId && flag.enabled_for_users?.includes(userId)) return true;

  // Rollout percentage (deterministic based on user ID)
  if (flag.rollout_percentage > 0 && userId) {
    const hash = hashUserId(userId);
    return (hash % 100) < flag.rollout_percentage;
  }

  return false;
}
```

---

### 5. Environment Variables Required

**Add to `.env.local` and Supabase secrets:**

```bash
# Phase 1 - Already configured (verify)
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=xxx
RESEND_API_KEY=xxx
GEMINI_API_KEY=xxx

# Phase 2 - Google Calendar OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_OAUTH_REDIRECT_URI=https://yourapp.com/api/auth/google/callback

# Phase 2 - Observability (optional but recommended)
LANGSMITH_API_KEY=xxx  # If using LangSmith for tracing
SENTRY_DSN=xxx         # Error tracking

# Feature Flags
FEATURE_FLAGS_ENABLED=true
```

---

### 6. Migration Order & Dependencies

Execute migrations in this order to avoid foreign key issues:

```
Phase 1 Migrations (run in order):
├── 01_feature_flags.sql              # Feature flag table
├── 02_user_agent_settings_extend.sql # Add confidence/risk columns
├── 03_team_ai_settings_extend.sql    # Add team policy columns
├── 04_pending_agent_actions.sql      # Confirmation flow table
├── 05_agent_action_history_extend.sql # Add confidence_score column
└── 06_realtime_publications.sql      # Enable realtime

Phase 2 Migrations:
├── 07_user_calendar_connections.sql  # Calendar OAuth tokens
├── 08_agent_execution_traces.sql     # Observability table
└── 09_agent_action_feedback.sql      # Feedback table

Deployment Order:
1. Run database migrations
2. Deploy edge functions (no breaking changes)
3. Deploy frontend with feature flags OFF
4. Enable feature flags for internal team
5. Gradual rollout via percentage
6. Full release
```

---

### 7. Error Handling Patterns

**Backend (Edge Functions):**
```typescript
// lib/agentErrors.ts
export class AgentError extends Error {
  constructor(
    public code: string,
    message: string,
    public recoverable: boolean = true,
    public details?: any
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

// Usage in edge functions
export function handleAgentError(error: any): Response {
  const isAgentError = error instanceof AgentError;

  const response = {
    success: false,
    error: {
      code: isAgentError ? error.code : 'INTERNAL_ERROR',
      message: isAgentError ? error.message : 'An unexpected error occurred',
      recoverable: isAgentError ? error.recoverable : false,
      details: isAgentError ? error.details : undefined,
    },
    metadata: {
      timestamp: new Date().toISOString(),
    }
  };

  // Log for observability
  console.error('Agent Error:', JSON.stringify(response));

  return new Response(JSON.stringify(response), {
    status: isAgentError ? 400 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

**Frontend (React):**
```typescript
// hooks/useAgentAction.ts
export function useAgentAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AgentError | null>(null);

  const executeAction = async (
    actionFn: () => Promise<any>,
    options?: {
      optimisticUpdate?: () => void;
      rollback?: () => void;
    }
  ) => {
    setLoading(true);
    setError(null);

    // Optimistic update
    if (options?.optimisticUpdate) {
      options.optimisticUpdate();
    }

    try {
      const result = await actionFn();

      if (!result.success) {
        throw new AgentError(
          result.error.code,
          result.error.message,
          result.error.recoverable
        );
      }

      return result;
    } catch (err: any) {
      // Rollback optimistic update
      if (options?.rollback) {
        options.rollback();
      }

      const agentError = err instanceof AgentError
        ? err
        : new AgentError('UNKNOWN', err.message, false);

      setError(agentError);

      // Show user-friendly toast
      toast.error(agentError.message, {
        action: agentError.recoverable
          ? { label: 'Retry', onClick: () => executeAction(actionFn, options) }
          : undefined
      });

      throw agentError;
    } finally {
      setLoading(false);
    }
  };

  return { executeAction, loading, error };
}
```

---

### 8. Loading States & Optimistic Updates

**Component Pattern:**
```tsx
// components/PendingActionCard.tsx
function PendingActionCard({ action }: { action: PendingAgentAction }) {
  const [confirming, setConfirming] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  const handleConfirm = async () => {
    setConfirming(true);
    setOptimisticStatus('confirmed'); // Optimistic update

    try {
      await supabase.functions.invoke('confirm-agent-action', {
        body: { action_id: action.id }
      });
    } catch {
      setOptimisticStatus(null); // Rollback
    } finally {
      setConfirming(false);
    }
  };

  const displayStatus = optimisticStatus || action.status;

  return (
    <div className={`transition-opacity ${confirming ? 'opacity-50' : ''}`}>
      {/* Action details */}
      <button
        onClick={handleConfirm}
        disabled={confirming}
        className="relative"
      >
        {confirming && <Spinner className="absolute inset-0" />}
        <span className={confirming ? 'invisible' : ''}>Confirm</span>
      </button>
    </div>
  );
}
```

---

### 9. Deployment Checklist

```markdown
## Pre-Deployment Checklist

### Database
- [ ] Backup production database
- [ ] Run migrations on staging first
- [ ] Verify RLS policies work correctly
- [ ] Test realtime subscriptions
- [ ] Confirm indexes are created

### Edge Functions
- [ ] All environment variables set in Supabase
- [ ] Functions tested locally with `supabase functions serve`
- [ ] Rate limits configured
- [ ] Error logging verified

### Frontend
- [ ] Feature flags defaulted to OFF
- [ ] Loading states implemented
- [ ] Error boundaries in place
- [ ] Rollback build ready
- [ ] Analytics/monitoring configured

### Integration Testing
- [ ] Confirmation flow tested end-to-end
- [ ] Quiet hours enforcement verified
- [ ] Team policy overrides working
- [ ] Rate limiting tested
- [ ] Multi-session behavior verified

### Rollback Plan
- [ ] Previous function versions tagged
- [ ] Database rollback scripts ready
- [ ] Feature flag kill switch documented
```

---

### 10. Rollback Strategy

```typescript
// Emergency Rollback Procedures

// 1. Disable all new features instantly via feature flags
await supabase.from('feature_flags')
  .update({ enabled_globally: false, rollout_percentage: 0 })
  .in('flag_name', [
    'agent_confidence_routing',
    'agent_risk_categorization',
    'agent_text_chat_tools'
  ]);

// 2. Revert edge function (via Supabase CLI)
// supabase functions deploy voice-coach-session --version <previous_version>

// 3. Database rollback (if needed - preserve data)
// Note: New columns with defaults don't require rollback
// Only drop if critical issues

// 4. Frontend rollback
// Deploy previous build from CI/CD pipeline
```

---

### 11. Testing Requirements

**Unit Tests:**
```typescript
// __tests__/agentSettings.test.ts
describe('getEffectiveSettings', () => {
  it('should use team minimum confidence threshold', () => {
    const userSettings = { confidence_threshold: 0.5 };
    const teamSettings = { min_confidence_threshold: 0.7 };

    const effective = getEffectiveSettings(userSettings, teamSettings);

    expect(effective.confidence_threshold).toBe(0.7);
  });

  it('should require confirmation when team requires it', () => {
    const userSettings = { require_confirmation_email: false };
    const teamSettings = { require_confirmation: true };

    const effective = getEffectiveSettings(userSettings, teamSettings);

    expect(effective.require_confirmation_email).toBe(true);
  });
});
```

**Integration Tests:**
```typescript
// __tests__/agentConfirmationFlow.integration.test.ts
describe('Agent Confirmation Flow', () => {
  it('should create pending action for high-risk actions', async () => {
    // Arrange
    const userId = 'test-user';
    await setUserSettings(userId, { require_confirmation_email: true });

    // Act
    const response = await invokeFunction('voice-coach-session', {
      user_id: userId,
      action: 'send_email',
      payload: { to: 'test@example.com', subject: 'Test', body: 'Hello' }
    });

    // Assert
    expect(response.needs_confirmation).toBe(true);
    expect(response.pending_action_id).toBeDefined();

    const pending = await getPendingAction(response.pending_action_id);
    expect(pending.status).toBe('pending_confirmation');
  });
});
```

**E2E Tests:**
```typescript
// e2e/agentActions.spec.ts (Playwright)
test('user can confirm and execute pending action', async ({ page }) => {
  await page.goto('/settings/agent');

  // Trigger action that requires confirmation
  await page.click('[data-testid="test-email-action"]');

  // Verify pending action appears
  await expect(page.locator('[data-testid="pending-action"]')).toBeVisible();

  // Confirm action
  await page.click('[data-testid="confirm-action"]');

  // Verify execution
  await expect(page.locator('[data-testid="action-status"]')).toHaveText('Executed');
});
```

---

### 12. Performance Considerations

```typescript
// Caching Strategy
const CACHE_TTL = {
  user_settings: 60,        // 1 minute
  team_settings: 300,       // 5 minutes
  feature_flags: 60,        // 1 minute
  action_history: 30,       // 30 seconds (realtime preferred)
};

// Edge function caching
export async function getCachedSettings(
  supabase: any,
  userId: string
): Promise<EffectiveAgentSettings> {
  const cacheKey = `agent_settings:${userId}`;

  // Check cache first (use Redis in production)
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Fetch and compute
  const settings = await computeEffectiveSettings(supabase, userId);

  // Cache with TTL
  await cache.set(cacheKey, JSON.stringify(settings), CACHE_TTL.user_settings);

  return settings;
}

// Invalidation on settings change
export async function invalidateSettingsCache(userId: string) {
  await cache.del(`agent_settings:${userId}`);
}
```

**Lazy Loading for Admin Dashboards:**
```tsx
// pages/admin/agent-activity.tsx
const AgentActivityDashboard = dynamic(
  () => import('@/components/admin/AgentActivityDashboard'),
  {
    loading: () => <DashboardSkeleton />,
    ssr: false  // Client-only for realtime
  }
);
```

---

## Updated Implementation Roadmap

### Executive Roadmap Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI COACH AGENTIC EXECUTION ROADMAP                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: FOUNDATION          PHASE 2: ENHANCE           PHASE 3: SCALE    │
│  ══════════════════          ═══════════════           ═══════════════     │
│                                                                             │
│  Sprint 1-2                   Sprint 3-4                Sprint 5-6          │
│  ┌─────────────┐              ┌─────────────┐           ┌─────────────┐     │
│  │ Database    │              │ Frontend    │           │ Calendar    │     │
│  │ Schema      │──────────────│ Components  │───────────│ Integration │     │
│  │ + Types     │              │ + Realtime  │           │ + Feedback  │     │
│  └─────────────┘              └─────────────┘           └─────────────┘     │
│         │                            │                         │            │
│         ▼                            ▼                         ▼            │
│  ┌─────────────┐              ┌─────────────┐           ┌─────────────┐     │
│  │ Backend     │              │ Testing     │           │ Rollout     │     │
│  │ Functions   │──────────────│ + Observ.   │───────────│ + Polish    │     │
│  │ + Tools     │              │ Dashboard   │           │ 10%→100%    │     │
│  └─────────────┘              └─────────────┘           └─────────────┘     │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════   │
│  MILESTONE 1              MILESTONE 2                  MILESTONE 3          │
│  Internal Alpha           Beta Release                 GA Release           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Sprint 1: Core Infrastructure

**Duration:** 2 weeks
**Goal:** Establish database schema and TypeScript foundation
**Dependencies:** None (starting point)

| Task | Owner | Priority | Files Affected |
|------|-------|----------|----------------|
| Add TypeScript types to `types.ts` | Frontend | P0 | `types.ts` |
| Create feature flags table | Backend | P0 | `supabase/migrations/` |
| Extend `user_agent_settings` schema | Backend | P0 | `supabase/migrations/` |
| Extend `team_ai_settings` schema | Backend | P0 | `supabase/migrations/` |
| Create `pending_agent_actions` table | Backend | P0 | `supabase/migrations/` |
| Implement `getEffectiveSettings()` | Backend | P1 | `supabase/functions/_shared/` |
| Add ACTION_RISK_LEVELS constant | Shared | P1 | `types.ts`, edge functions |

**Deliverables:**
- [ ] All Phase 1 migrations applied to staging
- [ ] TypeScript types compile without errors
- [ ] Feature flags utility tested locally

**Success Criteria:**
- Schema changes backward-compatible
- No breaking changes to existing queries
- RLS policies verified

---

### Sprint 2: Backend Enhancements

**Duration:** 2 weeks
**Goal:** Enable agentic execution with confirmation flow
**Dependencies:** Sprint 1 complete

| Task | Owner | Priority | Files Affected |
|------|-------|----------|----------------|
| Add voice call to `getGeminiTools()` | Backend | P0 | `voice-coach-session/index.ts` |
| Implement confirmation flow | Backend | P0 | `voice-coach-session/index.ts` |
| Add function calling to text chat | Backend | P0 | `amie-psychological-coach/index.ts` |
| Create `confirm-agent-action` function | Backend | P0 | NEW: `confirm-agent-action/index.ts` |
| Create `cancel-agent-action` function | Backend | P0 | NEW: `cancel-agent-action/index.ts` |
| Enable Supabase Realtime | Backend | P1 | `supabase/migrations/` |
| Implement AgentError class | Backend | P1 | `supabase/functions/_shared/` |

**Deliverables:**
- [ ] Voice call tool working in voice sessions
- [ ] Text chat can execute agent actions
- [ ] Confirmation flow tested end-to-end
- [ ] Error responses standardized

**Success Criteria:**
- High-risk actions require confirmation
- Low-risk actions auto-execute per settings
- All actions logged to `agent_action_history`

**🚩 MILESTONE 1: Internal Alpha**
- Core agentic execution working
- Internal team can test via feature flags

---

### Sprint 3: Frontend Updates

**Duration:** 2 weeks
**Goal:** User-facing settings and action management UI
**Dependencies:** Sprint 2 complete

| Task | Owner | Priority | Files Affected |
|------|-------|----------|----------------|
| Add confidence settings card | Frontend | P0 | `AgentSettings.tsx` |
| Enhance action history component | Frontend | P0 | `AgentSettings.tsx` |
| Create `useAgentActions` hook | Frontend | P0 | NEW: `hooks/useAgentActions.ts` |
| Pending action cards (confirm/cancel) | Frontend | P0 | NEW: `PendingActionCard.tsx` |
| Loading states & optimistic updates | Frontend | P1 | Multiple components |
| Add confidence policies to admin | Frontend | P1 | `AICoachSettings.tsx` |

**Deliverables:**
- [ ] Users can configure confidence threshold
- [ ] Users can view/manage pending actions
- [ ] Real-time updates working
- [ ] Admins can set team policies

**Success Criteria:**
- Settings save and load correctly
- Pending actions update in real-time
- No UI regressions in existing settings

---

### Sprint 4: Observability & Testing

**Duration:** 2 weeks
**Goal:** Production readiness with monitoring and test coverage
**Dependencies:** Sprint 3 complete

| Task | Owner | Priority | Files Affected |
|------|-------|----------|----------------|
| Create `agent_execution_traces` table | Backend | P0 | `supabase/migrations/` |
| Add tracing to tool executions | Backend | P0 | All edge functions |
| Create Agent Activity Dashboard | Frontend | P1 | NEW: `admin/AgentActivityDashboard.tsx` |
| Unit tests for `getEffectiveSettings` | QA | P0 | `__tests__/` |
| Integration tests for confirmation | QA | P0 | `__tests__/` |
| E2E tests for critical paths | QA | P1 | `e2e/` |
| Performance/load testing | QA | P2 | N/A |

**Deliverables:**
- [ ] Observability dashboard for admins
- [ ] 80%+ test coverage on new code
- [ ] Performance benchmarks documented
- [ ] Error tracking integrated (Sentry)

**Success Criteria:**
- All tests passing in CI
- P95 latency < 2s for tool execution
- No memory leaks in realtime subscriptions

**🚩 MILESTONE 2: Beta Release**
- Feature-complete for Phase 1
- Ready for limited external testing

---

### Sprint 5: Calendar & Feedback

**Duration:** 2 weeks
**Goal:** Calendar integration and feedback collection
**Dependencies:** Sprint 4 complete (can run parallel partially)

| Task | Owner | Priority | Files Affected |
|------|-------|----------|----------------|
| Google Calendar OAuth flow | Backend | P0 | NEW: `google-calendar-connect/` |
| Create calendar event tool | Backend | P0 | NEW: `google-calendar-create-event/` |
| Availability checking tool | Backend | P1 | NEW: `google-calendar-availability/` |
| Create `agent_action_feedback` table | Backend | P0 | `supabase/migrations/` |
| Feedback buttons in action history | Frontend | P0 | `AgentSettings.tsx` |
| Admin Feedback Analytics | Frontend | P1 | NEW: `admin/AgentFeedbackAnalytics.tsx` |
| Calendar connection UI | Frontend | P0 | NEW: `CalendarConnection.tsx` |

**Deliverables:**
- [ ] Users can connect Google Calendar
- [ ] AI can create calendar events (with confirmation)
- [ ] Feedback collection working
- [ ] Admin can view feedback analytics

**Success Criteria:**
- OAuth refresh tokens working
- Calendar events created correctly
- Feedback data flowing to analytics

---

### Sprint 6: Polish & Rollout

**Duration:** 2 weeks
**Goal:** Production deployment with gradual rollout
**Dependencies:** Sprint 5 complete

| Task | Owner | Priority | Files Affected |
|------|-------|----------|----------------|
| Internal team testing | QA | P0 | N/A |
| Bug fixes from testing | All | P0 | Various |
| Documentation | Tech Writer | P1 | `docs/` |
| User training materials | Product | P1 | External |
| Rollout 10% | DevOps | P0 | Feature flags |
| Monitor & iterate | All | P0 | N/A |
| Rollout 25% → 50% → 100% | DevOps | P0 | Feature flags |

**Rollout Schedule:**
```
Week 11:
├── Day 1-2: Internal testing (feature flag: internal team only)
├── Day 3-4: Fix critical bugs
├── Day 5: Rollout 10% of users

Week 12:
├── Day 1: Monitor metrics, fix issues
├── Day 2: Rollout 25%
├── Day 3: Monitor, fix
├── Day 4: Rollout 50%
├── Day 5: Full rollout 100%
```

**Deliverables:**
- [ ] Zero critical bugs
- [ ] Documentation complete
- [ ] 100% rollout achieved
- [ ] Success metrics dashboard live

**Success Criteria:**
- < 0.1% error rate
- > 70% user adoption (of those who see it)
- NPS > 50 for agentic features

**🚩 MILESTONE 3: GA Release**
- Full production deployment
- All users have access

---

### Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| OAuth token refresh failures | Medium | High | Implement retry logic, alert on failures |
| Realtime connection drops | Low | Medium | Reconnection logic, fallback polling |
| High-risk action executed without consent | Low | Critical | Defense-in-depth: HITL + risk categorization |
| Performance degradation | Medium | Medium | Caching, lazy loading, monitoring |
| User confusion on confirmation UX | Medium | Low | User testing, clear UI copy |

---

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agentic feature adoption | > 50% of active users | Feature flag analytics |
| Actions per user per week | > 3 | `agent_action_history` count |
| Confirmation approval rate | > 80% | Pending action conversions |
| Action error rate | < 1% | Failed actions / total actions |
| User satisfaction (NPS) | > 50 | Post-action survey |
| P95 action latency | < 2 seconds | Execution traces |

---

### Dependencies Map

```
┌─────────────────────────────────────────────────────────────────┐
│                     CRITICAL PATH                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  types.ts ──┬──► migrations ──┬──► voice-coach-session         │
│             │                 │                                 │
│             │                 ├──► amie-psychological-coach     │
│             │                 │                                 │
│             └──► AgentSettings.tsx ──► useAgentActions.ts       │
│                                                                 │
│  ════════════════════════════════════════════════════════════   │
│                                                                 │
│  PARALLEL WORKSTREAMS:                                          │
│                                                                 │
│  [Backend]                    [Frontend]                        │
│  ─────────                    ──────────                        │
│  Sprint 1-2                   Sprint 3                          │
│  Edge functions               UI Components                     │
│       │                            │                            │
│       └────────────┬───────────────┘                            │
│                    │                                            │
│                    ▼                                            │
│               [Testing]                                         │
│               Sprint 4                                          │
│                    │                                            │
│                    ▼                                            │
│  [Calendar]  ◄────────────►  [Feedback]                        │
│  Sprint 5                    Sprint 5                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Post-Launch Roadmap (Future Phases)

| Phase | Feature | Priority | Target |
|-------|---------|----------|--------|
| 4.1 | Microsoft Calendar / Apple Calendar | P2 | Q2 |
| 4.2 | Multi-step workflows | P2 | Q2 |
| 4.3 | Email to external contacts | P3 | Q3 |
| 4.4 | Slack/Teams notifications | P2 | Q2 |
| 4.5 | Smart scheduling (optimal times) | P3 | Q3 |
| 4.6 | Multi-agent orchestration | P3 | Q4 |

---

## Conclusion (Updated)

The Vision AI Coach agentic execution plan has been validated against **2025 enterprise AI agent best practices** from industry leaders including Microsoft, LangChain, McKinsey, Deloitte, and ISACA.

### Key Findings:

1. **Strong Foundation:** The existing architecture aligns well with industry standards for permissions, audit trails, and communication infrastructure.

2. **Critical Additions Needed:**
   - Confidence-based routing (industry standard for safety)
   - Risk-based action categorization
   - Execution observability/tracing
   - Feedback loop for continuous improvement

3. **No Breaking Changes:** All proposed enhancements are additive and backward-compatible with existing frontend and backend code.

4. **Security Aligned:** The plan meets enterprise security requirements including RBAC, audit trails, rate limiting, and human-in-the-loop controls.

5. **Scalability Ready:** The architecture supports future multi-agent patterns and advanced orchestration when needed.

By implementing the enhanced Phase 1 with industry-standard patterns, Vision AI Coach will be positioned as a **best-in-class enterprise agentic AI platform** for 2025 and beyond.
