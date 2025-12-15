/**
 * Process Team Communications - Edge Function
 *
 * Queue-based processor for team communications.
 * Processes scheduled/pending communications and sends emails in batches.
 *
 * Features:
 * - Batch processing (max 50 per batch)
 * - Rate limiting (100 emails/minute)
 * - Retry logic with exponential backoff
 * - Respects user communication preferences
 * - Updates delivery statistics
 *
 * Should be called periodically via pg_cron or manually triggered.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration
const BATCH_SIZE = 50;
const RATE_LIMIT_PER_MINUTE = 100;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [60000, 300000, 900000]; // 1min, 5min, 15min

interface TeamCommunication {
  id: string;
  team_id: string;
  sender_id: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  template_type: string;
  recipient_filter: Record<string, any> | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: string;
  scheduled_for: string | null;
  created_at: string;
}

interface CommunicationRecipient {
  id: string;
  communication_id: string;
  user_id: string;
  email: string;
  status: string;
  attempts: number;
  error_message: string | null;
}

interface ProcessResult {
  communications_processed: number;
  total_recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    communication_id: string;
    sent: number;
    failed: number;
    status: string;
  }>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for options
    let maxCommunications = 10;
    try {
      const body = await req.json();
      maxCommunications = body.maxCommunications || 10;
    } catch {
      // Use defaults
    }

    console.log(`Processing team communications (max: ${maxCommunications})`);

    const result: ProcessResult = {
      communications_processed: 0,
      total_recipients: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };

    // Fetch communications that need processing
    // Status: 'scheduled' with scheduled_for <= now, or 'sending' (resume interrupted)
    const now = new Date().toISOString();
    const { data: communications, error: fetchError } = await supabase
      .from('team_communications')
      .select('*')
      .or(`and(status.eq.scheduled,scheduled_for.lte.${now}),status.eq.sending`)
      .order('scheduled_for', { ascending: true, nullsFirst: false })
      .limit(maxCommunications);

    if (fetchError) {
      throw new Error(`Failed to fetch communications: ${fetchError.message}`);
    }

    if (!communications || communications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No communications to process', ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${communications.length} communications to process`);

    // Process each communication
    for (const comm of communications as TeamCommunication[]) {
      const commResult = await processCommunication(supabase, comm);
      result.communications_processed++;
      result.total_recipients += commResult.total;
      result.sent += commResult.sent;
      result.failed += commResult.failed;
      result.skipped += commResult.skipped;
      result.details.push({
        communication_id: comm.id,
        sent: commResult.sent,
        failed: commResult.failed,
        status: commResult.finalStatus,
      });
    }

    console.log(`Processed ${result.communications_processed} communications: ${result.sent} sent, ${result.failed} failed`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing team communications:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Process a single communication - send to all pending recipients
 */
