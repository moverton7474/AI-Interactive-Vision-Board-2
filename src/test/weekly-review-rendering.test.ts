/**
 * Weekly Review Rendering Tests
 *
 * Tests for safe data rendering functions used in the Reviews page
 * to prevent React Error #31 (rendering objects as children).
 *
 * These utilities ensure all data is properly converted to strings
 * or arrays before being rendered in the UI.
 *
 * @module weekly-review-rendering.test
 */

import { describe, it, expect } from 'vitest';

// ============================================
// Safe Rendering Utility Functions
// ============================================

/**
 * Safely converts any value to a string for rendering
 * Handles null, undefined, objects, arrays, and primitives
 */
const safeText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => safeText(item)).join(', ');
  }

  if (typeof value === 'object') {
    // Check for common patterns in review data
    if ('message' in value && typeof (value as any).message === 'string') {
      return (value as any).message;
    }
    if ('text' in value && typeof (value as any).text === 'string') {
      return (value as any).text;
    }
    if ('title' in value && typeof (value as any).title === 'string') {
      return (value as any).title;
    }
    if ('content' in value && typeof (value as any).content === 'string') {
      return (value as any).content;
    }

    // Last resort: JSON stringify
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }

  return String(value);
};

/**
 * Safely converts any value to a string array for rendering lists
 * Handles objects, strings, arrays, and edge cases
 */
const safeArray = (value: unknown): string[] => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(item => safeText(item));
  }

  if (typeof value === 'string') {
    return value.split('\n').filter(line => line.trim().length > 0);
  }

  if (typeof value === 'object') {
    // Handle object with array-like properties
    if ('items' in value && Array.isArray((value as any).items)) {
      return safeArray((value as any).items);
    }
    if ('steps' in value && Array.isArray((value as any).steps)) {
      return safeArray((value as any).steps);
    }
    if ('list' in value && Array.isArray((value as any).list)) {
      return safeArray((value as any).list);
    }

    // Convert object to single-item array
    return [safeText(value)];
  }

  return [String(value)];
};

/**
 * Safely renders a percentage value
 */
const safePercentage = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '0%';
  }

  const num = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return '0%';
  }

  return `${Math.round(num)}%`;
};

/**
 * Safely renders a date value
 */
const safeDate = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }

  return '';
};

// ============================================
// safeText Tests
// ============================================

