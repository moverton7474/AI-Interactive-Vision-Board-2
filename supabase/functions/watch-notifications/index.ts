import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Watch Notifications - Apple Push Notification Service Integration
 *
 * Handles sending push notifications to Apple Watch:
 * - Habit reminders
 * - Streak milestone celebrations
 * - Coach messages
 * - Goal alerts
 *
 * Notification Categories:
 * - HABIT_REMINDER: Actionable notification with "Complete" button
 * - STREAK_ALERT: Celebration notification for streak milestones
 * - COACH_MESSAGE: Motivational micro-coaching message
 * - GOAL_ALERT: Goal progress or deadline notification
 */

interface APNsPayload {
  userId: string
  deviceToken?: string
  title: string
  body: string
  subtitle?: string
  category?: 'HABIT_REMINDER' | 'STREAK_ALERT' | 'COACH_MESSAGE' | 'GOAL_ALERT'
  habitId?: string
  data?: Record<string, any>
  sound?: string
  badge?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'send':
        return await sendNotification(supabase, body)

      case 'send_to_user':
        return await sendToUser(supabase, body)

      case 'send_habit_reminder':
        return await sendHabitReminder(supabase, body)

      case 'send_streak_celebration':
        return await sendStreakCelebration(supabase, body)

      case 'send_coach_message':
        return await sendCoachMessage(supabase, body)

      case 'batch_send':
        return await batchSend(supabase, body.notifications)

      default:
        return jsonError(`Unknown action: ${action}`, 400)
    }

  } catch (error: any) {
    console.error('Watch notification error:', error.message)
    return jsonError(error.message, 500)
  }
})

/**
 * Send notification to a specific device token
 */
async function sendNotification(supabase: any, payload: APNsPayload) {
  if (!payload.deviceToken) {
    return jsonError('deviceToken is required', 400)
  }

  const result = await sendAPNs(payload.deviceToken, payload)

  // Log notification
  await supabase.from('notification_log').insert({
    user_id: payload.userId,
    device_token: payload.deviceToken,
    notification_type: payload.category || 'GENERAL',
    title: payload.title,
    body: payload.body,
    status: result.success ? 'sent' : 'failed',
    apns_response: result
  })

  return jsonSuccess(result)
}

/**
 * Send notification to all of a user's registered devices
 */
async function sendToUser(supabase: any, payload: APNsPayload) {
  if (!payload.userId) {
    return jsonError('userId is required', 400)
  }

  // Get all device tokens for user
  const { data: devices, error } = await supabase
    .from('user_device_tokens')
    .select('device_token, device_type')
    .eq('user_id', payload.userId)
    .eq('platform', 'apns')
    .eq('is_active', true)

  if (error) throw error

  if (!devices?.length) {
    return jsonSuccess({
      success: true,
      sent: 0,
      message: 'No registered devices found'
    })
  }

  const results = await Promise.all(
    devices.map(async (device: any) => {
      const result = await sendAPNs(device.device_token, payload)
      return { deviceToken: device.device_token, ...result }
    })
  )

  // Mark failed tokens as inactive
  const failedTokens = results
    .filter(r => !r.success && r.status === 410) // 410 = unregistered device
    .map(r => r.deviceToken)

  if (failedTokens.length > 0) {
    await supabase
      .from('user_device_tokens')
      .update({ is_active: false })
      .in('device_token', failedTokens)
  }

  return jsonSuccess({
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  })
}

/**
 * Send habit reminder notification
 */
async function sendHabitReminder(supabase: any, body: any) {
  const { userId, habitId, habitTitle, reminderTime } = body

  if (!userId || !habitId) {
    return jsonError('userId and habitId are required', 400)
  }

  // Get user's name
  const { data: profile } = await supabase
    .from('profiles')
    .select('names')
    .eq('id', userId)
    .single()

  const firstName = profile?.names?.split(' ')[0] || 'there'

  const payload: APNsPayload = {
    userId,
    title: `Time for "${habitTitle}"`,
    body: `Hey ${firstName}, your habit is waiting. One tap to complete it.`,
    category: 'HABIT_REMINDER',
    habitId,
    sound: 'default',
    data: { habitId, action: 'habit_reminder' }
  }

  return await sendToUser(supabase, payload)
}

/**
 * Send streak celebration notification
 */
async function sendStreakCelebration(supabase: any, body: any) {
  const { userId, habitId, habitTitle, streak } = body

  if (!userId || !streak) {
    return jsonError('userId and streak are required', 400)
  }

  // Get user's name
  const { data: profile } = await supabase
    .from('profiles')
    .select('names')
    .eq('id', userId)
    .single()

  const firstName = profile?.names?.split(' ')[0] || 'there'

  let emoji = '🔥'
  let message = ''

  if (streak === 7) {
    emoji = '🎉'
    message = `${firstName}, 7 days straight! You're building real momentum.`
  } else if (streak === 30) {
    emoji = '🏆'
    message = `${firstName}, 30 DAYS! You've turned this into a true habit.`
  } else if (streak === 100) {
    emoji = '👑'
    message = `${firstName}, 100 DAYS! You're an absolute legend.`
  } else {
    message = `${firstName}, you're on a ${streak}-day streak! Keep it going.`
  }

  const payload: APNsPayload = {
    userId,
    title: `${emoji} ${streak} Day Streak!`,
    body: message,
    category: 'STREAK_ALERT',
    habitId,
    sound: 'celebration.caf',
    data: { habitId, streak, action: 'streak_celebration' }
  }

  return await sendToUser(supabase, payload)
}

