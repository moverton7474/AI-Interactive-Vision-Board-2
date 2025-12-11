# Testing Checklist - 14-Day Launch
## Manual Testing Guide for Vision Board & Print Features

**Last Updated:** December 11, 2025
**Target:** Verify all core user flows before Christmas launch

---

## Pre-Testing Setup

### Environment
- [ ] Deploy latest code to staging
- [ ] Run SQL migration: `20251211_fix_identity_schema.sql`
- [ ] Verify Supabase edge functions are deployed
- [ ] Confirm Stripe test mode is active
- [ ] Confirm Prodigi sandbox mode is active

### Test Accounts
- [ ] Create fresh test account (new user flow)
- [ ] Have existing account ready (returning user flow)

---

## Test 1: New User Onboarding

### 1.1 Authentication
```
[ ] Navigate to landing page
[ ] Click "Get Started" or "Sign Up"
[ ] Enter valid email and password
[ ] Submit form - should redirect to onboarding
[ ] Check console for errors (should be none)
```

### 1.2 Onboarding Step 1 - Theme Selection
```
[ ] See 5 theme options displayed
[ ] Click on a theme (e.g., "Faith & Purpose")
[ ] Theme should highlight as selected
[ ] "Continue" button should become active
[ ] Click Continue
```

### 1.3 Onboarding Step 2 - Coach Introduction
```
[ ] See personalized coach message based on theme
[ ] Click Continue
```

### 1.4 Onboarding Step 3 - Vision Capture
```
[ ] See text area for vision input
[ ] Type vision text (min 20 characters required)
[ ] Test voice input if available (microphone icon)
[ ] Continue button activates when text is valid
[ ] Click Continue
```

### 1.5 Onboarding Step 4 - Photo Upload (Optional)
```
[ ] See option to upload photo
[ ] Test "Skip" button - should proceed to next step
[ ] OR upload a photo:
    [ ] Click upload area
    [ ] Select image file
    [ ] See preview
    [ ] Enter identity description
    [ ] Click Continue
```

### 1.6 Onboarding Step 5 - Financial Target
```
[ ] See financial target options ($500K, $1M, $1.5M, $2M+, Custom)
[ ] Select one option
[ ] Continue button activates
[ ] Click Continue
```

### 1.7 Onboarding Step 6 - Vision Generation
```
[ ] See "Generating..." status message
[ ] Wait for AI to generate image (up to 30 seconds)
[ ] See generated vision board image
[ ] Auto-advances to next step when complete
```

### 1.8 Onboarding Step 7 - Action Plan Preview
```
[ ] See AI-generated tasks based on vision
[ ] Tasks display with titles and dates
[ ] Click Continue
```

### 1.9 Onboarding Step 8 - Habits Setup
```
[ ] See theme-specific habit suggestions
[ ] Select at least 1 habit (3+ required)
[ ] Selected habits should highlight
[ ] Continue button activates with 3+ selected
[ ] Click Continue
```

### 1.10 Onboarding Step 9 - Completion
```
[ ] See congratulations screen with confetti
[ ] See summary of what was created
[ ] Click "Go to Dashboard"
[ ] Redirect to Dashboard view
```

---

## Test 2: Dashboard Verification

### 2.1 Dashboard Load
```
[ ] Dashboard loads without errors
[ ] No console errors
[ ] Primary vision displays in hero area
[ ] Habit streak bar visible
[ ] Today's tasks section visible
```

### 2.2 Navigation
```
[ ] Click each nav item and verify correct view loads:
    [ ] Dashboard
    [ ] Visualize (Vision Board)
    [ ] Gallery
    [ ] Habits
    [ ] Print Shop
```

---

## Test 3: Vision Board Creation

### 3.1 Create New Vision
```
[ ] Navigate to Visualize
[ ] Enter vision prompt in text area
[ ] Click "Generate" button
[ ] See loading indicator
[ ] Vision image generates successfully
[ ] Image displays in preview area
```

### 3.2 Refine Vision
```
[ ] With generated image displayed
[ ] Enter refinement feedback
[ ] Click "Refine"
[ ] New image generates based on feedback
```

### 3.3 Save to Gallery
```
[ ] Click "Save" button
[ ] Confirmation toast appears
[ ] Navigate to Gallery
[ ] Saved vision appears in gallery
```

---

## Test 4: Gallery Features

### 4.1 Gallery Display
```
[ ] Gallery loads with saved visions
[ ] Images display in grid layout
[ ] Hover over image - buttons become visible
[ ] Primary vision badge displays if set
```

### 4.2 Gallery Buttons (CRITICAL - P0 Fix)
```
[ ] Hover over a vision image
[ ] Test SHARE button:
    [ ] Click Share icon
    [ ] Dropdown menu appears
    [ ] Click "Copy Link" - link copied
    [ ] Click "Email" - email app opens
    [ ] Click "Twitter" - Twitter intent opens

[ ] Test DOWNLOAD button:
    [ ] Click Download icon
    [ ] Browser download initiates
    [ ] File saves to downloads folder

[ ] Test PRINT button:
    [ ] Click Print icon
    [ ] PrintOrderModal opens

[ ] Test DELETE button:
    [ ] Click Delete icon
    [ ] Confirmation dialog appears
    [ ] Confirm delete
    [ ] Image removed from gallery
```

### 4.3 Lightbox View
```
[ ] Click on image (not buttons)
[ ] Lightbox modal opens
[ ] Full-size image displays
[ ] Action buttons visible in lightbox
[ ] Click "Set as Primary" - primary badge updates
[ ] Click "Refine This" - navigates to Visualize with image
[ ] Click X or background to close
```

### 4.4 Mobile Gallery Test
```
[ ] Open on mobile device or emulator
[ ] Gallery loads correctly
[ ] Tap on image - lightbox opens
[ ] Tap on buttons - actions work
[ ] No double-tap required
```

