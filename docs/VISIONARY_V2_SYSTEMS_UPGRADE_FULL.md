# VISIONARY AI — V2.0 SYSTEMS ARCHITECTURE UPGRADE
**Version:** 1.7 (Strategy + Execution)
**Date:** December 06, 2025
**Architectural Goal:** Transition from "Goal Setting" to "Identity Conditioning & Automated Systems."

---

## 1. Executive Summary
We are upgrading the backend architecture to support **"Systems Thinking"** (S.Y.S.T.E.M). This requires moving from static data to active agents that curate content and enforce calendar habits.

---

## 2. Strategic Feature Definitions
*These definitions provide the "Why" and "User Experience" context for the technical implementation below.*

### Feature A: The "Input Diet" Automation (Active Feed)
* **Philosophy:** Martell argues that to change your output (goals), you must change your input.
* **Current State:** The "Knowledge Base" (v1.1) is static (user uploads PDFs).
* **The Upgrade:** Turn the Knowledge Base into an **Active Feed**.
    * *Example:* If a user's goal is "Retire in Portugal," the system actively fetches YouTube videos on "Cost of living in Lisbon" or psychological content on "Overcoming fear of moving abroad."
* **Success Criteria:** The user logs in and sees a curated "Netflix-style" feed of content specifically chosen to upskill them for their specific goals.

### Feature B: The "Identity Architect" (Psychological RAG)
* **Philosophy:** The "Upgrade Loop"—shifting identity to match the goal.
* **Current State:** The "Action Plan Agent" (v1.0) simply generates tasks.
* **The Upgrade:** Create a **"Mindset Engine."**
    * *Mechanism:* Populate a vector database (RAG) with curated psychological frameworks (Stoicism, CBT, Habit Formation).
    * *Interaction:* When a user logs a "failure" or lack of progress, the AI **does not** give financial advice. It pulls from these psychological resources to offer a mindset shift (e.g., quoting a specific Stoic principle on resilience).

### Feature C: The "Systems" Dashboard (SOPs)
* **Philosophy:** "If it’s not on the calendar, it’s not real."
* **Current State:** "Action Plan Agent" creates simple to-do lists.
* **The Upgrade:** Deep Integration -> **"Standard Operating Procedures" (SOPs).**
    * *Interaction:* If the goal is "Save $10k," the System creates a recurring calendar invite: *"Friday 9 AM: Review Weekly Spending."*
    * *Verification:* The app checks if you attended your own "meeting" via Google Calendar API integration.

---

## 3. AI Model Router Configuration (Strict Enforcement)
Configure the `ModelRouter` class to dispatch requests to the specific Google model IDs below.

| Feature Domain | Recommended Model | Technical Model ID | Rationale |
| :--- | :--- | :--- | :--- |
| **Vision Board Generation** | **Nano Banana Pro** | `gemini-3-pro-image-preview` | Best-in-class adherence for "Vibe Coding" and text rendering. |
| **AMIE (Psychology Engine)** | **Gemini 3 Pro** | `gemini-3-pro-preview` | Required for complex reasoning and handling emotional nuance (Feature B). |
| **Active Resource Feed** | **Gemini 2.5 Flash** | `gemini-2.5-flash` | Low latency/cost for high-volume YouTube metadata processing (Feature A). |
| **Voice Coach** | **Gemini Live** | `gemini-2.5-flash-live` | Sub-second latency for bidirectional voice coaching. |

---

## 4. Database Schema Migration (Supabase PostgreSQL)
Run the following SQL migration to support the features defined in Section 2.

```sql
-- MIGRATION: 20251206_martell_systems_upgrade.sql

-- ENABLE VECTOR EXTENSION
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. SYSTEM SOPS (Supporting Feature C)
CREATE TABLE system_sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES action_tasks(id),
  name TEXT NOT NULL, -- e.g., "Weekly Finance Review"
  
  -- System Configuration
  trigger_type TEXT CHECK (trigger_type IN ('time', 'event', 'location')),
  cron_schedule TEXT, -- e.g., "0 9 * * 5"
  google_calendar_event_id TEXT, -- Sync ID for recurrence
  system_prompt TEXT, -- Instructions for the user during this block
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ACTIVE RESOURCE FEED (Supporting Feature A)
CREATE TABLE resource_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id UUID REFERENCES motivational_themes(id),
  
  -- Content Metadata
  source_platform TEXT DEFAULT 'youtube', 
  external_id TEXT,
  title TEXT,
  url TEXT,
  thumbnail_url TEXT,
  
  -- AI Curation Data
  ai_relevance_score FLOAT, -- 0.0 to 1.0
  ai_curation_reasoning TEXT, -- "Selected because it matches your 'Retire in Portugal' goal."
  
  is_consumed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PSYCHOLOGICAL FRAMEWORKS (Supporting Feature B)
CREATE TABLE psychological_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author TEXT, -- e.g., "James Clear"
  concept_name TEXT, -- e.g., "Identity Shifting"
  content_chunk TEXT, -- The raw text
  embedding vector(768), 
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

## 5. Edge Function Specifications

### Function A: `ingest-youtube-feed` (Implements Feature A)
*   **Trigger:** Scheduled Cron (Nightly).
*   **Model:** `gemini-2.5-flash`.
*   **Workflow:**
    1.  Fetch User's `motivational_theme` and `action_tasks` (Goals).
    2.  Query YouTube Data API v3 for "tutorials" matching goals (filter out vlogs).
    3.  **AI Filter Prompt:** "Analyze if this video structurally helps a user achieve [GOAL]. If it is pure entertainment, discard. If it is a System/Guide, keep."
    4.  Upsert to `resource_feed`.

### Function B: `amie-psychological-coach` (Implements Feature B)
*   **Trigger:** Chat Interaction (Sentiment < 0.4 or keyword "stuck").
*   **Model:** `gemini-3-pro-preview`.
*   **Workflow:**
    1.  Embed user query and search `psychological_frameworks` for nearest neighbor.
    2.  **Reasoning Prompt:** "User is struggling with [Problem]. Using [Retrieved Framework], reframe their mindset. Do not offer financial advice; offer identity advice."

### Function C: `generate-vision-briefing`
*   **Concept:** Internal replacement for NotebookLM.
*   **Model:** `gemini-3-pro-preview` (Script) + `gemini-2.5-flash-live` (Audio).
*   **Workflow:** Generate a 2-host podcast script discussing the user's specific weekly SOPs and Feed items, then synthesize audio.

---

## 6. Integration Points

### A. Dashboard UI
*   **"My Systems" Widget:** Displays active SOPs and their next Calendar occurrence.
*   **"Identity Feed":** Horizontal scroll of the curated YouTube videos (from `resource_feed`).

### B. Google Workspace
*   Implement Google Calendar API to write `system_sops` directly to the user's calendar.
*   Enable 2-way sync (track attendance).

---

## 7. Implementation Order
1.  **Migration:** Run SQL Schema updates.
2.  **Seeding:** Populate `psychological_frameworks` with initial dataset.
3.  **Backend:** Deploy Edge Functions.
4.  **Frontend:** Connect Dashboard widgets to new tables.
