# 14-Day Launch Roadmap - Visionary AI
## Vision Board Creation & Print Features Public Launch

**Created:** December 11, 2025
**Target Launch Date:** December 25, 2025 (Christmas Day)
**Primary Goal:** Enable users to onboard, create vision boards, and purchase prints
**Owner:** Milton Overton

---

## Executive Summary

This roadmap outlines the critical path to launch the AI Interactive Vision Board platform for public use within 14 days. The focus is on three core user journeys:

1. **Onboarding** - New user signup and guided setup
2. **Vision Board Creation** - AI-powered vision generation and gallery management
3. **Print Ordering** - Purchase physical prints (posters, canvas, workbooks)

---

## Current Status Report (December 11, 2025)

### COMPLETED FEATURES (Production Ready)

| Feature | Component | Status | Notes |
|---------|-----------|--------|-------|
| **Authentication** | Supabase Auth | ✅ Complete | Email/password, RLS policies |
| **Onboarding Flow** | 9-step wizard | ✅ Complete | Theme selection, vision capture, habits |
| **AI Vision Generation** | Gemini 2.5 Pro | ✅ Complete | Image generation with styles |
| **Vision Gallery** | Gallery.tsx | ✅ Complete | View, download, share, delete |
| **Primary Vision Selection** | Gallery + Dashboard | ✅ Complete | Set as primary, display on dashboard |
| **Habit Tracking** | Habits system | ✅ Complete | Daily habits with streaks |
| **Action Plans** | ActionPlanAgent | ✅ Complete | AI-generated tasks from vision |
| **Financial Integration** | Plaid API | ✅ Complete | Bank connection, retirement planning |
| **Workbook V2** | Real PDF generation | ✅ Complete | 10 page types, 5 cover themes |
| **Print Shop UI** | PrintProducts.tsx | ✅ Complete | Product catalog, customization |
| **Stripe Integration** | Checkout sessions | ✅ Complete | Subscriptions & one-time payments |
| **Prodigi Integration** | Print fulfillment | ✅ Complete | SKU mapping, order submission |
| **Dashboard V2** | New dashboard | ✅ Complete | Vision hero, tasks, habits |
| **Voice Input** | Web Speech API | ✅ Complete | Voice-to-text for vision capture |
| **Reference Images** | Identity preservation | ✅ Complete | Photo upload for AI likeness |

### PARTIALLY COMPLETE (Needs Testing/Polish)

| Feature | Status | Issue | Priority |
|---------|--------|-------|----------|
| Gallery Buttons | ⚠️ Reported Issue | Buttons may have z-index issues | P0 |
| Profile API | ⚠️ Console Errors | 400/406 errors on load | P0 |
| Print Order Flow | ⚠️ Needs E2E Testing | Full checkout not tested | P0 |
| Workbook PDF Merge | ⚠️ Needs Testing | Cover + interior merge | P1 |
| Mobile Responsiveness | ⚠️ Needs Testing | All views on mobile | P1 |

### NOT IMPLEMENTED (Deferred for Launch)

| Feature | Notes |
|---------|-------|
| AMIE Theme UI | Backend ready, UI not implemented |
| Weekly Review UI | Backend ready, display pending |
| Email Notifications | Order confirmations not implemented |
| Real-time Tracking | Prodigi webhooks not integrated |
| Tax Calculation | Fixed estimates only |

---

## Database Structure Summary

### Core Tables (35+ Tables)

**User & Profile:**
- `profiles` - User accounts, credits, subscription tiers
- `user_identity_profiles` - AMIE theme selection
- `user_vision_profiles` - Onboarding summary

**Vision & Content:**
- `vision_boards` - Generated vision images (prompt, url, user_id)
- `reference_images` - Photo uploads for identity preservation
- `documents` - Knowledge base documents

**Print & Orders:**
- `poster_orders` - Poster/canvas orders with Prodigi integration
- `workbook_orders` - Comprehensive workbook orders
- `print_products` - Product catalog (8 core products)
- `workbook_templates` - 4 workbook editions

**Habits & Execution:**
- `habits` - User habits with frequency settings
- `habit_completions` - Daily completion tracking
- `action_tasks` - Vision-derived tasks

### Storage Buckets
- `visions` - Vision board images (public)
- `documents` - User documents (public)

---

## 14-Day Sprint Plan

### PHASE 1: CRITICAL BUG FIXES (Days 1-3)
**Goal:** Fix all blocking issues for core user flow

