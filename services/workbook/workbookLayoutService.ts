import { WorkbookPage, WorkbookPageType, WorkbookTrimSize, WorkbookEdition, PageLayoutMeta } from '../../types/workbookTypes';
import { generateWorkbookPage } from '../geminiService';

interface GenerateContext {
    type: WorkbookPageType;
    edition: WorkbookEdition;
    trimSize: WorkbookTrimSize;
    goals: string[];
    habits: string[];
}

export async function generatePage(context: GenerateContext): Promise<WorkbookPage> {
    const aiContext = {
        goals: context.goals,
        habits: context.habits
    };

    const pageData = await generateWorkbookPage(
        context.type,
        context.edition,
        context.trimSize,
        aiContext
    );

    const layout = fillLayoutMeta(context.trimSize);

    return {
        ...pageData,
        layout,
        isVisible: true,
        id: crypto.randomUUID(),
        pageNumber: 0 // Will be assigned by the sequence builder
    };
}

function fillLayoutMeta(trimSize: WorkbookTrimSize): PageLayoutMeta {
    const dpi = 300;
    let widthPx = 2100; // 7x9 default
    let heightPx = 2700;

    if (trimSize === 'LETTER_8_5x11') {
        widthPx = 2550;
        heightPx = 3300;
    } else if (trimSize === 'A4_8_27x11_69') {
        widthPx = 2480;
        heightPx = 3508;
    } else if (trimSize === 'A5_5_83x8_27') {
        widthPx = 1748;
        heightPx = 2480;
    } else if (trimSize === 'TRADE_6x9') {
        widthPx = 1800;
        heightPx = 2700;
    }

    return {
        trimSize,
        widthPx,
        heightPx,
        bleedPx: 37.5, // 0.125 inch
        safeMarginPx: 150, // 0.5 inch
        dpi
    };
}
