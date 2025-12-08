import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop(); // "find-song", "analyze-song", etc.
    const body = await req.json();

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // ========================================================================
    // FIND SONG
    // ========================================================================
    if (path === 'find-song') {
      const { description, genres, mood, era } = body;

      const prompt = `
        You are a highly knowledgeable music "Song Finder".
        User Description: "${description}"
        Genres: ${JSON.stringify(genres || [])}
        Mood: ${mood || 'Any'}
        Era: ${era || 'Any'}

        Task: Identify 3-5 potential song matches.
        Also provide 2-3 clarifying questions if the description is vague.

        Return valid JSON in this format:
        {
          "suggestions": [
            {
              "title": "Song Title",
              "artist": "Artist",
              "confidence": "high" | "medium" | "low",
              "reason": "Why it matches",
              "year": "Year",
              "genre": "Genre",
              "search_tip": "Tip to confirm (e.g. check lyrics 'xyz')"
            }
          ],
          "clarifying_questions": ["Question 1", "Question 2"]
        }
      `;

      const result = await model.generateContent(prompt);
      const output = cleanJson(result.response.text());
      const data = JSON.parse(output);

      return new Response(JSON.stringify({ success: true, ...data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // ANALYZE SONG
    // ========================================================================
    if (path === 'analyze-song') {
      const { song, domain_preferences, user_notes } = body;

      const prompt = `
        Analyze this song for a "Vision Board" & "Personal Growth" context.
        Song: "${song.title}" by "${song.artist || 'Unknown'}"
        User Context/Notes: "${user_notes || ''}"
        Relevant Domains: ${JSON.stringify(domain_preferences || [])}

        Task:
        1. Summarize the core message.
        2. Identify key emotional themes.
        3. Tag with relevant domains.
        4. Find references in culture/scripture/literature that align (especially if Spiritual/Christian domain is selected).

        Return valid JSON:
        {
          "summary": "Brief summary",
          "themes": ["Theme 1", "Theme 2"],
          "emotions": ["Emotion 1", "Emotion 2"],
          "domain_tags": ["Domain 1", "Domain 2"],
          "references": [
             { "type": "scripture" | "quote" | "concept", "value": "John 3:16", "reason": "Aligns with lyrics..." }
          ]
        }
      `;

      const result = await model.generateContent(prompt);
      const output = cleanJson(result.response.text());
      const data = JSON.parse(output);

      return new Response(JSON.stringify({
        success: true,
        song_id: crypto.randomUUID(), // Mock ID for now
        ...data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // GENERATE PLAN
    // ========================================================================
    if (path === 'generate-plan') {
      const { goal_description, duration_days, domain_preferences } = body;

      const prompt = `
        Create a ${duration_days}-Day actionable Learning Plan based on this goal:
        "${goal_description}"
        Domains: ${JSON.stringify(domain_preferences)}

        For EACH day, provide:
        - Focus/Title
        - 2-3 specific Activities/Tasks
        - A reflection question
        - A prayer or action step.

        Return valid JSON:
        {
          "title": "Title of the Plan",
          "days": [
            {
              "day": 1,
              "focus": "Focus of the day",
              "activities": ["Activity 1", "Activity 2"],
              "references": ["Ref 1"],
              "reflection": "Reflection question",
              "prayer_or_action": "Prayer or Action"
            }
          ]
        }
      `;

      const result = await model.generateContent(prompt);
      const output = cleanJson(result.response.text());
      const data = JSON.parse(output);

      return new Response(JSON.stringify({
        success: true,
        plan_id: crypto.randomUUID(),
        duration_days,
        ...data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown path: ${path}`);

  } catch (error) {
    console.error("MDALS Engine Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function cleanJson(text: string) {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}
