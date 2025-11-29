# Visionary SaaS - PR & Development Roadmap

## Project Overview
Visionary is a high-end, AI-first SaaS platform designed to help couples and individuals visualize, plan, and manifest their dream retirement. By combining financial reality checks with generative AI vision boarding, Visionary offers a unique emotional and practical approach to retirement planning.

## 1. Public Relations (PR) Plan

### Target Audience
- **Primary:** Affluent couples aged 45-60 planning for retirement.
- **Secondary:** Financial Advisors looking for engagement tools for clients.
- **Niche:** Expats planning to retire abroad (e.g., Thailand, Portugal).

### Key Messaging
- "See your future before you spend it."
- "The first financial tool that understands your dreams, not just your dollars."
- "Powered by Gemini 2.5 & 3.0: The world's most advanced AI for life planning."

### Campaign Phases

#### Phase 1: The "Dream Gap" (Launch Week)
- **Press Release:** Announce Visionary as the solution to the "Dream Gap" (the disconnect between financial savings and lifestyle vision).
- **Asset:** "The Thailand Experiment" - A case study of Milton and Lisa Overton using the platform to visualize their beach-front retirement.
- **Channels:** LinkedIn, TechCrunch (AI vertical), AARP Magazine, Financial Planning Journals.

#### Phase 2: User Stories & Virality (Month 1-3)
- **Feature:** "Vision Board Challenge" - Users share their generated AI vision boards on social media with #MyVisionaryFuture.
- **Influencer Strategy:** Partner with retirement coaches and financial influencers to demo the "Voice-to-Vision" feature.

#### Phase 3: B2B Integration (Month 3-6)
- **Partnership Announcement:** Integration with major wealth management platforms (e.g., Fidelity, Vanguard APIs) to pull real-time data.

## 2. Development Roadmap & Status

### v1.0: Foundation (COMPLETED)
- [x] **Voice Dictation:** Capture vision statements naturally using Web Speech API.
- [x] **High-Fidelity Rendering:** Implemented `gemini-3-pro-image-preview` for photorealistic results.
- [x] **Iterative Refinement:** "Refine This" workflow allows continuous editing of generated images.
- [x] **Vision Board Gallery:** Full persistence, delete, downloading, and social sharing.
- [x] **Action Plan Agent:** Generates 3-year roadmaps with Google Maps/Gmail/Calendar deep links.

### v1.1: Knowledge & Context (COMPLETED)
- [x] **Reference Image Library:** Sidebar to store and reuse user headshots for likeness preservation.
- [x] **Financial Knowledge Base:** "Notebook Mode" to persist uploaded plans (PDF/CSV) and manual entries.
- [x] **Document Persistence:** Secure storage of financial context in Supabase `documents` table.
- [x] **Text Embedding:** Ability to render goal text and custom titles (e.g., "Overton Family Vision") into images.

### v1.2: Identity & Financial Intelligence (MOSTLY COMPLETED)
- [x] **User Authentication:**
    - Implemented Supabase Auth (Email/Password) in `Login.tsx`.
    - Created `profiles` table with credits, subscription_tier, stripe_customer_id, and subscription_status.
    - Updated RLS policies to use `auth.uid()` for secure user data.
- [x] **Visionary Financial Automation Engine (Plaid):**
    - Integrated `react-plaid-link` in `ConnectBank.tsx`.
    - Created Supabase Edge Functions (`create-link-token`, `exchange-public-token`) for secure token exchange.
- [ ] **Cost of Living API:** When a user says "Thailand", pull real-time housing data to adjust the "Goal" target.

### v1.3: Trust & Security (PARTIALLY COMPLETED)
- [x] **Trust Center:** Dedicated page (`TrustCenter.tsx`) explaining encryption (AES-256) and SOC2 compliance.
- [ ] **Edge Function Security:** Move all Gemini API key logic to server-side execution to prevent key leakage.