#### Day 1 (Dec 11) - Gallery & Profile Fixes

**Morning: Gallery Button Investigation**
- [ ] Add console.log to all button handlers in Gallery.tsx
- [ ] Test on Chrome, Safari, Mobile
- [ ] Identify exact failure mode (z-index, event propagation, or timing)

**Afternoon: Implement Gallery Fix**
```typescript
// Recommended fix: Add explicit z-index and pointer-events
<div className="flex justify-end gap-2 relative z-30 pointer-events-auto"
     onClick={(e) => e.stopPropagation()}>
  {/* Buttons */}
</div>
```

**Evening: Profile API Fix**
- [ ] Verify RLS policies in Supabase dashboard
- [ ] Add fallback profile creation in App.tsx
- [ ] Test with new user signup

#### Day 2 (Dec 12) - End-to-End Testing Setup

**Morning: Test User Flows**
1. New user signup → Onboarding → First vision
2. Returning user → Dashboard → Gallery
3. Print order → Checkout → Confirmation

**Afternoon: Fix Any Discovered Issues**
- Document all bugs found
- Fix critical path blockers immediately
- Create tickets for non-blocking issues

#### Day 3 (Dec 13) - Print Flow Verification

**Morning: Stripe Integration Testing**
- [ ] Test checkout session creation
- [ ] Verify webhook processing
- [ ] Test order status updates

**Afternoon: Prodigi Integration Testing**
- [ ] Test order submission (sandbox mode)
- [ ] Verify SKU mapping for all products
- [ ] Test error handling and fallbacks

---

### PHASE 2: CORE FEATURE POLISH (Days 4-7)
**Goal:** Ensure smooth user experience for launch

#### Day 4 (Dec 14) - Onboarding Polish

**Tasks:**
- [ ] Test all 9 onboarding steps end-to-end
- [ ] Verify LocalStorage persistence and recovery
- [ ] Test photo upload and identity description
- [ ] Verify vision generation success rate
- [ ] Test habit selection and creation

**Acceptance Criteria:**
- 100% of new users can complete onboarding
- Vision generates within 30 seconds
- No console errors during flow

#### Day 5 (Dec 15) - Vision Board Features

**Tasks:**
- [ ] Test AI vision generation with all 6 styles
- [ ] Verify prompt enhancement works
- [ ] Test voice input for vision capture
- [ ] Verify reference image integration
- [ ] Test iterative refinement flow

**Acceptance Criteria:**
- All 6 styles generate correctly
- Voice input transcribes accurately
- Refinement maintains context

#### Day 6 (Dec 16) - Gallery & Dashboard

**Tasks:**
- [ ] Test gallery with 20+ images
- [ ] Verify share functionality (all 4 methods)
- [ ] Test download (blob-based + fallback)
- [ ] Verify "Set as Primary" updates dashboard
- [ ] Test delete with confirmation

**Acceptance Criteria:**
- Gallery loads in <2 seconds
- All actions work on desktop AND mobile
- Primary vision displays correctly on dashboard

#### Day 7 (Dec 17) - Print Shop & Checkout

**Tasks:**
- [ ] Test all product types (posters, canvas, workbooks)
- [ ] Verify pricing calculations
- [ ] Test customization options
- [ ] Complete full checkout flow (Stripe test mode)
- [ ] Verify order confirmation page

**Acceptance Criteria:**
- All products display correctly
- Stripe checkout completes successfully
- Order saved to database with correct status

---

### PHASE 3: MOBILE & PERFORMANCE (Days 8-10)
**Goal:** Ensure cross-device compatibility and speed

#### Day 8 (Dec 18) - Mobile Testing

**Test Devices:**
- iPhone 12/13/14 (Safari)
- iPhone SE (small screen)
- Samsung Galaxy (Chrome)
- iPad (Safari)

**Test Each View:**
- [ ] Login/Signup
- [ ] Onboarding (all 9 steps)
- [ ] Dashboard
- [ ] Vision Board creation
- [ ] Gallery (touch interactions)
- [ ] Print Shop
- [ ] Checkout

**Common Issues to Fix:**
- Touch target sizes (min 44x44px)
- Image scaling on small screens
- Form inputs on iOS
- Modal sizing

#### Day 9 (Dec 19) - Performance Optimization

**Tasks:**
- [ ] Run Lighthouse audit (target 85+ score)
- [ ] Optimize image loading (lazy load)
- [ ] Verify page load times (<2 seconds)
- [ ] Test on 3G network simulation
- [ ] Fix any render-blocking issues

