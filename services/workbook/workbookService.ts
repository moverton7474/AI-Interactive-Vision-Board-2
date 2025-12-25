/**
 * WORKBOOK V2: Data Flow Summary
 * ==============================
 *
 * 1. USER FLOW (WorkbookWizard.tsx):
 *    TYPE_SELECTION → PERSONALIZE → CONTENT → PREVIEW → PRINT
 *
 * 2. DATA FLOW:
 *    a) WorkbookWizard loads visionBoards (VisionImage[]) and habits (Habit[]) on mount
 *    b) User selects specific boards in CONTENT step → selectedVisionBoards (string[] of IDs)
 *    c) On "Generate Preview", wizard calls buildInitialWorkbookPages(options)
 *       - options.visionBoardImages: VisionImage[] (full objects with URLs)
 *       - options.habits: Habit[] (full objects)
 *    d) This service builds WorkbookPage[] with imageBlocks containing actual URLs
 *    e) WorkbookPreview receives and renders WorkbookPage[]
 *    f) On "Approve & Print", order is created with WorkbookPage[] stored in DB
 *
 * 3. PDF GENERATION (edge function):
 *    a) Edge function reads stored WorkbookPage[] from order
 *    b) pdfGenerator.ts renders WorkbookPage[] to PDF using pdf-lib
 *    c) Same WorkbookPage[] structure → consistent preview/PDF output
 *
 * 4. KEY INTERFACES:
 *    - BuildOptions: User selections passed to page builder
 *    - WorkbookPage: Canonical page structure for preview AND PDF
 *    - ImageBlock: Contains url, position, layout for vision images
 *    - TextBlock: Contains content, role, position for text elements
 *
 * CRITICAL: visionBoardImages in BuildOptions must contain full VisionImage objects
 * with URLs, not just IDs, so imageBlocks can be populated correctly.
 */

import { WorkbookPage, WorkbookEdition, WorkbookTrimSize, WorkbookPageType, ImageBlock, TextBlock, ThemePack, AIGeneratedContent, BindingType } from '../../types/workbookTypes';
import { generatePage } from './workbookLayoutService';
import { VisionImage, Habit } from '../../types';
import { PRODIGI_SPECS, TRIM_SIZES } from './printSpecifications';
import { supabase } from '../../lib/supabase';

export interface BuildOptions {
    edition: WorkbookEdition;
    trimSize: WorkbookTrimSize;
    goals: string[];
    habits: Habit[];
    visionBoardImages: VisionImage[];
    includeForeword?: boolean;
    coverTheme?: CoverThemeId;
    title?: string;
    subtitle?: string;
    // v2.1: Data injection fields
    financialTarget?: number;
    financialTargetLabel?: string;
    actionTasks?: Array<{ id: string; title: string; description?: string; due_date?: string; priority?: string }>;
    themePack?: ThemePack;
    userName?: string;
    aiContent?: AIGeneratedContent;
}

// Cover theme identifiers
export type CoverThemeId =
    | 'executive_dark'
    | 'faith_purpose'
    | 'tropical_retirement'
    | 'minimal_white_gold'
    | 'use_vision_board_cover';

