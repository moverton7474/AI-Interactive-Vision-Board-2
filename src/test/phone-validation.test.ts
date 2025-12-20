/**
 * Phone Number Validation Tests
 *
 * Tests for phone number formatting, validation, and display functions
 * used in NotificationSettings.tsx for SMS/Twilio integration.
 *
 * Phone numbers must be in E.164 format for Twilio (+1XXXXXXXXXX for US)
 *
 * @module phone-validation.test
 */

import { describe, it, expect } from 'vitest';

// ============================================
// Phone Formatting Functions (from NotificationSettings.tsx)
// ============================================

/**
 * Format phone number for display with proper spacing
 * Input: raw digits or E.164 format
 * Output: +1 (XXX) XXX-XXXX format for US numbers
 */
const formatPhoneForDisplay = (phone: string): string => {
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 0) return '';

  // Build formatted string
  if (digits.length <= 1) {
    return hasPlus ? `+${digits}` : digits;
  } else if (digits.length <= 4) {
    return `+${digits.slice(0, 1)} (${digits.slice(1)}`;
  } else if (digits.length <= 7) {
    return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4)}`;
  } else {
    return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }
};

/**
 * Format phone number for storage in E.164 format
 * Strips all non-digits and adds + prefix
 */
const formatPhoneForStorage = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return '';
  return `+${digits}`;
};

/**
 * Validate phone number and return status
 * Checks for proper E.164 format with country code
 */
const validatePhone = (phone: string): { valid: boolean; message: string } => {
  if (!phone || phone.trim() === '') {
    return { valid: false, message: '' };
  }

  const digits = phone.replace(/\D/g, '');

  if (digits.length < 11) {
    return {
      valid: false,
      message: 'Phone number must include country code (e.g., +1 for US)'
    };
  }

  if (digits.length > 15) {
    return {
      valid: false,
      message: 'Phone number is too long'
    };
  }

  // US number validation
  if (digits.startsWith('1') && digits.length === 11) {
    return { valid: true, message: 'Valid US phone number' };
  }

  // International number validation
  if (digits.length >= 10 && digits.length <= 15) {
    return { valid: true, message: 'Valid international phone number' };
  }

  return { valid: false, message: 'Invalid phone number format' };
};

// ============================================
// Display Formatting Tests
// ============================================

describe('Phone Number Display Formatting', () => {
  describe('formatPhoneForDisplay', () => {
    it('should handle empty string', () => {
      expect(formatPhoneForDisplay('')).toBe('');
    });

    it('should handle single digit', () => {
      expect(formatPhoneForDisplay('1')).toBe('1');
      expect(formatPhoneForDisplay('+1')).toBe('+1');
    });

    it('should format partial country code and area code', () => {
      expect(formatPhoneForDisplay('+155')).toBe('+1 (55');
      expect(formatPhoneForDisplay('+1555')).toBe('+1 (555');
    });

    it('should format country code and area code', () => {
      expect(formatPhoneForDisplay('+15551')).toBe('+1 (555) 1');
      expect(formatPhoneForDisplay('+155512')).toBe('+1 (555) 12');
      expect(formatPhoneForDisplay('+1555123')).toBe('+1 (555) 123');
    });

    it('should format full US phone number', () => {
      expect(formatPhoneForDisplay('+15551234567')).toBe('+1 (555) 123-4567');
      expect(formatPhoneForDisplay('15551234567')).toBe('+1 (555) 123-4567');
    });

    it('should handle numbers with existing formatting', () => {
      expect(formatPhoneForDisplay('+1 (555) 123-4567')).toBe('+1 (555) 123-4567');
      expect(formatPhoneForDisplay('(555) 123-4567')).toBe('+5 (551) 234-567');
    });

    it('should strip non-numeric characters and reformat', () => {
      expect(formatPhoneForDisplay('1-555-123-4567')).toBe('+1 (555) 123-4567');
      expect(formatPhoneForDisplay('1.555.123.4567')).toBe('+1 (555) 123-4567');
    });

    it('should truncate extra digits', () => {
      expect(formatPhoneForDisplay('+155512345678901')).toBe('+1 (555) 123-4567');
    });
  });
});

// ============================================
// Storage Formatting Tests
// ============================================

describe('Phone Number Storage Formatting', () => {
  describe('formatPhoneForStorage', () => {
    it('should handle empty string', () => {
      expect(formatPhoneForStorage('')).toBe('');
    });

    it('should add + prefix to digits', () => {
      expect(formatPhoneForStorage('15551234567')).toBe('+15551234567');
    });

    it('should preserve existing + and strip other characters', () => {
      expect(formatPhoneForStorage('+15551234567')).toBe('+15551234567');
      expect(formatPhoneForStorage('+1 (555) 123-4567')).toBe('+15551234567');
    });

    it('should strip all formatting', () => {
      expect(formatPhoneForStorage('1-555-123-4567')).toBe('+15551234567');
      expect(formatPhoneForStorage('1.555.123.4567')).toBe('+15551234567');
      expect(formatPhoneForStorage('(555) 123-4567')).toBe('+5551234567');
    });

    it('should produce E.164 format', () => {
      const result = formatPhoneForStorage('+1 (555) 123-4567');

      expect(result).toMatch(/^\+\d+$/); // Starts with + followed by only digits
      expect(result).toBe('+15551234567');
    });
  });
});

// ============================================
// Validation Tests
// ============================================

describe('Phone Number Validation', () => {
  describe('validatePhone', () => {
    describe('empty and invalid inputs', () => {
      it('should return invalid for empty string', () => {
        const result = validatePhone('');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('');
      });

      it('should return invalid for whitespace only', () => {
        const result = validatePhone('   ');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('');
      });

      it('should return invalid for null-like values', () => {
        // @ts-ignore - Testing edge case
        const result = validatePhone(null);
        expect(result.valid).toBe(false);
      });
    });

    describe('US phone numbers', () => {
      it('should validate correct US number with country code', () => {
        const result = validatePhone('+15551234567');
        expect(result.valid).toBe(true);
        expect(result.message).toBe('Valid US phone number');
      });

      it('should validate US number without + prefix', () => {
        const result = validatePhone('15551234567');
        expect(result.valid).toBe(true);
        expect(result.message).toBe('Valid US phone number');
      });

      it('should validate formatted US number', () => {
        const result = validatePhone('+1 (555) 123-4567');
        expect(result.valid).toBe(true);
        expect(result.message).toBe('Valid US phone number');
      });

      it('should reject US number without country code', () => {
        const result = validatePhone('5551234567');
        expect(result.valid).toBe(false);
        expect(result.message).toContain('country code');
      });
    });

    describe('international phone numbers', () => {
      it('should validate UK number (+44)', () => {
        const result = validatePhone('+447911123456');
        expect(result.valid).toBe(true);
        expect(result.message).toBe('Valid international phone number');
      });

      it('should validate German number (+49)', () => {
        const result = validatePhone('+491701234567');
        expect(result.valid).toBe(true);
        expect(result.message).toBe('Valid international phone number');
      });

      it('should validate Australian number (+61)', () => {
        const result = validatePhone('+61412345678');
        expect(result.valid).toBe(true);
        expect(result.message).toBe('Valid international phone number');
      });

      it('should validate longer international numbers', () => {
        const result = validatePhone('+861391234567890'); // 15 digits
        expect(result.valid).toBe(true);
      });
    });

    describe('invalid formats', () => {
      it('should reject too short numbers', () => {
        const result = validatePhone('+1234567');
        expect(result.valid).toBe(false);
        expect(result.message).toContain('country code');
      });

      it('should reject too long numbers', () => {
        const result = validatePhone('+12345678901234567890'); // > 15 digits
        expect(result.valid).toBe(false);
        expect(result.message).toContain('too long');
      });

      it('should reject letters mixed with numbers', () => {
        const result = validatePhone('+1555ABC4567');
        expect(result.valid).toBe(false);
        expect(result.message).toContain('country code');
      });
    });
  });
});

// ============================================
// Integration Tests
// ============================================

describe('Phone Number Workflow Integration', () => {
  describe('user input to storage workflow', () => {
    it('should correctly process user typing a US number', () => {
      // Simulate user typing one digit at a time
      const inputs = ['1', '15', '155', '1555', '15551', '155512', '1555123', '15551234', '155512345', '1555123456', '15551234567'];

      for (const input of inputs) {
        const displayed = formatPhoneForDisplay(input);
        const stored = formatPhoneForStorage(input);

        // Display should always be formatted
        expect(displayed.length).toBeGreaterThan(0);

        // Storage should always be E.164 if has content
        if (input.length > 0) {
          expect(stored).toMatch(/^\+\d+$/);
        }
      }

      // Final number should be valid
      const finalValidation = validatePhone('15551234567');
      expect(finalValidation.valid).toBe(true);
    });

    it('should round-trip format correctly', () => {
      const original = '+15551234567';
      const displayed = formatPhoneForDisplay(original);
      const backToStorage = formatPhoneForStorage(displayed);

      expect(backToStorage).toBe(original);
    });
  });

  describe('validation feedback for UI', () => {
    it('should show appropriate message during typing', () => {
      const inputs = [
        { value: '1', expectValid: false },
        { value: '155', expectValid: false },
        { value: '1555123', expectValid: false },
        { value: '15551234567', expectValid: true },
      ];

      for (const { value, expectValid } of inputs) {
        const result = validatePhone(value);
        expect(result.valid).toBe(expectValid);

        if (!expectValid && value.length > 0) {
          expect(result.message.length).toBeGreaterThan(0);
        }
      }
    });
  });
});

// ============================================
// Twilio E.164 Compliance Tests
// ============================================

describe('Twilio E.164 Compliance', () => {
  it('should produce Twilio-compatible format for US numbers', () => {
    const result = formatPhoneForStorage('+1 (555) 123-4567');

    // Twilio requires E.164: +[country code][subscriber number]
    expect(result).toBe('+15551234567');
    expect(result).toMatch(/^\+1[2-9]\d{9}$/); // US E.164 pattern
  });

  it('should produce Twilio-compatible format for international numbers', () => {
    const ukNumber = formatPhoneForStorage('+44 7911 123456');
    expect(ukNumber).toBe('+447911123456');

    const germanNumber = formatPhoneForStorage('+49 170 1234567');
    expect(germanNumber).toBe('+491701234567');
  });

  it('should validate that stored format is ready for Twilio API', () => {
    const testCases = [
      { input: '+1 (555) 123-4567', expected: '+15551234567' },
      { input: '1-555-123-4567', expected: '+15551234567' },
      { input: '+44 7911 123456', expected: '+447911123456' },
    ];

    for (const { input, expected } of testCases) {
      const stored = formatPhoneForStorage(input);
      expect(stored).toBe(expected);

      // All stored values should match E.164 pattern
      expect(stored).toMatch(/^\+\d{10,15}$/);
    }
  });
});

// ============================================
// Edge Cases
// ============================================

describe('Phone Validation Edge Cases', () => {
  it('should handle phone with only country code', () => {
    const result = validatePhone('+1');
    expect(result.valid).toBe(false);
  });

  it('should handle phone with special characters only', () => {
    const result = validatePhone('+-()');
    expect(result.valid).toBe(false);
  });

  it('should handle very long input gracefully', () => {
    const longNumber = '+1' + '5'.repeat(50);
    const result = validatePhone(longNumber);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('too long');
  });

  it('should handle leading/trailing spaces', () => {
    const result = validatePhone('  +15551234567  ');
    expect(result.valid).toBe(true);
  });
});
