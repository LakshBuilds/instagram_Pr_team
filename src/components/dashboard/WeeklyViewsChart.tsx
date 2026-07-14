import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { startOfWeek, format, addWeeks, isSameWeek } from "date-fns";

interface Reel {
  id: string;
  videoplaycount: number | null;
  takenat: string | null;
  created_by_email?: string | null;
  ownerusername?: string | null;
}

interface WeeklyViewsChartProps {
  reels: Reel[];
  weeks?: number; // how many weeks back to show (default 8)
}

const formatViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">Week of {label}</p>
      <p className="text-emerald-600 dark:text-emerald-400">
        👁 {payload[0].value.toLocaleString()} views
      </p>
      {payload[1] && (
        <p className="text-blue-500">📹 {payload[1].value} reels</p>
      )}
    </div>
  );
};

export default function WeeklyViewsChart({ reels, weeks = 10 }: WeeklyViewsChartProps) {
  const data = useMemo(() => {
    // Build week buckets for last N weeks
    const now = new Date();
    const buckets: { weekStart: Date; label: string; views: number; count: number }[] = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = startOfWeek(addWeeks(now, -i), { weekStartsOn: 1 }); // Mon
      buckets.push({
        weekStart,
        label: format(weekStart, "d MMM"),
        views: 0,
        count: 0,
      });
    }

    // Assign each reel to its week
    reels.forEach((reel) => {
      if (!reel.takenat) return;
      const reelDate = new Date(reel.takenat);
      const bucket = buckets.find((b) => isSameWeek(reelDate, b.weekStart, { weekStartsOn: 1 }));
      if (bucket) {
        bucket.views += Number(reel.videoplaycount) || 0;
        bucket.count += 1;
      }
    });

    return buckets.map((b) => ({
      week: b.label,
      views: b.views,
      reels: b.count,
    }));
  }, [reels, weeks]);

  const maxViews = Math.max(...data.map((d) => d.views), 1);
  const thisWeekViews = data[data.length - 1]?.views || 0;
  const lastWeekViews = data[data.length - 2]?.views || 0;
  const growth = lastWeekViews > 0 ? ((thisWeekViews - lastWeekViews) / lastWeekViews) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base">Weekly Views</CardTitle>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-600">{formatViews(thisWeekViews)}</p>
            <p className={`text-xs font-medium ${growth >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {growth >= 0 ? "▲" : "▼"} {Math.abs(growth).toFixed(1)}% vs last week
            </p>
          </div>
        </div>
        <CardDescription>Views per week based on reel posting date (last {weeks} weeks)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatViews}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="views" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    index === data.length - 1
                      ? "hsl(var(--chart-1))"   // this week — highlight
                      : entry.views >= maxViews * 0.7
                      ? "hsl(var(--chart-2))"   // high weeks — green
                      : "hsl(var(--chart-4))"   // normal weeks — blue
                  }
                  fillOpacity={index === data.length - 1 ? 1 : 0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-[hsl(var(--chart-1))] inline-block" />
            This week
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-[hsl(var(--chart-2))] inline-block" />
            High weeks
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-[hsl(var(--chart-4))] inline-block" />
            Other weeks
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
