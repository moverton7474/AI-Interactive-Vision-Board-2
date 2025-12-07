/**
 * MDALS Engine - Supabase Edge Function
 *
 * Music-Driven Adaptive Learning Systems
 *
 * Endpoints:
 * - POST /analyze-song: Analyze a song and extract themes/insights
 * - POST /generate-plan: Generate a multi-day learning plan from song insights
 *
 * IMPORTANT: This engine does NOT store or reproduce song lyrics.
 * All analysis is transformative and in our own words.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildSongAnalysisPrompt,
  buildPlanGenerationPrompt,
  buildSongFinderPrompt,
  parseAnalysisResponse,
  parsePlanResponse,
  parseSongFinderResponse,
  type SongAnalysisInput,
  type PlanGenerationInput,
  type SongFinderInput,
  type SongAnalysisResult,
  type LearningPlanResult,
  type SongFinderResult
} from './promptTemplates.ts'

declare const Deno: any;

// ============================================
// CORS & Response Helpers
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

function errorResponse(message: string, status = 400): Response {
  console.error(`MDALS Error: ${message}`)
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

// ============================================
// LLM Call Helper
// ============================================

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: prompt }] }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      })
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    console.error('Gemini API error:', errorData)
    throw new Error('AI service unavailable')
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Empty response from AI')
  }

  return text
}

// ============================================
// ANALYZE SONG ENDPOINT
// ============================================

interface AnalyzeSongRequest {
  song: {
    title: string;
    artist?: string;
    album?: string;
    source_type: 'spotify' | 'apple' | 'youtube' | 'manual' | 'other';
    source_id?: string;
    source_url?: string;
  };
  user_id?: string;
  domain_preferences?: string[];
  user_notes?: string;
  language?: string;
}

async function handleAnalyzeSong(
  req: Request,
  supabase: any,
  geminiApiKey: string
): Promise<Response> {
  const body: AnalyzeSongRequest = await req.json()

  // Validate input
  if (!body.song?.title) {
    return errorResponse('Missing required field: song.title')
  }
  if (!body.song?.source_type) {
    return errorResponse('Missing required field: song.source_type')
  }

  // Get user_id from auth or body
  const authHeader = req.headers.get('Authorization')
  let userId = body.user_id

  if (authHeader) {
    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (!error && user) {
      userId = user.id
    }
  }

  if (!userId) {
    return errorResponse('Missing required field: user_id', 401)
  }

  try {
    // 1. Upsert song record
    const songData = {
      user_id: userId,
      title: body.song.title,
      artist: body.song.artist || null,
      album: body.song.album || null,
      source_type: body.song.source_type,
      source_id: body.song.source_id || null,
      source_url: body.song.source_url || null,
      user_notes: body.user_notes || null,
      language: body.language || 'en'
    }

    // Check if song already exists for this user
    const { data: existingSong } = await supabase
      .from('mdals_songs')
      .select('id')
      .eq('user_id', userId)
      .eq('title', body.song.title)
      .eq('source_type', body.song.source_type)
      .maybeSingle()

    let songId: string

    if (existingSong) {
      // Update existing song
      const { data: updatedSong, error: updateError } = await supabase
        .from('mdals_songs')
        .update({
          artist: songData.artist,
          album: songData.album,
          source_id: songData.source_id,
          source_url: songData.source_url,
          user_notes: songData.user_notes
        })
        .eq('id', existingSong.id)
        .select('id')
        .single()

      if (updateError) throw updateError
      songId = updatedSong.id
    } else {
      // Insert new song
      const { data: newSong, error: insertError } = await supabase
        .from('mdals_songs')
        .insert(songData)
        .select('id')
        .single()

      if (insertError) throw insertError
      songId = newSong.id
    }

    // 2. Build and call LLM prompt
    const analysisInput: SongAnalysisInput = {
      title: body.song.title,
      artist: body.song.artist,
      userNotes: body.user_notes,
      domainPreferences: body.domain_preferences,
      language: body.language
    }

    const prompt = buildSongAnalysisPrompt(analysisInput)
    console.log(`Analyzing song: ${body.song.title} for user: ${userId}`)

    const llmResponse = await callGemini(prompt, geminiApiKey)

    // 3. Parse response
    const analysis: SongAnalysisResult = parseAnalysisResponse(llmResponse)

    // 4. Insert insight record
    const { data: insight, error: insightError } = await supabase
      .from('mdals_song_insights')
      .insert({
        song_id: songId,
        summary: analysis.summary,
        themes: analysis.themes,
        emotions: analysis.emotions,
        domain_tags: analysis.domain_tags,
        references: analysis.references,
        domain_preferences: body.domain_preferences || [],
        model_used: 'gemini-1.5-flash'
      })
      .select('id')
      .single()

    if (insightError) throw insightError

    // 5. Return response
    return jsonResponse({
      success: true,
      song_id: songId,
      insight_id: insight.id,
      summary: analysis.summary,
      themes: analysis.themes,
      emotions: analysis.emotions,
      domain_tags: analysis.domain_tags,
      references: analysis.references
    })

  } catch (error: any) {
    console.error('Analyze song error:', error)
    return errorResponse(error.message || 'Failed to analyze song', 500)
  }
}

// ============================================
// GENERATE PLAN ENDPOINT
// ============================================

interface GeneratePlanRequest {
  user_id?: string;
  song_id: string;
  goal_description: string;
  duration_days?: number;
  domain_preferences?: string[];
}

async function handleGeneratePlan(
  req: Request,
  supabase: any,
  geminiApiKey: string
): Promise<Response> {
  const body: GeneratePlanRequest = await req.json()

  // Validate input
  if (!body.song_id) {
    return errorResponse('Missing required field: song_id')
  }
  if (!body.goal_description) {
    return errorResponse('Missing required field: goal_description')
  }

  const durationDays = body.duration_days || 7
  if (durationDays < 1 || durationDays > 90) {
    return errorResponse('duration_days must be between 1 and 90')
  }

  // Get user_id from auth or body
  const authHeader = req.headers.get('Authorization')
  let userId = body.user_id

  if (authHeader) {
    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (!error && user) {
      userId = user.id
    }
  }

  if (!userId) {
    return errorResponse('Missing required field: user_id', 401)
  }

  try {
    // 1. Fetch song and verify ownership
    const { data: song, error: songError } = await supabase
      .from('mdals_songs')
      .select('*')
      .eq('id', body.song_id)
      .single()

    if (songError || !song) {
      return errorResponse('Song not found', 404)
    }

    if (song.user_id !== userId) {
      return errorResponse('Unauthorized access to song', 403)
    }

    // 2. Fetch latest insight for the song
    const { data: insight, error: insightError } = await supabase
      .from('mdals_song_insights')
      .select('*')
      .eq('song_id', body.song_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (insightError || !insight) {
      return errorResponse('No insight found for this song. Please analyze the song first.', 400)
    }

    // 3. Optionally fetch AMIE identity context
    let userIdentity = null
    const { data: profile } = await supabase
      .from('user_identity_profiles')
      .select(`
        core_values,
        coaching_focus_areas,
        theme:motivational_themes(name)
      `)
      .eq('user_id', userId)
      .maybeSingle()

    if (profile) {
      userIdentity = {
        themeName: profile.theme?.name,
        coreValues: profile.core_values,
        coachingFocusAreas: profile.coaching_focus_areas
      }
    }

    // 4. Build and call LLM prompt
    const planInput: PlanGenerationInput = {
      songTitle: song.title,
      songArtist: song.artist,
      songSummary: insight.summary,
      themes: insight.themes || [],
      emotions: insight.emotions || [],
      references: insight.references || [],
      goalDescription: body.goal_description,
      durationDays: durationDays,
      domainPreferences: body.domain_preferences,
      userIdentity
    }

    const prompt = buildPlanGenerationPrompt(planInput)
    console.log(`Generating ${durationDays}-day plan for song: ${song.title}`)

    const llmResponse = await callGemini(prompt, geminiApiKey)

    // 5. Parse response
    const plan: LearningPlanResult = parsePlanResponse(llmResponse)

    // 6. Insert learning plan record
    const { data: savedPlan, error: planError } = await supabase
      .from('mdals_learning_plans')
      .insert({
        user_id: userId,
        song_id: body.song_id,
        title: plan.title,
        goal_description: body.goal_description,
        duration_days: durationDays,
        domain_preferences: body.domain_preferences || [],
        plan_json: plan.days,
        status: 'active',
        current_day: 1,
        model_used: 'gemini-1.5-flash'
      })
      .select('id')
      .single()

    if (planError) throw planError

    // 7. Return response
    return jsonResponse({
      success: true,
      plan_id: savedPlan.id,
      title: plan.title,
      duration_days: durationDays,
      goal_description: body.goal_description,
      days: plan.days
    })

  } catch (error: any) {
    console.error('Generate plan error:', error)
    return errorResponse(error.message || 'Failed to generate plan', 500)
  }
}

// ============================================
// GET USER SONGS ENDPOINT
// ============================================

async function handleGetSongs(
  req: Request,
  supabase: any
): Promise<Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return errorResponse('Authorization required', 401)
  }

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )

  if (error || !user) {
    return errorResponse('Invalid authorization', 401)
  }

  try {
    const { data: songs, error: songsError } = await supabase
      .rpc('get_user_songs_with_insights', {
        p_user_id: user.id,
        p_limit: 50
      })

    if (songsError) throw songsError

    return jsonResponse({
      success: true,
      songs: songs || []
    })

  } catch (error: any) {
    console.error('Get songs error:', error)
    return errorResponse(error.message || 'Failed to fetch songs', 500)
  }
}

// ============================================
// GET USER PLANS ENDPOINT
// ============================================

async function handleGetPlans(
  req: Request,
  supabase: any
): Promise<Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return errorResponse('Authorization required', 401)
  }

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )

  if (error || !user) {
    return errorResponse('Invalid authorization', 401)
  }

  try {
    const { data: plans, error: plansError } = await supabase
      .from('mdals_learning_plans')
      .select(`
        id,
        title,
        goal_description,
        duration_days,
        current_day,
        status,
        plan_json,
        created_at,
        song:mdals_songs(id, title, artist)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (plansError) throw plansError

    return jsonResponse({
      success: true,
      plans: plans || []
    })

  } catch (error: any) {
    console.error('Get plans error:', error)
    return errorResponse(error.message || 'Failed to fetch plans', 500)
  }
}

// ============================================
// FIND SONG ENDPOINT (AI Song Finder)
// ============================================

interface FindSongRequest {
  description: string;
  genres?: string[];
  mood?: string;
  era?: string;
  language?: string;
}

async function handleFindSong(
  req: Request,
  geminiApiKey: string
): Promise<Response> {
  const body: FindSongRequest = await req.json()

  // Validate input
  if (!body.description?.trim()) {
    return errorResponse('Missing required field: description')
  }

  if (body.description.trim().length < 10) {
    return errorResponse('Description too short. Please provide more details about the song.')
  }

  try {
    // Build and call LLM prompt
    const finderInput: SongFinderInput = {
      description: body.description.trim(),
      genres: body.genres,
      mood: body.mood,
      era: body.era,
      language: body.language
    }

    const prompt = buildSongFinderPrompt(finderInput)
    console.log(`Finding song from description: "${body.description.substring(0, 50)}..."`)

    const llmResponse = await callGemini(prompt, geminiApiKey)

    // Parse response
    const result: SongFinderResult = parseSongFinderResponse(llmResponse)

    // Return response
    return jsonResponse({
      success: true,
      suggestions: result.suggestions,
      clarifying_questions: result.clarifying_questions
    })

  } catch (error: any) {
    console.error('Find song error:', error)
    return errorResponse(error.message || 'Failed to find song', 500)
  }
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  // Initialize environment
  // Support both GEMINI_API_KEY and GEMINI_API_KEY2 for flexibility
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY2')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!GEMINI_API_KEY) {
    return errorResponse('GEMINI_API_KEY or GEMINI_API_KEY2 not configured', 500)
  }

  const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_SERVICE_ROLE_KEY ?? '')

  // Route based on URL path
  const url = new URL(req.url)
  const path = url.pathname.split('/').pop() || ''

  try {
    switch (path) {
      case 'analyze-song':
        if (req.method !== 'POST') {
          return errorResponse('Method not allowed', 405)
        }
        return await handleAnalyzeSong(req, supabase, GEMINI_API_KEY)

      case 'generate-plan':
        if (req.method !== 'POST') {
          return errorResponse('Method not allowed', 405)
        }
        return await handleGeneratePlan(req, supabase, GEMINI_API_KEY)

      case 'songs':
        if (req.method !== 'GET') {
          return errorResponse('Method not allowed', 405)
        }
        return await handleGetSongs(req, supabase)

      case 'plans':
        if (req.method !== 'GET') {
          return errorResponse('Method not allowed', 405)
        }
        return await handleGetPlans(req, supabase)

      case 'find-song':
        if (req.method !== 'POST') {
          return errorResponse('Method not allowed', 405)
        }
        return await handleFindSong(req, GEMINI_API_KEY)

      default:
        // Default behavior for base path: show available endpoints
        return jsonResponse({
          service: 'MDALS Engine',
          version: '1.1',
          endpoints: [
            { method: 'POST', path: '/find-song', description: 'AI-powered song finder from fuzzy descriptions' },
            { method: 'POST', path: '/analyze-song', description: 'Analyze a song and extract themes' },
            { method: 'POST', path: '/generate-plan', description: 'Generate a learning plan from song insights' },
            { method: 'GET', path: '/songs', description: 'Get user songs with insights' },
            { method: 'GET', path: '/plans', description: 'Get user learning plans' }
          ]
        })
    }
  } catch (error: any) {
    console.error('MDALS Engine error:', error)
    return errorResponse(error.message || 'Internal server error', 500)
  }
})
