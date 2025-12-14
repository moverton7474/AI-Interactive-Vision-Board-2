import { WorkbookPageType, WorkbookTextBlock, WorkbookImageBlock } from '../../types/workbookTypes';
import { supabase } from '../../lib/supabase';

interface GenerationContext {
    type: WorkbookPageType;
    goals?: string[];
    habits?: string[];
    [key: string]: any;
}

// ============================================
// ASCENSION PLAN TYPES & GENERATION (P0-D)
// ============================================

export type AscensionTaskCategory = 'finance' | 'career' | 'health' | 'relationships' | 'spiritual' | 'personal';

export interface AscensionTask {
    title: string;
    metric: string;
    due_days: number;
    category: AscensionTaskCategory;
    priority: 1 | 2 | 3;
    success_criteria: string;
}

export interface AscensionPlanContext {
    userId: string;
    visionTitle?: string;
    visionNarrative?: string;
    imageDescription?: string;
    visionBoardId?: string;
}

/**
 * P0-D: Generate an "Ascension Plan" immediately after saving a vision
 *
 * This function calls Gemini to generate 5 structured, actionable tasks
 * based on the user's vision board content. Tasks are then inserted into
 * the action_tasks table.
 *
 * @param visionContext - Context from the saved vision board
 * @returns Array of 5 AscensionTask objects
 */
export async function generateAscensionPlan(
    visionContext: AscensionPlanContext
): Promise<AscensionTask[]> {
    const systemPrompt = `You are an elite goal strategist specializing in vision-to-action conversion.
Your task is to generate EXACTLY 5 distinct, measurable tasks that will help the user achieve their vision.

RULES:
1. Return ONLY valid JSON - no markdown, no explanations, no code blocks
2. Each task must be executable within 7-30 days
3. Each task must have a clear, quantifiable metric
4. Tasks should be diverse across categories when possible
5. Avoid vague items like "think about..." or "consider..." - be specific
6. Each task should move the user tangibly closer to their vision

Output JSON schema:
{
  "tasks": [
    {
      "title": "Short actionable title (max 60 chars)",
      "metric": "Specific measurable outcome (e.g., '5 companies researched')",
      "due_days": 7-30,
      "category": "finance|career|health|relationships|spiritual|personal",
      "priority": 1-3 (1=highest),
      "success_criteria": "How to know this task is complete"
    }
  ]
}`;

    const userPrompt = JSON.stringify({
        visionTitle: visionContext.visionTitle ?? 'My Vision',
        visionNarrative: visionContext.visionNarrative ?? '',
        imageDescription: visionContext.imageDescription ?? '',
    });

    try {
        // Get current session for auth
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.warn('[AscensionPlan] No session, using fallback tasks');
            return getDefaultAscensionTasks();
        }

        // Call Gemini via proxy
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: {
                action: 'raw',
                contents: [
                    { parts: [{ text: `System: ${systemPrompt}` }] },
                    { parts: [{ text: `User Vision Context:\n${userPrompt}` }] }
                ],
                config: {
                    temperature: 0.6,
                    maxOutputTokens: 2000,
                    responseMimeType: 'application/json'
                }
            },
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        });

        if (error) {
            console.error('[AscensionPlan] Gemini proxy error:', error);
            return getDefaultAscensionTasks();
        }

        // Parse response
        const rawText = data?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Clean any markdown wrappers
        const cleanText = rawText.replace(/```json\n?|\n?```/g, '').trim();

        let parsed: { tasks: AscensionTask[] };
        try {
            parsed = JSON.parse(cleanText);
        } catch (parseErr) {
            console.error('[AscensionPlan] JSON parse error:', parseErr, 'Raw:', cleanText.substring(0, 200));
            return getDefaultAscensionTasks();
        }

        // Validate structure
        if (!parsed?.tasks || !Array.isArray(parsed.tasks) || parsed.tasks.length !== 5) {
            console.warn('[AscensionPlan] Invalid task count, using fallback');
            return getDefaultAscensionTasks();
        }

        // Validate each task has required fields
        const validatedTasks = parsed.tasks.map((t, i) => ({
            title: t.title || `Action Step ${i + 1}`,
            metric: t.metric || 'Complete the task',
            due_days: Math.min(Math.max(t.due_days || 7, 7), 30),
            category: validateCategory(t.category),
            priority: validatePriority(t.priority),
            success_criteria: t.success_criteria || t.metric || 'Task completed'
        }));

        console.log('[AscensionPlan] Generated', validatedTasks.length, 'tasks');
        return validatedTasks;

    } catch (err) {
        console.error('[AscensionPlan] Unexpected error:', err);
        return getDefaultAscensionTasks();
    }
}

