
import React, { useState, useEffect } from 'react';
import { WorkbookTemplate, VisionImage, Habit } from '../../types';
import WorkbookPageRenderer, { PageType } from './WorkbookPageRenderer';
import { ArrowPathIcon } from '../Icons';

interface Props {
    template: WorkbookTemplate;
    title: string;
    visionBoards: VisionImage[];
    habits: Habit[];
    config: {
        includeCalendar: boolean;
        includeHabits: boolean;
        includeJournal: boolean;
        includeFinancial: boolean;
    };
}

interface Page {
    id: string;
    type: PageType;
    data: any;
}

const WorkbookPreview: React.FC<Props> = ({
    template,
    title,
    visionBoards,
    habits,
    config
}) => {
    const [pages, setPages] = useState<Page[]>([]);
    const [currentPage, setCurrentPage] = useState(0);

    useEffect(() => {
        generatePages();
    }, [template, title, visionBoards, habits, config]);

    const generatePages = () => {
        const newPages: Page[] = [];
        let idCounter = 0;
        const getId = () => `page-${idCounter++}`;

        // 1. Title Page
        newPages.push({
            id: getId(),
            type: 'TITLE',
            data: { title, subtitle: new Date().getFullYear().toString(), name: 'Visionary User' } // TODO: Get real user name
        });

        // 2. Dedication
        newPages.push({
            id: getId(),
            type: 'DEDICATION',
            data: { text: "To the future that awaits..." } // TODO: Pass real dedication
        });

        // 3. Vision Boards
        visionBoards.forEach(vision => {
            newPages.push({
                id: getId(),
                type: 'VISION',
                data: { image: vision }
            });
        });

        // 4. Monthly Calendars (12 months)
        if (config.includeCalendar) {
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            months.forEach(month => {
                newPages.push({
                    id: getId(),
                    type: 'CALENDAR',
                    data: { month }
                });

                // Interleave Habits if enabled
                if (config.includeHabits) {
                    newPages.push({
                        id: getId(),
                        type: 'HABITS',
                        data: { habits, month }
                    });
                }
            });
        }

        // 5. Weekly Journal (Sample)
        if (config.includeJournal) {
            // Just showing 4 weeks as sample to avoid huge list in preview
            for (let i = 1; i <= 4; i++) {
                newPages.push({
                    id: getId(),
                    type: 'JOURNAL',
                    data: { week: i, prompt: "What is one small step you took today?" }
                });
            }
        }

        setPages(newPages);
    };

    return (
        <div className="flex h-full bg-gray-200">
            {/* Sidebar / Thumbnails */}
            <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto p-4 hidden md:block">
                <h3 className="font-bold text-gray-500 text-xs uppercase mb-4">Pages ({pages.length})</h3>
                <div className="space-y-4">
                    {pages.map((page, idx) => (
                        <div
                            key={page.id}
                            onClick={() => setCurrentPage(idx)}
                            className={`cursor-pointer transition-all ${currentPage === idx ? 'ring-2 ring-navy-900 scale-105' : 'hover:bg-gray-50'
                                }`}
                        >
                            <div className="aspect-[1/1.414] bg-white border border-gray-200 shadow-sm mb-1 relative overflow-hidden">
                                {/* Mini render - simplified */}
                                <div className="p-2 text-[4px] text-gray-400">
                                    {page.type}
                                </div>
                            </div>
                            <div className="text-center text-xs text-gray-500">
                                Page {idx + 1}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Preview Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden relative">

                {/* Page Container */}
                <div className="bg-white shadow-2xl w-full max-w-[600px] aspect-[1/1.414] relative transition-all duration-300 transform">
                    {pages[currentPage] && (
                        <WorkbookPageRenderer
                            type={pages[currentPage].type}
                            data={pages[currentPage].data}
                            pageNumber={currentPage + 1}
                        />
                    )}
                </div>

                {/* Navigation Controls */}
                <div className="absolute bottom-8 flex items-center gap-4 bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-lg">
                    <button
                        onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                        disabled={currentPage === 0}
                        className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"
                    >
                        ←
                    </button>
                    <span className="font-mono font-bold text-navy-900">
                        {currentPage + 1} / {pages.length}
                    </span>
                    <button
                        onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))}
                        disabled={currentPage === pages.length - 1}
                        className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"
                    >
                        →
                    </button>
                </div>

            </div>
        </div>
    );
};

export default WorkbookPreview;
