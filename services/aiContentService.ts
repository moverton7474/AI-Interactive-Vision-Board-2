import { supabase } from '../lib/supabase';
import {
    WorkbookPageType,
    WorkbookTheme,
    AIContentRequest,
    AIContentResponse,
    WorkbookTextBlock,
    WorkbookTableBlock,
    WorkbookChartBlock
} from '../types/workbookTypes';
import { getThemePack } from './themeContentLibrary';

// ============================================
// AI CONTENT GENERATION SERVICE
// ============================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Main entry point for generating AI content for workbook pages
 */
export async function generatePageContent(
    request: AIContentRequest
): Promise<AIContentResponse> {
    const startTime = Date.now();

    try {
        // 1. Build context-aware prompt
        const prompt = buildContentPrompt(request);

        // 2. Route to appropriate LLM
        const llmChoice = selectLLM(request.pageType);

        // 3. Generate content with retry logic
        const rawContent = await generateWithRetry(prompt, llmChoice, request);

        // 4. Parse and validate response
        const parsedContent = parseAIResponse(rawContent, request.pageType);

        // 5. Return structured response
        return {
            success: true,
            content: parsedContent,
            metadata: {
                llm_used: llmChoice,
                generation_time_ms: Date.now() - startTime,
                tokens_used: estimateTokens(rawContent)
            }
        };
    } catch (error) {
        console.error('AI content generation failed:', error);
        return {
            success: false,
            content: {},
            error: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
                llm_used: 'gemini', // default
                generation_time_ms: Date.now() - startTime
            }
        };
    }
}

// ============================================
// PROMPT BUILDING
// ============================================

function buildContentPrompt(request: AIContentRequest): string {
    const { pageType, theme, userContext, customInstructions, tone } = request;

    let prompt = '';

    // 1. System instructions
    prompt += getSystemInstructions(pageType, tone || 'professional');
    prompt += '\n\n';

    // 2. Theme-specific guidance
    if (theme) {
        const themePack = getThemePack(theme);
        prompt += `THEME CONTEXT:\n${themePack.description}\n`;
        prompt += `Use motivation style consistent with: ${themePack.name}\n`;
        prompt += `Key focus areas: ${themePack.recommended_pages.slice(0, 5).join(', ')}\n\n`;
    }

    // 3. User context
    if (userContext) {
        prompt += 'USER CONTEXT:\n';

        if (userContext.goals && userContext.goals.length > 0) {
            prompt += `Goals: ${userContext.goals.map((g: any) => g.title || g).join(', ')}\n`;
        }

        if (userContext.habits && userContext.habits.length > 0) {
            prompt += `Habits: ${userContext.habits.map((h: any) => h.name || h).join(', ')}\n`;
        }

        if (userContext.financial_data) {
            const fd = userContext.financial_data;
            prompt += `Financial Target: $${fd.target || 'Not specified'}\n`;
        }

        if (userContext.amie_profile) {
            const profile = userContext.amie_profile;
            prompt += `Core Values: ${profile.core_values?.join(', ') || 'Not specified'}\n`;
            prompt += `Life Roles: ${profile.life_roles?.join(', ') || 'Not specified'}\n`;
        }

        prompt += '\n';
    }

    // 4. Custom instructions
    if (customInstructions) {
        prompt += `ADDITIONAL INSTRUCTIONS:\n${customInstructions}\n\n`;
    }

    // 5. Page-specific task
    prompt += getPageSpecificTask(pageType, theme);

    // 6. Output format instructions
    prompt += '\n\n' + getOutputFormat(pageType);

    return prompt;
}

function getSystemInstructions(pageType: WorkbookPageType, tone: string): string {
    const toneMap = {
        professional: 'Use clear, professional language appropriate for executive planning.',
        casual: 'Use friendly, conversational language that feels approachable.',
        inspirational: 'Use uplifting, motivational language that energizes and inspires action.',
        analytical: 'Use data-driven, logical language focused on metrics and outcomes.'
    };

    return `You are an expert executive planner and life coach creating personalized content for a premium planning workbook. ${toneMap[tone as keyof typeof toneMap] || toneMap.professional}

Your content should be:
- Actionable and specific
- Personalized to the user's context
- Formatted for print (concise, scannable)
- Motivating and empowering
- Free of generic platitudes`;
}

