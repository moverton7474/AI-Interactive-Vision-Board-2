import React, { useState, useMemo } from 'react';
import { VisionImage, Habit } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, XIcon, CheckIcon, BookOpenIcon, SparklesIcon } from './Icons';

// ============================================
// TYPES
// ============================================

interface WorkbookPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  workbookData: {
    title: string;
    subtitle: string;
    dedication?: string;
    edition: string;
    visionBoards: VisionImage[];
    habits: Habit[];
    includedSections: string[];
  };
}

interface PageData {
  type: 'cover' | 'dedication' | 'toc' | 'vision' | 'habits' | 'journal' | 'notes' | 'action_plan' | 'financial';
  title?: string;
  content?: any;
}

// ============================================
// SECTION LABELS
// ============================================

const SECTION_LABELS: Record<string, string> = {
  vision_gallery: 'Vision Gallery',
  coach_letter: 'Letter from Vision Coach',
  financial_snapshot: 'Financial Overview',
  action_plan: '3-Year Roadmap',
  habit_tracker: 'Habit Tracker',
  weekly_journal: 'Weekly Reflection Journal',
  notes: 'Notes & Ideas'
};

// ============================================
// COMPONENT
// ============================================

const WorkbookPreviewModal: React.FC<WorkbookPreviewProps> = ({
  isOpen,
  onClose,
  onApprove,
  workbookData
}) => {
  const [currentPage, setCurrentPage] = useState(0);

  // Generate all pages for the workbook
  const pages = useMemo(() => {
    const allPages: PageData[] = [];

    // Cover page
    allPages.push({
      type: 'cover',
      title: workbookData.title,
      content: { subtitle: workbookData.subtitle, edition: workbookData.edition }
    });

    // Table of Contents
    allPages.push({
      type: 'toc',
      title: 'Table of Contents',
      content: { sections: workbookData.includedSections }
    });

    // Dedication page (if provided)
    if (workbookData.dedication) {
      allPages.push({
        type: 'dedication',
        title: 'Dedication',
        content: { text: workbookData.dedication }
      });
    }

    // Vision board pages
    if (workbookData.includedSections.includes('vision_gallery')) {
      workbookData.visionBoards.forEach((vision, index) => {
        allPages.push({
          type: 'vision',
          title: `Vision Board ${index + 1}`,
          content: vision
        });
      });
    }

    // Coach letter page
    if (workbookData.includedSections.includes('coach_letter')) {
      allPages.push({
        type: 'vision',
        title: 'Letter from Your Vision Coach',
        content: { isCoachLetter: true }
      });
    }

    // Financial snapshot
    if (workbookData.includedSections.includes('financial_snapshot')) {
      allPages.push({
        type: 'financial',
        title: 'Financial & Goal Overview',
        content: {}
      });
    }

    // Action plan pages
    if (workbookData.includedSections.includes('action_plan')) {
      allPages.push({
        type: 'action_plan',
        title: '3-Year Roadmap',
        content: {}
      });
    }

    // Habit tracker pages
    if (workbookData.includedSections.includes('habit_tracker')) {
      allPages.push({
        type: 'habits',
        title: 'Habit Tracker',
        content: { habits: workbookData.habits }
      });
    }

    // Weekly journal pages (sample)
    if (workbookData.includedSections.includes('weekly_journal')) {
      allPages.push({
        type: 'journal',
        title: 'Weekly Reflection Journal',
        content: { weekNumber: 1 }
      });
    }

    // Notes pages
    if (workbookData.includedSections.includes('notes')) {
      allPages.push({
        type: 'notes',
        title: 'Notes & Ideas',
        content: {}
      });
    }

    return allPages;
  }, [workbookData]);

  const totalPages = pages.length;
  const currentPageData = pages[currentPage];

  const goToPage = (index: number) => {
    if (index >= 0 && index < totalPages) {
      setCurrentPage(index);
    }
  };

  const renderCoverPage = (data: PageData) => (
    <div className="h-full bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 flex flex-col items-center justify-center text-white p-8">
      <div className="text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-gold-500/20 rounded-full flex items-center justify-center mb-4">
          <SparklesIcon className="w-8 h-8 text-gold-400" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold">{data.title}</h1>
        <p className="text-xl text-gold-400">{data.content?.subtitle}</p>
        <div className="pt-8">
          <p className="text-sm text-navy-300">{data.content?.edition}</p>
        </div>
      </div>
    </div>
  );

  const renderTableOfContents = (data: PageData) => (
    <div className="h-full bg-white p-8 flex flex-col">
      <h2 className="text-2xl font-serif font-bold text-navy-900 mb-8 text-center">
        Table of Contents
      </h2>
      <div className="flex-1 space-y-4">
        {data.content?.sections?.map((sectionId: string, index: number) => (
          <div key={sectionId} className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-navy-900 font-medium">
              {SECTION_LABELS[sectionId] || sectionId}
            </span>
            <span className="text-gray-400 text-sm">{index + 3}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDedicationPage = (data: PageData) => (
    <div className="h-full bg-cream-50 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <p className="text-lg font-serif italic text-navy-800 leading-relaxed">
          "{data.content?.text}"
        </p>
      </div>
    </div>
  );

  const renderVisionPage = (data: PageData) => {
    if (data.content?.isCoachLetter) {
      return (
        <div className="h-full bg-white p-8 flex flex-col">
          <h2 className="text-xl font-serif font-bold text-navy-900 mb-6">
            Letter from Your Vision Coach
          </h2>
          <div className="flex-1 bg-gray-50 rounded-lg p-6">
            <p className="text-gray-600 italic text-sm">
              A personalized letter will be generated based on your vision and goals,
              offering encouragement and guidance for your journey ahead.
            </p>
          </div>
        </div>
      );
    }

    const vision = data.content as VisionImage;
    const hasValidImage = vision?.url &&
      !vision.url.startsWith('data:image/svg+xml') &&
      vision.url.startsWith('http');

    // Show placeholder if no valid image
    if (!hasValidImage) {
      return (
        <div className="h-full bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-gold-500/20 rounded-full flex items-center justify-center mb-4">
                <SparklesIcon className="w-8 h-8 text-gold-400" />
              </div>
              <h3 className="text-xl font-serif font-bold text-white mb-2">{data.title}</h3>
              <p className="text-sm text-white/70 max-w-xs mx-auto line-clamp-4">
                {vision?.prompt?.slice(0, 150)}
                {(vision?.prompt?.length || 0) > 150 ? '...' : ''}
              </p>
              <div className="mt-4 px-3 py-1.5 bg-amber-500/20 rounded-lg inline-block">
                <p className="text-xs text-amber-300">
                  Image generation pending - regenerate from Dashboard
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full bg-white flex flex-col">
        <div className="flex-1 relative">
          <img
            src={vision?.url}
            alt={vision?.prompt || 'Vision Board'}
            className="w-full h-full object-cover"
            onLoad={() => console.log('Image loaded successfully:', vision?.url)}
            onError={(e) => {
              console.error('Image failed to load:', vision?.url);
              // Hide broken image and show fallback
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `
                  <div class="w-full h-full bg-gradient-to-br from-navy-900 to-navy-800 flex items-center justify-center">
                    <div class="text-center p-6">
                      <div class="text-4xl mb-2">✨</div>
                      <p class="text-white/70 text-sm">Image unavailable</p>
                    </div>
                  </div>
                `;
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <h3 className="text-xl font-serif font-bold mb-2">{data.title}</h3>
            <p className="text-sm text-white/80 line-clamp-2">
              {vision?.prompt?.slice(0, 100)}
              {(vision?.prompt?.length || 0) > 100 ? '...' : ''}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderHabitsPage = (data: PageData) => (
    <div className="h-full bg-white p-8 flex flex-col">
      <h2 className="text-xl font-serif font-bold text-navy-900 mb-6">
        12-Month Habit Tracker
      </h2>
      <div className="flex-1 space-y-4">
        {data.content?.habits?.map((habit: Habit) => (
          <div key={habit.id} className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-bold text-navy-900">{habit.title}</h4>
            <p className="text-sm text-gray-500">{habit.description}</p>
            {/* Mini grid preview */}
            <div className="mt-3 grid grid-cols-7 gap-1">
              {Array(7).fill(0).map((_, i) => (
                <div key={i} className="w-4 h-4 border border-gray-300 rounded" />
              ))}
            </div>
          </div>
        )) || (
            <p className="text-gray-400 italic">
              Habit tracking grids will appear here for each month.
            </p>
          )}
      </div>
    </div>
  );

  const renderJournalPage = (data: PageData) => (
    <div className="h-full bg-white p-8 flex flex-col">
      <h2 className="text-xl font-serif font-bold text-navy-900 mb-2">
        Week {data.content?.weekNumber || 1} Reflection
      </h2>
      <p className="text-sm text-gray-500 mb-6">52-week guided reflection journal</p>
      <div className="flex-1 space-y-4">
        <div className="border-b border-gray-200 pb-4">
          <label className="text-sm font-medium text-navy-900">What progress did I make this week?</label>
          <div className="mt-2 h-12 bg-gray-50 rounded border border-gray-200" />
        </div>
        <div className="border-b border-gray-200 pb-4">
          <label className="text-sm font-medium text-navy-900">What am I grateful for?</label>
          <div className="mt-2 h-12 bg-gray-50 rounded border border-gray-200" />
        </div>
        <div className="border-b border-gray-200 pb-4">
          <label className="text-sm font-medium text-navy-900">What will I focus on next week?</label>
          <div className="mt-2 h-12 bg-gray-50 rounded border border-gray-200" />
        </div>
      </div>
    </div>
  );

  const renderActionPlanPage = () => (
    <div className="h-full bg-white p-8 flex flex-col">
      <h2 className="text-xl font-serif font-bold text-navy-900 mb-6">
        3-Year Action Roadmap
      </h2>
      <div className="flex-1 space-y-4">
        {[1, 2, 3].map(year => (
          <div key={year} className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-bold text-navy-900 mb-2">Year {year}</h4>
            <div className="space-y-2">
              {[1, 2, 3].map(task => (
                <div key={task} className="flex items-center gap-2">
                  <div className="w-4 h-4 border border-gray-300 rounded" />
                  <div className="h-3 bg-gray-200 rounded flex-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFinancialPage = () => (
    <div className="h-full bg-white p-8 flex flex-col">
      <h2 className="text-xl font-serif font-bold text-navy-900 mb-6">
        Financial & Goal Overview
      </h2>
      <div className="flex-1 bg-gray-50 rounded-lg p-6">
        <p className="text-gray-600 italic text-sm">
          A snapshot of your financial goals and projections will appear here,
          including progress tracking and milestone charts.
        </p>
        <div className="mt-6 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
          <span className="text-gray-400">Chart Preview</span>
        </div>
      </div>
    </div>
  );

  const renderNotesPage = () => (
    <div className="h-full bg-white p-8 flex flex-col">
      <h2 className="text-xl font-serif font-bold text-navy-900 mb-6">
        Notes & Ideas
      </h2>
      <div className="flex-1 bg-[repeating-linear-gradient(transparent,transparent_27px,#e5e7eb_28px)] border border-gray-200 rounded-lg" />
    </div>
  );

  const renderPage = (page: PageData) => {
    switch (page.type) {
      case 'cover':
        return renderCoverPage(page);
      case 'toc':
        return renderTableOfContents(page);
      case 'dedication':
        return renderDedicationPage(page);
      case 'vision':
        return renderVisionPage(page);
      case 'habits':
        return renderHabitsPage(page);
      case 'journal':
        return renderJournalPage(page);
      case 'action_plan':
        return renderActionPlanPage();
      case 'financial':
        return renderFinancialPage();
      case 'notes':
        return renderNotesPage();
      default:
        return <div className="h-full bg-white" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-100 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpenIcon className="w-6 h-6 text-navy-900" />
            <div>
              <h2 className="text-lg font-bold text-navy-900">Workbook Preview</h2>
              <p className="text-sm text-gray-500">Review your workbook before ordering</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Page Preview */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="relative h-full">
            {/* Page Container - Simulates book aspect ratio */}
            <div className="mx-auto h-full max-w-md aspect-[8.5/11] bg-white rounded-lg shadow-xl overflow-hidden">
              {renderPage(currentPageData)}
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Page Navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 0}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="w-5 h-5 text-navy-900" />
              </button>

              <span className="text-sm text-gray-600">
                Page {currentPage + 1} of {totalPages}
              </span>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon className="w-5 h-5 text-navy-900" />
              </button>
            </div>

            {/* Page Indicator Dots */}
            <div className="hidden md:flex items-center gap-1 max-w-xs overflow-x-auto">
              {pages.slice(0, 10).map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToPage(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${index === currentPage
                      ? 'bg-navy-900'
                      : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                />
              ))}
              {pages.length > 10 && (
                <span className="text-xs text-gray-400 ml-1">+{pages.length - 10}</span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Back to Edit
              </button>
              <button
                onClick={onApprove}
                className="px-6 py-2 bg-navy-900 text-white text-sm font-bold rounded-lg hover:bg-navy-800 transition-colors flex items-center gap-2"
              >
                <CheckIcon className="w-4 h-4" />
                Approve & Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkbookPreviewModal;
