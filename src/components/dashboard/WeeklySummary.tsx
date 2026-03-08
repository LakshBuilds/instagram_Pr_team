import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Save, TrendingUp, Video } from "lucide-react";
import { toast } from "sonner";
import {
  getPreviousTwoWeeksSnapshots,
  getLatestWeeklySnapshot,
  saveWeeklySnapshot,
  getWeekStart,
  type WeeklySnapshotRow,
} from "@/lib/weeklySnapshot";

const formatViews = (num: number): string => {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toLocaleString();
};

/** e.g. "22 Feb" for week label */
const formatWeekLabel = (isoDate: string): string => {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

interface WeeklySummaryProps {
  totalViews: number;
  totalReels: number;
  totalLikes: number;
  totalComments: number;
  totalPayout: number;
}

export default function WeeklySummary({
  totalViews,
  totalReels,
  totalLikes,
  totalComments,
  totalPayout,
}: WeeklySummaryProps) {
  const [previous, setPrevious] = useState<WeeklySnapshotRow | null>(null);
  const [weekBeforePrevious, setWeekBeforePrevious] = useState<WeeklySnapshotRow | null>(null);
  const [latest, setLatest] = useState<WeeklySnapshotRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadLatest = async () => {
    setLoading(true);
    const [twoWeeks, lat] = await Promise.all([getPreviousTwoWeeksSnapshots(), getLatestWeeklySnapshot()]);
    setPrevious(twoWeeks.previous);
    setWeekBeforePrevious(twoWeeks.weekBeforePrevious);
    setLatest(lat);
    setLoading(false);
  };

  useEffect(() => {
    loadLatest();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const result = await saveWeeklySnapshot({
      totalViews,
      totalReels,
      totalLikes,
      totalComments,
      totalPayout,
    });
    setSaving(false);
    if (result.success) {
      toast.success("This week’s snapshot saved. Next week you’ll see the comparison here.");
      loadLatest();
    } else {
      toast.error(result.error || "Failed to save snapshot");
    }
  };

  const thisWeekStart = getWeekStart();
  const isThisWeekAlreadySaved = latest?.week_start_date === thisWeekStart;
  const viewsGrowth = previous != null ? totalViews - previous.total_views : null;
  const reelsGrowth = previous != null ? totalReels - previous.total_reels : null;
  const previousWeekViewsGrowth =
    previous != null && weekBeforePrevious != null
      ? previous.total_views - weekBeforePrevious.total_views
      : null;
  const previousWeekReelsGrowth =
    previous != null && weekBeforePrevious != null
      ? previous.total_reels - weekBeforePrevious.total_reels
      : null;

  return (
    <Card className="border-chart-4/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-chart-4" />
            <CardTitle>Weekly Update</CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={saving}
            className="gap-1"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save this week’s snapshot"}
          </Button>
        </div>
        <CardDescription>
          Save a snapshot each week to see “this week vs previous week” and use it in your reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            This week (Week of {formatWeekLabel(thisWeekStart)})
          </p>
          <p className="text-sm font-medium text-foreground">
            Insta we reached <span className="text-chart-4 font-semibold">{formatViews(totalViews)} views</span>
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Video className="h-4 w-4" />
            We created all around <span className="font-medium text-foreground">{totalReels.toLocaleString()} videos</span>
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading previous week…</p>
        ) : previous ? (
          <>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Previous week</span> (Week of {formatWeekLabel(previous.week_start_date)}):{" "}
              {formatViews(previous.total_views)} views, {previous.total_reels.toLocaleString()} reels
            </div>
            {previousWeekViewsGrowth !== null && weekBeforePrevious && (
              <div className="rounded-lg border border-muted bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Previous week</span> (Week of {formatWeekLabel(previous.week_start_date)}) had{" "}
                <span className="font-semibold text-chart-2">
                  {previousWeekViewsGrowth >= 0 ? "+" : ""}{formatViews(previousWeekViewsGrowth)} more views
                </span>{" "}
                than the week before (Week of {formatWeekLabel(weekBeforePrevious.week_start_date)}).
                {previousWeekReelsGrowth !== null && previousWeekReelsGrowth !== 0 && (
                  <span className="block mt-1">
                    Reels: {previousWeekReelsGrowth >= 0 ? "+" : ""}{previousWeekReelsGrowth}.
                  </span>
                )}
              </div>
            )}
            {(viewsGrowth !== null || reelsGrowth !== null) && (
              <div className="flex flex-wrap gap-3 rounded-lg border border-chart-2/30 bg-chart-2/5 p-3">
                {viewsGrowth !== null && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <TrendingUp className="h-4 w-4 text-chart-2" />
                    From previous week we got{" "}
                    <span className="font-semibold text-chart-2">
                      {viewsGrowth >= 0 ? "+" : ""}{formatViews(viewsGrowth)} more views
                    </span>
                  </span>
                )}
                {reelsGrowth !== null && reelsGrowth !== 0 && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <Video className="h-4 w-4 text-chart-3" />
                    <span className="font-semibold text-chart-3">
                      {reelsGrowth >= 0 ? "+" : ""}{reelsGrowth} reels
                    </span>
                  </span>
                )}
              </div>
            )}
            {isThisWeekAlreadySaved && (
              <p className="text-xs text-muted-foreground">
                This week’s snapshot already saved. Save again to update with latest numbers.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No previous week snapshot yet. Click “Save this week’s snapshot” now; next week you’ll see the comparison and growth here.
          </p>
        )}

        <div className="pt-3 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">What to do in Supabase (one-time + weekly)</p>
          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
            <li>One-time: In Supabase Dashboard → SQL Editor, run the migration <code className="bg-muted px-1 rounded">20250303000000_weekly_snapshots.sql</code> to create the <code className="bg-muted px-1 rounded">weekly_snapshots</code> table.</li>
            <li>Every Monday: Click “Save this week’s snapshot” above. No need to do anything else in Supabase.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