### v2.0: The Immersive Vision Board (FUTURE)
- [ ] **Gemini Live Integration:** Full real-time, interruptible voice conversation with the AI Coach.
- [ ] **Video Generation:** Use Veo to generate a 10-second video of the couple walking on the beach.
- [ ] **Face Mapping 2.0:** Advanced consistency of user identity across multiple generated scenarios.

## 3. Technical Implementation: Financial Automation (Plaid) - COMPLETED

### Architecture Strategy
All core authentication and Plaid integration components have been implemented.

1.  **Authentication Layer (Supabase Auth):** ✅ COMPLETED
    - App wrapped with session management in `App.tsx`.
    - Login/Signup components implemented in `Login.tsx`.

2.  **Plaid Link (Client):** ✅ COMPLETED
    - `react-plaid-link` integrated in `ConnectBank.tsx`.
    - Secure modal obtains `public_token`.

3.  **Backend Service (Supabase Edge Functions):** ✅ COMPLETED
    - `create-link-token` function generates Plaid link tokens.
    - `exchange-public-token` function exchanges tokens and stores securely.
    - Tokens stored encrypted in `plaid_items` table.

### Database Status
The following tables have been implemented:
- ✅ `plaid_items` - Stores encrypted Plaid access tokens
- ✅ `profiles` - User profiles with credits, subscription tier, Stripe data
- ✅ `vision_boards` - Generated vision images
- ✅ `reference_images` - Style reference library
- ✅ `documents` - Financial document storage
- ✅ `action_tasks` - 3-year roadmap tasks
- ✅ `poster_orders` - Print order history
- `automation_rules` - Schema ready (pending automation features)
- `transfer_logs` - Schema ready (pending automation features)

## 4. Stripe Integration Setup (REQUIRED FOR LIVE PAYMENTS)

The Stripe integration code is complete but requires configuration to go live.

### Step 1: Create Stripe Products & Prices
1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Create **Visionary Pro** product with $19.99/month recurring price
3. Create **Visionary Elite** product with $49.99/month recurring price
4. Copy the `price_xxxxx` IDs for each

### Step 2: Set Environment Variables

**Frontend (.env file):**
```
VITE_STRIPE_PRICE_PRO=price_xxxxx
VITE_STRIPE_PRICE_ELITE=price_xxxxx
```

**Supabase Secrets (run via CLI):**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Step 3: Configure Stripe Webhook
1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/stripe-webhook`
3. Select event: `checkout.session.completed`
4. Copy the signing secret (`whsec_xxxxx`) to Supabase secrets

### Step 4: Deploy Edge Functions
```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

### Step 5: Test in Stripe Test Mode
- Use test keys (`sk_test_`, `pk_test_`) first
- Test card: `4242 4242 4242 4242`
- Verify webhook receives events and updates user profiles

---

## 5. Remaining Development Tasks

### Immediate Priority
1. **Cost of Living API** - Integrate real-time location-based cost data
2. **Gemini API Key Security** - Move API calls to Edge Functions
3. **Stripe Go-Live** - Complete configuration steps above

### Future Roadmap (v2.0)
1. Gemini Live real-time voice conversation
2. Veo video generation
3. Advanced face mapping consistency

---

## 6. Product Enhancement Recommendations

> **TL;DR:** Visionary has strong foundational features but lacks engagement loops and completion pathways. Key enhancements should focus on reducing friction between dream definition and execution, enabling couple collaboration, improving AI reliability, and building micro-monetization patterns that feel natural rather than punitive.

### Priority Enhancements (v1.4)

#### 1. Couple Collaboration Mode
Allow spouse/partner to join shared vision workspace, co-edit preferences, and co-approve action plans. Enables natural engagement loop for primary target audience (couples aged 45-60).

**Implementation Options:**
- **Option A (Complex):** Seamless co-editing with conflict resolution
- **Option B (MVP - Recommended):** One user owns account, partner has read-only + comment-only access

*Recommend Option B for v1.4, upgrade to full sync in v2.0*

#### 2. Progress Tracking & Momentum Dashboards
Replace flat view with visual milestone progress:
- [ ] "Days Until Retirement" countdown widget
- [ ] Achievement badges and streaks
- [ ] Visual milestone progress indicators
- [ ] Psychological feedback loops to reduce drop-off between steps

