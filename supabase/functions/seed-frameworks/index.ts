import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FRAMEWORKS = [
    {
        concept_name: "The Dichotomy of Control",
        author: "Epictetus / Stoicism",
        content_chunk: "The chief task in life is simply this: to identify and separate matters so that I can say clearly to myself which are externals not under my control, and which have to do with the choices I actually control. Where then do I look for good and evil? Not to uncontrollable externals, but within myself to the choices that are my own."
    },
    {
        concept_name: "Identity-Based Habits",
        author: "James Clear",
        content_chunk: "The ultimate form of intrinsic motivation is when a habit becomes part of your identity. It's one thing to say I'm the type of person who wants this. It's something very different to say I'm the type of person who is this. True behavior change is identity change."
    },
    {
        concept_name: "The 1% Rule (Marginal Gains)",
        author: "James Clear",
        content_chunk: "Improving by 1% isn't particularly notable—sometimes it isn't even noticeable—but it can be far more meaningful, especially in the long run. If you can get 1 percent better each day for one year, you'll end up thirty-seven times better by the time you're done."
    },
    {
        concept_name: "Amor Fati",
        author: "Friedrich Nietzsche",
        content_chunk: "My formula for greatness in a human being is amor fati: that one wants nothing to be different, not forward, not backward, not in all eternity. Not merely bear what is necessary, still less conceal it... but love it."
    },
    {
        concept_name: "Growth Mindset",
        author: "Carol Dweck",
        content_chunk: "In a growth mindset, people believe that their most basic abilities can be developed through dedication and hard work—brains and talent are just the starting point. This view creates a love of learning and a resilience that is essential for great accomplishment."
    },
    {
        concept_name: "Deep Work",
        author: "Cal Newport",
        content_chunk: "Deep Work: Professional activities performed in a state of distraction-free concentration that push your cognitive capabilities to their limit. These efforts create new value, improve your skill, and are hard to replicate."
    },
    {
        concept_name: "Via Negativa",
        author: "Nassim Taleb",
        content_chunk: "The principle that we know what is wrong with more clarity than what is right, and that knowledge grows by subtraction. Also, improvement by subtraction: removing the bad habits, the bad people, the bad food, is more effective than adding the good."
    },
    {
        concept_name: "Memento Mori",
        author: "Stoicism",
        content_chunk: "You could leave life right now. Let that determine what you do and say and think. Meditating on your mortality is only depressing if you miss the point. It is in fact a tool to create priority and meaning."
    }
]

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')

        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" })

        const results = []

        for (const item of FRAMEWORKS) {
            // Generate embedding
            const result = await model.embedContent(item.content_chunk)
            const embedding = result.embedding.values

            // Insert into DB
            const { data, error } = await supabase
                .from('psychological_frameworks')
                .upsert({
                    concept_name: item.concept_name,
                    author: item.author,
                    content_chunk: item.content_chunk,
                    embedding: embedding
                }, { onConflict: 'concept_name' })
                .select()

            if (error) {
                console.error(`Error inserting ${item.concept_name}:`, error)
                results.push({ name: item.concept_name, status: 'error', error: error.message })
            } else {
                results.push({ name: item.concept_name, status: 'success' })
            }
        }

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
