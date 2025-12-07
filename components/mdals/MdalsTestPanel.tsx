import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  MdalsSongSourceType,
  MdalsSongReference,
  MdalsLearningPlanDay,
  MdalsAnalyzeSongResponse,
  MdalsGeneratePlanResponse
} from '../../types';

interface MdalsTestPanelProps {
  userId: string;
  onClose?: () => void;
}

// Song suggestion from AI finder
interface SongSuggestion {
  title: string;
  artist: string;
  album?: string;
  year?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  genre?: string;
  search_tip?: string;
}

// Genre options for song finder
const GENRE_OPTIONS = [
  { value: 'christian', label: 'Christian/Gospel' },
  { value: 'worship', label: 'Worship' },
  { value: 'pop', label: 'Pop' },
  { value: 'rock', label: 'Rock' },
  { value: 'r&b', label: 'R&B/Soul' },
  { value: 'country', label: 'Country' },
  { value: 'hip-hop', label: 'Hip-Hop' },
  { value: 'classical', label: 'Classical' },
];

// Available domains for learning
const DOMAIN_OPTIONS = [
  { value: 'spiritual', label: 'Spiritual / Christian' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'business', label: 'Business' },
  { value: 'personal-growth', label: 'Personal Growth' },
  { value: 'healing', label: 'Healing / Emotional' },
  { value: 'relationships', label: 'Relationships' },
];

// Source type options
const SOURCE_OPTIONS: { value: MdalsSongSourceType; label: string }[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple', label: 'Apple Music' },
  { value: 'manual', label: 'Manual Entry' },
  { value: 'other', label: 'Other' },
];

