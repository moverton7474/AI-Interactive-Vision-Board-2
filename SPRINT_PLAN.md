# 🚀 2-Week Sprint Plan - AI Interactive Vision Board
## Fix Critical Issues & Launch-Ready MVP

**Sprint Duration:** December 4-18, 2025 (2 weeks)  
**Goal:** Fix all P0 bugs, launch revenue-generating features, achieve 8.5/10 UX score  
**Team:** TBD (Assign owners to each task)

---

## 🎯 Sprint Objectives

### Primary Goals
1. ✅ Fix all 4 P0 bugs (revenue blockers)
2. ✅ Enable full monetization (print ordering + sharing)
3. ✅ Eliminate all console errors
4. ✅ Achieve stable, production-ready state

### Success Metrics
- [ ] Gallery buttons work 100% of the time
- [ ] Zero console errors on page load
- [ ] Primary vision displays on dashboard
- [ ] Print ordering completes end-to-end
- [ ] At least 1 successful test purchase

---

## 📅 Week 1 (Dec 4-10): Critical Bug Fixes

### Day 1-2 (Wed-Thu): Gallery Button Investigation & Fix

**Owner:** TBD  
**Estimated:** 8-12 hours  
**Priority:** 🔴 P0 - HIGHEST

#### Tasks

**Day 1 Morning: Investigation (3 hours)**
- [ ] Review `Gallery.tsx` code (already done in audit)
- [ ] Add console.log to all button handlers:
  ```typescript
  const downloadImage = async (e: React.MouseEvent, url: string) => {
    console.log('🔍 Download clicked!', { url, timestamp: Date.now() });
    e.stopPropagation();
    // ... rest
  };
  
  const toggleShare = (e: React.MouseEvent, id: string) => {
    console.log('🔍 Share clicked!', { id, activeShareId });
    // ... rest
  };
  
  const handlePrint = (e: React.MouseEvent, img: VisionImage) => {
    console.log('🔍 Print clicked!', { imgId: img.id });
    // ... rest
  };
  ```
- [ ] Deploy to staging with logging
- [ ] Test on Desktop Chrome
- [ ] Test on Desktop Safari
- [ ] Test on Mobile (Chrome DevTools emulation)
- [ ] Document exact failure mode

**Day 1 Afternoon: Root Cause (3 hours)**
- [ ] Check z-index layering in browser inspector
- [ ] Test with`pointer-events: none` removed from text overlay
- [ ] Verify Tailwind `group-hover` compiles correctly
- [ ] Test clicking buttons before full hover completes
- [ ] Check if parent `onClick` captures events
- [ ] Review Tailwind production build

**Day 2 Morning: Implement Fix (4 hours)**

**Option A: If z-index issue**
```typescript
// Gallery.tsx line 137
<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 z-10">
  <p className="text-white text-sm line-clamp-2 font-medium mb-3 pointer-events-none">{img.prompt}</p>
  <div className="flex justify-end gap-2 relative z-30 pointer-events-auto">
    {/* Buttons here */}
  </div>
</div>
```

**Option B: If hover timing issue**
```typescript
// Make buttons always visible with opacity transition
<div className="absolute inset-0 flex flex-col justify-end p-4">
  <div className="bg-gradient-to-t from-black/80 to-transparent absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
  <p className="text-white text-sm line-clamp-2 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity">{img.prompt}</p>
  <div className="flex justify-end gap-2 relative z-10">
    {/* Buttons always clickable */}
  </div>
</div>
```

**Option C: If event propagation issue**
```typescript
// Add stopPropagation more aggressively
<div 
  className="flex justify-end gap-2 relative"
  onClick={(e) => e.stopPropagation()}  // ADD THIS
  onMouseDown={(e) => e.stopPropagation()}  // AND THIS
>
```

**Day 2 Afternoon: Test & Deploy (2 hours)**
- [ ] Test all three buttons on desktop
- [ ] Test all three buttons on mobile
- [ ] Verify share menu opens and closes
- [ ] Test download initiates correctly
- [ ] Test print modal opens
- [ ] Deploy to production
- [ ] Verify in production environment

