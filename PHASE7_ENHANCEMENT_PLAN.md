# Phase 7 AI Agent Enhancement Plan
## Manager Dashboard SMS/Voice Controls & UX Improvements

**Document Version:** 1.0
**Date:** December 18, 2025
**Status:** PROPOSAL - Awaiting Approval

---

## Executive Summary

This plan addresses the gaps identified in Phase 7 AI Agent implementation, specifically:
1. **Manager Dashboard lacks SMS/Voice control capabilities** - Managers cannot send test SMS/calls or manage user preferences
2. **AgentSettings UX issues** - Critical sync problems between settings panels
3. **Missing compliance controls** - No TCPA-compliant quiet hours, opt-out management, or audit trails
4. **No testing infrastructure** - No way to validate SMS/voice before enabling

Based on 2025 best practices research, this plan incorporates enterprise-grade agentic AI voice patterns while preserving all existing functionality.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Gap Analysis Summary](#2-gap-analysis-summary)
3. [2025 Best Practices Research](#3-2025-best-practices-research)
4. [Implementation Plan](#4-implementation-plan)
5. [Testing Strategy](#5-testing-strategy)
6. [Risk Mitigation](#6-risk-mitigation)
7. [Implementation Phases](#7-implementation-phases)
8. [Success Metrics](#8-success-metrics)

---

## 1. Current State Analysis

### 1.1 What's Working (Do Not Modify)

| Feature | Status | Location |
|---------|--------|----------|
| Voice Coach Sessions | ✅ Working | `voice-coach-session/index.ts` |
| Email Sending | ✅ Working | `send-email/index.ts` |
| SMS Sending (Backend) | ✅ Working | `agent-send-sms/index.ts` |
| Voice Calls (Backend) | ✅ Working | `agent-voice-call/index.ts` |
| Habit Reminder Scheduler | ✅ Working | `habit-reminder-scheduler/index.ts` |
| Process Scheduled Reminders | ✅ Working | `process-scheduled-reminders/index.ts` |
| User Agent Settings UI | ✅ Working | `AgentSettings.tsx` |
| Manager Voice Analytics | ✅ Working | `VoiceCoachAnalytics.tsx` |
| Manager AI Coach Settings | ✅ Working | `AICoachSettings.tsx` |
| Team Communications (Email) | ✅ Working | `TeamCommunications.tsx` |

### 1.2 Database Tables (Existing - Preserve)

- `user_agent_settings` - User-level permissions and preferences
- `user_comm_preferences` - Phone numbers, quiet hours, channels
- `scheduled_habit_reminders` - Scheduled reminder queue
- `scheduled_goal_checkins` - Goal check-in queue
- `agent_action_history` - Audit trail of agent actions
- `team_ai_settings` - Team-level AI configurations
- `voice_coach_sessions` - Voice session records
- `engagement_alerts` - Engagement tracking alerts

---

## 2. Gap Analysis Summary

### 2.1 Manager Dashboard Gaps (11 Critical Issues)

| Gap # | Issue | Impact | Priority |
|-------|-------|--------|----------|
| GAP-1 | No manager UI to view/control user SMS/Voice preferences | Managers can't help users or enforce policies | **CRITICAL** |
| GAP-2 | No SMS sending interface for managers | Can't send SMS announcements or tests | **CRITICAL** |
| GAP-3 | No voice call scheduling/initiation for managers | Can't trigger calls to users | **CRITICAL** |
| GAP-4 | No SMS template management | No reusable message templates | **HIGH** |
| GAP-5 | No voice call script management | No call script templates | **HIGH** |
| GAP-6 | No SMS/Voice delivery analytics | Can't track success/failure rates | **HIGH** |
| GAP-7 | No SMS rate limiting controls | Risk of over-messaging | **MEDIUM** |
| GAP-8 | No cost/billing tracking | Can't monitor Twilio spend | **MEDIUM** |
| GAP-9 | No compliance audit trail view | Can't verify TCPA compliance | **HIGH** |
| GAP-10 | No opt-out management UI | Can't manage consent | **HIGH** |
| GAP-11 | No multi-channel orchestration | No fallback logic | **LOW** |

### 2.2 AgentSettings UX Gaps (Critical Sync Issues)

| Issue | Description | Impact |
|-------|-------------|--------|
| Settings Not Synced | `NotificationSettings.tsx` and `AgentSettings.tsx` don't share state | Users can have conflicting settings |
| No Test Functionality | Users can't test SMS/Voice before enabling | Silent failures at runtime |
| Phone Verification Missing | No verification flow for phone numbers | SMS/Voice may fail to invalid numbers |
| Quiet Hours Not Displayed | AgentSettings doesn't show quiet hours context | Users schedule during quiet hours |
| Timezone Not Shown | Time inputs lack timezone context | Wrong scheduling |

---

## 3. 2025 Best Practices Research

### 3.1 Agentic AI Voice Agent Standards

Based on research from Andreessen Horowitz, BCG, OpenAI, and industry leaders:

**Market Context:**
- AI voice agent market growing 43.8% CAGR ($5.2B → $196.6B by 2034)
- 73% of companies adopting voice AI by end of 2025
- 33% of enterprise software will include agentic AI by 2028

**Best Practice #1: Start with Focused Use Cases**
> "Voice agents work best when they solve one well-defined problem for one clear user group."
- Current system: Habit reminders, goal check-ins, proactive outreach ✅
- Recommendation: Keep focused, don't over-expand scope

**Best Practice #2: Balance Autonomy with Human Oversight**
> "Organizations must embed a coherent set of controls across the value chain from day one."
- Current: User-level toggles exist ✅
- Gap: Manager override capability needed

**Best Practice #3: Security & Compliance First**
> "Voice agents can ensure regulatory compliance by adopting strategies for data protection and transparency."
- Current: Basic quiet hours in `agent-voice-call` ✅
- Gap: Full TCPA compliance, audit trails needed

**Best Practice #4: Design for Brand Personality**
> "Create AI agents that understand context and maintain your brand personality."
- Current: Coach name/tone configurable ✅
- Gap: SMS/Voice templates needed for consistency

**Best Practice #5: Extensive Testing**
> "Evaluate the system across diverse scenarios, mirroring real-world conditions."
- Current: No testing infrastructure ❌
- Gap: Test SMS/Voice functionality needed

### 3.2 TCPA/SMS Compliance Requirements

Based on Twilio documentation and FCC regulations:

**Quiet Hours (Federal):**
- 9:00 PM - 8:00 AM in recipient's local time zone
- Some states have stricter requirements

**Required Compliance Features:**
| Feature | Requirement | Current State |
|---------|-------------|---------------|
| Opt-in Consent | Written consent required | ❌ Not tracked |
| Opt-out Mechanism | Easy unsubscribe (STOP, END, etc.) | ❌ Not implemented |
| Quiet Hours | No non-essential messages 9PM-8AM | ⚠️ Partial (voice only) |
| Number Verification | Verify phone ownership | ❌ No verification flow |
| Reassigned Number Check | Check if number changed owners | ❌ Not implemented |
| Audit Trail | Document all consent/messages | ⚠️ Partial |

**Penalty Risk:** Up to $1,500 per violation for TCPA non-compliance

### 3.3 Testing & Monitoring Standards

Based on Langfuse, Maxim AI, and enterprise patterns:

**Dual Evaluation Approach:**
1. **Offline Testing** (Pre-production)
   - Simulate SMS delivery
   - Simulate voice calls
   - Test edge cases (invalid numbers, opt-outs)

2. **Online Monitoring** (Production)
   - Track delivery rates
   - Monitor failure reasons
   - Alert on anomalies

**Recommended Deployment:**
- POC: 4 weeks
- Pilot: 2-3 months
- Full Scale: Month 4+

---

## 4. Implementation Plan

### 4.1 New Components to Create

#### Component 1: SMSVoiceManagement.tsx (Manager Dashboard)

**Location:** `components/admin/SMSVoiceManagement.tsx`

**Features:**
- View all users with SMS/Voice enabled
- Send test SMS to any user
- Initiate test voice call to any user
- View delivery status for recent messages
- Filter by delivery status (sent, delivered, failed)
- Manage SMS templates
- Manage voice call scripts

**UI Tabs:**
1. **Send Message** - Compose and send SMS/voice
2. **User Preferences** - View/manage user settings
3. **Templates** - SMS/voice templates
4. **Delivery Log** - Recent activity with status
5. **Analytics** - Delivery rates, costs

#### Component 2: ComplianceManager.tsx (Manager Dashboard)

**Location:** `components/admin/ComplianceManager.tsx`

**Features:**
- View opt-in/opt-out status per user
- Export compliance reports
- View audit trail of all SMS/Voice activity
- Manage do-not-contact list
- Configure quiet hours policy
- Number verification status

#### Component 3: Test SMS/Voice in AgentSettings.tsx

**Location:** `components/settings/AgentSettings.tsx` (modify existing)

**New Features:**
- "Send Test SMS" button (validates phone works)
- "Test Voice Call" button (validates voice works)
- Success/error feedback inline
- Show phone verification status
- Display quiet hours context
- Show timezone for scheduled times

### 4.2 New Database Tables

#### Table: sms_templates
```sql
CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  template_type TEXT DEFAULT 'custom', -- 'habit_reminder', 'goal_checkin', 'custom'
  variables TEXT[], -- ['{{user_name}}', '{{habit_title}}']
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Table: voice_call_scripts
```sql
CREATE TABLE voice_call_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  name TEXT NOT NULL,
  script_content TEXT NOT NULL,
  call_type TEXT DEFAULT 'custom', -- 'habit_reminder', 'goal_checkin', 'accountability'
  estimated_duration_seconds INT DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Table: sms_delivery_log
```sql
CREATE TABLE sms_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  phone_number TEXT NOT NULL,
  message_sid TEXT, -- Twilio SID
  message_content TEXT,
  template_id UUID REFERENCES sms_templates(id),
  status TEXT DEFAULT 'queued', -- 'queued', 'sent', 'delivered', 'failed', 'undelivered'
  error_code TEXT,
  error_message TEXT,
  sent_by UUID REFERENCES profiles(id), -- Manager who sent (if manual)
  trigger_type TEXT, -- 'manual', 'automated_reminder', 'scheduled'
  cost_cents INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ
);
```

#### Table: voice_call_log
```sql
CREATE TABLE voice_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  phone_number TEXT NOT NULL,
  call_sid TEXT, -- Twilio SID
  script_id UUID REFERENCES voice_call_scripts(id),
  status TEXT DEFAULT 'initiated', -- 'initiated', 'ringing', 'answered', 'completed', 'failed', 'busy', 'no-answer'
  duration_seconds INT,
  error_message TEXT,
  initiated_by UUID REFERENCES profiles(id),
  trigger_type TEXT, -- 'manual', 'automated_reminder', 'scheduled'
  cost_cents INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

#### Table: user_consent_log
```sql
CREATE TABLE user_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  consent_type TEXT NOT NULL, -- 'sms_optin', 'sms_optout', 'voice_optin', 'voice_optout'
  consent_method TEXT, -- 'settings_toggle', 'sms_reply', 'phone_keypress'
  consent_timestamp TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  previous_state BOOLEAN,
  new_state BOOLEAN
);
```

### 4.3 New Edge Functions

#### Function 1: admin-send-test-sms
**Purpose:** Allow managers to send test SMS
**Authorization:** Manager or Platform Admin only
**Logging:** Full audit trail

#### Function 2: admin-send-test-call
**Purpose:** Allow managers to initiate test voice calls
**Authorization:** Manager or Platform Admin only
**Logging:** Full audit trail

#### Function 3: admin-get-sms-voice-stats
**Purpose:** Aggregate SMS/Voice analytics
**Returns:** Delivery rates, costs, failure reasons

#### Function 4: twilio-sms-status-callback
**Purpose:** Receive Twilio delivery status webhooks
**Updates:** `sms_delivery_log.status`

#### Function 5: twilio-call-status-callback
**Purpose:** Receive Twilio call status webhooks
**Updates:** `voice_call_log.status`

### 4.4 RLS Policy Additions

```sql
-- Allow managers to view user_agent_settings for their team
CREATE POLICY "Managers can view team member agent settings"
ON user_agent_settings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.user_id = auth.uid()
    AND tm.team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = user_agent_settings.user_id
    )
    AND tm.role IN ('manager', 'admin')
  )
);

-- Allow managers to view SMS delivery logs for their team
CREATE POLICY "Managers can view team SMS logs"
ON sms_delivery_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.user_id = auth.uid()
    AND tm.team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = sms_delivery_log.user_id
    )
    AND tm.role IN ('manager', 'admin')
  )
);
```

---

## 5. Testing Strategy

### 5.1 Pre-Implementation Testing (Protect Existing Features)

Before any code changes, run these tests to establish baseline:

| Test | Command/Action | Expected Result |
|------|----------------|-----------------|
| Voice Coach Session | Call voice-coach-session API | Session starts successfully |
| Email Sending | Trigger test email | Email delivered |
| SMS Sending | Call agent-send-sms | SMS delivered |
| Voice Call | Call agent-voice-call | Call initiated |
| Habit Scheduler | Invoke habit-reminder-scheduler | Reminders scheduled |
| Process Reminders | Invoke process-scheduled-reminders | Reminders sent |

**Automation Script:** Create `test-phase7-baseline.ts` to run all tests

### 5.2 Unit Tests for New Components

```typescript
// tests/admin/SMSVoiceManagement.test.tsx
describe('SMSVoiceManagement', () => {
  it('should display list of users with SMS enabled')
  it('should send test SMS when button clicked')
  it('should show delivery status after sending')
  it('should prevent sending during quiet hours')
  it('should require manager role')
})

