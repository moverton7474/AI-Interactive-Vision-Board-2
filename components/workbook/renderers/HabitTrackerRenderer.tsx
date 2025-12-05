import React from 'react';
import { HabitTrackerData, PageLayoutMeta } from '../../../types/workbookTypes';

interface Props {
    data: HabitTrackerData;
    layout: PageLayoutMeta;
}

const HabitTrackerRenderer: React.FC<Props> = ({ data, layout }) => {
    const { habits, period } = data;
    const daysInMonth = 31; // Default to 31 for template
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Executive styling
    const headerFont = 'font-serif';
    const bodyFont = 'font-sans';

    return (
        <div className="w-full h-full flex flex-col p-12 bg-white">
            {/* Header */}
            <div className="mb-10">
                <h1 className={`${headerFont} text-4xl font-bold text-navy-900 mb-2`}>Habit Architecture</h1>
                <p className={`${bodyFont} text-slate-500`}>
                    "We are what we repeatedly do. Excellence, then, is not an act, but a habit."
                </p>
            </div>

            {/* Tracker Grid */}
            <div className="flex-1">
                <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
                    {/* Header Row */}
                    <div className="flex border-b border-slate-200 bg-slate-50">
                        <div className="w-64 p-4 border-r border-slate-200 font-bold text-navy-900 text-sm uppercase tracking-wider">
                            Habit / Routine
                        </div>
                        <div className="flex-1 grid grid-cols-31">
                            {days.map(d => (
                                <div key={d} className="border-r border-slate-100 p-1 text-center text-[10px] text-slate-400 font-medium">
                                    {d}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Habit Rows */}
                    {habits.map((habit, idx) => (
                        <div key={habit.id} className={`flex border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                            <div className="w-64 p-3 border-r border-slate-200 flex flex-col justify-center">
                                <span className="font-medium text-navy-900 text-sm">{habit.name}</span>
                                {habit.description && (
                                    <span className="text-[10px] text-slate-500 truncate">{habit.description}</span>
                                )}
                            </div>
                            <div className="flex-1 grid grid-cols-31">
                                {days.map(d => (
                                    <div key={d} className="border-r border-slate-100 relative group cursor-pointer hover:bg-slate-100 transition-colors">
                                        <div className="absolute inset-1 rounded-full border border-slate-200 opacity-30 group-hover:opacity-100" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Empty Rows to fill space */}
                    {Array.from({ length: Math.max(0, 15 - habits.length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="flex border-b border-slate-100 h-12">
                            <div className="w-64 p-3 border-r border-slate-200"></div>
                            <div className="flex-1 grid grid-cols-31">
                                {days.map(d => (
                                    <div key={d} className="border-r border-slate-100"></div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 grid grid-cols-3 gap-8">
                <div className="p-4 border border-slate-200 rounded bg-slate-50">
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Success Rate</h4>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-navy-900 w-0" />
                    </div>
                </div>
                <div className="p-4 border border-slate-200 rounded bg-slate-50">
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Longest Streak</h4>
                    <span className="text-2xl font-bold text-navy-900">0 <span className="text-xs font-normal text-slate-500">days</span></span>
                </div>
                <div className="p-4 border border-slate-200 rounded bg-slate-50">
                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Reward</h4>
                    <div className="border-b border-slate-300 border-dashed h-6 w-full" />
                </div>
            </div>
        </div>
    );
};

export default HabitTrackerRenderer;
