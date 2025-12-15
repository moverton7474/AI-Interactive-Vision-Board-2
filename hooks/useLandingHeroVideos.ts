/**
 * useLandingHeroVideos Hook
 *
 * Fetches backend-configurable hero video sources for the landing page.
 * Supports multiple video formats (mp4/webm) per journey type.
 * Falls back gracefully when config is unavailable.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export type VideoSource = {
  url: string;
  type?: string;
};

export type JourneyKey =
  | 'default'
  | 'retirement'
  | 'faith'
  | 'executive'
  | 'entrepreneur'
  | 'relationship'
  | 'health';

export type LandingHeroVideosConfig = Record<JourneyKey, VideoSource[]>;

const CONFIG_KEY = 'landing.hero_videos';

export function useLandingHeroVideos() {
  const [config, setConfig] = useState<LandingHeroVideosConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('public_site_config')
          .select('value')
          .eq('key', CONFIG_KEY)
          .single();

        if (!mounted) return;

        if (fetchError) {
          // Table may not exist yet or no row found - this is expected in dev
          console.warn('Landing hero videos config load failed:', fetchError.message);
          setError(new Error(fetchError.message));
          setConfig(null);
        } else {
          const value = (data?.value ?? null) as LandingHeroVideosConfig | null;
          setConfig(value);
          setError(null);
        }
      } catch (e) {
        if (!mounted) return;
        console.warn('Landing hero videos config error:', e);
        setError(e instanceof Error ? e : new Error('Unknown error'));
        setConfig(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Get video sources for a specific journey.
   * Falls back to 'default' journey if specified journey not found.
   * Returns null if no config available.
   */
  const getSources = useMemo(() => {
    return (journey: JourneyKey = 'default'): VideoSource[] | null => {
      if (!config) return null;
      return config[journey] ?? config['default'] ?? null;
    };
  }, [config]);

  /**
   * Check if valid video sources exist for any journey
   */
  const hasVideos = useMemo(() => {
    if (!config) return false;
    return Object.values(config).some(
      (sources) => Array.isArray(sources) && sources.length > 0
    );
  }, [config]);

  return {
    config,
    loading,
    error,
    getSources,
    hasVideos,
  };
}

export default useLandingHeroVideos;