// tests/admin/ComplianceManager.test.tsx
describe('ComplianceManager', () => {
  it('should show opt-in/opt-out history')
  it('should export compliance report as CSV')
  it('should display audit trail correctly')
})
```

### 5.3 Integration Tests

| Test Scenario | Steps | Validation |
|---------------|-------|------------|
| Manager sends test SMS | 1. Login as manager, 2. Navigate to SMS/Voice, 3. Select user, 4. Send test | SMS received, log entry created |
| User enables SMS | 1. Login as user, 2. Enable SMS in AgentSettings, 3. Save | Consent logged, manager can see |
| Quiet hours respected | 1. Set quiet hours 10PM-7AM, 2. Try sending at 11PM | Message blocked, error shown |
| Opt-out via SMS reply | 1. User texts "STOP", 2. Webhook received | user_agent_settings.allow_send_sms = false |

### 5.4 Regression Tests (Critical)

Run after each phase deployment:

```bash
# Automated regression test suite
npm run test:regression

# Manual smoke tests
1. Create new goal → verify no errors
2. Complete habit → verify streak updates
3. Start voice coach session → verify tools work
4. Send email announcement → verify delivery
5. Check dashboard stats → verify accuracy
```

### 5.5 Load Testing

Before full deployment:
- Simulate 100 concurrent SMS sends
- Simulate 50 concurrent voice calls
- Verify Twilio rate limits respected
- Verify database handles load

---

## 6. Risk Mitigation

### 6.1 Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing voice coach | Medium | High | Feature flag, rollback plan |
| TCPA violation | Low | High | Implement compliance before launch |
| Twilio cost overrun | Medium | Medium | Rate limiting, budget alerts |
| User confusion between settings | High | Medium | Sync settings, clear UI |
| Manager abuse of send features | Low | Medium | Audit trail, rate limits |

### 6.2 Feature Flags

Implement feature flags for gradual rollout:

```typescript
const FEATURE_FLAGS = {
  MANAGER_SMS_CONTROLS: false,     // Enable when ready
  MANAGER_VOICE_CONTROLS: false,   // Enable when ready
  SMS_COMPLIANCE_TRACKING: false,  // Enable first
  USER_SMS_TESTING: false,         // Enable for AgentSettings
}
```

### 6.3 Rollback Plan

If issues detected:
1. Disable feature flags immediately
2. New components won't render
3. Existing functionality continues
4. No database rollback needed (additive changes only)

---

## 7. Implementation Phases

### Phase A: Compliance Foundation (Week 1-2)
**Goal:** Establish compliance infrastructure before enabling manager controls

**Tasks:**
- [ ] Create `user_consent_log` table
- [ ] Create `sms_delivery_log` table
- [ ] Create `voice_call_log` table
- [ ] Update `agent-send-sms` to log to delivery table
- [ ] Update `agent-voice-call` to log to call table
- [ ] Create Twilio webhook handlers for status updates
- [ ] Add TCPA quiet hours check to SMS function

**Testing:**
- Verify existing SMS/voice still works
- Verify logs are created
- Verify status webhooks update records

**Rollback:** Drop new tables, revert function changes

---

### Phase B: AgentSettings UX Improvements (Week 2-3)
**Goal:** Fix sync issues and add test functionality

**Tasks:**
- [ ] Add "Send Test SMS" button to AgentSettings
- [ ] Add "Test Voice Call" button to AgentSettings
- [ ] Display quiet hours context from NotificationSettings
- [ ] Show timezone for scheduled times
- [ ] Add phone verification status indicator
- [ ] Sync settings state between components

**Testing:**
- Test SMS button sends actual SMS to user's phone
- Test call button initiates call to user's phone
- Verify settings sync correctly
- Verify existing save functionality unchanged

**Rollback:** Revert AgentSettings changes

---

### Phase C: Manager SMS Controls (Week 3-4)
**Goal:** Enable managers to view and send SMS

**Tasks:**
- [ ] Create `SMSVoiceManagement.tsx` component
- [ ] Add RLS policies for manager access
- [ ] Create `admin-send-test-sms` edge function
- [ ] Create `sms_templates` table
- [ ] Add "SMS/Voice" tab to Manager Dashboard
- [ ] Implement SMS template management

**Testing:**
- Manager can view users with SMS enabled
- Manager can send test SMS
- Manager can create/edit templates
- Non-managers cannot access

**Rollback:** Remove tab from ManagerDashboard, disable feature flag

---

### Phase D: Manager Voice Controls (Week 4-5)
**Goal:** Enable managers to initiate voice calls

**Tasks:**
- [ ] Extend `SMSVoiceManagement.tsx` with voice features
- [ ] Create `admin-send-test-call` edge function
- [ ] Create `voice_call_scripts` table
- [ ] Implement voice script management
- [ ] Add call status tracking UI

**Testing:**
- Manager can initiate test call
- Manager can create/edit call scripts
- Call status updates in real-time
- Existing automated calls unaffected

**Rollback:** Disable voice controls in UI, feature flag

---

### Phase E: Analytics & Compliance Dashboard (Week 5-6)
**Goal:** Provide visibility into SMS/Voice performance

**Tasks:**
- [ ] Create `ComplianceManager.tsx` component
- [ ] Create `admin-get-sms-voice-stats` edge function
- [ ] Add delivery analytics charts
- [ ] Add cost tracking
- [ ] Add compliance report export
- [ ] Add opt-in/opt-out history view

**Testing:**
- Analytics show accurate data
- Export produces valid CSV
- Costs match Twilio billing
- Historical data preserved

**Rollback:** Remove analytics components

---

### Phase F: Polish & Documentation (Week 6-7)
**Goal:** Finalize UX and document system

**Tasks:**
- [ ] Add tooltips and help text throughout
- [ ] Create user documentation for new features
- [ ] Create manager documentation
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Final regression testing

**Deliverables:**
- User guide: "Managing Your AI Agent SMS/Voice Settings"
- Manager guide: "SMS and Voice Controls Dashboard"
- Admin guide: "Compliance and Audit Features"

---

## 8. Success Metrics

### 8.1 Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| SMS delivery rate | >95% | `sms_delivery_log` status = delivered |
| Voice call completion | >80% | `voice_call_log` status = completed |
| API response time | <500ms | Edge function logs |
| Zero regressions | 0 bugs in existing features | Regression test suite |

### 8.2 User Experience Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Settings sync accuracy | 100% | No conflicting settings |
| Test success rate | >99% | Test SMS/call work first try |
| Manager adoption | >50% | Managers using new controls |

### 8.3 Compliance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| TCPA quiet hours compliance | 100% | No messages during quiet hours |
| Opt-out processing | <24h | Time from STOP to disabled |
| Audit trail completeness | 100% | All actions logged |

---

## Appendix A: File Structure

```
components/
  admin/
    SMSVoiceManagement.tsx      [NEW]
    ComplianceManager.tsx       [NEW]
    VoiceCoachAnalytics.tsx     [EXISTING - no changes]
    AICoachSettings.tsx         [EXISTING - no changes]
    TeamCommunications.tsx      [EXISTING - no changes]
  settings/
    AgentSettings.tsx           [MODIFY - add test buttons]
    NotificationSettings.tsx    [MODIFY - sync with AgentSettings]
  ManagerDashboard.tsx          [MODIFY - add SMS/Voice tab]

