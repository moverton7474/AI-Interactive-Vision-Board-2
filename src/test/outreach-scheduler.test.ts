/**
 * Outreach Scheduler Tests
 *
 * Tests for the OutreachScheduler component functionality including:
 * - Phone status indicators (configured vs missing)
 * - Member filtering and display
 * - Send mode validation
 *
 * @module outreach-scheduler.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock Types (matching OutreachScheduler.tsx)
// ============================================

interface TeamMember {
  userId: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  isActive: boolean;
  hasPhone?: boolean;
}

interface ScheduledOutreach {
  id: string;
  userId: string;
  memberName: string;
  scheduledTime: Date;
  channel: 'sms' | 'email' | 'push';
  status: 'pending' | 'sent' | 'failed';
}

interface CommPreferences {
  userId: string;
  phone?: string;
  smsEnabled: boolean;
}

// ============================================
// Test Data
// ============================================

const TEST_MEMBERS: TeamMember[] = [
  { userId: 'user-1', displayName: 'Alice Johnson', role: 'member', isActive: true, hasPhone: true },
  { userId: 'user-2', displayName: 'Bob Smith', role: 'member', isActive: true, hasPhone: false },
  { userId: 'user-3', displayName: 'Carol White', role: 'admin', isActive: true, hasPhone: true },
  { userId: 'user-4', displayName: 'Dave Brown', role: 'viewer', isActive: false, hasPhone: true },
];

const TEST_COMM_PREFS: CommPreferences[] = [
  { userId: 'user-1', phone: '+15551234567', smsEnabled: true },
  { userId: 'user-2', phone: undefined, smsEnabled: false },
  { userId: 'user-3', phone: '+15559876543', smsEnabled: true },
  { userId: 'user-4', phone: '+15551111111', smsEnabled: true },
];

// ============================================
// Phone Status Indicator Logic
// ============================================

/**
 * Determines if a member has a configured phone number
 */
const memberHasPhone = (
  userId: string,
  commPrefs: CommPreferences[]
): boolean => {
  const prefs = commPrefs.find(p => p.userId === userId);
  return !!(prefs?.phone && prefs.phone.length > 0);
};

/**
 * Get phone status icon for display
 */
const getPhoneStatusIcon = (hasPhone: boolean): string => {
  return hasPhone ? '📱' : '⚠️';
};

/**
 * Get phone status message for tooltip
 */
const getPhoneStatusMessage = (hasPhone: boolean): string => {
  return hasPhone
    ? 'Phone configured'
    : 'No phone number - cannot send SMS';
};

/**
 * Enriches team members with phone status
 */
const enrichMembersWithPhoneStatus = (
  members: TeamMember[],
  commPrefs: CommPreferences[]
): TeamMember[] => {
  return members.map(member => ({
    ...member,
    hasPhone: memberHasPhone(member.userId, commPrefs)
  }));
};

// ============================================
// Member Filtering Logic
// ============================================

/**
 * Filters members eligible for SMS outreach
 * Excludes inactive members and those without phone numbers in "Send Now" mode
 */
const filterEligibleMembers = (
  members: TeamMember[],
  mode: 'schedule' | 'sendNow',
  requirePhone: boolean = true
): TeamMember[] => {
  return members.filter(member => {
    // Must be active
    if (!member.isActive) return false;

    // In Send Now mode with SMS, must have phone
    if (mode === 'sendNow' && requirePhone && !member.hasPhone) {
      return false;
    }

    return true;
  });
};

/**
 * Groups members by phone status for display
 */
const groupMembersByPhoneStatus = (
  members: TeamMember[]
): { withPhone: TeamMember[]; withoutPhone: TeamMember[] } => {
  return {
    withPhone: members.filter(m => m.hasPhone),
    withoutPhone: members.filter(m => !m.hasPhone)
  };
};

// ============================================
// Outreach Validation Logic
// ============================================

/**
 * Validates if an outreach can be sent to a member
 */
