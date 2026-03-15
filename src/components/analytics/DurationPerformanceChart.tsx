import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Video } from "@/lib/types";

interface Props {
  videos: Video[];
  title?: string;
  description?: string;
}

const BUCKET_ORDER = ["0-15s", "16-30s", "31-45s", "46-60s", "60s+"];

const DurationPerformanceChart = ({
  videos,
  title = "Duration vs Performance",
  description = "Average performance by video duration",
}: Props) => {
  const buckets: Record<string, { views: number; likes: number; comments: number; count: number }> = {};

  videos
    .filter((v) => v.duration_seconds && v.duration_seconds > 0)
    .forEach((v) => {
      const d = v.duration_seconds!;
      const bucket = d <= 15 ? "0-15s" : d <= 30 ? "16-30s" : d <= 45 ? "31-45s" : d <= 60 ? "46-60s" : "60s+";
      if (!buckets[bucket]) buckets[bucket] = { views: 0, likes: 0, comments: 0, count: 0 };
      buckets[bucket].views += v.view_count ?? 0;
      buckets[bucket].likes += v.like_count ?? 0;
      buckets[bucket].comments += v.comment_count ?? 0;
      buckets[bucket].count += 1;
    });

  const data = Object.entries(buckets)
    .map(([duration, s]) => ({
      duration,
      avgViews: Math.round(s.views / s.count),
      avgLikes: Math.round(s.likes / s.count),
      avgComments: Math.round(s.comments / s.count),
      count: s.count,
    }))
    .sort((a, b) => BUCKET_ORDER.indexOf(a.duration) - BUCKET_ORDER.indexOf(b.duration));

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="duration" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
            <Legend />
            <Bar dataKey="avgViews" name="Avg Views" fill="hsl(var(--chart-4))" />
            <Bar dataKey="avgLikes" name="Avg Likes" fill="hsl(var(--chart-2))" />
            <Bar dataKey="avgComments" name="Avg Comments" fill="hsl(var(--chart-3))" />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-4 text-sm text-muted-foreground">
          Total videos analyzed: {videos.filter((v) => v.duration_seconds && v.duration_seconds > 0).length}
        </p>
      </CardContent>
    </Card>
  );
};

export default DurationPerformanceChart;
