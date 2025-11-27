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
- [x] **Vision Board Gallery:** Full persistence, delete, and download capabilities.
- [x] **Action Plan Agent:** Generates 3-year roadmaps with calendar integration.

### v1.1: Knowledge & Context (COMPLETED / NEW)
- [x] **Reference Image Library:** Sidebar to store and reuse user headshots for likeness preservation.
- [x] **Financial Knowledge Base:** "Notebook Mode" to persist uploaded plans and manual entries.
- [x] **Document Persistence:** Secure storage of financial context for AI recall.
- [x] **Text Embedding:** Ability to render goal text (e.g., "Retire 2027") directly into images.

### v1.2: Deep Financial Intelligence (IN PROGRESS)
- [ ] **User Authentication:** Move from Demo Mode to Supabase Auth/Auth0 to secure financial data.
- [ ] **Visionary Financial Automation Engine (Plaid):** Connect bank accounts to automate transfers.
    - *Status:* Database Schema created. Frontend/Edge Functions pending.
- [ ] **Cost of Living API:** When a user says "Thailand", pull real-time housing data to adjust the "Goal" target.

### v1.3: Trust & Security (PLANNED)
- [ ] **Trust Center:** Dedicated page explaining encryption (AES-256) and SOC2 compliance.
- [ ] **Edge Function Security:** Move all API key logic to server-side execution.

### v2.0: The Immersive Vision Board (FUTURE)
- [ ] **Gemini Live Integration:** Full real-time, interruptible voice conversation with the AI Coach.
- [ ] **Video Generation:** Use Veo to generate a 10-second video of the couple walking on the beach.
- [ ] **Face Mapping 2.0:** Advanced consistency of user identity across multiple generated scenarios.

## 3. Technical Implementation: Financial Automation (Plaid)

### Architecture Strategy
Since the frontend foundation is built, the next immediate technical step is **Backend Security**.

1.  **Plaid Link (Client):** 
    - Obtains `public_token` via secure modal.
    - *Dev Task:* npm install `react-plaid-link`.

2.  **Backend Service (Supabase Edge Functions):**
    - Exchanges `public_token` for `access_token`.
    - Stores `access_token` in `plaid_items` table (Encrypted).
    - *Dev Task:* Set up Deno/Node environment for Supabase Functions.

3.  **AI Execution Agent:**
    - Monitors `available_balance` via Plaid API.
    - Triggers transfers based on user-defined "Safe-to-Spend" logic stored in `automation_rules`.

### Database Readiness
The following tables have been added to the schema and are ready for implementation:
- `plaid_items`
- `automation_rules`
- `transfer_logs`
