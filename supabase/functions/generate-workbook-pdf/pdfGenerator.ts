/**
 * WORKBOOK V2 PDF Generator
 *
 * Generates real PDF documents from WorkbookPage[] data.
 * Uses pdf-lib for Deno-compatible PDF generation.
 *
 * Supported page types:
 * - COVER_FRONT: Cover with optional background image
 * - TITLE_PAGE: Title and subtitle
 * - VISION_BOARD_SPREAD: Vision board images with captions
 * - MONTHLY_PLANNER: Calendar grid
 * - HABIT_TRACKER: Habit tracking grid
 * - GOAL_OVERVIEW, WEEKLY_PLANNER, REFLECTION_MONTH, NOTES_LINED: Generic layouts
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'https://cdn.skypack.dev/pdf-lib';

// Color palette matching the executive theme
const NAVY = rgb(0.118, 0.141, 0.235);  // #1E243C
const GOLD = rgb(0.851, 0.467, 0.024);  // #D97706
const SLATE = rgb(0.4, 0.4, 0.4);
const WHITE = rgb(1, 1, 1);

export async function generatePdf(pages: any[]): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    console.log(`[PDF Generator] Processing ${pages.length} pages...`);

    for (let i = 0; i < pages.length; i++) {
        const pageData = pages[i];
        const pageType = pageData.type || 'GENERIC';

        // Default to 6x9 inch (Trade) = 432 x 648 points
        const width = 432;
        const height = 648;

        const page = pdfDoc.addPage([width, height]);

        try {
            // Draw Content based on Type
            switch (pageType) {
                case 'COVER_FRONT':
                    await drawCoverPage(pdfDoc, page, pageData, timesRomanFont, helveticaFont, helveticaBold);
                    break;
                case 'TITLE_PAGE':
                    await drawTitlePage(page, pageData, timesRomanFont, helveticaFont);
                    break;
                case 'VISION_BOARD_SPREAD':
                    await drawVisionBoardPage(pdfDoc, page, pageData, timesRomanFont, helveticaFont);
                    break;
                case 'MONTHLY_PLANNER':
                    await drawMonthlyPlanner(page, pageData.monthlyData || pageData, timesRomanFont, helveticaFont, helveticaBold);
                    break;
                case 'HABIT_TRACKER':
                    await drawHabitTracker(page, pageData.habitTracker || pageData, timesRomanFont, helveticaFont);
                    break;
                case 'GOAL_OVERVIEW':
                    await drawGoalOverviewPage(page, pageData, timesRomanFont, helveticaFont);
                    break;
                case 'WEEKLY_PLANNER':
                    await drawWeeklyPlannerPage(page, pageData, timesRomanFont, helveticaFont);
                    break;
                case 'REFLECTION_MONTH':
                    await drawReflectionPage(page, pageData, timesRomanFont, helveticaFont);
                    break;
                case 'NOTES_LINED':
                    await drawNotesPage(page, pageData, timesRomanFont, helveticaFont);
                    break;
                case 'DEDICATION':
                    await drawDedicationPage(page, pageData, timesRomanFont, helveticaFont);
                    break;
                default:
                    await drawGenericPage(page, pageData, timesRomanFont, helveticaFont);
            }
        } catch (e) {
            console.error(`[PDF Generator] Error on page ${i + 1} (${pageType}):`, e);
            // Draw error placeholder
            page.drawText(`Page ${i + 1}: ${pageType}`, {
                x: 36,
                y: height - 50,
                size: 14,
                font: helveticaFont,
                color: SLATE
            });
        }
    }

    console.log(`[PDF Generator] PDF generation complete`);
    return await pdfDoc.save();
}

/**
 * Draw cover page with optional background image
 */