export async function buildInitialWorkbookPages(options: BuildOptions): Promise<WorkbookPage[]> {
    const pages: WorkbookPage[] = [];
    let pageNumber = 1;

    // Helper to get layout metadata
    const getLayoutMeta = () => fillLayoutMeta(options.trimSize);

    // 1. COVER FRONT - Uses selected theme or first vision board
    const coverPage = await buildCoverPage(options, pageNumber++);
    pages.push(coverPage);

    // 2. TITLE PAGE
    const titlePage = await generatePage({
        type: 'TITLE_PAGE',
        edition: options.edition,
        trimSize: options.trimSize,
        goals: options.goals,
        habits: options.habits.map(h => h.id)
    });
    titlePage.pageNumber = pageNumber++;
    titlePage.title = options.title || 'My Vision Workbook';
    titlePage.subtitle = options.subtitle || new Date().getFullYear().toString();
    pages.push(titlePage);

    // 3. DEDICATION / FOREWORD (if enabled) - Now with AI-generated content
    if (options.includeForeword) {
        const forewordPage = buildForewordPage(options, pageNumber++);
        pages.push(forewordPage);
    }

    // 3.5 FINANCIAL SNAPSHOT (if financial target provided)
    if (options.financialTarget) {
        const financialPage = buildFinancialSnapshotPage(options, pageNumber++);
        pages.push(financialPage);
    }

    // 4. VISION BOARD SPREADS - One page per selected vision board (max 4)
    const maxVisionBoards = Math.min(options.visionBoardImages.length, 4);
    for (let i = 0; i < maxVisionBoards; i++) {
        const visionImage = options.visionBoardImages[i];
        const visionPage = buildVisionBoardPage(visionImage, options, pageNumber++);
        pages.push(visionPage);
    }

    // 5. GOAL OVERVIEW
    const goalPage = await generatePage({
        type: 'GOAL_OVERVIEW',
        edition: options.edition,
        trimSize: options.trimSize,
        goals: options.goals,
        habits: options.habits.map(h => h.id)
    });
    goalPage.pageNumber = pageNumber++;
    pages.push(goalPage);

    // 6. MONTHLY PLANNER (sample month)
    const monthlyPage = await generatePage({
        type: 'MONTHLY_PLANNER',
        edition: options.edition,
        trimSize: options.trimSize,
        goals: options.goals,
        habits: options.habits.map(h => h.id)
    });
    monthlyPage.pageNumber = pageNumber++;
    pages.push(monthlyPage);

    // 7. HABIT TRACKER - Uses actual habit data
    if (options.habits.length > 0) {
        const habitPage = buildHabitTrackerPage(options.habits, options, pageNumber++);
        pages.push(habitPage);
    }

    // 8. WEEKLY PLANNER
    const weeklyPage = await generatePage({
        type: 'WEEKLY_PLANNER',
        edition: options.edition,
        trimSize: options.trimSize,
        goals: options.goals,
        habits: options.habits.map(h => h.id)
    });
    weeklyPage.pageNumber = pageNumber++;
    pages.push(weeklyPage);

    // 9. REFLECTION PAGE
    const reflectionPage = await generatePage({
        type: 'REFLECTION_MONTH',
        edition: options.edition,
        trimSize: options.trimSize,
        goals: options.goals,
        habits: options.habits.map(h => h.id)
    });
    reflectionPage.pageNumber = pageNumber++;
    pages.push(reflectionPage);

    // 10. NOTES PAGE
    const notesPage = await generatePage({
        type: 'NOTES_LINED',
        edition: options.edition,
        trimSize: options.trimSize,
        goals: options.goals,
        habits: options.habits.map(h => h.id)
    });
    notesPage.pageNumber = pageNumber++;
    pages.push(notesPage);

    console.log(`[WorkbookService] Built ${pages.length} pages with ${options.visionBoardImages.length} vision boards`);
    return pages;
}

/**
 * Build a cover page with the selected theme
 */
function buildCoverPage(options: BuildOptions, pageNumber: number): WorkbookPage {
    const layout = fillLayoutMeta(options.trimSize);
    const coverTheme = options.coverTheme || 'executive_dark';

    // If using vision board cover, use first selected image
    const useVisionImage = coverTheme === 'use_vision_board_cover' && options.visionBoardImages.length > 0;
    const coverImageUrl = useVisionImage ? options.visionBoardImages[0].url : undefined;

    const imageBlocks: ImageBlock[] = useVisionImage && coverImageUrl ? [{
        id: crypto.randomUUID(),
        sourceType: 'VISION_IMAGE',
        url: coverImageUrl,
        alt: 'Cover Vision Board',
        layout: 'FULL_BLEED',
        position: { x: 0, y: 0, w: 100, h: 100 }
    }] : [];

    const textBlocks: TextBlock[] = [
        {
            id: crypto.randomUUID(),
            role: 'TITLE',
            content: options.title || 'My Vision Workbook',
            align: 'center',
            position: { x: 50, y: 40 }
        },
        {
            id: crypto.randomUUID(),
            role: 'SUBTITLE',
            content: options.subtitle || new Date().getFullYear().toString(),
            align: 'center',
            position: { x: 50, y: 55 }
        }
    ];

    return {
        id: crypto.randomUUID(),
        edition: options.edition,
        type: 'COVER_FRONT',
        pageNumber,
        layout,
        title: options.title,
        subtitle: options.subtitle,
        textBlocks,
        imageBlocks,
        aiContext: {
            visionBoardIds: options.visionBoardImages.map(v => v.id)
        },
        isVisible: true
    };
}

