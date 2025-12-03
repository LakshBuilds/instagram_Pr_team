import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Reel {
  videoplaycount: number | null;
  likescount: number | null;
  commentscount: number | null;
}

interface EngagementScatterChartProps {
  reels: Reel[];
  title?: string;
  description?: string;
}

const EngagementScatterChart = ({ 
  reels, 
  title = "Engagement vs Views",
  description = "Quality (engagement rate) vs Virality (views)"
}: EngagementScatterChartProps) => {
  const data = reels
    .filter(reel => reel.videoplaycount && reel.videoplaycount > 0)
    .map(reel => {
      const views = reel.videoplaycount || 0;
      const likes = reel.likescount || 0;
      const comments = reel.commentscount || 0;
      const engagement = likes + comments * 2; // Weight comments more
      const engagementRate = views > 0 ? (engagement / views) * 100 : 0;
      
      return {
        views,
        engagementRate: parseFloat(engagementRate.toFixed(2)),
        engagement,
        likes,
        comments,
      };
    })
    .sort((a, b) => a.views - b.views);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

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
            <XAxis 
              type="number"
              dataKey="views" 
              name="Views"
              label={{ value: 'Views', position: 'insideBottom', offset: -5 }}
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis 
              type="number"
              dataKey="engagementRate" 
              name="Engagement Rate (%)"
              label={{ value: 'Engagement Rate (%)', angle: -90, position: 'insideLeft' }}
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">Views: {data.views.toLocaleString()}</p>
                      <p className="text-sm">Engagement Rate: {data.engagementRate}%</p>
                      <p className="text-sm">Likes: {data.likes.toLocaleString()}</p>
                      <p className="text-sm">Comments: {data.comments.toLocaleString()}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter name="Reels" data={data} fill="#8884d8">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default EngagementScatterChart;


