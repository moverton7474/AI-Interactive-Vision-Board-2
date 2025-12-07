# Technical Stack Documentation for Visionary AI

## Overview
Visionary AI is a high-performance Single Page Application (SPA) designed as an "agentic success platform." It combines a reactive frontend with a robust serverless backend, leveraging advanced AI models for hyper-personalized coaching and content generation.

## 1. Frontend Architecture
*   **Framework:** [React 18](https://react.dev/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
*   **Build System:** [Vite](https://vitejs.dev/)
*   **Styling:** 
    *   [Tailwind CSS v3](https://tailwindcss.com/) (Loaded via CDN for rapid prototyping/flexibility)
    *   Standard CSS (Custom scrollbars, specific overrides)
*   **Typography:** Google Fonts ([Inter](https://fonts.google.com/specimen/Inter) for UI, [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) for Headings)
*   **State Management:** React Hooks & Context API
*   **Key Libraries:**
    *   `react-plaid-link`: Financial data connection.
    *   `recharts`: Analytics and progress visualization.
    *   `lucide-react` / Heroicons (SVG Icons).

## 2. Backend Architecture (Supabase)
The application relies entirely on [Supabase](https://supabase.com/) for backend infrastructure.
*   **Database:** PostgreSQL 15+
*   **Extensions Enabled:**
    *   `vector` (pgvector): For semantic search and RAG (Identity Architect).
    *   `pg_net`: For asynchronous HTTP requests/webhooks.
    *   `pg_cron`: For scheduled jobs (daily habit resets, notifications).
*   **Authentication:** Supabase Auth (RLS policies enacted on all user data tables).
*   **Storage:** Supabase Storage (Buckets for `vision-boards` and `user-content`).
*   **Serverless Compute:** Supabase Edge Functions (Deno Runtime).

## 3. Artificial Intelligence Engine
*   **Reasoning & Coaching:** Google Gemini 1.5 Pro (Complex tasks), Gemini 2.0 Flash (Chat/Speed).
*   **Image Generation:** Google Imagen 3 / Gemini Preview (High-fidelity vision board images).
*   **Embeddings:** Google `text-embedding-004` (Knowledge base vectorization).
*   **Voice Interaction:** 
    *   Native Web Speech API (Input).
    *   Google Gemini Live (Real-time coaching sessions - *Integration in progress*).
*   **RAG Pipeline:** AMIE (Adaptive Motivational Identity Engine) retrieves context from `user_knowledge_chunks` via vector similarity.

## 4. Edge Functions (Microservices)
Located in `supabase/functions/`. Key functions include:
*   `amie-psychological-coach`: Main chat endpoint with identity context.
*   `voice-coach-session`: Handles voice interaction logic and session logging.
*   `generate-workbook-pdf`: Generates PDF documents using `pdf-lib`.
*   `communication-router`: Routes messages to SMS/Voice/Push.
*   `submit-to-prodigi`: Handles print order fulfillment.
*   `create-checkout-session`: Stripe payment orchestration.

## 5. Third-Party Integrations
*   **Payment:** [Stripe](https://stripe.com/) (Subscriptions & One-time purchases).
*   **Logistics:** [Prodigi](https://www.prodigi.com/) (Global print-on-demand network).
*   **Communications:** [Twilio](https://www.twilio.com/) (Programmable Voice & SMS).
*   **Banking:** [Plaid](https://plaid.com/) (Financial data aggregation).

## 6. Directory Structure
*   `/components`: React UI components (Widgets, Dashboard, Modals).
*   `/services`: Frontend service layers for API interaction (e.g., `geminiService.ts`, `imageService.ts`).
*   `/supabase`: Database migrations and Edge Functions.
    *   `/functions`: Individual Deno-based serverless functions.
    *   `/migrations`: SQL files for schema changes.
*   `/public`: Static assets.
*   `App.tsx`: Main application entry point and routing.

## 7. Development Environment
*   **Runtime:** Node.js (Frontend tooling), Deno (Edge Function tooling).
*   **Package Manager:** NPM / PNPM.
*   **Version Control:** Git (GitHub).
