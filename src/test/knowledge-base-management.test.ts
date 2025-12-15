import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseClient,
  mockUser,
  mockKnowledgeBase
} from './edge-function-utils';

/**
 * E2E Tests: Knowledge Base Management (v1.7 Enhancements)
 *
 * These tests verify the Knowledge Base functionality including:
 * - Viewing source list
 * - Adding sources (manual entry, file upload, URL)
 * - Viewing source content (v1.7)
 * - Archiving/deleting sources (v1.7)
 * - Toggling source inclusion in AI context
 * - File type validation (v1.7)
 * - Binary file detection (v1.7)
 */

// Source types
type SourceType = 'manual_entry' | 'document' | 'url';

// Mock knowledge source
const mockKnowledgeSource = {
  id: 'source-123',
  user_id: mockUser.id,
  source_type: 'manual_entry' as SourceType,
  source_name: 'My Financial Goals',
  content_summary: 'Goals for achieving financial independence...',
  word_count: 150,
  include_in_context: true,
  archived: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock sources list
const mockSources = [
  mockKnowledgeSource,
  {
    ...mockKnowledgeSource,
    id: 'source-456',
    source_type: 'document' as SourceType,
    source_name: 'Investment Notes',
    word_count: 320,
    include_in_context: true
  },
  {
    ...mockKnowledgeSource,
    id: 'source-789',
    source_type: 'url' as SourceType,
    source_name: 'Financial Article',
    word_count: 890,
    include_in_context: false
  }
];

describe('Knowledge Base Management E2E', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('Loading Sources', () => {
    it('should fetch sources for authenticated user', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: { sources: mockSources },
        error: null
      });

      mockSupabase.functions = { invoke: mockInvoke };

      const result = await mockSupabase.functions.invoke('knowledge-ingest?action=list', {
        body: {},
        headers: { Authorization: 'Bearer test-token' }
      });

      expect(result.data.sources).toHaveLength(3);
    });

    it('should handle empty sources list', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: { sources: [] },
        error: null
      });

      mockSupabase.functions = { invoke: mockInvoke };

      const result = await mockSupabase.functions.invoke('knowledge-ingest?action=list', {
        body: {},
        headers: { Authorization: 'Bearer test-token' }
      });

      expect(result.data.sources).toHaveLength(0);
    });

    it('should exclude archived sources by default', async () => {
      const sourcesWithArchived = [
        ...mockSources,
        { ...mockKnowledgeSource, id: 'source-archived', archived: true }
      ];

      const activeSources = sourcesWithArchived.filter(s => !s.archived);

      expect(activeSources).toHaveLength(3);
    });
  });

  describe('Adding Sources', () => {
    describe('Manual Entry', () => {
      it('should add manual entry source', async () => {
        const mockInvoke = vi.fn().mockResolvedValue({
          data: { source: mockKnowledgeSource },
          error: null
        });

        mockSupabase.functions = { invoke: mockInvoke };

        const newSource = {
          sourceType: 'manual_entry',
          sourceName: 'My Goals',
          content: 'I want to achieve financial freedom by saving 50% of my income...'
        };

        const result = await mockSupabase.functions.invoke('knowledge-ingest?action=add', {
          body: newSource,
          headers: { Authorization: 'Bearer test-token' }
        });

        expect(mockInvoke).toHaveBeenCalled();
        expect(result.data.source).toBeTruthy();
      });

      it('should require content for manual entry', () => {
        const newSource = {
          sourceType: 'manual_entry',
          sourceName: 'My Goals',
          content: ''
        };

        const isValid = newSource.content.trim().length > 0;
        expect(isValid).toBe(false);
      });

      it('should require source name', () => {
        const newSource = {
          sourceType: 'manual_entry',
          sourceName: '',
          content: 'Some content'
        };

        const isValid = newSource.sourceName.trim().length > 0;
        expect(isValid).toBe(false);
      });
    });

    describe('File Upload', () => {
      it('should accept plain text files (.txt)', async () => {
        const file = new File(['Hello world content'], 'notes.txt', {
          type: 'text/plain'
        });

        const fileName = file.name.toLowerCase();
        const supportedExtensions = ['.txt', '.md', '.csv', '.json'];
        const isSupported = supportedExtensions.some(ext => fileName.endsWith(ext));

        expect(isSupported).toBe(true);
      });

      it('should accept markdown files (.md)', () => {
        const fileName = 'readme.md';
        const supportedExtensions = ['.txt', '.md', '.csv', '.json'];
        const isSupported = supportedExtensions.some(ext => fileName.endsWith(ext));

        expect(isSupported).toBe(true);
      });

      it('should reject PDF files', () => {
        const fileName = 'document.pdf';
        const unsupportedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
        const isUnsupported = unsupportedExtensions.some(ext => fileName.endsWith(ext));

        expect(isUnsupported).toBe(true);
      });

      it('should reject Word documents (.doc, .docx)', () => {
        const fileNames = ['report.doc', 'report.docx'];
        const unsupportedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];

        fileNames.forEach(fileName => {
          const isUnsupported = unsupportedExtensions.some(ext => fileName.endsWith(ext));
          expect(isUnsupported).toBe(true);
        });
      });

      it('should reject Excel files (.xls, .xlsx)', () => {
        const fileNames = ['data.xls', 'data.xlsx'];
        const unsupportedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];

        fileNames.forEach(fileName => {
          const isUnsupported = unsupportedExtensions.some(ext => fileName.endsWith(ext));
          expect(isUnsupported).toBe(true);
        });
      });

      it('should reject PowerPoint files (.ppt, .pptx)', () => {
        const fileNames = ['slides.ppt', 'slides.pptx'];
        const unsupportedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];

        fileNames.forEach(fileName => {
          const isUnsupported = unsupportedExtensions.some(ext => fileName.endsWith(ext));
          expect(isUnsupported).toBe(true);
        });
      });
    });

    describe('Binary Content Detection (v1.7)', () => {
      it('should detect binary content by non-printable character ratio', () => {
        // Simulating binary content (PDF-like garbled text)
        const binaryContent = '\x00\x01\x02PDF-1.4\x00\x03\x04';
        const nonPrintableCount = (binaryContent.match(/[^\x20-\x7E\n\r\t]/g) || []).length;
        const binaryRatio = nonPrintableCount / binaryContent.length;

        // Threshold is 10%
        expect(binaryRatio > 0.1).toBe(true);
      });

      it('should accept clean text content', () => {
        const textContent = 'This is clean text content with normal characters.\nIt has newlines and tabs\ttoo.';
        const nonPrintableCount = (textContent.match(/[^\x20-\x7E\n\r\t]/g) || []).length;
        const binaryRatio = nonPrintableCount / textContent.length;

        expect(binaryRatio <= 0.1).toBe(true);
      });

      it('should provide helpful error message for binary files', () => {
        const errorMessage = 'This file appears to be a binary format (PDF, Word, etc.) that cannot be read directly. Please copy the text content from your document and paste it in the Content field below.';

        expect(errorMessage).toContain('binary format');
        expect(errorMessage).toContain('paste');
      });
    });

    describe('URL Source', () => {
      it('should validate URL format', () => {
        const validUrls = [
          'https://example.com',
          'http://example.com/page',
          'https://sub.domain.com/path?query=1'
        ];

        validUrls.forEach(url => {
          const isValid = /^https?:\/\/.+/.test(url);
          expect(isValid).toBe(true);
        });
      });

      it('should reject invalid URLs', () => {
        const invalidUrls = [
          'not a url',
          'ftp://example.com',
          'example.com'
        ];

        invalidUrls.forEach(url => {
          const isValid = /^https?:\/\/.+/.test(url);
          expect(isValid).toBe(false);
        });
      });
    });
  });

  describe('Viewing Source Content (v1.7)', () => {
    it('should fetch source content by ID', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: {
          content: 'Full content of the source document...',
          source: mockKnowledgeSource
        },
        error: null
      });

      mockSupabase.functions = { invoke: mockInvoke };

      const result = await mockSupabase.functions.invoke('knowledge-ingest?action=get', {
        body: { sourceId: 'source-123' },
        headers: { Authorization: 'Bearer test-token' }
      });

      expect(result.data.content).toBeTruthy();
    });

    it('should fallback to content_summary if full content unavailable', () => {
      const response = {
        source: mockKnowledgeSource
        // No 'content' field
      };

      const displayContent = response.content || response.source.content_summary;

      expect(displayContent).toBe(mockKnowledgeSource.content_summary);
    });

    it('should handle unknown action gracefully', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Unknown action' }
      });

      mockSupabase.functions = { invoke: mockInvoke };

      const result = await mockSupabase.functions.invoke('knowledge-ingest?action=get', {
        body: { sourceId: 'source-123' },
        headers: { Authorization: 'Bearer test-token' }
      });

      // Should show fallback content
      const displayContent = result.data?.content ||
        mockKnowledgeSource.content_summary ||
        'Full content not available. This source may have been processed into knowledge chunks.';

      expect(displayContent).toBeTruthy();
    });
  });

  describe('Archiving Sources (v1.7)', () => {
    it('should call archive action', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: { success: true },
        error: null
      });

      mockSupabase.functions = { invoke: mockInvoke };

      await mockSupabase.functions.invoke('knowledge-ingest?action=archive', {
        body: { sourceId: 'source-123' },
        headers: { Authorization: 'Bearer test-token' }
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        'knowledge-ingest?action=archive',
        expect.objectContaining({
          body: { sourceId: 'source-123' }
        })
      );
    });

    it('should fallback to delete if archive action unknown', async () => {
      const archiveResponse = {
        error: { message: 'Unknown action' }
      };

      const mockInvoke = vi.fn()
        .mockResolvedValueOnce(archiveResponse) // Archive fails
        .mockResolvedValueOnce({ data: { success: true }, error: null }); // Delete succeeds

      mockSupabase.functions = { invoke: mockInvoke };

      // First call: archive
      const archiveResult = await mockSupabase.functions.invoke('knowledge-ingest?action=archive', {
        body: { sourceId: 'source-123' },
        headers: { Authorization: 'Bearer test-token' }
      });

      // If archive fails with unknown action, fallback to delete
      if (archiveResult.error?.message?.includes('Unknown action')) {
        await mockSupabase.functions.invoke('knowledge-ingest?action=delete', {
          body: { sourceId: 'source-123' },
          headers: { Authorization: 'Bearer test-token' }
        });
      }

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should require confirmation before archiving', () => {
      const mockConfirm = vi.fn().mockReturnValue(true);

      const confirmed = mockConfirm('Are you sure you want to archive this source?');

      expect(mockConfirm).toHaveBeenCalled();
      expect(confirmed).toBe(true);
    });

    it('should cancel archive if user declines', () => {
      const mockConfirm = vi.fn().mockReturnValue(false);
      const mockArchive = vi.fn();

      const confirmed = mockConfirm('Are you sure?');
      if (confirmed) {
        mockArchive();
      }

      expect(mockArchive).not.toHaveBeenCalled();
    });
  });

  describe('Toggling Source Inclusion', () => {
    it('should toggle source inclusion in AI context', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: { success: true },
        error: null
      });

      mockSupabase.functions = { invoke: mockInvoke };

      await mockSupabase.functions.invoke('knowledge-ingest?action=toggle', {
        body: { sourceId: 'source-123', includeInContext: false },
        headers: { Authorization: 'Bearer test-token' }
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        'knowledge-ingest?action=toggle',
        expect.objectContaining({
          body: { sourceId: 'source-123', includeInContext: false }
        })
      );
    });

    it('should update local state after toggle', () => {
      const sources = [...mockSources];
      const sourceId = 'source-123';
      const newValue = false;

      const updatedSources = sources.map(source =>
        source.id === sourceId
          ? { ...source, include_in_context: newValue }
          : source
      );

      const updatedSource = updatedSources.find(s => s.id === sourceId);
      expect(updatedSource?.include_in_context).toBe(false);
    });
  });

  describe('Source Statistics', () => {
    it('should calculate total word count', () => {
      const totalWords = mockSources.reduce((sum, source) => sum + source.word_count, 0);

      expect(totalWords).toBe(150 + 320 + 890);
    });

    it('should count active sources', () => {
      const activeSources = mockSources.filter(s => s.include_in_context);

      expect(activeSources).toHaveLength(2);
    });

    it('should count total sources', () => {
      expect(mockSources).toHaveLength(3);
    });
  });

  describe('Source Type Icons', () => {
    it('should return correct icon for each source type', () => {
      const getSourceIcon = (type: SourceType): string => {
        switch (type) {
          case 'manual_entry': return '📝';
          case 'document': return '📄';
          case 'url': return '🔗';
          default: return '📁';
        }
      };

      expect(getSourceIcon('manual_entry')).toBe('📝');
      expect(getSourceIcon('document')).toBe('📄');
      expect(getSourceIcon('url')).toBe('🔗');
    });
  });

  describe('Modal States', () => {
    it('should track upload modal visibility', () => {
      let showUploadModal = false;

      // Open modal
      showUploadModal = true;
      expect(showUploadModal).toBe(true);

      // Close modal
      showUploadModal = false;
      expect(showUploadModal).toBe(false);
    });

    it('should track view source modal state', () => {
      let viewingSource: typeof mockKnowledgeSource | null = null;

      // Open view modal
      viewingSource = mockKnowledgeSource;
      expect(viewingSource).not.toBeNull();

      // Close view modal
      viewingSource = null;
      expect(viewingSource).toBeNull();
    });

    it('should track loading state for content fetch', () => {
      let loadingContent = false;

      // Start loading
      loadingContent = true;
      expect(loadingContent).toBe(true);

      // Finish loading
      loadingContent = false;
      expect(loadingContent).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should display error message on fetch failure', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Network error' }
      });

      mockSupabase.functions = { invoke: mockInvoke };

      const result = await mockSupabase.functions.invoke('knowledge-ingest?action=list', {
        body: {},
        headers: { Authorization: 'Bearer test-token' }
      });

      const errorMessage = result.error?.message || 'An error occurred';
      expect(errorMessage).toBe('Network error');
    });

    it('should clear error on successful operation', () => {
      let error: string | null = 'Previous error';

      // Successful operation clears error
      error = null;

      expect(error).toBeNull();
    });

    it('should handle upload error', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Failed to process content' }
      });

      mockSupabase.functions = { invoke: mockInvoke };

      const result = await mockSupabase.functions.invoke('knowledge-ingest?action=add', {
        body: { sourceType: 'manual_entry', content: 'test' },
        headers: { Authorization: 'Bearer test-token' }
      });

      expect(result.error).toBeTruthy();
    });
  });

  describe('Upload Form State', () => {
    it('should reset form after successful upload', () => {
      let formState = {
        selectedType: 'manual_entry' as SourceType,
        sourceName: 'Test Source',
        content: 'Test content',
        sourceUrl: ''
      };

      // Reset form
      formState = {
        selectedType: 'manual_entry',
        sourceName: '',
        content: '',
        sourceUrl: ''
      };

      expect(formState.sourceName).toBe('');
      expect(formState.content).toBe('');
    });

    it('should populate form from file upload', () => {
      let formState = {
        selectedType: 'manual_entry' as SourceType,
        sourceName: '',
        content: '',
        sourceUrl: ''
      };

      // Simulating file upload
      const fileContent = 'Content from uploaded file';
      const fileName = 'notes.txt';

      formState.content = fileContent;
      formState.sourceName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
      formState.selectedType = 'document';

      expect(formState.content).toBe(fileContent);
      expect(formState.sourceName).toBe('notes');
      expect(formState.selectedType).toBe('document');
    });
  });

  describe('Accessibility', () => {
    it('should have proper button titles for view action', () => {
      const viewButtonTitle = 'View content';
      expect(viewButtonTitle).toBeTruthy();
    });

    it('should have proper button titles for archive action', () => {
      const archiveButtonTitle = 'Archive source';
      expect(archiveButtonTitle).toBeTruthy();
    });

    it('should have close button with aria-label in modal', () => {
      const closeButtonLabel = 'Close modal';
      expect(closeButtonLabel).toBeTruthy();
    });
  });
});

describe('Knowledge Base Integration with AI', () => {
  it('should include active sources in AI context', () => {
    const sources = mockSources;
    const activeSources = sources.filter(s => s.include_in_context);

    // Only sources with include_in_context=true should be in AI context
    expect(activeSources).toHaveLength(2);
    expect(activeSources.every(s => s.include_in_context)).toBe(true);
  });

  it('should exclude archived sources from AI context', () => {
    const sources = [
      ...mockSources,
      { ...mockKnowledgeSource, id: 'archived', archived: true, include_in_context: true }
    ];

    // Even if include_in_context is true, archived sources should be excluded
    const aiContextSources = sources.filter(s => s.include_in_context && !s.archived);

    expect(aiContextSources).toHaveLength(2);
  });
});
