# E2E Testing Checklist - Day 2 (December 12, 2025)

**Dev Server:** http://localhost:3000/
**Tester:** Manual testing required
**Purpose:** Validate core user journeys before Day 3 print flow verification

---

## Test Environment Setup

- [ ] Dev server running at http://localhost:3000/
- [ ] Browser DevTools console open (check for errors)
- [ ] Network tab open (monitor API calls)
- [ ] Test email account ready for new signups

---

## TEST FLOW 1: New User Signup + Onboarding

**Goal:** Complete user can sign up and create their first vision

### Step 1.1: Landing Page
- [ ] Navigate to http://localhost:3000/
- [ ] Verify landing page loads without errors
- [ ] Click "Get Started" or Sign Up button
- [ ] Verify login/signup form appears

### Step 1.2: Account Creation
- [ ] Enter test email (e.g., test+dec12@example.com)
- [ ] Enter password (min 6 characters)
- [ ] Click Sign Up
- [ ] Verify no console errors
- [ ] Verify redirect to onboarding

### Step 1.3: Onboarding Wizard (9 Steps)
- [ ] **Step 1:** Theme Selection - Select a coaching theme
- [ ] **Step 2:** AI Coach Intro - Read and continue
- [ ] **Step 3:** Vision Statement - Enter text OR use voice input
- [ ] **Step 4:** Photo Upload (Optional) - Upload or skip
- [ ] **Step 5:** Financial Target - Select amount or skip
- [ ] **Step 6:** Vision Generation - Wait for AI image
- [ ] **Step 7:** Action Plan Preview - Review tasks
- [ ] **Step 8:** Habit Selection - Select 3+ habits
- [ ] **Step 9:** Completion - Verify confetti animation
- [ ] Verify redirect to Dashboard

### Step 1.4: Dashboard Verification
- [ ] Dashboard loads without errors
- [ ] Primary vision displays (if generated)
- [ ] Quick action buttons visible (Edit, New, Print, Workbook)
- [ ] Navigation menu functional

**Expected Results:**
- Zero console errors throughout flow
- All 9 onboarding steps complete
- Vision saved to gallery
- Dashboard displays user's content

---

## TEST FLOW 2: Returning User Experience

**Goal:** Existing user can log in and interact with their content

### Step 2.1: Login
- [ ] Navigate to http://localhost:3000/
- [ ] Click "Log In"
- [ ] Enter existing credentials
- [ ] Verify redirect to Dashboard (not onboarding)

### Step 2.2: Dashboard Features
- [ ] Primary vision card displays
- [ ] "Edit Vision" button works
- [ ] "New Vision" button works
- [ ] "Print" button opens print modal
- [ ] "Workbook" button opens workbook modal
- [ ] Habit streak bar visible

### Step 2.3: Gallery Navigation
- [ ] Click "Gallery" in navigation
- [ ] Verify gallery loads with saved visions
- [ ] Hover over vision card - buttons appear
- [ ] **Download button** - Click and verify download starts
- [ ] **Share button** - Click and verify share menu opens
- [ ] **Print button** - Click and verify print modal opens
- [ ] Click vision card - verify redirects to VisionBoard editor

### Step 2.4: Navigation Test
- [ ] Dashboard (Ascension) - loads correctly
- [ ] Visualize - loads VisionBoard
- [ ] Gallery - loads gallery grid
- [ ] Execute - loads Action Plan Agent (NOT gallery!)
- [ ] Habits - loads habit tracker
- [ ] Coach - loads voice coach
- [ ] Print - loads print products
- [ ] Workbook - opens workbook modal

**Expected Results:**
- All navigation items work correctly
- Gallery buttons are functional
- No console errors

---

## TEST FLOW 3: Print Order Flow (Partial - Full test Day 3)

**Goal:** Verify print ordering UI works up to checkout

### Step 3.1: From Gallery
- [ ] Navigate to Gallery
- [ ] Click "Order Print" on any vision
- [ ] Print modal opens
- [ ] Select size (12x18, 18x24, 24x36)
- [ ] Select finish (Matte/Gloss)
- [ ] Price updates correctly
- [ ] "Proceed to Checkout" button visible

### Step 3.2: From Dashboard
- [ ] Navigate to Dashboard
- [ ] Click "Print" quick action button
- [ ] Verify print modal opens
- [ ] Can select vision to print

### Step 3.3: From Print Products Page
- [ ] Navigate to Print Products (via nav)
- [ ] View product catalog
- [ ] Select a product
- [ ] Verify customization options appear

**Note:** Do NOT complete checkout - Stripe testing is Day 3

---

## TEST FLOW 4: Workbook Order Flow (Partial)

**Goal:** Verify workbook wizard UI works

### Step 4.1: Open Workbook Modal
- [ ] Click "Workbook" in navigation
- [ ] Modal opens

### Step 4.2: Step 1 - Template Selection
- [ ] Templates display correctly
- [ ] Select a template
- [ ] Price shown
- [ ] "Next" button works

### Step 4.3: Step 2 - Personalization
- [ ] Enter title
- [ ] Enter subtitle (optional)
- [ ] Select cover theme
- [ ] "Next" button works

### Step 4.4: Step 3 - Content Selection
- [ ] Vision boards listed (from gallery)
- [ ] Can select 2-4 visions
- [ ] Habits listed
- [ ] **VERIFY:** Section count displays correctly (not "0 Sections")
- [ ] "Next" button works

### Step 4.5: Step 4 - Preview
- [ ] Preview pages render
- [ ] All selected content visible

**Expected Results:**
- Wizard navigation works
- Section count displays correctly
- Preview renders

---

## Console Error Checklist

During testing, monitor for these specific errors:

- [ ] No `400 Bad Request` on profile fetch
- [ ] No `406 Not Acceptable` on identity fetch
- [ ] No `PGRST116` errors (row not found)
- [ ] No JavaScript runtime errors
- [ ] No network failures on API calls

---

## Bug Reporting Template

If bugs are found, document them here:

### Bug #X: [Title]
**Severity:** P0/P1/P2
**Component:** [File name]
**Steps to Reproduce:**
1.
2.
3.

**Expected:**
**Actual:**
**Console Error (if any):**
**Screenshot:** [if applicable]

---

## Summary Checklist

| Flow | Status | Notes |
|------|--------|-------|
| New User Signup | [ ] Pass / [ ] Fail | |
| Returning User | [ ] Pass / [ ] Fail | |
| Print Order UI | [ ] Pass / [ ] Fail | |
| Workbook Wizard | [ ] Pass / [ ] Fail | |
| Console Errors | [ ] None / [ ] Found | |

---

**Testing Complete:** [ ] Yes / [ ] No
**Blocker Issues Found:** [ ] Yes / [ ] No
**Ready for Day 3:** [ ] Yes / [ ] No

---

*Created: December 12, 2025*
*For: Visionary AI 10-Day Launch Sprint*
