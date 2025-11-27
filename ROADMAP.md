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
- [x] **Vision Board Gallery:** Full persistence, delete, downloading, and social sharing.
- [x] **Action Plan Agent:** Generates 3-year roadmaps with Google Maps/Gmail/Calendar deep links.

### v1.1: Knowledge & Context (COMPLETED)
- [x] **Reference Image Library:** Sidebar to store and reuse user headshots for likeness preservation.
- [x] **Financial Knowledge Base:** "Notebook Mode" to persist uploaded plans (PDF/CSV) and manual entries.
- [x] **Document Persistence:** Secure storage of financial context in Supabase `documents` table.
- [x] **Text Embedding:** Ability to render goal text and custom titles (e.g., "Overton Family Vision") into images.

### v1.2: Identity & Financial Intelligence (IMMEDIATE PRIORITY)
- [ ] **User Authentication (CRITICAL):**
    - Implement Supabase Auth (Email/Password or Google).
    - Create `profiles` table to store user names and retirement dates.
    - Update RLS policies from `public` to `auth.uid()` to secure user data.
- [ ] **Visionary Financial Automation Engine (Plaid):**
    - Integrate `react-plaid-link` on frontend.
    - Create Supabase Edge Function to exchange tokens securely.
- [ ] **Cost of Living API:** When a user says "Thailand", pull real-time housing data to adjust the "Goal" target.

### v1.3: Trust & Security (PLANNED)
- [ ] **Trust Center:** Dedicated page explaining encryption (AES-256) and SOC2 compliance.
- [ ] **Edge Function Security:** Move all Gemini API key logic to server-side execution to prevent key leakage.

### v2.0: The Immersive Vision Board (FUTURE)
- [ ] **Gemini Live Integration:** Full real-time, interruptible voice conversation with the AI Coach.
- [ ] **Video Generation:** Use Veo to generate a 10-second video of the couple walking on the beach.
- [ ] **Face Mapping 2.0:** Advanced consistency of user identity across multiple generated scenarios.

## 3. Technical Implementation: Financial Automation (Plaid)

### Architecture Strategy
Now that the frontend and database schema are ready, the focus shifts to **Security**.

1.  **Authentication Layer (Supabase Auth):**
    - *Dev Task:* Wrap the App in a `SessionProvider`.
    - *Dev Task:* Create Login/Signup components.

2.  **Plaid Link (Client):** 
    - Obtains `public_token` via secure modal.
    - *Dev Task:* npm install `react-plaid-link`.

3.  **Backend Service (Supabase Edge Functions):**
    - Exchanges `public_token` for `access_token`.
    - Stores `access_token` in `plaid_items` table (Encrypted).
    - *Dev Task:* Set up Deno/Node environment for Supabase Functions.

### Database Readiness
The following tables have been added to the schema and are ready for implementation:
- `plaid_items`
- `automation_rules`
- `transfer_logs`
- *New Requirement:* `profiles` (needs to be added).