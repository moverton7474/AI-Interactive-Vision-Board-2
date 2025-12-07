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
    const { action, description, songTitle, artist, context, genre, mood, era } = await req.json();
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      throw new Error('Missing GEMINI_API_KEY');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // ------------------------------------------------------------------------
    // Action: Find Song (when user doesn't know the title)
    // ------------------------------------------------------------------------
    if (action === 'find_song') {
      const prompt = `
        You are a music expert "Song Finder" agent.
        The user is describing a song they can't identify.
        
        Description: "${description}"
        Genre Context: ${genre || 'Unknown'}
        Mood: ${mood || 'Unknown'}
        Era: ${era || 'Unknown'}

        Task: Identify the most likely song.
        Return ONLY valid JSON in this format:
        {
          "found": true,
          "confidence": number (0-1),
          "title": "Song Title",
          "artist": "Artist Name",
          "year": "Year",
          "reasoning": "Why this matches description"
        }
        If you cannot find a match with confidence > 0.5, set "found": false.
      `;

      const result = await model.generateContent(prompt);
      const output = result.response.text();

      // Clean JSON
      const jsonStr = output.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(jsonStr);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ------------------------------------------------------------------------
    // Action: Analyze Song Meaning (Step 2 in screenshot logic)
    // ------------------------------------------------------------------------
    if (action === 'analyze_song') {
      const prompt = `
        Analyze this song for a "Vision Board" application.
        Song: "${songTitle}" by "${artist}"
        User's Personal Connection: "${context}"

        Task: Extract "Learning Domains" and emotional keywords that align with this song.
        Which of these domains apply? [Spiritual/Christian, Leadership, Business, Personal Growth, Healing/Emotional, Relationships]

        Return ONLY valid JSON:
        {
          "domains": ["Domain 1", "Domain 2"],
          "emotional_themes": ["Theme 1", "Theme 2"],
          "suggested_vision_prompt": "A visual prompt to generate an image based on this song's lyrics and the user's connection"
        }
      `;

      const result = await model.generateContent(prompt);
      const output = result.response.text();
      const jsonStr = output.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(jsonStr);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