async function drawCoverPage(
    pdfDoc: PDFDocument,
    page: PDFPage,
    data: any,
    serif: PDFFont,
    sans: PDFFont,
    sansBold: PDFFont
) {
    const { width, height } = page.getSize();

    // Draw background color (executive dark theme)
    page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: NAVY
    });

    // If there's a cover image, try to embed it
    if (data.imageBlocks && data.imageBlocks.length > 0) {
        const imageBlock = data.imageBlocks[0];
        if (imageBlock.url) {
            try {
                const imageBytes = await fetchImageBytes(imageBlock.url);
                if (imageBytes) {
                    let image;
                    if (imageBlock.url.toLowerCase().includes('.png')) {
                        image = await pdfDoc.embedPng(imageBytes);
                    } else {
                        image = await pdfDoc.embedJpg(imageBytes);
                    }

                    // Draw image as full bleed background
                    const dims = image.scaleToFit(width, height);
                    page.drawImage(image, {
                        x: (width - dims.width) / 2,
                        y: (height - dims.height) / 2,
                        width: dims.width,
                        height: dims.height,
                        opacity: 0.9
                    });

                    // Add overlay for text readability
                    page.drawRectangle({
                        x: 0,
                        y: 0,
                        width,
                        height,
                        color: rgb(0, 0, 0),
                        opacity: 0.4
                    });
                }
            } catch (e) {
                console.error('[PDF Generator] Failed to embed cover image:', e);
            }
        }
    }

    // Draw title
    const title = data.title || 'My Vision Workbook';
    const titleSize = 28;
    const titleWidth = serif.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
        x: (width - titleWidth) / 2,
        y: height / 2 + 30,
        size: titleSize,
        font: serif,
        color: WHITE
    });

    // Draw subtitle
    const subtitle = data.subtitle || new Date().getFullYear().toString();
    const subtitleSize = 16;
    const subtitleWidth = sans.widthOfTextAtSize(subtitle, subtitleSize);
    page.drawText(subtitle, {
        x: (width - subtitleWidth) / 2,
        y: height / 2 - 10,
        size: subtitleSize,
        font: sans,
        color: GOLD
    });
}

/**
 * Draw title page
 */
async function drawTitlePage(page: PDFPage, data: any, serif: PDFFont, sans: PDFFont) {
    const { width, height } = page.getSize();

    // Title
    const title = data.title || 'My Vision Workbook';
    const titleSize = 32;
    const titleWidth = serif.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
        x: (width - titleWidth) / 2,
        y: height - 200,
        size: titleSize,
        font: serif,
        color: NAVY
    });

    // Subtitle
    const subtitle = data.subtitle || '';
    if (subtitle) {
        const subtitleSize = 18;
        const subtitleWidth = sans.widthOfTextAtSize(subtitle, subtitleSize);
        page.drawText(subtitle, {
            x: (width - subtitleWidth) / 2,
            y: height - 240,
            size: subtitleSize,
            font: sans,
            color: SLATE
        });
    }

    // Decorative line
    page.drawLine({
        start: { x: width / 3, y: height - 260 },
        end: { x: 2 * width / 3, y: height - 260 },
        thickness: 2,
        color: GOLD
    });
}

/**
 * Draw vision board page with embedded image
 */
