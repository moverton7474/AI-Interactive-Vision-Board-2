import { WorkbookPageType, WorkbookTextBlock, WorkbookImageBlock } from '../../types/workbookTypes';

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
    }
    // ... add more mocks as needed

    return {
        type: context.type,
        textBlocks,
        imageBlocks
    };
}
