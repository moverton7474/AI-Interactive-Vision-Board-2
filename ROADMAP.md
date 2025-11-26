# Visionary SaaS - PR & Development Roadmap

## Project Overview
Visionary is a high-end, AI-first SaaS platform designed to help couples visualize, plan, and manifest their dream retirement. By combining financial reality checks with generative AI vision boarding, Visionary offers a unique emotional and practical approach to retirement planning.

## 1. Public Relations (PR) Plan

### Target Audience
- **Primary:** Affluent couples aged 45-60 planning for retirement.
- **Secondary:** Financial Advisors looking for engagement tools for clients.
- **Niche:** Expats planning to retire abroad (e.g., Thailand, Portugal).

### Key Messaging
- "See your future before you spend it."
- "The first financial tool that understands your dreams, not just your dollars."
- "Powered by Gemini 2.5: The world's most advanced AI for life planning."

### Campaign Phases

#### Phase 1: The "Dream Gap" (Launch Week)
- **Press Release:** Announce Visionary as the solution to the "Dream Gap" (the disconnect between financial savings and lifestyle vision).
- **Asset:** "The Thailand Experiment" - A case study of Milton and Lisa Overton using the platform to visualize their beach-front retirement.
- **Channels:** LinkedIn, TechCrunch (AI vertical), AARP Magazine, Financial Planning Journals.

#### Phase 2: User Stories & Virality (Month 1-3)
- **Feature:** "Vision Board Challenge" - Users share their generated AI vision boards on social media with #MyVisionaryFuture.
- **Influencer Strategy:** Partner with retirement coaches and financial influencers on YouTube/Instagram to demo the "Voice-to-Vision" feature.

#### Phase 3: B2B Integration (Month 3-6)
- **Partnership Announcement:** Integration with major wealth management platforms (e.g., Fidelity, Vanguard APIs) to pull real-time data.

## 2. Development Roadmap (Future Scope)

### v1.1: Enhanced Interactivity (Immediate)
- [x] **Voice Dictation:** Capture vision statements naturally (Completed).
- [x] **High-Fidelity Rendering:** Upgraded to Gemini 3 Pro Image for photorealistic results and text rendering.
- [x] **Iterative Refinement:** "Refine This" workflow allows continuous editing of generated images.
- [ ] **Smart Navigation:** Auto-suggest next steps based on chat sentiment.

### v1.2: Deep Financial Intelligence
- [ ] **Visionary Financial Automation Engine (Plaid):** Connect bank accounts to automate transfers to "Goal Buckets".
- [ ] **Real-time Market Data:** Integrate live stock/bond market data to adjust projections dynamically.
- [ ] **Cost of Living API:** When a user says "Thailand", automatically pull real-time housing and food costs for that region to adjust the "Goal" target.

### v1.3: Trust & Security
- [ ] **Trust Center:** dedicated page explaining data encryption (AES-256 for tokens) and SOC2 compliance roadmap.
- [ ] **Auth0/Clerk:** For secure user authentication and profile management.

### v2.0: The Immersive Vision Board
- [ ] **Gemini Live Integration:** Full real-time, interruptible voice conversation with the AI Coach.
- [ ] **Video Generation:** Use Veo to generate a 10-second video of the couple walking on the beach in Thailand, not just a static image.
- [ ] **Face Mapping 2.0:** Improved consistency of user identity across multiple generated scenarios (kitchen, garden, travel).

## 3. Technical Requirements for Next Steps
- **Supabase Edge Functions:** Required for secure Plaid token exchange (cannot be done client-side).
- **Gemini Live API:** For v2.0 conversational features.
- **Stripe Integration:** For SaaS subscription billing (Premium vs Free tier).

## 4. Visionary Financial Automation Engine (Feature Spec)

### Overview
Connects securely to users’ banking, credit, and investment accounts using Plaid to not just plan, but *execute* financial goals.

### Architecture
- **Plaid Link (Client):** Obtains `public_token` via secure modal.
- **Backend Service (Node/Edge):** Exchanges `public_token` for `access_token` and stores securely.
- **AI Agent:** Monitors `available_balance` and triggers transfers based on user-defined "Safe-to-Spend" logic.

### Phases
1.  **The Watcher (Read-Only):** Connect accounts and visualize "Real Net Worth" vs "Goal".
2.  **The Advisor (Simulation):** AI suggests transfers ("You have $500 surplus, move to Thailand Fund?") but user must approve.
3.  **The Autopilot (Live):** Automated sweeps for approved amounts under a set threshold.