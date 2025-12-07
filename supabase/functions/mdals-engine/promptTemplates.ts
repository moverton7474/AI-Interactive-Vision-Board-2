/**
 * MDALS Engine - LLM Prompt Templates
 *
 * These templates power the song analysis and learning plan generation.
 * IMPORTANT: All prompts explicitly instruct the model NOT to quote lyrics.
 */

// ============================================
// SONG ANALYSIS PROMPT
// ============================================

export interface SongAnalysisInput {
  title: string;
  artist?: string;
  userNotes?: string;
  domainPreferences?: string[];
  language?: string;
}

export function buildSongAnalysisPrompt(input: SongAnalysisInput): string {
  const { title, artist, userNotes, domainPreferences = [], language = 'en' } = input;

  const domainInstructions = buildDomainInstructions(domainPreferences);

  return `You are an expert in music analysis, theology, leadership development, emotional psychology, and personal growth.
Your role is to help derive meaningful, growth-oriented learning insights from songs.

## Task
Analyze the song "${title}"${artist ? ` by ${artist}` : ''} and extract its core themes, emotional journey, and growth-oriented insights.

${userNotes ? `## User's Personal Connection\nThe user shared: "${userNotes}"\nConsider this personal context when analyzing the song's meaning and relevance.` : ''}

## Analysis Instructions

1. **Infer the Song's Core Message**
   - Based on your knowledge of this song, describe its main story or message in your own words.
   - Focus on the emotional journey and life lessons it conveys.

2. **Identify Core Life Themes**
   Examples: resilience, forgiveness, surrender, healing, hope, perseverance, transformation, love, faith, courage, redemption, gratitude

3. **Map the Emotional Arc**
   Examples: hurt → healing, fear → courage, despair → hope, loss → acceptance, struggle → triumph

4. **Assign Domain Tags**
   Choose relevant domains: spiritual, leadership, business, healing, personal-growth, relationships, mental-health

${domainInstructions}

## CRITICAL RULES
- **DO NOT quote, reproduce, or reference specific lyrics from the song.**
- You may mention the song title and describe its general message.
- All analysis must be in your own original words.
- Focus on transformative insights, not song description.

## Output Format
Return ONLY valid JSON in this exact structure:

\`\`\`json
{
  "summary": "A 2-3 sentence description of the song's core message and emotional journey, in your own words",
  "themes": ["theme1", "theme2", "theme3"],
  "emotions": ["emotion1", "emotion2", "emotion3"],
  "domain_tags": ["domain1", "domain2"],
  "references": [
    {
      "type": "scripture|leadership|psychology|book|principle",
      "value": "Specific reference (e.g., 'James 1:2-4' or 'Servant Leadership')",
      "reason": "One sentence explaining how this connects to the song's message"
    }
  ]
}
\`\`\`

Provide 3-5 themes, 2-4 emotions, 1-3 domain tags, and 2-5 references relevant to the user's domain preferences.
${language !== 'en' ? `\nRespond in ${language}.` : ''}`;
}

// ============================================
// LEARNING PLAN GENERATION PROMPT
// ============================================

export interface PlanGenerationInput {
  songTitle: string;
  songArtist?: string;
  songSummary: string;
  themes: string[];
  emotions: string[];
  references: Array<{ type: string; value: string; reason: string }>;
  goalDescription: string;
  durationDays: number;
  domainPreferences?: string[];
  userIdentity?: {
    themeName?: string;
    coreValues?: string[];
    coachingFocusAreas?: string[];
  };
}

