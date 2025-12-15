import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface VideoSource {
  url: string;
  type?: string;
}

type JourneyKey = 'default' | 'retirement' | 'faith' | 'executive' | 'entrepreneur' | 'relationship' | 'health';

type HeroVideosConfig = Record<JourneyKey, VideoSource[]>;

const JOURNEY_LABELS: Record<JourneyKey, string> = {
  default: 'Default (Landing Page)',
  retirement: 'Retirement Journey',
  faith: 'Faith & Spiritual',
  executive: 'Executive Leadership',
  entrepreneur: 'Entrepreneur',
  relationship: 'Relationship Goals',
  health: 'Health & Vitality'
};

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * SiteSettingsManager - Admin panel for managing landing page assets
 *
 * Allows platform admins to:
 * - Upload hero videos to Supabase Storage
 * - Preview current hero videos
 * - Update video URLs in public_site_config
 */
const SiteSettingsManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<JourneyKey | null>(null);
  const [config, setConfig] = useState<HeroVideosConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeJourney, setActiveJourney] = useState<JourneyKey>('default');
  const [previewKey, setPreviewKey] = useState(0); // Force video reload

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current config
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('public_site_config')
        .select('value')
        .eq('key', 'landing.hero_videos')
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No row found - initialize empty config
          setConfig({
            default: [],
            retirement: [],
            faith: [],
            executive: [],
            entrepreneur: [],
            relationship: [],
            health: []
          });
        } else {
          throw fetchError;
        }
      } else {
        setConfig(data?.value as HeroVideosConfig || {
          default: [],
          retirement: [],
          faith: [],
          executive: [],
          entrepreneur: [],
          relationship: [],
          health: []
        });
      }
    } catch (err: any) {
      console.error('Error loading config:', err);
      setError('Failed to load hero video configuration');
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file (MP4, WebM, etc.)');
      return;
    }

    // Validate file size
    if (file.size > MAX_VIDEO_SIZE) {
      setError(`Video file too large. Maximum size is ${MAX_VIDEO_SIZE / 1024 / 1024}MB`);
      return;
    }

    setError(null);
    setSuccess(null);
    setUploading(activeJourney);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Determine file extension and MIME type
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const mimeType = file.type || `video/${ext}`;
      const fileName = `landing/${activeJourney}.${ext}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('public-videos')
        .upload(fileName, file, {
          contentType: mimeType,
          upsert: true // Overwrite if exists
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message || 'Failed to upload video');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('public-videos')
        .getPublicUrl(fileName);

      // Update config with new URL
      const newSources: VideoSource[] = [
        { url: urlData.publicUrl, type: mimeType }
      ];

      // Keep existing formats if they're different
      const existingSources = config?.[activeJourney] || [];
      existingSources.forEach(source => {
        if (source.type !== mimeType && source.url) {
          newSources.push(source);
        }
      });

      const updatedConfig = {
        ...config,
        [activeJourney]: newSources
      } as HeroVideosConfig;

      // Save to database
      await saveConfig(updatedConfig);

      setSuccess(`Video uploaded successfully for ${JOURNEY_LABELS[activeJourney]}`);
      setPreviewKey(prev => prev + 1); // Force video reload
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload video');
    } finally {
      setUploading(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [activeJourney, config]);

  // Save config to database
  const saveConfig = async (newConfig: HeroVideosConfig) => {
    setSaving(true);
    setError(null);

    try {
      // Upsert the config
      const { error: upsertError } = await supabase
        .from('public_site_config')
        .upsert({
          key: 'landing.hero_videos',
          value: newConfig,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (upsertError) throw upsertError;

      setConfig(newConfig);
    } catch (err: any) {
      console.error('Save error:', err);
      throw new Error(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Remove video for journey
  const handleRemoveVideo = async (journey: JourneyKey) => {
    if (!config) return;

    if (!confirm(`Remove hero video for ${JOURNEY_LABELS[journey]}?`)) return;

    setError(null);
    setSuccess(null);

    try {
      const updatedConfig = {
        ...config,
        [journey]: []
      } as HeroVideosConfig;

      await saveConfig(updatedConfig);
      setSuccess(`Video removed for ${JOURNEY_LABELS[journey]}`);
      setPreviewKey(prev => prev + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to remove video');
    }
  };

  // Get current video URL for journey
  const getVideoUrl = (journey: JourneyKey): string | null => {
    const sources = config?.[journey];
    if (!sources?.length) return null;
    // Prefer MP4 for preview
    const mp4 = sources.find(s => s.type?.includes('mp4'));
    return mp4?.url || sources[0]?.url || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-200">Loading site settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h2 className="text-xl font-semibold text-white mb-2">Hero Video Manager</h2>
        <p className="text-indigo-200 text-sm">
          Upload and manage hero videos for the landing page. Videos will autoplay (muted) in the hero section.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200 flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-200 flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{success}</span>
        </div>
      )}

      {/* Journey Selector */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h3 className="text-lg font-medium text-white mb-4">Select Journey Type</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(JOURNEY_LABELS) as JourneyKey[]).map((journey) => {
            const hasVideo = (config?.[journey]?.length || 0) > 0;
            return (
              <button
                key={journey}
                onClick={() => setActiveJourney(journey)}
                className={`p-3 rounded-lg text-left transition-all ${
                  activeJourney === journey
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white/5 text-indigo-200 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{JOURNEY_LABELS[journey]}</span>
                  {hasVideo && (
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Video Upload & Preview */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h3 className="text-lg font-medium text-white mb-4">
          {JOURNEY_LABELS[activeJourney]} Video
        </h3>

        {/* Current Video Preview */}
        {getVideoUrl(activeJourney) ? (
          <div className="mb-6">
            <p className="text-sm text-indigo-200 mb-3">Current Video:</p>
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video max-w-2xl">
              <video
                key={`${activeJourney}-${previewKey}`}
                src={getVideoUrl(activeJourney) || ''}
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                controls
              />
              <button
                onClick={() => handleRemoveVideo(activeJourney)}
                className="absolute top-3 right-3 p-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-white transition-colors"
                title="Remove video"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-indigo-300 mt-2 break-all">
              URL: {getVideoUrl(activeJourney)}
            </p>
          </div>
        ) : (
          <div className="mb-6 p-8 bg-white/5 rounded-xl border-2 border-dashed border-white/20 text-center">
            <svg className="w-12 h-12 text-indigo-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-indigo-200">No video uploaded for this journey</p>
            <p className="text-xs text-indigo-300 mt-1">Upload a video below to set the hero video</p>
          </div>
        )}

        {/* Upload Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-2">
              Upload New Video
            </label>
            <p className="text-xs text-indigo-300 mb-3">
              Recommended: MP4 (H.264), 1920x1080 or 1280x720, under 20MB for fast loading
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
              uploading
                ? 'border-indigo-400 bg-indigo-500/10'
                : 'border-white/20 hover:border-indigo-400 hover:bg-white/5'
            }`}
          >
            {uploading === activeJourney ? (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-indigo-200">Uploading video...</p>
                <p className="text-xs text-indigo-300 mt-1">This may take a moment for large files</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <svg className="w-10 h-10 text-indigo-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-indigo-200 font-medium">Click to upload video</p>
                <p className="text-xs text-indigo-300 mt-1">MP4, WebM • Max 50MB</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
        <h4 className="text-blue-300 font-medium mb-3">Video Format Guidelines</h4>
        <ul className="text-sm text-blue-200 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span><strong>MP4 (H.264)</strong> - Best compatibility across all devices including iOS Safari</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span><strong>WebM (VP9)</strong> - Better compression, good for desktop browsers</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span><strong>Resolution</strong> - 1920x1080 or 1280x720 recommended</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span><strong>Duration</strong> - 10-30 seconds works best for hero loops</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span><strong>File size</strong> - Keep under 20MB for fast loading</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default SiteSettingsManager;