**Tools:**
- Chrome DevTools Performance tab
- Lighthouse CI
- Network throttling

#### Day 10 (Dec 20) - Cross-Browser Testing

**Browsers:**
- [ ] Chrome (Desktop + Mobile)
- [ ] Safari (Desktop + Mobile)
- [ ] Firefox (Desktop)
- [ ] Edge (Desktop)

**Test Focus:**
- CSS compatibility
- JavaScript functionality
- Form handling
- Payment flow

---

### PHASE 4: FINAL QA & LAUNCH PREP (Days 11-14)
**Goal:** Production deployment with confidence

#### Day 11 (Dec 21) - Full User Journey Testing

**New User Journey (4 hours):**
1. [ ] Sign up with new email
2. [ ] Complete onboarding wizard
3. [ ] Create first vision
4. [ ] Save to gallery
5. [ ] View dashboard with vision
6. [ ] Create habit
7. [ ] Order print product (test mode)

**Returning User Journey (2 hours):**
1. [ ] Log in
2. [ ] See primary vision on dashboard
3. [ ] Refine existing vision
4. [ ] Download and share vision
5. [ ] Order workbook (test mode)

**Power User Journey (2 hours):**
1. [ ] Create 5+ visions
2. [ ] Test gallery with many items
3. [ ] Set primary vision
4. [ ] Create multiple habits
5. [ ] Upload reference photos

#### Day 12 (Dec 22) - Security & Error Handling

**Security Checklist:**
- [ ] Verify RLS policies on all tables
- [ ] Test authentication token handling
- [ ] Check API error responses
- [ ] Review Stripe webhook security
- [ ] Test unauthorized access attempts

**Error Handling:**
- [ ] Test with network failures
- [ ] Verify error messages are user-friendly
- [ ] Test recovery from partial failures
- [ ] Verify no sensitive data in console

#### Day 13 (Dec 23) - Staging Deployment

**Tasks:**
- [ ] Deploy to staging environment
- [ ] Run full smoke test
- [ ] Test with real payment (Stripe test mode)
- [ ] Verify all edge functions deployed
- [ ] Check database migrations applied

**Staging Checklist:**
- [ ] Authentication works
- [ ] Vision generation works
- [ ] Gallery functions work
- [ ] Print ordering works
- [ ] Dashboard loads correctly

#### Day 14 (Dec 24) - Production Launch

**Pre-Launch (Morning):**
- [ ] Create database backup
- [ ] Document rollback procedure
- [ ] Set up error monitoring (Sentry/LogRocket)
- [ ] Prepare launch announcement

**Launch (Afternoon):**
- [ ] Deploy to production
- [ ] Smoke test all critical paths
- [ ] Monitor error logs
- [ ] Test one real payment (refund immediately)

**Post-Launch (Evening):**
- [ ] Monitor first user signups
- [ ] Watch for error spikes
- [ ] Prepare for Dec 25 traffic

---

## Critical Path Dependencies

```
Day 1-3: Bug Fixes
   ↓
Day 4-7: Feature Polish
   ↓
Day 8-10: Mobile & Performance
   ↓
Day 11-12: Final QA
   ↓
Day 13: Staging Deploy
   ↓
Day 14: Production Launch
```

**Blocking Dependencies:**
1. Gallery buttons MUST work → Enables print ordering
2. Profile API MUST succeed → Enables dashboard
3. Stripe webhook MUST process → Enables revenue
4. Prodigi submission MUST work → Enables fulfillment

---

## Risk Mitigation

### High Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gallery buttons broken | No print orders | Fix Day 1, test thoroughly |
| Stripe webhook fails | No payments | Test extensively Day 3 |
| AI generation slow/fails | Poor UX | Add fallback images, retry logic |
| Mobile breaks | Lost users | Test Day 8, fix immediately |

### Contingency Plans

**If Gallery Not Fixed by Day 3:**
- Add direct "Order Print" button to Dashboard
- Create alternative print ordering flow

**If Stripe Issues Persist:**
- Use Stripe's hosted checkout (simpler)
- Delay workbook orders, launch posters only

**If Mobile Breaks:**
- Launch desktop-only with mobile disclaimer
- Fast-follow mobile fix in Week 2

---

## Success Metrics for Launch

### Must Have (Exit Criteria)