/**
 * Build a vision board page with the actual image URL
 */
function buildVisionBoardPage(visionImage: VisionImage, options: BuildOptions, pageNumber: number): WorkbookPage {
    const layout = fillLayoutMeta(options.trimSize);

    const imageBlocks: ImageBlock[] = [{
        id: crypto.randomUUID(),
        sourceType: 'VISION_IMAGE',
        url: visionImage.url,
        alt: visionImage.prompt || 'Vision Board',
        layout: 'FULL_BLEED',
        position: { x: 0, y: 5, w: 100, h: 70 }
    }];

    const textBlocks: TextBlock[] = [
        {
            id: crypto.randomUUID(),
            role: 'CAPTION',
            content: visionImage.prompt || 'My Vision',
            align: 'center',
            position: { x: 50, y: 85 }
        }
    ];

    return {
        id: crypto.randomUUID(),
        edition: options.edition,
        type: 'VISION_BOARD_SPREAD',
        pageNumber,
        layout,
        title: 'Vision Board',
        textBlocks,
        imageBlocks,
        aiContext: {
            visionBoardIds: [visionImage.id],
            sourceVisionPrompt: visionImage.prompt
        },
        isVisible: true
    };
}

/**
 * Build a habit tracker page with actual habit data
 */
function buildHabitTrackerPage(habits: Habit[], options: BuildOptions, pageNumber: number): WorkbookPage {
    const layout = fillLayoutMeta(options.trimSize);

    return {
        id: crypto.randomUUID(),
        edition: options.edition,
        type: 'HABIT_TRACKER',
        pageNumber,
        layout,
        title: 'Habit Architecture',
        textBlocks: [],
        imageBlocks: [],
        habitTracker: {
            habits: habits.map(h => ({
                id: h.id,
                name: h.title,
                description: h.description
            })),
            period: 'MONTH'
        },
        aiContext: {
            habitIds: habits.map(h => h.id)
        },
        isVisible: true
    };
}

/**
 * Build a financial snapshot page with user data
 */
function buildFinancialSnapshotPage(options: BuildOptions, pageNumber: number): WorkbookPage {
    const layout = fillLayoutMeta(options.trimSize);

    const textBlocks: TextBlock[] = [
        {
            id: crypto.randomUUID(),
            role: 'TITLE',
            content: 'My Financial Vision',
            align: 'center',
            position: { x: 50, y: 15 }
        },
        {
            id: crypto.randomUUID(),
            role: 'SUBTITLE',
            content: options.financialTargetLabel || 'Financial Freedom',
            align: 'center',
            position: { x: 50, y: 25 }
        }
    ];

    // Add financial target if available
    if (options.financialTarget) {
        textBlocks.push({
            id: crypto.randomUUID(),
            role: 'BODY',
            content: `Target: $${options.financialTarget.toLocaleString()}`,
            align: 'center',
            emphasis: 'bold',
            position: { x: 50, y: 40 }
        });
    }

    return {
        id: crypto.randomUUID(),
        edition: options.edition,
        type: 'FINANCIAL_OVERVIEW',
        pageNumber,
        layout,
        title: 'Financial Snapshot',
        textBlocks,
        imageBlocks: [],
        isVisible: true
    };
}

/**
 * Build a foreword page with AI-generated content
 */
