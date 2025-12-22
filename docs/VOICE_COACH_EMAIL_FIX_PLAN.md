# Voice Coach Email Recognition Fix Plan

**Document Version:** 1.0
**Created:** December 22, 2025
**Status:** AWAITING APPROVAL
**Risk Level:** LOW - Additive changes only, no breaking changes

---

## Executive Summary

The Voice Coach cannot reliably capture email addresses via voice recognition. This plan addresses the issue through three complementary fixes:

1. **Auto-load user profile data** - Already partially implemented, needs validation
2. **Email normalization helper** - Already exists, needs enhancement
3. **Cross-session memory** - Already implemented, needs frontend integration

**Key Finding:** Much of the infrastructure already exists in `voice-coach-session/index.ts`. The issue appears to be:
- Frontend not displaying profile-based confirmations
- Email normalization missing some speech patterns
- User doesn't see visual confirmation of recognized email

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Implementation Plan](#3-implementation-plan)
4. [Testing Strategy](#4-testing-strategy)
5. [Risk Assessment](#5-risk-assessment)
6. [Rollback Procedures](#6-rollback-procedures)

---

## 1. Current State Analysis

### 1.1 What Already Exists (DO NOT MODIFY without reason)

| Component | Location | Status |
|-----------|----------|--------|
| `getUserProfileData()` | `voice-coach-session/index.ts:258-294` | ✅ Implemented |
| `normalizeSpokenEmail()` | `voice-coach-session/index.ts:300-344` | ✅ Implemented |
| `getRecentSessionSummaries()` | `voice-coach-session/index.ts:349-375` | ✅ Implemented |
| `buildVoiceCoachPrompt()` | `voice-coach-session/index.ts:1048-1098` | ✅ Includes email rules |
| User profile loading | `processTranscript()` line 576 | ✅ Called on every message |
| Cross-session memory | `processTranscript()` line 580 | ✅ Loads 3 recent sessions |

### 1.2 Current `normalizeSpokenEmail()` Patterns

```typescript
// Already handles:
- "at" → "@"
- "dot/period/point" → "."
- "underscore/dash/hyphen" → "_", "-"
- Common domain completions (@gmail, @yahoo, etc.)
- Space removal
```

### 1.3 Current System Prompt Rules (lines 1072-1084)

```
EMAIL RULES:
- When user says "send to me", "my email", "send to myself" - USE their email
- NEVER ask the user to repeat or spell their own email address
- Only ask for email when sending to SOMEONE ELSE
- Always CONFIRM the email before sending
- If user speaks an email address, try to normalize it
```

---

## 2. Root Cause Analysis

### 2.1 Suspected Issues

| Issue | Impact | Priority |
|-------|--------|----------|
| **Voice recognition struggles with @ symbol** | User says "at" but browser transcribes as "at" not "@" | HIGH |
| **No visual confirmation of resolved email** | User doesn't see which email AI will use | HIGH |
| **Missing numeric patterns** | "one two three" not converted to "123" | MEDIUM |
| **No phonetic alphabet support** | "A as in alpha, B as in bravo" not handled | LOW |
| **Frontend doesn't show profile email** | User unaware AI knows their email | MEDIUM |

### 2.2 Speech Recognition Challenges

The Web Speech API transcribes spoken text literally:
- "john at gmail dot com" → "john at gmail dot com" (literal)
- "john@gmail.com" → "john at gmail dot com" (same result)

The normalization function must convert this back to a valid email.

---

## 3. Implementation Plan

### Phase 1: Validate & Test Current Implementation (30 min)

**Goal:** Confirm existing code is actually being executed

**Tasks:**
1. Add console logging to verify `getUserProfileData` returns email
2. Add console logging to verify system prompt includes email rules
3. Test with a known user account that has email in profile

**Files to modify:**
- `supabase/functions/voice-coach-session/index.ts` (add debug logs only)

### Phase 2: Enhance Email Normalization (1-2 hours)

**Goal:** Expand patterns to handle more spoken variations

**Tasks:**
1. Add numeric patterns ("one two three" → "123")
2. Add more domain variations ("g mail" → "gmail")
3. Add military/phonetic alphabet support (optional)
4. Add common misspellings ("gee mail" → "gmail")

**New patterns to add to `normalizeSpokenEmail()`:**

```typescript
// Number word to digit conversion
const numberWords: Record<string, string> = {
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
  'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
  'to': '2', 'too': '2', 'for': '4', 'fore': '4'
};

// Additional replacements
[/\s*g\s*mail\s*/gi, 'gmail'],
[/\s*gee\s*mail\s*/gi, 'gmail'],
[/\s*hot\s*mail\s*/gi, 'hotmail'],
[/\s*out\s*look\s*/gi, 'outlook'],
[/\s*i\s*cloud\s*/gi, 'icloud'],
[/\s*proton\s*mail\s*/gi, 'protonmail'],
```

**Files to modify:**
- `supabase/functions/voice-coach-session/index.ts`

### Phase 3: Frontend Visual Confirmation (2-3 hours)

**Goal:** Show user their recognized email before sending

**Tasks:**
1. Return `userProfileData.email` in voice coach response
2. Display email confirmation in `VoiceCoachWidget.tsx`
3. Add "sending to: your@email.com" indicator during tool execution

**Changes to `VoiceCoachWidget.tsx`:**

```tsx
// Add state for user profile
const [userEmail, setUserEmail] = useState<string | null>(null);

// Load from profile on mount
useEffect(() => {
  loadUserProfile();
}, []);

// Display confirmation when email action detected
{response?.actionType === 'send_email' && userEmail && (
  <div className="text-sm text-green-400 mb-2">
    📧 Using your email: {userEmail}
  </div>
)}
```

**Files to modify:**
- `components/VoiceCoachWidget.tsx`
- `supabase/functions/voice-coach-session/index.ts` (add `userEmail` to response)

### Phase 4: Enhanced AI Prompt Engineering (1 hour)

**Goal:** Make AI smarter about email confirmation

**Tasks:**
1. Add explicit examples to system prompt
2. Add fallback confirmation language
3. Train AI to say "I'll send to your email on file" not ask for email

**Enhanced system prompt addition:**

```
EMAIL CONVERSATION EXAMPLES:
- User: "Send that to my email" → AI: "I'll send that to [user's email]. Sending now..."
- User: "Email me a summary" → AI: "Perfect, sending to [user's email]."
- User: "Send to john at work dot com" → AI: "I'll send to john@work.com. Is that correct?"
- User: "Can you email my wife?" → AI: "What's her email address?"

NEVER say "What is your email?" when user refers to themselves.
```

**Files to modify:**
- `supabase/functions/voice-coach-session/index.ts` (`buildVoiceCoachPrompt()`)

### Phase 5: Cross-Session Memory Enhancement (1 hour)

**Goal:** Remember previously used email addresses for contacts

**Tasks:**
1. Store extracted emails in session metadata
2. Build contact memory from previous sessions
3. Allow "send to my wife" if wife's email was used before

**Database consideration:**
- May need new table `user_voice_contacts` or use existing `user_knowledge_chunks`

**Files to modify:**
- `supabase/functions/voice-coach-session/index.ts`
- New migration if needed

---

## 4. Testing Strategy

### 4.1 Manual Test Cases

| Test Case | Expected Result |
|-----------|-----------------|
| Say "Send to my email" | Uses profile email, confirms before sending |
| Say "Email me at john at gmail dot com" | Normalizes to john@gmail.com |
| Say "Send to one two three at test dot com" | Normalizes to 123@test.com |
| Say "Email my wife" (first time) | Asks for wife's email |
| Start new session | Previous context available |

### 4.2 Automated Tests

Add tests in `src/test/voice-coach-email.test.ts`:

```typescript
describe('normalizeSpokenEmail', () => {
  it('converts "john at gmail dot com"', () => {
    expect(normalizeSpokenEmail('john at gmail dot com')).toBe('john@gmail.com');
  });

  it('converts numbers', () => {
    expect(normalizeSpokenEmail('one two three at test dot com')).toBe('123@test.com');
  });

  it('handles spacing issues', () => {
    expect(normalizeSpokenEmail('john  at  g mail  dot  com')).toBe('john@gmail.com');
  });
});
```

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Break existing voice coach | Low | High | Additive changes only, don't remove code |
| Email normalization over-aggressive | Medium | Medium | Test thoroughly, add conservative patterns |
| Performance impact | Low | Low | Functions are lightweight |
| Privacy concern with email display | Low | Medium | Only show user's own email |

---

## 6. Rollback Procedures

### If Phase 2 causes issues:
```bash
# Revert normalization changes
git checkout HEAD~1 -- supabase/functions/voice-coach-session/index.ts
npx supabase functions deploy voice-coach-session
```

### If Phase 3 causes issues:
```bash
# Revert frontend changes
git checkout HEAD~1 -- components/VoiceCoachWidget.tsx
```

---

## 7. Implementation Summary

| Phase | Effort | Risk | Files Changed |
|-------|--------|------|---------------|
| Phase 1: Validate | 30 min | None | 1 (debug only) |
| Phase 2: Normalization | 1-2 hr | Low | 1 |
| Phase 3: Frontend | 2-3 hr | Low | 2 |
| Phase 4: AI Prompt | 1 hr | None | 1 |
| Phase 5: Memory | 1 hr | Low | 1-2 |

**Total Effort:** 5-8 hours
**Recommended Order:** Phase 1 → 2 → 4 → 3 → 5

---

## 8. Approval Checklist

Before implementation, confirm:

- [ ] Plan reviewed and approved
- [ ] Current voice coach is working (baseline)
- [ ] Test user account available with email in profile
- [ ] Supabase function deployment access confirmed

---

**AWAITING APPROVAL - No changes will be made until this plan is approved.**
