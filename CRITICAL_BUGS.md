# 🚨 Critical Bugs & Issues - AI Interactive Vision Board

**Last Updated:** December 4, 2025  
**Source:** Comprehensive UX Audit by Google Anti-Gravity Agent  
**Priority Key:** P0 = Blocking/Revenue Loss | P1 = High Impact | P2 = Medium | P3 = Low

---

## P0 - CRITICAL (Revenue Blockers)

### ❌ BUG #1: Gallery Buttons Appear Non-Functional in Production

**Status:** 🔴 CRITICAL - Revenue Blocking  
**Severity:** HIGH - Prevents monetization  
**Component:** `components/Gallery.tsx`  
**Discovered:** Dec 3, 2025 during autonomous UX testing

#### Description
Share, Download, and Order Print buttons on vision cards in the Gallery appear non-responsive during user testing. Buttons are visible on hover but do not trigger expected actions when clicked.

#### Evidence
- **User Testing:** Clicked each button 3+ times across multiple sessions
- **Wait Time:** 10+ seconds per interaction
- **Console:** No JavaScript errors when buttons clicked
- **Network:** No network activity observed forShare/Download
- **DOM:** Buttons exist and have correct HTML structure

#### Expected Behavior
1. **Share Button:** Opens dropdown menu with Email, Gmail, Twitter, Copy Link options
2. **Download Button:** Initiates browser download of vision image  
3. **Order Print Button:** Opens PrintOrder Modal for purchasing

####Current Behavior
- Click appears to register (no console errors)
- No modal appears for Share
- No download initiates for Download
- PrintOrderModal doesn't open for Order Print

#### Impact
- ❌ Users cannot share visions → **No viral growth**
- ❌ Users cannot download creations → **Poor ownership experience**
- ❌ Users cannot order prints from gallery → **Direct revenue loss**
- 📊 **Estimated Loss:** $12-20 per user in missed print sales

#### Root Cause Analysis

**Code Review Findings:**
```typescript
// Gallery.tsx - All event handlers ARE properly implemented

const downloadImage = async (e: React.MouseEvent, url: string) => { // ✅ EXISTS
const toggleShare = (e: React.MouseEvent, id: string) => { // ✅ EXISTS  
const handlePrint = (e: React.MouseEvent, img: VisionImage) => { // ✅ EXISTS
```

**Possible Causes:**
1. ✅ **Z-Index Layering Issue** - Overlay may be blocking clicks
2. ✅ **Hover State Timing** - Buttons invisible until hover completes
3. ✅ **Event Propagation** - Parent `onClick` may be capturing events
4. ⚠️ **Mobile/Touch Events** - May work on desktop but fail on touch devices
5. ⚠️ **Tailwind CSS Build Issue** - `group-hover` may not compile correctly in production

#### Recommended Fix

**Option 1: Add z-index and pointer-events**
```typescript
{/* Line 137 - Add z-index */}
<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 z-10">
  <p className="text-white text-sm line-clamp-2 font-medium mb-3 pointer-events-none">{img.prompt}</p>
  <div className="flex justify-end gap-2 relative z-20">
    {/* Buttons here - remove any pointer-events: none */}
```

**Option 2: Always show buttons with fade transition**
```typescript
{/* Make buttons always visible but faded */}
<div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4">
  <p className="text-white text-sm line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity">{img.prompt}</p>
  <div className="flex justify-end gap-2">
    {/* Buttons always visible */}
```

**Option 3: Debug logging**
```typescript
const downloadImage = async (e: React.MouseEvent, url: string) => {
  console.log('Download clicked!', url); // ADD THIS
  e.stopPropagation();
  // ... rest of function
};
```

#### Testing Checklist
- [ ] Test on Chrome Desktop
- [ ] Test on Safari Desktop  
- [ ] Test on Mobile Chrome
- [ ] Test on Mobile Safari
- [ ] Test with DevTools mobile emulation
- [ ] Verify console logs when buttons clicked
- [ ] Test with Tailwind production build
- [ ] Check z-index inspector in browser

#### Assignment
**Owner:** TBD  
**Estimated Effort:** 4-8 hours  
**Target Completion:** Week 1

---

### ❌ BUG #2: Profile API Errors (400/406)

**Status:** 🔴 CRITICAL - User Experience Impact  
**Severity:** HIGH - Affects all logged-in users  
**Component:** Supabase RLS Policies + `App.tsx` profile loading  
**Discovered:** Dec 3, 2025 - Persistent across all testing sessions

