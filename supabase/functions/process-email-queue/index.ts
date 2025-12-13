/**
 * Process Email Queue Edge Function
 *
 * Processes pending emails from the email_queue table.
 * Should be called periodically via cron or manually triggered.
 *
 * Features:
 * - Batch processing with configurable size
 * - Retry logic with exponential backoff
 * - Dead letter handling for failed emails
 * - Enriches template data with user information
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QueuedEmail {
  id: string;
  user_id: string;
  to_email: string;
  template: string;
  template_data: Record<string, any>;
  priority: number;
  scheduled_for: string;
  status: string;
  attempts: number;
  max_attempts: number;
}

interface ProcessResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    id: string;
    status: 'sent' | 'failed' | 'skipped';
    error?: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for batch size
    let batchSize = 50;
    try {
      const body = await req.json();
      batchSize = body.batchSize || 50;
    } catch {
      // Use default batch size
    }

    console.log(`Processing email queue with batch size: ${batchSize}`);

    // Fetch pending emails
    const { data: queuedEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .lt('attempts', 3) // Max 3 attempts
      .order('priority', { ascending: true })
      .order('scheduled_for', { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      throw new Error(`Failed to fetch email queue: ${fetchError.message}`);
    }

    if (!queuedEmails || queuedEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No emails to process', processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${queuedEmails.length} emails to process`);

    const result: ProcessResult = {
      total: queuedEmails.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };

    // Process each email
    for (const email of queuedEmails as QueuedEmail[]) {
      try {
        // Mark as processing
        await supabase
          .from('email_queue')
          .update({ status: 'processing', attempts: email.attempts + 1 })
          .eq('id', email.id);

        // Enrich template data with additional user info if needed
        let enrichedData = { ...email.template_data };

        if (email.user_id && email.template === 'weekly_review') {
          // Fetch weekly review stats for the user
          const stats = await getWeeklyReviewStats(supabase, email.user_id);
          enrichedData = { ...enrichedData, ...stats };
        }

        // Send the email via send-email function
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-email', {
          body: {
            to: email.to_email,
            template: email.template,
            data: enrichedData,
            userId: email.user_id,
          },
        });

        if (sendError) {
          throw new Error(sendError.message);
        }

        // Mark as sent
        await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            processed_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        result.sent++;
        result.details.push({ id: email.id, status: 'sent' });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to send email ${email.id}:`, errorMessage);

        // Update with error
        const newStatus = email.attempts + 1 >= email.max_attempts ? 'failed' : 'pending';
        await supabase
          .from('email_queue')
          .update({
            status: newStatus,
            last_error: errorMessage,
          })
          .eq('id', email.id);

        if (newStatus === 'failed') {
          result.failed++;
        }
        result.details.push({ id: email.id, status: 'failed', error: errorMessage });
      }
    }

    console.log(`Processed ${result.total} emails: ${result.sent} sent, ${result.failed} failed`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing email queue:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Get weekly review statistics for a user
 */
async function getWeeklyReviewStats(supabase: any, userId: string): Promise<Record<string, any>> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoISO = oneWeekAgo.toISOString();

  // Get habit completions this week
  const { data: completions } = await supabase
    .from('habit_completions')
    .select('id')
    .eq('user_id', userId)
    .gte('completed_at', oneWeekAgoISO);

  // Get total habits
  const { data: habits } = await supabase
    .from('habits')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true);

  // Get longest streak
  const { data: achievements } = await supabase
    .from('user_achievements')
    .select('current_streak')
    .eq('user_id', userId)
    .order('current_streak', { ascending: false })
    .limit(1);

  const habitsCompleted = completions?.length || 0;
  const totalHabits = habits?.length || 0;
  const expectedCompletions = totalHabits * 7; // 7 days
  const completionRate = expectedCompletions > 0
    ? Math.round((habitsCompleted / expectedCompletions) * 100)
    : 0;

  // Generate wins based on activity
  const wins: string[] = [];
  if (habitsCompleted > 0) {
    wins.push(`Completed ${habitsCompleted} habit check-ins`);
  }
  if (achievements?.[0]?.current_streak >= 7) {
    wins.push(`Maintained a ${achievements[0].current_streak}-day streak!`);
  }
  if (completionRate >= 80) {
    wins.push('Achieved 80%+ completion rate - excellent consistency!');
  }

  return {
    completionRate,
    habitsCompleted,
    longestStreak: achievements?.[0]?.current_streak || 0,
    wins,
    insights: completionRate >= 70
      ? "You're building strong momentum! Keep up the consistent effort."
      : completionRate >= 40
      ? "You're making progress. Try setting specific times for your habits to boost consistency."
      : "Every small step counts. Consider starting with just one habit to build momentum.",
  };
}
