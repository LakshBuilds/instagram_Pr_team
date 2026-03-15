import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Video } from "@/lib/types";

interface Props {
  videos: Video[];
  title?: string;
  description?: string;
}

const COMMON_THEMES = [
  "funny", "comedy", "meme", "viral", "trending", "challenge", "dance", "music",
  "food", "cooking", "recipe", "fitness", "workout", "motivation", "inspiration",
  "fashion", "style", "outfit", "beauty", "makeup", "skincare", "travel", "adventure",
  "tech", "gadget", "review", "tutorial", "tips", "hack", "life", "lifestyle",
];

const ThemePerformanceChart = ({
  videos,
  title = "Theme / Caption Performance",
  description = "Performance by common themes and hashtags",
}: Props) => {
  const themeStats: Record<string, { views: number; likes: number; comments: number; count: number }> = {};

  videos
    .filter((v) => v.title)
    .forEach((v) => {
      const text = (v.title || "").toLowerCase();
      const hashtags = text.match(/#\w+/g) || [];
      const found = new Set<string>();

      COMMON_THEMES.forEach((t) => { if (text.includes(t)) found.add(t); });
      hashtags.forEach((tag) => { const name = tag.substring(1).toLowerCase(); if (name.length > 2) found.add(`#${name}`); });

      found.forEach((theme) => {
        if (!themeStats[theme]) themeStats[theme] = { views: 0, likes: 0, comments: 0, count: 0 };
        themeStats[theme].views += v.view_count ?? 0;
        themeStats[theme].likes += v.like_count ?? 0;
        themeStats[theme].comments += v.comment_count ?? 0;
        themeStats[theme].count += 1;
      });
    });

  const data = Object.entries(themeStats)
    .filter(([, s]) => s.count >= 2)
    .map(([theme, s]) => ({
      theme: theme.length > 15 ? theme.substring(0, 15) + "..." : theme,
      avgViews: Math.round(s.views / s.count),
      avgLikes: Math.round(s.likes / s.count),
      avgComments: Math.round(s.comments / s.count),
      count: s.count,
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <YAxis type="category" dataKey="theme" width={120} className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
            <Legend />
            <Bar dataKey="avgViews" name="Avg Views" fill="hsl(var(--chart-4))" />
            <Bar dataKey="avgLikes" name="Avg Likes" fill="hsl(var(--chart-2))" />
            <Bar dataKey="avgComments" name="Avg Comments" fill="hsl(var(--chart-3))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ThemePerformanceChart;