#### Description
Console errors appear on every page load after authentication:
```
GET /rest/v1/profiles?id=eq.[user_id]&select=* 400 (Bad Request)
GET /rest/v1/user_identity_profiles?user_id=eq.[user_id]&select=* 406 (Not Acceptable)
```

#### Impact
- ❌ Primary vision doesn't display on dashboard (despite 16 visions in gallery)
- ❌ User theme preferences may not load
- ❌ Financial target data missing from dashboard
- ❌ Personalization features degraded
- ❌ Creates impression of broken/incomplete app

#### Evidence
```
User: moverton7474@gmail.com
Visions in Gallery: 16
Dashboard Display: "Create Your Vision" (empty state)
Expected: Featured primary vision card
```

#### Root Cause Hypotheses

**1. RLS Policies Too Restrictive**
```sql
-- Check current policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

**2. Profile Not Created on Signup**
- Trigger may be missing or failing
- Profile row doesn't exist for user

**3. Query Syntax Issue**
- API query may have incorrect syntax
- Column names may be mismatched

#### Recommended Fix

**Step 1: Verify Profile Exists**
```sql
SELECT * FROM profiles WHERE id = '[user_id]';
-- If empty, profile creation is broken
```

**Step 2: Fix RLS Policies**
```sql
-- Ensure authenticated users can SELECT their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- For user_identity_profiles
CREATE POLICY "Users can view own identity"
  ON user_identity_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

**Step 3: Create Profile Trigger**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.created_at,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.user_identity_profiles (user_id, created_at)
  VALUES (NEW.id, NEW.created_at)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Step 4: Frontend Error Handling**
```typescript
// App.tsx - Add graceful fallback
const loadUserProfile = async () => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      // CREATE PROFILE IF MISSING
      if (error.code === 'PGRST116') { // Row not found
        await createUserProfile(session.user.id, session.user.email);
        await loadUserProfile(); // Retry
        return;
      }
      // Set defaults instead of breaking
      setOnboardingCompleted(false);
      setFinancialTarget(null);
      return;
    }

    // Normal handling
    if (profile) {
      setOnboardingCompleted(profile.onboarding_completed ?? false);
      setFinancialTarget(profile.financial_target);
      // ... rest
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
};
```

#### Testing Checklist
- [ ] Check Supabase logs for exact error messages
- [ ] Verify RLS policies in Supabase dashboard
- [ ] Test with new user signup
- [ ] Test with existing user login
- [ ] Verify profile row exists in database
- [ ] Check `auth.users` trigger is active
- [ ] Test primary vision display after fix

#### Assignment
**Owner:** TBD  
**Estimated Effort:** 2-4 hours  
**Target Completion:** Week 1

---

### ⚠️ BUG #3: "Execute" Navigation Redirects to Gallery

**Status:** 🟡 HIGH - Feature Inaccessible  
**Severity:** MEDIUM - Blocks Action Plan feature  
**Component:** `App.tsx` routing logic  
**Discovered:** Dec 3-4, 2025 - Consistent across multiple sessions

#### Description
Clicking "Execute" in main navigation consistently loads Gallery view instead of Action Plan Agent interface.

#### Evidence
**Testing Sessions:** 3 separate attempts
- Session 1: Execute click → Gallery displayed
- Session 2: Execute click → Gallery displayed  
- Session 3: Execute click → Gallery displayed

**DOM Analysis:**
- Navigation button Index: 7 (labeled "Execute")
- Clicked element correct
- Result: Gallery heading + vision cards displayed

#### Expected Behavior
Navigate to Action Plan Agent view with:
- AI-powered action plan generation
- Task breakdown interface
- Progress tracking
- Vision-to-action conversion tools

#### Current Behavior
Gallery view loads showing 16 saved visions

#### Root Cause Analysis

**Check `App.tsx` Routing:**
```typescript
// Line 1075 area - Check navigation onClick
<button onClick={() => setView(AppView.EXECUTE)}>Execute</button>

// renderContent() function - Check case statement
case AppView.ACTION_PLAN: // or AppView.EXECUTE?
  return <ActionPlanAgent ... />;

// Verify enum matches
enum AppView {
  EXECUTE = 'EXECUTE', // or ACTION_PLAN?
  GALLERY = 'GALLERY',
}
```

