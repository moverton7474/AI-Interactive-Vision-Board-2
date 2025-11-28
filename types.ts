
export enum AppView {
  LANDING = 'LANDING',
  ONBOARDING = 'ONBOARDING', // New View
  DISCOVERY = 'DISCOVERY', 
  FINANCIAL = 'FINANCIAL', 
  VISION_BOARD = 'VISION_BOARD', 
  GALLERY = 'GALLERY', 
  ACTION_PLAN = 'ACTION_PLAN', 
  SHARED_VISION = 'SHARED_VISION',
  TRUST_CENTER = 'TRUST_CENTER',
  ORDER_HISTORY = 'ORDER_HISTORY',
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
  credits: number;
  subscription_tier: string;
  onboarding_completed?: boolean; // New Field
}

// Financial Documents / Knowledge Base
export interface Document {
  id: string;
  name: string;
  url?: string;
  type: 'UPLOAD' | 'MANUAL' | 'AI_INTERVIEW' | 'VISION';
  createdAt: number;
  structuredData?: any; 
  tags?: string[];
}

// Agent Types
export interface ActionTask {
  id: string;
  title: string;
  description: string;
  dueDate: string; 
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
  marketResearchSnippet?: string; 
}

export interface FinancialContext {
  currentSavings: number;
  monthlyContribution: number;
  targetGoal: number;
  targetYear: number;
}

export interface CostOfLivingData {
  city: string;
  country: string;
  currency: string;
  costs: {
    rent_1bed_center: number;
    rent_3bed_center: number;
    meal_inexpensive: number;
    utilities_basic: number;
    monthly_total_single: number;
    monthly_total_family: number;
  };
  lastUpdated: string;
}

// --- Print / Poster Types ---

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string; 
}

export interface PrintConfig {
  sku: string; 
  size: string; 
  finish: 'matte' | 'gloss';
  quantity: number;
}

export interface PosterOrder {
  id: string;
  userId: string;
  visionBoardId: string;
  status: 'pending' | 'submitted' | 'shipped' | 'delivered';
  createdAt: number;
  totalPrice: number;
  discountApplied: boolean;
  shippingAddress: ShippingAddress;
  config: PrintConfig;
  vendorOrderId?: string;
}

// --- Templates ---
export interface VisionTemplate {
  id: string;
  category: 'RETIREMENT' | 'CAREER' | 'TRAVEL' | 'HEALTH';
  title: string;
  description: string;
  basePrompt: string; // The "Magic" prompt
  previewColor: string;
}