const MdalsTestPanel: React.FC<MdalsTestPanelProps> = ({ userId, onClose }) => {
  // Song Finder state
  const [showSongFinder, setShowSongFinder] = useState(false);
  const [songDescription, setSongDescription] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [songMood, setSongMood] = useState('');
  const [songEra, setSongEra] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [songSuggestions, setSongSuggestions] = useState<SongSuggestion[]>([]);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([]);

  // Form state
  const [songTitle, setSongTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [sourceType, setSourceType] = useState<MdalsSongSourceType>('youtube');
  const [sourceUrl, setSourceUrl] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<string[]>(['spiritual']);
  const [goalDescription, setGoalDescription] = useState('');
  const [durationDays, setDurationDays] = useState(7);

  // Analysis result state
  const [analysisResult, setAnalysisResult] = useState<MdalsAnalyzeSongResponse | null>(null);
  const [planResult, setPlanResult] = useState<MdalsGeneratePlanResponse | null>(null);

  // Loading states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle domain selection
  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev =>
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    );
  };

  // Toggle genre selection for song finder
  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  // AI Song Finder search
  const handleFindSong = async () => {
    if (!songDescription.trim() || songDescription.trim().length < 10) {
      setError('Please describe the song in more detail (at least 10 characters)');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSongSuggestions([]);
    setClarifyingQuestions([]);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('mdals-engine/find-song', {
        body: {
          description: songDescription.trim(),
          genres: selectedGenres.length > 0 ? selectedGenres : undefined,
          mood: songMood.trim() || undefined,
          era: songEra.trim() || undefined,
        }
      });

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error || 'Song search failed');

      setSongSuggestions(data.suggestions || []);
      setClarifyingQuestions(data.clarifying_questions || []);
    } catch (err: any) {
      console.error('Song finder error:', err);
      setError(err.message || 'Failed to find song');
    } finally {
      setIsSearching(false);
    }
  };

  // Select a song suggestion and populate the form
  const handleSelectSuggestion = (suggestion: SongSuggestion) => {
    setSongTitle(suggestion.title);
    setArtist(suggestion.artist);
    setSongSuggestions([]);
    setClarifyingQuestions([]);
    setShowSongFinder(false);
    setSongDescription('');
    setSelectedGenres([]);
    setSongMood('');
    setSongEra('');
  };

  // Analyze song
  const handleAnalyzeSong = async () => {
    if (!songTitle.trim()) {
      setError('Song title is required');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setPlanResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('mdals-engine/analyze-song', {
        body: {
          song: {
            title: songTitle.trim(),
            artist: artist.trim() || undefined,
            source_type: sourceType,
            source_url: sourceUrl.trim() || undefined,
          },
          user_id: userId,
          domain_preferences: selectedDomains,
          user_notes: userNotes.trim() || undefined,
        }
      });

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error || 'Analysis failed');

      setAnalysisResult(data);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze song');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate learning plan
  const handleGeneratePlan = async () => {
    if (!analysisResult?.song_id) {
      setError('Please analyze a song first');
      return;
    }
    if (!goalDescription.trim()) {
      setError('Goal description is required');
      return;
    }

    setIsGeneratingPlan(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('mdals-engine/generate-plan', {
        body: {
          user_id: userId,
          song_id: analysisResult.song_id,
          goal_description: goalDescription.trim(),
          duration_days: durationDays,
          domain_preferences: selectedDomains,
        }
      });

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error || 'Plan generation failed');

      setPlanResult(data);
    } catch (err: any) {
      console.error('Plan generation error:', err);
      setError(err.message || 'Failed to generate plan');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setSongTitle('');
    setArtist('');
    setSourceType('youtube');
    setSourceUrl('');
    setUserNotes('');
    setGoalDescription('');
    setDurationDays(7);
    setAnalysisResult(null);
    setPlanResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-indigo-400">MDALS Engine Lab</h1>
            <p className="text-gray-400 mt-1">Music-Driven Adaptive Learning Systems - Test Panel</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-gray-800"
            >
              Close
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* AI Song Finder */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <button
            onClick={() => setShowSongFinder(!showSongFinder)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔍</span>
              <div>
                <h2 className="text-lg font-semibold text-yellow-400">Can't Remember the Song?</h2>
                <p className="text-sm text-gray-400">Let AI help you find it from your description</p>
              </div>
            </div>
            <span className="text-gray-400 text-xl">{showSongFinder ? '▼' : '▶'}</span>
          </button>

          {showSongFinder && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              {/* Song Description */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Describe the song you're looking for
                </label>
                <textarea
                  value={songDescription}
                  onChange={(e) => setSongDescription(e.target.value)}
                  placeholder="e.g., 'That Christian song about chains being gone and freedom' or 'The Hillsong song about trusting God in the deep water' or 'A worship song from the 2000s about surrender'"
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Include any details you remember: lyrics themes, artist hints, genre, era, mood, etc.
                </p>
              </div>

              {/* Genre Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Genre (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {GENRE_OPTIONS.map(genre => (
                    <button
                      key={genre.value}
                      onClick={() => toggleGenre(genre.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedGenres.includes(genre.value)
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {genre.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Mood/Feel (optional)
                  </label>
                  <input
                    type="text"
                    value={songMood}
                    onChange={(e) => setSongMood(e.target.value)}
                    placeholder="e.g., uplifting, peaceful, powerful"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Era/Time Period (optional)
                  </label>
                  <input
                    type="text"
                    value={songEra}
                    onChange={(e) => setSongEra(e.target.value)}
                    placeholder="e.g., 2010s, 90s, recent"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Search Button */}
              <button
                onClick={handleFindSong}
                disabled={isSearching || songDescription.trim().length < 10}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {isSearching ? 'Searching...' : 'Find My Song'}
              </button>

              {/* Song Suggestions */}
              {songSuggestions.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">
                    Possible Matches (click to select):
                  </h3>
                  <div className="space-y-3">
                    {songSuggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors border border-gray-600 hover:border-yellow-500"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{suggestion.title}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                suggestion.confidence === 'high'
                                  ? 'bg-green-900 text-green-200'
                                  : suggestion.confidence === 'medium'
                                  ? 'bg-yellow-900 text-yellow-200'
                                  : 'bg-gray-600 text-gray-300'
                              }`}>
                                {suggestion.confidence}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400">
                              by {suggestion.artist}
                              {suggestion.year && ` (${suggestion.year})`}
                              {suggestion.genre && ` • ${suggestion.genre}`}
                            </p>
                            <p className="text-sm text-gray-300 mt-1">{suggestion.reason}</p>
                            {suggestion.search_tip && (
                              <p className="text-xs text-gray-500 mt-1 italic">{suggestion.search_tip}</p>
                            )}
                          </div>
                          <span className="text-yellow-400 ml-4">Select →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clarifying Questions */}
              {clarifyingQuestions.length > 0 && (
                <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-300 mb-2">
                    To help narrow down your search:
                  </h4>
                  <ul className="list-disc list-inside text-sm text-blue-200 space-y-1">
                    {clarifyingQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Song Input Form */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-indigo-300">Step 1: Add a Song</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Song Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Song Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="e.g., Amazing Grace"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Artist */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Artist
              </label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g., Chris Tomlin"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Source Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Source
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as MdalsSongSourceType)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {SOURCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Source URL */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Link (optional)
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* User Notes */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              What does this song mean to you?
            </label>
            <textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Share your personal connection to this song..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Domain Selection */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Learning Domains
            </label>
            <div className="flex flex-wrap gap-2">
              {DOMAIN_OPTIONS.map(domain => (
                <button
                  key={domain.value}
                  onClick={() => toggleDomain(domain.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedDomains.includes(domain.value)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {domain.label}
                </button>
              ))}
            </div>
          </div>

          {/* Analyze Button */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleAnalyzeSong}
              disabled={isAnalyzing || !songTitle.trim()}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Song'}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Analysis Results */}
        {analysisResult && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-green-400">Song Analysis Results</h2>

            {/* Summary */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Summary</h3>
              <p className="text-gray-200">{analysisResult.summary}</p>
            </div>

            {/* Themes */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Themes</h3>
              <div className="flex flex-wrap gap-2">
                {analysisResult.themes.map((theme, i) => (
                  <span key={i} className="px-3 py-1 bg-purple-900/50 text-purple-200 rounded-full text-sm">
                    {theme}
                  </span>
                ))}
              </div>
            </div>

            {/* Emotions */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Emotional Arc</h3>
              <div className="flex flex-wrap gap-2">
                {analysisResult.emotions.map((emotion, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-900/50 text-blue-200 rounded-full text-sm">
                    {emotion}
                  </span>
                ))}
              </div>
            </div>

            {/* Domain Tags */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Domain Tags</h3>
              <div className="flex flex-wrap gap-2">
                {analysisResult.domain_tags.map((tag, i) => (
                  <span key={i} className="px-3 py-1 bg-indigo-900/50 text-indigo-200 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* References */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">References</h3>
              <div className="space-y-2">
                {analysisResult.references.map((ref: MdalsSongReference, i: number) => (
                  <div key={i} className="p-3 bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-gray-600 rounded text-xs uppercase">
                        {ref.type}
                      </span>
                      <span className="font-medium text-white">{ref.value}</span>
                    </div>
                    <p className="text-sm text-gray-300">{ref.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Plan Generation Form */}
        {analysisResult && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-indigo-300">Step 2: Generate Learning Plan</h2>

            {/* Goal Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                What do you want to achieve? <span className="text-red-400">*</span>
              </label>
              <textarea
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                placeholder="e.g., Grow closer to God and find healing from past hurts"
                rows={2}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Duration */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Plan Duration
              </label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value={3}>3 Days</option>
                <option value={5}>5 Days</option>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={21}>21 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGeneratePlan}
              disabled={isGeneratingPlan || !goalDescription.trim()}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isGeneratingPlan ? 'Generating...' : `Generate ${durationDays}-Day Plan`}
            </button>
          </div>
        )}

        {/* Learning Plan Results */}
        {planResult && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-2 text-green-400">{planResult.title}</h2>
            <p className="text-gray-400 mb-4">{planResult.duration_days}-Day Learning Journey</p>

            <div className="space-y-4">
              {planResult.days.map((day: MdalsLearningPlanDay) => (
                <div key={day.day} className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-700 px-4 py-2">
                    <h3 className="font-semibold">
                      Day {day.day}: {day.focus}
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* References */}
                    {day.references.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-indigo-300 mb-1">References</h4>
                        <div className="flex flex-wrap gap-1">
                          {day.references.map((ref, i) => (
                            <span key={i} className="px-2 py-0.5 bg-indigo-900/50 text-indigo-200 rounded text-sm">
                              {ref}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Activities */}
                    <div>
                      <h4 className="text-sm font-medium text-blue-300 mb-1">Activities</h4>
                      <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                        {day.activities.map((activity, i) => (
                          <li key={i}>{activity}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Reflection */}
                    <div>
                      <h4 className="text-sm font-medium text-purple-300 mb-1">Reflection</h4>
                      <p className="text-gray-300 text-sm italic">"{day.reflection}"</p>
                    </div>

                    {/* Prayer/Action */}
                    <div>
                      <h4 className="text-sm font-medium text-green-300 mb-1">Prayer / Action</h4>
                      <p className="text-gray-300 text-sm">{day.prayer_or_action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debug Info (Dev Only) */}
        <div className="mt-8 text-xs text-gray-600">
          <p>User ID: {userId}</p>
          {analysisResult && <p>Song ID: {analysisResult.song_id}</p>}
          {planResult && <p>Plan ID: {planResult.plan_id}</p>}
        </div>
      </div>
    </div>
  );
};

export default MdalsTestPanel;
