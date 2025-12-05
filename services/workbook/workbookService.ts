import { WorkbookPage, WorkbookEdition, WorkbookTrimSize, WorkbookPageType } from '../../types/workbookTypes';
import { generatePage } from './workbookLayoutService';

export interface BuildOptions {
    edition: WorkbookEdition;
    trimSize: WorkbookTrimSize;
    goals: string[];
    habits: string[];
    visionBoardImages: string[];
    includeForeword?: boolean;
}

export async function buildInitialWorkbookPages(options: BuildOptions): Promise<WorkbookPage[]> {
    // derive page sequence from user goals, habits, theme
    // This is a scaffold, so we'll define a basic sequence
    const pageTypes: WorkbookPageType[] = [
        'COVER_FRONT',
        'TITLE_PAGE',
        ...(options.includeForeword ? ['DEDICATION'] : []),
        'VISION_BOARD_SPREAD',
        'GOAL_OVERVIEW',
        'MONTHLY_PLANNER',
        'WEEKLY_PLANNER',
        'REFLECTION_MONTH',
        'NOTES_LINED'
    ];

    const pages: WorkbookPage[] = [];

    for (const type of pageTypes) {
        const page = await generatePage({
            type: type as any,
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
