import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Google Calendar OAuth Connection Handler
 *
 * Handles the OAuth 2.0 flow for connecting Google Calendar:
 * - GET with action=auth_url: Returns the OAuth authorization URL
 * - POST with code: Exchanges authorization code for tokens
 * - POST with action=refresh: Refreshes expired access tokens
 * - POST with action=disconnect: Removes calendar connection
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI') ||
      `${SUPABASE_URL}/functions/v1/google-calendar-callback`;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google Calendar integration not configured');
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_SERVICE_ROLE_KEY ?? '');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid or expired authentication token');
    }

    const userId = user.id;
    const url = new URL(req.url);
    const requestBody = req.method === 'POST' ? await req.json() : {};
    const action = url.searchParams.get('action') || requestBody.action;

    // Generate OAuth authorization URL
    if (action === 'auth_url') {
      const scopes = [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
      ];

      // Use btoa for base64 encoding (Deno/Web API compatible)
      const state = btoa(JSON.stringify({
        userId,
        timestamp: Date.now()
      }));

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes.join(' '));
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', state);

      return new Response(
        JSON.stringify({
          success: true,
          auth_url: authUrl.toString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange authorization code for tokens
    if (action === 'exchange_code' || requestBody.code) {
      const code = requestBody.code;
      if (!code) {
        throw new Error('Authorization code is required');
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
        throw new Error(`OAuth error: ${tokenData.error_description || tokenData.error}`);
      }

      // Get calendar list to verify connection
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

      // Store connection in database (encrypt tokens in production)
      const { error: upsertError } = await supabase
        .from('user_calendar_connections')
        .upsert({
          user_id: userId,
          provider: 'google',
          access_token_encrypted: tokenData.access_token, // In production, encrypt this
          refresh_token_encrypted: tokenData.refresh_token, // In production, encrypt this
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
        throw new Error(`Failed to save connection: ${upsertError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Google Calendar connected successfully',
          calendar_name: calendarName
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh access token
    if (action === 'refresh') {
      const { data: connection, error: fetchError } = await supabase
        .from('user_calendar_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .single();

      if (fetchError || !connection) {
        throw new Error('No calendar connection found');
      }

      if (!connection.refresh_token_encrypted) {
        throw new Error('No refresh token available - please reconnect');
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: connection.refresh_token_encrypted,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token'
        })
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        // Mark connection as inactive if refresh fails
        await supabase
          .from('user_calendar_connections')
          .update({ is_active: false })
          .eq('id', connection.id);

        throw new Error(`Token refresh failed: ${tokenData.error_description || tokenData.error}`);
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      await supabase
        .from('user_calendar_connections')
        .update({
          access_token_encrypted: tokenData.access_token,
          token_expires_at: expiresAt.toISOString(),
          last_synced_at: new Date().toISOString()
        })
        .eq('id', connection.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Token refreshed successfully',
          expires_at: expiresAt.toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Disconnect calendar
    if (action === 'disconnect') {
      const { data: connection } = await supabase
        .from('user_calendar_connections')
        .select('access_token_encrypted')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .single();

      // Revoke token with Google (optional but good practice)
      if (connection?.access_token_encrypted) {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${connection.access_token_encrypted}`,
          { method: 'POST' }
        ).catch(() => {}); // Ignore revocation errors
      }

      // Delete connection from database
      const { error: deleteError } = await supabase
        .from('user_calendar_connections')
        .delete()
        .eq('user_id', userId)
        .eq('provider', 'google');

      if (deleteError) {
        throw new Error(`Failed to disconnect: ${deleteError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Google Calendar disconnected'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get connection status
    if (action === 'status') {
      const { data: connection } = await supabase
        .from('user_calendar_connections')
        .select('calendar_name, is_active, connected_at, last_synced_at, token_expires_at')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          connected: !!connection && connection.is_active,
          connection: connection ? {
            calendar_name: connection.calendar_name,
            connected_at: connection.connected_at,
            last_synced_at: connection.last_synced_at,
            token_expires_soon: connection.token_expires_at &&
              new Date(connection.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)
          } : null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error('Calendar connect error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
