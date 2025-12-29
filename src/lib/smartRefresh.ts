import { supabase } from "@/integrations/supabase/client";
import { fetchFromInternalApi, transformInternalApiToReel } from "./internalApi";
import { recordViewsSnapshot, getReelsForRefresh, calculateDecayPriority } from "./viewsHistory";

export interface RefreshResult {
  success: boolean;
  reelId: string;
  shortcode: string;
  oldViews: number;
  newViews: number;
  viewsGrowth: number;
  error?: string;
  retryable?: boolean;
  timestamp?: Date;
}

export interface SingleReelRefreshOptions {
  skipTimeValidation?: boolean; // Always true for single reel refresh
  priority?: 'high' | 'normal'; // Single reels always get 'high' priority
}

export type RefreshPriority = 'high' | 'normal';

/**
 * Get the priority for a refresh request
 * Single reel refreshes always have HIGH priority
 * Batch refreshes have NORMAL priority
 */
export function getRefreshPriority(isSingleReel: boolean): RefreshPriority {
  return isSingleReel ? 'high' : 'normal';
}

/**
 * Compare priorities - returns true if first has higher priority
 */
export function hasHigherPriority(a: RefreshPriority, b: RefreshPriority): boolean {
  if (a === 'high' && b === 'normal') return true;
  return false;
}

export interface BatchRefreshResult {
  total: number;
  successful: number;
  failed: number;
  results: RefreshResult[];
  totalViewsGrowth: number;
}

/**
 * Check if a single reel can be refreshed - ALWAYS returns true
 * Single reel refreshes have no time-based restrictions
 */
export function canRefreshSingleReel(_reelId: string): boolean {
  // Single reel refreshes are always allowed - no time restrictions
  return true;
}

/**
 * Validate a single reel refresh request - no time-based validation
 */
export function validateSingleReelRefresh(_reelId: string): { isValid: boolean; reason?: string } {
  // Single reel refreshes are always valid - no temporal restrictions
  return { isValid: true };
}

export async function refreshSingleReel(
  reelId: string,
  shortcode: string,
  permalink: string,
  userEmail: string,
  onProgress?: (status: string) => void,
  _options?: SingleReelRefreshOptions // Options parameter for future extensibility
): Promise<RefreshResult> {
  // Single reel refresh has NO time-based restrictions
  // Always process immediately without checking date, hour, or cooldown periods
  const refreshTimestamp = new Date();
  
  try {
    const { data: currentReel } = await supabase
      .from('reels')
      .select('videoplaycount, videoviewcount, likescount, commentscount, takenat')
      .eq('id', reelId)
      .single();

    // Use nullish coalescing (??) to properly handle 0 values
    const oldViews = Number(currentReel?.videoplaycount ?? currentReel?.videoviewcount ?? 0);

    const url = permalink || `https://www.instagram.com/reel/${shortcode}/`;
    
    // Use async API with progress callback - no time-based delays
    const apiResponse = await fetchFromInternalApi(url, {
      useAsync: true,
      onProgress: (status) => onProgress?.(status),
    });
    
    const transformedData = transformInternalApiToReel(apiResponse, url);

    // Use nullish coalescing (??) to properly handle 0 values
    const newViews = transformedData.videoplaycount ?? transformedData.videoviewcount ?? 0;

    const { error: updateError } = await supabase
      .from('reels')
      .update({
        // Always update all fields, even if 0 - ensures data accuracy
        videoplaycount: transformedData.videoplaycount ?? 0,
        videoviewcount: transformedData.videoviewcount ?? 0,
        likescount: transformedData.likescount ?? 0,
        commentscount: transformedData.commentscount ?? 0,
        last_refreshed_at: refreshTimestamp.toISOString(),
        updated_at: refreshTimestamp.toISOString(),
      })
      .eq('id', reelId);

    if (updateError) {
      return {
        success: false,
        reelId,
        shortcode,
        oldViews,
        newViews: 0,
        viewsGrowth: 0,
        error: updateError.message,
        retryable: true, // Always allow immediate retry
        timestamp: refreshTimestamp,
      };
    }

    // Record views snapshot for timestamp tracking (audit purposes only, not restrictions)
    await recordViewsSnapshot(
      reelId,
      shortcode,
      transformedData.ownerusername,
      transformedData.videoplaycount ?? 0,
      transformedData.videoviewcount ?? 0,
      transformedData.likescount ?? 0,
      transformedData.commentscount ?? 0,
      transformedData.takenat,
      userEmail
    );

    return {
      success: true,
      reelId,
      shortcode,
      oldViews,
      newViews,
      viewsGrowth: newViews - oldViews,
      retryable: true,
      timestamp: refreshTimestamp,
    };
  } catch (err) {
    // Error messages never mention time restrictions
    const errorMessage = formatErrorMessage(err);
    return {
      success: false,
      reelId,
      shortcode,
      oldViews: 0,
      newViews: 0,
      viewsGrowth: 0,
      error: errorMessage,
      retryable: true, // Always allow immediate retry for single reels
      timestamp: refreshTimestamp,
    };
  }
}

