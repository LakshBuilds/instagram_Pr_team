import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getHours, getDay } from "date-fns";
import type { Video } from "@/lib/types";

interface Props {
  videos: Video[];
  title?: string;
  description?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const PostingTimeHeatmap = ({
  videos,
  title = "Posting Time Heatmap",
  description = "Best times to post based on performance",
}: Props) => {
  const heatmap: Record<string, { views: number; likes: number; count: number }> = {};

  videos
    .filter((v) => v.published_at)
    .forEach((v) => {
      const date = new Date(v.published_at!);
      const key = `${getDay(date)}-${getHours(date)}`;
      if (!heatmap[key]) heatmap[key] = { views: 0, likes: 0, count: 0 };
      heatmap[key].views += v.view_count ?? 0;
      heatmap[key].likes += v.like_count ?? 0;
      heatmap[key].count += 1;
    });

  const getCell = (day: number, hour: number) => {
    const d = heatmap[`${day}-${hour}`];
    if (!d || d.count === 0) return { avgViews: 0, avgLikes: 0, count: 0 };
    return { avgViews: Math.round(d.views / d.count), avgLikes: Math.round(d.likes / d.count), count: d.count };
  };

  const maxViews = Math.max(...Object.values(heatmap).map((d) => (d.count > 0 ? d.views / d.count : 0)), 1);
  const intensity = (avg: number) => (avg === 0 ? 0 : Math.min(100, (avg / maxViews) * 100));

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: "80px repeat(24, 1fr)" }}>
              <div className="text-xs text-muted-foreground font-semibold">Day/Hour</div>
              {HOURS.map((h) => (
                <div key={h} className="text-xs text-muted-foreground text-center font-semibold">{h}:00</div>
              ))}
            </div>
            {DAYS.map((dayName, di) => (
              <div key={di} className="grid gap-1 mb-1" style={{ gridTemplateColumns: "80px repeat(24, 1fr)" }}>
                <div className="text-xs font-semibold text-muted-foreground flex items-center">{dayName}</div>
                {HOURS.map((h) => {
                  const cell = getCell(di, h);
                  const pct = intensity(cell.avgViews);
                  const bg = pct > 0 ? `hsl(var(--chart-4) / ${Math.max(0.2, pct / 100)})` : "hsl(var(--muted) / 0.1)";
                  return (
                    <div
                      key={`${di}-${h}`}
                      className="aspect-square rounded border border-border flex flex-col items-center justify-center p-1 text-xs hover:scale-105 transition-transform cursor-pointer relative group"
                      style={{ backgroundColor: bg }}
                      title={`${dayName} ${h}:00 - Avg Views: ${cell.avgViews.toLocaleString()}, Posts: ${cell.count}`}
                    >
                      <span className="font-semibold text-[10px]">{cell.avgViews > 0 ? (cell.avgViews / 1000).toFixed(0) + "k" : "-"}</span>
                      <span className="text-[8px] text-muted-foreground">{cell.count}</span>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10 bg-card border border-border rounded-lg p-2 shadow-lg text-xs whitespace-nowrap">
                        <p className="font-semibold">{dayName} {h}:00</p>
                        <p>Avg Views: {cell.avgViews.toLocaleString()}</p>
                        <p>Avg Likes: {cell.avgLikes.toLocaleString()}</p>
                        <p>Posts: {cell.count}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded border border-border bg-muted/10" /><span>No posts</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: "hsl(var(--chart-4) / 0.2)" }} /><span>Low</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: "hsl(var(--chart-4) / 0.6)" }} /><span>Medium</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: "hsl(var(--chart-4) / 1)" }} /><span>High</span></div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostingTimeHeatmap;