**Deliverable:** ✅ Gallery buttons fully functional

---

### Day 2-3 (Thu-Fri): Profile API Errors

**Owner:** TBD  
**Estimated:** 4-6 hours  
**Priority:** 🔴 P0

#### Tasks

**Day 2 Afternoon: Database Investigation (2 hours)**
- [ ] Access Supabase dashboard
- [ ] Run query: `SELECT * FROM profiles WHERE id = '[user_id]';`
- [ ] Check if profile row exists for test user
- [ ] Run: `SELECT * FROM pg_policies WHERE tablename = 'profiles';`
- [ ] Review RLS policies for SELECT permissions
- [ ] Check `auth.users` triggers: `SELECT * FROM pg_trigger WHERE tgname LIKE '%user%';`
- [ ] Review Supabase function logs for errors

**Day 3 Morning: Fix Implementation (2 hours)**

**Fix 1: RLS Policies**
```sql
-- Enable RLS if not already
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_identity_profiles ENABLE ROW LEVEL SECURITY;

-- Create/Update SELECT policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view own identity" ON user_identity_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
```

**Fix 2: Profile Creation Trigger**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RET

URNS trigger AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (
    id,
    email,
    created_at,
    onboarding_completed,
    credits,
    subscription_tier
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.created_at,
    false,
    10,  -- Free credits
    'FREE'
  ) ON CONFLICT (id) DO UPDATE SET email = NEW.email;
  
  -- Create identity profile
  INSERT INTO public.user_identity_profiles (
    user_id,
    created_at
  ) VALUES (
    NEW.id,
    NEW.created_at
  ) ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Day 3 Afternoon: Frontend Error Handling (2 hours)**

```typescript
// App.tsx - Add to loadUserProfile function
const loadUserProfile = async () => {
  if (!session) return;
  
  try {
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onboarding_completed, financial_target, primary_vision_id, credits, subscription_tier')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      
      // If profile doesn't exist, create it
      if (profileError.code === 'PGRST116') {
        console.log('Profile not found, creating...');
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            email: session.user.email,
            onboarding_completed: false,
            credits: 10,
            subscription_tier: 'FREE'
          });
        
        if (!createError) {
          // Retry loading
          await loadUserProfile();
          return;
        }
      }
      
      // Set safe defaults
      setOnboardingCompleted(false);
      setFinancialTarget(null);
      setCredits(10);
      setSubscriptionTier('FREE');
      return;
    }

    // Success - load data
    if (profile) {
      setOnboardingCompleted(profile.onboarding_completed ?? false);
      setFinancialTarget(profile.financial_target);
      setCredits(profile.credits ?? 10);
      setSubscriptionTier(profile.subscription_tier || 'FREE');
      
      // Load primary vision if set
      if (profile.primary_vision_id) {
        const { data: visionData } = await supabase
          .from('vision_images')
          .select('url, prompt')
          .eq('id', profile.primary_vision_id)
          .single();
        
        if (visionData) {
          setPrimaryVisionUrl(visionData.url);
          setPrimaryVisionTitle(visionData.prompt);
        }
      }
    }

    // Load identity profile
    const { data: identity, error: identityError } = await supabase
      .from('user_identity_profiles')
      .select('theme_id')
      .eq('user_id', session.user.id)
      .single();

    if (identityError && identityError.code !== 'PGRST116') {
      console.error('Identity fetch error:', identityError);
    } else if (identity?.theme_id) {
      setSelectedThemeId(identity.theme_id);
    }

    // Set user name
    setUserName(session.user.email?.split('@')[0] || 'Friend');

    // Route appropriately
    if (profile?.onboarding_completed) {
      setView(AppView.DASHBOARD);
    } else {
      setView(AppView.GUIDED_ONBOARDING);
    }

  } catch (err) {
    console.error('Unexpected error loading profile:', err);
    setOnboardingCompleted(false);
  }
};
```

**Testing:**
- [ ] Create new test account
- [ ] Verify profile created automatically
- [ ] Check no console errors on login
- [ ] Test with existing account (moverton7474@gmail.com)
- [ ] Verify primary vision loads if set

