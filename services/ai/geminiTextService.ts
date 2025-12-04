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
