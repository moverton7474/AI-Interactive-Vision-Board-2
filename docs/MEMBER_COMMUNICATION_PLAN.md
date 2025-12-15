# Member Communication System - Comprehensive Implementation Plan

**Document Version:** 1.0
**Created:** December 15, 2025
**Status:** Draft for Review

---

## Executive Summary

This document outlines a comprehensive plan to add member communication capabilities to the Visionary AI platform, enabling team administrators and managers to send emails, announcements, and other communications to team members. The plan is designed to be **additive only**, preserving all existing functionality while introducing new features aligned with 2025 SaaS industry standards.

---

<scratchpad>

## Analysis & Planning Considerations

### 1. Industry Standards for SaaS Communication (2025)

**Multi-Channel Communication:**
- Email remains the backbone for formal communications
- In-app notifications for real-time engagement
- Push notifications for re-engagement
- SMS for urgent/high-priority messages

**Best Practices:**
- User preference centers for channel selection
- Quiet hours and timezone awareness
- Message frequency limits to prevent fatigue
- Clear opt-out/unsubscribe mechanisms
- Consent tracking for GDPR/CCPA compliance

### 2. Integration Without Disruption

The existing system has:
- Robust email infrastructure via Resend API
- Communication router with preference-based routing
- Team management with RLS policies
- Audit logging for admin actions

New features must:
- Use existing email templates as base
- Leverage communication-router architecture
- Respect existing RLS policies
- Add to (not replace) audit logging

### 3. Testing Approach

- Unit tests for new API endpoints
- Integration tests for email delivery
- E2E tests for UI workflows
- Regression tests for existing team management
- Load tests for bulk send operations

### 4. Risks & Mitigation

- Email deliverability with bulk sends → rate limiting
- User fatigue → frequency caps
- Data privacy → consent tracking
- Performance impact → queue-based processing

</scratchpad>

---

## Research Findings

### 2025 Industry Standards for SaaS Member Communication

#### Standard Communication Channels

| Channel | Use Case | Industry Standard |
|---------|----------|-------------------|
| **Email** | Announcements, reports, formal notices | Primary channel for structured content |
| **In-App Notifications** | Real-time updates, action reminders | Highest engagement when contextual |
| **Push Notifications** | Re-engagement, urgent reminders | Best for mobile-first users |
| **SMS** | Critical alerts, time-sensitive actions | Reserved for high-priority only |

#### Best Practices for User Communication

1. **Preference-Driven Delivery**: Let users choose channels, frequency, and quiet hours
2. **Contextual Messaging**: Deliver messages when users are most receptive
3. **Progressive Disclosure**: Start with essential info, provide details on click
4. **Personalization**: Use user names, relevant data, and behavioral context
5. **Consistent Branding**: Maintain visual and tonal consistency across channels

#### Compliance & Privacy Considerations

| Regulation | Requirement | Implementation |
|------------|-------------|----------------|
| **GDPR** | Explicit consent, easy withdrawal | Double opt-in, one-click unsubscribe |
| **CCPA** | Opt-out rights, data transparency | Preference center, data export |
| **CAN-SPAM** | Unsubscribe link, sender identification | Footer with unsubscribe + physical address |
| **CASL** | Express consent for commercial messages | Consent tracking, proof of consent |

#### Common Features in 2025 SaaS Platforms

- **Template Libraries**: Pre-built, customizable email templates
- **Audience Segmentation**: Filter by role, status, activity level
- **Scheduling**: Send at optimal times or schedule for future
- **Analytics & Tracking**: Open rates, click-through, engagement metrics
- **A/B Testing**: Test subject lines and content variations
- **Bulk Operations**: Send to multiple recipients efficiently
- **Message History**: Audit trail of all communications sent

