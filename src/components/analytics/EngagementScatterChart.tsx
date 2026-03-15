import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Video } from "@/lib/types";

interface Props {
  videos: Video[];
  title?: string;
  description?: string;
}

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00ff00"];

const EngagementScatterChart = ({
  videos,
  title = "Engagement vs Views",
  description = "Quality (engagement rate) vs Virality (views)",
}: Props) => {
  const data = videos
    .filter((v) => v.view_count && v.view_count > 0)
    .map((v) => {
      const views = v.view_count!;
      const likes = v.like_count ?? 0;
      const comments = v.comment_count ?? 0;
      const engagement = likes + comments * 2;
      const engagementRate = views > 0 ? (engagement / views) * 100 : 0;
      return { views, engagementRate: +engagementRate.toFixed(2), likes, comments };
    })
    .sort((a, b) => a.views - b.views);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" dataKey="views" name="Views" label={{ value: "Views", position: "insideBottom", offset: -5 }} className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <YAxis type="number" dataKey="engagementRate" name="Engagement Rate (%)" label={{ value: "Engagement Rate (%)", angle: -90, position: "insideLeft" }} className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                    <p className="font-semibold">Views: {d.views.toLocaleString()}</p>
                    <p className="text-sm">Engagement Rate: {d.engagementRate}%</p>
                    <p className="text-sm">Likes: {d.likes.toLocaleString()}</p>
                    <p className="text-sm">Comments: {d.comments.toLocaleString()}</p>
                  </div>
                );
              }}
            />
            <Scatter name="Videos" data={data} fill="#8884d8">
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default EngagementScatterChart;
