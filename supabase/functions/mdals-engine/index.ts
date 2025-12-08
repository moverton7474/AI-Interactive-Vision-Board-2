import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to clean JSON output from markdown code blocks
function cleanJson(text: string) {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

async function callGemini(apiKey: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  return cleanJson(text);
}

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

    // ========================================================================
    // FIND SONG
    // ========================================================================
    if (path === 'find-song') {
      console.log("Debugging: Listing available models...");
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
      const listResp = await fetch(listUrl);
      const listData = await listResp.json();

      if (!listResp.ok) {
        throw new Error(`Failed to list models: ${JSON.stringify(listData)}`);
      }

      // Return the list of models to the user to see what IS supported
      return new Response(JSON.stringify({
        success: false,
        error: "AVAILABLE MODELS: " + JSON.stringify(listData, null, 2),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
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

      const output = await callGemini(GEMINI_API_KEY, prompt);
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

      const output = await callGemini(GEMINI_API_KEY, prompt);
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

  } catch (error: any) {
    console.error("MDALS Engine Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || String(error) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