function buildForewordPage(options: BuildOptions, pageNumber: number): WorkbookPage {
    const layout = fillLayoutMeta(options.trimSize);

    // Use AI-generated foreword if available, otherwise use placeholder
    const forewordText = options.aiContent?.foreword ||
        'Your journey toward your vision begins here. Every page in this workbook represents a step closer to the life you deserve.';

    const textBlocks: TextBlock[] = [
        {
            id: crypto.randomUUID(),
            role: 'TITLE',
            content: 'Letter from Your Future Self',
            align: 'center',
            position: { x: 50, y: 10 }
        },
        {
            id: crypto.randomUUID(),
            role: 'BODY',
            content: forewordText,
            align: 'left',
            position: { x: 15, y: 25, w: 70 }
        }
    ];

    return {
        id: crypto.randomUUID(),
        edition: options.edition,
        type: 'DEDICATION',
        pageNumber,
        layout,
        title: 'Foreword',
        textBlocks,
        imageBlocks: [],
        isVisible: true
    };
}

/**
 * Get layout metadata for a trim size
 * Updated for Prodigi specs: 10mm safety margin, no manual bleed
 */
function fillLayoutMeta(trimSize: WorkbookTrimSize, bindingType: BindingType = 'SOFTCOVER') {
    // Get size from centralized specs
    const sizeKey = trimSize as keyof typeof TRIM_SIZES;
    const size = TRIM_SIZES[sizeKey] || TRIM_SIZES.TRADE_6x9;

    return {
        trimSize,
        widthPx: size.widthPx,
        heightPx: size.heightPx,
        // NO bleed - Prodigi adds automatically
        bleedPx: PRODIGI_SPECS.BLEED_PX,
        // 10mm safety margin per Prodigi specs
        safeMarginPx: PRODIGI_SPECS.SAFETY_MARGIN_PX,
        // 12mm for spiral edge if applicable
        spiralEdgeMarginPx: bindingType === 'SPIRAL' ? PRODIGI_SPECS.SPIRAL_EDGE_MARGIN_PX : undefined,
        bindingType,
        dpi: PRODIGI_SPECS.DPI
    };
}

/**
 * Fetch user data for workbook auto-population
 * Pulls data from user_vision_profiles, habits, and goal_plans
 */
export async function fetchUserDataForWorkbook(userId: string): Promise<{
    financialTarget?: number;
    financialTargetLabel?: string;
    visionText?: string;
    habits: Habit[];
    actionTasks: Array<{ id: string; title: string; description?: string; due_date?: string; priority?: string }>;
    userName?: string;
    theme?: ThemePack;
}> {
    try {
        // Fetch user vision profile
        const { data: visionProfile } = await supabase
            .from('user_vision_profiles')
            .select('financial_target, financial_target_label, vision_text, domain_selection')
            .eq('user_id', userId)
            .single();

        // Fetch active habits
        const { data: habits } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true);

        // Fetch action tasks from active plan using the helper function
        let actionTasks: any[] = [];
        try {
            const { data: activePlan } = await supabase
                .rpc('get_active_plan_with_tasks', { p_user_id: userId });

            if (activePlan && activePlan.tasks) {
                actionTasks = typeof activePlan.tasks === 'string'
                    ? JSON.parse(activePlan.tasks)
                    : activePlan.tasks;
            }
        } catch (planError) {
            console.warn('[workbookService] Could not fetch active plan:', planError);
        }

        // Fetch profile for user name
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', userId)
            .single();

        return {
            financialTarget: visionProfile?.financial_target,
            financialTargetLabel: visionProfile?.financial_target_label,
            visionText: visionProfile?.vision_text,
            habits: habits || [],
            actionTasks: actionTasks || [],
            userName: profile?.full_name || profile?.email?.split('@')[0],
            theme: (visionProfile?.domain_selection as ThemePack) || 'executive',
        };
    } catch (error) {
        console.error('[workbookService] Error fetching user data:', error);
        return { habits: [], actionTasks: [] };
    }
}

export async function regeneratePage(page: WorkbookPage): Promise<WorkbookPage> {
    // re-run AI pipeline for a single page
    // For now, just return the page as is or simulate an update
    console.log('Regenerating page', page.id);
    return page;
}
