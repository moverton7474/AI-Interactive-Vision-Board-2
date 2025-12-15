import React, { useState, useEffect } from 'react';
import { MotivationalTheme } from '../types';
import { supabase } from '../lib/supabase';
import { SparklesIcon, CheckIcon, VisionaryIcon } from './Icons';

interface Props {
  onSelect: (theme: MotivationalTheme) => void;
  onSkip?: () => void;
  selectedThemeId?: string;
}

/**
 * ThemeSelector - Visionary AI Coaching Style Selection
 *
 * Displays motivational themes as cards and allows users to select
 * their preferred coaching style for their ascension journey.
 */
const ThemeSelector: React.FC<Props> = ({ onSelect, onSkip, selectedThemeId }) => {
  const [themes, setThemes] = useState<MotivationalTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchThemes();
  }, []);

  const fetchThemes = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.functions.invoke('onboarding-themes', {
        body: {},
        headers: {},
      });

      // Parse the action from URL - default to list
      const response = await supabase.functions.invoke('onboarding-themes?action=list', {
        method: 'GET',
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch themes');
      }

      if (response.data?.themes) {
        setThemes(response.data.themes);
      }
    } catch (err: any) {
      console.error('Error fetching themes:', err);
      setError(err.message || 'Failed to load themes');

      // Fallback to hardcoded themes if API fails
      setThemes(FALLBACK_THEMES);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (theme: MotivationalTheme) => {
    try {
      setSelecting(theme.id);
      setError(null);

      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Save selection to backend
        const response = await supabase.functions.invoke('onboarding-themes?action=select', {
          body: { themeId: theme.id },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.error) {
          console.error('Error saving theme selection:', response.error);
          // Continue anyway - we can save later
        }
      }

      // Notify parent component
      onSelect(theme);
    } catch (err: any) {
      console.error('Error selecting theme:', err);
      // Still notify parent even if save fails
      onSelect(theme);
    } finally {
      setSelecting(null);
    }
  };

  const getThemeGradient = (theme: MotivationalTheme): string => {
    const gradients: Record<string, string> = {
      christian: 'from-amber-500 to-yellow-600',
      business_executive: 'from-slate-600 to-slate-800',
      health_fitness: 'from-emerald-500 to-teal-600',
      retirement: 'from-orange-400 to-rose-500',
      custom: 'from-violet-500 to-purple-600',
    };
    return gradients[theme.name] || 'from-indigo-500 to-purple-600';
  };

  const getThemeBgColor = (theme: MotivationalTheme): string => {
    const colors: Record<string, string> = {
      christian: 'bg-amber-50 hover:bg-amber-100',
      business_executive: 'bg-slate-50 hover:bg-slate-100',
      health_fitness: 'bg-emerald-50 hover:bg-emerald-100',
      retirement: 'bg-orange-50 hover:bg-orange-100',
      custom: 'bg-violet-50 hover:bg-violet-100',
    };
    return colors[theme.name] || 'bg-indigo-50 hover:bg-indigo-100';
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-charcoal-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading coaching styles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 animate-fade-in bg-gradient-to-br from-navy-950 via-navy-900 to-charcoal-900">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-gold-500/10 border border-gold-500/30 text-gold-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <VisionaryIcon size={16} color="#C5A572" />
            Visionary AI Coach
          </div>
          <h1 className="text-4xl font-serif font-bold text-white mb-4">
            Choose Your Ascension Style
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Your AI coach will adapt its personality, language, and motivation techniques
            based on your selection. This creates a truly personalized ascension journey.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        {/* Theme Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {themes.map((theme) => {
            const isSelected = selectedThemeId === theme.id;
            const isSelecting = selecting === theme.id;

            return (
              <button
                key={theme.id}
                onClick={() => handleSelect(theme)}
                disabled={isSelecting}
                className={`
                  relative bg-charcoal-800 rounded-2xl shadow-md border-2 transition-all text-left overflow-hidden
                  ${isSelected ? 'border-gold-500 ring-2 ring-gold-500/20' : 'border-gold-500/10 hover:border-gold-500/40'}
                  ${isSelecting ? 'opacity-75' : 'hover:shadow-xl hover:-translate-y-1'}
                `}
              >
                {/* Gradient Header */}
                <div className={`h-24 bg-gradient-to-br ${getThemeGradient(theme)} flex items-center justify-center`}>
                  <span className="text-5xl">{theme.icon}</span>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="font-bold text-xl text-white mb-2">
                    {theme.display_name}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                    {theme.description}
                  </p>

                  {/* Feature Tags */}
                  <div className="flex flex-wrap gap-2">
                    {theme.include_scripture && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full border border-amber-500/30">
                        Scripture
                      </span>
                    )}
                    {theme.include_metrics && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">
                        Metrics
                      </span>
                    )}
                    {theme.include_wellness && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">
                        Wellness
                      </span>
                    )}
                    {theme.include_legacy && (
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full border border-purple-500/30">
                        Legacy
                      </span>
                    )}
                  </div>

                  {/* Coaching Style Badge */}
                  <div className="mt-4 pt-4 border-t border-gold-500/10">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Ascension Style
                    </span>
                    <p className="text-sm font-medium text-gold-400 capitalize mt-1">
                      {theme.motivation_style}
                    </p>
                  </div>
                </div>

                {/* Selected Indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-gold-500 text-navy-900 p-1 rounded-full">
                    <CheckIcon className="w-4 h-4" />
                  </div>
                )}

                {/* Loading Indicator */}
                {isSelecting && (
                  <div className="absolute inset-0 bg-charcoal-800/80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Skip Option */}
        {onSkip && (
          <div className="mt-10 text-center">
            <button
              onClick={onSkip}
              className="text-gray-500 hover:text-gold-400 text-sm font-medium transition-colors"
            >
              Skip for now, I'll choose later
            </button>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-10 text-center text-sm text-gray-500">
          <p>You can change your ascension style anytime in Settings.</p>
        </div>
      </div>
    </div>
  );
};

// Fallback themes if API fails
const FALLBACK_THEMES: MotivationalTheme[] = [
  {
    id: 'fallback-christian',
    name: 'christian',
    display_name: 'Faith & Purpose',
    description: 'Faith-based motivation with biblical wisdom and stewardship principles. Your AI coach will integrate scripture references, prayer prompts, and Christian values into guidance.',
    icon: '✝️',
    color_scheme: { primary: '#f59e0b', secondary: '#d97706' },
    system_prompt_template: '',
    motivation_style: 'spiritual',
    vocabulary_examples: [],
    content_sources: [],
    include_scripture: true,
    include_metrics: false,
    include_wellness: false,
    include_legacy: true,
    is_active: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-business',
    name: 'business_executive',
    display_name: 'Executive Performance',
    description: 'High-performance coaching for ambitious professionals and leaders. Your AI coach will use business strategy language, ROI thinking, and leadership frameworks.',
    icon: '💼',
    color_scheme: { primary: '#475569', secondary: '#334155' },
    system_prompt_template: '',
    motivation_style: 'challenging',
    vocabulary_examples: [],
    content_sources: [],
    include_scripture: false,
    include_metrics: true,
    include_wellness: false,
    include_legacy: false,
    is_active: true,
    sort_order: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-health',
    name: 'health_fitness',
    display_name: 'Health & Vitality',
    description: 'Wellness-focused motivation for physical and mental optimization. Your AI coach will emphasize mind-body connection, sustainable habits, and energy management.',
    icon: '💪',
    color_scheme: { primary: '#10b981', secondary: '#059669' },
    system_prompt_template: '',
    motivation_style: 'encouraging',
    vocabulary_examples: [],
    content_sources: [],
    include_scripture: false,
    include_metrics: false,
    include_wellness: true,
    include_legacy: false,
    is_active: true,
    sort_order: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-retirement',
    name: 'retirement',
    display_name: 'Legacy & Wisdom',
    description: 'Life transition coaching for meaningful retirement and legacy building. Your AI coach will balance practical planning with deeper purpose and family focus.',
    icon: '🌅',
    color_scheme: { primary: '#fb923c', secondary: '#f43f5e' },
    system_prompt_template: '',
    motivation_style: 'analytical',
    vocabulary_examples: [],
    content_sources: [],
    include_scripture: false,
    include_metrics: true,
    include_wellness: false,
    include_legacy: true,
    is_active: true,
    sort_order: 4,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-custom',
    name: 'custom',
    display_name: 'Custom Theme',
    description: 'Fully personalized coaching based on your uploaded materials and stated preferences. Your AI coach will adapt entirely to your unique background and values.',
    icon: '⚙️',
    color_scheme: { primary: '#8b5cf6', secondary: '#7c3aed' },
    system_prompt_template: '',
    motivation_style: 'encouraging',
    vocabulary_examples: [],
    content_sources: [],
    include_scripture: false,
    include_metrics: false,
    include_wellness: false,
    include_legacy: false,
    is_active: true,
    sort_order: 5,
    created_at: new Date().toISOString(),
  },
];

export default ThemeSelector;
