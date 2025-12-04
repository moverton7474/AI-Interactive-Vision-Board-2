import { supabase } from '../lib/supabase';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
    id: string;
    user_id: string;
    type: 'image_generation' | 'pdf_export' | 'email' | 'data_processing';
    status: JobStatus;
    payload: any;
    result: any;
    error: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Create a new background job and trigger the worker
 */
export const createJob = async (
    type: Job['type'],
    payload: any
): Promise<Job | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // 1. Insert Job into DB
        const { data, error } = await supabase
            .from('jobs')
            .insert([{
                user_id: user.id,
                type,
                payload,
                status: 'pending'
            }])
            .select()
            .single();

        if (error) throw error;

        // 2. Trigger Worker (Fire and Forget)
        // In a production setup with DB webhooks, this wouldn't be needed client-side.
        // But for this architecture, we invoke it directly to start processing.
        supabase.functions.invoke('background-worker', {
            body: { jobId: data.id }
        }).catch(err => console.error("Failed to trigger worker:", err));

        return data;
    } catch (error) {
        console.error("Failed to create job:", error);
        return null;
    }
};

/**
 * Subscribe to updates for a specific job
 */
export const subscribeToJob = (jobId: string, onUpdate: (job: Job) => void) => {
    const subscription = supabase
        .channel(`job-${jobId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'jobs',
                filter: `id=eq.${jobId}`
            },
            (payload) => {
                onUpdate(payload.new as Job);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(subscription);
    };
};

/**
 * Get a job by ID
 */
export const getJob = async (jobId: string): Promise<Job | null> => {
    const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

    if (error) return null;
    return data;
};
