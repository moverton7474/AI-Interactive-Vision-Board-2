import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

/**
 * Google Calendar OAuth Callback Handler
 *
 * This function handles the OAuth redirect from Google after user authorization.
 * It exchanges the authorization code for tokens and stores the connection.
 *
 * Flow:
 * 1. Google redirects here with ?code=xxx&state=xxx
 * 2. We decode the state to get userId
 * 3. We exchange the code for tokens
 * 4. We store the connection in the database
 * 5. We redirect to the app with success/error status
 */
serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI') ||
      `${SUPABASE_URL}/functions/v1/google-calendar-callback`;
    const SITE_URL = Deno.env.get('SITE_URL') || 'https://ai-interactive-vision-board-2.vercel.app';

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google Calendar integration not configured');
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle OAuth errors from Google
    if (error) {
      console.error('OAuth error from Google:', error);
      return Response.redirect(
        `${SITE_URL}/settings?calendar_error=${encodeURIComponent(error)}`,
        302
      );
    }

    if (!code || !state) {
      console.error('Missing code or state in callback');
      return Response.redirect(
        `${SITE_URL}/settings?calendar_error=${encodeURIComponent('Missing authorization code')}`,
        302
      );
    }

    // Decode state to get userId
    let userId: string;
    try {
      const stateData = JSON.parse(atob(state));
      userId = stateData.userId;

      // Verify state isn't too old (max 10 minutes)
      const stateAge = Date.now() - stateData.timestamp;
      if (stateAge > 10 * 60 * 1000) {
        throw new Error('Authorization request expired');
      }
    } catch (e) {
      console.error('Invalid state parameter:', e);
      return Response.redirect(
        `${SITE_URL}/settings?calendar_error=${encodeURIComponent('Invalid authorization state')}`,
        302
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData);
      return Response.redirect(
        `${SITE_URL}/settings?calendar_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`,
        302
      );
    }

    // Get calendar info to verify connection
    const calendarResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList/primary',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      }
    );

    const calendarData = await calendarResponse.json();
    const calendarName = calendarData.summary || 'Primary Calendar';

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    // Store connection in database using service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: upsertError } = await supabase
      .from('user_calendar_connections')
      .upsert({
        user_id: userId,
        provider: 'google',
        access_token_encrypted: tokenData.access_token,
        refresh_token_encrypted: tokenData.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        calendar_id: 'primary',
        calendar_name: calendarName,
        is_active: true,
        connected_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,provider'
      });

    if (upsertError) {
      console.error('Database error:', upsertError);
      return Response.redirect(
        `${SITE_URL}/settings?calendar_error=${encodeURIComponent('Failed to save connection')}`,
        302
      );
    }

    console.log(`Successfully connected Google Calendar for user ${userId}`);

    // Redirect back to app with success
    return Response.redirect(
      `${SITE_URL}/settings?calendar_success=true&calendar_name=${encodeURIComponent(calendarName)}`,
      302
    );

  } catch (error: any) {
    console.error('Callback error:', error);
    const SITE_URL = Deno.env.get('SITE_URL') || 'https://ai-interactive-vision-board-2.vercel.app';
    return Response.redirect(
      `${SITE_URL}/settings?calendar_error=${encodeURIComponent(error.message || 'Connection failed')}`,
      302
    );
  }
});
