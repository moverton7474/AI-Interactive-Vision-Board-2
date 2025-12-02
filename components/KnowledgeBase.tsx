import React, { useState, useEffect, useRef } from 'react';
import { UserKnowledgeSource } from '../types';
import { supabase } from '../lib/supabase';
import { SparklesIcon, DocumentIcon } from './Icons';

interface Props {
  onBack?: () => void;
}

type SourceType = 'resume' | 'document' | 'manual_entry' | 'notes' | 'url';

const SOURCE_TYPE_OPTIONS: { value: SourceType; label: string; icon: string; description: string }[] = [
  { value: 'resume', label: 'Resume/CV', icon: '📄', description: 'Your professional background' },
  { value: 'document', label: 'Document', icon: '📝', description: 'PDFs, docs, or text files' },
  { value: 'notes', label: 'Personal Notes', icon: '📒', description: 'Goals, reflections, plans' },
  { value: 'manual_entry', label: 'Quick Entry', icon: '✏️', description: 'Type or paste content' },
  { value: 'url', label: 'Web Link', icon: '🔗', description: 'Import from a URL' },
];

/**
 * KnowledgeBase - Notebook-LM Style Personal Knowledge Management
 *
 * Allows users to upload documents, enter notes, and manage their
 * personal knowledge base that powers personalized AI coaching.
 */