**Deliverable:** ✅ Zero console errors, profile data loads correctly

---

### Day 3-4 (Fri-Sat): Execute Navigation Fix

**Owner:** TBD  
**Estimated:** 2-3 hours  
**Priority:** 🟡 P1

#### Tasks

**Investigation (30 min)**
- [ ] View `App.tsx` - check AppView enum
- [ ] Search for "ACTION_PLAN" vs "EXECUTE" in codebase
- [ ] Check navigation button onClick handler
- [ ] Review renderContent() switch cases

**Fix Implementation (1 hour)**

```typescript
// 1. Verify enum (types.ts or App.tsx)
export enum AppView {
  // ... other views
  ACTION_PLAN = 'ACTION_PLAN',  // Ensure this exists
  // ... rest
}

// 2. Fix navigation (App.tsx line ~1082)
<button 
  onClick={() => setView(AppView.ACTION_PLAN)}  // Correct value
  className={`text-sm font-medium transition-colors ${view === AppView.ACTION_PLAN ? 'text-navy-900' : 'text-gray-500 hover:text-navy-900'}`}
>
  Execute
</button>

// 3. Add/verify renderContent() case
case AppView.ACTION_PLAN:
  return (
    <ActionPlanAgent
      userName={userName}
      visions={/* pass vision data if needed */}
      onBack={() => setView(AppView.DASHBOARD)}
    />
  );
```

**Testing (30 min)**
- [ ] Click Execute in navigation
- [ ] Verify Action Plan Agent loads
- [ ] Test creating action plan
- [ ] Test back navigation
- [ ] Check no console errors

**Deliverable:** ✅ Execute navigation works correctly

---

### Day 4-5 (Sat-Sun): Workbook Section Counter Fix

**Owner:** TBD  
**Estimated:** 2-3 hours  
**Priority:** 🟡 P1

#### Tasks

**Investigation (1 hour)**
- [ ] View `WorkbookOrderModal.tsx`
- [ ] Find state variables for sections
- [ ] Trace section selection flow
- [ ] Check Step 2 → Step 3 state preservation
- [ ] Add console.logs to track state

**Fix Implementation (1 hour)**

```typescript
// WorkbookOrderModal.tsx

// Ensure single source of truth for sections
const [selectedSections, setSelectedSections] = useState<string[]>(() => {
  // Initialize with template's recommended sections
  return templates[0]?.recommendedSections || [];
});

// When template changes, update sections
useEffect(() => {
  if (selectedTemplate && step === 1) {
    setSelectedSections(selectedTemplate.recommendedSections);
  }
}, [selectedTemplate, step]);

// Section toggle handler  
const handleSectionToggle = (sectionId: string) => {
  setSelectedSections(prev => {
    const isSelected = prev.includes(sectionId);
    const updated = isSelected
      ? prev.filter(id => id !== sectionId)
      : [...prev, sectionId];
    console.log('Sections updated:', updated);  // Debug log
    return updated;
  });
};

// Step 3 display
<div className="text-sm text-gray-600">
  <p>Sections {selectedSections.length} included</p>
  <ul className="mt-2 space-y-1">
    {selectedSections.map(id => (
      <li key={id}>✓ {sectionLabels[id]}</li>
    ))}
  </ul>
</div>
```

**Testing (30 min)**
- [ ] Select template in Step 1
- [ ] Verify sections auto-selected in Step 2
- [ ] Toggle sections on/off
- [ ] Navigate to Step 3
- [ ] Verify count is correct
- [ ] Navigate back to Step 2
- [ ] Verify selections preserved

**Deliverable:** ✅ Section counter displays correctly

---

## Week 1 Summary
**By End of Day 5:**
- ✅ All 4 P0 bugs fixed
- ✅ Gallery buttons functional
- ✅ Zero console errors
- ✅ Navigate works correctly
- ✅ Workbook counter accurate

**Deploy to Production Friday EOD**

---

## 📅 Week 2 (Dec 11-18): Polish & Testing

### Day 6-7 (Mon-Tue): Primary Vision on Dashboard

**Owner:** TBD  
**Estimated:** 4-6 hours  
**Priority:** 🟢 P1

