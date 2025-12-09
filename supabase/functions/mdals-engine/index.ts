import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(supabaseUrl, supabaseKey);
}

// Helper to clean JSON output from markdown code blocks
function cleanJson(text: string) {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

async function callGemini(apiKey: string, prompt: string) {
  // Use the correct model name (gemini-2.0-flash-001, not gemini-2.0-flash)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${apiKey}`;
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
    const body = await req.json();

    // Support both URL path-based routing AND body.action routing
    const url = new URL(req.url);
    const pathAction = url.pathname.split('/').pop(); // "find-song", "analyze-song", etc.
    const action = body.action || pathAction; // Prefer body.action if provided

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');

    // ========================================================================
    // FIND SONG
    // ========================================================================
    if (action === 'find-song') {
      const { description, query, genres, mood, era, domain_preferences } = body;
      const searchQuery = description || query || '';

      const prompt = `
        Find or suggest a song that matches this search:
        Description: "${searchQuery}"
        Genres: ${JSON.stringify(genres || [])}
        Mood: "${mood || 'uplifting'}"
        Era: "${era || 'any'}"
        Relevant Domains: ${JSON.stringify(domain_preferences || [])}

        Return valid JSON with song suggestions (array) and optional clarifying questions:
        {
          "suggestions": [
            {
              "title": "Song Title",
              "artist": "Artist Name",
              "album": "Album Name (if known)",
              "year": "Year (if known)",
              "genre": "Genre",
              "confidence": "high" | "medium" | "low",
              "reason": "Why this song fits the description",
              "search_tip": "Tip for finding this song on streaming platforms"
            }
          ],
          "clarifying_questions": ["Optional question to narrow search"]
        }

        Provide 1-3 song suggestions that best match the description.
      `;

      const output = await callGemini(GEMINI_API_KEY, prompt);
      const data = JSON.parse(output);

      return new Response(JSON.stringify({
        success: true,
        suggestions: data.suggestions || [],
        clarifying_questions: data.clarifying_questions || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // ANALYZE SONG
    // ========================================================================
    if (action === 'analyze-song') {
      const { song, domain_preferences, user_notes, user_id } = body;
      const supabase = getSupabaseClient();

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

      // Save song to database
      const { data: savedSong, error: songError } = await supabase
        .from('mdals_songs')
        .insert({
          user_id: user_id,
          title: song.title,
          artist: song.artist || null,
          album: song.album || null,
          source_type: song.source_type || 'manual',
          source_url: song.source_url || null,
          user_notes: user_notes || null,
        })
        .select()
        .single();

      if (songError) {
        console.error('Error saving song:', songError);
        throw new Error(`Failed to save song: ${songError.message}`);
      }

      // Save song insights to database
      const { data: savedInsight, error: insightError } = await supabase
        .from('mdals_song_insights')
        .insert({
          song_id: savedSong.id,
          summary: data.summary,
          themes: data.themes,
          emotions: data.emotions,
          domain_tags: data.domain_tags,
          references: data.references,
          domain_preferences: domain_preferences,
          model_used: 'gemini-2.0-flash-001',
        })
        .select()
        .single();

      if (insightError) {
        console.error('Error saving insight:', insightError);
        throw new Error(`Failed to save insight: ${insightError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        song_id: savedSong.id,
        insight_id: savedInsight.id,
        ...data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // GENERATE PLAN
    // ========================================================================
    if (action === 'generate-plan') {
      const { goal_description, duration_days, domain_preferences, user_id, song_id } = body;
      const supabase = getSupabaseClient();

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

      // Save learning plan to database
      const { data: savedPlan, error: planError } = await supabase
        .from('mdals_learning_plans')
        .insert({
          user_id: user_id,
          song_id: song_id,
          title: data.title,
          goal_description: goal_description,
          duration_days: duration_days,
          domain_preferences: domain_preferences,
          plan_json: data.days,
          status: 'pending', // Not started yet
          current_day: 0,
          model_used: 'gemini-2.0-flash-001',
        })
        .select()
        .single();

      if (planError) {
        console.error('Error saving plan:', planError);
        throw new Error(`Failed to save plan: ${planError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        plan_id: savedPlan.id,
        duration_days,
        status: 'pending',
        ...data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // START PLAN - Activate a plan and schedule daily notifications
    // ========================================================================
    if (action === 'start-plan') {
      const { plan_id, user_id } = body;
      const supabase = getSupabaseClient();

      // Get the plan
      const { data: plan, error: fetchError } = await supabase
        .from('mdals_learning_plans')
        .select('*')
        .eq('id', plan_id)
        .eq('user_id', user_id)
        .single();

      if (fetchError || !plan) {
        throw new Error('Plan not found or access denied');
      }

      if (plan.status === 'active') {
        throw new Error('Plan is already active');
      }

      // Update plan status to active
      const { error: updateError } = await supabase
        .from('mdals_learning_plans')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          current_day: 1,
        })
        .eq('id', plan_id);

      if (updateError) {
        throw new Error(`Failed to activate plan: ${updateError.message}`);
      }

      // Schedule daily notifications for each day of the plan
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const days = plan.plan_json || [];

      for (const day of days) {
        // Schedule notification for each day (at 8am user's time by default)
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + (day.day - 1)); // Day 1 = today
        scheduledDate.setHours(8, 0, 0, 0);

        try {
          await fetch(`${SUPABASE_URL}/functions/v1/schedule-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              action: 'schedule',
              userId: user_id,
              checkinType: 'mdals_daily',
              scheduledFor: scheduledDate.toISOString(),
              channel: 'sms',
              content: {
                template: 'mdals_daily',
                templateData: {
                  planTitle: plan.title,
                  dayNumber: day.day,
                  totalDays: plan.duration_days,
                  focus: day.focus,
                  activities: day.activities,
                  reflection: day.reflection,
                }
              }
            })
          });
        } catch (scheduleError) {
          console.warn(`Failed to schedule notification for day ${day.day}:`, scheduleError);
          // Continue anyway - notifications are nice-to-have
        }
      }

      return new Response(JSON.stringify({
        success: true,
        plan_id: plan_id,
        status: 'active',
        started_at: new Date().toISOString(),
        current_day: 1,
        notifications_scheduled: days.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // GET ACTIVE PLAN - Load user's active learning plan
    // ========================================================================
    if (action === 'get-active-plan') {
      const { user_id } = body;
      const supabase = getSupabaseClient();

      const { data: plan, error } = await supabase
        .from('mdals_learning_plans')
        .select(`
          *,
          mdals_songs (title, artist)
        `)
        .eq('user_id', user_id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw new Error(`Failed to fetch plan: ${error.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        has_active_plan: !!plan,
        plan: plan || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // COMPLETE DAY - Mark a day as completed and advance progress
    // ========================================================================
    if (action === 'complete-day') {
      const { plan_id, user_id, day_number } = body;
      const supabase = getSupabaseClient();

      // Get the plan
      const { data: plan, error: fetchError } = await supabase
        .from('mdals_learning_plans')
        .select('*')
        .eq('id', plan_id)
        .eq('user_id', user_id)
        .single();

      if (fetchError || !plan) {
        throw new Error('Plan not found or access denied');
      }

      const newDay = Math.min(day_number + 1, plan.duration_days);
      const isCompleted = newDay > plan.duration_days;

      const updateData: any = {
        current_day: isCompleted ? plan.duration_days : newDay,
      };

      if (isCompleted) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('mdals_learning_plans')
        .update(updateData)
        .eq('id', plan_id);

      if (updateError) {
        throw new Error(`Failed to update progress: ${updateError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        plan_id: plan_id,
        current_day: updateData.current_day,
        status: isCompleted ? 'completed' : 'active',
        is_completed: isCompleted,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}. Valid actions: find-song, analyze-song, generate-plan, start-plan, get-active-plan, complete-day`);

  } catch (error: any) {
    console.error("MDALS Engine Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || String(error) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
