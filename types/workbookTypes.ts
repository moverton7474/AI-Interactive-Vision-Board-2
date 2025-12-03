export type WorkbookEdition =
    | 'EXECUTIVE_BLACK'
    | 'COGNAC_LEATHER'
    | 'LEGACY_WRAP'
    | 'STANDARD_CLASSIC';

export type WorkbookTrimSize =
    | '7x9'
    | '6x9'
    | 'A5'
    | 'Letter';

export interface WorkbookPageLayout {
    pxWidth: number;
    pxHeight: number;
    bleed: number;
    margin: number;
    grid?: any;
}

export type WorkbookPageType =
    | 'COVER'
    | 'TITLE_PAGE'
    | 'DEDICATION'
    | 'VISION_BOARD'
    | 'GOAL_OVERVIEW'
    | 'MONTHLY_PLANNER'
    | 'WEEKLY_PLANNER'
    | 'REFLECTION'
    | 'NOTES'
    | 'SECTION_DIVIDER';

export interface WorkbookTextBlock {
    id: string;
    role: 'title' | 'subtitle' | 'body' | 'label' | 'quote' | 'question';
    content: string;
    position?: { x: number; y: number };
    style?: React.CSSProperties;
}

export interface WorkbookImageBlock {
    id: string;
    prompt: string;
    url?: string;
    position?: { x: number; y: number; w: number; h: number };
    style?: React.CSSProperties;
}

export interface WorkbookPage {
    id: string;
    type: WorkbookPageType;
    layout: WorkbookPageLayout;
    textBlocks: WorkbookTextBlock[];
    imageBlocks: WorkbookImageBlock[];
    aiContext?: any;
    isVisible: boolean;
}
