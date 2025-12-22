# Image Pipeline Security Action Plan

**Document Version**: 1.0
**Created**: 2025-12-22
**Status**: AWAITING APPROVAL
**Risk Level**: HIGH - Requires careful execution to avoid service disruption

---

## Executive Summary

This action plan addresses two critical issues in the image generation pipeline:

1. **Invalid/Expired GEMINI_API_KEY** causing malformed URLs in the database
2. **Model Usage Verification** to confirm Nano Banana Pro is the primary path

**No changes will be implemented until this plan is approved.**

---

## Table of Contents

1. [Pre-Implementation Checklist](#1-pre-implementation-checklist)
2. [Phase 1: API Key Validation](#2-phase-1-api-key-validation)
3. [Phase 2: Database Cleanup](#3-phase-2-database-cleanup)
4. [Phase 3: Model Usage Verification](#4-phase-3-model-usage-verification)
5. [Phase 4: End-to-End Testing](#5-phase-4-end-to-end-testing)
6. [Rollback Procedures](#6-rollback-procedures)
7. [Risk Assessment](#7-risk-assessment)
8. [Frontend/Backend Impact Analysis](#8-frontendbackend-impact-analysis)

---

## 1. Pre-Implementation Checklist

Before executing ANY changes, verify the following:

### 1.1 Access Requirements

| Requirement | Location | Status |
|-------------|----------|--------|
| Supabase Dashboard Access | https://supabase.com/dashboard | [ ] Verified |
| Edge Function Secrets Access | Project Settings → Edge Functions | [ ] Verified |
| Database Read Access | SQL Editor or Table Editor | [ ] Verified |
| Database Write Access (for cleanup) | SQL Editor | [ ] Verified |
| Google AI Studio Access | https://aistudio.google.com | [ ] Verified |

### 1.2 Current State Documentation

Before making changes, document:

```bash
# Record current secret names (NOT values)
# Location: Supabase Dashboard → Project Settings → Edge Functions → Secrets
Current secrets configured:
- [ ] GEMINI_API_KEY exists: ___
- [ ] Other secrets: ___

# Record current database state
# Run in Supabase SQL Editor:
SELECT COUNT(*) as total_visions FROM vision_boards;
SELECT COUNT(*) as corrupted_urls
FROM vision_boards
WHERE image_url NOT LIKE 'https://%'
   OR image_url IS NULL;
```

### 1.3 Backup Confirmation

- [ ] Take database backup before any changes
- [ ] Screenshot current Edge Function secrets configuration
- [ ] Document the current working image generation state (if any)

---

## 2. Phase 1: API Key Validation

### Step 1.1: Check Current API Key Status

**Location**: Supabase Dashboard → Project Settings → Edge Functions → Secrets

**Action**: Verify `GEMINI_API_KEY` secret exists

**Expected Result**: Secret should be listed (value will be hidden)

**If Missing**:
- STOP - This explains the malformed URLs
- Proceed to Step 1.3 to add/update the key

### Step 1.2: Test Current API Key Validity

**Action**: Run the built-in diagnostic endpoint

```bash
# Replace with your actual Supabase URL and anon key
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/gemini-proxy' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"action": "diagnose"}'
```

**Expected Response (if key is valid)**:
```json
{
  "status": "success",
  "geminiKeyValid": true,
  "modelsAvailable": {
    "gemini-2.5-pro-preview-06-05": true,
    "gemini-2.5-flash-preview-05-20": true,
    ...
  }
}
```

**Expected Response (if key is invalid)**:
```json
{
  "status": "error",
  "geminiKeyValid": false,
  "error": "API_KEY_INVALID"
}
```

### Step 1.3: Generate New API Key (If Required)

**Pre-Condition**: Only proceed if Step 1.2 shows invalid key OR key is missing

**Location**: https://aistudio.google.com/apikey

**Actions**:
1. Log into Google AI Studio with the account authorized for this project
2. Navigate to "Get API key" section
3. Create a new API key OR use existing valid key
4. **IMPORTANT**: Ensure the key has access to:
   - Gemini 2.5 Pro (gemini-2.5-pro-preview-06-05)
   - Gemini 2.5 Flash (gemini-2.5-flash-preview-05-20)
   - Gemini 2.0 Flash Exp (gemini-2.0-flash-exp)
   - Imagen 3 (imagen-3.0-generate-002)

**Verification**:
```bash
# Test new key directly before adding to Supabase
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_NEW_KEY"
```

**Expected Result**: JSON list of available models (NOT an error)

### Step 1.4: Update Supabase Secret

**Location**: Supabase Dashboard → Project Settings → Edge Functions → Secrets

**Actions**:
1. Click "Add new secret" (or edit existing)
2. Name: `GEMINI_API_KEY`
3. Value: [Paste new API key from Step 1.3]
4. Click "Save"

**Post-Update Verification**:
1. Wait 60 seconds for Edge Function to pick up new secret
2. Re-run the diagnostic from Step 1.2
3. Confirm `geminiKeyValid: true`

### Step 1.5: Verify Environment Sync (If Using Vercel)

**Condition**: Only if frontend is deployed on Vercel

**Location**: Vercel Dashboard → Project → Settings → Environment Variables

**Check**: Ensure `GEMINI_API_KEY` is NOT set here (it should ONLY be in Supabase)

**Reason**: The API key must remain server-side only. Frontend should never have direct access.

---

## 3. Phase 2: Database Cleanup

**CRITICAL**: Only proceed AFTER Phase 1 is complete and API key is verified working

### Step 2.1: Assess Corruption Scope

**Location**: Supabase SQL Editor

**Action**: Run read-only diagnostic query

```sql
-- DO NOT MODIFY - Read only diagnostic
-- Count total vs corrupted records

SELECT
  'Total Records' as metric,
  COUNT(*) as count
FROM vision_boards

UNION ALL

SELECT
  'Corrupted URLs' as metric,
  COUNT(*) as count
FROM vision_boards
WHERE image_url NOT LIKE 'https://%'
   OR image_url NOT LIKE '%supabase%'

UNION ALL

SELECT
  'Valid URLs' as metric,
  COUNT(*) as count
FROM vision_boards
WHERE image_url LIKE 'https://%'
  AND image_url LIKE '%supabase%';
```

**Document Results**:
- Total Records: ___
- Corrupted URLs: ___
- Valid URLs: ___

### Step 2.2: Preview Corrupted Records

**Action**: Identify what will be affected

```sql
-- Preview first 20 corrupted records
SELECT
  id,
  user_id,
  title,
  image_url,
  created_at
FROM vision_boards
WHERE image_url NOT LIKE 'https://%'
   OR image_url NOT LIKE '%supabase%'
ORDER BY created_at DESC
LIMIT 20;
```

**Review**:
- [ ] Confirmed corrupted records are from failed API calls
- [ ] Verified these are not legitimate images with unusual URLs

### Step 2.3: Create Backup Table

**Action**: Preserve corrupted data before deletion

```sql
-- Create backup table with corrupted records
CREATE TABLE IF NOT EXISTS vision_boards_corrupted_backup AS
SELECT * FROM vision_boards
WHERE image_url NOT LIKE 'https://%'
   OR image_url NOT LIKE '%supabase%';

-- Verify backup created successfully
SELECT COUNT(*) as backed_up_records
FROM vision_boards_corrupted_backup;
```

**Document**: Backup record count: ___

### Step 2.4: Execute Cleanup (DESTRUCTIVE)

**WARNING**: This step DELETES data. Ensure backup is confirmed.

**Pre-Deletion Checklist**:
- [ ] Phase 1 complete - API key working
- [ ] Step 2.3 backup confirmed
- [ ] Corrupted record count matches expected
- [ ] Stakeholder approval obtained

**Action**:
```sql
-- DELETE corrupted records
-- WARNING: This is irreversible (except via backup table)
DELETE FROM vision_boards
WHERE image_url NOT LIKE 'https://%'
   OR image_url NOT LIKE '%supabase%';
```

### Step 2.5: Verify Cleanup Success

```sql
-- Post-cleanup verification
SELECT
  'Remaining Total' as metric,
  COUNT(*) as count
FROM vision_boards

UNION ALL

SELECT
  'Remaining Corrupted' as metric,
  COUNT(*) as count
FROM vision_boards
WHERE image_url NOT LIKE 'https://%'
   OR image_url NOT LIKE '%supabase%';
```

**Expected**: Remaining Corrupted = 0

---

## 4. Phase 3: Model Usage Verification

### Step 3.1: Verify Current Model Configuration

**File**: `supabase/functions/gemini-proxy/index.ts`
**Lines**: 32-54

**Current Expected Configuration**:
```typescript
// Lines 32-36 - PRIMARY MODEL (Nano Banana Pro)
const PRIMARY_IMAGE_MODEL =
  Deno.env.get('GOOGLE_IMAGE_MODEL_PRO') ||
  'gemini-2.5-pro-preview-06-05'  // Nano Banana Pro

// Lines 36-40 - FALLBACK 1
const SECONDARY_IMAGE_MODEL =
  Deno.env.get('GOOGLE_IMAGE_MODEL_SECONDARY') ||
  'gemini-2.5-flash-preview-05-20'  // Nano Banana Flash
```

**Verification Actions**:
1. [ ] Confirm `gemini-2.5-pro-preview-06-05` is primary model
2. [ ] Confirm no environment override (`GOOGLE_IMAGE_MODEL_PRO`) is set
3. [ ] Verify model fallback order matches documentation

### Step 3.2: Verify buildLikenessPreservingRequest() Function

**File**: `supabase/functions/gemini-proxy/index.ts`
**Lines**: 736-903

**Key Verification Points**:

| Line Range | Component | Expected Value | Status |
|------------|-----------|----------------|--------|
| 753-760 | Multi-turn enabled | 2+ turns | [ ] |
| 765-820 | Identity introduction | Base + ref images | [ ] |
| 823-879 | Scene generation | Likeness instructions | [ ] |
| 884 | responseModalities | `['TEXT', 'IMAGE']` | [ ] |

**Critical Check - Line 884**:
```typescript
// MUST be ['TEXT', 'IMAGE'], NOT ['IMAGE'] alone
responseModalities: ['TEXT', 'IMAGE']
```

**Why This Matters**: The Gemini API requires BOTH modalities. Using `['IMAGE']` alone causes silent failures.

### Step 3.3: Verify Model Usage in handleImageGeneration()

**File**: `supabase/functions/gemini-proxy/index.ts`
**Lines**: 442-642

**Expected Flow**:
```
1. Start with PRIMARY_IMAGE_MODEL (Nano Banana Pro)
2. Try Strategy A (3-turn complex)
3. If fail, try Strategy B (single-turn)
4. If fail, try Strategy C (ultra-simple)
5. If all fail, move to next model in chain
6. Repeat until success or all models exhausted
```

**Verification**:
- [ ] Model array starts with `PRIMARY_IMAGE_MODEL`
- [ ] No hardcoded override to different model
- [ ] Fallback chain intact

### Step 3.4: Test Model Selection Empirically

**Action**: Generate a test image and verify which model was used

```bash
# Test generation request
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/gemini-proxy' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "generate",
    "prompt": "A professional portrait in a modern office setting",
    "style": "cinematic"
  }'
```

**Expected Response Fields**:
```json
{
  "success": true,
  "imageUrl": "https://...",
  "modelUsed": "gemini-2.5-pro-preview-06-05",  // Should be Nano Banana Pro
  ...
}
```

**If modelUsed is NOT `gemini-2.5-pro-preview-06-05`**:
- Check if primary model failed (look at logs)
- Verify API key has access to Pro model
- Check for environment variable overrides

---

## 5. Phase 4: End-to-End Testing

### Step 5.1: Frontend Integration Test

**Test Cases**:

| Test ID | Scenario | Expected Result | Status |
|---------|----------|-----------------|--------|
| E2E-1 | Generate image without reference | Image generated, valid URL stored | [ ] |
| E2E-2 | Generate image with 1 reference | Likeness preserved, valid URL | [ ] |
| E2E-3 | Generate image with 3 references | All likenesses considered | [ ] |
| E2E-4 | Generate with title text | Text rendered on image | [ ] |
| E2E-5 | Generate with style selection | Style applied correctly | [ ] |
| E2E-6 | Error handling (no API key) | Graceful error message | [ ] |

### Step 5.2: Database Integrity Check

```sql
-- Verify new generations have valid URLs
SELECT
  id,
  image_url,
  created_at
FROM vision_boards
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;
```

**All URLs should match pattern**: `https://{project}.supabase.co/storage/v1/object/public/visions/...`

### Step 5.3: Monitor Edge Function Logs

**Location**: Supabase Dashboard → Edge Functions → gemini-proxy → Logs

**Watch For**:
- `[requestId] Using model: gemini-2.5-pro-preview-06-05`
- No `GEMINI_API_KEY not found` errors
- No repeated fallback chains (indicates primary model issues)

---

## 6. Rollback Procedures

### 6.1: Revert API Key Change

If new API key causes issues:

1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Delete current `GEMINI_API_KEY`
3. Add previous working key (if documented)
4. Wait 60 seconds for propagation
5. Test with diagnostic endpoint

### 6.2: Restore Deleted Records

If cleanup deleted valid records:

```sql
-- Restore all records from backup
INSERT INTO vision_boards
SELECT * FROM vision_boards_corrupted_backup;

-- Or restore specific records
INSERT INTO vision_boards
SELECT * FROM vision_boards_corrupted_backup
WHERE id IN ('uuid1', 'uuid2');
```

### 6.3: Revert Code Changes

If any code changes are made and cause issues:

```bash
# Identify last working commit
git log --oneline -10

# Revert to specific commit
git checkout <commit-hash> -- supabase/functions/gemini-proxy/index.ts

# Redeploy Edge Function
supabase functions deploy gemini-proxy
```

---

## 7. Risk Assessment

### High Risk Items

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API key rotation causes downtime | Medium | HIGH | Test key before production |
| Cleanup deletes valid records | Low | HIGH | Backup table created first |
| Model unavailable | Medium | Medium | Fallback chain handles this |

### Medium Risk Items

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Edge Function deployment fails | Low | Medium | Keep previous version tagged |
| Rate limits hit during testing | Medium | Low | Spread tests over time |

### Low Risk Items

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Diagnostic endpoint fails | Low | Low | Manual API testing available |

---

## 8. Frontend/Backend Impact Analysis

### 8.1: Frontend Components - NO CHANGES REQUIRED

The following frontend components interact with the image pipeline but require NO modifications for this fix:

| Component | File Path | Impact |
|-----------|-----------|--------|
| VisionBoardImageGenerator | `src/components/VisionBoard/...` | None - uses same API |
| ImageUploader | `src/components/Upload/...` | None - sends same params |
| ReferenceImageSelector | `src/components/...` | None - unchanged interface |

**Reason**: All changes are server-side (API key + database cleanup). Frontend API contract remains identical.

### 8.2: Backend Components - CHANGES ISOLATED

| Component | Location | Change Required | Risk |
|-----------|----------|-----------------|------|
| gemini-proxy Edge Function | `supabase/functions/gemini-proxy/` | API key update only | LOW |
| vision_boards table | Supabase Database | Cleanup corrupted rows | LOW |
| Storage bucket | Supabase Storage | No change | None |

### 8.3: Breaking Change Analysis

**Will This Break Existing Functionality?**

| Functionality | Before Fix | After Fix | Breaking? |
|---------------|------------|-----------|-----------|
| Image generation (new) | FAILING | WORKING | NO - Improvement |
| Existing valid images | Displayed | Displayed | NO |
| Corrupted image entries | Error on load | Removed | NO - Improvement |
| API response format | Unchanged | Unchanged | NO |
| Frontend API calls | Unchanged | Unchanged | NO |

**Conclusion**: No breaking changes expected. This plan fixes existing breakage.

---

## Approval Section

### Required Approvals

| Role | Name | Approved | Date |
|------|------|----------|------|
| Project Owner | | [ ] | |
| Backend Lead | | [ ] | |
| Database Admin | | [ ] | |

### Approval Conditions

Before approving, confirm:

1. [ ] Database backup strategy is in place
2. [ ] New API key has been generated and tested in isolation
3. [ ] Off-peak execution window identified (if applicable)
4. [ ] Rollback contacts available during execution
5. [ ] Monitoring dashboard accessible

---

## Execution Checklist

Upon approval, execute phases in order:

- [ ] **Phase 1**: API Key Validation (Steps 1.1-1.5)
- [ ] **Phase 2**: Database Cleanup (Steps 2.1-2.5)
- [ ] **Phase 3**: Model Usage Verification (Steps 3.1-3.4)
- [ ] **Phase 4**: End-to-End Testing (Steps 5.1-5.3)

---

**Document End**

*This plan was generated for review. No changes have been implemented.*
