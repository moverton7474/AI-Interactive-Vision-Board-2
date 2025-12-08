import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

        if (!YOUTUBE_API_KEY || !GEMINI_API_KEY) {
            throw new Error('Missing API Keys');
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        // Use Flash for cost/speed efficiency as per spec
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        // 1. Get Users to Process (Active users)
        // For now, we'll just process the user triggering the function, or a specific user_id passed in body
        // In production cron, this would loop through all active users.
        const { user_id } = await req.json().catch(() => ({}));

        let usersToProcess = [];
        if (user_id) {
            usersToProcess = [{ id: user_id }];
        } else {
            // Fetch top 5 active users for batch processing (limit to avoid timeouts)
            const { data: users, error } = await supabase
                .from('profiles') // Assuming profiles table exists and links to auth.users
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

                // Check if already exists
                const { data: existing } = await supabase
                    .from('resource_feed')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('external_id', videoId)
                    .single();

                if (existing) continue;

                // AI Filter
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

                const result = await model.generateContent(prompt);
                const response = result.response;
                const text = response.text();

                try {
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

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
