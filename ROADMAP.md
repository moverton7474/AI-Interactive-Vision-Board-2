# Visionary SaaS - PR & Development Roadmap

**Last Updated:** November 29, 2024

## Project Overview
Visionary is a high-end, AI-first SaaS platform designed to help couples and individuals visualize, plan, and manifest their dream retirement. By combining financial reality checks with generative AI vision boarding, Visionary offers a unique emotional and practical approach to retirement planning.

---

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

---

## 2. Development Roadmap & Status

### v1.0: Foundation ✅ COMPLETED
- [x] **Voice Dictation:** Capture vision statements naturally using Web Speech API.
- [x] **High-Fidelity Rendering:** Implemented `gemini-3-pro-image-preview` for photorealistic results.
- [x] **Iterative Refinement:** "Refine This" workflow allows continuous editing of generated images.
- [x] **Vision Board Gallery:** Full persistence, delete, downloading, and social sharing.
- [x] **Action Plan Agent:** Generates 3-year roadmaps with Google Maps/Gmail/Calendar deep links.

### v1.1: Knowledge & Context ✅ COMPLETED
- [x] **Reference Image Library:** Sidebar to store and reuse user headshots for likeness preservation.
- [x] **Financial Knowledge Base:** "Notebook Mode" to persist uploaded plans (PDF/CSV) and manual entries.
- [x] **Document Persistence:** Secure storage of financial context in Supabase `documents` table.
- [x] **Text Embedding:** Ability to render goal text and custom titles (e.g., "Overton Family Vision") into images.

### v1.2: Identity & Financial Intelligence ✅ COMPLETED
- [x] **User Authentication:**
    - Implemented Supabase Auth (Email/Password) in `Login.tsx`.
    - Created `profiles` table with credits, subscription_tier, stripe_customer_id, and subscription_status.
    - Updated RLS policies to use `auth.uid()` for secure user data.
- [x] **Visionary Financial Automation Engine (Plaid):**
    - Integrated `react-plaid-link` in `ConnectBank.tsx`.
    - Created Supabase Edge Functions (`create-link-token`, `exchange-public-token`).
    - Updated application name to "AI Interactive Vision Board" in Plaid Dashboard.
    - Sandbox mode working; production requires Plaid approval.
- [x] **Gemini API Integration:**
    - `GEMINI_API_KEY` configured in Vercel environment variables.
    - Image generation and chat features operational.

### v1.3: Monetization & Print ✅ MOSTLY COMPLETED
- [x] **Stripe Integration:**
    - Edge Functions deployed: `create-checkout-session`, `stripe-webhook`
    - Secrets configured: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
    - Webhook endpoint ready: `https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/stripe-webhook`
- [x] **Prodigi Print Integration:**
    - Edge Function deployed: `submit-to-prodigi`
    - API key configured: `PRODIGI_API_KEY`
- [x] **Trust Center:** Dedicated page (`TrustCenter.tsx`) explaining encryption and compliance.
- [ ] **Stripe Webhook Verification:** Verify endpoint is active in Stripe Dashboard

### v1.4: AI Agent Foundation 🚧 IN PROGRESS
- [x] **Database Schema Applied:** 10 new tables for AI Agent features
- [x] **TypeScript Types:** 15+ interfaces for agent data models
- [x] **Implementation Plan:** Full 12-week roadmap documented
- [x] **Agent Chat Edge Function:** `agent-chat` deployed and operational
- [x] **Chat UI Component:** `AgentChat.tsx` with conversation history
- [ ] **Habit Tracking UI:** Frontend components
- [ ] **Twilio Integration:** SMS/Voice check-ins

### v1.5: Vision Workbook (Physical Print Products) 🆕 PLANNED
- [x] **Feature Plan:** Complete implementation roadmap in `docs/VISION_WORKBOOK_PLAN.md`
- [x] **Database Schema:** 4 new tables for workbook orders and templates
- [x] **TypeScript Types:** Interfaces for workbook data models
- [ ] **PDF Generation:** `generate-workbook-pdf` Edge Function
- [ ] **Knowledge Base Compiler:** Aggregate user data for workbook content
- [ ] **Workbook Order UI:** Template selection and customization modal
- [ ] **Prodigi Notebook Integration:** Support for GLOBAL-NTB-* SKUs

### v2.0: The Immersive Vision Board (FUTURE)
- [ ] **Gemini Live Integration:** Full real-time, interruptible voice conversation with the AI Coach.
- [ ] **Video Generation:** Use Veo to generate a 10-second video of the couple walking on the beach.
- [ ] **Face Mapping 2.0:** Advanced consistency of user identity across multiple generated scenarios.

---

## 3. Infrastructure Status

### Supabase Edge Functions (7 Active)

| Function | Status | Purpose |
|----------|--------|---------|
| `create-link-token` | ✅ Active | Plaid link token generation |
| `exchange-public-token` | ✅ Active | Plaid token exchange |
| `create-checkout-session` | ✅ Active | Stripe payment sessions |
| `stripe-webhook` | ✅ Active | Payment confirmation handler |
| `submit-to-prodigi` | ✅ Active | Print order fulfillment |
| `rapid-api` | ✅ Active | External API proxy |
| `agent-chat` | ✅ Active | AI Vision Coach conversations |

