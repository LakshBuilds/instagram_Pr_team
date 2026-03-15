import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Video } from "@/lib/types";
import { extractUsername } from "@/lib/utils";

interface Props {
  videos: Video[];
  title?: string;
  description?: string;
}

const CreatorComparisonChart = ({
  videos,
  title = "Creator Comparison",
  description = "Performance comparison across team members",
}: Props) => {
  const stats: Record<string, { views: number; likes: number; comments: number; payout: number; count: number; name: string; email: string }> = {};

  videos.forEach((v) => {
    const username = extractUsername(v.created_by_email);
    if (!username) return;
    const key = username.toLowerCase().trim();
    const display = username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();

    if (!stats[key]) stats[key] = { views: 0, likes: 0, comments: 0, payout: 0, count: 0, name: display, email: v.created_by_email || "" };
    stats[key].views += v.view_count ?? 0;
    stats[key].likes += v.like_count ?? 0;
    stats[key].comments += v.comment_count ?? 0;
    stats[key].payout += Number(v.payout) || 0;
    stats[key].count += 1;
  });

  const data = Object.values(stats)
    .map((s) => ({
      creator: s.name.length > 15 ? s.name.substring(0, 15) + "..." : s.name,
      fullName: s.name,
      email: s.email,
      totalViews: s.views,
      totalLikes: s.likes,
      totalComments: s.comments,
      avgViews: Math.round(s.views / s.count),
      avgLikes: Math.round(s.likes / s.count),
      avgComments: Math.round(s.comments / s.count),
      totalPayout: +s.payout.toFixed(2),
      count: s.count,
    }))
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 10);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
        <CardContent><div className="flex items-center justify-center h-64 text-muted-foreground">No creator data available</div></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <YAxis type="category" dataKey="creator" width={150} className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                    <p className="font-semibold text-base">{d.fullName}</p>
                    <p className="text-xs text-muted-foreground">{d.email}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-chart-4">Total Views: {d.totalViews.toLocaleString()}</p>
                      <p className="text-sm font-medium text-chart-2">Total Likes: {d.totalLikes.toLocaleString()}</p>
                      <p className="text-sm font-medium text-chart-3">Total Comments: {d.totalComments.toLocaleString()}</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border space-y-1">
                      <p className="text-xs text-muted-foreground">Avg Views/Video: {d.avgViews.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Avg Likes/Video: {d.avgLikes.toLocaleString()}</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-sm">Total Payout: <span className="font-semibold">₹{d.totalPayout.toFixed(2)}</span></p>
                      <p className="text-xs text-muted-foreground">{d.count} videos added</p>
                    </div>
                  </div>
                );
              }}
            />
            <Legend />
            <Bar dataKey="totalViews" name="Total Views" fill="hsl(var(--chart-4))" />
            <Bar dataKey="totalLikes" name="Total Likes" fill="hsl(var(--chart-2))" />
            <Bar dataKey="totalComments" name="Total Comments" fill="hsl(var(--chart-3))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default CreatorComparisonChart;