#### Tasks

**Implementation (3 hours)**

```typescript
// App.tsx - Add state
const [primaryVisionUrl, setPrimaryVisionUrl] = useState<string | null>(null);
const [primaryVisionTitle, setPrimaryVisionTitle] = useState<string>('');

// Already handled in loadUserProfile() fix above

// Dashboard.tsx - Add component
<PrimaryVisionCard
  imageUrl={primaryVisionUrl}
  title={primaryVisionTitle}
  onRefine={() => {
    // Load vision into Visualize view
    setSelectedGalleryImage({ url: primaryVisionUrl, prompt: primaryVisionTitle });
    onNavigate(AppView.VISION);
  }}
  onViewGallery={() => onNavigate(AppView.GALLERY)}
  onOrderPrint={() => {
    // Open print modal
    setPrintModalOpen(true);
  }}
/>
```

**Testing (1 hour)**
- [ ] Set primary vision in gallery
- [ ] Verify displays on dashboard
- [ ] Test Refine button
- [ ] Test View Gallery button
- [ ] Test Order Print button

**Deliverable:** ✅ Primary vision showcased on dashboard

---

### Day 7-8 (Tue-Wed): Tailwind Migration & Performance

**Owner:** TBD  
**Estimated:** 6-8 hours  
**Priority:** 🟠 P2

#### Tasks

**Setup (2 hours)**
```bash
# Install Tailwind
npm install -D tailwindcss@latest postcss autoprefixer

# Initialize config
npx tailwindcss init -p

# Configure tailwind.config.js
module.exports = {
  content: [
    './index.html',
    './components/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
    './*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'navy': {
          50: '#f8fafc',
          800: '#1E293B',
          900: '#0F172A',
        },
        'gold': {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
      },
      fontFamily: {
        'serif': ['Playfair Display', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
```

**Create CSS Entry (30 min)**
```css
/* index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom utilities */
@layer utilities {
  .animate-fade-in {
    animation: fadeIn 0.3s ease-in;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
}
```

**Update index.html (30 min)**
```html
<!-- REMOVE THIS -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- index.tsx - ADD THIS -->
import './index.css';
```

**Build & Test (3 hours)**
```bash
# Build
npm run build

# Test build output
npm run preview

# Check bundle size
ls -lh dist/
```

- [ ] Verify all styles compile correctly
- [ ] Check production build
- [ ] Test all pages for styling issues
- [ ] Verify animations work
- [ ] Compare before/after bundle size

**Deliverable:** ✅ Tailwind on build process, faster loads

---

### Day 8-9 (Wed-Thu): Mobile Responsiveness Testing

**Owner:** TBD  
**Estimated:** 6-8 hours  
**Priority:** 🟡 P1

#### Tasks

**Device Testing (4 hours)**
- [ ] iPhone 12/13/14 (Safari)
- [ ] iPhone SE (small screen)
- [ ] Samsung Galaxy S21 (Chrome)
- [ ] iPad (Safari)
- [ ] iPad Mini

**Test Each View:**
- [ ] Login/Signup
- [ ] Dashboard
- [ ] Visualize (vision creation)
- [ ] Gallery (grid + button interactions)
- [ ] Habits
- [ ] Voice Coach
- [ ] Print Shop
- [ ] Workbook customization
- [ ] Navigation menu

**Common Issues to Fix:**
- Touch target sizes (min 44x44px)
- Text readability
- Image scaling
- Form inputs on iOS
- Sticky navigation
- Modal sizing
- Horizontal scroll

**Deliverable:** ✅ All features work on mobile

---

### Day 9-10 (Thu-Fri): End-to-End Testing & QA

**Owner:** TBD  
**Estimated:** 8 hours  
**Priority:** 🔴 Critical

#### Complete User Flows

**New User Flow (2 hours)**
1. [ ] Sign up with new email
2. [ ] Verify email
3. [ ] Complete onboarding wizard
4. [ ] Create first vision
5. [ ] Save to gallery
6. [ ] View dashboard with vision
7. [ ] Create habit
8. [ ] Chat with Voice Coach
9. [ ] Order print product
   - DO NOT complete payment (test mode)

