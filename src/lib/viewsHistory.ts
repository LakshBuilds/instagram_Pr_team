import { supabase } from "@/integrations/supabase/client";

export interface ViewsSnapshot {
  id?: string;
  reel_id: string;
  shortcode: string;
  ownerusername: string | null;
  videoplaycount: number;
  videoviewcount: number;
  likescount: number;
  commentscount: number;
  recorded_at: string;
  takenat: string | null;
  updated_by_email: string | null;
}

export interface ReelForRefresh {
  reel_id: string;
  shortcode: string;
  ownerusername: string | null;
  decay_priority: number;
  last_refresh_at: string | null;
  days_since_refresh: number;
  permalink?: string;
}

export interface ViewsGrowth {
  reel_id: string;
  shortcode: string;
  ownerusername: string | null;
  views_at_start: number;
  views_at_end: number;
  views_growth: number;
  likes_at_start: number;
  likes_at_end: number;
  likes_growth: number;
}

/**
 * Calculate decay priority based on posting date
 * Newer posts get higher priority for refresh
 */
export function calculateDecayPriority(postingDate: Date | string): number {
  const now = new Date();
  const posted = new Date(postingDate);
  const daysOld = Math.floor((now.getTime() - posted.getTime()) / 86400000);
  
  if (daysOld <= 7) return 100;
  if (daysOld <= 14) return 80;
  if (daysOld <= 30) return 60;
  if (daysOld <= 60) return 40;
  if (daysOld <= 90) return 20;
  return 10;
}

/**
 * Record a views snapshot for a reel
 */