/**
 * Insert Ascension Plan tasks into the database
 *
 * @param userId - User ID to associate tasks with
 * @param tasks - Array of AscensionTask objects
 * @param visionBoardId - Optional vision board ID to link tasks to
 */
export async function insertAscensionPlanTasks(
    userId: string,
    tasks: AscensionTask[],
    visionBoardId?: string
): Promise<{ success: boolean; insertedCount: number; error?: string }> {
    try {
        const taskRecords = tasks.map((t) => ({
            user_id: userId,
            title: t.title,
            description: t.success_criteria,
            type: mapCategoryToType(t.category),
            due_date: new Date(Date.now() + t.due_days * 86400000).toISOString(),
            is_completed: false,
            ai_metadata: {
                source: 'ascension_plan',
                metric: t.metric,
                category: t.category,
                priority: t.priority,
                success_criteria: t.success_criteria,
                vision_board_id: visionBoardId
            }
        }));

        const { data, error } = await supabase
            .from('action_tasks')
            .insert(taskRecords)
            .select('id');

        if (error) {
            console.error('[AscensionPlan] Insert error:', error);
            return { success: false, insertedCount: 0, error: error.message };
        }

        console.log('[AscensionPlan] Inserted', data?.length || 0, 'tasks for user', userId);
        return { success: true, insertedCount: data?.length || 0 };

    } catch (err) {
        console.error('[AscensionPlan] Insert exception:', err);
        return {
            success: false,
            insertedCount: 0,
            error: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}

// Helper: Map AscensionTask category to action_tasks type
function mapCategoryToType(category: AscensionTaskCategory): 'FINANCE' | 'LIFESTYLE' | 'ADMIN' {
    switch (category) {
        case 'finance':
            return 'FINANCE';
        case 'career':
        case 'personal':
            return 'ADMIN';
        case 'health':
        case 'relationships':
        case 'spiritual':
        default:
            return 'LIFESTYLE';
    }
}

// Helper: Validate category value
function validateCategory(category: string): AscensionTaskCategory {
    const validCategories: AscensionTaskCategory[] = ['finance', 'career', 'health', 'relationships', 'spiritual', 'personal'];
    return validCategories.includes(category as AscensionTaskCategory)
        ? category as AscensionTaskCategory
        : 'personal';
}

// Helper: Validate priority value
function validatePriority(priority: number): 1 | 2 | 3 {
    if (priority === 1 || priority === 2 || priority === 3) return priority;
    return 2;
}

// Helper: Default fallback tasks if AI generation fails
function getDefaultAscensionTasks(): AscensionTask[] {
    return [
        {
            title: 'Define your top 3 priorities for this vision',
            metric: '3 priorities documented',
            due_days: 7,
            category: 'personal',
            priority: 1,
            success_criteria: 'Written down top 3 priorities with why each matters'
        },
        {
            title: 'Research key resources or mentors',
            metric: '5 resources identified',
            due_days: 14,
            category: 'career',
            priority: 2,
            success_criteria: 'List of 5 books, courses, or mentors relevant to your vision'
        },
        {
            title: 'Create a financial milestone plan',
            metric: '3 financial milestones set',
            due_days: 14,
            category: 'finance',
            priority: 1,
            success_criteria: 'Documented 3 financial checkpoints with target dates'
        },
        {
            title: 'Establish a daily visualization habit',
            metric: '7 consecutive days completed',
            due_days: 7,
            category: 'spiritual',
            priority: 2,
            success_criteria: 'Spent 5 minutes each day visualizing your achieved vision'
        },
        {
            title: 'Share your vision with an accountability partner',
            metric: '1 conversation completed',
            due_days: 21,
            category: 'relationships',
            priority: 3,
            success_criteria: 'Had a meaningful conversation about your vision with someone supportive'
        }
    ];
}

export async function generateWorkbookPageJson(context: any): Promise<{
    type: WorkbookPageType;
    textBlocks: WorkbookTextBlock[];
    imageBlocks: WorkbookImageBlock[];
}> {
    // In a real app, this would call Gemini Pro with the prompt
    // For now, we return mock data based on the page type

    const textBlocks: WorkbookTextBlock[] = [];
    const imageBlocks: WorkbookImageBlock[] = [];

    if (context.type === 'COVER') {
        textBlocks.push({
            id: 'title',
            role: 'title',
            content: 'EXECUTIVE VISION 2025',
            position: { x: 50, y: 30 }
        });
        textBlocks.push({
            id: 'name',
            role: 'label',
            content: 'PREPARED FOR THE EXECUTIVE',
            position: { x: 50, y: 80 }
        });
        imageBlocks.push({
            id: 'cover-bg',
            prompt: 'Minimalist matte black leather executive planner on stone surface, centered white serif title, geometric emblem icon, debossed name, soft overhead light, premium editorial product photo, vertical 7x9 ratio',
            position: { x: 0, y: 0, w: 100, h: 100 }
        });
    } else if (context.type === 'MONTHLY_PLANNER') {
        textBlocks.push({
            id: 'month-title',
            role: 'title',
            content: 'JANUARY',
            position: { x: 10, y: 5 }
        });
    } else if (context.type === 'FOREWORD') {
        textBlocks.push({
            id: 'foreword-title',
            role: 'title',
            content: 'A LETTER FROM YOUR FUTURE SELF',
            position: { x: 50, y: 15 },
            style: { fontSize: '1.8rem', textAlign: 'center', width: '80%' }
        });

        let forewordContent = '';

        try {
            // 1. Construct the Prompt
            const goalsList = context.goals?.length ? context.goals.join(', ') : 'living my best life';
            const habitsList = context.habits?.length ? context.habits.join(', ') : 'consistent daily action';

            const prompt = `
            You are the user's "Future Self" writing from 3 years in the future.
            You have achieved these goals: ${goalsList}.
            You stuck to these habits: ${habitsList}.
            
            Write a heartfelt, inspiring letter to your past self (the user today).
            - Acknowledge the doubts they might be feeling right now.
            - Tell them that the hard work paid off.
            - Describe how amazing life is now that these visions are reality.
            - Keep it under 250 words.
            - Sign it "With gratitude,\nYour Future Self".
            `;

            // 2. Call Gemini Proxy
            const { data, error } = await supabase.functions.invoke('gemini-proxy', {
                body: {
                    action: 'raw',
                    contents: [{ parts: [{ text: prompt }] }],
                    config: {
                        temperature: 0.7,
                        maxOutputTokens: 1000
                    }
                }
            });

            if (error) throw error;

            // 3. Extract Content
            forewordContent = data?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        } catch (err) {
            console.error('AI Foreword Generation Failed:', err);
            // Fallback content if AI fails
            forewordContent = `Dear Visionary,\n\nI am writing to you from the future to tell you that everything you are working for is worth it. Keep going.\n\n(AI Generation Unavailable - This is a placeholder)\n\nSincerely,\nYour Future Self`;
        }

        // If content is still empty for some reason, use fallback
        if (!forewordContent) {
            forewordContent = `Dear Visionary,\n\nTrust the process. You are on the right path.\n\nSincerely,\nYour Future Self`;
        }

        textBlocks.push({
            id: 'foreword-body',
            role: 'body',
            content: forewordContent,
            position: { x: 50, y: 50 },
            style: { fontSize: '1.1rem', lineHeight: '1.8', textAlign: 'justify', width: '70%', fontFamily: 'Georgia, serif' }
        });
    } else if (context.type === 'TITLE_PAGE') {
        textBlocks.push({
            id: 'tp-title',
            role: 'title',
            content: 'MY VISIONARY YEAR',
            position: { x: 50, y: 40 },
            style: { fontSize: '2.5rem', letterSpacing: '0.2em' }
        });
        textBlocks.push({
            id: 'tp-name',
            role: 'label',
            content: 'THIS WORKBOOK BELONGS TO:',
            position: { x: 50, y: 60 },
            style: { fontSize: '0.8rem', letterSpacing: '0.1em' }
        });
        textBlocks.push({
            id: 'tp-line',
            role: 'label',
            content: '________________________________________',
            position: { x: 50, y: 65 },
            style: { fontSize: '1rem' }
        });
    } else if (context.type === 'VISION_BOARD') {
        textBlocks.push({
            id: 'vb-title',
            role: 'title',
            content: 'VISION BOARD 2025',
            position: { x: 50, y: 10 }
        });
        // Mock images for vision board
        imageBlocks.push({
            id: 'vb-img-1',
            prompt: 'Luxury modern home architecture',
            position: { x: 10, y: 20, w: 35, h: 30 }
        });
        imageBlocks.push({
            id: 'vb-img-2',
            prompt: 'Executive office with city view',
            position: { x: 55, y: 20, w: 35, h: 30 }
        });
        imageBlocks.push({
            id: 'vb-img-3',
            prompt: 'Wellness and meditation space',
            position: { x: 10, y: 55, w: 35, h: 30 }
        });
        imageBlocks.push({
            id: 'vb-img-4',
            prompt: 'Travel destination amalfi coast',
            position: { x: 55, y: 55, w: 35, h: 30 }
        });
    } else if (context.type === 'GOAL_OVERVIEW') {
        textBlocks.push({
            id: 'go-title',
            role: 'title',
            content: 'ANNUAL GOALS',
            position: { x: 50, y: 10 }
        });
        textBlocks.push({
            id: 'go-subtitle',
            role: 'subtitle',
            content: 'Define your key objectives for the year.',
            position: { x: 50, y: 15 }
        });
        // Mock goal slots
        [1, 2, 3].forEach((i) => {
            textBlocks.push({
                id: `go-goal-${i}`,
                role: 'body',
                content: `Goal ${i}: __________________________________________________`,
                position: { x: 50, y: 25 + (i * 15) },
                style: { textAlign: 'left', width: '80%' }
            });
        });
    } else if (context.type === 'WEEKLY_PLANNER') {
        textBlocks.push({
            id: 'wp-title',
            role: 'title',
            content: 'WEEKLY FOCUS',
            position: { x: 50, y: 8 }
        });
        // Mock days
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Weekend'].forEach((day, i) => {
            textBlocks.push({
                id: `wp-day-${i}`,
                role: 'body',
                content: `${day}`,
                position: { x: 20, y: 20 + (i * 12) },
                style: { fontWeight: 'bold' }
            });
            textBlocks.push({
                id: `wp-line-${i}`,
                role: 'body',
                content: `__________________________________________________`,
                position: { x: 60, y: 20 + (i * 12) },
                style: { width: '60%' }
            });
        });
    } else if (context.type === 'REFLECTION') {
        textBlocks.push({
            id: 'ref-title',
            role: 'title',
            content: 'MONTHLY REFLECTION',
            position: { x: 50, y: 10 }
        });
        textBlocks.push({
            id: 'ref-q1',
            role: 'body',
            content: 'What was my biggest win this month?',
            position: { x: 50, y: 25 },
            style: { fontWeight: 'bold', width: '80%' }
        });
        textBlocks.push({
            id: 'ref-a1',
            role: 'body',
            content: '__________________________________________________________\n__________________________________________________________',
            position: { x: 50, y: 32 },
            style: { width: '80%' }
        });
        textBlocks.push({
            id: 'ref-q2',
            role: 'body',
            content: 'What did I learn?',
            position: { x: 50, y: 50 },
            style: { fontWeight: 'bold', width: '80%' }
        });
        textBlocks.push({
            id: 'ref-a2',
            role: 'body',
            content: '__________________________________________________________\n__________________________________________________________',
            position: { x: 50, y: 57 },
            style: { width: '80%' }
        });
    } else if (context.type === 'NOTES') {
        textBlocks.push({
            id: 'notes-title',
            role: 'title',
            content: 'NOTES & IDEAS',
            position: { x: 50, y: 10 }
        });
        textBlocks.push({
            id: 'notes-lines',
            role: 'body',
            content: Array(20).fill('__________________________________________________________').join('\n'),
            position: { x: 50, y: 55 },
            style: { lineHeight: '2.5', width: '80%', fontSize: '0.8rem', color: '#ccc' }
        });
    }
    // ... add more mocks as needed

    return {
        type: context.type,
        textBlocks,
        imageBlocks
    };
}