describe('safeText', () => {
  describe('primitive values', () => {
    it('should handle strings', () => {
      expect(safeText('Hello World')).toBe('Hello World');
      expect(safeText('')).toBe('');
    });

    it('should handle numbers', () => {
      expect(safeText(42)).toBe('42');
      expect(safeText(3.14159)).toBe('3.14159');
      expect(safeText(0)).toBe('0');
      expect(safeText(-5)).toBe('-5');
    });

    it('should handle booleans', () => {
      expect(safeText(true)).toBe('true');
      expect(safeText(false)).toBe('false');
    });
  });

  describe('null and undefined', () => {
    it('should return empty string for null', () => {
      expect(safeText(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(safeText(undefined)).toBe('');
    });
  });

  describe('arrays', () => {
    it('should join array elements with comma', () => {
      expect(safeText(['a', 'b', 'c'])).toBe('a, b, c');
    });

    it('should handle mixed array types', () => {
      expect(safeText(['text', 42, true])).toBe('text, 42, true');
    });

    it('should handle empty array', () => {
      expect(safeText([])).toBe('');
    });

    it('should handle nested arrays', () => {
      expect(safeText([['a', 'b'], 'c'])).toBe('a, b, c');
    });
  });

  describe('objects', () => {
    it('should extract message property', () => {
      expect(safeText({ message: 'Hello' })).toBe('Hello');
    });

    it('should extract text property', () => {
      expect(safeText({ text: 'Content here' })).toBe('Content here');
    });

    it('should extract title property', () => {
      expect(safeText({ title: 'My Title' })).toBe('My Title');
    });

    it('should extract content property', () => {
      expect(safeText({ content: 'Body content' })).toBe('Body content');
    });

    it('should JSON stringify unknown objects', () => {
      const obj = { foo: 'bar', baz: 123 };
      const result = safeText(obj);
      expect(result).toContain('foo');
      expect(result).toContain('bar');
    });

    it('should handle empty object', () => {
      expect(safeText({})).toBe('{}');
    });
  });

  describe('edge cases (React Error #31 prevention)', () => {
    it('should handle object that was accidentally passed to render', () => {
      // This is the exact scenario that causes React Error #31
      const reviewData = {
        insights: { text: 'AI generated insight' },
        wins: [{ title: 'Win 1' }, { title: 'Win 2' }]
      };

      // If insights is accidentally rendered directly, safeText should handle it
      expect(safeText(reviewData.insights)).toBe('AI generated insight');
    });

    it('should handle deeply nested object', () => {
      const nested = {
        level1: {
          level2: {
            message: 'Deep message'
          }
        }
      };

      // Should not throw
      expect(() => safeText(nested)).not.toThrow();
    });

    it('should handle circular reference gracefully', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      // JSON.stringify will fail, should fall back to [Object]
      expect(safeText(circular)).toBe('[Object]');
    });
  });
});

// ============================================
// safeArray Tests
// ============================================

describe('safeArray', () => {
  describe('null and undefined', () => {
    it('should return empty array for null', () => {
      expect(safeArray(null)).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      expect(safeArray(undefined)).toEqual([]);
    });
  });

  describe('arrays', () => {
    it('should convert array of strings', () => {
      expect(safeArray(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('should convert array of objects to strings', () => {
      const arr = [{ title: 'Item 1' }, { title: 'Item 2' }];
      const result = safeArray(arr);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe('Item 1');
      expect(result[1]).toBe('Item 2');
    });

    it('should handle mixed array', () => {
      const arr = ['string', 42, { message: 'obj' }];
      const result = safeArray(arr);

      expect(result).toEqual(['string', '42', 'obj']);
    });

    it('should handle empty array', () => {
      expect(safeArray([])).toEqual([]);
    });
  });

  describe('strings', () => {
    it('should split multiline string into array', () => {
      const multiline = 'Line 1\nLine 2\nLine 3';
      expect(safeArray(multiline)).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should filter empty lines', () => {
      const withEmpty = 'Line 1\n\n\nLine 2';
      expect(safeArray(withEmpty)).toEqual(['Line 1', 'Line 2']);
    });

    it('should handle single line string', () => {
      expect(safeArray('Single line')).toEqual(['Single line']);
    });

    it('should handle empty string', () => {
      expect(safeArray('')).toEqual([]);
    });
  });

  describe('objects', () => {
    it('should extract items property', () => {
      const obj = { items: ['a', 'b', 'c'] };
      expect(safeArray(obj)).toEqual(['a', 'b', 'c']);
    });

    it('should extract steps property', () => {
      const obj = { steps: ['Step 1', 'Step 2'] };
      expect(safeArray(obj)).toEqual(['Step 1', 'Step 2']);
    });

    it('should extract list property', () => {
      const obj = { list: ['Item A', 'Item B'] };
      expect(safeArray(obj)).toEqual(['Item A', 'Item B']);
    });

    it('should convert object without array property to single-item array', () => {
      const obj = { message: 'Single message' };
      expect(safeArray(obj)).toEqual(['Single message']);
    });
  });

  describe('edge cases (React Error #31 prevention)', () => {
    it('should handle next_steps object from AI response', () => {
      // AI sometimes returns next_steps as object instead of array
      const aiResponse = {
        next_steps: {
          items: ['Focus on habit X', 'Review goal Y']
        }
      };

      const result = safeArray(aiResponse.next_steps);
      expect(result).toEqual(['Focus on habit X', 'Review goal Y']);
    });

    it('should handle wins array with mixed content', () => {
      const wins = [
        'Completed all daily habits',
        { title: 'Finished project', category: 'work' },
        { message: 'Mood improvement' }
      ];

      const result = safeArray(wins);
      expect(result).toContain('Completed all daily habits');
      expect(result).toContain('Finished project');
      expect(result).toContain('Mood improvement');
    });
  });
});

// ============================================
// safePercentage Tests
// ============================================

describe('safePercentage', () => {
  it('should format numbers as percentage', () => {
    expect(safePercentage(85)).toBe('85%');
    expect(safePercentage(100)).toBe('100%');
    expect(safePercentage(0)).toBe('0%');
  });

  it('should round decimal percentages', () => {
    expect(safePercentage(85.7)).toBe('86%');
    expect(safePercentage(33.33)).toBe('33%');
  });

  it('should handle string numbers', () => {
    expect(safePercentage('75')).toBe('75%');
    expect(safePercentage('50.5')).toBe('51%');
  });

  it('should return 0% for invalid values', () => {
    expect(safePercentage(null)).toBe('0%');
    expect(safePercentage(undefined)).toBe('0%');
    expect(safePercentage('invalid')).toBe('0%');
    expect(safePercentage({})).toBe('0%');
  });
});

// ============================================
// safeDate Tests
// ============================================

describe('safeDate', () => {
  it('should format Date objects', () => {
    const date = new Date('2024-01-15');
    const result = safeDate(date);
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('should parse date strings', () => {
    const result = safeDate('2024-01-15');
    expect(result).toBeTruthy();
  });

  it('should return empty string for invalid dates', () => {
    expect(safeDate(null)).toBe('');
    expect(safeDate(undefined)).toBe('');
  });

  it('should return original string for unparseable date strings', () => {
    expect(safeDate('Not a date')).toBe('Not a date');
  });
});

// ============================================
// Integration Tests - Review Data Rendering
// ============================================

describe('Review Data Rendering Integration', () => {
  describe('rendering weekly review summary', () => {
    it('should safely render all review properties', () => {
      const review = {
        id: 'review-123',
        week_start: '2024-01-15',
        habit_completion_rate: 85,
        insights: 'Great progress this week!',
        wins: ['Completed all daily habits', 'Finished budget review'],
        blockers: ['Missed exercise twice'],
        next_steps: ['Set exercise reminders', 'Track water intake'],
        mood_average: 4.2,
        sentiment_trend: 'positive'
      };

      // All properties should be safely renderable
      expect(() => safeText(review.insights)).not.toThrow();
      expect(() => safeArray(review.wins)).not.toThrow();
      expect(() => safeArray(review.blockers)).not.toThrow();
      expect(() => safeArray(review.next_steps)).not.toThrow();
      expect(() => safePercentage(review.habit_completion_rate)).not.toThrow();
    });

    it('should handle AI-generated review with object values', () => {
      // Sometimes AI returns objects instead of strings
      const aiReview = {
        insights: { text: 'AI analysis of your week', confidence: 0.95 },
        wins: [
          { title: 'Win 1', description: 'Details' },
          { title: 'Win 2', description: 'More details' }
        ],
        next_steps: {
          items: ['Step 1', 'Step 2', 'Step 3']
        }
      };

      expect(safeText(aiReview.insights)).toBe('AI analysis of your week');
      expect(safeArray(aiReview.wins)).toEqual(['Win 1', 'Win 2']);
      expect(safeArray(aiReview.next_steps)).toEqual(['Step 1', 'Step 2', 'Step 3']);
    });

    it('should handle missing or null review data', () => {
      const incompleteReview = {
        id: 'review-456',
        week_start: '2024-01-22',
        habit_completion_rate: null,
        insights: null,
        wins: undefined,
        blockers: [],
        next_steps: null
      };

      expect(safeText(incompleteReview.insights)).toBe('');
      expect(safeArray(incompleteReview.wins)).toEqual([]);
      expect(safeArray(incompleteReview.next_steps)).toEqual([]);
      expect(safePercentage(incompleteReview.habit_completion_rate)).toBe('0%');
    });
  });

  describe('preventing React Error #31', () => {
    it('should handle the exact error scenario: object passed to JSX', () => {
      // This simulates what happens when an object is accidentally rendered
      const problematicData = {
        response: {
          message: 'This is the message',
          metadata: { source: 'AI', version: 2 }
        }
      };

      // Direct access to nested object would cause Error #31
      // safeText should extract the renderable content
      expect(safeText(problematicData.response)).toBe('This is the message');
    });

    it('should handle array of objects that look like React elements', () => {
      // Arrays of objects can also cause Error #31
      const items = [
        { type: 'div', props: { children: 'text' } }, // Looks like React element
        { title: 'Normal item' }
      ];

      const result = safeArray(items);
      expect(result).toHaveLength(2);
      expect(typeof result[0]).toBe('string');
      expect(typeof result[1]).toBe('string');
    });
  });
});

// ============================================
// Performance Tests
// ============================================

describe('Safe Rendering Performance', () => {
  it('should handle large arrays efficiently', () => {
    const largeArray = Array(1000).fill(null).map((_, i) => ({
      title: `Item ${i}`,
      value: i
    }));

    const start = performance.now();
    const result = safeArray(largeArray);
    const duration = performance.now() - start;

    expect(result).toHaveLength(1000);
    expect(duration).toBeLessThan(100); // Should complete in under 100ms
  });

  it('should handle deeply nested objects without stack overflow', () => {
    let nested: any = { message: 'base' };
    for (let i = 0; i < 50; i++) {
      nested = { child: nested };
    }

    expect(() => safeText(nested)).not.toThrow();
  });
});
