import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { jobId } = await req.json()

        if (!jobId) {
            throw new Error('Missing jobId')
        }

        // 1. Fetch Job
        const { data: job, error: fetchError } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single()

        if (fetchError || !job) {
            throw new Error(`Job not found: ${fetchError?.message}`)
        }

        // 2. Update Status to Processing
        await supabase
            .from('jobs')
            .update({ status: 'processing' })
            .eq('id', jobId)

        let result = {}

        // 3. Process based on Type
        try {
            switch (job.type) {
                case 'pdf_export':
                    result = await handlePdfExport(job.payload)
                    break
                case 'image_generation':
                    // Placeholder for async image generation
                    // In a real scenario, this might call the AI model and upload to storage
                    await new Promise(resolve => setTimeout(resolve, 3000)) // Simulate work
                    result = { url: 'https://placehold.co/600x400', prompt: job.payload.prompt }
                    break
                default:
                    throw new Error(`Unknown job type: ${job.type}`)
            }

            // 4. Update Status to Completed
            await supabase
                .from('jobs')
                .update({
                    status: 'completed',
                    result: result
                })
                .eq('id', jobId)

        } catch (processError: any) {
            // Handle Failure
            console.error(`Job ${jobId} failed:`, processError)
            await supabase
                .from('jobs')
                .update({
                    status: 'failed',
                    error: processError.message
                })
                .eq('id', jobId)
        }

        return new Response(
            JSON.stringify({ success: true, jobId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})

// Mock Handlers
async function handlePdfExport(payload: any) {
    // Simulate PDF generation delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    return {
        downloadUrl: `https://example.com/download/${crypto.randomUUID()}.pdf`,
        pageCount: payload.pages || 10
    }
}
