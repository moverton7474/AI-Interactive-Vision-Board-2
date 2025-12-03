
import React from 'react';
import { VisionImage, Habit } from '../../types';

export type PageType =
    | 'TITLE'
    | 'DEDICATION'
    | 'VISION'
    | 'CALENDAR'
    | 'HABITS'
    | 'JOURNAL'
    | 'FINANCIAL';

interface Props {
    type: PageType;
    data: any;
    pageNumber: number;
}

const WorkbookPageRenderer: React.FC<Props> = ({ type, data, pageNumber }) => {

    const renderHeader = (title: string) => (
        <div className="mb-8 border-b-2 border-navy-900 pb-2">
            <h2 className="text-2xl font-serif font-bold text-navy-900 uppercase tracking-wide">{title}</h2>
        </div>
    );

    const renderFooter = () => (
        <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end text-xs text-gray-400 font-mono">
            <span>Visionary Planner</span>
            <span>{pageNumber}</span>
        </div>
    );

    const renderContent = () => {
        switch (type) {
            case 'TITLE':
                return (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                        <h1 className="text-5xl font-serif font-bold text-navy-900 mb-6">{data.title}</h1>
                        <p className="text-xl text-gray-500 tracking-widest uppercase mb-12">{data.subtitle}</p>
                        <div className="w-24 h-1 bg-navy-900 mb-12" />
                        <p className="text-sm text-gray-400">Prepared for</p>
                        <p className="text-lg font-bold text-navy-900">{data.name}</p>
                    </div>
                );

            case 'DEDICATION':
                return (
                    <div className="h-full flex flex-col items-center justify-center text-center px-12">
                        <p className="text-2xl font-serif italic text-navy-800 leading-relaxed">
                            "{data.text}"
                        </p>
                    </div>
                );

            case 'VISION':
                return (
                    <div className="h-full flex flex-col">
                        {renderHeader('Vision Board')}
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="w-full aspect-video bg-gray-100 mb-6 overflow-hidden rounded-lg border border-gray-200 shadow-inner">
                                {data.image?.url && <img src={data.image.url} className="w-full h-full object-cover" />}
                            </div>
                            <p className="text-center font-serif italic text-gray-600 max-w-lg">
                                "{data.image?.prompt}"
                            </p>
                        </div>
                        <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-100">
                            <h4 className="font-bold text-navy-900 mb-2 text-sm uppercase">Why this matters</h4>
                            <div className="h-24 border-b border-gray-200" />
                        </div>
                    </div>
                );

            case 'CALENDAR':
                return (
                    <div className="h-full flex flex-col">
                        {renderHeader(data.month || 'Monthly Plan')}
                        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-gray-500 uppercase">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                        </div>
                        <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-1">
                            {Array.from({ length: 35 }).map((_, i) => (
                                <div key={i} className="border border-gray-200 p-1 relative">
                                    <span className="text-[10px] text-gray-400 absolute top-1 left-1">{i + 1}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 grid grid-cols-2 gap-4 h-32">
                            <div className="border border-gray-200 p-2 rounded">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Top Goals</h4>
                                <div className="space-y-2">
                                    {[1, 2, 3].map(i => <div key={i} className="h-6 border-b border-gray-100" />)}
                                </div>
                            </div>
                            <div className="border border-gray-200 p-2 rounded">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Notes</h4>
                                <div className="space-y-2">
                                    {[1, 2, 3].map(i => <div key={i} className="h-6 border-b border-gray-100" />)}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'HABITS':
                return (
                    <div className="h-full flex flex-col">
                        {renderHeader('Habit Tracker')}
                        <div className="space-y-6">
                            {(data.habits || []).map((habit: Habit, idx: number) => (
                                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-bold text-navy-900">{habit.title}</span>
                                        <span className="text-xs text-gray-500">{habit.frequency}</span>
                                    </div>
                                    <div className="grid grid-cols-31 gap-px bg-gray-200">
                                        {Array.from({ length: 31 }).map((_, d) => (
                                            <div key={d} className="bg-white h-6 w-full" />
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {(!data.habits || data.habits.length === 0) && (
                                <p className="text-gray-400 text-center italic">No habits selected.</p>
                            )}
                        </div>
                    </div>
                );

            case 'JOURNAL':
                return (
                    <div className="h-full flex flex-col">
                        {renderHeader('Weekly Reflection')}
                        <div className="mb-8">
                            <p className="font-serif italic text-navy-800 text-lg mb-4">
                                "{data.prompt || 'What was your biggest win this week?'}"
                            </p>
                            <div className="space-y-3">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} className="border-b border-gray-200 h-8" />
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <h4 className="font-bold text-navy-900 mb-2">Gratitude</h4>
                                <div className="space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="border-b border-gray-200 h-8" />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-bold text-navy-900 mb-2">Next Week's Focus</h4>
                                <div className="space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="border-b border-gray-200 h-8" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return <div>Unknown Page Type</div>;
        }
    };

    return (
        <div className="w-full h-full bg-white p-12 relative shadow-sm text-left">
            {renderContent()}
            {renderFooter()}
        </div>
    );
};

export default WorkbookPageRenderer;
