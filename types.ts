
export enum AppView {
  LANDING = 'LANDING',
  DASHBOARD = 'DASHBOARD', // Main daily home for logged-in users (v1.6)
  GUIDED_ONBOARDING = 'GUIDED_ONBOARDING', // Multi-step guided onboarding (v1.6)
  THEME_SELECTION = 'THEME_SELECTION', // AMIE Identity Theme Selection
  IDENTITY_QNA = 'IDENTITY_QNA', // AMIE Master Prompt Q&A
  ONBOARDING = 'ONBOARDING', // Vision Style/Category Selection (legacy)
  DISCOVERY = 'DISCOVERY',
  FINANCIAL = 'FINANCIAL',
  VISION_BOARD = 'VISION_BOARD',
  GALLERY = 'GALLERY',
  ACTION_PLAN = 'ACTION_PLAN',
  SHARED_VISION = 'SHARED_VISION',
  TRUST_CENTER = 'TRUST_CENTER',
  ORDER_HISTORY = 'ORDER_HISTORY',
  HABITS = 'HABITS',
  WEEKLY_REVIEWS = 'WEEKLY_REVIEWS', // Weekly Review History
  KNOWLEDGE_BASE = 'KNOWLEDGE_BASE', // Personal Knowledge Base
  VOICE_COACH = 'VOICE_COACH', // Voice Coaching Sessions
  PRINT_PRODUCTS = 'PRINT_PRODUCTS', // Print Shop (Focus Pads, Cards, etc.)
  PARTNER = 'PARTNER', // Partner Collaboration Workspace
  INTEGRATIONS = 'INTEGRATIONS', // Slack, Teams integrations
  TEAM_LEADERBOARDS = 'TEAM_LEADERBOARDS', // Team competition and rankings
  MANAGER_DASHBOARD = 'MANAGER_DASHBOARD', // Enterprise team management
  MDALS_LAB = 'MDALS_LAB', // MDALS Engine Test Panel (Development)
  SETTINGS = 'SETTINGS', // User Settings
  AGENT_SETTINGS = 'AGENT_SETTINGS', // AI Agent Settings (Phase 7)
}

// Guided Onboarding State (v1.7 - Draft Plan Review)
export type OnboardingStep =
  | 'THEME'
  | 'COACH_INTRO'
  | 'VISION_CAPTURE'
  | 'PHOTO_UPLOAD'
  | 'FINANCIAL_TARGET'
  | 'VISION_GENERATION'
  | 'ACTION_PLAN_PREVIEW'  // Legacy - read-only preview
  | 'DRAFT_PLAN_REVIEW'    // New v1.7 - editable draft plan review
  | 'HABITS_SETUP'
  | 'PRINT_OFFER'
  | 'COMPLETION';

export interface OnboardingState {
  currentStep: OnboardingStep;
  themeId?: string;
  themeName?: string;
  visionText?: string;
  photoRefId?: string;
  identityDescription?: string; // Description of user's appearance for AI image generation
  financialTarget?: number;
  financialTargetLabel?: string;
  primaryVisionId?: string;
  primaryVisionUrl?: string;
  generatedTasks?: ActionTask[];
  selectedHabits?: string[];
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
  identityDescription?: string; // Neutral physical description for identity preservation
}

export interface UserProfile {
  names: string;
  targetRetirementYear: number;
  dreamLocation: string;
  credits: number;
  subscription_tier: string;
  onboarding_completed?: boolean; // New Field
  financial_target?: number;
  primary_vision_id?: string;
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
  // v1.7 Draft Plan Review fields
  planId?: string;
  planVersion?: number;
  displayOrder?: number;
  priority?: 'high' | 'medium' | 'low';
  source?: 'onboarding' | 'manual' | 'ai_regenerate' | 'import';
}

// Goal Plan (v1.7 Draft Plan Review)
export type GoalPlanStatus = 'draft' | 'active' | 'archived';
export type GoalPlanSource = 'onboarding' | 'manual' | 'revision' | 'ai_regenerate';