/**
 * Format error messages without time-related suggestions
 * Error messages should be actionable but never suggest waiting
 */
export function formatErrorMessage(err: unknown): string {
  const rawError = String(err);
  
  // Remove any time-related suggestions from error messages
  const timeRelatedPatterns = [
    /wait\s+\d+\s*(seconds?|minutes?|hours?)/gi,
    /try\s+again\s+(in|after)\s+\d+/gi,
    /cooldown/gi,
    /rate\s*limit.*\d+\s*(seconds?|minutes?|hours?)/gi,
    /retry\s+after\s+\d+/gi,
  ];
  
  let cleanedError = rawError;
  for (const pattern of timeRelatedPatterns) {
    cleanedError = cleanedError.replace(pattern, 'retry now');
  }
  
  return cleanedError;
}

export async function smartBatchRefresh(
  maxReels: number = 20,
  userEmail?: string,
  onProgress?: (current: number, total: number, result: RefreshResult, status?: string) => void
): Promise<BatchRefreshResult> {
  const reelsToRefresh = await getReelsForRefresh(maxReels, userEmail);
  
  const results: RefreshResult[] = [];
  let successful = 0;
  let failed = 0;
  let totalViewsGrowth = 0;

  for (let i = 0; i < reelsToRefresh.length; i++) {
    const reel = reelsToRefresh[i];
    
    const result = await refreshSingleReel(
      reel.reel_id,
      reel.shortcode,
      reel.permalink || `https://www.instagram.com/reel/${reel.shortcode}/`,
      userEmail || '',
      (status) => onProgress?.(i + 1, reelsToRefresh.length, result, status)
    );

    results.push(result);
    
    if (result.success) {
      successful++;
      totalViewsGrowth += result.viewsGrowth;
    } else {
      failed++;
    }

    if (onProgress) {
      onProgress(i + 1, reelsToRefresh.length, result);
    }

    // Small delay between requests to avoid overwhelming the API
    if (i < reelsToRefresh.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return {
    total: reelsToRefresh.length,
    successful,
    failed,
    results,
    totalViewsGrowth,
  };
}

/**
 * Get refresh recommendation for BATCH operations only
 * Single reel refreshes are always allowed without restrictions
 * This function only applies to batch/smart refresh operations
 */
export function getRefreshRecommendation(
  totalReels: number,
  lastRefreshTime?: Date
): { shouldRefresh: boolean; recommendedCount: number; reason: string } {
  const now = new Date();
  const hoursSinceRefresh = lastRefreshTime 
    ? (now.getTime() - lastRefreshTime.getTime()) / 3600000 
    : 24;

  // Note: These restrictions only apply to BATCH operations
  // Single reel refreshes bypass all time restrictions
  if (hoursSinceRefresh < 6) {
    return {
      shouldRefresh: false,
      recommendedCount: 0,
      reason: 'Batch refresh available in a few hours (single reel refresh always available)',
    };
  }

  if (hoursSinceRefresh >= 12) {
    const count = Math.min(Math.ceil(totalReels * 0.3), 30);
    return {
      shouldRefresh: true,
      recommendedCount: count,
      reason: 'Batch refresh recommended',
    };
  }

  const count = Math.min(Math.ceil(totalReels * 0.15), 15);
  return {
    shouldRefresh: true,
    recommendedCount: count,
    reason: 'Regular batch refresh available',
  };
}

/**
 * Get recommendation for single reel refresh - ALWAYS allowed
 * No time-based restrictions for individual reel refreshes
 */
export function getSingleReelRefreshRecommendation(
  _reelId: string,
  _lastRefreshTime?: Date
): { shouldRefresh: boolean; reason: string } {
  // Single reel refresh is ALWAYS allowed - no time restrictions
  return {
    shouldRefresh: true,
    reason: 'Refresh available',
  };
}