supabase/
  functions/
    admin-send-test-sms/        [NEW]
    admin-send-test-call/       [NEW]
    admin-get-sms-voice-stats/  [NEW]
    twilio-sms-status-callback/ [NEW]
    twilio-call-status-callback/[NEW]
    agent-send-sms/             [MODIFY - add logging]
    agent-voice-call/           [MODIFY - add logging]
  migrations/
    20251220_sms_voice_manager_controls.sql [NEW]
```

---

## Appendix B: Research Sources

### Agentic AI Voice Agents
- [AI Voice Agents: 2025 Update | Andreessen Horowitz](https://a16z.com/ai-voice-agents-2025-update/)
- [How Agentic AI is Transforming Enterprise Platforms | BCG](https://www.bcg.com/publications/2025/how-agentic-ai-is-transforming-enterprise-platforms)
- [Voice agents | OpenAI API](https://platform.openai.com/docs/guides/voice-agents)
- [Building AI Voice Agents: Starter Guide | Gladia](https://www.gladia.io/blog/building-ai-voice-agents-starter-guide)
- [AI voice agents: what they are & how they work | AssemblyAI](https://www.assemblyai.com/blog/ai-voice-agents)

### SMS/Voice Compliance
- [Guide to U.S. SMS Compliance | Twilio](https://www.twilio.com/en-us/resource-center/guide-to-us-sms-compliance)
- [AI-Powered Compliance Toolkit | Twilio](https://www.twilio.com/en-us/blog/products/launches/introducing-compliance-toolkit)
- [What is TCPA? | Twilio](https://www.twilio.com/docs/glossary/what-is-telephone-consumer-protection-act-tcpa)
- [Navigating TCPA Compliance with Twilio | DNC.com](https://www.dnc.com/blog/navigating-tcpa-compliance-twilio-empowering-responsible-communication)

### Testing & Monitoring
- [Evaluating and Monitoring Voice AI Agents | Langfuse](https://langfuse.com/blog/2025-01-22-evaluating-voice-ai-agents)
- [Top 5 Voice Agent Evaluation Tools in 2025 | DEV Community](https://dev.to/kuldeep_paul/top-5-voice-agent-evaluation-tools-in-2025-ensuring-reliable-conversational-ai-5d3m)
- [Best AI Voice Agents in 2025 (Tested and Reviewed) | GetVoIP](https://getvoip.com/blog/ai-voice-agents/)

---

## Approval

**Prepared by:** AI Assistant
**Date:** December 18, 2025

**To proceed with implementation:**
1. Review this plan
2. Approve phases A-F or request modifications
3. Confirm timeline expectations
4. Identify any additional requirements

---

*This plan ensures all existing Phase 7 features remain functional while adding manager controls and compliance infrastructure in a safe, phased approach.*
