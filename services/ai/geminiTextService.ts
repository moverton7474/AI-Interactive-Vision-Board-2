import { WorkbookPageType, WorkbookTextBlock, WorkbookImageBlock } from '../../types/workbookTypes';
import { supabase } from '../../lib/supabase';

interface GenerationContext {
    type: WorkbookPageType;
    goals?: string[];
    habits?: string[];
    [key: string]: any;
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

// ==============================
// ASCENSION PLAN GENERATION (P0-D)
// ==============================

export interface AscensionTask {
    id: string;
    title: string;
    description: string;
    category: 'MINDSET' | 'FINANCE' | 'HEALTH' | 'CAREER' | 'RELATIONSHIPS';
    dueDate: string;
    priority: 'high' | 'medium' | 'low';
    aiMetadata?: {
        generatedFrom: string;
        confidence: number;
        reasoning: string;
    };
}

export interface AscensionPlanResult {
    tasks: AscensionTask[];
    summary: string;
    affirmation: string;
}

/**
 * Generate an Ascension Plan based on the user's vision board content
 * Called automatically after vision board generation/save
 */
export async function generateAscensionPlan(
    visionPrompt: string,
    userGoals?: {
        financialTarget?: number;
        visionText?: string;
        domain?: string;
    }
): Promise<AscensionPlanResult> {
    console.log('[AscensionPlan] Generating tasks for prompt:', visionPrompt.substring(0, 100));

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.warn('[AscensionPlan] No session, returning fallback tasks');
            return getFallbackAscensionPlan(visionPrompt);
        }

        // Build context for AI
        const contextParts: string[] = [
            `Vision Description: ${visionPrompt}`,
        ];

        if (userGoals?.financialTarget) {
            contextParts.push(`Financial Target: $${userGoals.financialTarget.toLocaleString()}`);
        }
        if (userGoals?.visionText) {
            contextParts.push(`Personal Vision Statement: ${userGoals.visionText}`);
        }
        if (userGoals?.domain) {
            contextParts.push(`Primary Focus Domain: ${userGoals.domain}`);
        }

        const systemPrompt = `You are an expert life coach and strategic planner. Based on the user's vision board and goals, generate 5 specific, actionable tasks that will help them manifest their vision into reality.

Each task should be:
- Specific and measurable
- Achievable within 2 weeks
- Directly connected to their stated vision
- Categorized appropriately (MINDSET, FINANCE, HEALTH, CAREER, or RELATIONSHIPS)

Return ONLY a valid JSON object with this exact structure:
{
  "tasks": [
    {
      "title": "Task title (max 50 chars)",
      "description": "Detailed description of what to do",
      "category": "MINDSET|FINANCE|HEALTH|CAREER|RELATIONSHIPS",
      "priority": "high|medium|low",
      "daysFromNow": 1-14
    }
  ],
  "summary": "Brief summary of the action plan (1-2 sentences)",
  "affirmation": "A powerful daily affirmation related to their vision"
}`;

        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: {
                action: 'raw',
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: `${systemPrompt}\n\n${contextParts.join('\n')}` }]
                    }
                ],
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                }
            },
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        });

        if (error) {
            console.error('[AscensionPlan] Gemini proxy error:', error);
            return getFallbackAscensionPlan(visionPrompt);
        }

        // Extract text from response
        const responseText = data?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse JSON from response (handle markdown code blocks)
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        const parsed = JSON.parse(jsonStr.trim());

        // Transform tasks with proper IDs and due dates
        const tasks: AscensionTask[] = parsed.tasks.map((task: any, index: number) => {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (task.daysFromNow || index + 1));

            return {
                id: `ascension-${Date.now()}-${index}`,
                title: task.title,
                description: task.description,
                category: task.category || 'MINDSET',
                dueDate: dueDate.toISOString(),
                priority: task.priority || 'medium',
                aiMetadata: {
                    generatedFrom: 'vision_board',
                    confidence: 0.85,
                    reasoning: `Generated from vision: "${visionPrompt.substring(0, 50)}..."`,
                },
            };
        });

        console.log('[AscensionPlan] Generated', tasks.length, 'tasks');

        return {
            tasks,
            summary: parsed.summary || 'Your personalized action plan is ready.',
            affirmation: parsed.affirmation || 'I am taking aligned action toward my vision every day.',
        };

    } catch (err) {
        console.error('[AscensionPlan] Generation error:', err);
        return getFallbackAscensionPlan(visionPrompt);
    }
}

/**
 * Fallback tasks when AI generation fails
 */
function getFallbackAscensionPlan(visionPrompt: string): AscensionPlanResult {
    const now = new Date();

    return {
        tasks: [
            {
                id: `fallback-${Date.now()}-1`,
                title: 'Define your vision clarity statement',
                description: 'Write a clear 1-paragraph description of your vision and why it matters to you.',
                category: 'MINDSET',
                dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
                priority: 'high',
            },
            {
                id: `fallback-${Date.now()}-2`,
                title: 'Research one concrete step',
                description: 'Spend 30 minutes researching one specific action that moves you toward your vision.',
                category: 'CAREER',
                dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                priority: 'high',
            },
            {
                id: `fallback-${Date.now()}-3`,
                title: 'Set a financial milestone',
                description: 'Determine the first financial milestone needed for your vision and create a savings target.',
                category: 'FINANCE',
                dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                priority: 'medium',
            },
            {
                id: `fallback-${Date.now()}-4`,
                title: 'Share your vision with someone',
                description: 'Tell a trusted friend or family member about your vision to create accountability.',
                category: 'RELATIONSHIPS',
                dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                priority: 'medium',
            },
            {
                id: `fallback-${Date.now()}-5`,
                title: 'Schedule a vision review',
                description: 'Block 15 minutes on your calendar each morning to review your vision board.',
                category: 'MINDSET',
                dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                priority: 'low',
            },
        ],
        summary: 'Your action plan focuses on clarity, research, and accountability.',
        affirmation: 'I am actively creating the life I visualize every single day.',
    };
}

/**
 * Save Ascension Plan tasks to the database
 */
export async function insertAscensionPlanTasks(tasks: AscensionTask[]): Promise<boolean> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('[AscensionPlan] No user for task insert');
            return false;
        }

        const taskRecords = tasks.map(task => ({
            user_id: user.id,
            title: task.title,
            description: task.description,
            type: task.category,
            due_date: task.dueDate,
            is_completed: false,
            priority: task.priority,
            ai_metadata: task.aiMetadata || null,
        }));

        const { error } = await supabase
            .from('action_tasks')
            .insert(taskRecords);

        if (error) {
            console.error('[AscensionPlan] Task insert error:', error);
            return false;
        }

        console.log('[AscensionPlan] Inserted', taskRecords.length, 'tasks');
        return true;
    } catch (err) {
        console.error('[AscensionPlan] Insert error:', err);
        return false;
    }
}
