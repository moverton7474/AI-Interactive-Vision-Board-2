import { WorkbookPage, WorkbookPageType, WorkbookTrimSize, WorkbookEdition } from '../../types/workbookTypes';
import { generateWorkbookPageJson } from '../ai/geminiTextService';

interface GenerateContext {
    type: WorkbookPageType;
    edition: WorkbookEdition;
    trimSize: WorkbookTrimSize;
    goals: string[];
    habits: string[];
}

export async function generatePage(context: GenerateContext): Promise<WorkbookPage> {
    const pageData = await generateWorkbookPageJson(context);
    const layout = fillLayoutMeta(context.trimSize);

    return {
        ...pageData,
        layout,
        isVisible: true,
        id: crypto.randomUUID()
    };
}

function fillLayoutMeta(trimSize: WorkbookTrimSize) {
    // Return dimensions based on trim size
    // 7x9 is standard for many planners
    let width = 2100; // 7 inches * 300 dpi
    let height = 2700; // 9 inches * 300 dpi

    if (trimSize === 'Letter') {
        width = 2550;
        height = 3300;
    } else if (trimSize === 'A5') {
        width = 1748;
        height = 2480;
    }

    return {
        pxWidth: width,
        pxHeight: height,
        bleed: 37.5, // 0.125 inch * 300
        margin: 150, // 0.5 inch * 300
    };
}
