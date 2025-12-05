import React, { useState } from 'react';
import { WorkbookTheme } from '../types/workbookTypes';
import { getAllThemes, getThemePack } from '../services/themeContentLibrary';

interface WorkbookThemeSelectorProps {
    onContinue: (selectedThemes: WorkbookTheme[]) => void;
    onBack?: () => void;
    initialSelection?: WorkbookTheme[];
}

export const WorkbookThemeSelector: React.FC<WorkbookThemeSelectorProps> = ({
    onContinue,
    onBack,
    initialSelection = []
}) => {
    const [selectedThemes, setSelectedThemes] = useState<WorkbookTheme[]>(initialSelection);
    const allThemes = getAllThemes();

    const toggleTheme = (theme: WorkbookTheme) => {
        if (selectedThemes.includes(theme)) {
            setSelectedThemes(prev => prev.filter(t => t !== theme));
        } else {
            // Limit to 3 themes max for focused workbooks
            if (selectedThemes.length < 3) {
                setSelectedThemes(prev => [...prev, theme]);
            }
        }
    };

    const handleContinue = () => {
        if (selectedThemes.length > 0) {
            onContinue(selectedThemes);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors"
                            >
                                ← Back
                            </button>
                        )}
                        <div className="flex-1" />
                    </div>
                    <h1 className="text-4xl font-serif font-bold text-navy-900 mb-3">
                        Choose Your Focus
                    </h1>
                    <p className="text-lg text-gray-600 max-w-3xl">
                        Select up to 3 themes to personalize your executive planner. Each theme includes
                        specialized pages, AI-generated content, and tracking tools tailored to your goals.
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                        <div className="text-sm font-medium text-gray-500">
                            {selectedThemes.length} of 3 selected
                        </div>
                        <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-gold-500 h-full transition-all duration-300"
                                style={{ width: `${(selectedThemes.length / 3) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Theme Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {allThemes
                        .filter(theme => theme.theme !== 'CUSTOM')
                        .map((themePack) => {
                            const isSelected = selectedThemes.includes(themePack.theme);
                            const isDisabled = !isSelected && selectedThemes.length >= 3;

                            return (
                                <button
                                    key={themePack.id}
                                    onClick={() => !isDisabled && toggleTheme(themePack.theme)}
                                    disabled={isDisabled}
                                    className={`relative p-6 rounded-xl border-2 transition-all duration-300 text-left ${isSelected
                                            ? 'border-navy-900 bg-white shadow-xl scale-105'
                                            : isDisabled
                                                ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg hover:scale-102'
                                        }`}
                                >
                                    {/* Selection Indicator */}
                                    {isSelected && (
                                        <div className="absolute top-4 right-4 w-8 h-8 bg-navy-900 rounded-full flex items-center justify-center">
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}

                                    {/* Theme Icon */}
                                    <div className="text-5xl mb-4">{themePack.icon}</div>

                                    {/* Theme Name */}
                                    <h3 className="text-xl font-bold text-navy-900 mb-2">
                                        {themePack.name}
                                    </h3>

                                    {/* Description */}
                                    <p className="text-sm text-gray-600 mb-4">
                                        {themePack.description}
                                    </p>

                                    {/* Key Metrics Preview */}
                                    <div className="space-y-1">
                                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                            Includes:
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {themePack.recommended_pages.slice(0, 3).map((page, idx) => (
                                                <span
                                                    key={idx}
                                                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                                                >
                                                    {page.replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                            {themePack.recommended_pages.length > 3 && (
                                                <span className="text-xs text-gray-500 px-2 py-1">
                                                    +{themePack.recommended_pages.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Theme Color Bar */}
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl"
                                        style={{ backgroundColor: themePack.primary_color }}
                                    />
                                </button>
                            );
                        })}
                </div>

                {/* Custom Theme Option */}
                <div className="mb-8">
                    <button
                        onClick={() => toggleTheme('CUSTOM')}
                        className={`w-full p-6 rounded-xl border-2 transition-all text-left ${selectedThemes.includes('CUSTOM')
                                ? 'border-navy-900 bg-white shadow-xl'
                                : 'border-dashed border-gray-300 bg-gray-50 hover:bg-white hover:border-gray-400'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="text-4xl">⚙️</div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-navy-900 mb-1">
                                    Custom Theme
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Build your own theme with any combination of planner sections
                                </p>
                            </div>
                            {selectedThemes.includes('CUSTOM') && (
                                <div className="w-6 h-6 bg-navy-900 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                        {selectedThemes.length === 0 && 'Select at least one theme to continue'}
                        {selectedThemes.length === 1 && '1 theme selected'}
                        {selectedThemes.length > 1 && `${selectedThemes.length} themes selected`}
                    </div>
                    <button
                        onClick={handleContinue}
                        disabled={selectedThemes.length === 0}
                        className={`px-8 py-3 rounded-lg font-bold transition-all ${selectedThemes.length > 0
                                ? 'bg-navy-900 text-white hover:bg-navy-800 shadow-lg hover:shadow-xl'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        Continue to Section Selection →
                    </button>
                </div>

                {/* Preview of Selected Themes */}
                {selectedThemes.length > 0 && (
                    <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
                            Your Personalized Planner Will Include:
                        </h4>
                        <div className="space-y-3">
                            {selectedThemes.map(theme => {
                                const pack = getThemePack(theme);
                                return (
                                    <div key={theme} className="flex items-start gap-3">
                                        <div className="text-2xl">{pack.icon}</div>
                                        <div className="flex-1">
                                            <div className="font-medium text-navy-900">{pack.name}</div>
                                            <div className="text-xs text-gray-600">
                                                {pack.recommended_pages.length} specialized pages
                                                {pack.key_metrics.length > 0 && ` · ${pack.key_metrics.length} key metrics`}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkbookThemeSelector;
