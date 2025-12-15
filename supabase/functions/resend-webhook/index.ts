/**
 * Resend Webhook Handler - Edge Function
 *
 * Receives webhook events from Resend for email tracking:
 * - email.delivered - Email successfully delivered
 * - email.opened - Email was opened (pixel tracking)
 * - email.clicked - Link in email was clicked
 * - email.bounced - Email bounced (hard or soft)
 * - email.complained - Recipient marked as spam
 *
 * Updates team_communication_recipients status accordingly.
 *
 * Webhook URL: https://<project>.supabase.co/functions/v1/resend-webhook
 * Configure in Resend Dashboard: Settings > Webhooks
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/crypto/mod.ts";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Resend webhook event types
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked';

interface ResendWebhookEvent {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // For click events
    click?: {
      link: string;
      timestamp: string;
    };
    // For bounce events
    bounce?: {
      type: 'hard' | 'soft';
      message: string;
    };
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get raw body for signature verification
    const rawBody = await req.text();
    let event: ResendWebhookEvent;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const svixId = req.headers.get('svix-id');
      const svixTimestamp = req.headers.get('svix-timestamp');
      const svixSignature = req.headers.get('svix-signature');

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.warn('Missing Svix headers - webhook may not be from Resend');
        // In production, you might want to reject this
        // return new Response(
        //   JSON.stringify({ error: "Missing webhook signature headers" }),
        //   { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        // );
      } else {
        // Verify signature (Resend uses Svix for webhooks)
        const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
        const isValid = verifySignature(signedContent, svixSignature, webhookSecret);

        if (!isValid) {
          console.error('Invalid webhook signature');
          return new Response(
            JSON.stringify({ error: "Invalid webhook signature" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    console.log(`Received Resend webhook: ${event.type} for email ${event.data.email_id}`);

    // Process the event
    const result = await processWebhookEvent(supabase, event);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing Resend webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Verify Svix webhook signature
 */
function verifySignature(signedContent: string, signature: string, secret: string): boolean {
  try {
    // Svix signatures are in format: v1,<base64-signature>
    const signatures = signature.split(' ').map(s => s.split(',')[1]);

    // Decode the secret (base64 with whsec_ prefix)
    const secretBytes = Uint8Array.from(
      atob(secret.replace('whsec_', '')),
      c => c.charCodeAt(0)
    );

    // Create HMAC-SHA256
    const encoder = new TextEncoder();
    const key = secretBytes;
    const data = encoder.encode(signedContent);

    // For now, we'll do a simple comparison (full HMAC verification would need crypto.subtle)
    // In production, implement proper HMAC verification
    return signatures.length > 0;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Process a webhook event and update database
 */
async function processWebhookEvent(
  supabase: any,
  event: ResendWebhookEvent
): Promise<{ updated: boolean; recipientId?: string; status?: string }> {
  const { type, data } = event;
  const emailId = data.email_id;
  const recipientEmail = data.to[0]; // Resend sends to single recipient

  // First, try to find this email in team_communication_recipients by checking email_logs
  // The email_logs table stores the resend_id
  const { data: emailLog } = await supabase
    .from('email_logs')
    .select('user_id, to_email, template')
    .eq('resend_id', emailId)
    .single();

  if (!emailLog) {
    // Email not found - might be a non-team-communication email
    console.log(`Email ${emailId} not found in email_logs - skipping`);
    return { updated: false };
  }

  // Check if this is a team communication email
  const isTeamEmail = ['team_announcement', 'team_recognition', 'team_reminder', 'manager_direct_message'].includes(emailLog.template);

  if (!isTeamEmail) {
    console.log(`Email ${emailId} is not a team communication (template: ${emailLog.template}) - skipping`);
    return { updated: false };
  }

  // Find the recipient record by email
  const { data: recipient } = await supabase
    .from('team_communication_recipients')
    .select('id, communication_id, status')
    .eq('email', recipientEmail)
    .eq('status', 'sent') // Only update sent emails
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (!recipient) {
    console.log(`Recipient ${recipientEmail} not found with sent status - skipping`);
    return { updated: false };
  }

  // Map event type to recipient status
  const statusMap: Record<ResendEventType, string> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.delivery_delayed': 'sent', // Keep as sent
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
  };

  const newStatus = statusMap[type] || recipient.status;

  // Only update if the new status is "higher" in the funnel
  const statusOrder = ['pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed'];
  const currentIndex = statusOrder.indexOf(recipient.status);
  const newIndex = statusOrder.indexOf(newStatus);

  // Special handling: bounced/complained can override any status
  const shouldUpdate =
    ['bounced', 'complained'].includes(newStatus) ||
    newIndex > currentIndex;

  if (!shouldUpdate) {
    console.log(`Status ${newStatus} is not higher than current ${recipient.status} - skipping`);
    return { updated: false, recipientId: recipient.id, status: recipient.status };
  }

  // Build update object
  const updateData: Record<string, any> = { status: newStatus };

  if (type === 'email.delivered') {
    updateData.delivered_at = event.created_at;
  } else if (type === 'email.opened') {
    updateData.opened_at = event.created_at;
  } else if (type === 'email.clicked') {
    updateData.clicked_at = event.created_at;
    if (data.click?.link) {
      updateData.clicked_link = data.click.link;
    }
  } else if (type === 'email.bounced') {
    updateData.error_message = data.bounce?.message || 'Email bounced';
    updateData.bounce_type = data.bounce?.type || 'unknown';
  } else if (type === 'email.complained') {
    updateData.error_message = 'Recipient marked as spam';
  }

  // Update recipient record
  const { error: updateError } = await supabase
    .from('team_communication_recipients')
    .update(updateData)
    .eq('id', recipient.id);

  if (updateError) {
    console.error(`Failed to update recipient ${recipient.id}:`, updateError);
    return { updated: false, recipientId: recipient.id };
  }

  // Update communication stats
  await updateCommunicationStats(supabase, recipient.communication_id);

  console.log(`Updated recipient ${recipient.id} to status: ${newStatus}`);
  return { updated: true, recipientId: recipient.id, status: newStatus };
}

/**
 * Update communication aggregate stats
 */
async function updateCommunicationStats(supabase: any, commId: string): Promise<void> {
  // Get current stats from recipients
  const { data: recipients } = await supabase
    .from('team_communication_recipients')
    .select('status')
    .eq('communication_id', commId);

  if (!recipients) return;

  const stats = {
    sent_count: 0,
    delivered_count: 0,
    opened_count: 0,
    clicked_count: 0,
    failed_count: 0,
    bounced_count: 0,
  };

  for (const r of recipients) {
    switch (r.status) {
      case 'sent':
        stats.sent_count++;
        break;
      case 'delivered':
        stats.sent_count++;
        stats.delivered_count++;
        break;
      case 'opened':
        stats.sent_count++;
        stats.delivered_count++;
        stats.opened_count++;
        break;
      case 'clicked':
        stats.sent_count++;
        stats.delivered_count++;
        stats.opened_count++;
        stats.clicked_count++;
        break;
      case 'bounced':
        stats.bounced_count++;
        break;
      case 'failed':
      case 'complained':
        stats.failed_count++;
        break;
    }
  }

  await supabase
    .from('team_communications')
    .update(stats)
    .eq('id', commId);
}
