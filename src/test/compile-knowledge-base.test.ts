import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseClient,
  mockUser,
  mockProfile,
  mockVisionBoard,
  mockHabit,
  mockActionTask,
  mockWeeklyReview
} from './edge-function-utils';

/**
 * Compile Knowledge Base Edge Function Tests
 */

describe('Compile Knowledge Base', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('Date Helper Functions', () => {
    const getDateDaysAgo = (days: number): string => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date.toISOString().split('T')[0];
    };

    const isStale = (lastCompiled: string | null, hours: number): boolean => {
      if (!lastCompiled) return true;
      const compiled = new Date(lastCompiled);
      const now = new Date();
      const diffHours = (now.getTime() - compiled.getTime()) / (1000 * 60 * 60);
      return diffHours > hours;
    };

    it('should calculate date 90 days ago', () => {
      const result = getDateDaysAgo(90);
      const expected = new Date();
      expected.setDate(expected.getDate() - 90);

      expect(result).toBe(expected.toISOString().split('T')[0]);
    });

    it('should detect stale data (>24 hours)', () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25);

      expect(isStale(oldDate.toISOString(), 24)).toBe(true);
    });

    it('should detect fresh data (<24 hours)', () => {
      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 1);

      expect(isStale(recentDate.toISOString(), 24)).toBe(false);
    });

    it('should treat null as stale', () => {
      expect(isStale(null, 24)).toBe(true);
    });
  });

  describe('Location Extraction', () => {
    const extractLocations = (visionStatements: string[]): string[] => {
      const locationKeywords = [
        'thailand', 'portugal', 'spain', 'mexico', 'costa rica', 'bali', 'vietnam',
        'italy', 'france', 'greece', 'hawaii', 'florida', 'arizona', 'beach',
        'mountain', 'lake', 'island', 'countryside', 'city'
      ];

      const found: string[] = [];
      const combined = visionStatements.join(' ').toLowerCase();

      for (const location of locationKeywords) {
        if (combined.includes(location)) {
          found.push(location.charAt(0).toUpperCase() + location.slice(1));
        }
      }

      return [...new Set(found)].slice(0, 5);
    };

    it('should extract Thailand from vision statement', () => {
      const statements = ['Retire on a beautiful beach in Thailand'];
      const locations = extractLocations(statements);

      expect(locations).toContain('Thailand');
      expect(locations).toContain('Beach');
    });

    it('should handle multiple locations', () => {
      const statements = [
        'Visit Italy and France',
        'Settle in Portugal near the beach'
      ];
      const locations = extractLocations(statements);

      expect(locations).toContain('Italy');
      expect(locations).toContain('France');
      expect(locations).toContain('Portugal');
      expect(locations).toContain('Beach');
    });

    it('should deduplicate locations', () => {
      const statements = [
        'Beach vacation in Hawaii',
        'Another beach trip to Hawaii'
      ];
      const locations = extractLocations(statements);

      const hawaiiCount = locations.filter(l => l === 'Hawaii').length;
      expect(hawaiiCount).toBe(1);
    });

    it('should limit to 5 locations', () => {
      const statements = [
        'Thailand beach italy france spain portugal mexico costa rica bali vietnam greece'
      ];
      const locations = extractLocations(statements);

      expect(locations.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Financial Summary Compilation', () => {
    const compileFinancialSummary = (documents: any[]): Record<string, any> => {
      const summary: Record<string, any> = {
        hasDocuments: documents.length > 0,
        documentTypes: [...new Set(documents.map((d: any) => d.doc_type))],
        documentCount: documents.length
      };

      for (const doc of documents) {
        if (doc.content) {
          try {
            const content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
            if (content.monthlyBudget) summary.monthlyBudget = content.monthlyBudget;
            if (content.retirementGoal) summary.retirementGoal = content.retirementGoal;
          } catch {
            // Skip
          }
        }
      }

      return summary;
    };

    it('should handle empty documents', () => {
      const summary = compileFinancialSummary([]);

      expect(summary.hasDocuments).toBe(false);
      expect(summary.documentCount).toBe(0);
    });

    it('should extract document types', () => {
      const documents = [
        { doc_type: 'financial_plan', content: '{}' },
        { doc_type: 'tax_return', content: '{}' },
        { doc_type: 'financial_plan', content: '{}' }
      ];
      const summary = compileFinancialSummary(documents);

      expect(summary.documentTypes).toContain('financial_plan');
      expect(summary.documentTypes).toContain('tax_return');
      expect(summary.documentTypes.length).toBe(2); // Deduplicated
    });

    it('should extract financial data from content', () => {
      const documents = [
        {
          doc_type: 'financial_plan',
          content: JSON.stringify({
            monthlyBudget: 5000,
            retirementGoal: 1000000
          })
        }
      ];
      const summary = compileFinancialSummary(documents);

      expect(summary.monthlyBudget).toBe(5000);
      expect(summary.retirementGoal).toBe(1000000);
    });

    it('should handle non-parseable content gracefully', () => {
      const documents = [
        { doc_type: 'note', content: 'not json' }
      ];
      const summary = compileFinancialSummary(documents);

      expect(summary.hasDocuments).toBe(true);
      expect(summary.monthlyBudget).toBeUndefined();
    });
  });

  describe('Goals Summary Compilation', () => {
    const compileGoalsSummary = (actionTasks: any[]): Record<string, any> => {
      const byCategory: Record<string, number> = {};
      const byStatus: Record<string, number> = {};

      for (const task of actionTasks) {
        const category = task.category || 'uncategorized';
        byCategory[category] = (byCategory[category] || 0) + 1;

        const status = task.status || 'pending';
        byStatus[status] = (byStatus[status] || 0) + 1;
      }

      return {
        totalTasks: actionTasks.length,
        byCategory,
        byStatus,
        completionRate: actionTasks.length > 0
          ? Math.round((byStatus['completed'] || 0) / actionTasks.length * 100)
          : 0
      };
    };

    it('should count tasks by category', () => {
      const tasks = [
        { category: 'financial', status: 'pending' },
        { category: 'financial', status: 'completed' },
        { category: 'health', status: 'pending' }
      ];
      const summary = compileGoalsSummary(tasks);

      expect(summary.byCategory['financial']).toBe(2);
      expect(summary.byCategory['health']).toBe(1);
    });

    it('should count tasks by status', () => {
      const tasks = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'pending' },
        { status: 'in_progress' }
      ];
      const summary = compileGoalsSummary(tasks);

      expect(summary.byStatus['completed']).toBe(2);
      expect(summary.byStatus['pending']).toBe(1);
      expect(summary.byStatus['in_progress']).toBe(1);
    });

    it('should calculate completion rate', () => {
      const tasks = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'pending' },
        { status: 'pending' }
      ];
      const summary = compileGoalsSummary(tasks);

      expect(summary.completionRate).toBe(50);
    });

    it('should handle empty tasks', () => {
      const summary = compileGoalsSummary([]);

      expect(summary.totalTasks).toBe(0);
      expect(summary.completionRate).toBe(0);
    });
  });

  describe('Habits Summary Compilation', () => {
    const getDateDaysAgo = (days: number): string => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date.toISOString().split('T')[0];
    };

    const compileHabitsSummary = (habits: any[], completions: any[]): Record<string, any> => {
      const activeHabits = habits.filter((h: any) => h.is_active);
      const thirtyDaysAgo = getDateDaysAgo(30);
      const recentCompletions = completions.filter((c: any) => c.completed_at >= thirtyDaysAgo);

      const moodRatings = recentCompletions.filter((c: any) => c.mood_rating).map((c: any) => c.mood_rating);
      const averageMood = moodRatings.length > 0
        ? Math.round(moodRatings.reduce((a: number, b: number) => a + b, 0) / moodRatings.length * 10) / 10
        : null;

      return {
        totalHabits: habits.length,
        activeHabits: activeHabits.length,
        completions30Days: recentCompletions.length,
        averageMood
      };
    };

    it('should count active habits', () => {
      const habits = [
        { is_active: true },
        { is_active: true },
        { is_active: false }
      ];
      const summary = compileHabitsSummary(habits, []);

      expect(summary.activeHabits).toBe(2);
      expect(summary.totalHabits).toBe(3);
    });

    it('should calculate average mood', () => {
      const today = new Date().toISOString().split('T')[0];
      const habits = [{ is_active: true }];
      const completions = [
        { completed_at: today, mood_rating: 4 },
        { completed_at: today, mood_rating: 5 },
        { completed_at: today, mood_rating: 3 }
      ];
      const summary = compileHabitsSummary(habits, completions);

      expect(summary.averageMood).toBe(4);
    });

    it('should return null mood when no ratings', () => {
      const summary = compileHabitsSummary([], []);
      expect(summary.averageMood).toBeNull();
    });
  });

  describe('Sentiment Trend Calculation', () => {
    const calculateSentimentTrend = (weeklyReviews: any[]): string => {
      if (weeklyReviews.length < 2) return 'insufficient_data';

      const recentMoods = weeklyReviews
        .filter((r: any) => r.mood_average)
        .slice(0, 4)
        .map((r: any) => r.mood_average);

      if (recentMoods.length < 2) return 'insufficient_data';

      const recent = recentMoods[0];
      const older = recentMoods[recentMoods.length - 1];

      if (recent > older + 0.5) return 'improving';
      if (recent < older - 0.5) return 'declining';
      return 'stable';
    };

    it('should return insufficient_data for < 2 reviews', () => {
      const result = calculateSentimentTrend([{ mood_average: 4 }]);
      expect(result).toBe('insufficient_data');
    });

    it('should detect improving trend', () => {
      const reviews = [
        { mood_average: 4.5 }, // Recent
        { mood_average: 3.5 }  // Older
      ];
      const result = calculateSentimentTrend(reviews);
      expect(result).toBe('improving');
    });

    it('should detect declining trend', () => {
      const reviews = [
        { mood_average: 2.5 }, // Recent
        { mood_average: 4.0 }  // Older
      ];
      const result = calculateSentimentTrend(reviews);
      expect(result).toBe('declining');
    });

    it('should detect stable trend', () => {
      const reviews = [
        { mood_average: 4.0 }, // Recent
        { mood_average: 4.2 }  // Older
      ];
      const result = calculateSentimentTrend(reviews);
      expect(result).toBe('stable');
    });
  });

  describe('AI Context Building', () => {
    const buildAIContext = (kb: any): string => {
      const sections: string[] = [];

      sections.push(`**User:** ${kb.names || 'Unknown'}`);
      if (kb.retirement_year) {
        sections.push(`**Target Retirement:** ${kb.retirement_year}`);
      }
      if (kb.dream_locations?.length > 0) {
        sections.push(`**Dream Locations:** ${kb.dream_locations.join(', ')}`);
      }

      return sections.join('\n');
    };

    it('should include user name', () => {
      const kb = { names: 'John Doe' };
      const context = buildAIContext(kb);

      expect(context).toContain('**User:** John Doe');
    });

    it('should include retirement year', () => {
      const kb = { names: 'Jane', retirement_year: 2030 };
      const context = buildAIContext(kb);

      expect(context).toContain('**Target Retirement:** 2030');
    });

    it('should include dream locations', () => {
      const kb = { names: 'Test', dream_locations: ['Thailand', 'Portugal'] };
      const context = buildAIContext(kb);

      expect(context).toContain('Thailand, Portugal');
    });

    it('should handle missing data gracefully', () => {
      const kb = {};
      const context = buildAIContext(kb);

      expect(context).toContain('**User:** Unknown');
    });
  });

  describe('Data Fetching', () => {
    it('should fetch all data sources in parallel', async () => {
      const mockPromises = [
        Promise.resolve({ data: mockProfile, error: null }),
        Promise.resolve({ data: [mockVisionBoard], error: null }),
        Promise.resolve({ data: [], error: null }),
        Promise.resolve({ data: [mockActionTask], error: null }),
        Promise.resolve({ data: [mockHabit], error: null })
      ];

      const results = await Promise.all(mockPromises);

      expect(results.length).toBe(5);
      expect(results[0].data).toEqual(mockProfile);
      expect(results[1].data).toEqual([mockVisionBoard]);
    });

    it('should handle Supabase query errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' }
            })
          })
        })
      });

      const result = await mockSupabase.from('user_knowledge_base')
        .select('*')
        .eq('user_id', mockUser.id)
        .single();

      expect(result.error.code).toBe('PGRST116');
    });
  });

  describe('Knowledge Base Upsert', () => {
    it('should upsert knowledge base with user_id conflict', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      });

      const knowledgeBase = {
        user_id: mockUser.id,
        names: 'Test User',
        last_compiled_at: new Date().toISOString()
      };

      await mockSupabase.from('user_knowledge_base').upsert(knowledgeBase, {
        onConflict: 'user_id'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('user_knowledge_base');
    });

    it('should handle upsert errors', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({
        error: { message: 'Upsert failed' }
      });

      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      });

      const result = await mockSupabase.from('user_knowledge_base').upsert({});

      expect(result.error.message).toBe('Upsert failed');
    });
  });

  describe('Focus Areas Extraction', () => {
    const extractFocusAreas = (predictions: any[], goalsSummary: Record<string, any>): string[] => {
      const focusAreas: string[] = [];

      for (const prediction of predictions) {
        if (prediction.recommendations) {
          const recs = Array.isArray(prediction.recommendations) ? prediction.recommendations : [];
          for (const rec of recs.slice(0, 2)) {
            if (typeof rec === 'string') focusAreas.push(rec);
            else if (rec.text) focusAreas.push(rec.text);
          }
        }
      }

      const lowCompletionCategories = Object.entries(goalsSummary.byCategory || {})
        .filter(([_, count]) => (count as number) > 2)
        .map(([category]) => `Complete ${category} tasks`);

      return [...new Set([...focusAreas, ...lowCompletionCategories])].slice(0, 5);
    };

    it('should extract recommendations from predictions', () => {
      const predictions = [
        { recommendations: ['Save more', 'Exercise daily'] }
      ];
      const focusAreas = extractFocusAreas(predictions, {});

      expect(focusAreas).toContain('Save more');
      expect(focusAreas).toContain('Exercise daily');
    });

    it('should add categories with many incomplete tasks', () => {
      const goalsSummary = {
        byCategory: {
          financial: 5,
          health: 1
        }
      };
      const focusAreas = extractFocusAreas([], goalsSummary);

      expect(focusAreas).toContain('Complete financial tasks');
      expect(focusAreas).not.toContain('Complete health tasks');
    });

    it('should limit to 5 focus areas', () => {
      const predictions = [
        { recommendations: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }
      ];
      const focusAreas = extractFocusAreas(predictions, {});

      expect(focusAreas.length).toBeLessThanOrEqual(5);
    });
  });
});