- [ ] ✅ New user can complete signup + onboarding
- [ ] ✅ Vision board generates successfully
- [ ] ✅ Gallery displays and functions correctly
- [ ] ✅ Print order can be placed (test mode works)
- [ ] ✅ Payment processes successfully
- [ ] ✅ Order submits to Prodigi
- [ ] ✅ Zero critical console errors
- [ ] ✅ Works on mobile (basic functionality)

### Launch Day Monitoring

**Watch for:**
- User signup rate
- Onboarding completion rate
- Vision creation rate
- Print order conversion
- Error rate in logs
- Page load times

---

## Testing Checklists

### Onboarding Flow Test
```
[ ] Land on signup page
[ ] Create account with email
[ ] Verify email (if enabled)
[ ] Step 1: Select coaching theme
[ ] Step 2: Meet AI coach intro
[ ] Step 3: Enter vision statement (voice + text)
[ ] Step 4: Upload photo (optional)
[ ] Step 5: Set financial target
[ ] Step 6: Generate vision board
[ ] Step 7: Review action plan
[ ] Step 8: Select habits (3+ required)
[ ] Step 9: Complete + confetti
[ ] Redirect to dashboard
```

### Vision Board Test
```
[ ] Open Visualize view
[ ] Enter vision prompt
[ ] Click Generate
[ ] Wait for AI generation (<30s)
[ ] View generated image
[ ] Save to gallery
[ ] Refine with feedback
[ ] Try different style
[ ] Add reference image
[ ] Generate with reference
```

### Print Order Test
```
[ ] Open Gallery
[ ] Click Order Print on image
[ ] Select size (12x18, 18x24, 24x36)
[ ] Select finish (matte/gloss)
[ ] See price update
[ ] Enter shipping address
[ ] Click checkout
[ ] Complete Stripe payment (test)
[ ] See order confirmation
[ ] Verify order in database
[ ] Check Prodigi submission
```

### Workbook Order Test
```
[ ] Open Print Shop
[ ] Click Create Workbook
[ ] Step 1: Select template
[ ] Step 2: Enter title, subtitle
[ ] Step 2: Select cover theme
[ ] Step 3: Select vision boards (2-4)
[ ] Step 3: Select habits
[ ] Step 4: Preview pages
[ ] Step 5: Enter shipping
[ ] Step 5: Complete payment
[ ] Verify PDF generates
[ ] Verify order submitted
```

---

## Resource Requirements

### Team Allocation
- **Developer 1:** Bug fixes (Days 1-3), feature polish (Days 4-7)
- **Developer 2:** Testing (Days 4-10), QA (Days 11-12)
- **QA/Testing:** Mobile testing (Day 8), E2E testing (Day 11)

### Environment Access Needed
- Supabase dashboard (DB, Edge Functions, Logs)
- Stripe dashboard (test mode)
- Prodigi sandbox account
- Staging deployment environment
- Production deployment access

### Third-Party Dependencies
- Supabase (database, auth, storage)
- Stripe (payments)
- Prodigi (print fulfillment)
- Google Gemini API (AI generation)

---

## Post-Launch Plan (Week 2)

### Immediate (Dec 25-27)
- Monitor user activity
- Fix any critical bugs
- Respond to user feedback

### Short-term (Dec 28-31)
- Add email order confirmations
- Improve error messages
- Performance optimizations

### New Year (Jan 2025)
- Launch AMIE theme UI
- Add weekly review display
- Expand print product catalog

---

## Appendix: Key File Locations

### Core Components
- `components/GuidedOnboarding.tsx` - Onboarding wizard
- `components/VisionBoard.tsx` - Vision generation
- `components/Gallery.tsx` - Image gallery
- `components/PrintProducts.tsx` - Print shop
- `components/WorkbookOrderModal.tsx` - Workbook wizard
- `components/dashboard/DashboardV2.tsx` - Main dashboard

### Services
- `services/geminiService.ts` - AI integration
- `services/storageService.ts` - Database operations
- `services/printService.ts` - Print order logic

### Edge Functions
- `supabase/functions/create-checkout-session` - Stripe
- `supabase/functions/stripe-webhook` - Payment processing
- `supabase/functions/submit-to-prodigi` - Print fulfillment
- `supabase/functions/generate-workbook-pdf` - PDF generation

### Database
- `SUPABASE_SCHEMA.sql` - Base schema
- `supabase/migrations/` - All migrations

---

**Document Owner:** Milton Overton
**Last Updated:** December 11, 2025
**Review Date:** Daily during sprint
