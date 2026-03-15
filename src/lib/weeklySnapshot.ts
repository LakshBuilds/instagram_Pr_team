import { supabase } from "@/integrations/supabase/client";

export interface WeeklySnapshotRow {
  id: string;
  week_start_date: string;
  total_views: number;
  total_videos: number;
  total_likes: number;
  total_comments: number;
  total_payout: number | null;
  created_at: string | null;
}

/** Get Monday 00:00:00 of the week for a given date (ISO date string) */
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Save current week's snapshot. Uses week_start_date = Monday of current week.
 * If this week already has a snapshot, it is updated.
 */
export async function saveWeeklySnapshot(stats: {
  totalViews: number;
  totalVideos: number;
  totalLikes: number;
  totalComments: number;
  totalPayout: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const weekStart = getWeekStart();
    const { error } = await supabase.from("weekly_snapshots").upsert(
      {
        week_start_date: weekStart,
        total_views: stats.totalViews,
        total_videos: stats.totalVideos,
        total_likes: stats.totalLikes,
        total_comments: stats.totalComments,
        total_payout: stats.totalPayout,
      },
      { onConflict: "week_start_date" }
    );
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/** Get the most recent snapshot (any week) */
export async function getLatestWeeklySnapshot(): Promise<WeeklySnapshotRow | null> {
  const { data, error } = await supabase
    .from("weekly_snapshots")
    .select("*")
    .order("week_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as WeeklySnapshotRow;
}

/**
 * Get the snapshot to use as "previous week" for comparison.
 * If the latest snapshot is for the current week, returns the one before that.
 */
export async function getPreviousWeekSnapshot(): Promise<WeeklySnapshotRow | null> {
  const thisWeek = getWeekStart();
  const { data: list, error } = await supabase
    .from("weekly_snapshots")
    .select("*")
    .order("week_start_date", { ascending: false })
    .limit(2);
  if (error || !list?.length) return null;
  const rows = list as WeeklySnapshotRow[];
  if (rows[0].week_start_date === thisWeek && rows.length > 1) return rows[1];
  return rows[0];
}

/**
 * Get previous week and the week before that (for "previous week had X more than week before").
 */
export async function getPreviousTwoWeeksSnapshots(): Promise<{
  previous: WeeklySnapshotRow | null;
  weekBeforePrevious: WeeklySnapshotRow | null;
}> {
  const thisWeek = getWeekStart();
  const { data: list, error } = await supabase
    .from("weekly_snapshots")
    .select("*")
    .order("week_start_date", { ascending: false })
    .limit(3);
  if (error || !list?.length) return { previous: null, weekBeforePrevious: null };
  const rows = list as WeeklySnapshotRow[];
  let previous: WeeklySnapshotRow | null = null;
  let weekBeforePrevious: WeeklySnapshotRow | null = null;
  if (rows[0].week_start_date === thisWeek) {
    if (rows.length > 1) previous = rows[1];
    if (rows.length > 2) weekBeforePrevious = rows[2];
  } else {
    previous = rows[0];
    if (rows.length > 1) weekBeforePrevious = rows[1];
  }
  return { previous, weekBeforePrevious };
}

/** Get snapshot for a specific week (Monday date string YYYY-MM-DD) */
export async function getSnapshotForWeek(weekStartDate: string): Promise<WeeklySnapshotRow | null> {
  const { data, error } = await supabase
    .from("weekly_snapshots")
    .select("*")
    .eq("week_start_date", weekStartDate)
    .maybeSingle();
  if (error || !data) return null;
  return data as WeeklySnapshotRow;
}
