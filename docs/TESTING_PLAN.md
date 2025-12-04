# Visionary AI - Intuitive Testing Plan

## 1. Introduction & Objectives
**Goal**: Ensure the Visionary AI platform, specifically the **Workbook Feature**, is intuitive, simple to use, and flows naturally for our target audience.
**Target Audience**: Affluent couples (45-60), Executives, and High-Net-Worth Individuals. They value time, quality, and seamless experiences. They are likely non-technical but expect "Apple-like" polish.

## 2. Testing Methodology
We will use a combination of **Cognitive Walkthroughs** and **Heuristic Evaluation** to test each feature.

### Core Evaluation Criteria:
1.  **Discoverability**: Can the user find the feature without help?
2.  **Efficiency**: Can they complete the task with minimal clicks/steps?
3.  **Clarity**: Is the language and visual feedback clear and jargon-free?
4.  **Error Recovery**: If they make a mistake, can they fix it easily?
5.  **Delight**: Does the experience feel premium and rewarding?

---

## 3. Feature: Vision Workbook (Physical Print Product)

### Context
The Vision Workbook is a high-value physical artifact ($29.99 - $79.99) that solidifies the user's digital vision. It is a bridge between the AI world and physical reality.

### Test Scenarios

#### Scenario A: The "Cold Start" User (New User)
*   **Persona**: "Sarah", 52, just signed up. Has created 1 vision board but no habits.
*   **Goal**: Wants to see what the workbook is about.
*   **Critical Path**: Dashboard -> Click "Order Workbook" -> Select Template -> See "Not enough content" warning -> ??
*   **Success Metric**: User understands *why* they can't proceed and knows exactly *what* to do next (e.g., "Create 2 more vision boards").

#### Scenario B: The "Power User" (Ready to Buy)
*   **Persona**: "Michael", 48, Executive. Has 10 vision boards, 5 habits, and a financial plan.
*   **Goal**: Create a "Executive Vision Book" for his yearly planning.
*   **Critical Path**: Dashboard -> Order Workbook -> Select "Executive" -> Customize Title ("2026 Masterplan") -> Select specific 4 Vision Boards -> Select 3 Habits -> Checkout.
*   **Success Metric**: Frictionless flow. No confusion about which vision boards will be printed.

#### Scenario C: The "Gift Giver"
*   **Persona**: "Lisa", buying for her husband.
*   **Goal**: Create a highly personalized gift.
*   **Critical Path**: Focus on **Dedication** and **Cover Customization**.
*   **Success Metric**: The "Dedication" step feels prominent and special, not just a form field.

### Heuristic Checklist (Workbook Wizard)
| Heuristic | Question | Pass/Fail | Notes |
| :--- | :--- | :--- | :--- |
| **Visibility of System Status** | Does the user know where they are in the 5-step process? | ✅ | Step indicator present. |
| **Match between System & Real World** | Do terms like "Softcover" vs "Executive" match mental models? | ❓ | Need to verify if "Executive" implies a size or a binding. |
| **User Control & Freedom** | Can they go back to change the Template after reaching the Payment step? | ✅ | "Back" buttons present. |
| **Consistency and Standards** | Do the "Select" buttons look clickable? | ✅ | UI uses standard cards. |
| **Error Prevention** | Can they order an empty workbook? | ✅ | Validation logic exists (e.g., `validateContentStep`). |
| **Recognition rather than Recall** | Do they see thumbnails of their vision boards, not just names? | ✅ | Thumbnails are shown. |
| **Aesthetic and Minimalist Design** | Is the modal cluttered? | ❓ | Review "Content Selection" step for visual noise. |

---

## 4. Initial Evaluation & Recommendations (Based on Code Review)

### Current State Analysis
The `WorkbookOrderModal.tsx` implements a solid 5-step wizard. However, there are potential friction points for the "Cold Start" user.

### 🔴 Critical Issues (Must Fix)
1.  **Dead End for Low Content**: If a user has 0 vision boards, they see a message: *"Generate vision boards from the Dashboard..."*. This forces them to **close the modal**, navigate away, generate, and come back.
    *   **Recommendation**: Add a **"Create Vision Board"** button *inside* the modal (or a "Save Draft & Create Content" action) to keep them in the flow. Or allow them to proceed with "Placeholder" art for a preview.
    *   **Status**: ✅ FIXED. Added "Create Vision Board Now" button that navigates to the generator.

2.  **Habit Dead End**: Similar to vision boards, if a user selects "Habit Tracker" but has 0 habits, they see a message with no action.
    *   **Recommendation**: Add a **"Create Habits"** button inside the modal.
    *   **Status**: ✅ FIXED. Added "Create Habits Now" button that navigates to the habit tracker.

3.  **"Executive" Expectations**: The "Executive" edition requires at least 1 vision board. If selected as default but the user has none, they might get stuck.
    *   **Recommendation**: Smart default. If user has 0 boards, default to "Softcover" or a "Journal" edition that relies less on images, or prompt to generate immediately.

### 🟡 Usability Improvements
1.  **Preview Visibility**: The `WorkbookPreviewModal` is mentioned but not prominent in the main flow.
    *   **Recommendation**: Add a **"Preview Inside"** button on the Template Selection cards so users can see a digital flipbook *before* they even start customizing. This builds desire.

2.  **Dedication Prominence**: For a premium product, the "Dedication" field in Step 2 is just a textarea.
    *   **Recommendation**: Make this a "Special Touch" step. Show a preview of how the dedication looks on the page (e.g., italicized, centered).

3.  **Shipping Transparency**: Ensure shipping costs are calculated/shown *before* the final payment click to avoid sticker shock. (Currently calculated in `subtotal + shippingCost`).

### 🟢 Delight Opportunities
1.  **"Unboxing" Preview**: Show a 3D render of the specific book type (Hardcover vs Softcover) changing as they select options.
2.  **AI Coach Note**: In the "Coach Letter" section, allow them to input a specific "Focus Topic" for the AI to write about, making it feel even more personal.

## 5. Next Steps
1.  Implement the **"Create Content"** bridge for empty states.
2.  Enhance the **Visual Preview** of the workbook.
3.  Run a simulated walkthrough of **Scenario A** (Cold Start) to verify the fix.