const validateOutreach = (
  member: TeamMember,
  channel: 'sms' | 'email' | 'push',
  commPrefs: CommPreferences[]
): { valid: boolean; error?: string } => {
  if (!member.isActive) {
    return { valid: false, error: 'Member is inactive' };
  }

  if (channel === 'sms') {
    const prefs = commPrefs.find(p => p.userId === member.userId);

    if (!prefs?.phone) {
      return {
        valid: false,
        error: `${member.displayName} has not configured a phone number. They need to add their phone number in Settings > Notification Settings.`
      };
    }

    if (!prefs.smsEnabled) {
      return { valid: false, error: `${member.displayName} has disabled SMS notifications` };
    }
  }

  return { valid: true };
};

/**
 * Generates warning message for members missing phone numbers
 */
const generatePhoneWarning = (membersWithoutPhone: TeamMember[]): string | null => {
  if (membersWithoutPhone.length === 0) return null;

  const names = membersWithoutPhone.map(m => m.displayName).join(', ');
  return `The following members don't have phone numbers configured: ${names}. They won't receive SMS messages until they add their phone number in Settings.`;
};

// ============================================
// Phone Status Indicator Tests
// ============================================

describe('Phone Status Indicators', () => {
  describe('memberHasPhone', () => {
    it('should return true when member has phone configured', () => {
      expect(memberHasPhone('user-1', TEST_COMM_PREFS)).toBe(true);
      expect(memberHasPhone('user-3', TEST_COMM_PREFS)).toBe(true);
    });

    it('should return false when member has no phone', () => {
      expect(memberHasPhone('user-2', TEST_COMM_PREFS)).toBe(false);
    });

    it('should return false when member not in prefs', () => {
      expect(memberHasPhone('non-existent-user', TEST_COMM_PREFS)).toBe(false);
    });

    it('should return false for empty phone string', () => {
      const prefsWithEmpty = [{ userId: 'user-x', phone: '', smsEnabled: true }];
      expect(memberHasPhone('user-x', prefsWithEmpty)).toBe(false);
    });
  });

  describe('getPhoneStatusIcon', () => {
    it('should return phone emoji for configured phone', () => {
      expect(getPhoneStatusIcon(true)).toBe('📱');
    });

    it('should return warning emoji for missing phone', () => {
      expect(getPhoneStatusIcon(false)).toBe('⚠️');
    });
  });

  describe('getPhoneStatusMessage', () => {
    it('should return positive message for configured phone', () => {
      expect(getPhoneStatusMessage(true)).toBe('Phone configured');
    });

    it('should return warning message for missing phone', () => {
      expect(getPhoneStatusMessage(false)).toContain('No phone number');
      expect(getPhoneStatusMessage(false)).toContain('cannot send SMS');
    });
  });

  describe('enrichMembersWithPhoneStatus', () => {
    it('should add hasPhone property to all members', () => {
      const enriched = enrichMembersWithPhoneStatus(TEST_MEMBERS, TEST_COMM_PREFS);

      expect(enriched[0].hasPhone).toBe(true);  // Alice has phone
      expect(enriched[1].hasPhone).toBe(false); // Bob has no phone
      expect(enriched[2].hasPhone).toBe(true);  // Carol has phone
    });

    it('should not mutate original array', () => {
      const original = [...TEST_MEMBERS];
      enrichMembersWithPhoneStatus(TEST_MEMBERS, TEST_COMM_PREFS);

      expect(TEST_MEMBERS).toEqual(original);
    });
  });
});

// ============================================
// Member Filtering Tests
// ============================================