### Environment Secrets Configured

| Secret | Status |
|--------|--------|
| `STRIPE_SECRET_KEY` | ✅ Set |
| `STRIPE_WEBHOOK_SECRET` | ✅ Set |
| `PLAID_CLIENT_ID` | ✅ Set |
| `PLAID_SECRET` | ✅ Set |
| `PLAID_ENV` | ✅ Set (sandbox) |
| `PRODIGI_API_KEY` | ✅ Set |
| `GEMINI_API_KEY` | ✅ Set (Vercel) |

### Database Tables (21 Total)

**Core Tables (7):**
- ✅ `profiles` - User accounts with credits & subscription
- ✅ `vision_boards` - Generated vision images
- ✅ `reference_images` - Style reference library
- ✅ `documents` - Financial document storage
- ✅ `action_tasks` - 3-year roadmap tasks
- ✅ `poster_orders` - Print order history
- ✅ `plaid_items` - Bank connection tokens

**AI Agent Tables (10):**
- ✅ `agent_sessions` - Conversation context
- ✅ `agent_messages` - Chat history
- ✅ `user_comm_preferences` - Communication settings
- ✅ `habits` - Micro-habits
- ✅ `habit_completions` - Streak tracking
- ✅ `user_achievements` - Badges & levels
- ✅ `scheduled_checkins` - Proactive outreach
- ✅ `agent_actions` - Agentic operations
- ✅ `weekly_reviews` - Progress summaries
- ✅ `progress_predictions` - Pace analytics

**Vision Workbook Tables (4) - NEW:**
- ✅ `workbook_templates` - Product catalog (softcover/hardcover options)
- ✅ `workbook_orders` - User workbook orders
- ✅ `workbook_sections` - Generated sections/pages
- ✅ `user_knowledge_base` - Aggregated user data for AI/workbooks

---

## 4. Remaining Tasks by Priority

### 🔴 Critical (Before Launch)

| Task | Status | Effort |
|------|--------|--------|
| Verify Stripe webhook in Dashboard | 🔲 Pending | 15 min |
| Test payment flow end-to-end | 🔲 Pending | 30 min |
| Verify Prodigi production mode | 🔲 Pending | 15 min |

### 🟡 High Priority (Revenue Enablement)

| Task | Status | Effort |
|------|--------|--------|
| Move Gemini API to Edge Function (security) | 🔲 Pending | 2-3 hours |
| Plaid balance retrieval | 🔲 Pending | 3-4 hours |
| Cost of Living API integration | 🔲 Pending | 4-6 hours |

### 🟢 Medium Priority (AI Agent Phase 1)

| Task | Status | Effort |
|------|--------|--------|
| Create `agent-chat` Edge Function | ✅ Done | 4-6 hours |
| Build basic chat UI component | ✅ Done | 3-4 hours |
| Implement habit tracking frontend | 🔲 Pending | 4-6 hours |
| Add streak visualization | 🔲 Pending | 2-3 hours |

---

## 5. AI Agent Assistant (KEY DIFFERENTIATOR)

> **This is Visionary's market differentiator.** Unlike passive goal-tracking apps, the AI Agent ("Vision Coach") proactively engages users through voice, text, and calls to help them execute their vision goals.

### Implementation Status: DATABASE READY ✅

**Database Schema:** Applied via `supabase/migrations/20241129_ai_agent_schema.sql`
**Full Plan:** `docs/AI_AGENT_IMPLEMENTATION_PLAN.md`
**TypeScript Types:** Added to `types.ts`

### Core Capabilities

| Feature | Description | Status |
|---------|-------------|--------|
| Database Schema | 10 tables for agent data | ✅ Applied |
| Text Chat | Real-time conversation with AI Coach | ✅ Completed |
| Voice Chat | Gemini Live integration for voice | 🔲 Pending |
| Proactive Outreach | SMS/Email/Push notifications | 🔲 Pending |
| Voice Calls | Twilio-powered check-in calls | 🔲 Pending |
| Habit Tracking | Daily micro-actions with streaks | 🔲 Pending |
| Weekly Reviews | AI-generated progress summaries | 🔲 Pending |
| Predictive Coaching | Pace warnings & recommendations | 🔲 Pending |
| Agentic Actions | Execute tasks on user's behalf | 🔲 Pending |

### Database Tables Created

```
agent_sessions       ✅ Conversation context
agent_messages       ✅ Chat history
user_comm_preferences ✅ Communication settings
habits               ✅ Micro-habits
habit_completions    ✅ Streak tracking
user_achievements    ✅ Badges & levels
scheduled_checkins   ✅ Proactive outreach
agent_actions        ✅ Agentic operations
weekly_reviews       ✅ Progress summaries
progress_predictions ✅ Pace analytics
```

### External Integrations Required

