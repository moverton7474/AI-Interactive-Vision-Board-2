import React from 'react';
import { MonthlyCalendarData, PageLayoutMeta } from '../../../types/workbookTypes';

interface Props {
    data: MonthlyCalendarData;
    layout: PageLayoutMeta;
}

const MonthlyPlannerRenderer: React.FC<Props> = ({ data, layout }) => {
    const { monthLabel, year, weeks } = data;

    // Executive styling constants
    const headerFont = 'font-serif';
    const bodyFont = 'font-sans';
    const primaryColor = '#1E293B'; // Navy 900
    const accentColor = '#D97706'; // Gold 600
    const gridColor = '#E2E8F0'; // Slate 200

    return (
        <div className="w-full h-full flex flex-col p-12" style={{ color: primaryColor }}>
            {/* Header */}
            <div className="flex justify-between items-end mb-8 border-b-2 border-slate-200 pb-4">
                <div>
                    <h1 className={`${headerFont} text-5xl font-bold uppercase tracking-widest`}>
                        {monthLabel}
                    </h1>
                    <span className={`${bodyFont} text-xl text-slate-500 tracking-widest ml-1`}>
                        {year}
                    </span>
                </div>
                <div className="text-right">
                    <p className={`${headerFont} italic text-slate-400 text-sm`}>
                        "Vision without execution is just hallucination."
                    </p>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 flex flex-col border-t border-l border-slate-200">
                {/* Days Header */}
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                        <div key={day} className={`p-2 text-center text-xs font-bold uppercase tracking-wider ${bodyFont} border-r border-slate-200`}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Weeks */}
                <div className="flex-1 flex flex-col">
                    {weeks.map((week, weekIdx) => (
                        <div key={weekIdx} className="flex-1 grid grid-cols-7 border-b border-slate-200">
                            {week.map((day, dayIdx) => (
                                <div
                                    key={day.id || `${weekIdx}-${dayIdx}`}
                                    className="border-r border-slate-200 p-2 relative group hover:bg-slate-50 transition-colors"
                                >
                                    {/* Date Number */}
                                    <span className={`
                                        absolute top-2 right-2 text-sm font-medium
                                        ${day.dateLabel ? 'text-slate-700' : 'text-slate-200'}
                                    `}>
                                        {day.dateLabel}
                                    </span>

                                    {/* Content Area (for user to write) */}
                                    <div className="mt-6 h-full">
                                        {day.notes && (
                                            <p className="text-[10px] leading-tight text-slate-600 font-handwriting">
                                                {day.notes}
                                            </p>
                                        )}
                                        {/* Lines for writing */}
                                        <div className="absolute bottom-2 left-2 right-2 space-y-3 opacity-20 pointer-events-none">
                                            <div className="border-b border-slate-400"></div>
                                            <div className="border-b border-slate-400"></div>
                                            <div className="border-b border-slate-400"></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer / Notes Area */}
            <div className="mt-8 h-32 border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                <h3 className={`${headerFont} text-sm font-bold uppercase tracking-wider mb-2 text-slate-400`}>
                    Monthly Focus & Key Objectives
                </h3>
                <div className="h-full w-full border-b border-slate-200 border-dashed opacity-50" />
            </div>
        </div>
    );
};

export default MonthlyPlannerRenderer;
