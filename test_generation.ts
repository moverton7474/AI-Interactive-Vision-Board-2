
import { buildInitialWorkbookPages } from './services/workbook/workbookService.ts';
import { WorkbookPageType } from './types/workbookTypes.ts';

async function testGeneration() {
    console.log("Starting test generation...");
    try {
        const pages = await buildInitialWorkbookPages({
            edition: 'EXECUTIVE_VISION_BOOK',
            trimSize: 'TRADE_6x9',
            goals: ['Financial Freedom', 'Health'],
            habits: ['Meditation', 'Running'],
            visionBoardImages: [],
            includeForeword: true
        });
        console.log(`Generated ${pages.length} pages.`);
        pages.forEach((p, i) => {
            console.log(`Page ${i + 1}: ${p.type} - ${p.id}`);
        });
    } catch (e) {
        console.error("Error during generation:", e);
    }
}

testGeneration();
