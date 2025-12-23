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
}

export interface BatchRefreshResult {
  total: number;
  successful: number;
  failed: number;
  results: RefreshResult[];
  totalViewsGrowth: number;
}

export async function refreshSingleReel(
  reelId: string,
  shortcode: string,
  permalink: string,
  userEmail: string
): Promise<RefreshResult> {
  try {
    const { data: currentReel } = await supabase
      .from('reels')
      .select('videoplaycount, videoviewcount, likescount, commentscount, takenat')
      .eq('id', reelId)
      .single();

    const oldViews = currentReel?.videoplaycount || currentReel?.videoviewcount || 0;

    const url = permalink || `https://www.instagram.com/reel/${shortcode}/`;
    const apiResponse = await fetchFromInternalApi(url);
    const transformedData = transformInternalApiToReel(apiResponse, url);

    const newViews = transformedData.videoplaycount || transformedData.videoviewcount || 0;
    const decayPriority = transformedData.takenat 
      ? calculateDecayPriority(transformedData.takenat) 
      : 50;

    const { error: updateError } = await supabase
      .from('reels')
      .update({
        videoplaycount: transformedData.videoplaycount,
        videoviewcount: transformedData.videoviewcount,
        likescount: transformedData.likescount,
        commentscount: transformedData.commentscount,
        decay_priority: decayPriority,
        last_refresh_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
      };
    }

    await recordViewsSnapshot(
      reelId,
      shortcode,
      transformedData.ownerusername,
      transformedData.videoplaycount || 0,
      transformedData.videoviewcount || 0,
      transformedData.likescount || 0,
      transformedData.commentscount || 0,
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
    };
  } catch (err) {
    return {
      success: false,
      reelId,
      shortcode,
      oldViews: 0,
      newViews: 0,
      viewsGrowth: 0,
      error: String(err),
    };
  }
}

export async function smartBatchRefresh(
  maxReels: number = 20,
  userEmail?: string,
  onProgress?: (current: number, total: number, result: RefreshResult) => void
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
      userEmail || ''
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

    if (i < reelsToRefresh.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
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

export function getRefreshRecommendation(
  totalReels: number,
  lastRefreshTime?: Date
): { shouldRefresh: boolean; recommendedCount: number; reason: string } {
  const now = new Date();
  const hoursSinceRefresh = lastRefreshTime 
    ? (now.getTime() - lastRefreshTime.getTime()) / 3600000 
    : 24;

  if (hoursSinceRefresh < 6) {
    return {
      shouldRefresh: false,
      recommendedCount: 0,
      reason: 'Last refresh was less than 6 hours ago',
    };
  }

  if (hoursSinceRefresh >= 12) {
    const count = Math.min(Math.ceil(totalReels * 0.3), 30);
    return {
      shouldRefresh: true,
      recommendedCount: count,
      reason: 'More than 12 hours since last refresh - recommended daily update',
    };
  }

  const count = Math.min(Math.ceil(totalReels * 0.15), 15);
  return {
    shouldRefresh: true,
    recommendedCount: count,
    reason: 'Regular refresh recommended',
  };
}