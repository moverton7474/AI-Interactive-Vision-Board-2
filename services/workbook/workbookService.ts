import { WorkbookPage, WorkbookEdition, WorkbookTrimSize } from '../../types/workbookTypes';
import { generatePage } from './workbookLayoutService';

export interface BuildOptions {
    edition: WorkbookEdition;
    trimSize: WorkbookTrimSize;
    goals: string[];
    habits: string[];
    visionBoardImages: string[];
}

export async function buildInitialWorkbookPages(options: BuildOptions): Promise<WorkbookPage[]> {
    // derive page sequence from user goals, habits, theme
    // This is a scaffold, so we'll define a basic sequence
    const pageTypes = [
        'COVER',
        'TITLE_PAGE',
        'VISION_BOARD',
        'GOAL_OVERVIEW',
        'MONTHLY_PLANNER',
        'WEEKLY_PLANNER',
        'REFLECTION',
        'NOTES'
    ] as const;

    const pages: WorkbookPage[] = [];

    for (const type of pageTypes) {
        const page = await generatePage({
            type,
            edition: options.edition,
            trimSize: options.trimSize,
            goals: options.goals,
            habits: options.habits
        });
        pages.push(page);
    }

    return pages;
}

export async function regeneratePage(page: WorkbookPage): Promise<WorkbookPage> {
    // re-run AI pipeline for a single page
    // For now, just return the page as is or simulate an update
    console.log('Regenerating page', page.id);
    return page;
}
