/**
 * WORKBOOK V2: Cover Theme Configuration
 *
 * Defines available cover themes for the Executive Vision Workbook.
 * Each theme includes colors, fonts, and layout hints used by both
 * the preview renderer and PDF generator.
 */

import { CoverThemeId } from './workbookService';

export interface CoverTheme {
    id: CoverThemeId;
    name: string;
    description: string;
    colors: {
        background: string;
        backgroundGradient?: string;
        titleColor: string;
        subtitleColor: string;
        accentColor: string;
    };
    fonts: {
        titleFamily: 'serif' | 'sans-serif';
        titleWeight: 'normal' | 'bold';
        subtitleFamily: 'serif' | 'sans-serif';
    };
    layout: {
        titlePosition: 'center' | 'top' | 'bottom';
        useOverlay: boolean;
        overlayOpacity: number;
    };
    preview: {
        thumbnailBg: string;
        borderColor: string;
    };
}

export const COVER_THEMES: Record<CoverThemeId, CoverTheme> = {
    executive_dark: {
        id: 'executive_dark',
        name: 'Executive Dark',
        description: 'Premium matte black with gold foil accents',
        colors: {
            background: '#1E243C',
            backgroundGradient: 'linear-gradient(145deg, #1E243C 0%, #0F1219 100%)',
            titleColor: '#FFFFFF',
            subtitleColor: '#D97706',
            accentColor: '#D97706'
        },
        fonts: {
            titleFamily: 'serif',
            titleWeight: 'bold',
            subtitleFamily: 'sans-serif'
        },
        layout: {
            titlePosition: 'center',
            useOverlay: false,
            overlayOpacity: 0
        },
        preview: {
            thumbnailBg: 'bg-gradient-to-br from-slate-900 to-slate-800',
            borderColor: 'border-amber-500'
        }
    },

    faith_purpose: {
        id: 'faith_purpose',
        name: 'Faith & Purpose',
        description: 'Warm ivory with burgundy and gold accents',
        colors: {
            background: '#FDF5E6',
            backgroundGradient: 'linear-gradient(145deg, #FDF5E6 0%, #F5E6D3 100%)',
            titleColor: '#722F37',
            subtitleColor: '#8B7355',
            accentColor: '#C5A572'
        },
        fonts: {
            titleFamily: 'serif',
            titleWeight: 'bold',
            subtitleFamily: 'serif'
        },
        layout: {
            titlePosition: 'center',
            useOverlay: false,
            overlayOpacity: 0
        },
        preview: {
            thumbnailBg: 'bg-gradient-to-br from-amber-50 to-orange-50',
            borderColor: 'border-red-900'
        }
    },

    tropical_retirement: {
        id: 'tropical_retirement',
        name: 'Tropical Retirement',
        description: 'Ocean blue with sunset coral highlights',
        colors: {
            background: '#0369A1',
            backgroundGradient: 'linear-gradient(145deg, #0369A1 0%, #075985 50%, #0C4A6E 100%)',
            titleColor: '#FFFFFF',
            subtitleColor: '#FCD34D',
            accentColor: '#F97316'
        },
        fonts: {
            titleFamily: 'sans-serif',
            titleWeight: 'bold',
            subtitleFamily: 'sans-serif'
        },
        layout: {
            titlePosition: 'center',
            useOverlay: false,
            overlayOpacity: 0
        },
        preview: {
            thumbnailBg: 'bg-gradient-to-br from-sky-600 to-cyan-700',
            borderColor: 'border-amber-400'
        }
    },

    minimal_white_gold: {
        id: 'minimal_white_gold',
        name: 'Minimal White & Gold',
        description: 'Clean white with elegant gold typography',
        colors: {
            background: '#FFFFFF',
            backgroundGradient: 'linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%)',
            titleColor: '#1E293B',
            subtitleColor: '#B8860B',
            accentColor: '#D4AF37'
        },
        fonts: {
            titleFamily: 'serif',
            titleWeight: 'normal',
            subtitleFamily: 'sans-serif'
        },
        layout: {
            titlePosition: 'center',
            useOverlay: false,
            overlayOpacity: 0
        },
        preview: {
            thumbnailBg: 'bg-gradient-to-br from-white to-slate-100',
            borderColor: 'border-amber-500'
        }
    },

    use_vision_board_cover: {
        id: 'use_vision_board_cover',
        name: 'Vision Board Cover',
        description: 'Use your first vision board as the cover background',
        colors: {
            background: '#000000',
            titleColor: '#FFFFFF',
            subtitleColor: '#FFFFFF',
            accentColor: '#D97706'
        },
        fonts: {
            titleFamily: 'serif',
            titleWeight: 'bold',
            subtitleFamily: 'sans-serif'
        },
        layout: {
            titlePosition: 'center',
            useOverlay: true,
            overlayOpacity: 0.4
        },
        preview: {
            thumbnailBg: 'bg-gradient-to-br from-purple-600 to-pink-500',
            borderColor: 'border-white'
        }
    }
};

/**
 * Get a cover theme by ID
 */
export function getCoverTheme(themeId: CoverThemeId): CoverTheme {
    return COVER_THEMES[themeId] || COVER_THEMES.executive_dark;
}

/**
 * Get all available cover themes as an array
 */
export function getAllCoverThemes(): CoverTheme[] {
    return Object.values(COVER_THEMES);
}

/**
 * Get CSS styles for a cover theme (for preview rendering)
 */
export function getCoverThemeStyles(themeId: CoverThemeId): React.CSSProperties {
    const theme = getCoverTheme(themeId);

    return {
        background: theme.colors.backgroundGradient || theme.colors.background,
        color: theme.colors.titleColor
    };
}
