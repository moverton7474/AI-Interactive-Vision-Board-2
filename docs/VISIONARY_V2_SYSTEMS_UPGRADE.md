# VISIONARY AI — V2.0 SYSTEMS ARCHITECTURE UPGRADE
**Version:** 2.0 (Martell Systems Integration)
**Date:** December 17, 2025
**Status:** ✅ 85% COMPLETE
**Architectural Goal:** Transition from "Goal Setting" to "Identity Conditioning & Automated Systems."

### Implementation Status

| Feature | Status | Completion |
|---------|--------|------------|
| Database Schema (system_sops, resource_feed, psychological_frameworks) | ✅ Complete | 100% |
| Active Resource Feed (YouTube Ingestion) | ✅ Complete | 100% |
| Psychological RAG (Mindset Engine) | ✅ Complete | 100% |
| AMIE Psychological Coach | ✅ Complete | 100% |
| Identity Feed Widget | ✅ Complete | 100% |
| "My Systems" Widget UI | 🔲 Not Started | 0% |
| Google Calendar 2-Way Sync | 🔲 Not Started | 0% |

---

## 1. Executive Technical Summary
We are upgrading the backend architecture to support **"Systems Thinking"** (S.Y.S.T.E.M - Save Yourself Time Energy Money Stress). This requires moving from static data (PDFs/Tasks) to active agents that curate content and enforce calendar habits.

**Core Stack Adjustments:**
* **Infrastructure:** Supabase (Auth, DB, Vector Store, Edge Functions).
* **Execution Layer:** Google Workspace APIs (Calendar/Tasks) for user systems.
* **AI Router:** Strict enforcement of "Right Model for the Right Job."

---

## 2. AI Model Router Configuration (Strict Enforcement)
Configure the `ModelRouter` class to dispatch requests to the specific Google model IDs below. Do not use generic `gemini-pro` calls.

| Feature Domain | Recommended Model | Technical Model ID | Rationale |
| :--- | :--- | :--- | :--- |
| **Vision Board Generation** | **Nano Banana Pro** | `gemini-3-pro-image-preview` | State-of-the-art prompt adherence and text rendering for high-fidelity visualization. |
| **AMIE (Psychology Engine)** | **Gemini 3 Pro** | `gemini-3-pro-preview` | Required for complex reasoning and "Deep Think" capabilities to handle emotional nuance. |
| **Active Resource Feed** | **Gemini 2.5 Flash** | `gemini-2.5-flash` | Low latency and low cost for high-volume processing of YouTube/Web metadata. |
| **Voice Coach** | **Gemini Live** | `gemini-2.5-flash-live` | Sub-second latency for real-time bidirectional voice coaching. |

---

## 3. Database Schema Migration (Supabase PostgreSQL)
Run the following SQL migration to establish the "Systems" infrastructure.

```sql
-- MIGRATION: 20251206_martell_systems_upgrade.sql

-- ENABLE VECTOR EXTENSION (If not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. SYSTEM SOPS (Replacing "To-Do Lists" with "Calendar Systems")
-- Concept: "If it's not on the calendar, it's not real."
CREATE TABLE system_sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES action_tasks(id),
  name TEXT NOT NULL, -- e.g., "Weekly Finance Review"
  
  -- System Configuration
  trigger_type TEXT CHECK (trigger_type IN ('time', 'event', 'location')),
  cron_schedule TEXT, -- e.g., "0 9 * * 5" (Every Friday at 9am)
  google_calendar_event_id TEXT, -- Sync ID for recurrence
  system_prompt TEXT, -- Instructions for the user during this block
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ACTIVE RESOURCE FEED (The "Input Diet")
-- Concept: Active curation of content to reprogram user identity.
CREATE TABLE resource_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id UUID REFERENCES motivational_themes(id),
  
  -- Content Metadata
  source_platform TEXT DEFAULT 'youtube', 
  external_id TEXT, -- YouTube Video ID
  title TEXT,
  url TEXT,
  thumbnail_url TEXT,
  duration_iso TEXT,
  
  -- AI Curation Data
  ai_relevance_score FLOAT, -- 0.0 to 1.0
  ai_curation_reasoning TEXT, -- "Selected because it addresses your fear of..."
  
  is_consumed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PSYCHOLOGICAL FRAMEWORKS (The Mindset Engine / Internal RAG)
-- Concept: Vector store for coaching methodologies (Stoicism, CBT, Martell).
CREATE TABLE psychological_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author TEXT, -- e.g., "James Clear", "Dan Martell"
  concept_name TEXT, -- e.g., "The 2-Minute Rule"
  content_chunk TEXT, -- The raw text
  embedding vector(768), -- Match dimensions to your embedding model (Gecko or OpenAI)
  tags TEXT[]
);

-- RLS POLICIES
ALTER TABLE system_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychological_frameworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own systems" ON system_sops FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own feed" ON resource_feed FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read frameworks" ON psychological_frameworks FOR SELECT USING (true);
```

