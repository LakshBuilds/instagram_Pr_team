import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Save, TrendingUp, Video } from "lucide-react";
import { toast } from "sonner";
import { formatViews } from "@/lib/utils";
import {
  getPreviousTwoWeeksSnapshots,
  getLatestWeeklySnapshot,
  saveWeeklySnapshot,
  getWeekStart,
  type WeeklySnapshotRow,
} from "@/lib/weeklySnapshot";

const formatWeekLabel = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

interface Props {
  totalViews: number;
  totalVideos: number;
  totalLikes: number;
  totalComments: number;
  totalPayout: number;
}

export default function WeeklySummary({ totalViews, totalVideos, totalLikes, totalComments, totalPayout }: Props) {
  const [previous, setPrevious] = useState<WeeklySnapshotRow | null>(null);
  const [weekBefore, setWeekBefore] = useState<WeeklySnapshotRow | null>(null);
  const [latest, setLatest] = useState<WeeklySnapshotRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadLatest = async () => {
    setLoading(true);
    const [two, lat] = await Promise.all([getPreviousTwoWeeksSnapshots(), getLatestWeeklySnapshot()]);
    setPrevious(two.previous);
    setWeekBefore(two.weekBeforePrevious);
    setLatest(lat);
    setLoading(false);
  };

  useEffect(() => { loadLatest(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const result = await saveWeeklySnapshot({ totalViews, totalVideos, totalLikes, totalComments, totalPayout });
    setSaving(false);
    if (result.success) {
      toast.success("Snapshot saved. Next week you'll see the comparison.");
      loadLatest();
    } else {
      toast.error(result.error || "Failed to save snapshot");
    }
  };

  const thisWeekStart = getWeekStart();
  const isAlreadySaved = latest?.week_start_date === thisWeekStart;
  const viewsGrowth = previous != null ? totalViews - previous.total_views : null;
  const videosGrowth = previous != null ? totalVideos - ((previous as any).total_videos ?? 0) : null;
  const prevWeekViewsGrowth = previous && weekBefore ? previous.total_views - weekBefore.total_views : null;
  const prevWeekVideosGrowth = previous && weekBefore ? ((previous as any).total_videos ?? 0) - ((weekBefore as any).total_videos ?? 0) : null;

  return (
    <Card className="border-chart-4/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-chart-4" />
            <CardTitle>Weekly Update</CardTitle>
          </div>
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="gap-1">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save this week's snapshot"}
          </Button>
        </div>
        <CardDescription>Save a snapshot each week to see "this week vs previous week" and use it in your reports.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This week (Week of {formatWeekLabel(thisWeekStart)})</p>
          <p className="text-sm font-medium text-foreground">YouTube we reached <span className="text-chart-4 font-semibold">{formatViews(totalViews)} views</span></p>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Video className="h-4 w-4" />
            We created all around <span className="font-medium text-foreground">{totalVideos.toLocaleString()} videos</span>
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading previous week...</p>
        ) : previous ? (
          <>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Previous week</span> (Week of {formatWeekLabel(previous.week_start_date)}):{" "}
              {formatViews(previous.total_views)} views, {((previous as any).total_videos || 0).toLocaleString()} videos
            </div>
            {prevWeekViewsGrowth !== null && weekBefore && (
              <div className="rounded-lg border border-muted bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Previous week</span> had{" "}
                <span className="font-semibold text-chart-2">{prevWeekViewsGrowth >= 0 ? "+" : ""}{formatViews(prevWeekViewsGrowth)} more views</span>{" "}
                than the week before.
                {prevWeekVideosGrowth !== null && prevWeekVideosGrowth !== 0 && (
                  <span className="block mt-1">Videos: {prevWeekVideosGrowth >= 0 ? "+" : ""}{prevWeekVideosGrowth}.</span>
                )}
              </div>
            )}
            {(viewsGrowth !== null || videosGrowth !== null) && (
              <div className="flex flex-wrap gap-3 rounded-lg border border-chart-2/30 bg-chart-2/5 p-3">
                {viewsGrowth !== null && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <TrendingUp className="h-4 w-4 text-chart-2" />
                    From previous week we got{" "}
                    <span className="font-semibold text-chart-2">{viewsGrowth >= 0 ? "+" : ""}{formatViews(viewsGrowth)} more views</span>
                  </span>
                )}
                {videosGrowth !== null && videosGrowth !== 0 && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <Video className="h-4 w-4 text-chart-3" />
                    <span className="font-semibold text-chart-3">{videosGrowth >= 0 ? "+" : ""}{videosGrowth} videos</span>
                  </span>
                )}
              </div>
            )}
            {isAlreadySaved && (
              <p className="text-xs text-muted-foreground">Snapshot already saved. Save again to update with latest numbers.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No previous week snapshot yet. Click "Save this week's snapshot" now; next week you'll see the comparison here.</p>
        )}
      </CardContent>
    </Card>
  );
}
