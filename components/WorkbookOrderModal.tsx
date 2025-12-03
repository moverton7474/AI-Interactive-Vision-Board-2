
import React, { useState, useEffect, useMemo } from 'react';
import { WorkbookTemplate, ShippingAddress, VisionImage, Habit } from '../types';
import { BookOpenIcon, CheckBadgeIcon, TruckIcon, LockIcon, SparklesIcon } from './Icons';
import {
  getWorkbookTemplates,
  createWorkbookOrder,
  generateWorkbookPdf,
  getVisionGallery,
  getHabits,
  getLastShippingAddress,
  createStripeCheckoutSession
} from '../services/storageService';

// ============================================
// TYPES & CONSTANTS
// ============================================

type EditionType = 'SOFTCOVER' | 'PLANNER' | 'EXECUTIVE' | 'LEGACY';
type WizardStep = 'TEMPLATE' | 'CUSTOMIZE' | 'CONTENT' | 'SHIPPING' | 'PAYMENT' | 'SUCCESS';

interface WorkbookWizardState {
  selectedEdition: EditionType | null;
  title: string;
  subtitle: string;
  dedication: string;
  includedSections: string[];
  selectedVisionIds: string[];
  selectedHabitIds: string[];
}

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
  defaultEdition?: EditionType;
  hasActionPlan?: boolean;
  // TODO: Add userProfile prop for smart defaults
  // userProfile?: { first_name?: string };
}

// Edition metadata for enhanced template cards
const EDITION_METADATA: Record<string, {
  bestFor: string;
  highlights: string[];
  recommendedSections: string[];
}> = {
  'Vision Journal - Softcover': {
    bestFor: 'Quick start & everyday journaling',
    highlights: [
      'Lightweight & portable',
      'Full color interior',
      'Perfect for beginners'
    ],
    recommendedSections: ['vision_gallery', 'habit_tracker', 'weekly_journal']
  },
  'Vision Planner - Hardcover': {
    bestFor: 'Daily planning & goal tracking',
    highlights: [
      'Durable hardcover protection',
      'Lay-flat binding for easy writing',
      '52-week structured journal'
    ],
    recommendedSections: ['vision_gallery', 'habit_tracker', 'weekly_journal', 'action_plan']
  },
  'Executive Vision Book': {
    bestFor: 'Comprehensive roadmap & financial planning',
    highlights: [
      'Large format for detailed content',
      'Complete 3-year action roadmap',
      'Full financial analysis section',
      'QR codes for deep linking'
    ],
    recommendedSections: ['vision_gallery', 'financial_snapshot', 'action_plan', 'habit_tracker', 'weekly_journal']
  },
  'Legacy Edition': {
    bestFor: 'Premium gift & legacy documentation',
    highlights: [
      'Premium materials & finish',
      '150 pages of content',
      'Gift box packaging included',
      'Certificate of authenticity'
    ],
    recommendedSections: ['vision_gallery', 'coach_letter', 'financial_snapshot', 'action_plan', 'habit_tracker', 'weekly_journal', 'notes']
  }
};

// Available sections with labels
const AVAILABLE_SECTIONS = [
  { id: 'vision_gallery', label: 'Vision Gallery', description: 'Full-page vision board images with reflection prompts' },
  { id: 'coach_letter', label: 'Letter from Vision Coach', description: 'AI-generated personalized motivation letter' },
  { id: 'financial_snapshot', label: 'Financial & Goal Progress Overview', description: 'Current financial snapshot and projections' },
  { id: 'action_plan', label: '3-Year Roadmap & Milestones', description: 'Quarterly task lists with progress checkboxes' },
  { id: 'habit_tracker', label: '12-Month Habit Tracker', description: 'Monthly habit grids with streak tracking' },
  { id: 'weekly_journal', label: '52-Week Reflection Journal', description: 'Weekly structured reflection prompts' },
  { id: 'notes', label: 'Notes & Ideas Pages', description: '10 blank pages for additional notes' }
];

// Selection limits
const MAX_VISION_BOARDS = 4;
const MAX_HABITS = 3;

