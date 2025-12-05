import React, { useState, useEffect } from 'react';
import { WorkbookPage } from '../../types/workbookTypes';
import WorkbookPageRenderer from './WorkbookPageRenderer';
import { ChevronLeftIcon, ChevronRightIcon } from '../Icons';

interface Props {
    pages: WorkbookPage[];
}

const WorkbookPreview: React.FC<Props> = ({ pages }) => {
    // Spread index 0 = Cover (Page 1)
    // Spread index 1 = Pages 2 & 3
    // Spread index 2 = Pages 4 & 5
    const [currentSpread, setCurrentSpread] = useState(0);

    if (!pages || pages.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500">Generating preview...</div>;
    }

    // Calculate total spreads: Cover (1) + (Total - 1) / 2
    const totalSpreads = Math.ceil((pages.length + 1) / 2);

    const getPagesForSpread = (spreadIdx: number) => {
        if (spreadIdx === 0) {
            return { left: null, right: pages[0] }; // Cover is usually on the right in a book structure, or centered. Let's do centered for cover.
        }
        const startIndex = 1 + (spreadIdx - 1) * 2;
        return {
            left: pages[startIndex] || null,
            right: pages[startIndex + 1] || null
        };
    };

    const { left, right } = getPagesForSpread(currentSpread);
    const isCover = currentSpread === 0;

    return (
        <div className="flex h-full bg-slate-200 relative overflow-hidden">
            {/* Background Texture/Context */}
            <div className="absolute inset-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at center, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
            />

            {/* Main Preview Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 z-10">

                {/* Book Container */}
                <div className={`
                    relative transition-all duration-500 ease-in-out flex shadow-2xl
                    ${isCover ? 'w-[400px] md:w-[500px]' : 'w-[800px] md:w-[1000px]'}
                    aspect-[${isCover ? '7/9' : '14/9'}]
                `}>

                    {/* Left Page (Back of previous or left side of spread) */}
                    {!isCover && (
                        <div className="flex-1 bg-white relative overflow-hidden rounded-l-lg border-r border-gray-200">
                            {left ? (
                                <WorkbookPageRenderer page={left} />
                            ) : (
                                <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-300">
                                    End of Workbook
                                </div>
                            )}
                            {/* Spine Shadow Left */}
                            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/10 to-transparent pointer-events-none" />
                        </div>
                    )}

                    {/* Right Page (Front of next or right side of spread) */}
                    <div className={`
                        flex-1 bg-white relative overflow-hidden 
                        ${isCover ? 'rounded-r-lg rounded-l-lg shadow-2xl' : 'rounded-r-lg'}
                    `}>
                        {right ? (
                            <WorkbookPageRenderer page={right} />
                        ) : (
                            <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-300">
                                Empty Page
                            </div>
                        )}
                        {/* Spine Shadow Right */}
                        {!isCover && (
                            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                        )}

                        {/* Cover Effect */}
                        {isCover && (
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/20 pointer-events-none" />
                        )}
                    </div>

                </div>

                {/* Navigation Controls */}
                <div className="mt-8 flex items-center gap-6 bg-white/90 backdrop-blur px-8 py-3 rounded-full shadow-xl border border-white/50">
                    <button
                        onClick={() => setCurrentSpread(Math.max(0, currentSpread - 1))}
                        disabled={currentSpread === 0}
                        className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 text-navy-900 transition-colors"
                    >
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>

                    <div className="flex flex-col items-center">
                        <span className="font-serif font-bold text-navy-900 text-lg">
                            {isCover ? 'Cover' : `Spread ${currentSpread} / ${totalSpreads - 1}`}
                        </span>
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                            {isCover ? 'Front' : `Pages ${left?.pageNumber || '-'} & ${right?.pageNumber || '-'}`}
                        </span>
                    </div>

                    <button
                        onClick={() => setCurrentSpread(Math.min(totalSpreads - 1, currentSpread + 1))}
                        disabled={currentSpread === totalSpreads - 1}
                        className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 text-navy-900 transition-colors"
                    >
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                </div>

            </div>
        </div>
    );
};

export default WorkbookPreview;
