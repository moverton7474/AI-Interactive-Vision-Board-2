# MDALS Engine Overview

**Music-Driven Adaptive Learning Systems**

Version: 1.0
Last Updated: December 2024

---

## What is MDALS?

MDALS (Music-Driven Adaptive Learning Systems) is a transformative engine that connects personal music to structured learning journeys. It allows users to:

1. **Add songs** they care about (title, artist, source link)
2. **Receive AI-powered analysis** of the song's themes, emotions, and life messages
3. **Map those insights** to learning content (scripture, leadership principles, growth frameworks)
4. **Generate personalized learning plans** (e.g., 7-day spiritual journey based on the song)

### Key Principles

- **No lyrics stored** - Only our own summaries and insights
- **No audio hosted** - External links only (Spotify, Apple Music, YouTube)
- **Transformative use** - All analysis in our own words
- **Modular design** - Clean API surface for future extraction/licensing

---

## Database Schema

### Tables

#### `mdals_songs`
Stores songs added by users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner (FK to auth.users) |
| `title` | TEXT | Song title (required) |
| `artist` | TEXT | Artist name |
| `album` | TEXT | Album name |
| `source_type` | TEXT | 'spotify', 'apple', 'youtube', 'manual', 'other' |
| `source_id` | TEXT | External track ID |
| `source_url` | TEXT | Link to song on external platform |
| `user_notes` | TEXT | What the song means to the user |
| `language` | TEXT | Default 'en' |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

#### `mdals_song_insights`
Stores AI-derived analysis of songs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `song_id` | UUID | FK to mdals_songs |
| `summary` | TEXT | High-level message (our words, no lyrics) |
| `themes` | JSONB | Array of themes (e.g., ["healing", "hope"]) |
| `emotions` | JSONB | Array of emotions (e.g., ["grief", "joy"]) |
| `domain_tags` | JSONB | Domain tags (e.g., ["spiritual", "leadership"]) |
| `references` | JSONB | Array of {type, value, reason} objects |
| `domain_preferences` | JSONB | Domains requested at analysis time |
| `model_used` | TEXT | AI model used (e.g., "gemini-1.5-flash") |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

#### `mdals_learning_plans`
Stores generated learning journeys.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner (FK to auth.users) |
| `song_id` | UUID | FK to mdals_songs |
| `title` | TEXT | Plan title |
| `goal_description` | TEXT | User's stated goal |
| `duration_days` | INT | Plan length (1-90 days) |
| `domain_preferences` | JSONB | Domain focus for this plan |
| `plan_json` | JSONB | Array of day objects (see structure below) |
| `status` | TEXT | 'active', 'completed', 'paused', 'abandoned' |
| `current_day` | INT | Progress tracking |
| `started_at` | TIMESTAMPTZ | When plan was started |
| `completed_at` | TIMESTAMPTZ | Completion timestamp |
| `model_used` | TEXT | AI model used |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### Plan Day Structure

```json
{
  "day": 1,
  "focus": "Recognizing your pain and God's presence",
  "references": ["Psalm 34:18", "Psalm 30:5"],
  "activities": [
    "Listen to the song once in a quiet place.",
    "Read Psalm 34:18 slowly two times."
  ],
  "reflection": "Where have you felt abandoned but were actually carried?",
  "prayer_or_action": "Ask God to show you one area He is still working in."
}
```

### RLS Policies

- **mdals_songs**: Users can only access rows where `user_id = auth.uid()`
- **mdals_song_insights**: Access through song ownership (user owns the parent song)
- **mdals_learning_plans**: Users can only access rows where `user_id = auth.uid()`

---

## Edge Function: `mdals-engine`

Location: `supabase/functions/mdals-engine/`

### Files

- `index.ts` - Main handler with endpoint routing
- `promptTemplates.ts` - LLM prompt templates and parsing utilities

### Endpoints

#### `POST /analyze-song`

Analyzes a song and extracts themes, emotions, and growth references.

**Request:**
```json
{
  "song": {
    "title": "Amazing Grace",
    "artist": "Chris Tomlin",
    "album": null,
    "source_type": "youtube",
    "source_url": "https://youtu.be/...",
    "source_id": null
  },
  "user_id": "uuid",
  "domain_preferences": ["spiritual", "leadership"],
  "user_notes": "This song helped me through a hard time",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "song_id": "uuid",
  "insight_id": "uuid",
  "summary": "A powerful song about redemption and grace...",
  "themes": ["redemption", "grace", "transformation"],
  "emotions": ["gratitude", "awe", "peace"],
  "domain_tags": ["spiritual"],
  "references": [
    {
      "type": "scripture",
      "value": "Ephesians 2:8-9",
      "reason": "Grace as a gift, not earned through works"
    }
  ]
}
```

#### `POST /generate-plan`

Generates a multi-day learning plan based on song insights.