async function drawVisionBoardPage(
    pdfDoc: PDFDocument,
    page: PDFPage,
    data: any,
    serif: PDFFont,
    sans: PDFFont
) {
    const { width, height } = page.getSize();
    const margin = 36;

    // Title
    page.drawText('Vision Board', {
        x: margin,
        y: height - margin - 20,
        size: 20,
        font: serif,
        color: NAVY
    });

    // Try to embed the vision board image
    if (data.imageBlocks && data.imageBlocks.length > 0) {
        const imageBlock = data.imageBlocks[0];
        if (imageBlock.url) {
            try {
                const imageBytes = await fetchImageBytes(imageBlock.url);
                if (imageBytes) {
                    let image;
                    if (imageBlock.url.toLowerCase().includes('.png')) {
                        image = await pdfDoc.embedPng(imageBytes);
                    } else {
                        image = await pdfDoc.embedJpg(imageBytes);
                    }

                    // Calculate dimensions to fit in content area
                    const imageAreaWidth = width - (margin * 2);
                    const imageAreaHeight = height * 0.6;
                    const dims = image.scaleToFit(imageAreaWidth, imageAreaHeight);

                    page.drawImage(image, {
                        x: (width - dims.width) / 2,
                        y: height - margin - 60 - dims.height,
                        width: dims.width,
                        height: dims.height
                    });
                }
            } catch (e) {
                console.error('[PDF Generator] Failed to embed vision board image:', e);
                // Draw placeholder rectangle
                page.drawRectangle({
                    x: margin,
                    y: height - margin - 60 - (height * 0.5),
                    width: width - (margin * 2),
                    height: height * 0.5,
                    borderColor: SLATE,
                    borderWidth: 1
                });
                page.drawText('[Vision Board Image]', {
                    x: width / 2 - 60,
                    y: height / 2,
                    size: 12,
                    font: sans,
                    color: SLATE
                });
            }
        }
    }

    // Caption
    const caption = data.aiContext?.sourceVisionPrompt || data.textBlocks?.[0]?.content || '';
    if (caption) {
        const captionSize = 11;
        // Wrap caption text if needed
        const maxWidth = width - (margin * 2);
        const words = caption.split(' ');
        let line = '';
        let yPos = margin + 80;

        for (const word of words) {
            const testLine = line + (line ? ' ' : '') + word;
            if (sans.widthOfTextAtSize(testLine, captionSize) > maxWidth) {
                page.drawText(line, {
                    x: margin,
                    y: yPos,
                    size: captionSize,
                    font: sans,
                    color: SLATE
                });
                yPos -= 15;
                line = word;
            } else {
                line = testLine;
            }
        }
        if (line) {
            page.drawText(line, {
                x: margin,
                y: yPos,
                size: captionSize,
                font: sans,
                color: SLATE
            });
        }
    }
}

/**
 * Draw goal overview page
 */
async function drawGoalOverviewPage(page: PDFPage, data: any, serif: PDFFont, sans: PDFFont) {
    const { width, height } = page.getSize();
    const margin = 36;

    page.drawText('Annual Goals', {
        x: margin,
        y: height - margin - 24,
        size: 24,
        font: serif,
        color: NAVY
    });

    // Decorative line
    page.drawLine({
        start: { x: margin, y: height - margin - 40 },
        end: { x: width - margin, y: height - margin - 40 },
        thickness: 1,
        color: GOLD
    });

    // Goal lines for writing
    let yPos = height - margin - 80;
    for (let i = 0; i < 10; i++) {
        page.drawLine({
            start: { x: margin + 20, y: yPos },
            end: { x: width - margin, y: yPos },
            thickness: 0.5,
            color: rgb(0.85, 0.85, 0.85)
        });
        page.drawText(`${i + 1}.`, {
            x: margin,
            y: yPos + 2,
            size: 10,
            font: sans,
            color: SLATE
        });
        yPos -= 45;
    }
}

/**
 * Draw weekly planner page
 */