#### 3. Credit Transparency & Graceful Paywalls
Redesign credit model to reduce mid-workflow friction:
- [ ] Upfront cost visibility per feature
- [ ] Free trial generation (3 vision boards/month for free tier)
- [ ] Soft subscription prompts vs. hard credit cutoffs
- [ ] Hybrid model: Free unlimited action planning + paid unlimited generations

#### 4. Complete Plaid Integration End-to-End
Move beyond token exchange to full financial automation:
- [ ] Actual account balance retrieval
- [ ] Auto-populate financial forms from real data
- [ ] Automated savings transfer suggestions
- [ ] Real-time surplus detection for goal acceleration

#### 5. In-Product Task Execution
Build native execution tools instead of deep links:
- [ ] Mini Gmail composer embedded in app
- [ ] Calendar picker for action plan scheduling
- [ ] Native notifications/reminders for follow-through
- [ ] Keep users in Visionary workflow end-to-end

#### 6. AI Generation Reliability Features
Improve confidence in AI features:
- [ ] Image retry logic with automatic fallback
- [ ] In-app refinement palette (brightness, composition, people emphasis)
- [ ] Generative queue with estimated wait times
- [ ] Error recovery for high-load periods

#### 7. Onboarding Segmentation & Path Selection
Let users choose focus on landing based on life stage:
- [ ] "Dream First" path (visual/emotional entry)
- [ ] "Financial First" path (practical/analytical entry)
- [ ] Reduces cognitive overload
- [ ] Improves perceived relevance for both young retirees and early planners

---

## 7. Category Dominance Features (v2.0+)

These features would push Visionary into true category leadership:

### Weekly AI Review Meetings
- [ ] Auto-generate weekly reflection summaries
- [ ] Wins, blockers, next steps analysis
- [ ] Suggested schedule adjustments
- [ ] Email/push notification delivery

### Micro Habit Tracking
- [ ] Tiny daily actions tied to each goal
- [ ] Streak tracking with visual indicators
- [ ] Badge system for consistency
- [ ] Momentum visualization

### Voice Check-Ins
- [ ] Personalized voice prompts: *"Milton, how's your financial freedom board going today?"*
- [ ] Voice builds relationship and commitment
- [ ] Integrate with Gemini Live for natural conversation

### Accountability Groups
- [ ] Couple collaboration (see v1.4)
- [ ] Family vision boards
- [ ] Team/mastermind group features
- [ ] Community encouragement loops

### Predictive Coaching
- [ ] AI warns users when falling behind pace
- [ ] Example: *"At current pace, you'll miss your July goal by 2 months — here are 3 adjustments"*
- [ ] Proactive intervention vs. passive tracking
- [ ] Smart recommendations based on behavior patterns

### AI-Generated Monthly Progress Videos
- [ ] Highlight reel of user's journey
- [ ] Motivational content for retention
- [ ] Shareable for viral marketing potential
- [ ] Celebration of milestones

### Gamification System
- [ ] Levels and XP for engagement
- [ ] Rewards for completing milestones
- [ ] Progress statuses (Dreamer → Planner → Achiever → Visionary)
- [ ] Make life improvement feel fun

---

## 8. Further Technical Considerations

### Financial Integration Depth
Cost-of-Living API currently on roadmap but underutilized:
- When user says "Thailand", auto-fetch Numbeo/Expatica cost data
- Dynamically adjust Goal Target based on location
- Turn vague dreams into concrete financial targets automatically

### Monetization Psychology
Current credit model feels transactional. Recommended hybrid approach:

| Tier | Vision Boards | Action Planning | Queue Priority | Advanced Features |
|------|---------------|-----------------|----------------|-------------------|
| Free | 3/month | Unlimited | Standard | - |
| Pro ($19.99) | Unlimited | Unlimited | Priority | Refinement tools |
| Elite ($49.99) | Unlimited | Unlimited | Instant | Video gen, face consistency |

*Aligns revenue with true value drivers rather than punitive credit cutoffs*