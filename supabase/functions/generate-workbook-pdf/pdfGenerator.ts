import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'https://cdn.skypack.dev/pdf-lib';

export async function generatePdf(pages: any[]): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    for (const pageData of pages) {
        // Default to 6x9 inch (Trade) if not specified
        // 6x9 inch = 432 x 648 points (72 dpi)
        // But our layout uses 300dpi pixels. We need to scale.
        // PDF points are 1/72 inch.
        // 6 inch = 432 points.
        // 9 inch = 648 points.

        const width = 432;
        const height = 648;

        const page = pdfDoc.addPage([width, height]);

        // Draw Content based on Type
        if (pageData.type === 'MONTHLY_PLANNER' && pageData.monthlyData) {
            await drawMonthlyPlanner(page, pageData.monthlyData, timesRomanFont, helveticaFont, helveticaBold);
        } else if (pageData.type === 'HABIT_TRACKER' && pageData.habitTracker) {
            await drawHabitTracker(page, pageData.habitTracker, timesRomanFont, helveticaFont);
        } else {
            // Generic Renderer
            await drawGenericPage(page, pageData, timesRomanFont, helveticaFont);
        }
    }

    return await pdfDoc.save();
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
        color: rgb(0.1, 0.15, 0.3),
    });

    const startY = height - margin - 80;
    const rowHeight = 25;

    if (data.habits) {
        data.habits.forEach((habit: any, idx: number) => {
            const y = startY - (idx * rowHeight);

            // Habit Name
            page.drawText(habit.name, {
                x: margin,
                y: y,
                size: 10,
                font: sans,
                color: rgb(0, 0, 0),
            });

            // Grid for 31 days
            const gridLeft = margin + 150;
            const dayWidth = 12;

            for (let d = 0; d < 31; d++) {
                page.drawRectangle({
                    x: gridLeft + (d * dayWidth),
                    y: y - 2,
                    width: 10,
                    height: 10,
                    borderColor: rgb(0.8, 0.8, 0.8),
                    borderWidth: 1,
                });
            }
        });
    }
}
