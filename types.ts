
export enum AppView {
  LANDING = 'LANDING',
  DISCOVERY = 'DISCOVERY', // Chat/Voice
  FINANCIAL = 'FINANCIAL', // Recharts
  VISION_BOARD = 'VISION_BOARD', // Image Gen
  GALLERY = 'GALLERY', // New Full Gallery
  ACTION_PLAN = 'ACTION_PLAN', // AI Agent Execution
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface FinancialGoal {
  year: number;
  savings: number;
  projected: number;
  goal: number;
}

export interface VisionImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: number;
  tags?: string[];
  isFavorite?: boolean;
}

export interface ReferenceImage {
  id: string;
  url: string;
  tags: string[];
  createdAt: number;
}

export interface UserProfile {
  names: string;
  targetRetirementYear: number;
  dreamLocation: string;
}

// Financial Documents / Knowledge Base
export interface Document {
  id: string;
  name: string;
  url?: string;
  type: 'UPLOAD' | 'MANUAL' | 'AI_INTERVIEW' | 'VISION';
  createdAt: number;
  structuredData?: any; // Cached financial analysis
}

// Agent Types
export interface ActionTask {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO string
  type: 'FINANCE' | 'LIFESTYLE' | 'ADMIN';
  isCompleted: boolean;
  milestoneYear?: number;
  aiMetadata?: {
    researchSnippet?: string;
    sourceUrl?: string;
    suggestedTool?: 'GMAIL' | 'MAPS' | 'CALENDAR';
  };
}

export interface Milestone {
  year: number;
  title: string;
  tasks: ActionTask[];
  marketResearchSnippet?: string; // AI Agent research finding
}

export interface FinancialContext {
  currentSavings: number;
  monthlyContribution: number;
  targetGoal: number;
  targetYear: number;
}