
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// We need the SUPABASE_URL and ANON_KEY to call the function.
// Since we don't have them in the environment here, we might fail if we rely on process.env.
// However, the previous test script worked (it called the function and got a response, albeit an error).
// Wait, the previous test script used the `geminiService.ts` which imports `supabaseClient`.
// `supabaseClient.ts` likely has the keys hardcoded or uses env vars.

// Let's try to use the existing geminiService to call the diagnose action.
// But geminiService doesn't expose a diagnose function.
// I will add a temporary diagnose function to geminiService.ts or just use the supabase client directly if I can find it.

// Let's look at supabaseClient.ts first to see how it's set up.
import { supabase } from './lib/supabase.ts';

async function testDiagnostics() {
    console.log("Running diagnostics...");
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: { action: 'diagnose' }
    });

    if (error) {
        console.error("Diagnostics failed:", error);
    } else {
        console.log("Diagnostics result:", JSON.stringify(data, null, 2));
    }
}

testDiagnostics();
