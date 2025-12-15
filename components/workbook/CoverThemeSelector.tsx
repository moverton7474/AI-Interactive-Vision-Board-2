/**
 * WORKBOOK V2: Cover Theme Selector
 *
 * Allows users to select a visual theme for their workbook cover.
 * Themes include executive_dark, faith_purpose, tropical_retirement,
 * minimal_white_gold, and use_vision_board_cover.
 */

import React from 'react';
import { CoverThemeId } from '../../services/workbook/workbookService';
import { getAllCoverThemes, CoverTheme } from '../../services/workbook/coverThemes';

interface CoverThemeSelectorProps {
    selectedTheme: CoverThemeId;
    onSelect: (themeId: CoverThemeId) => void;
    visionBoardPreview?: string; // URL of first vision board for preview
}

const CoverThemeSelector: React.FC<CoverThemeSelectorProps> = ({
    selectedTheme,
    onSelect,
    visionBoardPreview
}) => {
    const themes = getAllCoverThemes();

    return (
        <div className="space-y-4">
            <label className="block text-sm font-bold text-navy-900">Cover Theme</label>
            <div className="grid grid-cols-5 gap-3">
                {themes.map((theme) => (
                    <CoverThemeOption
                        key={theme.id}
                        theme={theme}
                        isSelected={selectedTheme === theme.id}
                        onSelect={() => onSelect(theme.id)}
                        visionBoardPreview={
                            theme.id === 'use_vision_board_cover' ? visionBoardPreview : undefined
                        }
                    />
                ))}
            </div>
            <p className="text-xs text-gray-500">
                {themes.find(t => t.id === selectedTheme)?.description}
            </p>
        </div>
    );
};

interface CoverThemeOptionProps {
    theme: CoverTheme;
    isSelected: boolean;
    onSelect: () => void;
    visionBoardPreview?: string;
}

const CoverThemeOption: React.FC<CoverThemeOptionProps> = ({
    theme,
    isSelected,
    onSelect,
    visionBoardPreview
}) => {
    // Build the background style
    const getBackgroundStyle = (): React.CSSProperties => {
        if (theme.id === 'use_vision_board_cover' && visionBoardPreview) {
            return {
                backgroundImage: `url(${visionBoardPreview})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            };
        }
        return {
            background: theme.colors.backgroundGradient || theme.colors.background
        };
    };

    return (
        <button
            onClick={onSelect}
            className={`
                relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all
                ${isSelected
                    ? 'border-gold-500 ring-2 ring-gold-200 scale-105'
                    : 'border-gray-200 hover:border-gray-300 hover:scale-102'
                }
            `}
        >
            {/* Cover Preview */}
            <div
                className="absolute inset-0 flex flex-col items-center justify-center p-2"
                style={getBackgroundStyle()}
            >
                {/* Overlay for vision board cover */}
                {theme.id === 'use_vision_board_cover' && visionBoardPreview && (
                    <div
                        className="absolute inset-0 bg-black"
                        style={{ opacity: theme.layout.overlayOpacity }}
                    />
                )}

                {/* Title preview */}
                <span
                    className="relative z-10 text-[10px] font-bold text-center leading-tight"
                    style={{
                        color: theme.colors.titleColor,
                        fontFamily: theme.fonts.titleFamily
                    }}
                >
                    My Vision
                </span>

                {/* Subtitle preview */}
                <span
                    className="relative z-10 text-[8px] mt-0.5"
                    style={{
                        color: theme.colors.subtitleColor,
                        fontFamily: theme.fonts.subtitleFamily
                    }}
                >
                    2025
                </span>

                {/* Accent line */}
                <div
                    className="relative z-10 w-1/2 h-0.5 mt-1 rounded"
                    style={{ backgroundColor: theme.colors.accentColor }}
                />
            </div>

            {/* Selection indicator */}
            {isSelected && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-gold-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            )}

            {/* Theme name */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] py-0.5 text-center truncate px-1">
                {theme.name}
            </div>
        </button>
    );
};

export default CoverThemeSelector;