**Request:**
```json
{
  "user_id": "uuid",
  "song_id": "uuid",
  "goal_description": "Grow closer to God and find healing",
  "duration_days": 7,
  "domain_preferences": ["spiritual"]
}
```

**Response:**
```json
{
  "success": true,
  "plan_id": "uuid",
  "title": "Grace & Healing Journey",
  "duration_days": 7,
  "goal_description": "Grow closer to God and find healing",
  "days": [
    {
      "day": 1,
      "focus": "...",
      "references": ["..."],
      "activities": ["..."],
      "reflection": "...",
      "prayer_or_action": "..."
    }
  ]
}
```

#### `GET /songs`

Returns user's songs with latest insights.

**Response:**
```json
{
  "success": true,
  "songs": [
    {
      "song": { "id": "...", "title": "...", "artist": "..." },
      "insight_summary": "...",
      "themes": ["..."],
      "plans_count": 2
    }
  ]
}
```

#### `GET /plans`

Returns user's learning plans.

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "id": "...",
      "title": "...",
      "duration_days": 7,
      "current_day": 3,
      "status": "active",
      "song": { "id": "...", "title": "...", "artist": "..." }
    }
  ]
}
```

---

## Prompt Templates

Located in `supabase/functions/mdals-engine/promptTemplates.ts`

### Song Analysis Prompt

The analysis prompt:
- Instructs the AI to extract themes, emotions, and domain tags
- Explicitly prohibits quoting lyrics
- Requests relevant references based on domain preferences
- Returns strict JSON structure

### Plan Generation Prompt

The plan prompt:
- Uses song analysis results as context
- Respects user's goal and duration preferences
- Optionally includes AMIE identity context
- Generates structured day-by-day content
- Prohibits lyric references

---

## Frontend Test Harness

### Component

`components/mdals/MdalsTestPanel.tsx`

A development/testing UI that allows:
1. Adding a song (title, artist, source, personal notes)
2. Selecting learning domains (spiritual, leadership, etc.)
3. Running song analysis
4. Viewing analysis results (summary, themes, emotions, references)
5. Setting a goal and generating a learning plan
6. Viewing the complete multi-day plan

### Access

Navigate to **More > MDALS Lab** from the main navigation when logged in.

---

## Running Locally

### 1. Apply Migration

```bash
# Using Supabase CLI
supabase db push

# Or manually apply
psql $DATABASE_URL < supabase/migrations/20251207_mdals_engine_schema.sql
```

### 2. Deploy Edge Function

```bash
supabase functions deploy mdals-engine
```

### 3. Environment Variables

Ensure these are set in your Supabase project:
- `GEMINI_API_KEY` - Google AI API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key

### 4. Start Dev Server

```bash
npm run dev
```

### 5. Access Test Panel

1. Log in to the application
2. Click "More" in the navigation
3. Select "MDALS Lab"

---

## Future Integration Points

MDALS is designed to integrate with the broader Vision AI platform:

### Immediate Opportunities

1. **AMIE / Christian Journey**
   - Surface song-based learning plans in the coaching dashboard
   - Let AMIE suggest songs based on user's emotional state

2. **Habits Module**
   - Convert plan activities into trackable habits
   - Daily check-ins for plan progress

3. **Agent Chat / Voice Coach**
   - Discuss song insights in conversation
   - Voice-guided plan activities

4. **Weekly Reviews**
   - Include MDALS progress in weekly summaries
   - Celebrate completed learning journeys

### Future Expansions

1. **Apple Music / Spotify Integration**
   - Auto-fetch song metadata
   - Playlist import/export

2. **Print Products**
   - "Song Study Guide" workbooks
   - Plan-based devotional cards

3. **Apple Watch**
   - Daily plan notifications
   - Quick reflection prompts

4. **Team / Group Plans**
   - Shared song studies
   - Group discussion guides

5. **MDALS as Standalone Product**
   - API licensing
   - White-label options

---

## TypeScript Types

All MDALS types are defined in `/types.ts`:

- `MdalsSong`
- `MdalsSongInsight`
- `MdalsSongReference`
- `MdalsLearningPlan`
- `MdalsLearningPlanDay`
- `MdalsAnalyzeSongRequest`
- `MdalsAnalyzeSongResponse`
- `MdalsGeneratePlanRequest`
- `MdalsGeneratePlanResponse`

---

## Legal Compliance

MDALS is designed with IP compliance in mind:

1. **No lyrics stored** - Prompts explicitly instruct "do not quote lyrics"
2. **No audio hosted** - Only external links (Spotify, Apple, YouTube)
3. **Transformative analysis** - All insights in our own words
4. **Modular design** - Can be extracted/licensed separately

---

## Support & Handoff

For questions or integration work:
1. Review this document
2. Check the code comments in the Edge Function
3. Test using the MDALS Lab panel
4. Reach out to the engineering team

---

*MDALS Engine v1.0 - Built for Vision AI*
