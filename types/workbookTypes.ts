import React from 'react';

export type WorkbookEdition =
    | 'SOFTCOVER_JOURNAL'
    | 'HARDCOVER_PLANNER'
    | 'EXECUTIVE_VISION_BOOK'
    | 'LEGACY_EDITION';

// Extended product types including Execution Toolkit items
export type WorkbookProductType =
    | 'SOFTCOVER_JOURNAL'
    | 'HARDCOVER_PLANNER'
    | 'EXECUTIVE_VISION_BOOK'
    | 'LEGACY_EDITION'
    | 'DAILY_PAD_A5'      // Execution Toolkit: Tear-off focus pad
    | 'HABIT_CARDS';       // Execution Toolkit: 3x5 cue cards

export type WorkbookTrimSize =
    | 'LETTER_8_5x11'
    | 'A4_8_27x11_69'
    | 'A5_5_83x8_27'
    | 'TRADE_6x9'
    | 'CARD_3x5'          // For habit cue cards
    | 'EXECUTIVE_7x9';    // For executive planners

// Theme pack for AI content generation
export type ThemePack = 'faith' | 'executive' | 'retirement' | 'health' | 'entrepreneur' | 'relationship';

// Binding types for print specifications
export type BindingType = 'SOFTCOVER' | 'HARDCOVER' | 'SPIRAL' | 'PAD' | 'CARDS';

export type WorkbookPageType =
    | 'COVER_FRONT'
    | 'COVER_BACK'
    | 'COVER_SPINE'
    | 'TITLE_PAGE'
    | 'DEDICATION'
    | 'SECTION_DIVIDER'
    | 'VISION_BOARD_SPREAD'
    | 'GOAL_OVERVIEW'
    | 'ROADMAP_YEAR'
    | 'ROADMAP_QUARTER'
    | 'MONTHLY_PLANNER'
    | 'WEEKLY_PLANNER'
    | 'HABIT_TRACKER'
    | 'FINANCIAL_OVERVIEW'
    | 'QUOTE_PAGE'
    | 'REFLECTION_WEEK'
    | 'REFLECTION_MONTH'
    | 'NOTES_LINED'
    | 'NOTES_DOTGRID'
    | 'CUSTOM';

export interface PageLayoutMeta {
    trimSize: WorkbookTrimSize;
    widthPx: number;
    heightPx: number;
    bleedPx?: number;               // DEPRECATED: Prodigi adds bleed automatically
    safeMarginPx: number;           // 10mm = ~118px at 300 DPI
    spiralEdgeMarginPx?: number;    // 12mm for spiral notebooks
    bindingType?: BindingType;      // Type of binding for margin calculations
    dpi: number;
}

export interface TextBlock {
    id: string;
    role: 'TITLE' | 'SUBTITLE' | 'BODY' | 'QUOTE' | 'CAPTION' | 'LABEL' | 'SCRIPTURE' | 'AFFIRMATION';
    content: string;
    align?: 'left' | 'center' | 'right' | 'justify';
    emphasis?: 'normal' | 'bold' | 'italic' | 'highlight';
    position?: { x: number; y: number; w?: number }; // % coordinates
    style?: React.CSSProperties;
}

export interface ImageBlock {
    id: string;
    sourceType: 'VISION_IMAGE' | 'AI_GENERATED' | 'UPLOAD' | 'PLACEHOLDER';
    url: string;
    alt: string;
    layout: 'FULL_BLEED' | 'HALF_TOP' | 'HALF_BOTTOM' | 'LEFT_THIRD' | 'RIGHT_THIRD' | 'BACKGROUND';
    aiPrompt?: string;
    aiModel?: string;
    seed?: string | number;
    position?: { x: number; y: number; w: number; h: number }; // % coordinates
    style?: React.CSSProperties;
}

export interface MonthlyCalendarData {
    year: number;
    monthIndex: number;
    monthLabel: string;
    weeks: { id: string; dateLabel: string; notes?: string }[][];
}

export interface WeeklyPlannerData {
    weekOf: string;
    days: { isoDate: string; label: string; sections?: string[] }[];
}

export interface HabitTrackerData {
    habits: { id: string; name: string; description?: string }[];
    period: 'MONTH' | 'QUARTER' | 'YEAR';
}

export interface GoalItem {
    id: string;
    category: 'FINANCIAL' | 'HEALTH' | 'CAREER' | 'FAMILY' | 'LIFESTYLE' | 'SPIRITUAL' | 'OTHER';
    label: string;
    timeframe: 'YEAR1' | 'YEAR2' | 'YEAR3' | 'SHORT_TERM' | 'LONG_TERM';
    status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface RoadmapData {
    year: number;
    quarter?: 1 | 2 | 3 | 4;
    summary: string;
    goals: GoalItem[];
    keyMilestones: string[];
}

export interface ReflectionPrompt {
    id: string;
    question: string;
    helperText?: string;
}

export interface WorkbookPage {
    id: string;
    edition: WorkbookEdition;
    type: WorkbookPageType; // Mapped to 'pageType' in prompt, keeping 'type' for compatibility if needed, or alias
    pageNumber: number;
    spreadId?: string;
    layout: PageLayoutMeta;
    title?: string;
    subtitle?: string;
    textBlocks: TextBlock[]; // Made required to match existing usage or initialize empty
    imageBlocks: ImageBlock[]; // Made required to match existing usage or initialize empty
    monthlyData?: MonthlyCalendarData;
    weeklyData?: WeeklyPlannerData;
    habitTracker?: HabitTrackerData;
    roadmap?: RoadmapData;
    reflectionPrompts?: ReflectionPrompt[];
    aiContext?: {
        visionBoardIds?: string[];
        habitIds?: string[];
        goalThemeTags?: string[];
        sourceVisionPrompt?: string;
    };
    aiGeneration?: {
        model: string;
        temperature: number;
        lastGeneratedAt: string;
        version: number;
    };
    isVisible: boolean;
    isLocked?: boolean;
    customOrder?: number;
}

// ============================================
// AI Content Generation Types (v2.1)
// ============================================

/**
 * Context for AI content generation (Ghostwriter features)
 * Used to generate personalized forewords, prompts, and reflections
 */
export interface AIContentContext {
    theme: ThemePack;
    financialTarget?: number;
    financialTargetLabel?: string;
    goals: string[];
    habits: string[];
    visionText?: string;
    userName?: string;
}

/**
 * AI-generated content stored in workbook_orders.ai_content JSONB
 */
export interface AIGeneratedContent {
    foreword?: string;
    forewordGeneratedAt?: string;
    themePrompts?: Record<string, string[]>;
    reflectionPrompts?: string[];
    coachLetter?: string;
    fallbackUsed?: boolean;
}

/**
 * Print validation result for pre-flight checks
 * Stored in workbook_orders.print_validation JSONB
 */
export interface PrintValidationResult {
    status: 'pending' | 'valid' | 'invalid';
    errors: string[];
    warnings: string[];
    validatedAt?: string;
    imageResolutions?: Array<{
        url: string;
        dpi: number;
        isValid: boolean;
    }>;
    pageCount?: {
        current: number;
        min: number;
        max: number;
        isEven: boolean;
    };
}

/**
 * Print specifications stored in workbook_templates.print_specs JSONB
 */
export interface PrintSpecs {
    dpi: number;
    color_mode: 'RGB' | 'CMYK';
    bleed_mm: number;
    safety_margin_mm: number;
    min_pages?: number;
    max_pages?: number;
}
