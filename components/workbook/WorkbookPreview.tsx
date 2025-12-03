import React, { useState, useEffect } from 'react';
import { WorkbookPage } from '../../types/workbookTypes';
import WorkbookPageRenderer from './WorkbookPageRenderer';

interface Props {
    pages: WorkbookPage[];
}

const WorkbookPreview: React.FC<Props> = ({ pages }) => {
    const [currentPage, setCurrentPage] = useState(0);

    if (!pages || pages.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500">Generating preview...</div>;
    }

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
                            <div className="aspect-[7/9] bg-white border border-gray-200 shadow-sm mb-1 relative overflow-hidden">
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
                <div className="bg-white shadow-2xl w-full max-w-[600px] aspect-[7/9] relative transition-all duration-300 transform">
                    {pages[currentPage] && (
                        <WorkbookPageRenderer page={pages[currentPage]} />
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
