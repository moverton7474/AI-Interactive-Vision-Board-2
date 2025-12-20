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
