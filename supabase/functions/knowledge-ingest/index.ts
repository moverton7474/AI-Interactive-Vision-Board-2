import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Knowledge Ingest Service - Notebook-LM Style Knowledge Base
 *
 * Processes user documents and creates searchable knowledge chunks
 * for personalized AI coaching context.
 *
 * Actions:
 * - ingest: Process and store a new knowledge source
 * - list: Get all knowledge sources for a user
 * - get: Get a specific source with chunks
 * - delete: Remove a knowledge source and its chunks
 * - toggle: Enable/disable a source for AI context
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' }
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // All actions require authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid or expired authentication token')
    }

    const userId = user.id

    // Get action from query params
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'list'

    let body = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    // Route to appropriate handler
    switch (action) {
      case 'ingest':
        return await ingestSource(supabase, userId, body)
      case 'list':
        return await listSources(supabase, userId)
      case 'get':
        return await getSource(supabase, userId, url.searchParams)
      case 'delete':
        return await deleteSource(supabase, userId, body)
      case 'toggle':
        return await toggleSource(supabase, userId, body)
      case 'stats':
        return await getStats(supabase, userId)
      default:
        throw new Error(`Unknown action: ${action}. Valid actions: ingest, list, get, delete, toggle, stats`)
    }

  } catch (error: any) {
    console.error('Knowledge ingest error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Ingest a new knowledge source
 */
async function ingestSource(supabase: any, userId: string, body: any) {
  const {
    sourceType,
    sourceName,
    sourceUrl,
    content,
    fileType,
    fileSize
  } = body

  if (!sourceType || !sourceName) {
    throw new Error('sourceType and sourceName are required')
  }

  if (!content && !sourceUrl) {
    throw new Error('Either content or sourceUrl is required')
  }

  // Validate source type
  const validTypes = ['resume', 'document', 'url', 'manual_entry', 'conversation', 'vision_board', 'financial_doc', 'notes']
  if (!validTypes.includes(sourceType)) {
    throw new Error(`Invalid sourceType. Valid types: ${validTypes.join(', ')}`)
  }

  // Get raw content
  let rawContent = content || ''

  // If URL provided, fetch content
  if (sourceUrl && !content) {
    try {
      const response = await fetch(sourceUrl)
      if (response.ok) {
        rawContent = await response.text()
      }
    } catch (err) {
      console.error('Error fetching URL:', err)
      // Continue with empty content - will be processed later
    }
  }

  // Create the knowledge source record
  const { data: source, error: sourceError } = await supabase
    .from('user_knowledge_sources')
    .insert({
      user_id: userId,
      source_type: sourceType,
      source_name: sourceName,
      source_url: sourceUrl,
      raw_content: rawContent,
      file_type: fileType,
      file_size: fileSize,
      language: 'en',
      status: 'processing',
      is_active: true,
      include_in_context: true
    })
    .select()
    .single()

  if (sourceError) {
    throw new Error(`Failed to create source: ${sourceError.message}`)
  }

  // Process the content into chunks
  const chunks = splitIntoChunks(rawContent, sourceName)
  const wordCount = rawContent.split(/\s+/).filter(w => w.length > 0).length

  // Generate summary
  const summary = generateSummary(rawContent)

  // Insert chunks
  if (chunks.length > 0) {
    const chunkRecords = chunks.map((chunk, index) => ({
      user_id: userId,
      source_id: source.id,
      chunk_text: chunk.text,
      chunk_index: index,
      token_count: estimateTokens(chunk.text),
      metadata: { section: chunk.section }
    }))

    const { error: chunksError } = await supabase
      .from('user_knowledge_chunks')
      .insert(chunkRecords)

    if (chunksError) {
      console.error('Error inserting chunks:', chunksError)
    }
  }

  // Update source with processed info
  const { data: updatedSource, error: updateError } = await supabase
    .from('user_knowledge_sources')
    .update({
      processed_content: rawContent,
      content_summary: summary,
      word_count: wordCount,
      status: 'completed',
      processed_at: new Date().toISOString()
    })
    .eq('id', source.id)
    .select()
    .single()

  if (updateError) {
    console.error('Error updating source:', updateError)
  }

  console.log(`Ingested source for user ${userId}: ${sourceName} (${chunks.length} chunks)`)

  return new Response(
    JSON.stringify({
      success: true,
      source: updatedSource || source,
      chunksCreated: chunks.length,
      wordCount,
      message: `Successfully processed "${sourceName}" into ${chunks.length} knowledge chunks`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * List all knowledge sources for a user
 */
async function listSources(supabase: any, userId: string) {
  const { data: sources, error } = await supabase
    .from('user_knowledge_sources')
    .select(`
      id,
      source_type,
      source_name,
      source_url,
      content_summary,
      word_count,
      status,
      is_active,
      include_in_context,
      processed_at,
      created_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch sources: ${error.message}`)
  }

  // Get chunk counts for each source
  const sourceIds = sources?.map((s: any) => s.id) || []
  let chunkCounts: Record<string, number> = {}

  if (sourceIds.length > 0) {
    const { data: counts } = await supabase
      .from('user_knowledge_chunks')
      .select('source_id')
      .in('source_id', sourceIds)

    if (counts) {
      chunkCounts = counts.reduce((acc: Record<string, number>, chunk: any) => {
        acc[chunk.source_id] = (acc[chunk.source_id] || 0) + 1
        return acc
      }, {})
    }
  }

  const sourcesWithCounts = sources?.map((s: any) => ({
    ...s,
    chunk_count: chunkCounts[s.id] || 0
  }))

  return new Response(
    JSON.stringify({
      success: true,
      sources: sourcesWithCounts || [],
      count: sources?.length || 0
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get a specific source with its chunks
 */
async function getSource(supabase: any, userId: string, params: URLSearchParams) {
  const sourceId = params.get('sourceId')

  if (!sourceId) {
    throw new Error('sourceId is required')
  }

  const { data: source, error: sourceError } = await supabase
    .from('user_knowledge_sources')
    .select('*')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .single()

  if (sourceError || !source) {
    throw new Error('Source not found')
  }

  // Get chunks
  const { data: chunks } = await supabase
    .from('user_knowledge_chunks')
    .select('id, chunk_text, chunk_index, token_count, metadata')
    .eq('source_id', sourceId)
    .order('chunk_index', { ascending: true })

  return new Response(
    JSON.stringify({
      success: true,
      source: {
        ...source,
        chunks: chunks || []
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Delete a knowledge source and its chunks
 */
async function deleteSource(supabase: any, userId: string, body: any) {
  const { sourceId } = body

  if (!sourceId) {
    throw new Error('sourceId is required')
  }

  // Verify ownership
  const { data: source } = await supabase
    .from('user_knowledge_sources')
    .select('id')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .single()

  if (!source) {
    throw new Error('Source not found or access denied')
  }

  // Delete chunks first
  await supabase
    .from('user_knowledge_chunks')
    .delete()
    .eq('source_id', sourceId)

  // Delete source
  const { error } = await supabase
    .from('user_knowledge_sources')
    .delete()
    .eq('id', sourceId)

  if (error) {
    throw new Error(`Failed to delete source: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Source and all chunks deleted successfully'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Toggle source inclusion in AI context
 */
async function toggleSource(supabase: any, userId: string, body: any) {
  const { sourceId, includeInContext, isActive } = body

  if (!sourceId) {
    throw new Error('sourceId is required')
  }

  const updates: any = {}
  if (typeof includeInContext === 'boolean') {
    updates.include_in_context = includeInContext
  }
  if (typeof isActive === 'boolean') {
    updates.is_active = isActive
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('At least one of includeInContext or isActive is required')
  }

  const { data: source, error } = await supabase
    .from('user_knowledge_sources')
    .update(updates)
    .eq('id', sourceId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update source: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      source,
      message: 'Source updated successfully'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get knowledge base statistics
 */
async function getStats(supabase: any, userId: string) {
  // Get source counts by type
  const { data: sources } = await supabase
    .from('user_knowledge_sources')
    .select('source_type, word_count, is_active, include_in_context')
    .eq('user_id', userId)

  // Get total chunks
  const { count: totalChunks } = await supabase
    .from('user_knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const stats = {
    totalSources: sources?.length || 0,
    activeSources: sources?.filter((s: any) => s.is_active).length || 0,
    includedSources: sources?.filter((s: any) => s.include_in_context).length || 0,
    totalWords: sources?.reduce((acc: number, s: any) => acc + (s.word_count || 0), 0) || 0,
    totalChunks: totalChunks || 0,
    sourcesByType: sources?.reduce((acc: Record<string, number>, s: any) => {
      acc[s.source_type] = (acc[s.source_type] || 0) + 1
      return acc
    }, {}) || {}
  }

  return new Response(
    JSON.stringify({
      success: true,
      stats
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Split content into chunks for processing
 */
function splitIntoChunks(content: string, sourceName: string): Array<{ text: string; section: string }> {
  if (!content || content.trim().length === 0) {
    return []
  }

  const chunks: Array<{ text: string; section: string }> = []
  const maxChunkSize = 1000 // Characters per chunk
  const overlap = 100 // Character overlap between chunks

  // Try to split by sections first (headers, double newlines)
  const sections = content.split(/\n\n+|\n(?=#{1,3}\s)|(?=\*\*[^*]+\*\*\n)/)

  let currentChunk = ''
  let currentSection = 'main'
  let sectionIndex = 0

  for (const section of sections) {
    const trimmedSection = section.trim()
    if (!trimmedSection) continue

    // Check for section header
    const headerMatch = trimmedSection.match(/^(#{1,3})\s+(.+)$|^\*\*(.+)\*\*$/m)
    if (headerMatch) {
      currentSection = headerMatch[2] || headerMatch[3] || `section_${sectionIndex++}`
    }

    // If adding this section would exceed max size, save current chunk
    if (currentChunk.length + trimmedSection.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        section: currentSection
      })
      // Start new chunk with overlap
      currentChunk = currentChunk.slice(-overlap) + '\n\n'
    }

    currentChunk += trimmedSection + '\n\n'
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      section: currentSection
    })
  }

  // If no chunks created (content too small), create one chunk
  if (chunks.length === 0 && content.trim().length > 0) {
    chunks.push({
      text: content.trim(),
      section: 'main'
    })
  }

  return chunks
}

/**
 * Generate a brief summary of the content
 */
function generateSummary(content: string): string {
  if (!content) return ''

  // Take first few sentences
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10)
  const summary = sentences.slice(0, 3).join('. ').trim()

  if (summary.length > 300) {
    return summary.substring(0, 297) + '...'
  }

  return summary + (summary.endsWith('.') ? '' : '.')
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4)
}