export async function recordViewsSnapshot(
  reelId: string,
  shortcode: string,
  ownerusername: string | null,
  videoplaycount: number,
  videoviewcount: number,
  likescount: number,
  commentscount: number,
  takenat: string | null,
  updatedByEmail: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('views_history').insert({
      reel_id: reelId,
      shortcode,
      ownerusername,
      videoplaycount: videoplaycount || 0,
      videoviewcount: videoviewcount || 0,
      likescount: likescount || 0,
      commentscount: commentscount || 0,
      recorded_at: new Date().toISOString(),
      takenat,
      updated_by_email: updatedByEmail,
    });

    if (error) {
      console.error('Error recording views snapshot:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Get reels that need refresh based on priority
 * PRIORITY ORDER:
 * 1. Reels with 0 views (highest priority - need data)
 * 2. Reels based on decay priority and time since last refresh
 */
export async function getReelsForRefresh(
  maxReels: number = 50,
  userEmail?: string
): Promise<ReelForRefresh[]> {
  try {
    let query = supabase
      .from('reels')
      .select('id, shortcode, ownerusername, decay_priority, last_refresh_at, takenat, permalink, videoplaycount, videoviewcount')
      .not('shortcode', 'is', null);

    if (userEmail) {
      query = query.eq('created_by_email', userEmail);
    }

    const { data: reels, error } = await query.limit(maxReels * 3);
    if (error || !reels) return [];

    const now = new Date();
    const reelsWithPriority = reels.map(reel => {
      const decayPriority = reel.decay_priority || 
        (reel.takenat ? calculateDecayPriority(reel.takenat) : 50);
      const lastRefresh = reel.last_refresh_at 
        ? new Date(reel.last_refresh_at) 
        : new Date(reel.takenat || now);
      const daysSinceRefresh = (now.getTime() - lastRefresh.getTime()) / 86400000;
      
      // Check if reel has 0 views - these get HIGHEST priority
      const currentViews = reel.videoplaycount ?? reel.videoviewcount ?? 0;
      const hasZeroViews = currentViews === 0;
      
      // Score calculation:
      // - Reels with 0 views get a massive boost (10000 base score)
      // - Otherwise use decay priority * days since refresh
      const baseScore = hasZeroViews ? 10000 : 0;
      const regularScore = decayPriority * daysSinceRefresh;
      
      return {
        reel_id: reel.id,
        shortcode: reel.shortcode!,
        ownerusername: reel.ownerusername,
        decay_priority: decayPriority,
        last_refresh_at: reel.last_refresh_at,
        days_since_refresh: daysSinceRefresh,
        permalink: reel.permalink,
        hasZeroViews,
        score: baseScore + regularScore,
      };
    });

    // Sort by score (0 views reels first, then by regular priority)
    const zeroViewsCount = reelsWithPriority.filter(r => r.hasZeroViews).length;
    console.log(`📊 Found ${zeroViewsCount} reels with 0 views (will be refreshed first)`);
    
    return reelsWithPriority
      .sort((a, b) => b.score - a.score)
      .slice(0, maxReels)
      .map(({ score, hasZeroViews, ...rest }) => rest);
  } catch (err) {
    console.error('Error getting reels for refresh:', err);
    return [];
  }
}

/**
 * Get views growth data for reels in a date range
 */
export async function getViewsInRange(
  startDate: Date,
  endDate: Date,
  userEmail?: string
): Promise<ViewsGrowth[]> {
  try {
    // Get snapshots at start of range
    const { data: startSnapshots } = await supabase
      .from('views_history')
      .select('reel_id, videoplaycount, likescount')
      .lte('recorded_at', startDate.toISOString())
      .order('recorded_at', { ascending: false });

    // Get snapshots at end of range
    const { data: endSnapshots } = await supabase
      .from('views_history')
      .select('reel_id, videoplaycount, likescount, shortcode, ownerusername')
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: false });

    if (!endSnapshots) return [];

    // Group by reel_id and get latest snapshot for each
    const startMap = new Map<string, { views: number; likes: number }>();
    const endMap = new Map<string, { views: number; likes: number; shortcode: string; ownerusername: string | null }>();

    startSnapshots?.forEach(s => {
      if (!startMap.has(s.reel_id)) {
        startMap.set(s.reel_id, { views: s.videoplaycount || 0, likes: s.likescount || 0 });
      }
    });

    endSnapshots.forEach(s => {
      if (!endMap.has(s.reel_id)) {
        endMap.set(s.reel_id, { 
          views: s.videoplaycount || 0, 
          likes: s.likescount || 0,
          shortcode: s.shortcode,
          ownerusername: s.ownerusername,
        });
      }
    });

    // Calculate growth
    const results: ViewsGrowth[] = [];
    endMap.forEach((endData, reelId) => {
      const startData = startMap.get(reelId) || { views: 0, likes: 0 };
      results.push({
        reel_id: reelId,
        shortcode: endData.shortcode,
        ownerusername: endData.ownerusername,
        views_at_start: startData.views,
        views_at_end: endData.views,
        views_growth: endData.views - startData.views,
        likes_at_start: startData.likes,
        likes_at_end: endData.likes,
        likes_growth: endData.likes - startData.likes,
      });
    });

    return results;
  } catch (err) {
    console.error('❌ Error getting views in range:', err);
    return [];
  }
}

/**
 * Get total views growth for all reels in a date range
 */
export async function getTotalViewsGrowth(
  startDate: Date,
  endDate: Date,
  userEmail?: string
): Promise<{ totalViewsGrowth: number; totalLikesGrowth: number; reelsCount: number }> {
  const viewsData = await getViewsInRange(startDate, endDate, userEmail);
  
  return {
    totalViewsGrowth: viewsData.reduce((sum, r) => sum + r.views_growth, 0),
    totalLikesGrowth: viewsData.reduce((sum, r) => sum + r.likes_growth, 0),
    reelsCount: viewsData.length,
  };
}

/**
 * Get views history for a specific reel
 */
export async function getReelViewsHistory(
  reelId: string,
  limit: number = 100
): Promise<ViewsSnapshot[]> {
  try {
    const { data, error } = await supabase
      .from('views_history')
      .select('*')
      .eq('reel_id', reelId)
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting reel views history:', error);
      return [];
    }

    return (data as ViewsSnapshot[]) || [];
  } catch (err) {
    console.error('❌ Error getting reel views history:', err);
    return [];
  }
}

/**
 * Get latest snapshot for a reel
 */
export async function getLatestSnapshot(reelId: string): Promise<ViewsSnapshot | null> {
  try {
    const { data, error } = await supabase
      .from('views_history')
      .select('*')
      .eq('reel_id', reelId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return data as ViewsSnapshot;
  } catch (err) {
    return null;
  }
}

/**
 * Delete old snapshots to manage storage
 */
export async function cleanupOldSnapshots(daysToKeep: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await supabase
      .from('views_history')
      .delete()
      .lt('recorded_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Error cleaning up old snapshots:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (err) {
    console.error('❌ Error cleaning up old snapshots:', err);
    return 0;
  }
}