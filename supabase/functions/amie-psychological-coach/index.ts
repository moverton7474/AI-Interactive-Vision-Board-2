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

        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
        if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

        // 1. Parse Request
        const { user_id, message, context } = await req.json();

        if (!message) throw new Error('Message is required');

        // 2. Generate Embedding for Retrieval (Google text-embedding-004 is 768 dims)
        const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const embeddingResult = await embeddingModel.embedContent(message);
        const embedding = embeddingResult.embedding.values;

        // 3. Retrieve Psychological Frameworks (RAG)
        // We search for the "nearest neighbor" concept in our vector store
        const { data: frameworks, error: searchError } = await supabase.rpc('match_psychological_frameworks', {
            query_embedding: embedding,
            match_threshold: 0.5, // Only relevant matches
            match_count: 3
        });

        let contextString = "";
        if (frameworks && frameworks.length > 0) {
            contextString = frameworks.map((f: any) =>
                `Framework: ${f.concept_name} by ${f.author}\nPrinciple: ${f.content_chunk}`
            ).join('\n\n');
        } else {
            // Fallback if DB is empty (Seeding needed)
            contextString = "Framework: Stoic Dichotomy of Control\nPrinciple: Focus only on what is in your power (your actions, thoughts) and accept what is not (outcomes, others' opinions).";
        }

        // 3.5 Retrieve User Identity & Theme Context
        const { data: amieContext, error: contextError } = await supabase.rpc('get_amie_context', {
            p_user_id: user_id
        });

        if (contextError) {
            console.error("Error fetching AMIE context:", contextError);
        }

        // 4. Generate Response using Gemini 2.0 Flash (The "Identity Architect")
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        let baseSystemPrompt = `You are AMIE, an Identity Architect and Psychological Coach.`;

        // Override with Theme-specific prompt if available
        if (amieContext?.theme?.system_prompt) {
            baseSystemPrompt = amieContext.theme.system_prompt;
        }

        const systemPrompt = `
      ${baseSystemPrompt}
      
      YOUR GOAL:
      The user is struggling or asking for guidance. Do NOT give tactical financial advice or simple to-do lists.
      Instead, use the provided PSYCHOLOGICAL FRAMEWORKS to reframe their mindset.
      
      METHODOLOGY:
      1. Identify the underlying identity block (fear, scarcity, procrastination).
      2. Apply a specific mental model (from the context below) to shift their perspective.
      3. Challenge them to adopt a new identity trait (e.g., "What would a disciplined investor do?").
      
      CONTEXT (Psychological Frameworks):
      ${contextString}
      
      USER IDENTITY PROFILE:
      ${JSON.stringify(amieContext?.identity || {})}
      
      USER PREFERENCES:
      ${JSON.stringify(amieContext?.preferences || {})}
      
      USER CONTEXT (Session):
      ${JSON.stringify(context || {})}
      
      USER MESSAGE:
      "${message}"
    `;

        const result = await model.generateContent(systemPrompt);
        const responseText = result.response.text();

        // 5. Log the Interaction (Optional, for future fine-tuning)
        // await supabase.from('coach_logs').insert({ ... })

        return new Response(JSON.stringify({
            success: true,
            response: responseText,
            used_frameworks: frameworks?.map((f: any) => f.concept_name) || ['Default Stoicism']
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Coach Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
});