| Service | Purpose | Status |
|---------|---------|--------|
| Gemini AI | Text/Voice chat | ✅ Configured |
| Twilio | SMS & Voice calls | 🔲 Need account |
| Resend | Transactional email | 🔲 Need account |
| n8n/Zapier | Workflow automation | 🔲 Optional |

### Implementation Phases

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 1 | Database schema + basic text chat | 🚧 In Progress |
| Phase 2 | Habit system + streak tracking | 🔲 Pending |
| Phase 3 | Twilio SMS + scheduled notifications | 🔲 Pending |
| Phase 4 | Voice integration (Gemini Live) | 🔲 Pending |
| Phase 5 | Weekly reviews + predictions | 🔲 Pending |
| Phase 6 | Polish + n8n workflows | 🔲 Pending |

---

## 6. Vision Workbook (Physical Print Product) 🆕

> **Premium Revenue Stream:** Transform users' digital vision boards, action plans, and financial snapshots into professionally printed workbooks via Prodigi's notebook printing service.

### Product Concept

The Vision Workbook is a personalized, AI-generated physical journal containing:
- Full-page vision board prints with reflection prompts
- Financial reality check summary
- 3-year action plan with QR code deep links
- 12-month habit tracker templates
- 52-week reflection journal pages
- Achievement sticker pages

### Product Tiers

| Tier | Product | Pages | Size | Price |
|------|---------|-------|------|-------|
| Starter | Softcover Journal | 100 | A5 (5.8"x8.3") | $29.99 |
| Standard | Hardcover Notebook | 100 | A5 (5.8"x8.3") | $44.99 |
| Premium | Executive Hardcover | 120 | A4 (8.3"x11.7") | $64.99 |
| Legacy | Letter Hardcover | 150 | Letter (8.5"x11") | $79.99 |

### Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Feature Plan | ✅ Complete | `docs/VISION_WORKBOOK_PLAN.md` |
| Database Schema | ✅ Complete | `supabase/migrations/20241129_workbook_schema.sql` |
| TypeScript Types | ✅ Complete | Added to `types.ts` |
| Template Seed Data | ✅ Complete | 4 product templates seeded |
| PDF Generation | 🔲 Pending | `generate-workbook-pdf` Edge Function |
| Knowledge Base Compiler | 🔲 Pending | Aggregate user data |
| Frontend UI | 🔲 Pending | WorkbookOrderModal component |
| Prodigi Integration | 🔲 Pending | GLOBAL-NTB-* SKUs |

### Database Tables

```
workbook_templates    ✅ Product catalog with pricing
workbook_orders       ✅ Order tracking with Prodigi
workbook_sections     ✅ Generated PDF sections
user_knowledge_base   ✅ Aggregated user data for AI/print
```

### Revenue Potential

- **Margin**: $15-50 per workbook (after Prodigi costs)
- **Conversion Target**: 5% of active users
- **Upsell Path**: Elite subscribers get free softcover annually
- **Gift Market**: Couples ordering for each other

---

## 7. Additional Product Enhancements (v2.5+)

> **TL;DR:** Visionary has strong foundational features but lacks engagement loops and completion pathways. Key enhancements should focus on reducing friction between dream definition and execution, enabling couple collaboration, improving AI reliability, and building micro-monetization patterns that feel natural rather than punitive.

### Priority Enhancements

#### 1. Couple Collaboration Mode
Allow spouse/partner to join shared vision workspace, co-edit preferences, and co-approve action plans. Enables natural engagement loop for primary target audience (couples aged 45-60).

**Implementation Options:**
- **Option A (Complex):** Seamless co-editing with conflict resolution
- **Option B (MVP - Recommended):** One user owns account, partner has read-only + comment-only access

*Recommend Option B for v1.5, upgrade to full sync in v2.0*

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

## 8. Category Dominance Features (v3.0+)

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
- [ ] Couple collaboration (see v1.5)
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

## 9. Technical Considerations

### API Key Security
Current: Gemini API key exposed in client bundle via Vercel env vars.
**Action Required:** Move to Edge Function for production security.

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

---

## 10. Quick Reference: Next Actions

### Immediate (Today)
1. ✅ ~~Apply AI Agent database schema~~ DONE
2. 🔲 Verify Stripe webhook endpoint in Dashboard
3. 🔲 Test payment flow with test card

### This Week
4. ✅ ~~Create `agent-chat` Edge Function~~ DONE
5. ✅ ~~Build basic chat UI component~~ DONE
6. 🔲 Sign up for Twilio account
7. 🔲 Set GEMINI_API_KEY as Supabase secret

### Next Week
8. 🔲 Move Gemini API to Edge Function (security)
9. 🔲 Implement habit tracking frontend
10. 🔲 Add streak visualization

### Vision Workbook (v1.5)
11. 🔲 Apply workbook database schema (`npx supabase db push`)
12. 🔲 Verify Prodigi notebook SKUs
13. 🔲 Create `generate-workbook-pdf` Edge Function
14. 🔲 Build WorkbookOrderModal component