/**
 * Send coach message notification
 */
async function sendCoachMessage(supabase: any, body: any) {
  const { userId, message, context } = body

  if (!userId || !message) {
    return jsonError('userId and message are required', 400)
  }

  const payload: APNsPayload = {
    userId,
    title: '💬 Coach AMIE',
    body: message,
    category: 'COACH_MESSAGE',
    sound: 'gentle.caf',
    data: { context, action: 'coach_message' }
  }

  return await sendToUser(supabase, payload)
}

/**
 * Batch send multiple notifications
 */
async function batchSend(supabase: any, notifications: APNsPayload[]) {
  if (!notifications?.length) {
    return jsonError('notifications array is required', 400)
  }

  const results = await Promise.all(
    notifications.map(notification => sendToUser(supabase, notification))
  )

  const totalSent = results.reduce((sum: number, r: any) => sum + (r.sent || 0), 0)
  const totalFailed = results.reduce((sum: number, r: any) => sum + (r.failed || 0), 0)

  return jsonSuccess({
    totalSent,
    totalFailed,
    batchSize: notifications.length
  })
}

/**
 * Send notification via Apple Push Notification Service (APNs)
 */
async function sendAPNs(deviceToken: string, payload: APNsPayload): Promise<any> {
  // APNs configuration from environment
  const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID')
  const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID')
  const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY')
  const BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') || 'com.visionary.app'
  const APNS_ENVIRONMENT = Deno.env.get('APNS_ENVIRONMENT') || 'development'

  // Check if APNs is configured
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
    console.warn('APNs not configured, skipping push notification')
    return {
      success: false,
      error: 'APNs not configured',
      skipped: true
    }
  }

  try {
    // Generate JWT for APNs authentication
    const jwt = await generateAPNsJWT(APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY)

    // Build APNs payload
    const apnsPayload = {
      aps: {
        alert: {
          title: payload.title,
          subtitle: payload.subtitle,
          body: payload.body
        },
        sound: payload.sound || 'default',
        badge: payload.badge,
        category: payload.category || 'DEFAULT',
        'content-available': 1,
        'mutable-content': 1
      },
      // Custom data
      habitId: payload.habitId,
      ...payload.data
    }

    // Determine APNs endpoint (sandbox vs production)
    const apnsHost = APNS_ENVIRONMENT === 'production'
      ? 'api.push.apple.com'
      : 'api.sandbox.push.apple.com'

    // Send to APNs
    const response = await fetch(
      `https://${apnsHost}/3/device/${deviceToken}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `bearer ${jwt}`,
          'apns-topic': `${BUNDLE_ID}.watchkitapp`,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'apns-expiration': '0'
        },
        body: JSON.stringify(apnsPayload)
      }
    )

    const responseBody = await response.text()

    if (response.ok) {
      return {
        success: true,
        status: response.status,
        apnsId: response.headers.get('apns-id')
      }
    } else {
      console.error(`APNs error: ${response.status} - ${responseBody}`)
      return {
        success: false,
        status: response.status,
        error: responseBody
      }
    }

  } catch (error: any) {
    console.error('APNs send error:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Generate JWT for APNs authentication
 * Uses ES256 algorithm as required by APNs
 */
async function generateAPNsJWT(keyId: string, teamId: string, privateKeyPEM: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // JWT Header
  const header = {
    alg: 'ES256',
    kid: keyId
  }

  // JWT Claims
  const claims = {
    iss: teamId,
    iat: now
  }

  // Encode header and claims
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedClaims = base64UrlEncode(JSON.stringify(claims))
  const signatureInput = `${encodedHeader}.${encodedClaims}`

  // Import the private key
  const privateKey = await importPrivateKey(privateKeyPEM)

  // Sign the JWT
  const encoder = new TextEncoder()
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(signatureInput)
  )

  // Convert signature to base64url
  const encodedSignature = base64UrlEncode(new Uint8Array(signature))

  return `${signatureInput}.${encodedSignature}`
}

/**
 * Import ECDSA private key from PEM format
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and decode
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

/**
 * Base64 URL encode (no padding, URL-safe characters)
 */
function base64UrlEncode(data: string | Uint8Array): string {
  let base64: string

  if (typeof data === 'string') {
    base64 = btoa(data)
  } else {
    base64 = base64Encode(data)
  }

  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Response helpers
function jsonSuccess(data: any): Response {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

function jsonError(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}