// ============================================
// COMPONENT
// ============================================

const WorkbookOrderModal: React.FC<Props> = ({
  onClose,
  onSuccess,
  defaultEdition,
  hasActionPlan = false
}) => {
  const [step, setStep] = useState<WizardStep>('TEMPLATE');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data from API
  const [templates, setTemplates] = useState<WorkbookTemplate[]>([]);
  const [visionBoards, setVisionBoards] = useState<VisionImage[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);

  // Wizard state
  const [selectedTemplate, setSelectedTemplate] = useState<WorkbookTemplate | null>(null);
  const [wizardState, setWizardState] = useState<WorkbookWizardState>({
    selectedEdition: defaultEdition || null,
    title: '',
    subtitle: new Date().getFullYear().toString(),
    dedication: '',
    includedSections: [],
    selectedVisionIds: [],
    selectedHabitIds: []
  });

  // Shipping
  const [shipping, setShipping] = useState<ShippingAddress>({
    name: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US'
  });

  // Order
  const [orderId, setOrderId] = useState<string | null>(null);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    loadData();
  }, []);

  // Update sections when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const metadata = EDITION_METADATA[selectedTemplate.name];
      if (metadata) {
        setWizardState(prev => ({
          ...prev,
          includedSections: metadata.recommendedSections
        }));
      }
    }
  }, [selectedTemplate]);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [templatesData, visionData, habitsData, lastAddress] = await Promise.all([
        getWorkbookTemplates(),
        getVisionGallery(),
        getHabits(),
        getLastShippingAddress()
      ]);

      setTemplates(templatesData);

      // Filter out placeholder images (SVG data URLs) - only include real generated images
      // Placeholder images have data:image/svg+xml URLs instead of actual storage URLs
      const realVisionBoards = visionData.filter(v =>
        v.url && !v.url.startsWith('data:image/svg+xml')
      );
      setVisionBoards(realVisionBoards);
      setHabits(habitsData);

      if (lastAddress) {
        setShipping(lastAddress);
      }

      // Set smart defaults for title
      // TODO: Use userProfile.first_name when available
      const defaultTitle = "My Vision Masterplan";
      setWizardState(prev => ({
        ...prev,
        title: defaultTitle,
        // Pre-select recent real vision boards (up to max)
        selectedVisionIds: realVisionBoards.slice(0, MAX_VISION_BOARDS).map(v => v.id),
        // Pre-select all habits (up to max)
        selectedHabitIds: habitsData.slice(0, MAX_HABITS).map(h => h.id)
      }));

      // Auto-select Executive if defaultEdition is set or hasActionPlan
      if (defaultEdition || hasActionPlan) {
        const executiveTemplate = templatesData.find(t =>
          t.name.toLowerCase().includes('executive')
        );
        if (executiveTemplate) {
          handleSelectTemplate(executiveTemplate, true);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleSelectTemplate = (template: WorkbookTemplate, skipNavigation = false) => {
    setSelectedTemplate(template);

    // Determine edition type from template name
    let editionType: EditionType = 'SOFTCOVER';
    if (template.name.toLowerCase().includes('planner')) editionType = 'PLANNER';
    else if (template.name.toLowerCase().includes('executive')) editionType = 'EXECUTIVE';
    else if (template.name.toLowerCase().includes('legacy')) editionType = 'LEGACY';

    setWizardState(prev => ({
      ...prev,
      selectedEdition: editionType
    }));

    if (!skipNavigation) {
      setStep('CUSTOMIZE');
    }
  };

  const handleVisionBoardToggle = (visionId: string) => {
    setWizardState(prev => {
      const isSelected = prev.selectedVisionIds.includes(visionId);

      if (isSelected) {
        // Always allow deselection
        return {
          ...prev,
          selectedVisionIds: prev.selectedVisionIds.filter(id => id !== visionId)
        };
      } else {
        // Check if we've hit the limit
        if (prev.selectedVisionIds.length >= MAX_VISION_BOARDS) {
          return prev; // Don't add more
        }
        return {
          ...prev,
          selectedVisionIds: [...prev.selectedVisionIds, visionId]
        };
      }
    });
  };

  const handleHabitToggle = (habitId: string) => {
    setWizardState(prev => {
      const isSelected = prev.selectedHabitIds.includes(habitId);

      if (isSelected) {
        return {
          ...prev,
          selectedHabitIds: prev.selectedHabitIds.filter(id => id !== habitId)
        };
      } else {
        if (prev.selectedHabitIds.length >= MAX_HABITS) {
          return prev;
        }
        return {
          ...prev,
          selectedHabitIds: [...prev.selectedHabitIds, habitId]
        };
      }
    });
  };

  const handleSectionToggle = (sectionId: string) => {
    setWizardState(prev => ({
      ...prev,
      includedSections: prev.includedSections.includes(sectionId)
        ? prev.includedSections.filter(id => id !== sectionId)
        : [...prev.includedSections, sectionId]
    }));
  };

  const handleAutoSuggestVisionBoards = () => {
    // Auto-select the most recent vision boards up to the limit
    const recentVisionIds = visionBoards
      .slice(0, MAX_VISION_BOARDS)
      .map(v => v.id);

    setWizardState(prev => ({
      ...prev,
      selectedVisionIds: recentVisionIds
    }));
  };

  const validateContentStep = (): boolean => {
    // For Executive edition, require at least 1 vision board
    if (wizardState.selectedEdition === 'EXECUTIVE' && wizardState.selectedVisionIds.length === 0) {
      setErrorMessage('Please select at least 1 vision board for your Executive Vision Book');
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const handleSubmitOrder = async () => {
    if (!selectedTemplate) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Create the order with full customization payload
      const order = await createWorkbookOrder({
        template_id: selectedTemplate.id,
        title: wizardState.title,
        subtitle: wizardState.subtitle,
        dedication_text: wizardState.dedication || undefined,
        include_weekly_journal: wizardState.includedSections.includes('weekly_journal'),
        include_habit_tracker: wizardState.includedSections.includes('habit_tracker'),
        vision_board_ids: wizardState.selectedVisionIds,
        included_habits: wizardState.selectedHabitIds,
        shipping_address: shipping,
        // Additional payload for enhanced workbook
        // TODO: Backend should accept these fields
        // included_sections: wizardState.includedSections,
        // edition: wizardState.selectedEdition,
      });

      if (!order) {
        throw new Error('Failed to create order');
      }

      setOrderId(order.id);

      // Generate the workbook content
      await generateWorkbookPdf(order.id);

      // Initiate Stripe Checkout
      const checkoutUrl = await createStripeCheckoutSession('payment', order.id);

      if (checkoutUrl === "SIMULATION") {
        setStep('SUCCESS');
      } else if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (error: any) {
      console.error('Order failed:', error);
      setErrorMessage(error.message || 'Failed to create order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const subtotal = selectedTemplate?.base_price || 0;
  const shippingCost = selectedTemplate?.shipping_estimate || 9.99;
  const total = subtotal + shippingCost;

  // Estimate page count based on selections
  const estimatedPageCount = useMemo(() => {
    let pages = selectedTemplate?.page_count || 100;
    // This is a rough estimate - actual would depend on content
    // TODO: Implement more accurate page count calculation
    return pages;
  }, [selectedTemplate, wizardState]);

  const isExecutiveEdition = selectedTemplate?.name.toLowerCase().includes('executive');

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderVisionBoardPlaceholder = () => (
    'data:image/svg+xml,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e3a5f;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0d1b2a;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect fill="url(#grad)" width="400" height="400"/>
        <text x="200" y="180" font-family="system-ui" font-size="48" fill="#d4af37" text-anchor="middle">✨</text>
        <text x="200" y="230" font-family="system-ui" font-size="14" fill="#8b9dc3" text-anchor="middle">Vision Board</text>
      </svg>
    `)
  );

  // ============================================
  // STEP 1: TEMPLATE SELECTION
  // ============================================

  const renderTemplateStep = () => {
    const isRecommended = (template: WorkbookTemplate) => {
      return (defaultEdition || hasActionPlan) &&
        template.name.toLowerCase().includes('executive');
    };

    return (
      <div className="p-6 md:p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-serif font-bold text-navy-900">Choose Your Workbook</h2>
            <p className="text-gray-500 text-sm">Step 1 of 5: Select the perfect edition for your journey</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => {
              const metadata = EDITION_METADATA[template.name];
              const recommended = isRecommended(template);

              return (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`relative border-2 rounded-xl p-5 cursor-pointer transition-all group ${
                    recommended
                      ? 'border-gold-400 bg-gold-50/30 ring-2 ring-gold-200 shadow-lg'
                      : 'border-gray-200 hover:border-navy-900 hover:shadow-lg'
                  }`}
                >
                  {/* Recommended Badge */}
                  {recommended && (
                    <div className="absolute -top-3 left-4 bg-gold-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <SparklesIcon className="w-3 h-3" />
                      Recommended
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-navy-100 rounded-lg flex items-center justify-center">
                      <BookOpenIcon className="w-6 h-6 text-navy-900" />
                    </div>
                    <span className="text-2xl font-bold text-navy-900">
                      ${template.base_price.toFixed(2)}
                    </span>
                  </div>

                  {/* Title & Best For */}
                  <h3 className="text-lg font-bold text-navy-900 mb-1">{template.name}</h3>
                  {metadata && (
                    <p className="text-sm text-gold-600 font-medium mb-2">
                      Best for: {metadata.bestFor}
                    </p>
                  )}

                  {/* Format Info */}
                  <div className="flex flex-wrap gap-2 mb-3 text-xs">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {template.size}
                    </span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {template.page_count} pages
                    </span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded capitalize">
                      {template.binding}
                    </span>
                  </div>

                  {/* Feature Highlights */}
                  <ul className="text-xs text-gray-600 space-y-1.5">
                    {(metadata?.highlights || template.features?.slice(0, 4))?.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckBadgeIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // STEP 2: PERSONALIZATION
  // ============================================

  const renderCustomizeStep = () => {
    const titleMaxLength = 50;
    const subtitleMaxLength = 30;
    const dedicationMaxLength = 200;

    return (
      <div className="p-6 md:p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-serif font-bold text-navy-900">Personalize Your Workbook</h2>
            <p className="text-gray-500 text-sm">Step 2 of 5: Add your personal touch</p>
          </div>
          <button
            onClick={() => setStep('TEMPLATE')}
            className="text-sm text-gray-500 hover:text-navy-900 underline"
          >
            Back
          </button>
        </div>

        {/* Helper text */}
        <p className="text-sm text-gray-500 mb-6 bg-gray-50 p-3 rounded-lg">
          These details will appear on your cover and opening pages. Make it meaningful!
        </p>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-navy-900">Workbook Title</label>
              <span className={`text-xs ${wizardState.title.length > titleMaxLength ? 'text-red-500' : 'text-gray-400'}`}>
                {wizardState.title.length}/{titleMaxLength}
              </span>
            </div>
            <input
              type="text"
              value={wizardState.title}
              onChange={(e) => setWizardState(prev => ({
                ...prev,
                title: e.target.value.slice(0, titleMaxLength)
              }))}
              className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
              placeholder="My Vision Masterplan"
            />
          </div>

          {/* Subtitle */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-navy-900">Subtitle</label>
              <span className={`text-xs ${wizardState.subtitle.length > subtitleMaxLength ? 'text-red-500' : 'text-gray-400'}`}>
                {wizardState.subtitle.length}/{subtitleMaxLength}
              </span>
            </div>
            <input
              type="text"
              value={wizardState.subtitle}
              onChange={(e) => setWizardState(prev => ({
                ...prev,
                subtitle: e.target.value.slice(0, subtitleMaxLength)
              }))}
              className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
              placeholder={new Date().getFullYear().toString()}
            />
          </div>

          {/* Dedication */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-navy-900">Dedication (Optional)</label>
              <span className={`text-xs ${wizardState.dedication.length > dedicationMaxLength ? 'text-red-500' : 'text-gray-400'}`}>
                {wizardState.dedication.length}/{dedicationMaxLength}
              </span>
            </div>
            <textarea
              value={wizardState.dedication}
              onChange={(e) => setWizardState(prev => ({
                ...prev,
                dedication: e.target.value.slice(0, dedicationMaxLength)
              }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
              placeholder="To my future self..."
            />
          </div>

          {/* Sections */}
          <div className="border-t border-gray-100 pt-5">
            <label className="block text-sm font-bold text-navy-900 mb-1">Include Sections</label>
            <p className="text-xs text-gray-500 mb-4">
              Select which sections to include in your workbook
            </p>
            <div className="space-y-3">
              {AVAILABLE_SECTIONS.map((section) => (
                <label
                  key={section.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    wizardState.includedSections.includes(section.id)
                      ? 'border-navy-900 bg-navy-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={wizardState.includedSections.includes(section.id)}
                    onChange={() => handleSectionToggle(section.id)}
                    className="w-5 h-5 text-navy-900 rounded mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium text-navy-900">{section.label}</span>
                    <p className="text-xs text-gray-500">{section.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => setStep('CONTENT')}
          className="w-full mt-8 bg-navy-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-navy-800 transition-all"
        >
          Continue to Content Selection
        </button>
      </div>
    );
  };

  // ============================================
  // STEP 3: CONTENT SELECTION
  // ============================================

  const renderContentStep = () => {
    const atVisionLimit = wizardState.selectedVisionIds.length >= MAX_VISION_BOARDS;
    const atHabitLimit = wizardState.selectedHabitIds.length >= MAX_HABITS;

    return (
      <div className="flex flex-col md:flex-row h-full">
        {/* Main Content Area */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[70vh]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-serif font-bold text-navy-900">Select Content</h2>
              <p className="text-gray-500 text-sm">Step 3 of 5: Choose what to include</p>
            </div>
            <button
              onClick={() => setStep('CUSTOMIZE')}
              className="text-sm text-gray-500 hover:text-navy-900 underline"
            >
              Back
            </button>
          </div>

          {/* Vision Boards Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wide">
                  Vision Boards
                </h3>
                <p className="text-xs text-gray-500">
                  Select up to {MAX_VISION_BOARDS} vision boards to feature
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${atVisionLimit ? 'text-gold-600' : 'text-gray-500'}`}>
                  {wizardState.selectedVisionIds.length}/{MAX_VISION_BOARDS}
                </span>
                <button
                  onClick={handleAutoSuggestVisionBoards}
                  className="text-xs text-navy-600 hover:text-navy-900 underline flex items-center gap-1"
                  title="Auto-select recent boards"
                >
                  <SparklesIcon className="w-3 h-3" />
                  Auto-select
                </button>
              </div>
            </div>

            {atVisionLimit && (
              <p className="text-xs text-gold-600 bg-gold-50 p-2 rounded mb-3">
                Maximum {MAX_VISION_BOARDS} vision boards selected. Deselect one to choose another.
              </p>
            )}

            {visionBoards.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {visionBoards.slice(0, 9).map((vision) => {
                  const isSelected = wizardState.selectedVisionIds.includes(vision.id);
                  const isDisabled = !isSelected && atVisionLimit;

                  return (
                    <div
                      key={vision.id}
                      onClick={() => !isDisabled && handleVisionBoardToggle(vision.id)}
                      className={`relative rounded-xl overflow-hidden transition-all ${
                        isDisabled
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer hover:shadow-lg'
                      } ${
                        isSelected
                          ? 'ring-4 ring-navy-900 ring-offset-2'
                          : 'border-2 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Image */}
                      <div className="aspect-square">
                        <img
                          src={vision.url}
                          alt={vision.prompt?.slice(0, 50) || 'Vision Board'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = renderVisionBoardPlaceholder();
                          }}
                        />
                      </div>

                      {/* Overlay with info */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <p className="text-white text-xs line-clamp-2">
                          {vision.prompt?.slice(0, 60) || 'Vision Board'}
                          {vision.prompt && vision.prompt.length > 60 ? '...' : ''}
                        </p>
                      </div>

                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-7 h-7 bg-navy-900 rounded-full flex items-center justify-center shadow-lg">
                          <CheckBadgeIcon className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800 mb-1">
                  No vision board images available
                </p>
                <p className="text-xs text-amber-700">
                  Generate vision boards from the Dashboard to include them in your workbook.
                  Only successfully generated AI images can be printed.
                </p>
              </div>
            )}
          </div>

          {/* Habits Section */}
          {wizardState.includedSections.includes('habit_tracker') && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wide">
                    Habits to Track
                  </h3>
                  <p className="text-xs text-gray-500">
                    Selected habits will drive the habit tracker sections
                  </p>
                </div>
                <span className={`text-sm font-medium ${atHabitLimit ? 'text-gold-600' : 'text-gray-500'}`}>
                  {wizardState.selectedHabitIds.length}/{MAX_HABITS}
                </span>
              </div>

              {atHabitLimit && (
                <p className="text-xs text-gold-600 bg-gold-50 p-2 rounded mb-3">
                  Maximum {MAX_HABITS} habits selected.
                </p>
              )}

              {habits.length > 0 ? (
                <div className="space-y-2">
                  {habits.map((habit) => {
                    const isSelected = wizardState.selectedHabitIds.includes(habit.id);
                    const isDisabled = !isSelected && atHabitLimit;

                    return (
                      <label
                        key={habit.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                          isDisabled
                            ? 'opacity-50 cursor-not-allowed border-gray-100'
                            : 'cursor-pointer'
                        } ${
                          isSelected
                            ? 'border-navy-900 bg-navy-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => !isDisabled && handleHabitToggle(habit.id)}
                          disabled={isDisabled}
                          className="w-5 h-5 text-navy-900 rounded"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-navy-900">{habit.title}</span>
                          {habit.description && (
                            <p className="text-xs text-gray-500">{habit.description}</p>
                          )}
                        </div>
                        {habit.current_streak && habit.current_streak > 0 && (
                          <span className="text-xs bg-gold-100 text-gold-700 px-2 py-1 rounded-full">
                            🔥 {habit.current_streak} day streak
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4">
                  No habits yet. Create habits in the Habits section to include tracking pages!
                </p>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {errorMessage}
            </div>
          )}

          <button
            onClick={() => {
              if (validateContentStep()) {
                setStep('SHIPPING');
              }
            }}
            className="w-full mt-4 bg-navy-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-navy-800 transition-all"
          >
            Continue to Shipping
          </button>
        </div>

        {/* Right Side Summary Panel (Desktop only) */}
        <div className="hidden md:block w-64 bg-gray-50 border-l border-gray-200 p-5">
          <h4 className="text-sm font-bold text-navy-900 uppercase tracking-wide mb-4">
            Your Workbook
          </h4>

          <div className="space-y-4 text-sm">
            <div>
              <span className="text-gray-500">Edition</span>
              <p className="font-medium text-navy-900">{selectedTemplate?.name}</p>
            </div>

            <div>
              <span className="text-gray-500">Format</span>
              <p className="font-medium text-navy-900">
                {selectedTemplate?.size} • {selectedTemplate?.binding}
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <span className="text-gray-500">Vision Boards</span>
              <p className="font-medium text-navy-900">
                {wizardState.selectedVisionIds.length} selected
              </p>
            </div>

            <div>
              <span className="text-gray-500">Habits</span>
              <p className="font-medium text-navy-900">
                {wizardState.selectedHabitIds.length} selected
              </p>
            </div>

            <div>
              <span className="text-gray-500">Sections</span>
              <p className="font-medium text-navy-900">
                {wizardState.includedSections.length} included
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <span className="text-gray-500">Est. Pages</span>
              <p className="font-medium text-navy-900">~{estimatedPageCount} pages</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // STEP 4: SHIPPING
  // ============================================

  const renderShippingStep = () => (
    <div className="p-6 md:p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-serif font-bold text-navy-900">Shipping Details</h2>
          <p className="text-gray-500 text-sm">Step 4 of 5: Where should we send it?</p>
        </div>
        <button
          onClick={() => setStep('CONTENT')}
          className="text-sm text-gray-500 hover:text-navy-900 underline"
        >
          Back
        </button>
      </div>

      {/* Order Summary Block */}
      <div className="bg-navy-50 border border-navy-100 rounded-xl p-4 mb-6 flex items-center gap-4">
        <div className="w-14 h-14 bg-navy-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <BookOpenIcon className="w-7 h-7 text-navy-900" />
        </div>
        <div>
          <p className="font-bold text-navy-900">{selectedTemplate?.name}</p>
          <p className="text-sm text-gray-600">
            {selectedTemplate?.binding} • {selectedTemplate?.size} • ~{estimatedPageCount} pages
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {wizardState.selectedVisionIds.length} vision boards • {wizardState.selectedHabitIds.length} habits
          </p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setStep('PAYMENT'); }}>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
          <input
            required
            type="text"
            value={shipping.name}
            onChange={e => setShipping({ ...shipping, name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
            placeholder="John Doe"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address Line 1</label>
          <input
            required
            type="text"
            value={shipping.line1}
            onChange={e => setShipping({ ...shipping, line1: e.target.value })}
            className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
            placeholder="123 Dream St"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address Line 2 (Optional)</label>
          <input
            type="text"
            value={shipping.line2 || ''}
            onChange={e => setShipping({ ...shipping, line2: e.target.value })}
            className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
            placeholder="Apt 4B"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">City</label>
            <input
              required
              type="text"
              value={shipping.city}
              onChange={e => setShipping({ ...shipping, city: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">State/Province</label>
            <input
              required
              type="text"
              value={shipping.state}
              onChange={e => setShipping({ ...shipping, state: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Zip/Postal Code</label>
            <input
              required
              type="text"
              value={shipping.postalCode}
              onChange={e => setShipping({ ...shipping, postalCode: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Country</label>
            <select
              value={shipping.country}
              onChange={e => setShipping({ ...shipping, country: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
            >
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="w-full mt-6 bg-navy-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-navy-800 transition-all"
        >
          Continue to Payment
        </button>
      </form>
    </div>
  );

  // ============================================
  // STEP 5: PAYMENT / CONFIRMATION
  // ============================================

  const renderPaymentStep = () => (
    <div className="p-6 md:p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-serif font-bold text-navy-900">Review & Pay</h2>
          <p className="text-gray-500 text-sm">Step 5 of 5: Complete your order</p>
        </div>
        <button
          onClick={() => setStep('SHIPPING')}
          className="text-sm text-gray-500 hover:text-navy-900 underline"
        >
          Back
        </button>
      </div>

      <div className="space-y-5 mb-8">
        {/* Order Summary */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="font-bold text-navy-900 mb-3 text-sm uppercase">Order Summary</h4>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-navy-100 rounded-lg flex items-center justify-center">
              <BookOpenIcon className="w-8 h-8 text-navy-900" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-navy-900">{selectedTemplate?.name}</p>
              <p className="text-sm text-gray-500">
                {selectedTemplate?.size} • {selectedTemplate?.binding}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                "{wizardState.title}"
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-1 border-t border-gray-200 pt-3">
            <p className="flex justify-between">
              <span>Vision Boards</span>
              <span className="font-medium">{wizardState.selectedVisionIds.length} included</span>
            </p>
            <p className="flex justify-between">
              <span>Habits to Track</span>
              <span className="font-medium">{wizardState.selectedHabitIds.length} selected</span>
            </p>
            <p className="flex justify-between">
              <span>Sections</span>
              <span className="font-medium">{wizardState.includedSections.length} included</span>
            </p>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="font-bold text-navy-900 mb-2 text-sm uppercase flex items-center gap-2">
            <TruckIcon className="w-4 h-4" />
            Ship To
          </h4>
          <p className="text-sm text-gray-600">{shipping.name}</p>
          <p className="text-sm text-gray-600">{shipping.line1} {shipping.line2}</p>
          <p className="text-sm text-gray-600">{shipping.city}, {shipping.state} {shipping.postalCode}</p>
          <p className="text-sm text-gray-600">{shipping.country}</p>
        </div>

        {/* Pricing */}
        <div className="bg-gold-50 border border-gold-200 rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2 text-gray-600">
            <span>{selectedTemplate?.name}</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mb-3 text-gray-600">
            <span>Standard Shipping</span>
            <span>${shippingCost.toFixed(2)}</span>
          </div>
          <div className="border-t border-gold-200 pt-3 flex justify-between items-end">
            <span className="font-bold text-navy-900">Total</span>
            <span className="text-3xl font-serif font-bold text-navy-900">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
          <span className="font-bold">Error:</span> {errorMessage}
        </div>
      )}

      <button
        onClick={handleSubmitOrder}
        disabled={isProcessing}
        className="w-full bg-gradient-to-r from-navy-900 to-navy-800 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <LockIcon className="w-5 h-5" />
            Pay ${total.toFixed(2)} via Stripe
          </>
        )}
      </button>
      <p className="mt-4 text-center text-[10px] text-gray-400">
        Secure payment processed by Stripe. Your workbook will be generated and printed by Prodigi.
      </p>
    </div>
  );

  // ============================================
  // SUCCESS STEP
  // ============================================

  const renderSuccessStep = () => (
    <div className="p-6 md:p-8 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckBadgeIcon className="w-10 h-10 text-green-600" />
      </div>
      <h3 className="text-2xl font-serif font-bold text-navy-900 mb-2">Workbook Created!</h3>
      <p className="text-gray-500 mb-6">
        Your personalized Vision Workbook is being generated and will be printed shortly.
        You'll receive an email with tracking information.
      </p>

      {/* Order Recap */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-gray-500">Order ID:</span>
          <span className="font-mono font-bold text-navy-900">{orderId?.slice(0, 8) || 'PENDING'}</span>
        </div>
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-gray-500">Edition:</span>
          <span className="font-bold text-navy-900">{selectedTemplate?.name}</span>
        </div>
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-gray-500">Content:</span>
          <span className="font-bold text-navy-900">
            {wizardState.selectedVisionIds.length} boards • {wizardState.selectedHabitIds.length} habits
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Est. Delivery:</span>
          <span className="font-bold text-navy-900">7-14 Business Days</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Primary CTA */}
        <button
          onClick={() => {
            onSuccess?.();
            onClose();
          }}
          className="w-full bg-navy-900 text-white font-bold py-3 rounded-lg hover:bg-navy-800 transition-colors"
        >
          Back to My Vision Boards
        </button>

        {/* TODO: Digital Preview CTA - integrate PDF viewer later */}
        <button
          disabled
          className="w-full bg-gray-100 text-gray-400 font-medium py-3 rounded-lg cursor-not-allowed"
          title="Coming soon"
        >
          View Digital Workbook (Coming Soon)
        </button>
      </div>
    </div>
  );

  // ============================================
  // MAIN RENDER
  // ============================================

  const steps: WizardStep[] = ['TEMPLATE', 'CUSTOMIZE', 'CONTENT', 'SHIPPING', 'PAYMENT', 'SUCCESS'];
  const currentIndex = steps.indexOf(step);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Progress Bar */}
        <div className="h-1.5 bg-gray-100 flex">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`flex-1 transition-colors duration-300 ${
                i <= currentIndex ? 'bg-navy-900' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'TEMPLATE' && renderTemplateStep()}
          {step === 'CUSTOMIZE' && renderCustomizeStep()}
          {step === 'CONTENT' && renderContentStep()}
          {step === 'SHIPPING' && renderShippingStep()}
          {step === 'PAYMENT' && renderPaymentStep()}
          {step === 'SUCCESS' && renderSuccessStep()}
        </div>
      </div>
    </div>
  );
};

export default WorkbookOrderModal;