---

## 4. Edge Function Specifications

### Function A: `ingest-youtube-feed`
*   **Trigger:** Scheduled Cron (Nightly) per active user.
*   **Model:** `gemini-2.5-flash`
*   **Workflow:**
    1.  **Context Loading:** Fetch User's current `motivational_theme` (e.g., "Executive") and active `action_tasks`.
    2.  **API Fetch:** Query YouTube Data API v3 for high-performing videos (>50k views) matching keywords.
    3.  **AI Filter:**
        *   **System Prompt:** "You are an Executive Curator. Discard entertainment/vlogs. Keep only actionable 'Systems' or 'Tutorials'. Rate relevance 0-1."
    4.  **Write:** Upsert valid items into `resource_feed`.

### Function B: `amie-psychological-coach`
*   **Trigger:** User Chat Interaction (specifically when sentiment < 0.4 or keyword "stuck/failed").
*   **Model:** `gemini-3-pro-preview`
*   **Workflow:**
    1.  **Vector Search:** Embed user query. Search `psychological_frameworks` for nearest neighbor (e.g., "Procrastination" -> "5 Second Rule").
    2.  **Reasoning:**
        *   **System Prompt:** "The user is struggling with [Problem]. Using the [Retrieved Framework], reframe their mindset. Do not offer platitudes. Offer a mental model."
    3.  **Response:** Return text response to chat UI.

### Function C: `generate-vision-briefing` (NotebookLM Replacement)
*   **Trigger:** On-demand "Listen" button or Weekly Schedule.
*   **Model:** `gemini-3-pro-preview` (Scripting) + `gemini-2.5-flash-live` (Audio).
*   **Workflow:**
    1.  **Data Aggregation:** Pull user's Goals, recent System SOPs, and Feed items.
    2.  **Script Gen:** Create a "Podcast Script" connecting these items.
    3.  **Audio Gen:** Synthesize audio using Gemini Live or ElevenLabs.
    4.  **Delivery:** Push audio blob to frontend media player.

---

## 5. Integration Points

### A. Dashboard UI Update
*   **Replace:** "To-Do List" Widget.
*   **Insert:** "My Systems" Widget (Calendar View of SOPs).
*   **Insert:** "Identity Feed" (Horizontal scroll of curated YouTube videos).

### B. Google Workspace Connection
*   Do NOT use Slack for personal goal execution.
*   Implement Google Calendar API scopes to write `system_sops` directly to the user's real calendar.
*   **Sync status:** Two-way binding (if user deletes event on Cal, update DB status).

---

## 6. Implementation Order

### Completed ✅
1. ✅ **Migration:** SQL Schema updates applied (20251206_martell_systems_upgrade.sql)
2. ✅ **Seeding:** `seed-frameworks` function deployed to populate psychological_frameworks
3. ✅ **Backend:** `ingest-youtube-feed` and `amie-psychological-coach` deployed
4. ✅ **Frontend:** IdentityFeedWidget.tsx created to render resource_feed
5. ✅ **Vector Search:** 20251206_add_vector_match_rpc.sql for RAG retrieval
6. ✅ **MDALS Engine:** Music-Driven Adaptive Learning System (20251207_mdals_engine_schema.sql)

### Remaining
1. 🔲 **"My Systems" Widget:** UI component to display active SOPs
2. 🔲 **Google Calendar API:** Two-way sync for SOP calendar events