**Returning User Flow (1 hour)**
1. [ ] Log in
2. [ ] See primary vision on dashboard
3. [ ] Refine existing vision
4. [ ] Download vision
5. [ ] Share vision (test all methods)
6. [ ] Order workbook
   - Customize cover
   - Select sections
   - Select vision boards
   - Preview (check all sections display)
   - DO NOT complete payment

**Admin/Power User Flow (1 hour)**
1. [ ] Create 5+ visions
2. [ ] Test gallery with many items
3. [ ] Set primary vision
4. [ ] Create multiple habits
5. [ ] Complete weekly review
6. [ ] Upload documents to Knowledge Base

**Cross-Browser Testing (2 hours)**
- [ ] Chrome (Desktop & Mobile)
- [ ] Safari (Desktop & Mobile)
- [ ] Firefox (Desktop)
- [ ] Edge (Desktop)

**Performance Testing (1 hour)**
- [ ] Lighthouse audit (target 90+ score)
- [ ] Page load times (<2s)
- [ ] Image optimization
- [ ] Network throttling (3G simulation)

**Security Testing (1 hour)**
- [ ] SQL injection attempts
- [ ] XSS attempts
- [ ] CSRF protection
- [ ] Auth token inspection
- [ ] RLS policy verification

**Deliverable:** ✅ Production-ready application

---

## 🎯 Sprint Success Criteria

### Must Have (Exit Criteria)
- [ ] ✅ All 4 P0 bugs resolved
- [ ] ✅ Gallery buttons work on desktop & mobile
- [ ] ✅ Zero console errors
- [ ] ✅ Profile API returns 200 OK
- [ ] ✅ Primary vision displays on dashboard
- [ ] ✅ Execute navigation works
- [ ] ✅ Workbook counter accurate
- [ ] ✅ End-to-end purchase flow works (test mode)
- [ ] ✅ Mobile responsive (all major views)
- [ ] ✅ Performance: Lighthouse score >85

### Nice to Have (Stretch Goals)
- [ ] ⭐ Lighthouse score >90
- [ ] ⭐ All P2 items complete
- [ ] ⭐ Demo mode for unauthenticated users
- [ ] ⭐ Onboarding tutorial improvements

---

## 📊 Daily Standup Template

**What did you accomplish yesterday?**
- 

**What will you work on today?**
-

**Any blockers?**
-

**Confidence level (1-5) we'll hit sprint goals?**
- 

---

## 🚀 Launch Checklist (End of Week 2)

### Pre-Launch (Day 9)
- [ ] All tests passing
- [ ] No critical console errors
- [ ] Mobile tested on real devices
- [ ] Database backup created
- [ ] Rollback plan documented
- [ ] Monitoring/alerts set up

### Launch Day (Day 10)
- [ ] Deploy to production
- [ ] Smoke test all features
- [ ] Monitor error logs
- [ ] Test payment processing (Stripe test mode)
- [ ] Verify email sending
- [ ] Check API response times

### Post-Launch (Day 10+)
- [ ] Monitor user signups
- [ ] Track conversion metrics
- [ ] Check for error spikes
- [ ] Gather user feedback
- [ ] Plan Week 3 sprint

---

## 📈 Metrics to Track

### During Sprint
- Bugs fixed per day
- Tests passing
- Code review turnaround time
- Deploy frequency

### Post-Launch
- User signups
- Vision creation rate
- Print order conversions
- Average session duration
- Error rate
- Page load times

---

## 🎉 Definition of Done

Task is DONE when:
- [ ] Code written & tested locally
- [ ] Unit tests added (if applicable)  
- [ ] Code reviewed & approved
- [ ] Deployed to staging
- [ ] QA tested on staging
- [ ] Deployed to production
- [ ] Verified in production
- [ ] Documented (if needed)

---

**Sprint Owner:** TBD  
**Stakeholders:** TBD  
**Review Date:** December 18, 2025  
**Retrospective Date:** December 18, 2025

---

*"Good code is its own best documentation. As you're about to add a comment, ask yourself, 'How can I improve the code so that this comment isn't needed?'" - Steve McConnell*