function getPageSpecificTask(pageType: WorkbookPageType, theme?: WorkbookTheme): string {
    const tasks: Partial<Record<WorkbookPageType, string>> = {
        LIFE_VISION_OVERVIEW: `Create a compelling Life Vision Overview page that:
- Captures the user's ideal future in 1-3 years
- Identifies 3-5 key life domains (e.g., career, health, relationships)
- States a powerful vision statement
- Lists specific outcomes the user will achieve
Format as: Title, Vision Statement, Key Domains (with brief descriptions), Success Indicators`,

        ANNUAL_VISION: `Create an Annual Vision page for the upcoming year that:
- Sets the theme/focus for the year
- Defines 3-5 major goals
- Identifies quarterly milestones
- States a yearly intention or word
Format as: Year Title, Annual Theme, Top Goals (with target dates), Quarterly Milestones`,

        SMART_GOALS_WORKSHEET: `Create a SMART Goals Worksheet with:
- 3-4 pre-filled goals based on user context
- Each goal broken down into: Specific, Measurable, Achievable, Relevant, Time-bound
- Action steps for each goal
- Progress tracking method
Format as structured table with columns for each SMART criteria`,

        HABIT_TRACKER: `Create a Habit Tracker grid with:
- 3 most important habits based on user's theme
- Monthly grid (31 days)
- Habit name, icon/emoji, target frequency
- Space for notes
Format as: Month name, Habit list with checkboxes, reflection section`,

        BUDGET_PLANNER: `Create a Budget Planner with:
- Income sources
- Fixed expenses (housing, utilities, insurance)
- Variable expenses (food, entertainment, etc.)
- Savings goals
- Debt payments
- Income minus expenses
Format as detailed table with categories and amounts`,

        WEEKLY_PLANNER: `Create a Weekly Planner template with:
- Week of [date]
- Top 3 priorities for the week
- Daily sections (Monday-Sunday)
- Each day with: Top priority, Schedule blocks, Tasks, Notes
- Weekly wins section
Format as structured weekly spread`,

        MONTHLY_REVIEW: `Create a Monthly Review template with:
- Month name and reflection date
- Wins and achievements this month
- Challenges and lessons learned
- Progress on key goals (with metrics)
- Gratitude list
- Focus for next month
Format as prompts with space for answers`,

        FINANCIAL_SNAPSHOT: `Create a Financial Snapshot with:
- Net worth calculation (assets - liabilities)
- Income streams
- Expense breakdown
- Savings rate
- Debt summary
- Investment portfolio
Format as financial dashboard with key numbers`,

        PRAYER_JOURNAL: `Create a Prayer Journal template with:
- Date
- Scripture reading for the day
- Prayer requests
- Praises and thanksgiving
- God's answers/movements
- Personal reflections
Format as daily prayer log with prompts`,

        FITNESS_LOG: `Create a Fitness Log with:
- Date and time
- Workout type
- Exercises (with sets, reps, weight)
- Duration
- Intensity level
- How I felt
- Notes
Format as structured workout tracker`,

        LEADERSHIP_GOALS: `Create a Leadership Goals page with:
- Leadership vision statement
- Team objectives
- Personal development goals
- Key relationships to build
- Skills to develop
- Impact metrics
Format as strategic leadership plan`,

        WEEKLY_REFLECTION: `Create a Weekly Reflection template with:
- What went well this week?
- What didn't go as planned?
- Key lessons learned
- Energy level (1-10)
- Mood/emotions
- Gratitude
- Next week's focus
Format as reflection prompts with writing space`,

        NOTES_PAGES: `Create formatted Notes pages with:
- Elegant header
- Date field
- Lined or dotted grid
- Optional prompts at top
Format as clean note-taking template`,
    };

    return tasks[pageType] || `Create content for a ${pageType} page in an executive planner. Include relevant headings, prompts, and structure appropriate for this page type.`;
}

function getOutputFormat(pageType: WorkbookPageType): string {
    return `OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "textBlocks": [
    {
      "role": "title" | "subtitle" | "body" | "label" | "prompt",
      "content": "text content here"
    }
  ],
  "tableBlocks": [
    {
      "type": "budget" | "habit_grid" | "goal_tracker" | "schedule" | "generic",
      "headers": ["Column 1", "Column 2", ...],
      "rows": [["Cell 1", "Cell 2", ...], ...]
    }
  ]
}

CRITICAL: Return ONLY valid JSON. No markdown formatting, no explanations, just the JSON object.`;
}

// ============================================
// LLM SELECTION
// ============================================

type LLMChoice = 'gemini' | 'claude' | 'gpt4';

function selectLLM(pageType: WorkbookPageType): LLMChoice {
    // Vision-related content → Gemini
    if (pageType.includes('VISION') || pageType.includes('GALLERY')) {
        return 'gemini';
    }

    // Financial/analytical content → GPT-4
    if (pageType.includes('FINANCIAL') || pageType.includes('BUDGET') ||
        pageType.includes('NET_WORTH') || pageType.includes('RETIREMENT')) {
        return 'gpt4';
    }

    // Reflection/coaching content → Claude
    if (pageType.includes('REFLECTION') || pageType.includes('REVIEW') ||
        pageType.includes('JOURNAL') || pageType.includes('PRAYER')) {
        return 'claude';
    }

    // Default to Gemini
    return 'gemini';
}

