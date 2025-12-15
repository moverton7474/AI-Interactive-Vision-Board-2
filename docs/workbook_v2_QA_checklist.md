# Workbook V2 QA Checklist

Use this checklist to verify the Workbook V2 implementation before release.

## Data Integrity

### Vision Board Selection
- [ ] Create 5-6 vision boards for a test user
- [ ] Open the workbook wizard and go to CONTENT step
- [ ] Select only 2-3 specific boards
- [ ] Generate preview
- [ ] Verify ONLY the selected boards appear in the preview
- [ ] Verify boards appear in the same order they were selected
- [ ] Verify the 4-board limit is enforced in the UI
- [ ] Verify disabled boards show reduced opacity

### Habit Tracker Data
- [ ] Create multiple habits for the test user
- [ ] Verify habits are displayed in the Habit Tracker page
- [ ] Verify habit names and descriptions are correct

### Cover Customization
- [ ] Change workbook title and verify it updates in preview
- [ ] Change subtitle and verify it updates
- [ ] Select each cover theme and verify preview changes:
  - [ ] Executive Dark (black/gold)
  - [ ] Faith & Purpose (ivory/burgundy)
  - [ ] Tropical Retirement (ocean blue)
  - [ ] Minimal White Gold (clean white)
  - [ ] Vision Board Cover (first board as background)

---

## Flow Navigation

### Forward Navigation
- [ ] TYPE_SELECTION → click template → advances to PERSONALIZE
- [ ] PERSONALIZE → click "Continue to Content" → advances to CONTENT
- [ ] CONTENT → click "Preview Workbook" → generates pages → advances to PREVIEW
- [ ] PREVIEW → click "Approve & Print" → advances to PRINT
- [ ] PRINT → click "Proceed to Checkout" → redirects to Stripe

### Backward Navigation
- [ ] PREVIEW has "Back to Content" button that works
- [ ] PRINT has ability to go back (if implemented)
- [ ] Closing wizard works from any step

### Error Handling
- [ ] No console errors during full flow
- [ ] Generation failure shows appropriate error message
- [ ] Empty vision boards state is handled gracefully

---

## Print/PDF Consistency

### Preview vs PDF
- [ ] Vision boards in preview match those sent to PDF generation
- [ ] Title/subtitle in preview match PDF
- [ ] Cover theme in preview matches PDF styling
- [ ] Page count in preview matches PDF page count

### Prodigi Order
- [ ] Order contains correct page count
- [ ] Order contains correct vision board image URLs
- [ ] Cover design matches selected theme
- [ ] Shipping address is captured correctly

### PDF Generation
- [ ] PDF generates without errors
- [ ] PDF contains all expected page types
- [ ] Vision board images are embedded in PDF
- [ ] Text is readable and properly positioned
- [ ] Page dimensions are correct (6x9 trade size)

---

## UI/UX Quality

### Visual Polish
- [ ] 3D mockup renders correctly on PERSONALIZE step
- [ ] 3D mockup renders correctly on PRINT step
- [ ] Cover theme selector shows all 5 options
- [ ] Selected theme has visible indicator
- [ ] Loading states show spinner and friendly message

### Responsive Design
- [ ] Wizard works on desktop (1200px+)
- [ ] Wizard works on tablet (768px)
- [ ] Wizard works on mobile (375px) - may have limitations

### Accessibility
- [ ] All buttons are keyboard accessible
- [ ] Form inputs have proper labels
- [ ] Color contrast is sufficient
- [ ] Loading states have aria-live announcements (if implemented)

---

## Marketing Hero (PrintProducts)

- [ ] Hero section displays at top of print shop
- [ ] 3D mockup is visible and styled correctly
- [ ] "Create Your Workbook" button opens wizard
- [ ] Feature list is readable
- [ ] Gradient background renders correctly

---

## Performance

- [ ] Page generation completes in < 5 seconds
- [ ] Preview loads without significant delay
- [ ] Images load with appropriate placeholders
- [ ] No memory leaks during wizard navigation

---

## Sign-off

| Area | Tested By | Date | Status |
|------|-----------|------|--------|
| Data Integrity | | | |
| Flow Navigation | | | |
| Print Consistency | | | |
| UI/UX Quality | | | |
| Marketing Hero | | | |
| Performance | | | |

**Notes:**

---

**Final Approval:**
- [ ] All critical items pass
- [ ] Known issues documented
- [ ] Ready for production deployment

Approved by: _______________ Date: _______________