const KnowledgeBase: React.FC<Props> = ({ onBack }) => {
  const [sources, setSources] = useState<UserKnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Upload form state
  const [selectedType, setSelectedType] = useState<SourceType>('manual_entry');
  const [sourceName, setSourceName] = useState('');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSources();
    fetchStats();
  }, []);

  const fetchSources = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to view your knowledge base');
        return;
      }

      const response = await supabase.functions.invoke('knowledge-ingest?action=list', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch sources');
      }

      setSources(response.data?.sources || []);
    } catch (err: any) {
      console.error('Error fetching sources:', err);
      setError(err.message || 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('knowledge-ingest?action=stats', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.data?.stats) {
        setStats(response.data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleUpload = async () => {
    if (!sourceName.trim()) {
      setError('Please enter a name for this source');
      return;
    }

    if (!content.trim() && !sourceUrl.trim()) {
      setError('Please enter content or a URL');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to upload');
      }

      const response = await supabase.functions.invoke('knowledge-ingest?action=ingest', {
        body: {
          sourceType: selectedType,
          sourceName: sourceName.trim(),
          content: content.trim(),
          sourceUrl: sourceUrl.trim() || undefined,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to upload');
      }

      // Reset form and refresh
      setSourceName('');
      setContent('');
      setSourceUrl('');
      setShowUploadModal(false);
      await fetchSources();
      await fetchStats();
    } catch (err: any) {
      console.error('Error uploading:', err);
      setError(err.message || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Read file content
      const text = await file.text();
      setContent(text);
      setSourceName(file.name.replace(/\.[^/.]+$/, '')); // Remove extension
      setSelectedType('document');
    } catch (err) {
      console.error('Error reading file:', err);
      setError('Failed to read file. Please try a text-based file.');
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this source?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke('knowledge-ingest?action=delete', {
        body: { sourceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      await fetchSources();
      await fetchStats();
    } catch (err: any) {
      console.error('Error deleting:', err);
      setError(err.message || 'Failed to delete');
    }
  };

  const handleToggle = async (sourceId: string, includeInContext: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke('knowledge-ingest?action=toggle', {
        body: { sourceId, includeInContext },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      await fetchSources();
    } catch (err: any) {
      console.error('Error toggling:', err);
    }
  };

  const getSourceIcon = (type: string) => {
    const option = SOURCE_TYPE_OPTIONS.find(o => o.value === type);
    return option?.icon || '📄';
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500">Loading your knowledge base...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-navy-900">Knowledge Base</h1>
          <p className="text-gray-500 mt-1">Your personal context for AI coaching</p>
        </div>

        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-navy-900 font-medium transition-colors"
            >
              ← Back
            </button>
          )}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-navy-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-navy-800 transition-colors"
          >
            <span className="text-lg">+</span>
            Add Source
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      {/* Stats Summary */}
      {stats && stats.totalSources > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-3xl font-bold text-navy-900">{stats.totalSources}</div>
            <div className="text-sm text-gray-500">Sources</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-3xl font-bold text-green-600">{stats.includedSources}</div>
            <div className="text-sm text-gray-500">Active for AI</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-3xl font-bold text-blue-600">{stats.totalChunks}</div>
            <div className="text-sm text-gray-500">Knowledge Chunks</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-3xl font-bold text-gold-600">
              {stats.totalWords > 1000 ? `${(stats.totalWords / 1000).toFixed(1)}k` : stats.totalWords}
            </div>
            <div className="text-sm text-gray-500">Words</div>
          </div>
        </div>
      )}

      {/* Sources List */}
      {sources.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <DocumentIcon className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-lg font-bold text-navy-900 mb-2">Build Your Knowledge Base</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Add documents, notes, and personal context to help your AI coach understand you better.
            The more context you provide, the more personalized your coaching becomes.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 bg-navy-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-navy-800 transition-colors"
          >
            <span className="text-lg">+</span>
            Add Your First Source
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source: any) => (
            <div
              key={source.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{getSourceIcon(source.source_type)}</div>
                  <div>
                    <h3 className="font-bold text-navy-900">{source.source_name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {source.source_type.replace('_', ' ')} • {source.word_count || 0} words • {source.chunk_count || 0} chunks
                    </p>
                    {source.content_summary && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {source.content_summary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Include in AI toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-gray-500">AI Context</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={source.include_in_context}
                        onChange={(e) => handleToggle(source.id, e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors ${
                        source.include_in_context ? 'bg-green-500' : 'bg-gray-300'
                      }`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          source.include_in_context ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </div>
                    </div>
                  </label>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete source"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-navy-900">Add to Knowledge Base</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Source Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What type of content is this?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SOURCE_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedType(option.value)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedType === option.value
                          ? 'border-navy-900 bg-navy-50'
                          : 'border-gray-200 hover:border-gold-400'
                      }`}
                    >
                      <div className="text-2xl mb-1">{option.icon}</div>
                      <div className="font-medium text-navy-900 text-sm">{option.label}</div>
                      <div className="text-xs text-gray-500">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Source Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name this source
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g., My Resume, Career Goals, etc."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-navy-900 focus:outline-none"
                />
              </div>

              {/* File Upload */}
              {(selectedType === 'document' || selectedType === 'resume') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload a file (optional)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.csv,.json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-navy-900 hover:text-navy-900 transition-colors"
                  >
                    Click to upload a text file (.txt, .md)
                  </button>
                </div>
              )}

              {/* URL Input */}
              {selectedType === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Web URL
                  </label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-navy-900 focus:outline-none"
                  />
                </div>
              )}

              {/* Content Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {selectedType === 'url' ? 'Additional notes (optional)' : 'Content'}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    selectedType === 'resume'
                      ? 'Paste your resume content here...'
                      : selectedType === 'notes'
                      ? 'Write your notes, goals, or reflections...'
                      : 'Enter or paste your content here...'
                  }
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-navy-900 focus:outline-none resize-none"
                />
                <p className="text-xs text-gray-400 mt-2">
                  {content.length} characters • ~{Math.ceil(content.split(/\s+/).filter(w => w).length)} words
                </p>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl">
                <div className="flex items-start gap-3">
                  <SparklesIcon className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div className="text-sm text-gray-700">
                    <strong className="text-purple-700">How this helps:</strong> Your AI coach will use this
                    context to provide more personalized guidance aligned with your background, goals, and values.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-6 py-2 text-gray-600 font-medium hover:text-navy-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !sourceName.trim() || (!content.trim() && !sourceUrl.trim())}
                className="px-6 py-2 bg-navy-900 text-white font-medium rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Add to Knowledge Base'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default KnowledgeBase;