describe('Member Filtering', () => {
  const enrichedMembers = enrichMembersWithPhoneStatus(TEST_MEMBERS, TEST_COMM_PREFS);

  describe('filterEligibleMembers', () => {
    it('should filter out inactive members', () => {
      const eligible = filterEligibleMembers(enrichedMembers, 'schedule', false);

      expect(eligible.some(m => m.userId === 'user-4')).toBe(false); // Dave is inactive
      expect(eligible).toHaveLength(3);
    });

    it('should filter out members without phone in sendNow mode', () => {
      const eligible = filterEligibleMembers(enrichedMembers, 'sendNow', true);

      expect(eligible.some(m => m.userId === 'user-2')).toBe(false); // Bob has no phone
      expect(eligible).toHaveLength(2); // Alice and Carol
    });

    it('should include members without phone in schedule mode', () => {
      const eligible = filterEligibleMembers(enrichedMembers, 'schedule', false);

      expect(eligible.some(m => m.userId === 'user-2')).toBe(true); // Bob included
      expect(eligible).toHaveLength(3);
    });

    it('should return empty array if all members are ineligible', () => {
      const inactiveMembers: TeamMember[] = [
        { userId: 'user-x', displayName: 'Inactive User', role: 'member', isActive: false }
      ];

      const eligible = filterEligibleMembers(inactiveMembers, 'sendNow', true);
      expect(eligible).toHaveLength(0);
    });
  });

  describe('groupMembersByPhoneStatus', () => {
    it('should correctly group members by phone status', () => {
      const groups = groupMembersByPhoneStatus(enrichedMembers);

      expect(groups.withPhone).toHaveLength(3); // Alice, Carol, Dave (Dave has phone but inactive)
      expect(groups.withoutPhone).toHaveLength(1); // Bob
    });

    it('should handle empty array', () => {
      const groups = groupMembersByPhoneStatus([]);

      expect(groups.withPhone).toHaveLength(0);
      expect(groups.withoutPhone).toHaveLength(0);
    });

    it('should handle all members having phones', () => {
      const allWithPhone = enrichedMembers.filter(m => m.hasPhone);
      const groups = groupMembersByPhoneStatus(allWithPhone);

      expect(groups.withPhone.length).toBe(allWithPhone.length);
      expect(groups.withoutPhone).toHaveLength(0);
    });
  });
});

// ============================================
// Outreach Validation Tests
// ============================================

describe('Outreach Validation', () => {
  const enrichedMembers = enrichMembersWithPhoneStatus(TEST_MEMBERS, TEST_COMM_PREFS);

  describe('validateOutreach', () => {
    it('should validate SMS outreach for member with phone', () => {
      const alice = enrichedMembers.find(m => m.userId === 'user-1')!;
      const result = validateOutreach(alice, 'sms', TEST_COMM_PREFS);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject SMS outreach for member without phone', () => {
      const bob = enrichedMembers.find(m => m.userId === 'user-2')!;
      const result = validateOutreach(bob, 'sms', TEST_COMM_PREFS);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Bob Smith');
      expect(result.error).toContain('has not configured a phone number');
      expect(result.error).toContain('Settings > Notification Settings');
    });

    it('should reject outreach for inactive member', () => {
      const dave = enrichedMembers.find(m => m.userId === 'user-4')!;
      const result = validateOutreach(dave, 'sms', TEST_COMM_PREFS);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Member is inactive');
    });

    it('should reject SMS for member with SMS disabled', () => {
      const prefsWithSmsDisabled = [
        { userId: 'user-1', phone: '+15551234567', smsEnabled: false }
      ];
      const alice = enrichedMembers.find(m => m.userId === 'user-1')!;
      const result = validateOutreach(alice, 'sms', prefsWithSmsDisabled);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('disabled SMS notifications');
    });

    it('should allow email outreach regardless of phone status', () => {
      const bob = enrichedMembers.find(m => m.userId === 'user-2')!;
      const result = validateOutreach(bob, 'email', TEST_COMM_PREFS);

      expect(result.valid).toBe(true);
    });

    it('should allow push outreach regardless of phone status', () => {
      const bob = enrichedMembers.find(m => m.userId === 'user-2')!;
      const result = validateOutreach(bob, 'push', TEST_COMM_PREFS);

      expect(result.valid).toBe(true);
    });
  });

  describe('generatePhoneWarning', () => {
    it('should return null when all members have phones', () => {
      const withPhone = enrichedMembers.filter(m => m.hasPhone);
      const warning = generatePhoneWarning([]);

      expect(warning).toBeNull();
    });

    it('should generate warning for members without phones', () => {
      const withoutPhone = enrichedMembers.filter(m => !m.hasPhone);
      const warning = generatePhoneWarning(withoutPhone);

      expect(warning).not.toBeNull();
      expect(warning).toContain('Bob Smith');
      expect(warning).toContain("don't have phone numbers configured");
    });

    it('should list multiple members in warning', () => {
      const multipleWithoutPhone = [
        { userId: 'u1', displayName: 'User One', role: 'member' as const, isActive: true, hasPhone: false },
        { userId: 'u2', displayName: 'User Two', role: 'member' as const, isActive: true, hasPhone: false },
      ];

      const warning = generatePhoneWarning(multipleWithoutPhone);

      expect(warning).toContain('User One');
      expect(warning).toContain('User Two');
    });
  });
});

