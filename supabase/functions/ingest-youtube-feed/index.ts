import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper for Gemini
function cleanJson(text: string) {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

async function callGemini(apiKey: string, prompt: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

        if (!YOUTUBE_API_KEY || !GEMINI_API_KEY) {
            throw new Error('Missing API Keys');
        }

        // 1. Get Users to Process (Active users)
        const { user_id } = await req.json().catch(() => ({}));

        let usersToProcess = [];
        if (user_id) {
            usersToProcess = [{ id: user_id }];
        } else {
            const { data: users, error } = await supabase
                .from('profiles')
                .select('id')
                .limit(5);

            if (error) throw error;
            usersToProcess = users.map(u => ({ id: u.id }));
        }

        const results = [];

        for (const user of usersToProcess) {
            // 2. Fetch User Context (Goals & Theme)
            const { data: goals } = await supabase
                .from('action_tasks')
                .select('title, description')
                .eq('user_id', user.id)
                .eq('is_completed', false)
                .limit(3);

            const { data: identity } = await supabase
                .from('user_identity_profiles')
                .select('theme_id, motivational_themes(name)')
                .eq('user_id', user.id)
                .single();

            if (!goals || goals.length === 0) {
                results.push({ user_id: user.id, status: 'no_goals' });
                continue;
            }

            const themeName = identity?.motivational_themes?.name || 'General Success';
            const goalKeywords = goals.map(g => g.title).join(' OR ');
            const query = `${goalKeywords} ${themeName} tutorial guide -vlog`;

            // 3. Search YouTube
            const ytResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoDuration=medium&order=relevance&maxResults=5&key=${YOUTUBE_API_KEY}`
            );
            const ytData = await ytResponse.json();

            if (!ytData.items) {
                results.push({ user_id: user.id, status: 'youtube_error', error: ytData });
                continue;
            }

            // 4. AI Curation (The "Input Diet" Filter)
            for (const item of ytData.items) {
                const videoId = item.id.videoId;
                const title = item.snippet.title;
                const description = item.snippet.description;

                const { data: existing } = await supabase
                    .from('resource_feed')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('external_id', videoId)
                    .single();

                if (existing) continue;

                const prompt = `
          Analyze this YouTube video for a user with these goals: ${JSON.stringify(goals)}.
          Video Title: ${title}
          Video Description: ${description}
          
          Task: Determine if this is a high-value "System" or "Tutorial" that helps achieve the goals.
          Discard if it is pure entertainment, vlog, or low-density content.
          
          Return JSON:
          {
            "is_relevant": boolean,
            "relevance_score": number (0.0 to 1.0),
            "reasoning": "string explaining why"
          }
        `;

                try {
                    const text = await callGemini(GEMINI_API_KEY, prompt);

                    // Extract JSON from response
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) continue;
                    const analysis = JSON.parse(jsonMatch[0]);

                    if (analysis.is_relevant && analysis.relevance_score > 0.7) {
                        // 5. Upsert to DB
                        await supabase.from('resource_feed').insert({
                            user_id: user.id,
                            theme_id: identity?.theme_id,
                            source_platform: 'youtube',
                            external_id: videoId,
                            title: title,
                            url: `https://www.youtube.com/watch?v=${videoId}`,
                            thumbnail_url: item.snippet.thumbnails.high.url,
                            ai_relevance_score: analysis.relevance_score,
                            ai_curation_reasoning: analysis.reasoning,
                            is_consumed: false
                        });
                    }
                } catch (e) {
                    console.error("AI Parsing Error", e);
                }
            }
            results.push({ user_id: user.id, status: 'processed' });
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
});
