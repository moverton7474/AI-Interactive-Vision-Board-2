/**
 * Diagnostic Script for Gemini API Key Validation
 * 
 * This script calls the gemini-proxy Edge Function's diagnose endpoint
 * to check if the GEMINI_API_KEY is valid and which models are accessible.
 * 
 * Usage:
 *   1. Make sure you're logged in to your application
 *   2. Open browser console on your app (F12)
 *   3. Copy and paste this entire script into the console
 *   4. Press Enter
 *   5. Review the output
 * 
 * Expected Output:
 *   - If API key is valid: You'll see which models are available
 *   - If API key is invalid: All models will show 'available: false'
 */

(async () => {
    console.log('🔍 Starting Gemini API Diagnostics...\n');

    try {
        // Get the Supabase client from window (should be available in your app)
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.error('❌ Not logged in. Please sign in to the application first.');
            return;
        }

        console.log('✅ Authenticated as:', session.user.email);
        console.log('📡 Calling gemini-proxy diagnose endpoint...\n');

        // Call the diagnose endpoint
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: { action: 'diagnose' },
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        });

        if (error) {
            console.error('❌ Edge Function Error:', error);
            console.error('\nPossible causes:');
            console.error('  1. Edge function not deployed');
            console.error('  2. GEMINI_API_KEY not set in Supabase secrets');
            console.error('  3. Network issue');
            return;
        }

        if (!data?.success) {
            console.error('❌ Diagnostic failed:', data);
            return;
        }

        const diagnostics = data.diagnostics;

        console.log('📊 DIAGNOSTIC RESULTS:\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Timestamp: ${diagnostics.timestamp}`);
        console.log(`Request ID: ${diagnostics.requestId}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('🔑 API Key Info:');
        console.log(`  Length: ${diagnostics.apiKeyInfo.length} characters`);
        console.log(`  Prefix: ${diagnostics.apiKeyInfo.prefix}...`);
        console.log(`  Suffix: ...${diagnostics.apiKeyInfo.suffix}\n`);

        console.log('🤖 Model Availability:\n');

        Object.entries(diagnostics.models).forEach(([modelName, modelInfo]) => {
            const status = modelInfo.available ? '✅ AVAILABLE' : '❌ NOT AVAILABLE';
            console.log(`  ${modelName}`);
            console.log(`    Status: ${status}`);
            console.log(`    HTTP Code: ${modelInfo.status}`);
            if (modelInfo.error) {
                console.log(`    Error: ${modelInfo.error}`);
            }
            console.log('');
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📈 Summary:');
        console.log(`  Total Models Tested: ${diagnostics.summary.totalModels}`);
        console.log(`  Available Models: ${diagnostics.summary.availableModels}`);
        console.log(`  Can Generate Images: ${diagnostics.summary.canGenerateImages ? '✅ YES' : '❌ NO'}`);
        console.log(`  Can Chat: ${diagnostics.summary.canChat ? '✅ YES' : '❌ NO'}\n`);

        if (diagnostics.recommendation) {
            console.log('💡 RECOMMENDATION:\n');
            console.log(`  ${diagnostics.recommendation}\n`);
        }

        // Provide actionable next steps
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('🎯 NEXT STEPS:\n');

        if (diagnostics.summary.availableModels === 0) {
            console.log('  ❌ NO MODELS AVAILABLE - API KEY IS INVALID\n');
            console.log('  Action Required:');
            console.log('    1. Go to: https://aistudio.google.com/app/apikey');
            console.log('    2. Create a new Gemini API key');
            console.log('    3. Update in Supabase Dashboard → Settings → Edge Functions → Secrets');
            console.log('    4. Set: GEMINI_API_KEY = <your-new-key>');
            console.log('    5. Re-run this diagnostic to verify\n');
        } else if (!diagnostics.summary.canGenerateImages) {
            console.log('  ⚠️  CHAT WORKS, BUT IMAGE GENERATION UNAVAILABLE\n');
            console.log('  This is expected - Imagen 3 requires Google Cloud Vertex AI.');
            console.log('  The app should fall back to Gemini 2.0 Flash models for image generation.');
            console.log('  If images still fail, check the browser console for generation errors.\n');
        } else {
            console.log('  ✅ API KEY IS VALID - All systems operational!\n');
            console.log('  If images still fail to render:');
            console.log('    1. Check vision_boards table for corrupted URLs');
            console.log('    2. Run the cleanup script to remove bad entries');
            console.log('    3. Try generating a new image\n');
        }

    } catch (err) {
        console.error('❌ Unexpected error:', err);
        console.error('\nMake sure:');
        console.error('  1. You are on your app page (not a different tab)');
        console.error('  2. The supabase client is available as `window.supabase`');
        console.error('  3. You are logged in');
    }
})();

console.log('Copy the ENTIRE script above and paste it into your browser console (F12) while on your app page.');