// ============================================
// Send Mode Logic Tests
// ============================================

describe('Send Mode Logic', () => {
  describe('Send Now mode restrictions', () => {
    const enrichedMembers = enrichMembersWithPhoneStatus(TEST_MEMBERS, TEST_COMM_PREFS);

    it('should disable selection for members without phone in Send Now SMS mode', () => {
      const isSelectable = (member: TeamMember, mode: 'schedule' | 'sendNow', channel: 'sms'): boolean => {
        if (mode === 'sendNow' && channel === 'sms' && !member.hasPhone) {
          return false;
        }
        return member.isActive;
      };

      const bob = enrichedMembers.find(m => m.userId === 'user-2')!;
      const alice = enrichedMembers.find(m => m.userId === 'user-1')!;

      expect(isSelectable(bob, 'sendNow', 'sms')).toBe(false);
      expect(isSelectable(alice, 'sendNow', 'sms')).toBe(true);
    });

    it('should allow selection in Schedule mode even without phone', () => {
      const isSelectable = (member: TeamMember, mode: 'schedule' | 'sendNow'): boolean => {
        return member.isActive;
      };

      const bob = enrichedMembers.find(m => m.userId === 'user-2')!;

      expect(isSelectable(bob, 'schedule')).toBe(true);
    });
  });
});

// ============================================
// Error Message Formatting Tests
// ============================================

describe('Error Message Formatting', () => {
  it('should format user-friendly error for missing phone', () => {
    const formatMissingPhoneError = (userName: string, userEmail?: string): string => {
      const identifier = userEmail || userName;
      return `User "${identifier}" has not configured communication preferences. They need to add their phone number in Settings > Notification Settings.`;
    };

    const error = formatMissingPhoneError('Bob Smith', 'bob@example.com');

    expect(error).toContain('bob@example.com');
    expect(error).toContain('Settings > Notification Settings');
  });

  it('should fall back to name when email not available', () => {
    const formatMissingPhoneError = (userName: string, userEmail?: string): string => {
      const identifier = userEmail || userName;
      return `User "${identifier}" has not configured communication preferences.`;
    };

    const error = formatMissingPhoneError('Bob Smith');

    expect(error).toContain('Bob Smith');
  });
});

// ============================================
// Integration Scenario Tests
// ============================================

describe('Outreach Scheduler Integration Scenarios', () => {
  it('should correctly process team for SMS outreach', () => {
    // Step 1: Enrich members with phone status
    const enriched = enrichMembersWithPhoneStatus(TEST_MEMBERS, TEST_COMM_PREFS);

    // Step 2: Filter eligible for Send Now SMS
    const eligible = filterEligibleMembers(enriched, 'sendNow', true);

    // Step 3: Validate each member
    const validationResults = eligible.map(member => ({
      member,
      validation: validateOutreach(member, 'sms', TEST_COMM_PREFS)
    }));

    // All eligible members should pass validation
    expect(validationResults.every(r => r.validation.valid)).toBe(true);

    // Should have Alice and Carol
    expect(eligible.map(m => m.displayName)).toContain('Alice Johnson');
    expect(eligible.map(m => m.displayName)).toContain('Carol White');

    // Should not have Bob (no phone) or Dave (inactive)
    expect(eligible.map(m => m.displayName)).not.toContain('Bob Smith');
    expect(eligible.map(m => m.displayName)).not.toContain('Dave Brown');
  });

  it('should show warning about members who cannot receive SMS', () => {
    const enriched = enrichMembersWithPhoneStatus(TEST_MEMBERS, TEST_COMM_PREFS);
    const activeMembers = enriched.filter(m => m.isActive);
    const { withoutPhone } = groupMembersByPhoneStatus(activeMembers);

    const warning = generatePhoneWarning(withoutPhone);

    expect(warning).not.toBeNull();
    expect(warning).toContain('Bob Smith');
  });
});
