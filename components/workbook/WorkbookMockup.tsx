/**
 * WORKBOOK V2: 3D Workbook Mockup
 *
 * A CSS-based 3D mockup of the finished workbook.
 * Uses CSS transforms to create a realistic book appearance
 * without complex image compositing.
 */

import React from 'react';
import { CoverThemeId } from '../../services/workbook/workbookService';
import { getCoverTheme } from '../../services/workbook/coverThemes';

interface WorkbookMockupProps {
    title: string;
    subtitle: string;
    coverTheme: CoverThemeId;
    coverImageUrl?: string; // For use_vision_board_cover
    pageCount?: number;
    className?: string;
}

const WorkbookMockup: React.FC<WorkbookMockupProps> = ({
    title,
    subtitle,
    coverTheme,
    coverImageUrl,
    pageCount = 240,
    className = ''
}) => {
    const theme = getCoverTheme(coverTheme);

    // Calculate spine width based on page count (approx 0.1mm per page)
    const spineWidth = Math.max(15, Math.min(30, pageCount * 0.08));

    const getCoverBackground = (): React.CSSProperties => {
        if (coverTheme === 'use_vision_board_cover' && coverImageUrl) {
            return {
                backgroundImage: `url(${coverImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            };
        }
        return {
            background: theme.colors.backgroundGradient || theme.colors.background
        };
    };

    return (
        <div className={`perspective-1000 ${className}`}>
            <div
                className="relative w-64 h-80 mx-auto"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: 'rotateY(-15deg) rotateX(5deg)'
                }}
            >
                {/* Shadow */}
                <div
                    className="absolute inset-0 rounded-lg blur-2xl opacity-40"
                    style={{
                        background: 'rgba(0,0,0,0.5)',
                        transform: 'translateZ(-50px) translateY(20px) translateX(10px)',
                        width: '90%',
                        height: '90%'
                    }}
                />

                {/* Back Cover */}
                <div
                    className="absolute inset-0 rounded-r-sm"
                    style={{
                        ...getCoverBackground(),
                        transform: `translateZ(-${spineWidth}px)`,
                        filter: 'brightness(0.7)'
                    }}
                />

                {/* Spine */}
                <div
                    className="absolute left-0 top-0 bottom-0 rounded-l-sm flex items-center justify-center"
                    style={{
                        width: `${spineWidth}px`,
                        background: theme.colors.backgroundGradient || theme.colors.background,
                        transform: `rotateY(90deg) translateZ(-${spineWidth / 2}px) translateX(-${spineWidth / 2}px)`,
                        transformOrigin: 'left center',
                        filter: 'brightness(0.85)'
                    }}
                >
                    {/* Spine text */}
                    <span
                        className="text-[10px] font-bold tracking-wider whitespace-nowrap"
                        style={{
                            color: theme.colors.titleColor,
                            transform: 'rotate(-90deg)',
                            opacity: 0.9
                        }}
                    >
                        {title.toUpperCase()}
                    </span>
                </div>

                {/* Pages edge */}
                <div
                    className="absolute right-0 top-2 bottom-2"
                    style={{
                        width: `${spineWidth - 5}px`,
                        background: 'linear-gradient(to right, #f5f5f5, #e8e8e8, #f0f0f0)',
                        transform: `rotateY(90deg) translateZ(${256 - spineWidth / 2}px) translateX(-${spineWidth / 2}px)`,
                        transformOrigin: 'left center',
                        borderRadius: '0 2px 2px 0'
                    }}
                >
                    {/* Page lines */}
                    <div className="absolute inset-0 flex flex-col justify-evenly opacity-30">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-px bg-gray-400" />
                        ))}
                    </div>
                </div>

                {/* Front Cover */}
                <div
                    className="absolute inset-0 rounded-lg overflow-hidden flex flex-col items-center justify-center"
                    style={{
                        ...getCoverBackground(),
                        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.1), 0 5px 20px rgba(0,0,0,0.3)'
                    }}
                >
                    {/* Overlay for vision board cover */}
                    {coverTheme === 'use_vision_board_cover' && coverImageUrl && (
                        <div
                            className="absolute inset-0"
                            style={{
                                background: 'rgba(0,0,0,0.4)'
                            }}
                        />
                    )}

                    {/* Title */}
                    <h2
                        className="relative z-10 text-2xl font-bold text-center px-6 mb-2"
                        style={{
                            color: theme.colors.titleColor,
                            fontFamily: theme.fonts.titleFamily === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif',
                            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        {title}
                    </h2>

                    {/* Accent line */}
                    <div
                        className="relative z-10 w-16 h-0.5 rounded my-2"
                        style={{ backgroundColor: theme.colors.accentColor }}
                    />

                    {/* Subtitle */}
                    <p
                        className="relative z-10 text-sm tracking-widest"
                        style={{
                            color: theme.colors.subtitleColor,
                            fontFamily: theme.fonts.subtitleFamily === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif'
                        }}
                    >
                        {subtitle}
                    </p>

                    {/* Gold foil emboss effect */}
                    <div
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-6 rounded flex items-center justify-center"
                        style={{
                            background: `linear-gradient(145deg, ${theme.colors.accentColor}40, ${theme.colors.accentColor}20)`,
                            border: `1px solid ${theme.colors.accentColor}60`
                        }}
                    >
                        <span
                            className="text-[8px] font-bold tracking-wider"
                            style={{ color: theme.colors.accentColor }}
                        >
                            EXECUTIVE
                        </span>
                    </div>

                    {/* Cover texture overlay */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-10"
                        style={{
                            background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")'
                        }}
                    />
                </div>

                {/* Highlight on edge */}
                <div
                    className="absolute top-0 left-0 right-0 h-px bg-white/20"
                    style={{ borderRadius: '8px 8px 0 0' }}
                />
            </div>
        </div>
    );
};

/**
 * Simple version for smaller displays
 */
export const WorkbookMockupSimple: React.FC<{
    title: string;
    subtitle: string;
    coverTheme: CoverThemeId;
    coverImageUrl?: string;
}> = ({ title, subtitle, coverTheme, coverImageUrl }) => {
    const theme = getCoverTheme(coverTheme);

    const getCoverBackground = (): React.CSSProperties => {
        if (coverTheme === 'use_vision_board_cover' && coverImageUrl) {
            return {
                backgroundImage: `url(${coverImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            };
        }
        return {
            background: theme.colors.backgroundGradient || theme.colors.background
        };
    };

    return (
        <div
            className="w-40 h-52 rounded-lg shadow-xl flex flex-col items-center justify-center relative overflow-hidden"
            style={{
                ...getCoverBackground(),
                transform: 'rotateY(-10deg)',
                boxShadow: '5px 5px 20px rgba(0,0,0,0.3), -2px -2px 10px rgba(255,255,255,0.1)'
            }}
        >
            {coverTheme === 'use_vision_board_cover' && coverImageUrl && (
                <div className="absolute inset-0 bg-black/40" />
            )}

            <h3
                className="relative z-10 text-sm font-bold text-center px-4"
                style={{ color: theme.colors.titleColor }}
            >
                {title}
            </h3>
            <div
                className="relative z-10 w-8 h-0.5 my-1 rounded"
                style={{ backgroundColor: theme.colors.accentColor }}
            />
            <p
                className="relative z-10 text-xs"
                style={{ color: theme.colors.subtitleColor }}
            >
                {subtitle}
            </p>
        </div>
    );
};

export default WorkbookMockup;
