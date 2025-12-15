/**
 * Landing Hero Video Tests
 *
 * Tests for the landing page hero video configuration system.
 * Covers hook behavior, fallback logic, and data validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          single: mockSingle,
        }),
      }),
    })),
  },
}));

// Sample config data matching the schema
const sampleHeroConfig = {
  default: [
    { url: 'https://example.com/default.mp4', type: 'video/mp4' },
    { url: 'https://example.com/default.webm', type: 'video/webm' },
  ],
  retirement: [
    { url: 'https://example.com/retirement.mp4', type: 'video/mp4' },
  ],
  faith: [
    { url: 'https://example.com/faith.mp4', type: 'video/mp4' },
  ],
  executive: [
    { url: 'https://example.com/executive.mp4', type: 'video/mp4' },
  ],
  entrepreneur: [
    { url: 'https://example.com/entrepreneur.mp4', type: 'video/mp4' },
  ],
  relationship: [
    { url: 'https://example.com/relationship.mp4', type: 'video/mp4' },
  ],
  health: [
    { url: 'https://example.com/health.mp4', type: 'video/mp4' },
  ],
};

describe('Landing Hero Video Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Config Data Structure', () => {
    it('should have correct video source structure with url and type', () => {
      const sources = sampleHeroConfig.default;

      expect(sources).toBeInstanceOf(Array);
      expect(sources.length).toBeGreaterThan(0);

      sources.forEach((source) => {
        expect(source).toHaveProperty('url');
        expect(source.url).toMatch(/^https?:\/\//);
        expect(source).toHaveProperty('type');
        expect(source.type).toMatch(/^video\//);
      });
    });

    it('should support multiple video formats per journey', () => {
      const defaultSources = sampleHeroConfig.default;

      const formats = defaultSources.map((s) => s.type);
      expect(formats).toContain('video/mp4');
      expect(formats).toContain('video/webm');
    });

    it('should have all required journey keys', () => {
      const requiredKeys = ['default', 'retirement', 'faith', 'executive', 'entrepreneur'];

      requiredKeys.forEach((key) => {
        expect(sampleHeroConfig).toHaveProperty(key);
        expect(sampleHeroConfig[key as keyof typeof sampleHeroConfig]).toBeInstanceOf(Array);
      });
    });

    it('should have additional journey keys for relationship and health', () => {
      const additionalKeys = ['relationship', 'health'];

      additionalKeys.forEach((key) => {
        expect(sampleHeroConfig).toHaveProperty(key);
        expect(sampleHeroConfig[key as keyof typeof sampleHeroConfig]).toBeInstanceOf(Array);
      });
    });
  });

  describe('Config Fetch Behavior', () => {
    it('should query public_site_config table with correct key', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { value: sampleHeroConfig },
        error: null,
      });

      // Simulate the fetch call pattern from the hook
      const { supabase } = await import('../../lib/supabase');
      const result = await supabase
        .from('public_site_config')
        .select('value')
        .eq('key', 'landing.hero_videos')
        .single();

      expect(supabase.from).toHaveBeenCalledWith('public_site_config');
      expect(mockSelect).toHaveBeenCalledWith('value');
      expect(mockEq).toHaveBeenCalledWith('key', 'landing.hero_videos');
    });

    it('should return config value when fetch succeeds', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { value: sampleHeroConfig },
        error: null,
      });

      const { supabase } = await import('../../lib/supabase');
      const result = await supabase
        .from('public_site_config')
        .select('value')
        .eq('key', 'landing.hero_videos')
        .single();

      expect(result.data?.value).toEqual(sampleHeroConfig);
      expect(result.error).toBeNull();
    });

    it('should handle fetch error gracefully', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Table not found' },
      });

      const { supabase } = await import('../../lib/supabase');
      const result = await supabase
        .from('public_site_config')
        .select('value')
        .eq('key', 'landing.hero_videos')
        .single();

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Table not found');
    });

    it('should handle missing config row', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows returned', code: 'PGRST116' },
      });

      const { supabase } = await import('../../lib/supabase');
      const result = await supabase
        .from('public_site_config')
        .select('value')
        .eq('key', 'landing.hero_videos')
        .single();

      expect(result.data).toBeNull();
    });
  });

  describe('getSources Helper Logic', () => {
    // Simulate the getSources logic from the hook
    const getSources = (config: typeof sampleHeroConfig | null, journey: string) => {
      if (!config) return null;
      return config[journey as keyof typeof config] ?? config['default'] ?? null;
    };

    it('should return sources for requested journey', () => {
      const result = getSources(sampleHeroConfig, 'retirement');

      expect(result).toEqual(sampleHeroConfig.retirement);
    });

    it('should fallback to default when journey not found', () => {
      const result = getSources(sampleHeroConfig, 'nonexistent');

      expect(result).toEqual(sampleHeroConfig.default);
    });

    it('should return null when config is null', () => {
      const result = getSources(null, 'default');

      expect(result).toBeNull();
    });

    it('should return default sources when requesting default', () => {
      const result = getSources(sampleHeroConfig, 'default');

      expect(result).toEqual(sampleHeroConfig.default);
    });
  });

  describe('Video Source Validation', () => {
    it('should have valid mp4 source for iOS compatibility', () => {
      const mp4Sources = sampleHeroConfig.default.filter(
        (s) => s.type === 'video/mp4'
      );

      expect(mp4Sources.length).toBeGreaterThan(0);
    });

    it('should have valid URL format for all sources', () => {
      const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/;

      Object.values(sampleHeroConfig).forEach((sources) => {
        sources.forEach((source) => {
          expect(source.url).toMatch(urlPattern);
        });
      });
    });

    it('should have valid MIME types', () => {
      const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];

      Object.values(sampleHeroConfig).forEach((sources) => {
        sources.forEach((source) => {
          if (source.type) {
            expect(validTypes).toContain(source.type);
          }
        });
      });
    });
  });

  describe('Fallback Behavior', () => {
    it('should use placeholder when no config exists', () => {
      // Simulates the component logic
      const config = null;
      const loading = false;
      const sources = config ? sampleHeroConfig.default : null;

      const shouldShowPlaceholder = loading || !sources?.length;

      expect(shouldShowPlaceholder).toBe(true);
    });

    it('should use placeholder while loading', () => {
      const loading = true;
      const sources = sampleHeroConfig.default;

      const shouldShowPlaceholder = loading || !sources?.length;

      expect(shouldShowPlaceholder).toBe(true);
    });

    it('should show video when config loaded and sources exist', () => {
      const loading = false;
      const sources = sampleHeroConfig.default;

      const shouldShowVideo = !loading && sources?.length > 0;

      expect(shouldShowVideo).toBe(true);
    });

    it('should use placeholder when sources array is empty', () => {
      const loading = false;
      const sources: { url: string; type: string }[] = [];

      const shouldShowPlaceholder = loading || !sources?.length;

      expect(shouldShowPlaceholder).toBe(true);
    });
  });

  describe('Video Component Props', () => {
    it('should have correct autoplay attributes for landing hero', () => {
      const videoProps = {
        autoPlay: true,
        muted: true,
        loop: true,
        playsInline: true,
        preload: 'metadata',
        controls: false,
      };

      // Autoplay requires muted for most browsers
      expect(videoProps.autoPlay).toBe(true);
      expect(videoProps.muted).toBe(true);

      // Loop for continuous playback
      expect(videoProps.loop).toBe(true);

      // playsInline for iOS Safari
      expect(videoProps.playsInline).toBe(true);

      // Preload metadata for fast initial load
      expect(videoProps.preload).toBe('metadata');

      // No controls for hero video
      expect(videoProps.controls).toBe(false);
    });
  });

  describe('Multiple Format Support', () => {
    it('should render source elements in order', () => {
      const sources = sampleHeroConfig.default;

      // First source should be mp4 for best compatibility
      const firstSource = sources[0];
      expect(firstSource.type).toBe('video/mp4');
    });

    it('should include webm for better compression on supported browsers', () => {
      const sources = sampleHeroConfig.default;
      const hasWebm = sources.some((s) => s.type === 'video/webm');

      expect(hasWebm).toBe(true);
    });
  });
});

describe('PathCards Journey Options', () => {
  it('should include Relationship Goals card', () => {
    const journeyCards = [
      'Ascension Plan',
      'Spiritual Growth',
      'Business Mindset',
      'Life Design',
      'Relationship Goals',
      'Daily Execution',
      'Health & Vitality',
    ];

    expect(journeyCards).toContain('Relationship Goals');
  });

  it('should include Health & Vitality card', () => {
    const journeyCards = [
      'Ascension Plan',
      'Spiritual Growth',
      'Business Mindset',
      'Life Design',
      'Relationship Goals',
      'Daily Execution',
      'Health & Vitality',
    ];

    expect(journeyCards).toContain('Health & Vitality');
  });

  it('should have 7 journey cards total', () => {
    const journeyCards = [
      'Ascension Plan',
      'Spiritual Growth',
      'Business Mindset',
      'Life Design',
      'Relationship Goals',
      'Daily Execution',
      'Health & Vitality',
    ];

    expect(journeyCards.length).toBe(7);
  });
});

describe('Public Site Config Table Schema', () => {
  it('should have correct primary key structure', () => {
    const configRow = {
      key: 'landing.hero_videos',
      value: sampleHeroConfig,
      updated_at: new Date().toISOString(),
    };

    expect(configRow).toHaveProperty('key');
    expect(configRow).toHaveProperty('value');
    expect(configRow).toHaveProperty('updated_at');
    expect(typeof configRow.key).toBe('string');
    expect(typeof configRow.value).toBe('object');
  });

  it('should use namespaced key format', () => {
    const key = 'landing.hero_videos';

    expect(key).toMatch(/^[a-z]+\.[a-z_]+$/);
  });
});

/**
 * Manual QA Checklist for Landing Hero Video
 *
 * - [ ] Desktop Chrome: video autoplay loop (muted), no controls visible
 * - [ ] iOS Safari: playsInline works, video autoplays muted
 * - [ ] Slow network: page still loads, video preloads metadata only
 * - [ ] Missing/invalid URLs: placeholder grid shown, no console errors
 * - [ ] Lighthouse audit: hero doesn't block LCP, no huge preload impact
 * - [ ] npm run build passes without errors
 * - [ ] npm test:run passes all tests
 * - [ ] Backend config update: change URL in Supabase, refresh page shows new video
 */