**Possible Issues:**
1. `AppView.EXECUTE` not defined in enum
2. Navigation sets wrong AppView value
3. `renderContent()` missing case for EXECUTE
4. `AppView.EXECUTE` accidentally routing to GALLERY
5. Action Plan component not imported

#### Recommended Fix

**Step 1: Check App.tsx enum**
```typescript
// types.ts or App.tsx
export enum AppView {
  LANDING = 'LANDING',
  GUIDED_ONBOARDING = 'GUIDED_ONBOARDING',
  DASHBOARD = 'DASHBOARD',
  VISION = 'VISION',
  GALLERY = 'GALLERY',
  ACTION_PLAN = 'ACTION_PLAN', // ← Should exist
  PRINT = 'PRINT',
  // ...
}
```

**Step 2: Fix Navigation**
```typescript
// Verify button onClick
<button onClick={() => setView(AppView.ACTION_PLAN)}>
  Execute
</button>
```

**Step 3: Add renderContent() case**
```typescript
const renderContent = () => {
  switch (view) {
    case AppView.ACTION_PLAN:
      return (
        <ActionPlanAgent
          visions={/* vision data */}
          onClose={() => setView(AppView.DASHBOARD)}
        />
      );
    // ... other cases
  }
};
```

#### Testing Checklist
- [ ] Verify AppView enum includes ACTION_PLAN
- [ ] Check navigation button onClick value
- [ ] Verify renderContent() has ACTION_PLAN case
- [ ] Test navigation after fix
- [ ] Verify no console errors
- [ ] Test back navigation from Action Plan

#### Assignment
**Owner:** TBD  
**Estimated Effort:** 1-2 hours  
**Target Completion:** Week 1

---

### ⚠️ BUG #4: Workbook Section Counter Shows "0 Sections"

**Status:** 🟡 MEDIUM - User Confusion  
**Severity:** MEDIUM - Affects $79.99 purchase confidence  
**Component:** `components/WorkbookOrderModal.tsx`  
**Discovered:** Dec 4, 2025 during workbook customization testing

#### Description
Step 3 of workbook customization displays "Sections 0 included" in order summary, despite 6 sections being selected in Step 2.

#### Evidence
**Testing Flow:**
- Step 1: Selected "Executive Vision Planner" ($79.99) ✅
- Step 2: Entered personalization (title, subtitle, dedication) ✅
- Step 2: All 6 sections checked by default ✅
  * Letter from Vision Coach
  * Financial Overview
  * 3-Year Roadmap
  * Habit Tracker  
  * Reflection Journal
  * Notes
- Step 3: Summary shows "Sections 0 included" ❌
- Navigated back to Step 2: Sections still checked ✅
- Returned to Step 3: Still shows "0 included" ❌

#### Impact
- ❌ User uncertainty about what they're purchasing
- ❌ May abandon checkout thinking selections weren't saved
- ❌ Reduces confidence in $79.99 purchase

#### Root Cause Analysis

**State Management Issue:**
- Sections selected in Step 2 form state
- Summary in Step 3 reads from different state variable
- State not persisting between wizard steps

**Check WorkbookOrderModal.tsx:**
```typescript
const [selectedSections, setSelectedSections] = useState<string[]>([]);
const [includedSections, setIncludedSections] = useState<string[]>([]);
```

**Possible Issues:**
1. Two different state variables for sections
2. Form doesn't update correct state on checkbox change
3. Default checked sections not adding to state array
4. Step navigation clears section state

#### Recommended Fix

**Option 1: Debug State Flow**
```typescript
// Step 2 - Section checkboxes
const handleSectionToggle = (sectionId: string) => {
  console.log('Toggling section:', sectionId);
  setIncludedSections(prev => {
    const newSections = prev.includes(sectionId)
      ? prev.filter(id => id !== sectionId)
      : [...prev, sectionId];
    console.log('New sections:', newSections);
    return newSections;
  });
};

// Step 3 - Display count
<p>Sections {includedSections.length} included</p>
```

**Option 2: Initialize with Default Sections**
```typescript
// Initialize state with template's recommendedSections
const [includedSections, setIncludedSections] = useState<string[]>(
  selectedTemplate?.recommendedSections || []
);
```

