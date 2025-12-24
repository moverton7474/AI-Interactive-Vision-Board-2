import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Onboarding Themes Service - AMIE Identity Engine
 *
 * Actions:
 * - list: Get all active motivational themes
 * - get: Get a specific theme with questions
 * - select: Select a theme for the user (creates/updates identity profile)
 * - get_profile: Get user's current identity profile
 * - get_questions: Get master prompt questions for a theme
 * - submit_answers: Submit answers to master prompt questions
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Get action from query params (legacy) or body (new approach)
    const url = new URL(req.url)
    let action = url.searchParams.get('action')

    // Parse body for POST requests to get action and other data
    let body: any = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
        // Support action in body (preferred) or query params (legacy)
        if (!action && body.action) {
          action = body.action
        }
      } catch {
        body = {}
      }
    }

    // Some actions don't require auth (listing themes)
    const publicActions = ['list', 'get', 'generate_greeting']

    let supabase: any
    let userId: string | null = null

    const authHeader = req.headers.get('Authorization')

    if (publicActions.includes(action || '')) {
      // Public endpoint - use service role
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    } else {
      // Protected endpoint - require auth
      if (!authHeader) {
        throw new Error('Missing authorization header')
      }

      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: authHeader } }
      })

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )

      if (authError || !user) {
        throw new Error('Invalid or expired authentication token')
      }

      userId = user.id
    }

    // Route to appropriate handler
    switch (action) {
      case 'list':
        return await listThemes(supabase)
      case 'get':
        return await getTheme(supabase, url.searchParams, body)
      case 'select':
        return await selectTheme(supabase, userId!, body)
      case 'get_profile':
        return await getIdentityProfile(supabase, userId!)
      case 'get_questions':
        return await getQuestions(supabase, url.searchParams, body)
      case 'submit_answers':
        return await submitAnswers(supabase, userId!, body)
      case 'update_profile':
        return await updateProfile(supabase, userId!, body)
      case 'generate_greeting':
        return await generateGreeting(supabase, body)
      default:
        throw new Error(`Unknown action: ${action}. Valid actions: list, get, select, get_profile, get_questions, submit_answers, update_profile, generate_greeting`)
    }

  } catch (error: any) {
    console.error('Onboarding themes error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * List all active motivational themes
 */
async function listThemes(supabase: any) {
  const { data: themes, error } = await supabase
    .from('motivational_themes')
    .select(`
      id,
      name,
      display_name,
      description,
      icon,
      color_scheme,
      motivation_style,
      include_scripture,
      include_metrics,
      include_wellness,
      include_legacy,
      sort_order
    `)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch themes: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      themes,
      count: themes.length
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get a specific theme with its system prompt and questions
 * Supports themeId/themeName from query params (legacy) or body (new approach)
 */
async function getTheme(supabase: any, params: URLSearchParams, body: any = {}) {
  // Support both query params (legacy) and body (new approach)
  const themeId = params.get('themeId') || body.themeId
  const themeName = params.get('themeName') || body.themeName

  if (!themeId && !themeName) {
    throw new Error('Either themeId or themeName is required')
  }

  let query = supabase
    .from('motivational_themes')
    .select('*')
    .eq('is_active', true)

  if (themeId) {
    query = query.eq('id', themeId)
  } else {
    query = query.eq('name', themeName)
  }

  const { data: theme, error } = await query.single()

  if (error || !theme) {
    throw new Error('Theme not found')
  }

  // Get questions for this theme
  const { data: questions } = await supabase
    .from('master_prompt_questions')
    .select('*')
    .eq('theme_id', theme.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return new Response(
    JSON.stringify({
      success: true,
      theme: {
        ...theme,
        questions: questions || []
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Select a theme for the user (creates or updates identity profile)
 */
async function selectTheme(supabase: any, userId: string, body: any) {
  const { themeId, themeName } = body

  if (!themeId && !themeName) {
    throw new Error('Either themeId or themeName is required')
  }

  // Get theme
  let themeQuery = supabase
    .from('motivational_themes')
    .select('id, name, display_name')
    .eq('is_active', true)

  if (themeId) {
    themeQuery = themeQuery.eq('id', themeId)
  } else {
    themeQuery = themeQuery.eq('name', themeName)
  }

  const { data: theme, error: themeError } = await themeQuery.single()

  if (themeError || !theme) {
    throw new Error('Theme not found')
  }

  // Check if user already has an identity profile
  const { data: existingProfile } = await supabase
    .from('user_identity_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (existingProfile) {
    // Update existing profile
    const { data: profile, error: updateError } = await supabase
      .from('user_identity_profiles')
      .update({
        theme_id: theme.id,
        onboarding_step: 1, // Theme selected
        last_identity_update: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`)
    }

    console.log('Theme updated for user:', userId, 'Theme:', theme.name)

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        theme,
        message: 'Theme updated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } else {
    // Create new profile
    const { data: profile, error: createError } = await supabase
      .from('user_identity_profiles')
      .insert({
        user_id: userId,
        theme_id: theme.id,
        onboarding_step: 1,
        onboarding_completed: false,
        theme_customizations: {},
        master_prompt_responses: [],
        core_values: [],
        life_roles: [],
        motivation_drivers: [],
        coaching_focus_areas: []
      })
      .select()
      .single()

    if (createError) {
      throw new Error(`Failed to create profile: ${createError.message}`)
    }

    console.log('Profile created for user:', userId, 'Theme:', theme.name)

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        theme,
        message: 'Profile created with theme'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Get user's current identity profile with theme
 */
async function getIdentityProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from('user_identity_profiles')
    .select(`
      *,
      theme:motivational_themes(
        id,
        name,
        display_name,
        description,
        icon,
        color_scheme,
        motivation_style,
        system_prompt_template,
        include_scripture,
        include_metrics,
        include_wellness,
        include_legacy
      )
    `)
    .eq('user_id', userId)
    .single()

  if (error) {
    // No profile yet - return null (not an error)
    if (error.code === 'PGRST116') {
      return new Response(
        JSON.stringify({
          success: true,
          profile: null,
          message: 'No identity profile found. User needs to select a theme.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    throw new Error(`Failed to fetch profile: ${error.message}`)
  }

  // Get questions for next step if not completed
  let nextQuestions: any[] = []
  if (!profile.onboarding_completed && profile.theme_id) {
    const { data: questions } = await supabase
      .from('master_prompt_questions')
      .select('*')
      .eq('theme_id', profile.theme_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    // Filter to unanswered questions
    const answeredIds = profile.master_prompt_responses?.map((r: any) => r.question_id) || []
    nextQuestions = (questions || []).filter((q: any) => !answeredIds.includes(q.id))
  }

  return new Response(
    JSON.stringify({
      success: true,
      profile,
      nextQuestions,
      onboardingProgress: {
        step: profile.onboarding_step,
        completed: profile.onboarding_completed,
        totalQuestions: nextQuestions.length + (profile.master_prompt_responses?.length || 0),
        answeredQuestions: profile.master_prompt_responses?.length || 0
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get master prompt questions for a theme
 * Supports themeId/themeName from query params (legacy) or body (new approach)
 */
async function getQuestions(supabase: any, params: URLSearchParams, body: any = {}) {
  // Support both query params (legacy) and body (new approach)
  const themeId = params.get('themeId') || body.themeId
  const themeName = params.get('themeName') || body.themeName

  if (!themeId && !themeName) {
    throw new Error('Either themeId or themeName is required')
  }

  // Get theme first
  let themeQuery = supabase
    .from('motivational_themes')
    .select('id, name')

  if (themeId) {
    themeQuery = themeQuery.eq('id', themeId)
  } else {
    themeQuery = themeQuery.eq('name', themeName)
  }

  const { data: theme, error: themeError } = await themeQuery.single()

  if (themeError || !theme) {
    throw new Error('Theme not found')
  }

  // Get questions
  const { data: questions, error } = await supabase
    .from('master_prompt_questions')
    .select('*')
    .eq('theme_id', theme.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch questions: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      themeId: theme.id,
      themeName: theme.name,
      questions: questions || [],
      count: questions?.length || 0
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Submit answers to master prompt questions
 */
async function submitAnswers(supabase: any, userId: string, body: any) {
  const { responses } = body

  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    throw new Error('Responses array is required')
  }

  // Get user's profile
  const { data: profile, error: profileError } = await supabase
    .from('user_identity_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (profileError || !profile) {
    throw new Error('User must select a theme before answering questions')
  }

  // Validate responses format
  const validResponses = responses.map((r: any) => {
    if (!r.question_id || r.answer === undefined) {
      throw new Error('Each response must have question_id and answer')
    }
    return {
      question_id: r.question_id,
      question_text: r.question_text || '',
      answer: r.answer
    }
  })

  // Merge with existing responses (update existing, add new)
  const existingResponses = profile.master_prompt_responses || []
  const existingIds = existingResponses.map((r: any) => r.question_id)

  const mergedResponses = [...existingResponses]
  for (const newResponse of validResponses) {
    const existingIndex = mergedResponses.findIndex(
      (r: any) => r.question_id === newResponse.question_id
    )
    if (existingIndex >= 0) {
      mergedResponses[existingIndex] = newResponse
    } else {
      mergedResponses.push(newResponse)
    }
  }

  // Get total questions for this theme
  const { data: allQuestions } = await supabase
    .from('master_prompt_questions')
    .select('id')
    .eq('theme_id', profile.theme_id)
    .eq('is_active', true)
    .eq('is_required', true)

  const totalRequired = allQuestions?.length || 0
  const answeredRequired = mergedResponses.filter((r: any) =>
    allQuestions?.some((q: any) => q.id === r.question_id)
  ).length

  const allRequiredAnswered = answeredRequired >= totalRequired

  // Generate identity summary if all required questions answered
  let identitySummary = profile.identity_summary
  let coachingFocusAreas = profile.coaching_focus_areas

  if (allRequiredAnswered && mergedResponses.length > 0) {
    // Build identity summary from responses
    identitySummary = buildIdentitySummary(mergedResponses)
    coachingFocusAreas = extractFocusAreas(mergedResponses)
  }

  // Update profile
  const { data: updatedProfile, error: updateError } = await supabase
    .from('user_identity_profiles')
    .update({
      master_prompt_responses: mergedResponses,
      identity_summary: identitySummary,
      coaching_focus_areas: coachingFocusAreas,
      onboarding_step: allRequiredAnswered ? 2 : 1,
      onboarding_completed: allRequiredAnswered,
      last_identity_update: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`Failed to save responses: ${updateError.message}`)
  }

  console.log('Answers submitted for user:', userId, 'Count:', validResponses.length)

  return new Response(
    JSON.stringify({
      success: true,
      profile: updatedProfile,
      progress: {
        totalRequired,
        answeredRequired,
        allRequiredAnswered,
        onboardingCompleted: allRequiredAnswered
      },
      message: allRequiredAnswered
        ? 'Onboarding complete! Your AI coach is now personalized.'
        : `Saved ${validResponses.length} responses. ${totalRequired - answeredRequired} required questions remaining.`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Update identity profile fields
 */
async function updateProfile(supabase: any, userId: string, body: any) {
  const {
    coreValues,
    lifeRoles,
    communicationStyle,
    motivationDrivers,
    formalityLevel,
    encouragementFrequency,
    masterPrompt,
    themeCustomizations
  } = body

  const updates: any = {
    last_identity_update: new Date().toISOString()
  }

  if (coreValues !== undefined) updates.core_values = coreValues
  if (lifeRoles !== undefined) updates.life_roles = lifeRoles
  if (communicationStyle !== undefined) updates.communication_style = communicationStyle
  if (motivationDrivers !== undefined) updates.motivation_drivers = motivationDrivers
  if (formalityLevel !== undefined) updates.formality_level = formalityLevel
  if (encouragementFrequency !== undefined) updates.encouragement_frequency = encouragementFrequency
  if (masterPrompt !== undefined) updates.master_prompt = masterPrompt
  if (themeCustomizations !== undefined) updates.theme_customizations = themeCustomizations

  const { data: profile, error } = await supabase
    .from('user_identity_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      profile,
      message: 'Profile updated successfully'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Helper: Build identity summary from responses
 */
function buildIdentitySummary(responses: any[]): string {
  const parts: string[] = []

  for (const response of responses) {
    if (response.answer && response.question_text) {
      const answer = Array.isArray(response.answer)
        ? response.answer.join(', ')
        : response.answer
      parts.push(`${response.question_text}: ${answer}`)
    }
  }

  return parts.join('\n')
}

/**
 * Helper: Extract focus areas from responses
 */
function extractFocusAreas(responses: any[]): string[] {
  const focusAreas: string[] = []

  for (const response of responses) {
    // Look for motivation/focus related questions
    const questionLower = (response.question_text || '').toLowerCase()
    if (
      questionLower.includes('motivation') ||
      questionLower.includes('focus') ||
      questionLower.includes('goal') ||
      questionLower.includes('obstacle')
    ) {
      const answer = Array.isArray(response.answer) ? response.answer : [response.answer]
      focusAreas.push(...answer.filter((a: string) => a && a.length > 0))
    }
  }

  return [...new Set(focusAreas)] // Remove duplicates
}

/**
 * Generate a dynamic greeting based on theme and motivation style
 */
async function generateGreeting(supabase: any, body: any) {
  const { theme_id, theme_name, motivation_style } = body

  // Get time of day
  const hour = new Date().getHours()
  let timeOfDay = 'day'
  if (hour < 12) timeOfDay = 'morning'
  else if (hour < 17) timeOfDay = 'afternoon'
  else timeOfDay = 'evening'

  // Generate greeting based on motivation style
  let greeting = ''
  let message = ''

  switch (motivation_style) {
    case 'spiritual':
      greeting = timeOfDay === 'morning'
        ? 'Blessings this morning'
        : timeOfDay === 'afternoon'
          ? 'Walk in purpose'
          : 'Peace this evening'
      message = 'May your vision be guided by faith and purpose. Let\'s take the next step on your journey together.'
      break

    case 'challenging':
      greeting = timeOfDay === 'morning'
        ? 'Time to execute'
        : 'Let\'s get to work'
      message = 'Champions are built through consistent action. Your vision demands effort - let\'s make it happen.'
      break

    case 'analytical':
      greeting = 'Status update'
      message = 'Your personalized coaching system is configured. Let\'s review your objectives and optimize your path forward.'
      break

    case 'encouraging':
    default:
      greeting = timeOfDay === 'morning'
        ? 'Good morning'
        : timeOfDay === 'afternoon'
          ? 'Good afternoon'
          : 'Good evening'
      message = 'I\'m here to support you every step of the way. Together, we\'ll turn your vision into reality.'
      break
  }

  // Add theme-specific flavor
  let themeMessage = ''
  const themeLower = (theme_name || theme_id || '').toLowerCase()

  if (themeLower.includes('christian') || themeLower.includes('faith')) {
    themeMessage = 'Your faith-centered journey begins now.'
  } else if (themeLower.includes('executive') || themeLower.includes('business')) {
    themeMessage = 'Let\'s build your leadership legacy.'
  } else if (themeLower.includes('fitness') || themeLower.includes('health')) {
    themeMessage = 'Your transformation starts today.'
  } else if (themeLower.includes('retirement') || themeLower.includes('legacy')) {
    themeMessage = 'Your wisdom will guide this journey.'
  }

  return new Response(
    JSON.stringify({
      success: true,
      greeting,
      message: themeMessage || message,
      timeOfDay,
      motivationStyle: motivation_style || 'encouraging'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
