import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Celebrate Streak - Milestone Achievement Notifications
 *
 * Triggered after habit completion to check for streak milestones.
 * Sends celebratory SMS/push notifications when users hit:
 * - 7 days (1 week)
 * - 14 days (2 weeks)
 * - 21 days (habit formed!)
 * - 30 days (1 month)
 * - 60 days (2 months)
 * - 90 days (quarter)
 * - 100 days (century!)
 * - 365 days (1 year)
 *
 * Usage: Call after habit completion with { habitId, userId, newStreak }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body = await req.json()
    const { habitId, userId, newStreak } = body

    if (!habitId || !userId || newStreak === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: habitId, userId, newStreak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if this is a milestone streak
    const milestones = [7, 14, 21, 30, 60, 90, 100, 180, 365]
    const isMilestone = milestones.includes(newStreak)

    if (!isMilestone) {
      return new Response(
        JSON.stringify({
          success: true,
          celebrated: false,
          message: `Streak of ${newStreak} is not a milestone`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get habit details
    const { data: habit, error: habitError } = await supabase
      .from('habits')
      .select('title, description')
      .eq('id', habitId)
      .single()

    if (habitError || !habit) {
      throw new Error('Habit not found')
    }

    // Get user details
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()

    const firstName = profile?.full_name?.split(' ')[0] || 'Champion'

    // Get user's communication preferences
    const { data: commPrefs } = await supabase
      .from('user_comm_preferences')
      .select('phone_number, phone_verified, sms_enabled')
      .eq('user_id', userId)
      .single()

    // Get user's agent settings for celebration preferences
    const { data: agentSettings } = await supabase
      .from('user_agent_settings')
      .select('streak_celebrations_enabled, celebration_channel')
      .eq('user_id', userId)
      .single()

    // Check if celebrations are enabled (default to true if no settings)
    const celebrationsEnabled = agentSettings?.streak_celebrations_enabled !== false

    if (!celebrationsEnabled) {
      return new Response(
        JSON.stringify({
          success: true,
          celebrated: false,
          message: 'Streak celebrations disabled for user'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate celebration message based on milestone
    const message = generateCelebrationMessage(firstName, habit.title, newStreak)

    // Log the celebration
    const { data: celebration, error: celebrationError } = await supabase
      .from('streak_celebrations')
      .insert({
        user_id: userId,
        habit_id: habitId,
        streak_count: newStreak,
        message: message,
        celebrated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (celebrationError) {
      console.error('Error logging celebration:', celebrationError)
      // Continue anyway - don't fail the celebration
    }

    // Send notification based on channel preference
    const channel = agentSettings?.celebration_channel || 'sms'
    let notificationSent = false

    if (channel === 'sms' && commPrefs?.phone_number && TWILIO_ACCOUNT_SID) {
      // Send SMS celebration
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`

        const formData = new URLSearchParams()
        formData.append('To', commPrefs.phone_number)
        formData.append('From', TWILIO_PHONE_NUMBER!)
        formData.append('Body', message)

        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData
        })

        if (twilioResponse.ok) {
          notificationSent = true
          console.log(`Celebration SMS sent for ${newStreak}-day streak on "${habit.title}"`)
        } else {
          const errorData = await twilioResponse.json()
          console.error('Twilio SMS error:', errorData)
        }
      } catch (smsError) {
        console.error('Error sending celebration SMS:', smsError)
      }
    }

    // Update celebration record with notification status
    if (celebration?.id) {
      await supabase
        .from('streak_celebrations')
        .update({ notification_sent: notificationSent, notification_channel: channel })
        .eq('id', celebration.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        celebrated: true,
        milestone: newStreak,
        habitTitle: habit.title,
        message: message,
        notificationSent: notificationSent,
        channel: channel
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('Celebrate Streak Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Generate a celebration message based on the milestone
 */
function generateCelebrationMessage(firstName: string, habitTitle: string, streak: number): string {
  const messages: Record<number, string[]> = {
    7: [
      `${firstName}, 1 WEEK STRONG! You've completed "${habitTitle}" for 7 days straight. This is where real habits begin to form. Keep climbing!`,
      `ONE WEEK DOWN, ${firstName}! "${habitTitle}" for 7 days - you're building serious momentum. The ascension continues!`
    ],
    14: [
      `TWO WEEKS, ${firstName}! 14 days of "${habitTitle}" - you're proving this isn't just a phase. You're becoming who you want to be!`,
      `${firstName}, 14-DAY MILESTONE! "${habitTitle}" is becoming second nature. Your dedication is inspiring!`
    ],
    21: [
      `HABIT FORMED! ${firstName}, 21 days of "${habitTitle}" - science says this is when habits stick. You've done it! Keep going!`,
      `${firstName}, 21 DAYS! "${habitTitle}" is officially part of your identity now. This is transformation in action!`
    ],
    30: [
      `ONE MONTH, ${firstName}! 30 days of "${habitTitle}" - this is incredible discipline. You're not just building habits, you're building character!`,
      `${firstName}, 30-DAY CHAMPION! A full month of "${habitTitle}". Your future self is thanking you right now!`
    ],
    60: [
      `TWO MONTHS STRONG! ${firstName}, 60 days of "${habitTitle}" - you're in the top 5% of people who stick with their goals. LEGENDARY!`,
      `${firstName}, 60 DAYS! "${habitTitle}" for two months straight. This level of consistency changes lives!`
    ],
    90: [
      `QUARTER YEAR ACHIEVEMENT! ${firstName}, 90 days of "${habitTitle}" - this is elite-level dedication. You're unstoppable!`,
      `${firstName}, 90-DAY LEGEND! A full quarter of "${habitTitle}". Most people give up by week 2. Not you!`
    ],
    100: [
      `CENTURY CLUB! ${firstName}, 100 DAYS of "${habitTitle}"! Triple digits - you're in rare company now. Absolutely incredible!`,
      `${firstName}, 100 DAYS! "${habitTitle}" for a hundred days straight. This is mastery in progress!`
    ],
    180: [
      `HALF-YEAR HERO! ${firstName}, 180 days of "${habitTitle}" - six months of pure dedication. You've transformed your life!`,
      `${firstName}, 180 DAYS! Six months of "${habitTitle}". This isn't a habit anymore - it's who you ARE!`
    ],
    365: [
      `ONE YEAR! ${firstName}, 365 DAYS of "${habitTitle}"! A FULL YEAR! You've achieved what most only dream of. LEGENDARY STATUS!`,
      `${firstName}, 365-DAY MASTER! One year of "${habitTitle}". You didn't just change a habit - you changed your LIFE!`
    ]
  }

  const streakMessages = messages[streak]
  if (streakMessages && streakMessages.length > 0) {
    return streakMessages[Math.floor(Math.random() * streakMessages.length)]
  }

  // Fallback for any other milestones
  return `Amazing, ${firstName}! ${streak} days of "${habitTitle}"! Your consistency is truly inspiring. Keep up the incredible work!`
}