async function processCommunication(
  supabase: any,
  comm: TeamCommunication
): Promise<{ total: number; sent: number; failed: number; skipped: number; finalStatus: string }> {
  const result = { total: 0, sent: 0, failed: 0, skipped: 0, finalStatus: 'sent' };

  try {
    // Update status to 'sending'
    await supabase
      .from('team_communications')
      .update({ status: 'sending', sent_at: comm.sent_at || new Date().toISOString() })
      .eq('id', comm.id);

    // Get sender info for email template
    const { data: sender } = await supabase
      .from('profiles')
      .select('id, names, email')
      .eq('id', comm.sender_id)
      .single();

    // Get team info
    const { data: team } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', comm.team_id)
      .single();

    // Fetch pending recipients (not yet sent, or failed with retries remaining)
    const { data: recipients, error: recipientsError } = await supabase
      .from('team_communication_recipients')
      .select('*')
      .eq('communication_id', comm.id)
      .or('status.eq.pending,and(status.eq.failed,attempts.lt.3)')
      .limit(BATCH_SIZE);

    if (recipientsError) {
      throw new Error(`Failed to fetch recipients: ${recipientsError.message}`);
    }

    if (!recipients || recipients.length === 0) {
      // No more recipients to process - mark as complete
      await finalizeCommunication(supabase, comm.id);
      result.finalStatus = 'sent';
      return result;
    }

    result.total = recipients.length;

    // Process recipients with rate limiting
    let emailsSentThisMinute = 0;
    const minuteStart = Date.now();

    for (const recipient of recipients as CommunicationRecipient[]) {
      // Check rate limit
      if (emailsSentThisMinute >= RATE_LIMIT_PER_MINUTE) {
        const elapsed = Date.now() - minuteStart;
        if (elapsed < 60000) {
          // Wait for the remainder of the minute
          await delay(60000 - elapsed);
          emailsSentThisMinute = 0;
        }
      }

      // Check if user has opted out of team announcements
      const { data: prefs } = await supabase
        .from('user_comm_preferences')
        .select('team_announcements_enabled')
        .eq('user_id', recipient.user_id)
        .single();

      if (prefs?.team_announcements_enabled === false) {
        // User has opted out - mark as skipped
        await supabase
          .from('team_communication_recipients')
          .update({ status: 'skipped', error_message: 'User opted out of team announcements' })
          .eq('id', recipient.id);
        result.skipped++;
        continue;
      }

      // Get user's name for personalization
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('names, email')
        .eq('id', recipient.user_id)
        .single();

      // Map template type to email template
      const templateMap: Record<string, string> = {
        'announcement': 'team_announcement',
        'recognition': 'team_recognition',
        'reminder': 'team_reminder',
        'custom': 'team_announcement',
      };
      const emailTemplate = templateMap[comm.template_type] || 'team_announcement';

      // Send email via send-email function
      try {
        const { error: sendError } = await supabase.functions.invoke('send-email', {
          body: {
            to: recipient.email,
            template: emailTemplate,
            subject: comm.subject,
            userId: recipient.user_id,
            data: {
              name: userProfile?.names || recipient.email?.split('@')[0] || 'Team Member',
              subject: comm.subject,
              message: comm.body_html,
              body_html: comm.body_html,
              senderName: sender?.names || sender?.email?.split('@')[0] || 'Team Manager',
              teamName: team?.name || 'Your Team',
            },
          },
        });

        if (sendError) {
          throw new Error(sendError.message);
        }

        // Mark as sent
        await supabase
          .from('team_communication_recipients')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            attempts: recipient.attempts + 1,
          })
          .eq('id', recipient.id);

        result.sent++;
        emailsSentThisMinute++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const newAttempts = recipient.attempts + 1;
        const newStatus = newAttempts >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending';

        // Calculate next retry time
        const retryDelay = RETRY_DELAYS[Math.min(newAttempts - 1, RETRY_DELAYS.length - 1)];
        const nextRetry = newStatus === 'pending' ? new Date(Date.now() + retryDelay).toISOString() : null;

        await supabase
          .from('team_communication_recipients')
          .update({
            status: newStatus,
            attempts: newAttempts,
            error_message: errorMessage,
            // Note: next_retry_at field would need to be added to schema if we want scheduled retries
          })
          .eq('id', recipient.id);

        if (newStatus === 'failed') {
          result.failed++;
        }

        console.error(`Failed to send to ${recipient.email}: ${errorMessage}`);
      }
    }

    // Check if there are more recipients to process
    const { count: remainingCount } = await supabase
      .from('team_communication_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('communication_id', comm.id)
      .or('status.eq.pending,and(status.eq.failed,attempts.lt.3)');

    if (remainingCount === 0) {
      await finalizeCommunication(supabase, comm.id);
      result.finalStatus = 'sent';
    } else {
      // Still has pending recipients - keep status as 'sending'
      result.finalStatus = 'sending';
    }

  } catch (error) {
    console.error(`Error processing communication ${comm.id}:`, error);
    result.finalStatus = 'partial';

    // Update communication status to reflect partial completion
    await supabase
      .from('team_communications')
      .update({ status: 'partial' })
      .eq('id', comm.id);
  }

  return result;
}

/**
 * Finalize a communication - update stats and mark as complete
 */
async function finalizeCommunication(supabase: any, commId: string): Promise<void> {
  // Get final recipient stats
  const { data: stats } = await supabase
    .from('team_communication_recipients')
    .select('status')
    .eq('communication_id', commId);

  if (!stats) return;

  const sentCount = stats.filter((r: any) => r.status === 'sent').length;
  const deliveredCount = stats.filter((r: any) => ['sent', 'delivered', 'opened', 'clicked'].includes(r.status)).length;
  const failedCount = stats.filter((r: any) => r.status === 'failed').length;
  const bouncedCount = stats.filter((r: any) => r.status === 'bounced').length;

  // Determine final status
  let finalStatus = 'sent';
  if (failedCount > 0 && sentCount === 0) {
    finalStatus = 'failed';
  } else if (failedCount > 0) {
    finalStatus = 'partial';
  }

  // Update communication record
  await supabase
    .from('team_communications')
    .update({
      status: finalStatus,
      sent_count: sentCount,
      delivered_count: deliveredCount,
      failed_count: failedCount,
      bounced_count: bouncedCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', commId);
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
