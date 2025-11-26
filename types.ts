export enum AppView {
  LANDING = 'LANDING',
  DISCOVERY = 'DISCOVERY', // Chat/Voice
  FINANCIAL = 'FINANCIAL', // Recharts
  VISION_BOARD = 'VISION_BOARD', // Image Gen
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

export interface UserProfile {
  names: string;
  targetRetirementYear: number;
  dreamLocation: string;
}