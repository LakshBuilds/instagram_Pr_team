/**
 * Property-Based Tests for Unrestricted Single Reel Refresh
 * Feature: unrestricted-reel-refresh
 * 
 * These tests validate that single reel refresh has no time-based restrictions
 * while maintaining proper timestamp tracking for audit purposes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the supabase client before importing the module
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

// Mock the internal API
vi.mock('@/lib/internalApi', () => ({
  fetchFromInternalApi: vi.fn(() => Promise.resolve({})),
  transformInternalApiToReel: vi.fn(() => ({
    videoplaycount: 1000,
    videoviewcount: 1000,
    likescount: 100,
    commentscount: 10,
    ownerusername: 'testuser',
    takenat: new Date().toISOString(),
  })),
}));

// Mock viewsHistory
vi.mock('@/lib/viewsHistory', () => ({
  recordViewsSnapshot: vi.fn(() => Promise.resolve({ success: true })),
  getReelsForRefresh: vi.fn(() => Promise.resolve([])),
  calculateDecayPriority: vi.fn(() => 50),
}));

// Now import the module after mocks are set up
import {
  canRefreshSingleReel,
  validateSingleReelRefresh,
  getSingleReelRefreshRecommendation,
  getRefreshRecommendation,
  formatErrorMessage,
} from '../smartRefresh';

describe('Unrestricted Single Reel Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 1: Unrestricted Refresh Access
   * For any reel and any timestamp (date, hour, or time), when a user initiates
   * a single reel refresh, the system should process the request without applying
   * any temporal restrictions or cooldown periods.
   * 
   * Feature: unrestricted-reel-refresh, Property 1: Unrestricted Refresh Access
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
   */
  describe('Property 1: Unrestricted Refresh Access', () => {
    it('should always allow single reel refresh regardless of reel ID', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // Generate random reel IDs
          (reelId) => {
            const canRefresh = canRefreshSingleReel(reelId);
            expect(canRefresh).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always validate single reel refresh as valid', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (reelId) => {
            const validation = validateSingleReelRefresh(reelId);
            expect(validation.isValid).toBe(true);
            expect(validation.reason).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always recommend refresh for single reels regardless of last refresh time', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })),
          (reelId, lastRefreshTime) => {
            const recommendation = getSingleReelRefreshRecommendation(
              reelId,
              lastRefreshTime ?? undefined
            );
            expect(recommendation.shouldRefresh).toBe(true);
            // Reason should not mention time restrictions
            expect(recommendation.reason.toLowerCase()).not.toContain('hour');
            expect(recommendation.reason.toLowerCase()).not.toContain('wait');
            expect(recommendation.reason.toLowerCase()).not.toContain('cooldown');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow consecutive refresh requests without time delays', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.date(), { minLength: 2, maxLength: 10 }),
          (reelId, timestamps) => {
            // Simulate multiple consecutive refresh attempts
            for (const timestamp of timestamps) {
              const canRefresh = canRefreshSingleReel(reelId);
              const validation = validateSingleReelRefresh(reelId);
              const recommendation = getSingleReelRefreshRecommendation(reelId, timestamp);
              
              expect(canRefresh).toBe(true);
              expect(validation.isValid).toBe(true);
              expect(recommendation.shouldRefresh).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Time-Free Error Messages
   * For any refresh failure scenario, error messages should provide actionable
   * information without mentioning time restrictions, cooldowns, or suggesting
   * time-based waiting periods.
   * 
   * Feature: unrestricted-reel-refresh, Property 4: Time-Free Error Messages
   * Validates: Requirements 3.1, 3.3, 3.4
   */
  describe('Property 4: Time-Free Error Messages', () => {
    it('should remove time-related suggestions from error messages', () => {
      const timeRelatedErrors = [
        'Rate limit exceeded. Wait 60 seconds before retrying.',
        'Too many requests. Try again in 5 minutes.',
        'Cooldown period active. Please wait.',
        'Retry after 30 seconds.',
        'Rate limit: wait 2 hours before next request.',
      ];

      for (const errorMsg of timeRelatedErrors) {
        const formatted = formatErrorMessage(errorMsg);
        expect(formatted.toLowerCase()).not.toMatch(/wait\s+\d+\s*(seconds?|minutes?|hours?)/i);
        expect(formatted.toLowerCase()).not.toMatch(/try\s+again\s+(in|after)\s+\d+/i);
        expect(formatted.toLowerCase()).not.toContain('cooldown');
        expect(formatted.toLowerCase()).not.toMatch(/retry\s+after\s+\d+/i);
      }
    });

    it('should not include time-related terms in single reel refresh recommendations', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.option(fc.date()),
          (reelId, lastRefreshTime) => {
            const recommendation = getSingleReelRefreshRecommendation(
              reelId,
              lastRefreshTime ?? undefined
            );
            
            const reasonLower = recommendation.reason.toLowerCase();
            expect(reasonLower).not.toContain('wait');
            expect(reasonLower).not.toContain('cooldown');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Immediate Retry Capability
   * For any failed refresh attempt, the system should allow immediate retry
   * attempts without enforcing time-based delays.
   * 
   * Feature: unrestricted-reel-refresh, Property 5: Immediate Retry Capability
   * Validates: Requirements 3.2
   */
  describe('Property 5: Immediate Retry Capability', () => {
    it('should always allow retry after any refresh attempt', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.nat({ max: 10 }), // Number of retry attempts
          (reelId, retryCount) => {
            // After any number of attempts, refresh should still be allowed
            for (let i = 0; i <= retryCount; i++) {
              const canRefresh = canRefreshSingleReel(reelId);
              expect(canRefresh).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Always-Enabled UI
   * For any single reel refresh button, it should be enabled at all times
   * and not display time-related tooltips, countdown timers, or time-based
   * status indicators.
   * 
   * Feature: unrestricted-reel-refresh, Property 6: Always-Enabled UI
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4
   */
  describe('Property 6: Always-Enabled UI', () => {
    it('should always indicate refresh is available for single reels', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.option(fc.date()),
          (reelId, lastRefreshTime) => {
            const recommendation = getSingleReelRefreshRecommendation(
              reelId,
              lastRefreshTime ?? undefined
            );
            
            // UI should always show refresh as available
            expect(recommendation.shouldRefresh).toBe(true);
            
            // Reason should be simple and not mention time
            expect(recommendation.reason).toBe('Refresh available');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Batch refresh should still have time-based recommendations
   * (only single reel refresh is unrestricted)
   */
  describe('Batch Refresh Recommendations (separate from single reel)', () => {
    it('should provide batch refresh recommendations based on time', () => {
      fc.assert(
        fc.property(
          fc.nat({ min: 1, max: 1000 }), // totalReels
          fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() })),
          (totalReels, lastRefreshTime) => {
            const recommendation = getRefreshRecommendation(
              totalReels,
              lastRefreshTime ?? undefined
            );
            
            // Batch recommendations should have a count
            expect(typeof recommendation.recommendedCount).toBe('number');
            expect(recommendation.recommendedCount).toBeGreaterThanOrEqual(0);
            
            // Batch recommendations mention that single reel is always available
            if (!recommendation.shouldRefresh) {
              expect(recommendation.reason.toLowerCase()).toContain('single reel');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


  /**
   * Property 2: Immediate Processing
   * For any single reel refresh request, the system should begin processing
   * within 1 second and process requests in FIFO order without time-based
   * queuing delays.
   * 
   * Feature: unrestricted-reel-refresh, Property 2: Immediate Processing
   * Validates: Requirements 2.1, 2.2, 2.4
   */
  describe('Property 2: Immediate Processing', () => {
    it('should not have any time-based queuing in validation', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          (firstReelId, additionalReelIds) => {
            const allReelIds = [firstReelId, ...additionalReelIds];
            
            // All reels should be immediately processable
            for (const reelId of allReelIds) {
              const canRefresh = canRefreshSingleReel(reelId);
              const validation = validateSingleReelRefresh(reelId);
              
              expect(canRefresh).toBe(true);
              expect(validation.isValid).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should process requests without time-based delays in validation', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.date(),
          (reelId, timestamp) => {
            // Validation should be instant regardless of timestamp
            const startTime = Date.now();
            const validation = validateSingleReelRefresh(reelId);
            const endTime = Date.now();
            
            expect(validation.isValid).toBe(true);
            // Validation should complete in under 10ms (no artificial delays)
            expect(endTime - startTime).toBeLessThan(10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 3: Single Reel Priority
   * For any combination of single reel and batch refresh requests submitted
   * simultaneously, single reel requests should be processed before batch operations.
   * 
   * Feature: unrestricted-reel-refresh, Property 3: Single Reel Priority
   * Validates: Requirements 2.3
   */
  describe('Property 3: Single Reel Priority', () => {
    it('should assign high priority to single reel refreshes', async () => {
      // Import the priority functions
      const { getRefreshPriority, hasHigherPriority } = await import('../smartRefresh');
      
      fc.assert(
        fc.property(
          fc.boolean(), // isSingleReel
          (isSingleReel) => {
            const priority = getRefreshPriority(isSingleReel);
            
            if (isSingleReel) {
              expect(priority).toBe('high');
            } else {
              expect(priority).toBe('normal');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly compare priorities - single reel beats batch', async () => {
      const { getRefreshPriority, hasHigherPriority } = await import('../smartRefresh');
      
      const singleReelPriority = getRefreshPriority(true);
      const batchPriority = getRefreshPriority(false);
      
      // Single reel should have higher priority than batch
      expect(hasHigherPriority(singleReelPriority, batchPriority)).toBe(true);
      expect(hasHigherPriority(batchPriority, singleReelPriority)).toBe(false);
    });
  });


  /**
   * Property 7: Complete Data Updates
   * For any successful reel refresh, all analytics metrics should be updated
   * with the latest data while maintaining consistency across all related
   * database tables and preserving historical data.
   * 
   * Feature: unrestricted-reel-refresh, Property 7: Complete Data Updates
   * Validates: Requirements 5.1, 5.2, 5.3
   */
  describe('Property 7: Complete Data Updates', () => {
    it('should include timestamp in refresh results', async () => {
      const { refreshSingleReel } = await import('../smartRefresh');
      
      // Test that refresh results include timestamp
      const result = await refreshSingleReel(
        'test-reel-id',
        'test-shortcode',
        'https://www.instagram.com/reel/test/',
        'test@example.com'
      );
      
      // Result should have a timestamp
      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should always set retryable to true for data integrity', async () => {
      const { refreshSingleReel } = await import('../smartRefresh');
      
      const result = await refreshSingleReel(
        'test-reel-id',
        'test-shortcode',
        'https://www.instagram.com/reel/test/',
        'test@example.com'
      );
      
      // Retryable should always be true for single reel refreshes
      expect(result.retryable).toBe(true);
    });
  });


  /**
   * Property 8: Proper Timestamp Management
   * For any refresh operation, the system should accurately record timestamps
   * for audit purposes while ensuring these timestamps never restrict future
   * refresh operations.
   * 
   * Feature: unrestricted-reel-refresh, Property 8: Proper Timestamp Management
   * Validates: Requirements 5.4, 5.5, 5.6, 5.7
   */
  describe('Property 8: Proper Timestamp Management', () => {
    it('should record timestamps without creating restrictions', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.date(), { minLength: 1, maxLength: 5 }),
          (reelId, timestamps) => {
            // After recording any number of timestamps, refresh should still be allowed
            for (const timestamp of timestamps) {
              const recommendation = getSingleReelRefreshRecommendation(reelId, timestamp);
              expect(recommendation.shouldRefresh).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow refresh regardless of how recent the last timestamp was', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (reelId) => {
            // Even with a timestamp from just now, refresh should be allowed
            const justNow = new Date();
            const recommendation = getSingleReelRefreshRecommendation(reelId, justNow);
            expect(recommendation.shouldRefresh).toBe(true);
            
            // Even with a timestamp from 1 second ago
            const oneSecondAgo = new Date(Date.now() - 1000);
            const recommendation2 = getSingleReelRefreshRecommendation(reelId, oneSecondAgo);
            expect(recommendation2.shouldRefresh).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include timestamp in all refresh results', async () => {
      const { refreshSingleReel } = await import('../smartRefresh');
      
      const beforeRefresh = new Date();
      const result = await refreshSingleReel(
        'test-reel-id',
        'test-shortcode',
        'https://www.instagram.com/reel/test/',
        'test@example.com'
      );
      const afterRefresh = new Date();
      
      // Timestamp should be present and within the expected range
      expect(result.timestamp).toBeDefined();
      expect(result.timestamp!.getTime()).toBeGreaterThanOrEqual(beforeRefresh.getTime());
      expect(result.timestamp!.getTime()).toBeLessThanOrEqual(afterRefresh.getTime());
    });
  });


  /**
   * Unit tests for audit system
   * Validates: Requirements 5.5, 5.7
   */
  describe('Audit System', () => {
    it('should call recordViewsSnapshot during refresh', async () => {
      const { recordViewsSnapshot } = await import('@/lib/viewsHistory');
      const { refreshSingleReel } = await import('../smartRefresh');
      
      // Clear previous calls
      vi.mocked(recordViewsSnapshot).mockClear();
      
      await refreshSingleReel(
        'test-reel-id',
        'test-shortcode',
        'https://www.instagram.com/reel/test/',
        'test@example.com'
      );
      
      // recordViewsSnapshot should have been called for audit purposes
      expect(recordViewsSnapshot).toHaveBeenCalled();
    });

    it('should pass correct parameters to audit function', async () => {
      const { recordViewsSnapshot } = await import('@/lib/viewsHistory');
      const { refreshSingleReel } = await import('../smartRefresh');
      
      vi.mocked(recordViewsSnapshot).mockClear();
      
      const testReelId = 'audit-test-reel-id';
      const testShortcode = 'audit-test-shortcode';
      const testEmail = 'audit-test@example.com';
      
      await refreshSingleReel(
        testReelId,
        testShortcode,
        'https://www.instagram.com/reel/test/',
        testEmail
      );
      
      // Verify the audit function was called with correct reel ID and email
      expect(recordViewsSnapshot).toHaveBeenCalledWith(
        testReelId,
        testShortcode,
        expect.anything(), // ownerusername
        expect.any(Number), // videoplaycount
        expect.any(Number), // videoviewcount
        expect.any(Number), // likescount
        expect.any(Number), // commentscount
        expect.anything(), // takenat
        testEmail
      );
    });
  });


  /**
   * Integration tests for concurrent refreshes
   * Validates: Requirements 2.1, 2.4
   */
  describe('Concurrent Refresh Handling', () => {
    it('should handle multiple concurrent validation requests', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          (reelIds) => {
            // Simulate concurrent validation requests
            const results = reelIds.map(id => ({
              canRefresh: canRefreshSingleReel(id),
              validation: validateSingleReelRefresh(id),
            }));
            
            // All should be allowed
            for (const result of results) {
              expect(result.canRefresh).toBe(true);
              expect(result.validation.isValid).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistency across concurrent recommendation requests', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          fc.array(fc.date(), { minLength: 2, maxLength: 10 }),
          (reelIds, timestamps) => {
            // Simulate concurrent recommendation requests
            const results = reelIds.map((id, i) => 
              getSingleReelRefreshRecommendation(id, timestamps[i % timestamps.length])
            );
            
            // All should recommend refresh
            for (const result of results) {
              expect(result.shouldRefresh).toBe(true);
              expect(result.reason).toBe('Refresh available');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
