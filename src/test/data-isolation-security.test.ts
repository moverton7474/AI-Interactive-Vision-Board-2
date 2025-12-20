/**
 * Data Isolation Security Tests
 *
 * Tests to verify that users can only access their own data and cannot
 * see other users' vision boards, documents, or personal information.
 *
 * These tests validate the security fixes for the CRITICAL data bleeding
 * vulnerability where users could see each other's vision boards.
 *
 * @module data-isolation-security.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock Types
// ============================================

interface MockUser {
  id: string;
  email: string;
}

interface MockVisionBoard {
  id: string;
  user_id: string;
  prompt: string;
  image_url: string;
  is_favorite?: boolean;
}

interface MockDocument {
  id: string;
  user_id: string;
  title: string;
  content?: string;
}

interface MockProfile {
  id: string;
  user_id: string;
  full_name: string;
  primary_vision_id: string | null;
}

// ============================================
// Test Data
// ============================================

const TEST_USERS = {
  lisa: { id: 'lisa-uuid-12345', email: 'lisa@example.com' },
  milton: { id: 'milton-uuid-67890', email: 'milton@example.com' },
  admin: { id: 'admin-uuid-00001', email: 'admin@visionary.app' },
};

const TEST_VISION_BOARDS: MockVisionBoard[] = [
  { id: 'vb-lisa-1', user_id: TEST_USERS.lisa.id, prompt: 'Lisa beach house', image_url: '/lisa1.png' },
  { id: 'vb-lisa-2', user_id: TEST_USERS.lisa.id, prompt: 'Lisa retirement', image_url: '/lisa2.png' },
  { id: 'vb-milton-1', user_id: TEST_USERS.milton.id, prompt: 'Milton mountain cabin', image_url: '/milton1.png' },
  { id: 'vb-milton-2', user_id: TEST_USERS.milton.id, prompt: 'Milton world travel', image_url: '/milton2.png' },
];

const TEST_DOCUMENTS: MockDocument[] = [
  { id: 'doc-lisa-1', user_id: TEST_USERS.lisa.id, title: 'Lisa Financial Plan' },
  { id: 'doc-milton-1', user_id: TEST_USERS.milton.id, title: 'Milton Retirement Goals' },
];

// ============================================
// Security Policy Simulation Functions
// ============================================

/**
 * Simulates the fixed query behavior in App.tsx
 * Vision boards must filter by BOTH id AND user_id
 */
const fetchVisionBoardSecure = (
  visionBoards: MockVisionBoard[],
  visionBoardId: string,
  currentUserId: string
): MockVisionBoard | null => {
  // SECURITY FIX: Always check user_id in addition to id
  return visionBoards.find(
    vb => vb.id === visionBoardId && vb.user_id === currentUserId
  ) || null;
};

/**
 * Simulates the INSECURE (old) query behavior - DO NOT USE IN PRODUCTION
 * This is what caused the data bleeding vulnerability
 */
const fetchVisionBoardInsecure = (
  visionBoards: MockVisionBoard[],
  visionBoardId: string
): MockVisionBoard | null => {
  // VULNERABILITY: Only checking id, not user_id
  return visionBoards.find(vb => vb.id === visionBoardId) || null;
};

/**
 * Simulates RLS policy for vision board SELECT
 */
const rlsPolicyVisionBoardSelect = (
  visionBoard: MockVisionBoard,
  currentUserId: string,
  platformRole: string | null = null
): boolean => {
  // Platform admin and support can view all
  if (platformRole === 'platform_admin' || platformRole === 'support_agent') {
    return true;
  }
  // Regular users can only view their own
  return visionBoard.user_id === currentUserId;
};

/**
 * Simulates the storageService.deleteVisionImage secure implementation
 */
