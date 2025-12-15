/**
 * WORKBOOK V2: Service Tests
 *
 * Tests for workbookService.ts to verify:
 * - buildInitialWorkbookPages correctly includes selected vision boards
 * - Page generation uses the provided visionBoardImages
 * - Cover theme is applied correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies - return a fresh page object for each call
vi.mock('../../services/workbook/workbookLayoutService', () => ({
    generatePage: vi.fn().mockImplementation((context) => {
        return Promise.resolve({
            id: `mock-page-${Math.random().toString(36).substr(2, 9)}`,
            type: context?.type || 'GENERIC',
            edition: context?.edition || 'EXECUTIVE_VISION_BOOK',
            pageNumber: 1,
            layout: {
                trimSize: context?.trimSize || 'TRADE_6x9',
                widthPx: 1800,
                heightPx: 2700,
                bleedPx: 37.5,
                safeMarginPx: 150,
                dpi: 300
            },
            textBlocks: [],
            imageBlocks: [],
            isVisible: true
        });
    })
}));

// Import after mocking
import { buildInitialWorkbookPages, BuildOptions, CoverThemeId } from '../../services/workbook/workbookService';
import { VisionImage, Habit } from '../../types';
import { generatePage } from '../../services/workbook/workbookLayoutService';

describe('workbookService', () => {
    // Reset mocks before each test
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-setup the mock implementation
        (generatePage as any).mockImplementation((context: any) => {
            return Promise.resolve({
                id: `mock-page-${Math.random().toString(36).substr(2, 9)}`,
                type: context?.type || 'GENERIC',
                edition: context?.edition || 'EXECUTIVE_VISION_BOOK',
                pageNumber: 1,
                layout: {
                    trimSize: context?.trimSize || 'TRADE_6x9',
                    widthPx: 1800,
                    heightPx: 2700,
                    bleedPx: 37.5,
                    safeMarginPx: 150,
                    dpi: 300
                },
                textBlocks: [],
                imageBlocks: [],
                isVisible: true
            });
        });
    });
    // Mock data
    const mockVisionImages: VisionImage[] = [
        {
            id: 'vision-1',
            user_id: 'test-user',
            url: 'https://example.com/vision1.jpg',
            prompt: 'Beach house in retirement',
            created_at: '2024-01-01T00:00:00Z'
        },
        {
            id: 'vision-2',
            user_id: 'test-user',
            url: 'https://example.com/vision2.jpg',
            prompt: 'Family gathering',
            created_at: '2024-01-02T00:00:00Z'
        },
        {
            id: 'vision-3',
            user_id: 'test-user',
            url: 'https://example.com/vision3.jpg',
            prompt: 'Dream car',
            created_at: '2024-01-03T00:00:00Z'
        }
    ];

    const mockHabits: Habit[] = [
        {
            id: 'habit-1',
            user_id: 'test-user',
            title: 'Morning meditation',
            description: '10 minutes of mindfulness',
            frequency: 'daily',
            created_at: '2024-01-01T00:00:00Z'
        },
        {
            id: 'habit-2',
            user_id: 'test-user',
            title: 'Read 30 minutes',
            description: 'Read personal development books',
            frequency: 'daily',
            created_at: '2024-01-02T00:00:00Z'
        }
    ];

    describe('buildInitialWorkbookPages', () => {
        it('should include all selected vision boards in VISION_BOARD_SPREAD pages', async () => {
            const options: BuildOptions = {
                edition: 'EXECUTIVE_VISION_BOOK',
                trimSize: 'TRADE_6x9',
                goals: [],
                habits: mockHabits,
                visionBoardImages: mockVisionImages.slice(0, 2), // Select first 2
                includeForeword: true,
                title: 'Test Workbook',
                subtitle: '2025',
                coverTheme: 'executive_dark'
            };

            const pages = await buildInitialWorkbookPages(options);

            // Find all VISION_BOARD_SPREAD pages
            const visionPages = pages.filter(p => p.type === 'VISION_BOARD_SPREAD');

            // Should have exactly 2 vision board pages (one per selected image)
            expect(visionPages).toHaveLength(2);

            // First vision page should contain the first image URL
            const firstVisionPage = visionPages[0];
            expect(firstVisionPage.imageBlocks).toBeDefined();
            expect(firstVisionPage.imageBlocks?.length).toBeGreaterThan(0);
            expect(firstVisionPage.imageBlocks?.[0].url).toBe('https://example.com/vision1.jpg');

            // Second vision page should contain the second image URL
            const secondVisionPage = visionPages[1];
            expect(secondVisionPage.imageBlocks?.[0].url).toBe('https://example.com/vision2.jpg');
        });

        it('should respect the 4-board maximum limit', async () => {
            // Create 5 mock images
            const fiveImages: VisionImage[] = [
                ...mockVisionImages,
                {
                    id: 'vision-4',
                    user_id: 'test-user',
                    url: 'https://example.com/vision4.jpg',
                    prompt: 'Image 4',
                    created_at: '2024-01-04T00:00:00Z'
                },
                {
                    id: 'vision-5',
                    user_id: 'test-user',
                    url: 'https://example.com/vision5.jpg',
                    prompt: 'Image 5',
                    created_at: '2024-01-05T00:00:00Z'
                }
            ];

            const options: BuildOptions = {
                edition: 'EXECUTIVE_VISION_BOOK',
                trimSize: 'TRADE_6x9',
                goals: [],
                habits: [],
                visionBoardImages: fiveImages, // Pass all 5
                includeForeword: false,
                title: 'Test',
                subtitle: '2025'
            };

            const pages = await buildInitialWorkbookPages(options);
            const visionPages = pages.filter(p => p.type === 'VISION_BOARD_SPREAD');

            // Should only have 4 vision pages (the maximum)
            expect(visionPages.length).toBeLessThanOrEqual(4);
        });

        it('should include COVER_FRONT page with title and subtitle', async () => {
            const options: BuildOptions = {
                edition: 'EXECUTIVE_VISION_BOOK',
                trimSize: 'TRADE_6x9',
                goals: [],
                habits: [],
                visionBoardImages: mockVisionImages.slice(0, 1),
                includeForeword: false,
                title: 'My Custom Title',
                subtitle: 'Year 2025',
                coverTheme: 'executive_dark'
            };

            const pages = await buildInitialWorkbookPages(options);
            const coverPage = pages.find(p => p.type === 'COVER_FRONT');

            expect(coverPage).toBeDefined();
            expect(coverPage?.title).toBe('My Custom Title');
            expect(coverPage?.subtitle).toBe('Year 2025');
        });

        it('should include HABIT_TRACKER page when habits are provided', async () => {
            const options: BuildOptions = {
                edition: 'EXECUTIVE_VISION_BOOK',
                trimSize: 'TRADE_6x9',
                goals: [],
                habits: mockHabits,
                visionBoardImages: mockVisionImages.slice(0, 1),
                includeForeword: false
            };

            const pages = await buildInitialWorkbookPages(options);
            const habitPage = pages.find(p => p.type === 'HABIT_TRACKER');

            expect(habitPage).toBeDefined();
            expect(habitPage?.habitTracker?.habits).toHaveLength(2);
            expect(habitPage?.habitTracker?.habits?.[0].name).toBe('Morning meditation');
        });

        it('should use vision board as cover when coverTheme is use_vision_board_cover', async () => {
            const options: BuildOptions = {
                edition: 'EXECUTIVE_VISION_BOOK',
                trimSize: 'TRADE_6x9',
                goals: [],
                habits: [],
                visionBoardImages: mockVisionImages.slice(0, 1),
                includeForeword: false,
                coverTheme: 'use_vision_board_cover'
            };

            const pages = await buildInitialWorkbookPages(options);
            const coverPage = pages.find(p => p.type === 'COVER_FRONT');

            expect(coverPage).toBeDefined();
            expect(coverPage?.imageBlocks).toBeDefined();
            expect(coverPage?.imageBlocks?.length).toBeGreaterThan(0);
            expect(coverPage?.imageBlocks?.[0].url).toBe('https://example.com/vision1.jpg');
        });

        it('should include all standard page types', async () => {
            const options: BuildOptions = {
                edition: 'EXECUTIVE_VISION_BOOK',
                trimSize: 'TRADE_6x9',
                goals: [],
                habits: mockHabits,
                visionBoardImages: mockVisionImages.slice(0, 1),
                includeForeword: true
            };

            const pages = await buildInitialWorkbookPages(options);
            const pageTypes = pages.map(p => p.type);

            // Check for expected page types
            expect(pageTypes).toContain('COVER_FRONT');
            expect(pageTypes).toContain('TITLE_PAGE');
            expect(pageTypes).toContain('VISION_BOARD_SPREAD');
            expect(pageTypes).toContain('GOAL_OVERVIEW');
            expect(pageTypes).toContain('HABIT_TRACKER');
        });
    });
});