export interface GoalPlan {
  id: string;
  userId: string;
  status: GoalPlanStatus;
  version: number;
  source: GoalPlanSource;
  aiInsights?: {
    summary?: string;
    strengths?: string[];
    suggestions?: string[];
    focusAreas?: string[];
  };
  visionText?: string;
  financialTarget?: number;
  themeId?: string;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string;
  archivedAt?: string;
  tasks?: ActionTask[];
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
  productType?: 'poster' | 'canvas'; // Added for v1 - poster/canvas support
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
  productType?: 'poster' | 'canvas'; // Added for v1 - poster/canvas support
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

// ============================================
// AI AGENT ASSISTANT TYPES
// ============================================

export type SessionType = 'voice' | 'text' | 'scheduled_call' | 'push';
export type SessionStatus = 'active' | 'completed' | 'abandoned';
export type MessageRole = 'user' | 'agent' | 'system';
export type ContentType = 'text' | 'audio' | 'action';
export type ChannelType = 'voice' | 'sms' | 'email' | 'push' | 'in_app' | 'call';
export type HabitFrequency = 'daily' | 'weekly' | 'weekdays' | 'custom';
export type CheckinType = 'weekly_review' | 'daily_habit' | 'milestone_reminder' | 'custom';
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface AgentSession {
  id: string;
  user_id: string;
  session_type: SessionType;
  status: SessionStatus;
  context: Record<string, any>;
  started_at: string;
  ended_at?: string;
  summary?: string;
  sentiment_score?: number;
  action_items: AgentActionItem[];
  created_at: string;
}

export interface AgentActionItem {
  type: string;
  description: string;
  completed: boolean;
}

export interface AgentMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  content_type: ContentType;
  audio_url?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface UserCommPreferences {
  id: string;
  user_id: string;
  phone_number?: string;
  phone_verified: boolean;
  preferred_channel: ChannelType;
  preferred_times: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
  timezone: string;
  weekly_review_day: string;
  weekly_review_time: string;
  voice_enabled: boolean;
  call_enabled: boolean;
  quiet_hours: {
    start: string;
    end: string;
  };
  smart_optimization_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// AI AGENT SETTINGS TYPES
// ============================================

export type AgentReminderChannel = 'push' | 'sms' | 'email' | 'voice';
export type AgentReminderTiming = 'before' | 'at_time' | 'after';
export type AgentCheckinFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type AgentProactiveFrequency = 'daily' | 'weekly' | 'biweekly';
export type AgentActionType = 'send_email' | 'send_sms' | 'voice_call' | 'create_task' | 'schedule_reminder' | 'mark_habit_complete' | 'update_goal_progress';
export type AgentActionStatus = 'pending' | 'confirmed' | 'executed' | 'failed' | 'cancelled';
export type AgentTriggerContext = 'conversation' | 'scheduled' | 'proactive';
export type ReminderStatus = 'scheduled' | 'sent' | 'failed' | 'skipped' | 'snoozed';
export type CheckinStatus = 'scheduled' | 'sent' | 'completed' | 'failed' | 'skipped';
export type ConfirmationMethod = 'voice' | 'ui' | 'auto';

export interface UserAgentSettings {
  id: string;
  user_id: string;

  // Master toggle
  agent_actions_enabled: boolean;

  // Granular action permissions
  allow_send_email: boolean;
  allow_send_sms: boolean;
  allow_voice_calls: boolean;
  allow_create_tasks: boolean;
  allow_schedule_reminders: boolean;

  // Habit reminder settings
  habit_reminders_enabled: boolean;
  habit_reminder_channel: AgentReminderChannel;
  habit_reminder_timing: AgentReminderTiming;
  habit_reminder_minutes_before: number;

  // Goal check-in settings
  goal_checkins_enabled: boolean;
  goal_checkin_frequency: AgentCheckinFrequency;
  goal_checkin_channel: AgentReminderChannel;
  goal_checkin_day_of_week: number; // 0=Sunday, 1=Monday, etc.
  goal_checkin_time: string;

  // Proactive outreach settings
  allow_proactive_outreach: boolean;
  proactive_outreach_frequency: AgentProactiveFrequency;
  proactive_topics: string[];

  // Confirmation requirements
  require_confirmation_email: boolean;
  require_confirmation_sms: boolean;
  require_confirmation_voice: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface AgentActionHistory {
  id: string;
  user_id: string;
  session_id?: string;

  // Action details
  action_type: AgentActionType;
  action_status: AgentActionStatus;
  action_payload: Record<string, any>;

  // Results
  result_payload?: Record<string, any>;
  error_message?: string;

  // Confirmation tracking
  requires_confirmation: boolean;
  confirmed_at?: string;
  confirmed_via?: ConfirmationMethod;

  // Context
  trigger_context?: AgentTriggerContext;
  related_habit_id?: string;
  related_goal_id?: string;

  // Timestamps
  created_at: string;
  executed_at?: string;
}

export interface ScheduledHabitReminder {
  id: string;
  user_id: string;
  habit_id: string;

  // Schedule info
  scheduled_for: string;
  reminder_channel: AgentReminderChannel;

  // Content
  habit_name: string;
  reminder_message?: string;

  // Status tracking
  status: ReminderStatus;
  sent_at?: string;
  error_message?: string;

  // Snooze tracking
  snoozed_until?: string;
  snooze_count: number;

  // Link to action history
  action_history_id?: string;

  // Timestamps
  created_at: string;
}

export interface ScheduledGoalCheckin {
  id: string;
  user_id: string;
  goal_id: string;

  // Schedule info
  scheduled_for: string;
  checkin_channel: AgentReminderChannel;

  // Content
  goal_title: string;
  checkin_message?: string;
  current_progress?: number;

  // Status tracking
  status: CheckinStatus;
  sent_at?: string;
  completed_at?: string;
  user_response?: string;
  error_message?: string;

  // Link to action history
  action_history_id?: string;

  // Timestamps
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  task_id?: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
  custom_days: number[]; // 0-6 for Sunday-Saturday
  reminder_time?: string;
  is_active: boolean;
  created_at: string;
  // Computed fields (from joins/functions)
  current_streak?: number;
  last_completed?: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  completed_at: string;
  notes?: string;
  mood_rating?: number; // 1-5
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_type: 'streak' | 'badge' | 'level';
  achievement_key: string;
  value: number;
  earned_at: string;
  metadata: Record<string, any>;
}

export interface ScheduledCheckin {
  id: string;
  user_id: string;
  checkin_type: CheckinType;
  scheduled_for: string;
  channel: ChannelType;
  status: 'pending' | 'sent' | 'completed' | 'failed' | 'skipped';
  content: Record<string, any>;
  response: Record<string, any>;
  created_at: string;
}

export interface AgentAction {
  id: string;
  user_id: string;
  action_type: string;
  action_status: ActionStatus;
  input_params: Record<string, any>;
  output_result: Record<string, any>;
  requires_approval: boolean;
  approved_at?: string;
  executed_at?: string;
  error_message?: string;
  created_at: string;
}

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  wins: string[];
  blockers: string[];
  next_steps: string[];
  habit_completion_rate: number;
  tasks_completed: number;
  tasks_total: number;
  mood_average?: number;
  ai_insights?: string;
  video_url?: string;
  created_at: string;
}

export interface ProgressPrediction {
  id: string;
  user_id: string;
  goal_type: string;
  target_date: string;
  current_pace: number; // 0 to 1+ (above 1 = ahead of schedule)
  predicted_completion_date: string;
  confidence_score: number;
  recommendations: string[];
  calculated_at: string;
}

// Agent Tool Definitions
export type AgentToolName =
  | 'create_task'
  | 'adjust_timeline'
  | 'create_habit'
  | 'send_reminder'
  | 'draft_email'
  | 'schedule_call'
  | 'research_location'
  | 'transfer_funds'
  | 'generate_report';

export interface AgentToolCall {
  tool: AgentToolName;
  params: Record<string, any>;
  requires_approval: boolean;
}

// Badge Definitions
export const BADGE_DEFINITIONS: Record<string, { name: string; description: string; icon: string }> = {
  'first_vision': { name: 'Visionary', description: 'Created your first vision board', icon: '🌟' },
  '7_day_streak': { name: 'Week Warrior', description: '7 day habit streak', icon: '🔥' },
  '30_day_streak': { name: 'Monthly Master', description: '30 day habit streak', icon: '💪' },
  '100_day_streak': { name: 'Century Club', description: '100 day habit streak', icon: '🏆' },
  'financial_check': { name: 'Reality Checker', description: 'Completed financial reality check', icon: '💰' },
  'first_goal': { name: 'Goal Setter', description: 'Set your first retirement goal', icon: '🎯' },
  'action_plan': { name: 'Action Taker', description: 'Generated your action plan', icon: '📋' },
  'couple_sync': { name: 'Dream Team', description: 'Connected with your partner', icon: '💑' },
};

// ============================================
// VISION WORKBOOK TYPES
// ============================================

export type WorkbookBinding = 'softcover' | 'hardcover';
export type WorkbookOrderStatus =
  | 'draft'
  | 'generating'
  | 'ready'
  | 'pending_payment'
  | 'paid'
  | 'submitted'
  | 'printing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type WorkbookSectionType =
  | 'cover'
  | 'title_page'
  | 'dedication'
  | 'coach_letter'
  | 'vision_gallery'
  | 'financial_snapshot'
  | 'action_plan'
  | 'habit_tracker'
  | 'weekly_journal'
  | 'appendix'
  | 'notes'
  | 'back_cover';

export interface WorkbookTemplate {
  id: string;
  name: string;
  description?: string;
  sku: string;
  page_count: number;
  size: string;
  binding: WorkbookBinding;
  base_price: number;
  shipping_estimate: number;
  preview_image_url?: string;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface WorkbookOrder {
  id: string;
  user_id: string;
  template_id: string;
  status: WorkbookOrderStatus;

  // Content References
  vision_board_ids: string[];
  action_plan_id?: string;
  financial_snapshot: Record<string, any>;
  included_habits: string[];

  // Generated Assets
  cover_pdf_url?: string;
  interior_pdf_url?: string;
  merged_pdf_url?: string;
  preview_images: string[];

  // Customization
  title?: string;
  subtitle?: string;
  dedication_text?: string;
  cover_style: string;
  include_weekly_journal: boolean;
  include_habit_tracker: boolean;

  // Shipping
  shipping_address?: ShippingAddress;

  // Pricing
  subtotal: number;
  discount_amount: number;
  shipping_cost: number;
  total_price: number;
  discount_code?: string;
  discount_applied: boolean;

  // Prodigi
  prodigi_order_id?: string;
  prodigi_status?: string;
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  generation_started_at?: string;
  generation_completed_at?: string;
  paid_at?: string;
  submitted_at?: string;
  shipped_at?: string;
  delivered_at?: string;

  // Joined data
  template?: WorkbookTemplate;
}

export interface WorkbookSection {
  id: string;
  workbook_order_id: string;
  section_type: WorkbookSectionType;
  section_order: number;
  page_start?: number;
  page_end?: number;
  title?: string;
  content: Record<string, any>;
  html_template?: string;
  pdf_url?: string;
  status: 'pending' | 'generating' | 'complete' | 'error';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface UserKnowledgeBase {
  id: string;
  user_id: string;

  // Profile
  names?: string;
  retirement_year?: number;
  dream_locations: string[];

  // Financial
  financial_summary: Record<string, any>;
  plaid_accounts_summary: Record<string, any>;
  monthly_budget?: number;
  retirement_goal?: number;

  // Visions
  vision_statements: string[];
  top_priorities: string[];
  vision_board_count: number;

  // Goals
  goals_summary: Record<string, any>;
  milestones: Array<{ year: number; title: string; tasks: string[] }>;
  active_tasks_count: number;
  completed_tasks_count: number;

  // Habits
  habits_summary: Record<string, any>;
  active_habits_count: number;
  total_streak_days: number;

  // AI Context
  conversation_insights?: string;
  recommended_focus_areas: string[];
  agent_notes?: string;
  sentiment_trend?: string;

  // Metadata
  data_sources: string[];
  last_plaid_sync?: string;
  last_compiled_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// AMIE - ADAPTIVE MOTIVATIONAL IDENTITY ENGINE
// ============================================

export type MotivationStyle = 'encouraging' | 'challenging' | 'analytical' | 'spiritual';
export type CommunicationStyle = 'direct' | 'supportive' | 'analytical' | 'storytelling';
export type FormalityLevel = 'formal' | 'casual' | 'professional';
export type EncouragementFrequency = 'high' | 'moderate' | 'minimal';
export type QuestionType = 'single_choice' | 'multiple_choice' | 'text' | 'scale';

export interface MotivationalTheme {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  icon: string;
  color_scheme: {
    primary: string;
    secondary: string;
  };
  system_prompt_template: string;
  motivation_style: MotivationStyle;
  vocabulary_examples: string[];
  content_sources: string[];
  include_scripture: boolean;
  include_metrics: boolean;
  include_wellness: boolean;
  include_legacy: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface MasterPromptQuestion {
  id: string;
  theme_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  prompt_contribution: string;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  created_at: string;
}

export interface MasterPromptResponse {
  question_id: string;
  question_text: string;
  answer: string | string[];
}

export interface UserIdentityProfile {
  id: string;
  user_id: string;

  // Theme
  theme_id?: string;
  theme_customizations: Record<string, any>;
  theme?: MotivationalTheme; // Joined

  // Master Prompt
  master_prompt?: string;
  master_prompt_responses: MasterPromptResponse[];

  // Identity Attributes
  core_values: string[];
  life_roles: string[];
  communication_style?: CommunicationStyle;
  motivation_drivers: string[];

  // AI Voice Preferences
  preferred_ai_voice: string;
  formality_level: FormalityLevel;
  encouragement_frequency: EncouragementFrequency;

  // Computed
  identity_summary?: string;
  coaching_focus_areas: string[];

  // Status
  onboarding_step: number;
  onboarding_completed: boolean;
  last_identity_update?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// KNOWLEDGE BASE (Notebook-LM Style)
// ============================================

export type KnowledgeSourceType =
  | 'resume'
  | 'document'
  | 'url'
  | 'manual_entry'
  | 'conversation'
  | 'vision_board'
  | 'financial_doc'
  | 'notes';

export type KnowledgeSourceStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface UserKnowledgeSource {
  id: string;
  user_id: string;
  source_type: KnowledgeSourceType;
  source_name: string;
  source_url?: string;
  raw_content?: string;
  processed_content?: string;
  content_summary?: string;
  file_type?: string;
  file_size?: number;
  word_count?: number;
  language: string;
  status: KnowledgeSourceStatus;
  error_message?: string;
  processed_at?: string;
  is_active: boolean;
  include_in_context: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserKnowledgeChunk {
  id: string;
  user_id: string;
  source_id: string;
  chunk_text: string;
  chunk_index: number;
  embedding?: number[];
  token_count?: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface KnowledgeSearchResult {
  chunk_id: string;
  chunk_text: string;
  source_name: string;
  source_type: KnowledgeSourceType;
  similarity: number;
}

// ============================================
// VOICE COACH
// ============================================

export type VoiceSessionType =
  | 'on_demand'
  | 'habit_trigger'
  | 'weekly_review'
  | 'milestone_celebration'
  | 'pace_warning'
  | 'check_in'
  | 'morning_intention';

export type VoiceDeviceType = 'apple_watch' | 'iphone' | 'android' | 'web' | 'phone_call';
export type VoiceSessionStatus = 'active' | 'completed' | 'interrupted' | 'failed';

export interface VoiceCoachSession {
  id: string;
  user_id: string;
  session_type: VoiceSessionType;
  trigger_context: Record<string, any>;
  device_type?: VoiceDeviceType;
  channel: 'voice' | 'text_fallback';
  duration_seconds?: number;
  transcript?: string;
  audio_url?: string;
  sentiment_score?: number;
  key_topics: string[];
  action_items_generated: Array<{
    type: string;
    description: string;
    completed?: boolean;
  }>;
  coaching_notes?: string;
  theme_used?: string;
  knowledge_chunks_used: string[];
  status: VoiceSessionStatus;
  ended_reason?: string;
  started_at: string;
  ended_at?: string;
  created_at: string;
}

// ============================================
// AMIE CONTEXT (Compiled for AI)
// ============================================

export interface AMIEContext {
  theme: {
    name: string;
    system_prompt: string;
    style: MotivationStyle;
    include_scripture: boolean;
    include_metrics: boolean;
    include_wellness: boolean;
    include_legacy: boolean;
  };
  identity: {
    master_prompt?: string;
    core_values: string[];
    life_roles: string[];
    communication_style?: CommunicationStyle;
    motivation_drivers: string[];
    identity_summary?: string;
    coaching_focus_areas: string[];
  };
  preferences: {
    formality_level: FormalityLevel;
    encouragement_frequency: EncouragementFrequency;
    preferred_ai_voice: string;
  };
  knowledge_chunks?: KnowledgeSearchResult[];
}

// ============================================
// PRINT PRODUCTS (Extended Catalog)
// ============================================

export type PrintProductType = 'workbook' | 'pad' | 'cards' | 'poster' | 'sticker' | 'canvas' | 'bundle';

export interface PrintProduct {
  id: string;
  name: string;
  description?: string;
  product_type: PrintProductType;
  prodigi_sku: string;
  size: string;
  base_price: number;
  shipping_estimate?: number;
  preview_image_url?: string;
  personalization_fields: string[];
  color_options: string[];
  requires_content: boolean;
  min_content_items: number;
  elite_exclusive: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// ============================================
// MDALS - MUSIC-DRIVEN ADAPTIVE LEARNING SYSTEMS
// ============================================

export type MdalsSongSourceType = 'spotify' | 'apple' | 'youtube' | 'manual' | 'other';
export type MdalsLearningPlanStatus = 'active' | 'completed' | 'paused' | 'abandoned';
export type MdalsDomain = 'spiritual' | 'leadership' | 'business' | 'healing' | 'personal-growth' | 'relationships' | 'mental-health';

export interface MdalsSong {
  id: string;
  user_id: string;
  title: string;
  artist?: string;
  album?: string;
  source_type: MdalsSongSourceType;
  source_id?: string;
  source_url?: string;
  user_notes?: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface MdalsSongReference {
  type: 'scripture' | 'leadership' | 'psychology' | 'book' | 'principle';
  value: string;
  reason: string;
}

export interface MdalsSongInsight {
  id: string;
  song_id: string;
  summary: string;
  themes: string[];
  emotions: string[];
  domain_tags: MdalsDomain[];
  references: MdalsSongReference[];
  domain_preferences: string[];
  model_used?: string;
  created_at: string;
}

export interface MdalsLearningPlanDay {
  day: number;
  focus: string;
  references: string[];
  activities: string[];
  reflection: string;
  prayer_or_action: string;
}

export interface MdalsLearningPlan {
  id: string;
  user_id: string;
  song_id: string;
  title: string;
  goal_description?: string;
  duration_days: number;
  domain_preferences: string[];
  plan_json: MdalsLearningPlanDay[];
  status: MdalsLearningPlanStatus;
  current_day: number;
  started_at: string;
  completed_at?: string;
  model_used?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  song?: MdalsSong;
}

export interface MdalsSongWithInsight {
  song: {
    id: string;
    title: string;
    artist?: string;
    source_type: MdalsSongSourceType;
    source_url?: string;
    created_at: string;
  };
  insight_summary?: string;
  themes?: string[];
  plans_count: number;
}

// MDALS API Request/Response Types
export interface MdalsAnalyzeSongRequest {
  song: {
    title: string;
    artist?: string;
    album?: string;
    source_type: MdalsSongSourceType;
    source_id?: string;
    source_url?: string;
  };
  user_id?: string;
  domain_preferences?: string[];
  user_notes?: string;
  language?: string;
}

export interface MdalsAnalyzeSongResponse {
  success: boolean;
  song_id: string;
  insight_id: string;
  summary: string;
  themes: string[];
  emotions: string[];
  domain_tags: string[];
  references: MdalsSongReference[];
  error?: string;
}

export interface MdalsGeneratePlanRequest {
  user_id?: string;
  song_id: string;
  goal_description: string;
  duration_days?: number;
  domain_preferences?: string[];
}

export interface MdalsGeneratePlanResponse {
  success: boolean;
  plan_id: string;
  title: string;
  duration_days: number;
  goal_description: string;
  days: MdalsLearningPlanDay[];
  error?: string;
}

// ============================================
// AGENTIC EXECUTION TYPES (Phase 1)
// ============================================

// Risk Levels for Agent Actions
export type AgentActionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const ACTION_RISK_LEVELS: Record<string, AgentActionRiskLevel> = {
  'get_user_data': 'low',
  'get_todays_habits': 'low',
  'create_task': 'low',
  'schedule_reminder': 'medium',
  'mark_habit_complete': 'medium',
  'update_goal_progress': 'medium',
  'send_email': 'high',
  'send_sms': 'high',
  'voice_call': 'high',
  'make_voice_call': 'high',
  'send_email_to_contact': 'critical',
  'create_calendar_event': 'medium',
};

// Extended User Agent Settings
export interface UserAgentSettingsExtended extends UserAgentSettings {
  // Confidence settings
  require_high_confidence: boolean;
  confidence_threshold: number; // 0.5 - 0.95

  // Risk auto-approval
  auto_approve_low_risk: boolean;
  auto_approve_medium_risk: boolean;
}

// Team AI Settings Extensions
export interface TeamAISettings {
  id: string;
  team_id: string;
  coach_name: string;
  coach_tone: string;
  blocked_topics: string[];
  required_disclaimers: string[];
  custom_instructions: string;
  enable_sentiment_alerts: boolean;
  sentiment_alert_threshold: number;
  enable_crisis_detection: boolean;
  crisis_escalation_email: string;
  crisis_keywords: string[];
  max_session_duration_minutes: number;
  max_sessions_per_day: number;
  cooldown_between_sessions_minutes: number;
  allow_send_email: boolean;
  allow_create_tasks: boolean;
  allow_schedule_reminders: boolean;
  allow_access_user_data: boolean;
  require_confirmation: boolean;
  default_voice: string;
  default_voice_speed: number;
  // New confidence policy fields
  min_confidence_threshold: number;
  allow_user_auto_approve_low: boolean;
  allow_user_auto_approve_medium: boolean;
  allow_user_auto_approve_high: boolean;
  require_admin_approval_critical: boolean;
  allow_send_sms: boolean;
  allow_voice_calls: boolean;
  created_at: string;
  updated_at: string;
}

// Pending Actions (for confirmation flow)
export type PendingActionStatus = 'pending_confirmation' | 'confirmed' | 'cancelled' | 'expired' | 'executed';

export interface PendingAgentAction {
  id: string;
  user_id: string;
  session_id?: string;
  action_type: AgentActionType;
  action_payload: Record<string, any>;
  status: PendingActionStatus;
  confidence_score?: number;
  risk_level: AgentActionRiskLevel;
  expires_at: string;
  confirmed_at?: string;
  cancelled_at?: string;
  executed_at?: string;
  result_payload?: Record<string, any>;
  error_message?: string;
  created_at: string;
}

// Execution Traces (for observability)
export type TraceType = 'llm_call' | 'tool_call' | 'tool_result' | 'decision_point' | 'confirmation_request' | 'user_response';

export interface AgentExecutionTrace {
  id: string;
  session_id?: string;
  user_id: string;
  team_id?: string;
  trace_type: TraceType;
  step_number: number;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms?: number;
  model_used?: string;
  tool_name?: string;
  input_payload?: Record<string, any>;
  output_payload?: Record<string, any>;
  confidence_score?: number;
  error?: string;
  created_at: string;
}

// Feedback (for continuous improvement)
export type FeedbackType = 'approved' | 'rejected' | 'edited' | 'reported' | 'thumbs_up' | 'thumbs_down';

export interface AgentActionFeedback {
  id: string;
  action_history_id: string;
  user_id: string;
  team_id?: string;
  feedback_type: FeedbackType;
  original_payload?: Record<string, any>;
  edited_payload?: Record<string, any>;
  rejection_reason?: string;
  feedback_text?: string;
  time_to_decision_ms?: number;
  created_at: string;
}

// Calendar Integration
export type CalendarProvider = 'google' | 'microsoft' | 'apple';

export interface UserCalendarConnection {
  id: string;
  user_id: string;
  provider: CalendarProvider;
  access_token_encrypted?: string;
  refresh_token_encrypted?: string;
  token_expires_at?: string;
  calendar_id: string;
  calendar_name?: string;
  is_active: boolean;
  connected_at: string;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

// Effective Settings (computed from user + team)
export interface EffectiveAgentSettings {
  agent_actions_enabled: boolean;
  allow_send_email: boolean;
  allow_send_sms: boolean;
  allow_voice_calls: boolean;
  allow_create_tasks: boolean;
  allow_schedule_reminders: boolean;
  allow_calendar_access: boolean;
  confidence_threshold: number;
  require_high_confidence: boolean;
  auto_approve_low_risk: boolean;
  auto_approve_medium_risk: boolean;
  require_confirmation_email: boolean;
  require_confirmation_sms: boolean;
  require_confirmation_voice: boolean;
  require_confirmation_calendar: boolean;
}

// API Response Types
export interface AgentToolResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  error_code?: string;
  needs_confirmation?: boolean;
  pending_action_id?: string;
  confidence_score?: number;
  message?: string;
  action_id?: string;
}

export interface AgentChatResponse {
  success: boolean;
  response: string;
  session_id?: string;
  actions_taken?: Array<{
    action_type: AgentActionType;
    status: AgentActionStatus;
    action_id: string;
  }>;
  pending_actions?: PendingAgentAction[];
  used_tools?: string[];
  error?: string;
  error_code?: string;
}

// Feature Flags
export interface FeatureFlag {
  id: string;
  flag_name: string;
  description?: string;
  enabled_globally: boolean;
  enabled_for_teams: string[];
  enabled_for_users: string[];
  rollout_percentage: number;
  created_at: string;
  updated_at: string;
}

// Error Codes
export const AGENT_ERROR_CODES = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  ACTION_EXPIRED: 'ACTION_EXPIRED',
  ACTION_NOT_FOUND: 'ACTION_NOT_FOUND',
  QUIET_HOURS: 'QUIET_HOURS',
  INVALID_RECIPIENT: 'INVALID_RECIPIENT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  TEAM_POLICY_BLOCKED: 'TEAM_POLICY_BLOCKED',
  CALENDAR_NOT_CONNECTED: 'CALENDAR_NOT_CONNECTED',
  CALENDAR_AUTH_EXPIRED: 'CALENDAR_AUTH_EXPIRED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type AgentErrorCode = typeof AGENT_ERROR_CODES[keyof typeof AGENT_ERROR_CODES];
