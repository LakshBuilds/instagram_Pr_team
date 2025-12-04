import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Reel {
  video_duration?: number | null;
  videoplaycount: number | null;
  likescount: number | null;
  commentscount: number | null;
}

interface DurationPerformanceChartProps {
  reels: Reel[];
  title?: string;
  description?: string;
}

const DurationPerformanceChart = ({ 
  reels, 
  title = "Duration vs Performance",
  description = "Average performance by video duration (ideal reel length)"
}: DurationPerformanceChartProps) => {
  // Group reels by duration buckets
  const durationBuckets: { [key: string]: { views: number; likes: number; comments: number; count: number } } = {};
  
  reels
    .filter(reel => reel.video_duration && reel.video_duration > 0)
    .forEach(reel => {
      const duration = reel.video_duration!;
      let bucket = "";
      
      if (duration <= 15) bucket = "0-15s";
      else if (duration <= 30) bucket = "16-30s";
      else if (duration <= 45) bucket = "31-45s";
      else if (duration <= 60) bucket = "46-60s";
      else bucket = "60s+";
      
      if (!durationBuckets[bucket]) {
        durationBuckets[bucket] = { views: 0, likes: 0, comments: 0, count: 0 };
      }
      
      durationBuckets[bucket].views += reel.videoplaycount || reel.videoviewcount || 0;
      durationBuckets[bucket].likes += reel.likescount || 0;
      durationBuckets[bucket].comments += reel.commentscount || 0;
      durationBuckets[bucket].count += 1;
    });

  const data = Object.entries(durationBuckets)
    .map(([duration, stats]) => ({
      duration,
      avgViews: Math.round(stats.views / stats.count),
      avgLikes: Math.round(stats.likes / stats.count),
      avgComments: Math.round(stats.comments / stats.count),
      count: stats.count,
    }))
    .sort((a, b) => {
      const order = ["0-15s", "16-30s", "31-45s", "46-60s", "60s+"];
      return order.indexOf(a.duration) - order.indexOf(b.duration);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="duration" 
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Bar dataKey="avgViews" name="Avg Views" fill="hsl(var(--chart-4))" />
            <Bar dataKey="avgLikes" name="Avg Likes" fill="hsl(var(--chart-2))" />
            <Bar dataKey="avgComments" name="Avg Comments" fill="hsl(var(--chart-3))" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>Total reels analyzed: {reels.filter(r => r.video_duration && r.video_duration > 0).length}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DurationPerformanceChart;