export function buildPlanGenerationPrompt(input: PlanGenerationInput): string {
  const {
    songTitle,
    songArtist,
    songSummary,
    themes,
    emotions,
    references,
    goalDescription,
    durationDays,
    domainPreferences = [],
    userIdentity
  } = input;

  const identityContext = userIdentity ? buildIdentityContext(userIdentity) : '';
  const domainInstructions = buildPlanDomainInstructions(domainPreferences, references);

  return `You are an expert learning journey designer specializing in personal transformation, spiritual growth, and leadership development.
Your role is to create meaningful, structured learning plans that connect music to personal growth.

## Context: The Song
**Title:** "${songTitle}"${songArtist ? ` by ${songArtist}` : ''}
**Core Message:** ${songSummary}
**Themes:** ${themes.join(', ')}
**Emotional Journey:** ${emotions.join(' → ')}

## Available References
${references.map(r => `- [${r.type}] ${r.value}: ${r.reason}`).join('\n')}

## User's Goal
"${goalDescription}"

${identityContext}

## Plan Requirements
- **Duration:** ${durationDays} days
- **Structure:** Each day should build on the previous, creating a coherent journey

${domainInstructions}

## Day Structure
Each day must include:
1. **Focus:** The main theme or lesson for the day (1 sentence)
2. **References:** Relevant scriptures, books, or principles to engage with
3. **Activities:** 2-3 specific, actionable tasks
4. **Reflection:** A thought-provoking question for journaling
5. **Prayer or Action:** A closing prayer prompt OR concrete action step

## CRITICAL RULES
- **DO NOT reference or quote specific lyrics from the song.**
- You may reference "this song" or the title generically.
- Make the plan practical, encouraging, and emotionally intelligent.
- Connect each day's content to the song's themes naturally.
- Progress from foundation (understanding/acknowledging) to application (action/transformation).

## Output Format
Return ONLY valid JSON in this exact structure:

\`\`\`json
{
  "title": "A compelling title for this learning journey",
  "days": [
    {
      "day": 1,
      "focus": "The main focus or theme for this day",
      "references": ["Reference 1", "Reference 2"],
      "activities": [
        "First activity with clear instructions",
        "Second activity",
        "Third activity (optional)"
      ],
      "reflection": "A meaningful question for personal reflection",
      "prayer_or_action": "A prayer prompt or specific action to take"
    }
  ]
}
\`\`\`

Generate exactly ${durationDays} days. Make each day meaningful and connected to the overall journey.`;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildDomainInstructions(domains: string[]): string {
  const instructions: string[] = [];

  if (domains.includes('spiritual') || domains.includes('christian')) {
    instructions.push(`
5. **Spiritual/Christian References**
   - Identify Bible verses that connect to the song's message
   - For each scripture, explain how it relates in one sentence
   - Consider: Psalms (emotional expression), Proverbs (wisdom), Epistles (practical guidance), Gospels (transformation)`);
  }

  if (domains.includes('leadership') || domains.includes('business')) {
    instructions.push(`
5. **Leadership/Business Principles**
   - Connect to leadership frameworks (servant leadership, emotional intelligence, etc.)
   - Reference relevant business authors or principles
   - Focus on practical application in professional contexts`);
  }

  if (domains.includes('personal-growth') || domains.includes('healing')) {
    instructions.push(`
5. **Personal Growth & Healing**
   - Connect to psychological principles and growth frameworks
   - Reference therapeutic concepts where appropriate
   - Focus on emotional healing and self-development`);
  }

  if (instructions.length === 0) {
    instructions.push(`
5. **General Growth References**
   - Include a mix of inspirational and practical references
   - Consider wisdom literature, self-help principles, and timeless truths`);
  }

  return instructions.join('\n');
}

function buildPlanDomainInstructions(domains: string[], references: Array<{ type: string; value: string; reason: string }>): string {
  const instructions: string[] = ['## Domain Focus'];

  if (domains.includes('spiritual') || domains.includes('christian')) {
    const scriptureRefs = references.filter(r => r.type === 'scripture');
    instructions.push(`
**Spiritual Journey Focus:**
- Each day should include at least one scripture reference
- Include prayer prompts that connect to the day's theme
- Use faith-based language: "surrender," "trust," "stewardship," "calling"
${scriptureRefs.length > 0 ? `- Prioritize these scriptures: ${scriptureRefs.map(r => r.value).join(', ')}` : ''}`);
  }

  if (domains.includes('leadership') || domains.includes('business')) {
    const leadershipRefs = references.filter(r => r.type === 'leadership' || r.type === 'principle');
    instructions.push(`
**Leadership Development Focus:**
- Connect each day to practical leadership application
- Include reflection on professional scenarios
- Use business language: "strategic," "ROI," "influence," "execution"
${leadershipRefs.length > 0 ? `- Incorporate these principles: ${leadershipRefs.map(r => r.value).join(', ')}` : ''}`);
  }

  if (domains.includes('personal-growth') || domains.includes('healing')) {
    const growthRefs = references.filter(r => r.type === 'psychology' || r.type === 'book');
    instructions.push(`
**Personal Growth Focus:**
- Emphasize self-reflection and emotional awareness
- Include journaling and mindfulness activities
- Use growth language: "process," "journey," "breakthrough," "integration"
${growthRefs.length > 0 ? `- Draw from: ${growthRefs.map(r => r.value).join(', ')}` : ''}`);
  }

  if (instructions.length === 1) {
    instructions.push(`
**Balanced Growth Focus:**
- Mix spiritual, practical, and emotional elements
- Include varied activities: reading, reflection, action
- Make each day accessible and engaging`);
  }

  return instructions.join('\n');
}

function buildIdentityContext(identity: {
  themeName?: string;
  coreValues?: string[];
  coachingFocusAreas?: string[];
}): string {
  const parts: string[] = ['## User Identity Context'];

  if (identity.themeName) {
    parts.push(`**Coaching Theme:** ${identity.themeName}`);
  }

  if (identity.coreValues && identity.coreValues.length > 0) {
    parts.push(`**Core Values:** ${identity.coreValues.join(', ')}`);
  }

  if (identity.coachingFocusAreas && identity.coachingFocusAreas.length > 0) {
    parts.push(`**Focus Areas:** ${identity.coachingFocusAreas.join(', ')}`);
  }

  if (parts.length === 1) return '';

  parts.push('\nTailor the plan to resonate with these values and focus areas.');
  return parts.join('\n');
}

// ============================================
// JSON PARSING UTILITIES
// ============================================

export interface SongAnalysisResult {
  summary: string;
  themes: string[];
  emotions: string[];
  domain_tags: string[];
  references: Array<{
    type: string;
    value: string;
    reason: string;
  }>;
}

export interface LearningPlanResult {
  title: string;
  days: Array<{
    day: number;
    focus: string;
    references: string[];
    activities: string[];
    reflection: string;
    prayer_or_action: string;
  }>;
}

export function parseAnalysisResponse(text: string): SongAnalysisResult {
  // Try to extract JSON from markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr.trim());

    // Validate required fields
    if (!parsed.summary || typeof parsed.summary !== 'string') {
      throw new Error('Missing or invalid summary');
    }
    if (!Array.isArray(parsed.themes)) {
      parsed.themes = [];
    }
    if (!Array.isArray(parsed.emotions)) {
      parsed.emotions = [];
    }
    if (!Array.isArray(parsed.domain_tags)) {
      parsed.domain_tags = [];
    }
    if (!Array.isArray(parsed.references)) {
      parsed.references = [];
    }

    return parsed as SongAnalysisResult;
  } catch (error) {
    console.error('Failed to parse analysis response:', error);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}

// ============================================
// SONG FINDER PROMPT
// ============================================

export interface SongFinderInput {
  description: string;
  genres?: string[];
  mood?: string;
  era?: string;
  language?: string;
}

export function buildSongFinderPrompt(input: SongFinderInput): string {
  const { description, genres = [], mood, era, language = 'en' } = input;

  return `You are a music expert with encyclopedic knowledge of songs across all genres, eras, and cultures.
Your role is to help users identify songs based on partial or fuzzy descriptions.

## Task
A user is trying to find a song but doesn't know the exact title or artist. Help them identify it based on their description.

## User's Description
"${description}"

${genres.length > 0 ? `**Preferred Genres:** ${genres.join(', ')}` : ''}
${mood ? `**Mood/Feel:** ${mood}` : ''}
${era ? `**Era/Time Period:** ${era}` : ''}

## Instructions
1. Based on the description, identify the most likely songs the user is thinking of
2. Consider:
   - Lyrical content they might be describing
   - Themes or messages mentioned
   - Artist clues (voice type, band vs solo, etc.)
   - Musical style hints
   - Any specific phrases or words they remember
3. Provide your top 3-5 most likely matches
4. For each match, explain WHY you think it might be the song they're looking for

## CRITICAL RULES
- **DO NOT quote or reproduce any lyrics** - describe them generally instead
- Provide enough context for the user to verify if it's the right song
- If the description is too vague, still provide your best guesses but note the uncertainty
- Include both well-known and lesser-known possibilities

## Output Format
Return ONLY valid JSON in this exact structure:

\`\`\`json
{
  "suggestions": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name (if known)",
      "year": "Release Year (if known)",
      "confidence": "high|medium|low",
      "reason": "1-2 sentences explaining why this might be the song they're looking for",
      "genre": "Primary genre",
      "search_tip": "Suggestion for how to verify (e.g., 'Search for [title] + [keyword]')"
    }
  ],
  "clarifying_questions": [
    "Optional: Questions that might help narrow down if none of these match"
  ]
}
\`\`\`

Provide 3-5 suggestions ranked by likelihood. If you're very confident about one, put it first with "high" confidence.
${language !== 'en' ? `\nRespond in ${language}.` : ''}`;
}

export interface SongFinderResult {
  suggestions: Array<{
    title: string;
    artist: string;
    album?: string;
    year?: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    genre?: string;
    search_tip?: string;
  }>;
  clarifying_questions?: string[];
}

export function parseSongFinderResponse(text: string): SongFinderResult {
  // Try to extract JSON from markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr.trim());

    // Validate required fields
    if (!Array.isArray(parsed.suggestions)) {
      parsed.suggestions = [];
    }

    // Validate each suggestion
    for (const suggestion of parsed.suggestions) {
      if (!suggestion.title) suggestion.title = 'Unknown';
      if (!suggestion.artist) suggestion.artist = 'Unknown Artist';
      if (!suggestion.confidence) suggestion.confidence = 'medium';
      if (!suggestion.reason) suggestion.reason = '';
    }

    if (!Array.isArray(parsed.clarifying_questions)) {
      parsed.clarifying_questions = [];
    }

    return parsed as SongFinderResult;
  } catch (error) {
    console.error('Failed to parse song finder response:', error);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}

// ============================================
// JSON PARSING UTILITIES
// ============================================

export function parsePlanResponse(text: string): LearningPlanResult {
  // Try to extract JSON from markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr.trim());

    // Validate required fields
    if (!parsed.title || typeof parsed.title !== 'string') {
      throw new Error('Missing or invalid title');
    }
    if (!Array.isArray(parsed.days) || parsed.days.length === 0) {
      throw new Error('Missing or invalid days array');
    }

    // Validate each day
    for (const day of parsed.days) {
      if (typeof day.day !== 'number') {
        throw new Error('Invalid day number');
      }
      if (!day.focus) day.focus = '';
      if (!Array.isArray(day.references)) day.references = [];
      if (!Array.isArray(day.activities)) day.activities = [];
      if (!day.reflection) day.reflection = '';
      if (!day.prayer_or_action) day.prayer_or_action = '';
    }

    return parsed as LearningPlanResult;
  } catch (error) {
    console.error('Failed to parse plan response:', error);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}