**Sources:**
- [Userpilot - In-App Messaging Best Practices](https://userpilot.com/blog/in-app-messaging-best-practices-saas/)
- [HubEngage - Internal Communication Email Templates 2025](https://www.hubengage.com/employee-communications/email-campaigns/internal-communication-email/)
- [SecurePrivacy - SaaS Privacy Compliance 2025](https://secureprivacy.ai/blog/saas-privacy-compliance-requirements-2025-guide)
- [SecurePrivacy - GDPR and Marketing Compliance](https://secureprivacy.ai/blog/gdpr-and-marketing)

---

## Recommendations

### Recommended Communication Channels

Based on the existing infrastructure and industry standards:

| Channel | Priority | Rationale |
|---------|----------|-----------|
| **Email** | P0 (Core) | Already integrated via Resend; natural extension |
| **In-App Notifications** | P1 (High) | Highest engagement for active users |
| **Push Notifications** | P2 (Medium) | Leverage scheduled-notification infrastructure |
| **SMS** | P3 (Low) | Twilio ready; reserve for critical announcements only |

### Key Features to Implement

#### Core Features (Must Have)

1. **Team Announcements**
   - Send bulk emails to all team members or selected groups
   - Rich text editor with brand-consistent formatting
   - Preview before sending

2. **Member Messaging**
   - Send direct messages to individual team members
   - Use existing coach_message template as foundation

3. **Message Templates**
   - Pre-built templates for common scenarios:
     - Team welcome
     - Goal achievement recognition
     - Activity reminder
     - Weekly summary
     - Custom announcement

4. **Audience Segmentation**
   - Filter by: role, status (active/at-risk/inactive), streak level
   - Custom filters based on completion rates

5. **Send History & Audit Trail**
   - Log all manager-sent communications
   - Searchable history with recipient, status, timestamps

#### Enhanced Features (Should Have)

6. **Scheduling**
   - Schedule messages for future delivery
   - Timezone-aware scheduling

7. **Analytics Dashboard**
   - Email open rates
   - Click-through tracking
   - Engagement metrics per member

8. **In-App Notification Center**
   - Persistent notification inbox for team announcements
   - Mark as read/unread
   - Filter and search

#### Advanced Features (Nice to Have)

9. **A/B Testing**
   - Test subject line variations
   - Compare engagement metrics

10. **Automated Triggers**
    - Auto-send on milestone achievements
    - Inactivity reminders
    - Onboarding sequences for new members

### Integration Points with Existing System

| Existing Component | Integration Approach |
|--------------------|---------------------|
| `send-email` function | Add new templates; reuse email wrapper |
| `communication-router` | Extend to support `team_announcement` type |
| `ManagerDashboard.tsx` | Add new "Communications" tab |
| `audit_logs` table | Log all admin communications |
| `email_logs` table | Track delivery status |
| `team_members` table | Query for recipient lists |
| `user_comm_preferences` | Respect opt-out preferences |

### User Experience Considerations

1. **Manager Dashboard Integration**
   - Add "Communications" tab alongside existing tabs
   - Consistent UI patterns with existing admin panels

2. **Compose Interface**
   - WYSIWYG editor for message body
   - Recipient selector with search/filter
   - Template dropdown
   - Preview mode

3. **Member Preferences**
   - Add team announcements toggle to existing preferences
   - Granular control: announcements vs. reminders vs. recognition

4. **Accessibility**
   - Keyboard navigation for compose interface
   - Screen reader compatible templates
   - Alt text for images in emails

---

## Implementation Plan

### Phase 1: Foundation (Low Complexity)

**Objective:** Establish database schema and core API for team communications

#### 1.1 Database Schema Additions

```sql
-- New table: team_communications
CREATE TABLE team_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  template_type TEXT, -- 'announcement', 'recognition', 'reminder', 'custom'
  recipient_filter JSONB, -- Stores filter criteria
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'sent', 'failed'
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- New table: team_communication_recipients
CREATE TABLE team_communication_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID REFERENCES team_communications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced'
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(communication_id, user_id)
);

-- Add team announcement preference to existing table
ALTER TABLE user_comm_preferences
ADD COLUMN team_announcements_enabled BOOLEAN DEFAULT true,
ADD COLUMN team_digest_frequency TEXT DEFAULT 'instant'; -- 'instant', 'daily', 'weekly', 'none'

-- Indexes for performance
CREATE INDEX idx_team_comms_team_id ON team_communications(team_id);
CREATE INDEX idx_team_comms_status ON team_communications(status);
CREATE INDEX idx_team_comm_recipients_comm_id ON team_communication_recipients(communication_id);
CREATE INDEX idx_team_comm_recipients_status ON team_communication_recipients(status);
```

#### 1.2 New Email Templates

Add to `send-email/index.ts`:
- `team_announcement` - General team-wide announcements
- `team_recognition` - Member achievement recognition
- `team_reminder` - Activity/engagement reminders
- `manager_direct_message` - Direct message from manager

#### 1.3 New Edge Functions

| Function | Purpose |
|----------|---------|
| `team-send-communication` | Create and queue a team communication |
| `team-get-communications` | List communications for a team |
| `team-get-communication-detail` | Get single communication with recipient status |

**Integration Preservation:**
- All new functions use existing `initAdminContext()` pattern
- Reuse existing RLS policies via service role
- Log to `audit_logs` using existing `logAdminAction()` helper

#### 1.4 Deliverables

- [ ] SQL migration for new tables
- [ ] Email templates added to send-email function
- [ ] `team-send-communication` Edge Function
- [ ] `team-get-communications` Edge Function
- [ ] `team-get-communication-detail` Edge Function
- [ ] RLS policies for new tables

---

### Phase 2: Manager Dashboard UI (Medium Complexity)

**Objective:** Add communication capabilities to Manager Dashboard

#### 2.1 New Components

| Component | Description |
|-----------|-------------|
| `TeamCommunications.tsx` | Main communications tab container |
| `ComposeMessage.tsx` | Message composer with template selection |
| `RecipientSelector.tsx` | Filter and select recipients |
| `MessagePreview.tsx` | Preview email before sending |
| `CommunicationHistory.tsx` | List of sent communications |
| `CommunicationDetail.tsx` | View single communication with stats |

#### 2.2 Manager Dashboard Integration

Add new tab to existing `activeView` state:
- `'communications'` alongside existing `'overview' | 'members' | 'reports' | 'site_settings' | 'team_admin'`

#### 2.3 Compose Interface Specifications

```
┌─────────────────────────────────────────────────────────────┐
│  📧 Compose Team Message                              [X]  │
├─────────────────────────────────────────────────────────────┤
│  Template: [Select template ▼]                              │
│                                                             │
│  To: [All Members ▼] [Active Only ☑] [Role: Any ▼]        │
│      Selected: 24 members                                   │
│                                                             │
│  Subject: ____________________________________________      │
│                                                             │
│  Message:                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [B] [I] [U] [Link] [List] [Image] | Preview         │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                     │   │
│  │                                                     │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ☐ Schedule for later: [Date picker] [Time picker]         │
│                                                             │
│  [Cancel]                      [Preview] [Send Now]         │
└─────────────────────────────────────────────────────────────┘
```

#### 2.4 Deliverables

- [ ] `TeamCommunications.tsx` component
- [ ] `ComposeMessage.tsx` with rich text editor
- [ ] `RecipientSelector.tsx` with filters
- [ ] `MessagePreview.tsx` component
- [ ] `CommunicationHistory.tsx` list view
- [ ] `CommunicationDetail.tsx` with recipient status
- [ ] Update `ManagerDashboard.tsx` to include new tab
- [ ] Responsive design for mobile managers

---

### Phase 3: Delivery & Processing (Medium Complexity)

**Objective:** Implement reliable email delivery with queue processing

#### 3.1 Queue-Based Processing

Create `process-team-communications` Edge Function:
1. Query pending communications with `status = 'scheduled'` and `scheduled_for <= now()`
2. For each communication:
   - Update status to 'sending'
   - Query eligible recipients (respecting opt-out preferences)
   - Send emails in batches (max 50/batch)
   - Update recipient statuses
   - Update communication counters
3. Handle failures with retry logic

#### 3.2 Resend Webhook Integration

Create `resend-webhook` Edge Function to receive:
- Delivery confirmations
- Open tracking events
- Click tracking events
- Bounce notifications

Update `team_communication_recipients.status` accordingly.

#### 3.3 Rate Limiting & Batching

| Limit Type | Value | Rationale |
|------------|-------|-----------|
| Emails per minute | 100 | Resend API limits |
| Batch size | 50 | Memory optimization |
| Retry attempts | 3 | Avoid infinite loops |
| Retry delay | 60s, 300s, 900s | Exponential backoff |

#### 3.4 Deliverables

- [ ] `process-team-communications` Edge Function
- [ ] `resend-webhook` Edge Function
- [ ] Cron job setup for processing (via pg_cron)
- [ ] Rate limiting implementation
- [ ] Retry logic for failed sends
- [ ] Bounce handling

---

### Phase 4: Analytics & Tracking (Low-Medium Complexity)

**Objective:** Provide visibility into communication effectiveness

#### 4.1 Analytics Dashboard Components

| Metric | Calculation | Display |
|--------|-------------|---------|
| Delivery Rate | sent_count / total_recipients | Percentage |
| Open Rate | opened / delivered | Percentage |
| Click Rate | clicked / opened | Percentage |
| Bounce Rate | bounced / total | Percentage |

#### 4.2 Member Engagement View

Add to `CommunicationDetail.tsx`:
- List of recipients with individual status
- Filter by: delivered, opened, clicked, bounced
- Export to CSV option

#### 4.3 Aggregate Analytics

Add to `TeamCommunications.tsx`:
- Summary cards: Total sent, Avg open rate, Avg click rate
- Time-series chart: Communications over time
- Comparison: This month vs last month

#### 4.4 Deliverables

- [ ] Analytics cards in CommunicationHistory
- [ ] Per-communication stats in CommunicationDetail
- [ ] Recipient list with status indicators
- [ ] CSV export functionality
- [ ] Time-series visualization (optional)

---

### Phase 5: In-App Notifications (Medium-High Complexity)

**Objective:** Add persistent notification center for team announcements

#### 5.1 Database Schema

```sql
-- In-app notification storage
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  communication_id UUID REFERENCES team_communications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_preview TEXT,
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_user_notifs_user_id ON user_notifications(user_id);
CREATE INDEX idx_user_notifs_unread ON user_notifications(user_id, is_read) WHERE is_read = false;
```

#### 5.2 New Components

| Component | Description |
|-----------|-------------|
| `NotificationBell.tsx` | Header icon with unread count badge |
| `NotificationDropdown.tsx` | Quick view of recent notifications |
| `NotificationCenter.tsx` | Full notification inbox page |
| `NotificationItem.tsx` | Individual notification display |

#### 5.3 Real-Time Updates

Leverage Supabase Realtime:
```typescript
supabase
  .channel('user-notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'user_notifications',
    filter: `user_id=eq.${userId}`
  }, handleNewNotification)
  .subscribe()
```

#### 5.4 Deliverables

- [ ] `user_notifications` table migration
- [ ] Notification components (Bell, Dropdown, Center, Item)
- [ ] Real-time subscription setup
- [ ] Mark as read/unread functionality
- [ ] Archive/delete functionality
- [ ] Integration with header navigation

---

### Phase 6: Advanced Features (Higher Complexity - Future)

**Objective:** Add sophisticated communication capabilities

#### 6.1 Scheduling System

- Calendar-based schedule picker
- Timezone-aware delivery
- Recurring announcements (weekly standup reminders)

#### 6.2 Template Management

- Save custom templates
- Template variables ({{member_name}}, {{streak}}, {{completion_rate}})
- Template sharing across team admins

#### 6.3 Automated Triggers

| Trigger | Action |
|---------|--------|
| New member joins | Send welcome sequence |
| 7-day inactivity | Send re-engagement nudge |
| Milestone achieved | Send recognition |
| Streak broken | Send encouragement |

#### 6.4 A/B Testing

- Split recipients randomly
- Track per-variant metrics
- Declare winner automatically

---

## Testing Strategy

### Phase 1 Testing: Foundation

#### Unit Tests

| Test | Description | Expected Result |
|------|-------------|-----------------|
| Schema validation | Verify new tables created correctly | Tables exist with correct columns |
| RLS policies | Test team isolation | Users can only see their team's communications |
| Template generation | Test new email templates | HTML renders correctly |
| API validation | Test Edge Function inputs | Invalid inputs rejected |

#### Integration Tests

| Test | Description | Expected Result |
|------|-------------|-----------------|
| Create communication | POST to team-send-communication | Record created, recipients queued |
| List communications | GET team-get-communications | Returns paginated list |
| Send email | Trigger send for single recipient | Email delivered via Resend |
| Audit logging | Create communication | Entry added to audit_logs |

#### Regression Tests

| Existing Feature | Test | Verification |
|-----------------|------|--------------|
| Team member management | Add/remove member | Works as before |
| Email templates | Send welcome email | Works as before |
| Communication router | Route to email channel | Works as before |
| Manager Dashboard tabs | Navigate tabs | All tabs load correctly |

### Phase 2 Testing: UI

#### Component Tests

| Component | Test Cases |
|-----------|------------|
| ComposeMessage | Render, input validation, template selection, submit |
| RecipientSelector | Filter by role, status; count updates |
| MessagePreview | Renders email correctly, matches actual send |
| CommunicationHistory | Pagination, sorting, status filters |

#### E2E Tests (Cypress/Playwright)

| Scenario | Steps | Expected |
|----------|-------|----------|
| Send announcement | Login as manager → Communications → Compose → Send | Email sent, appears in history |
| View communication | Click on sent communication | Details and recipient list displayed |
| Filter recipients | Apply status filter | Recipient count updates |
| Cancel draft | Start compose → Cancel | No communication created |

#### Regression Tests

| UI Feature | Test |
|------------|------|
| Overview tab | Stats load correctly |
| Members tab | Member list displays |
| Reports tab | Charts render |
| Site Settings tab | Settings load |
| Team Admin tab | Management functions work |

### Phase 3 Testing: Delivery

#### Unit Tests

| Test | Description |
|------|-------------|
| Batch processing | Process 100 recipients in 2 batches |
| Rate limiting | Respect 100/min limit |
| Retry logic | Failed send retried with backoff |
| Webhook parsing | Parse Resend webhook payloads |

#### Integration Tests

| Test | Description |
|------|-------------|
| End-to-end delivery | Communication → Queue → Send → Delivered |
| Bounce handling | Simulate bounce → Status updated |
| Open tracking | Simulate open → Status updated |

#### Load Tests

| Scenario | Parameters | Acceptance |
|----------|------------|------------|
| Bulk send | 500 recipients | Complete within 10 minutes |
| Concurrent sends | 5 communications simultaneously | No race conditions |
| Webhook flood | 100 webhooks/second | All processed |

### Phase 4 Testing: Analytics

#### Unit Tests

| Calculation | Input | Expected Output |
|-------------|-------|-----------------|
| Delivery rate | 95/100 | 95% |
| Open rate | 50/95 | 52.6% |
| Click rate | 10/50 | 20% |

#### Visual Regression

- Analytics cards render correctly
- Charts display accurate data
- Mobile responsive layout

### Phase 5 Testing: In-App Notifications

#### Unit Tests

| Test | Description |
|------|-------------|
| Notification creation | Insert to user_notifications |
| Mark as read | Update is_read, set read_at |
| Unread count | Count where is_read = false |

#### Real-Time Tests

| Scenario | Expected |
|----------|----------|
| New notification | Bell badge updates immediately |
| Read notification | Badge decrements |

#### Regression Tests

| Feature | Verification |
|---------|--------------|
| Existing notifications | Schedule-notification still works |
| Push notifications | Unaffected by new system |

### Acceptance Criteria Summary

#### Phase 1
- [ ] New tables created with correct schema
- [ ] RLS policies enforce team isolation
- [ ] New email templates render correctly
- [ ] Edge Functions respond to valid/invalid input
- [ ] Audit logs capture communication actions
- [ ] **Regression:** All existing team management functions work

#### Phase 2
- [ ] Communications tab visible in Manager Dashboard
- [ ] Compose interface functional with template selection
- [ ] Recipient filtering works correctly
- [ ] Preview matches actual email
- [ ] Communication history lists all sent messages
- [ ] **Regression:** All other dashboard tabs function normally

#### Phase 3
- [ ] Scheduled communications process on time
- [ ] Rate limiting prevents API throttling
- [ ] Failed sends retry appropriately
- [ ] Webhooks update recipient status
- [ ] **Regression:** Existing scheduled notifications unaffected

#### Phase 4
- [ ] Analytics display accurate metrics
- [ ] Individual recipient status visible
- [ ] Export generates valid CSV
- [ ] **Regression:** Existing reporting unchanged

#### Phase 5
- [ ] Notifications appear in bell dropdown
- [ ] Unread count accurate
- [ ] Real-time updates work
- [ ] Mark read/archive functional
- [ ] **Regression:** Existing notification preferences respected

### Rollback Procedures

#### Phase 1 Rollback
```sql
-- Revert schema changes
DROP TABLE IF EXISTS team_communication_recipients;
DROP TABLE IF EXISTS team_communications;
ALTER TABLE user_comm_preferences
DROP COLUMN IF EXISTS team_announcements_enabled,
DROP COLUMN IF EXISTS team_digest_frequency;
```

#### Phase 2 Rollback
- Revert `ManagerDashboard.tsx` to remove communications tab
- Remove new component files
- No database changes to revert

#### Phase 3 Rollback
- Disable cron job for processing
- Remove Edge Functions
- Mark pending communications as 'cancelled'

#### Phase 4 Rollback
- Remove analytics components
- Revert to previous dashboard version

#### Phase 5 Rollback
```sql
DROP TABLE IF EXISTS user_notifications;
```
- Remove notification components
- Disable realtime subscription

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Email deliverability drops | High | Low | Use verified domain, implement SPF/DKIM, monitor sender reputation |
| Bulk sends trigger spam filters | High | Medium | Rate limit sends, use trusted Resend infrastructure, personalize content |
| Database performance degradation | Medium | Low | Add indexes, use pagination, archive old records |
| Edge Function timeouts | Medium | Medium | Process in batches, use background jobs |
| Resend API rate limits | Medium | Medium | Implement queue with backoff, batch requests |

### User Experience Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Notification fatigue | Users disable all notifications | Frequency caps, digest options, smart timing |
| Unclear opt-out | Legal exposure, user frustration | Prominent preference center, one-click unsubscribe |
| Confusing interface | Low adoption by managers | User testing, progressive disclosure, tooltips |
| Mobile experience | Managers can't send on-the-go | Responsive design, mobile-optimized compose |

### Data Integrity Concerns

| Concern | Mitigation |
|---------|------------|
| Duplicate sends | Unique constraint on (communication_id, user_id) |
| Orphaned records | Foreign key cascades on delete |
| Lost communications | Transaction-wrapped operations, soft delete |
| Privacy violations | RLS enforcement, opt-out respect, audit logging |

### Performance Considerations

| Scenario | Consideration | Approach |
|----------|---------------|----------|
| Large teams (500+ members) | Query performance | Paginated queries, indexed columns |
| High send volume | Processing throughput | Queue-based, batch processing, pg_cron |
| Real-time updates | Connection limits | Supabase Realtime with channel isolation |
| Analytics queries | Complex aggregations | Pre-computed stats, materialized views |

---

## Dependencies & Prerequisites

### Phase 1 Prerequisites
- Supabase project access with migration permissions
- Resend API key configured
- Existing `send-email` function deployed

### Phase 2 Prerequisites
- Phase 1 complete
- React component testing framework
- Rich text editor library (TipTap, Slate, or similar)

### Phase 3 Prerequisites
- Phase 1 & 2 complete
- pg_cron extension enabled
- Resend webhook endpoint configured

### Phase 4 Prerequisites
- Phase 3 complete
- Webhook data flowing correctly

### Phase 5 Prerequisites
- Phase 1-4 complete
- Supabase Realtime enabled

---

## Estimated Complexity

| Phase | Complexity | Justification |
|-------|------------|---------------|
| Phase 1 | Low | Schema additions, basic CRUD functions |
| Phase 2 | Medium | Multiple UI components, state management |
| Phase 3 | Medium | Queue processing, webhook handling, error recovery |
| Phase 4 | Low-Medium | Data aggregation, visualization |
| Phase 5 | Medium-High | Real-time system, new UI pattern |

---

## Appendix A: Existing System Compatibility Matrix

| Existing Feature | Impact | Notes |
|-----------------|--------|-------|
| `send-email` function | Extended | Add new templates |
| `communication-router` | Extended | Add team_announcement type |
| `schedule-notification` | None | Separate system |
| `ManagerDashboard.tsx` | Extended | Add Communications tab |
| `TeamMemberAdmin.tsx` | None | Separate functionality |
| `team_members` table | Read only | Query for recipients |
| `audit_logs` table | Extended | Log communication actions |
| `email_logs` table | Extended | Track bulk sends |
| `user_comm_preferences` | Extended | Add team announcement prefs |
| RLS policies | Extended | Add policies for new tables |

## Appendix B: Email Template Specifications

### Team Announcement Template

```html
Subject: 📢 {subject}

Header: "Team Announcement"
Body: {manager_name} from {team_name} says:
Content: {message_html}
CTA: "View in App" → {site_url}/notifications
Footer: Standard with unsubscribe
```

### Team Recognition Template

```html
Subject: 🏆 Kudos from your team!

Header: "You've Been Recognized!"
Body: {manager_name} wants to recognize your achievement:
Highlight Box: {recognition_message}
Stats: {achievement_details}
CTA: "Celebrate & Share" → {site_url}/dashboard
Footer: Standard
```

### Team Reminder Template

```html
Subject: ⏰ Reminder: {reminder_title}

Header: "Quick Reminder"
Body: {manager_name} wanted to remind you:
Content: {reminder_message}
CTA: "Take Action" → {action_url}
Footer: Standard with unsubscribe
```

---

## Document Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| Security Review | | | |

---

*This document is a living plan and will be updated as implementation progresses.*