---

## Test 5: Print Order Flow

### 5.1 Print Order Modal
```
[ ] Click Print button on gallery image
[ ] PrintOrderModal opens
[ ] See print preview on left
[ ] See configuration options on right
```

### 5.2 Product Configuration
```
[ ] Select "Poster" product type
[ ] Select size (12x18, 18x24, 24x36)
[ ] Select finish (Matte/Gloss for poster)
[ ] Price updates correctly
[ ] Click "Continue to Shipping"
```

### 5.3 Canvas Configuration
```
[ ] Select "Canvas" product type
[ ] Finish option disappears (canvas has no finish)
[ ] Size options update
[ ] Price updates to canvas pricing
```

### 5.4 Shipping Form
```
[ ] Fill in shipping form:
    [ ] Full Name
    [ ] Address Line 1
    [ ] Address Line 2 (optional)
    [ ] City
    [ ] State
    [ ] Zip Code
    [ ] Country (dropdown)
[ ] Click "Continue to Payment"
```

### 5.5 Payment Review
```
[ ] See order summary
[ ] See shipping address
[ ] See pricing breakdown
[ ] First-time discount applied if eligible (30%)
[ ] Total calculated correctly
[ ] Click "Pay & Place Order via Stripe"
```

### 5.6 Stripe Checkout
```
[ ] Redirects to Stripe checkout page
[ ] Order details display
[ ] Enter test card: 4242 4242 4242 4242
[ ] Enter any future expiry, any CVC
[ ] Complete payment
[ ] Redirects back to app
[ ] Success screen shows OR simulation mode message
```

---

## Test 6: Workbook Order Flow

### 6.1 Access Workbook Wizard
```
[ ] Navigate to Print Shop
[ ] Click "Create Workbook" or similar
[ ] WorkbookOrderModal opens
```

### 6.2 Template Selection (Step 1)
```
[ ] See workbook template options
[ ] Select a template (e.g., Executive Vision Planner)
[ ] Click Continue
```

### 6.3 Personalization (Step 2)
```
[ ] Enter workbook title
[ ] Enter subtitle (optional)
[ ] Select cover theme (5 options)
[ ] See cover preview update
[ ] Click Continue
```

### 6.4 Content Selection (Step 3)
```
[ ] See vision boards to include (select 2-4)
[ ] See habits to include
[ ] Select content
[ ] Click Continue
```

### 6.5 Preview (Step 4)
```
[ ] See page-by-page preview
[ ] Navigate through pages
[ ] Verify content matches selections
[ ] Click Continue
```

### 6.6 Payment (Step 5)
```
[ ] Enter shipping address
[ ] See total price
[ ] Complete Stripe checkout
```

---

## Test 7: Habit Tracking

### 7.1 View Habits
```
[ ] Navigate to Habits view
[ ] See list of habits from onboarding
[ ] Streak counts display
```

### 7.2 Complete Habit
```
[ ] Click checkmark on a habit
[ ] Habit marked as complete
[ ] Streak updates
[ ] Completion logged with date
```

### 7.3 Create New Habit
```
[ ] Click "Add Habit" button
[ ] Fill in habit details
[ ] Save habit
[ ] New habit appears in list
```

---

## Test 8: Error Handling

### 8.1 Network Errors
```
[ ] Disconnect network
[ ] Try to generate vision
[ ] See appropriate error message
[ ] Reconnect network
[ ] Retry works
```

### 8.2 Auth Session Expiry
```
[ ] Wait for session to expire (or clear tokens)
[ ] Try to perform action
[ ] Redirects to login
```

### 8.3 Invalid Input
```
[ ] Try empty vision prompt - shows validation message
[ ] Try invalid email in forms - shows validation message
```

---

## Test 9: Cross-Browser Testing

### Desktop Browsers
```
[ ] Chrome (latest)
    [ ] All features work
    [ ] No console errors

[ ] Safari (latest)
    [ ] All features work
    [ ] No console errors

[ ] Firefox (latest)
    [ ] All features work
    [ ] No console errors

[ ] Edge (latest)
    [ ] All features work
```

### Mobile Browsers
```
[ ] iOS Safari
    [ ] Gallery buttons work on tap
    [ ] Forms work correctly
    [ ] Modal sizing correct

[ ] Android Chrome
    [ ] Gallery buttons work on tap
    [ ] Forms work correctly
    [ ] Modal sizing correct
```

---

## Test 10: Performance

### 10.1 Page Load Times
```
[ ] Landing page loads in < 2 seconds
[ ] Dashboard loads in < 2 seconds
[ ] Gallery loads in < 3 seconds (with images)
```

### 10.2 Lighthouse Audit
```
[ ] Run Lighthouse on landing page
[ ] Performance score > 85
[ ] Accessibility score > 90
[ ] Best Practices score > 85
```

---

## Bug Report Template

When reporting issues, include:

```markdown
**Bug Title:** [Short description]

**Environment:**
- Browser:
- Device:
- OS:

**Steps to Reproduce:**
1.
2.
3.

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happens]

**Console Errors:**
[Copy any console errors]

**Screenshot:**
[Attach if relevant]
```

---

## Sign-Off Checklist

### Pre-Launch Approval
```
[ ] All Test 1-10 sections passed
[ ] No P0 bugs remaining
[ ] No critical console errors
[ ] Performance acceptable
[ ] Cross-browser tested
[ ] Mobile tested on real devices
```

### Approved By:
- [ ] Developer: _______________
- [ ] QA: _______________
- [ ] Product Owner: _______________

**Date:** _______________

---

**Notes:**
- Document any issues found during testing
- Create GitHub issues for bugs
- Re-test after fixes are deployed