// ============================================
// AI GENERATION WITH RETRY
// ============================================

async function generateWithRetry(
    prompt: string,
    llm: LLMChoice,
    request: AIContentRequest
): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
            }

            return await callLLM(prompt, llm);
        } catch (error) {
            console.warn(`AI generation attempt ${attempt + 1} failed:`, error);
            lastError = error as Error;
        }
    }

    throw lastError || new Error('AI generation failed after retries');
}

async function callLLM(prompt: string, llm: LLMChoice): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        throw new Error('No active session');
    }

    // Route to appropriate edge function based on LLM
    const endpoint = llm === 'gemini' ? 'gemini-proxy' :
        llm === 'claude' ? 'claude-proxy' :
            'gpt4-proxy';

    const { data, error } = await supabase.functions.invoke(endpoint, {
        body: {
            action: 'generate_content',
            prompt: prompt
        },
        headers: {
            Authorization: `Bearer ${session.access_token}`
        }
    });

    if (error) {
        throw new Error(`${llm} API error: ${error.message}`);
    }

    if (!data?.success) {
        throw new Error(`${llm} returned unsuccessful response`);
    }

    return data.content || data.text || '';
}

// ============================================
// RESPONSE PARSING
// ============================================

function parseAIResponse(rawContent: string, pageType: WorkbookPageType): {
    textBlocks?: WorkbookTextBlock[];
    tableBlocks?: WorkbookTableBlock[];
    chartBlocks?: WorkbookChartBlock[];
} {
    try {
        // Try to extract JSON from response (handle markdown code blocks)
        let jsonString = rawContent.trim();

        // Remove markdown code block formatting if present
        if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(jsonString);

        // Add unique IDs to blocks
        if (parsed.textBlocks) {
            parsed.textBlocks = parsed.textBlocks.map((block: any, index: number) => ({
                ...block,
                id: `text-${index}`,
                editable: true,
                ai_generated: true
            }));
        }

        if (parsed.tableBlocks) {
            parsed.tableBlocks = parsed.tableBlocks.map((block: any, index: number) => ({
                ...block,
                id: `table-${index}`,
                ai_populated: true
            }));
        }

        return parsed;
    } catch (error) {
        console.error('Failed to parse AI response as JSON:', error);

        // Fallback: Return raw content as a single text block
        return {
            textBlocks: [{
                id: 'text-0',
                role: 'body',
                content: rawContent,
                editable: true,
                ai_generated: true
            }]
        };
    }
}

// ============================================
// HELPERS
// ============================================

function estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
}

// ============================================
// PRE-BUILT FALLBACK TEMPLATES
// ============================================

export async function getFallbackContent(pageType: WorkbookPageType): Promise<{
    textBlocks: WorkbookTextBlock[];
    tableBlocks?: WorkbookTableBlock[];
}> {
    // Return generic template when AI fails
    const fallbacks: Partial<Record<WorkbookPageType, any>> = {
        WEEKLY_PLANNER: {
            textBlocks: [
                { id: 'title', role: 'title', content: 'Weekly Planner', editable: true },
                { id: 'week-of', role: 'label', content: 'Week of:', editable: true }
            ],
            tableBlocks: [{
                id: 'schedule',
                type: 'schedule',
                headers: ['Day', 'Top Priority', 'Tasks'],
                rows: [
                    ['Monday', '', ''],
                    ['Tuesday', '', ''],
                    ['Wednesday', '', ''],
                    ['Thursday', '', ''],
                    ['Friday', '', ''],
                    ['Saturday', '', ''],
                    ['Sunday', '', '']
                ]
            }]
        },
        HABIT_TRACKER: {
            textBlocks: [
                { id: 'title', role: 'title', content: 'Habit Tracker', editable: true },
                { id: 'month', role: 'label', content: 'Month:', editable: true }
            ],
            tableBlocks: [{
                id: 'habits',
                type: 'habit_grid',
                headers: ['Habit', ...Array.from({ length: 31 }, (_, i) => (i + 1).toString())],
                rows: [
                    ['Habit 1', ...Array(31).fill('')],
                    ['Habit 2', ...Array(31).fill('')],
                    ['Habit 3', ...Array(31).fill('')]
                ]
            }]
        }
    };

    return fallbacks[pageType] || {
        textBlocks: [
            { id: 'title', role: 'title', content: pageType.replace(/_/g, ' '), editable: true }
        ]
    };
}