**Option 3: useEffect to Sync**
```typescript
useEffect(() => {
  if (step === 2 && selectedTemplate) {
    // Auto-select recommended sections if none selected
    if (includedSections.length === 0) {
      setIncludedSections(selectedTemplate.recommendedSections);
    }
  }
}, [step, selectedTemplate]);
```

#### Testing Checklist
- [ ] Add console.logs to track state changes
- [ ] Verify checkbox onChange updates correct state
- [ ] Test navigating between Step 2 and Step 3
- [ ] Verify count displays correctly
- [ ] Test with different templates
- [ ] Test manually unchecking/checking sections

#### Assignment
**Owner:** TBD  
**Estimated Effort:** 2-3 hours  
**Target Completion:** Week 1

---

## P1 - HIGH PRIORITY

### 🔶 ENHANCEMENT #5: Add Primary Vision to Dashboard

**Status:** 🟢 Enhancement  
**Severity:** MEDIUM - Degrades returning user experience  
**Component:** `components/dashboard/Dashboard.tsx` + `App.tsx`  
**Discovered:** Dec 3, 2025

#### Description
Dashboard displays empty "Create Your Vision" state despite user having 16 visions saved in gallery. No primary vision is showcased.

#### Expected Behavior
- Display user's selected primary vision as hero element
- Quick actions: View in Gallery, Refine, Order Print
- "Create New Vision" as secondary CTA

#### Impact
- Returning users don't see their progress/achievements
- Feels like starting from scratch every login
- Misses opportunity to celebrate user's work

#### Recommended Implementation
```typescript
// Dashboard.tsx
{primaryVisionUrl && (
  <div className="mb-8">
    <h3 className="text-lg font-semibold mb-3 text-navy-900">Your Primary Vision</h3>
    <div 
      className="relative group cursor-pointer rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow"
      onClick={() => onNavigate(AppView.GALLERY)}
    >
      <img 
        src={primaryVisionUrl} 
        alt="Primary Vision" 
        className="w-full h-80 object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-6">
        <p className="text-white text-lg font-semibold">
          {primaryVisionTitle || 'Your Featured Vision'}
        </p>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white text-navy-900 rounded-lg font-medium text-sm hover:bg-gold-500">
            Refine
          </button>
          <button className="px-4 py-2 bg-gold-500 text-navy-900 rounded-lg font-medium text-sm hover:bg-gold-600">
            Order Print
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

#### Effort
2-4 hours (after Profile API fix)

---

## P2 - MEDIUM PRIORITY

### 🔷 BUG #6: Tailwind CDN in Production

**Status:** 🟠 Performance Issue  
**Component:** `index.html`

#### Description
Using Tailwind CSS CDN link instead of compiled build process.

#### Console Warning
```
⚠️ You are using the Tailwind CSS CDN in production.
For best performance, install Tailwind CSS via npm.
```

#### Impact
- Slower page load times
- Larger bundle size (entire Tailwind library loaded)
- Cannot use purge/tree-shaking
- Not following production best practices

#### Fix: Migrate to Build Process
See `UX_AUDIT_REPORT_COMPLETE.md` Section P1 #6 for full migration steps.

#### Effort
4-6 hours

---

### 🔷 BUG #7: Missing Autocomplete Attributes

**Status:** 🟠 UX Polish  
**Component:** `components/Login.tsx`

#### Quick Fix
```tsx
<input 
  type="email" 
  autocomplete="email"  // ADD THIS
  ...
/>
<input 
  type="password" 
  autocomplete="current-password"  // For login
  autocomplete="new-password"  // For signup
  ...
/>
```

#### Effort
15 minutes

---

## P3 - ENHANCEMENTS (Backlog)

8. Gallery search & filtering
9. Vision titles/descriptions
10. Habit streak calendar
11. Coach conversation history
12. Keyboard shortcuts
13. Micro-animations
14. Dark mode
15. Multi-language support

---

## 📊 Summary

| Priority | Count | Est. Effort | Impact |
|----------|-------|-------------|--------|
| P0 | 4 | 10-17 hours | Revenue blocking |
| P1 | 1 | 2-4 hours | User experience |
| P2 | 2 | 4-7 hours | Performance |
| P3 | 8 | 40+ hours | Nice-to-have |

**Critical Path (Week 1):** Fix P0 issues = ~3 days of focused work → Unlocks monetization

---

**Document Version:** 1.0  
**Last Updated:** December 4, 2025  
**Next Review:** After P0 fixes completed