async function drawWeeklyPlannerPage(page: PDFPage, data: any, serif: PDFFont, sans: PDFFont) {
    const { width, height } = page.getSize();
    const margin = 36;

    page.drawText('Weekly Planner', {
        x: margin,
        y: height - margin - 24,
        size: 24,
        font: serif,
        color: NAVY
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let yPos = height - margin - 60;
    const dayHeight = 70;

    for (const day of days) {
        // Day label
        page.drawText(day, {
            x: margin,
            y: yPos,
            size: 11,
            font: sans,
            color: NAVY
        });

        // Box for notes
        page.drawRectangle({
            x: margin + 80,
            y: yPos - dayHeight + 20,
            width: width - margin - 80 - margin,
            height: dayHeight - 5,
            borderColor: rgb(0.9, 0.9, 0.9),
            borderWidth: 0.5
        });

        yPos -= dayHeight;
    }
}

/**
 * Draw reflection page
 */
async function drawReflectionPage(page: PDFPage, data: any, serif: PDFFont, sans: PDFFont) {
    const { width, height } = page.getSize();
    const margin = 36;

    page.drawText('Monthly Reflection', {
        x: margin,
        y: height - margin - 24,
        size: 24,
        font: serif,
        color: NAVY
    });

    const prompts = [
        'Wins this month:',
        'Challenges faced:',
        'Lessons learned:',
        'Focus for next month:'
    ];

    let yPos = height - margin - 80;
    for (const prompt of prompts) {
        page.drawText(prompt, {
            x: margin,
            y: yPos,
            size: 11,
            font: sans,
            color: NAVY
        });

        // Lines for writing
        for (let i = 0; i < 3; i++) {
            yPos -= 25;
            page.drawLine({
                start: { x: margin, y: yPos },
                end: { x: width - margin, y: yPos },
                thickness: 0.5,
                color: rgb(0.85, 0.85, 0.85)
            });
        }
        yPos -= 30;
    }
}

/**
 * Draw notes page with lines
 */
async function drawNotesPage(page: PDFPage, data: any, serif: PDFFont, sans: PDFFont) {
    const { width, height } = page.getSize();
    const margin = 36;

    page.drawText('Notes', {
        x: margin,
        y: height - margin - 24,
        size: 20,
        font: serif,
        color: NAVY
    });

    // Draw lines
    let yPos = height - margin - 60;
    while (yPos > margin + 20) {
        page.drawLine({
            start: { x: margin, y: yPos },
            end: { x: width - margin, y: yPos },
            thickness: 0.5,
            color: rgb(0.9, 0.9, 0.9)
        });
        yPos -= 25;
    }
}

/**
 * Draw dedication page
 */
async function drawDedicationPage(page: PDFPage, data: any, serif: PDFFont, sans: PDFFont) {
    const { width, height } = page.getSize();

    page.drawText('Dedication', {
        x: width / 2 - 40,
        y: height - 150,
        size: 20,
        font: serif,
        color: NAVY
    });

    // Decorative line
    page.drawLine({
        start: { x: width / 3, y: height - 170 },
        end: { x: 2 * width / 3, y: height - 170 },
        thickness: 1,
        color: GOLD
    });

    // Dedication text would go here
    const text = data.textBlocks?.find((b: any) => b.role === 'BODY')?.content || '';
    if (text) {
        page.drawText(text.substring(0, 200), {
            x: 60,
            y: height / 2,
            size: 12,
            font: serif,
            color: SLATE
        });
    }
}

async function drawGenericPage(page: PDFPage, data: any, serif: PDFFont, sans: PDFFont) {
    const { width, height } = page.getSize();

    // Draw Text Blocks
    if (data.textBlocks) {
        for (const block of data.textBlocks) {
            const x = (block.position?.x || 0) / 100 * width;
            const y = height - ((block.position?.y || 0) / 100 * height); // PDF y is bottom-up

            let font = sans;
            let size = 12;
            let color = rgb(0, 0, 0);

            if (block.role === 'TITLE') { font = serif; size = 24; }
            if (block.role === 'SUBTITLE') { size = 14; color = rgb(0.4, 0.4, 0.4); }
            if (block.role === 'QUOTE') { font = serif; size = 16; color = rgb(0.8, 0.6, 0); } // Gold-ish

            try {
                page.drawText(block.content, {
                    x,
                    y,
                    size,
                    font,
                    color,
                });
            } catch (e) {
                console.error('Error drawing text:', e);
            }
        }
    }
}

async function drawMonthlyPlanner(page: PDFPage, data: any, serif: PDFFont, sans: PDFFont, sansBold: PDFFont) {
    const { width, height } = page.getSize();
    const margin = 36; // 0.5 inch

    // Title
    page.drawText(data.monthLabel || 'MONTH', {
        x: margin,
        y: height - margin - 24,
        size: 32,
        font: serif,
        color: rgb(0.1, 0.15, 0.3), // Navy
    });

    page.drawText(String(data.year || ''), {
        x: margin + 150, // Offset
        y: height - margin - 24,
        size: 18,
        font: sans,
        color: rgb(0.5, 0.5, 0.5),
    });

    // Grid
    const gridTop = height - margin - 60;
    const gridBottom = margin + 100; // Leave space for notes
    const gridHeight = gridTop - gridBottom;
    const gridWidth = width - (margin * 2);

    const cols = 7;
    const rows = 5; // Assume 5 weeks for simplicity
    const colWidth = gridWidth / cols;
    const rowHeight = gridHeight / rows;

    // Draw Header
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    for (let i = 0; i < cols; i++) {
        page.drawText(days[i], {
            x: margin + (i * colWidth) + 5,
            y: gridTop + 5,
            size: 8,
            font: sansBold,
            color: rgb(0.3, 0.3, 0.3),
        });
    }

    // Draw Lines
    // Vertical
    for (let i = 0; i <= cols; i++) {
        page.drawLine({
            start: { x: margin + (i * colWidth), y: gridTop },
            end: { x: margin + (i * colWidth), y: gridBottom },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
        });
    }
    // Horizontal
    for (let i = 0; i <= rows; i++) {
        page.drawLine({
            start: { x: margin, y: gridTop - (i * rowHeight) },
            end: { x: width - margin, y: gridTop - (i * rowHeight) },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
        });
    }

    // Fill Dates (Simplified)
    if (data.weeks) {
        data.weeks.forEach((week: any[], weekIdx: number) => {
            if (weekIdx >= rows) return;
            week.forEach((day: any, dayIdx: number) => {
                if (day.dateLabel) {
                    page.drawText(day.dateLabel, {
                        x: margin + (dayIdx * colWidth) + 5,
                        y: gridTop - (weekIdx * rowHeight) - 15,
                        size: 10,
                        font: sans,
                        color: rgb(0.2, 0.2, 0.2),
                    });
                }
            });
        });
    }

    // Notes Section
    page.drawText('MONTHLY FOCUS', {
        x: margin,
        y: gridBottom - 20,
        size: 10,
        font: sansBold,
        color: rgb(0.5, 0.5, 0.5),
    });

    // Dotted lines for notes
    for (let i = 0; i < 3; i++) {
        page.drawLine({
            start: { x: margin, y: gridBottom - 40 - (i * 20) },
            end: { x: width - margin, y: gridBottom - 40 - (i * 20) },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
            // dashArray: [2, 2] // pdf-lib might support this
        });
    }
}

async function drawHabitTracker(page: PDFPage, data: any, serif: PDFFont, sans: PDFFont) {
    const { width, height } = page.getSize();
    const margin = 36;

    page.drawText('HABIT ARCHITECTURE', {
        x: margin,
        y: height - margin - 24,
        size: 24,
        font: serif,
        color: NAVY,
    });

    // Decorative line
    page.drawLine({
        start: { x: margin, y: height - margin - 40 },
        end: { x: width - margin, y: height - margin - 40 },
        thickness: 1,
        color: GOLD
    });

    const startY = height - margin - 80;
    const rowHeight = 30;
    const maxHabits = Math.min((data.habits || []).length, 15);

    if (data.habits) {
        data.habits.slice(0, maxHabits).forEach((habit: any, idx: number) => {
            const y = startY - (idx * rowHeight);

            // Habit Name
            const habitName = habit.name || habit.title || `Habit ${idx + 1}`;
            page.drawText(habitName.substring(0, 30), {
                x: margin,
                y: y,
                size: 10,
                font: sans,
                color: rgb(0, 0, 0),
            });

            // Grid for 31 days
            const gridLeft = margin + 140;
            const dayWidth = 8;

            for (let d = 0; d < 31; d++) {
                page.drawRectangle({
                    x: gridLeft + (d * dayWidth),
                    y: y - 4,
                    width: 7,
                    height: 7,
                    borderColor: rgb(0.85, 0.85, 0.85),
                    borderWidth: 0.5,
                });
            }
        });
    }

    // Day numbers header
    const gridLeft = margin + 140;
    const dayWidth = 8;
    for (let d = 1; d <= 31; d++) {
        if (d % 5 === 1 || d === 31) {
            page.drawText(String(d), {
                x: gridLeft + ((d - 1) * dayWidth),
                y: startY + 15,
                size: 6,
                font: sans,
                color: SLATE
            });
        }
    }
}

/**
 * Fetch image bytes from URL
 * Used to embed vision board images into the PDF
 */
async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
    try {
        console.log(`[PDF Generator] Fetching image: ${url.substring(0, 50)}...`);
        const response = await fetch(url, {
            headers: {
                'Accept': 'image/*'
            }
        });

        if (!response.ok) {
            console.error(`[PDF Generator] Failed to fetch image: ${response.status}`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    } catch (e) {
        console.error(`[PDF Generator] Error fetching image:`, e);
        return null;
    }
}