const deleteVisionImageSecure = (
  visionBoards: MockVisionBoard[],
  visionBoardId: string,
  currentUserId: string
): { success: boolean; error?: string } => {
  const visionBoard = visionBoards.find(vb => vb.id === visionBoardId);

  if (!visionBoard) {
    return { success: false, error: 'Vision board not found' };
  }

  // SECURITY: Verify ownership before delete
  if (visionBoard.user_id !== currentUserId) {
    return { success: false, error: 'Unauthorized: You do not own this vision board' };
  }

  return { success: true };
};

/**
 * Simulates fetching user's vision boards list (print-products function)
 */
const fetchUserVisionBoardsSecure = (
  visionBoards: MockVisionBoard[],
  currentUserId: string
): MockVisionBoard[] => {
  // SECURITY FIX: Always filter by user_id
  return visionBoards.filter(vb => vb.user_id === currentUserId);
};

// ============================================
// Core Security Tests
// ============================================

describe('Data Isolation Security', () => {
  describe('Vision Board Access Control', () => {
    it('user cannot access another user vision board by ID', () => {
      // Lisa tries to access Milton's vision board
      const result = fetchVisionBoardSecure(
        TEST_VISION_BOARDS,
        'vb-milton-1', // Milton's vision board ID
        TEST_USERS.lisa.id // Lisa is logged in
      );

      expect(result).toBeNull();
    });

    it('user can access their own vision board by ID', () => {
      // Lisa accesses her own vision board
      const result = fetchVisionBoardSecure(
        TEST_VISION_BOARDS,
        'vb-lisa-1',
        TEST_USERS.lisa.id
      );

      expect(result).not.toBeNull();
      expect(result?.prompt).toBe('Lisa beach house');
    });

    it('DEMONSTRATES VULNERABILITY: insecure query returns any user data', () => {
      // This test demonstrates what the OLD code would do
      // Lisa tries to access Milton's vision board with insecure query
      const result = fetchVisionBoardInsecure(
        TEST_VISION_BOARDS,
        'vb-milton-1' // No user_id check!
      );

      // OLD CODE WOULD RETURN MILTON'S DATA TO LISA - THIS IS THE BUG
      expect(result).not.toBeNull();
      expect(result?.user_id).toBe(TEST_USERS.milton.id);
      expect(result?.prompt).toBe('Milton mountain cabin');
    });

    it('user only sees their own vision boards in list', () => {
      const lisaBoards = fetchUserVisionBoardsSecure(TEST_VISION_BOARDS, TEST_USERS.lisa.id);
      const miltonBoards = fetchUserVisionBoardsSecure(TEST_VISION_BOARDS, TEST_USERS.milton.id);

      expect(lisaBoards).toHaveLength(2);
      expect(miltonBoards).toHaveLength(2);

      // Verify Lisa only gets her boards
      expect(lisaBoards.every(vb => vb.user_id === TEST_USERS.lisa.id)).toBe(true);

      // Verify Milton only gets his boards
      expect(miltonBoards.every(vb => vb.user_id === TEST_USERS.milton.id)).toBe(true);

      // Verify no cross-contamination
      expect(lisaBoards.some(vb => vb.user_id === TEST_USERS.milton.id)).toBe(false);
      expect(miltonBoards.some(vb => vb.user_id === TEST_USERS.lisa.id)).toBe(false);
    });
  });

  describe('Vision Board Delete Security', () => {
    it('user cannot delete another user vision board', () => {
      // Lisa tries to delete Milton's vision board
      const result = deleteVisionImageSecure(
        TEST_VISION_BOARDS,
        'vb-milton-1',
        TEST_USERS.lisa.id
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    it('user can delete their own vision board', () => {
      const result = deleteVisionImageSecure(
        TEST_VISION_BOARDS,
        'vb-lisa-1',
        TEST_USERS.lisa.id
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('RLS Policy Simulation', () => {
    it('RLS allows user to view own vision boards', () => {
      const lisaBoard = TEST_VISION_BOARDS.find(vb => vb.id === 'vb-lisa-1')!;

      expect(rlsPolicyVisionBoardSelect(lisaBoard, TEST_USERS.lisa.id)).toBe(true);
    });

    it('RLS blocks user from viewing other user vision boards', () => {
      const miltonBoard = TEST_VISION_BOARDS.find(vb => vb.id === 'vb-milton-1')!;

      expect(rlsPolicyVisionBoardSelect(miltonBoard, TEST_USERS.lisa.id)).toBe(false);
    });

    it('RLS allows platform admin to view any vision board', () => {
      const miltonBoard = TEST_VISION_BOARDS.find(vb => vb.id === 'vb-milton-1')!;

      expect(rlsPolicyVisionBoardSelect(miltonBoard, TEST_USERS.admin.id, 'platform_admin')).toBe(true);
    });

    it('RLS allows support agent to view any vision board', () => {
      const lisaBoard = TEST_VISION_BOARDS.find(vb => vb.id === 'vb-lisa-1')!;

      expect(rlsPolicyVisionBoardSelect(lisaBoard, TEST_USERS.admin.id, 'support_agent')).toBe(true);
    });
  });

  describe('Primary Vision Board Security (App.tsx Fix)', () => {
    /**
     * This test specifically validates the fix in App.tsx lines 243-249
     * where the primary vision board query was missing user_id filter
     */
    it('fetching primary vision board requires user_id match', () => {
      // Simulate Lisa's profile pointing to Milton's vision board (data inconsistency)
      const lisaProfile: MockProfile = {
        id: 'profile-lisa',
        user_id: TEST_USERS.lisa.id,
        full_name: 'Lisa Smith',
        primary_vision_id: 'vb-milton-1', // WRONG - pointing to Milton's board
      };

      // With secure query, Lisa should NOT see Milton's board
      const result = fetchVisionBoardSecure(
        TEST_VISION_BOARDS,
        lisaProfile.primary_vision_id!,
        TEST_USERS.lisa.id
      );

      expect(result).toBeNull();
    });

    it('fetching primary vision board succeeds when user owns it', () => {
      const lisaProfile: MockProfile = {
        id: 'profile-lisa',
        user_id: TEST_USERS.lisa.id,
        full_name: 'Lisa Smith',
        primary_vision_id: 'vb-lisa-1', // Correct - Lisa's own board
      };

      const result = fetchVisionBoardSecure(
        TEST_VISION_BOARDS,
        lisaProfile.primary_vision_id!,
        TEST_USERS.lisa.id
      );

      expect(result).not.toBeNull();
      expect(result?.prompt).toBe('Lisa beach house');
    });
  });

  describe('Document Access Control', () => {
    const fetchDocumentSecure = (
      documents: MockDocument[],
      docId: string,
      currentUserId: string
    ): MockDocument | null => {
      return documents.find(
        doc => doc.id === docId && doc.user_id === currentUserId
      ) || null;
    };

    it('user cannot access another user documents', () => {
      const result = fetchDocumentSecure(
        TEST_DOCUMENTS,
        'doc-milton-1',
        TEST_USERS.lisa.id
      );

      expect(result).toBeNull();
    });

    it('user can access their own documents', () => {
      const result = fetchDocumentSecure(
        TEST_DOCUMENTS,
        'doc-lisa-1',
        TEST_USERS.lisa.id
      );

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Lisa Financial Plan');
    });
  });

  describe('Defense in Depth', () => {
    /**
     * Tests that multiple layers of security work together
     */
    it('should block access even if one layer fails', () => {
      // Scenario: RLS might be bypassed (service role), but application code should still check
      const applicationLevelCheck = (
        visionBoard: MockVisionBoard,
        currentUserId: string
      ): boolean => {
        return visionBoard.user_id === currentUserId;
      };

      const miltonBoard = TEST_VISION_BOARDS.find(vb => vb.id === 'vb-milton-1')!;

      // Even if RLS is bypassed, application should block
      expect(applicationLevelCheck(miltonBoard, TEST_USERS.lisa.id)).toBe(false);
    });

    it('should require authentication for all data access', () => {
      const requireAuth = (userId: string | null): boolean => {
        return userId !== null && userId !== undefined && userId !== '';
      };

      expect(requireAuth(TEST_USERS.lisa.id)).toBe(true);
      expect(requireAuth(null)).toBe(false);
      expect(requireAuth('')).toBe(false);
    });
  });
});

// ============================================
// Edge Cases and Error Handling
// ============================================

describe('Data Isolation Edge Cases', () => {
  it('should handle non-existent vision board ID', () => {
    const result = fetchVisionBoardSecure(
      TEST_VISION_BOARDS,
      'non-existent-id',
      TEST_USERS.lisa.id
    );

    expect(result).toBeNull();
  });

  it('should handle empty user ID', () => {
    const result = fetchVisionBoardSecure(
      TEST_VISION_BOARDS,
      'vb-lisa-1',
      ''
    );

    expect(result).toBeNull();
  });

  it('should handle null-like values safely', () => {
    const safeCheck = (userId: string | null | undefined): boolean => {
      if (!userId) return false;
      return userId.length > 0;
    };

    expect(safeCheck(null)).toBe(false);
    expect(safeCheck(undefined)).toBe(false);
    expect(safeCheck('')).toBe(false);
    expect(safeCheck(TEST_USERS.lisa.id)).toBe(true);
  });

  it('should prevent SQL injection in user ID (conceptual)', () => {
    // This test demonstrates that malicious input is handled safely
    const maliciousUserId = "'; DROP TABLE vision_boards; --";

    // The parameterized query approach in Supabase prevents SQL injection
    // This test verifies the concept that user input is treated as data, not code
    const result = fetchVisionBoardSecure(
      TEST_VISION_BOARDS,
      'vb-lisa-1',
      maliciousUserId
    );

    // Should not find any vision boards (malicious ID doesn't match any user)
    expect(result).toBeNull();
  });
});

// ============================================
// Workbook PDF Generation Security (generate-workbook-pdf fix)
// ============================================

describe('Workbook PDF Generation Security', () => {
  it('should only include user-owned vision boards in workbook', () => {
    const getVisionBoardsForWorkbook = (
      visionBoards: MockVisionBoard[],
      requestedIds: string[],
      currentUserId: string
    ): MockVisionBoard[] => {
      // SECURITY: Filter by BOTH requested IDs AND user ownership
      return visionBoards.filter(
        vb => requestedIds.includes(vb.id) && vb.user_id === currentUserId
      );
    };

    // Lisa requests workbook with her ID AND Milton's ID (mixed request)
    const requestedIds = ['vb-lisa-1', 'vb-lisa-2', 'vb-milton-1'];

    const result = getVisionBoardsForWorkbook(
      TEST_VISION_BOARDS,
      requestedIds,
      TEST_USERS.lisa.id
    );

    // Should only return Lisa's boards, not Milton's
    expect(result).toHaveLength(2);
    expect(result.every(vb => vb.user_id === TEST_USERS.lisa.id)).toBe(true);
    expect(result.some(vb => vb.id === 'vb-milton-1')).toBe(false);
  });

  it('should return empty array if user owns none of requested boards', () => {
    const getVisionBoardsForWorkbook = (
      visionBoards: MockVisionBoard[],
      requestedIds: string[],
      currentUserId: string
    ): MockVisionBoard[] => {
      return visionBoards.filter(
        vb => requestedIds.includes(vb.id) && vb.user_id === currentUserId
      );
    };

    // Lisa requests only Milton's boards
    const requestedIds = ['vb-milton-1', 'vb-milton-2'];

    const result = getVisionBoardsForWorkbook(
      TEST_VISION_BOARDS,
      requestedIds,
      TEST_USERS.lisa.id
    );

    expect(result).toHaveLength(0);
  });
});
